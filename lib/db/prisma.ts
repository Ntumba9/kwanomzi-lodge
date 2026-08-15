import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * DATABASE_URL is a standard mysql:// URL — that's what schema.prisma's
 * `provider = "mysql"` and the Prisma migration/schema engine expect.
 *
 * The mariadb npm package (which @prisma/adapter-mariadb wraps) has its own
 * connection-string parser that only recognizes a "mariadb://" scheme
 * (verified against node_modules/mariadb/lib/config/connection-options.js) —
 * passing our mysql:// string straight through fails there. Rather than
 * keep two differently-scoped DATABASE_URL formats, we parse the one
 * standard URL ourselves and hand the adapter discrete fields instead.
 */
function adapterConfigFromDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  };
}

// mariadb's own pool default (10) is sized for a single long-lived server
// process. On Vercel, every concurrently warm serverless instance holds its
// own pool of this size, so the effective connection count against the
// database scales with traffic, not with a single tunable pool. Left
// unset (the default for local dev/test, where it's harmless) unless
// DATABASE_CONNECTION_LIMIT is explicitly provided — set that in production
// only if the database's max_connections needs a tighter cap.
const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT
  ? Number(process.env.DATABASE_CONNECTION_LIMIT)
  : undefined;

// MySQL 8's default auth plugin (caching_sha2_password, used by both local
// MySQL80 and AWS RDS MySQL 8) needs one of two things to transmit
// credentials on a fresh connection: TLS, or the client fetching the
// server's RSA public key to encrypt the password itself. Set
// DATABASE_SSL=true in production (RDS) to use real TLS. Left unset in
// local dev, where there's no TLS listener to speak to, so we fall back to
// public-key retrieval instead — safe here since the connection never
// leaves the loopback interface; deliberately NOT used for production,
// which gets real TLS instead (see the mariadb.PoolConfig
// `ssl`/`allowPublicKeyRetrieval` documentation at
// node_modules/mariadb/types/share.d.ts).
const sslEnabled = process.env.DATABASE_SSL === "true";

/**
 * RDS's server certificate chains to Amazon's own "Amazon RDS" root CA,
 * which is NOT in Node's default trusted root store — connecting with
 * `ssl: true` alone fails every connection with SELF_SIGNED_CERT_IN_CHAIN
 * (verified directly against kwanomzi-production, not assumed). The fix is
 * to supply Amazon's own CA bundle explicitly and keep full certificate
 * verification on (rejectUnauthorized stays true), rather than the common
 * shortcut of disabling verification — that would still encrypt the
 * connection but silently accept a forged certificate from anyone able to
 * intercept traffic to the RDS endpoint.
 *
 * Bundle source: https://truststore.pki.rds.amazonaws.com/eu-north-1/eu-north-1-bundle.pem
 * (matches kwanomzi-production's region; re-download from the matching
 * region path if the database ever moves). This is Amazon's own public CA
 * certificate, not a secret — safe to commit.
 */
function loadRdsCaBundle(): string {
  return readFileSync(join(process.cwd(), "certs/rds-eu-north-1-bundle.pem"), "utf8");
}

const adapter = new PrismaMariaDb({
  ...adapterConfigFromDatabaseUrl(process.env.DATABASE_URL ?? ""),
  ...(connectionLimit ? { connectionLimit } : {}),
  ...(sslEnabled ? { ssl: { ca: loadRdsCaBundle(), rejectUnauthorized: true } } : { allowPublicKeyRetrieval: true }),
});

// Reuses a single PrismaClient across hot reloads in development so `next dev`
// doesn't exhaust the database connection pool by creating a new client per reload.
export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
