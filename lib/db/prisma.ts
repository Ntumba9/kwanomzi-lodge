import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ensureRelayListening, type MtlsRelayConfig } from "@/lib/db/mtlsRelay";

declare global {
  var __prismaPromise: Promise<PrismaClient> | undefined;
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
// DATABASE_SSL=true to use real TLS directly against the database (the
// direct-RDS path — see relayConfigFromEnv() below for the alternative
// mTLS-relay path, which handles its own transport security and always
// uses public-key retrieval at the MySQL-protocol level; see that
// function's comment for why). Left unset in local dev, where there's no
// TLS listener to speak to, so we fall back to public-key retrieval
// instead — safe here since the connection never leaves the loopback
// interface (see the mariadb.PoolConfig `ssl`/`allowPublicKeyRetrieval`
// documentation at node_modules/mariadb/types/share.d.ts).
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

/**
 * Phase 3: Vercel Hobby/Pro has no static outbound IP, so RDS can't allow-
 * list it directly — instead the app reaches RDS through an EC2 proxy
 * (fixed Elastic IP) over mutual TLS. See infra/mtls-relay/ for the EC2
 * side and lib/db/mtlsRelay.ts for why a local loopback bridge is needed
 * (the mariadb driver can't speak mTLS to the proxy directly).
 *
 * Deliberately presence-gated on DB_RELAY_HOST rather than a separate
 * on/off flag: as long as these env vars are unset (true of every
 * environment today, including Production), this function returns
 * undefined and buildAdapter() below falls through to the exact
 * direct-RDS connection logic that was already in production before
 * Phase 3 — nothing changes until these are deliberately set.
 */
function relayConfigFromEnv(): MtlsRelayConfig | undefined {
  const proxyHost = process.env.DB_RELAY_HOST;
  if (!proxyHost) return undefined;

  const proxyPortRaw = process.env.DB_RELAY_PORT;
  const clientCert = process.env.DB_RELAY_CLIENT_CERT;
  const clientKey = process.env.DB_RELAY_CLIENT_KEY;
  const caCert = process.env.DB_RELAY_CA_CERT;

  const missing = [
    !proxyPortRaw && "DB_RELAY_PORT",
    !clientCert && "DB_RELAY_CLIENT_CERT",
    !clientKey && "DB_RELAY_CLIENT_KEY",
    !caCert && "DB_RELAY_CA_CERT",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `lib/db/prisma.ts: DB_RELAY_HOST is set but missing required env var(s): ${missing.join(", ")}`,
    );
  }

  const proxyPort = Number(proxyPortRaw);
  if (!Number.isInteger(proxyPort) || proxyPort <= 0) {
    throw new Error(`lib/db/prisma.ts: DB_RELAY_PORT is not a valid port number: "${proxyPortRaw}"`);
  }

  return {
    proxyHost,
    proxyPort,
    // Env vars often can't carry literal newlines cleanly (Vercel's UI and
    // some CLIs collapse them) — accept escaped "\n" as well as real ones.
    clientCert: normalizePem(clientCert!),
    clientKey: normalizePem(clientKey!),
    caCert: normalizePem(caCert!),
  };
}

function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

async function buildAdapter(): Promise<PrismaMariaDb> {
  const dbConfig = adapterConfigFromDatabaseUrl(process.env.DATABASE_URL ?? "");
  const relayConfig = relayConfigFromEnv();

  if (relayConfig) {
    // Route through the local mTLS relay instead of connecting to RDS
    // directly. The relay's outgoing leg to the EC2 proxy is already real
    // mTLS; past that, stunnel forwards to RDS in plaintext over the
    // private VPC (the approved Phase 3 architecture — a MySQL-protocol-
    // aware TLS bridge would be needed to encrypt that hop too, since
    // stunnel can't perform MySQL's protocol-embedded TLS upgrade, and
    // that's deliberately out of scope). So this driver never negotiates
    // MySQL-protocol TLS itself in relay mode — same as local dev, it
    // authenticates via RSA public-key retrieval instead.
    const relay = await ensureRelayListening(relayConfig);
    return new PrismaMariaDb({
      ...dbConfig,
      host: relay.host,
      port: relay.port,
      ...(connectionLimit ? { connectionLimit } : {}),
      allowPublicKeyRetrieval: true,
    });
  }

  return new PrismaMariaDb({
    ...dbConfig,
    ...(connectionLimit ? { connectionLimit } : {}),
    ...(sslEnabled ? { ssl: { ca: loadRdsCaBundle(), rejectUnauthorized: true } } : { allowPublicKeyRetrieval: true }),
  });
}

function createPrismaClient(): Promise<PrismaClient> {
  return buildAdapter().then((adapter) => new PrismaClient({ adapter }));
}

// The relay (when active) is started asynchronously, so the client can no
// longer be constructed eagerly at module load — its host/port depend on
// the relay actually being bound first. getPrisma() is the lazy async
// singleton every call site awaits instead.
//
// Reuses a single in-flight/resolved client across hot reloads in
// development (via globalThis) so `next dev` doesn't exhaust the database
// connection pool by creating a new client per reload. In production
// (including each Vercel serverless cold start), a fresh module-scope
// promise is used instead — no hot reloads happen there, and each cold
// start naturally gets its own client the same way it always has.
let prodPrismaPromise: Promise<PrismaClient> | undefined;

export function getPrisma(): Promise<PrismaClient> {
  if (process.env.NODE_ENV !== "production") {
    if (!globalThis.__prismaPromise) {
      globalThis.__prismaPromise = createPrismaClient();
    }
    return globalThis.__prismaPromise;
  }

  if (!prodPrismaPromise) {
    prodPrismaPromise = createPrismaClient();
  }
  return prodPrismaPromise;
}
