import { NextResponse } from "next/server";
import { createPool } from "mariadb";
import { ensureRelayListening, type MtlsRelayConfig } from "@/lib/db/mtlsRelay";

/**
 * DIAGNOSTIC ONLY — proves lib/db/mtlsRelay.ts (the module Phase 3's real
 * Prisma integration uses) from an actual deployed Vercel environment, not
 * part of the production data path itself. Not linked from anywhere in the
 * app. Delete this whole app/api/diag/ directory (and
 * scripts/diag-mtls-relay.ts) once Phase 3 is either fully adopted for
 * production or abandoned — lib/db/mtlsRelay.ts itself stays either way.
 *
 * Guarded the same way app/api/internal/expire-holds is: a shared secret
 * header, since there's no admin session to check here. Deliberately a
 * SEPARATE secret (DIAG_ROUTE_SECRET) from INTERNAL_SWEEP_SECRET/CRON_SECRET
 * so this diagnostic surface can be disabled/rotated independently of the
 * real internal-sweep endpoint.
 *
 * Exists to let this exact mechanism be smoke-tested from an actual Vercel
 * Preview deployment (cold starts, concurrent invocations, real Lambda
 * lifecycle) — none of which a local script can fully prove. NOT deployed
 * automatically; deploying it is a separate, explicit step.
 */

function isAuthorized(request: Request): boolean {
  const secret = process.env.DIAG_ROUTE_SECRET;
  const provided = request.headers.get("x-diag-secret");
  return Boolean(secret) && provided === secret;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function diagRelayConfig(): MtlsRelayConfig {
  return {
    proxyHost: requireEnv("DIAG_DB_PROXY_HOST"),
    proxyPort: Number(requireEnv("DIAG_DB_PROXY_PORT")),
    clientCert: requireEnv("DIAG_DB_CLIENT_CERT").replace(/\\n/g, "\n"),
    clientKey: requireEnv("DIAG_DB_CLIENT_KEY").replace(/\\n/g, "\n"),
    caCert: requireEnv("DIAG_DB_PROXY_CA_CERT").replace(/\\n/g, "\n"),
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const relay = await ensureRelayListening(diagRelayConfig());

    const pool = createPool({
      host: relay.host,
      port: relay.port,
      user: process.env.DIAG_DB_USER,
      password: process.env.DIAG_DB_PASSWORD,
      database: process.env.DIAG_DB_NAME,
      allowPublicKeyRetrieval: true,
      connectionLimit: 5,
      connectTimeout: 8_000,
    });

    try {
      const conn = await pool.getConnection();
      let selectOneResult: number | bigint;
      let tableCount: number;
      try {
        const [selectOne] = (await conn.query("SELECT 1 AS ok")) as Array<{ ok: number | bigint }>;
        selectOneResult = selectOne!.ok;

        const tables = (await conn.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()",
        )) as Array<{ table_name: string }>;
        tableCount = tables.length;
      } finally {
        await conn.release();
      }

      return NextResponse.json({
        data: {
          ok: true,
          // mariadb returns numeric literals as BigInt by default — not
          // JSON-serializable as-is.
          selectOne: Number(selectOneResult),
          tableCount,
          relayPort: relay.port,
          elapsedMs: Date.now() - startedAt,
        },
      });
    } finally {
      await pool.end().catch(() => {});
    }
  } catch (err) {
    // Deliberately not including err's raw message in a public-ish response
    // shape beyond what's needed to diagnose — this endpoint is secret-
    // guarded but still shouldn't leak connection internals broadly.
    return NextResponse.json(
      { error: { code: "DIAG_RELAY_FAILED", message: err instanceof Error ? err.name : "unknown error" } },
      { status: 502 },
    );
  }
}
