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

const adapter = new PrismaMariaDb({
  ...adapterConfigFromDatabaseUrl(process.env.DATABASE_URL ?? ""),
  ...(connectionLimit ? { connectionLimit } : {}),
});

// Reuses a single PrismaClient across hot reloads in development so `next dev`
// doesn't exhaust the database connection pool by creating a new client per reload.
export const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
