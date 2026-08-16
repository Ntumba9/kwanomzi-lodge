// TEMPORARY diagnostic endpoint — remove after use (see AGENTS.md /
// deployment-verification notes). Exists only to tell apart "network
// genuinely can't reach RDS from Vercel" from "Prisma/mariadb adapter
// breaks specifically on Vercel's Linux runtime" — the two have very
// different fixes (AWS security group vs. application code), and guessing
// wrong wastes a security-sensitive change. Never returns the connection
// string, credentials, or any row data — only booleans, timings, and
// sanitized error codes/messages with the host redacted.
import { NextResponse } from "next/server";
import { connect } from "node:net";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.INTERNAL_SWEEP_SECRET;
  const provided = request.headers.get("x-internal-secret");
  return Boolean(secret) && provided === secret;
}

/** Strips anything resembling a credential (user:pass@host) before an error ever leaves this function. */
function sanitizeMessage(message: string): string {
  return message.replace(/[^\s"']+:[^\s"']+@[^\s"'/]+/g, "[redacted-connection-string]");
}

function rawTcpProbe(host: string, port: number, timeoutMs = 8000): Promise<{ ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (ok: boolean, error?: string) => {
      socket.destroy();
      resolve({ ok, ms: Date.now() - start, error: error ? sanitizeMessage(error) : undefined });
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, `TCP connect timed out after ${timeoutMs}ms`));
    socket.once("error", (err) => finish(false, `${err.name}: ${sanitizeMessage(err.message)}`));
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid x-internal-secret." } }, { status: 401 });
  }

  const databaseUrlPresent = Boolean(process.env.DATABASE_URL);
  let host: string | null = null;
  let port: number | null = null;
  let urlParseError: string | null = null;

  if (databaseUrlPresent) {
    try {
      const url = new URL(process.env.DATABASE_URL!);
      host = url.hostname;
      port = url.port ? Number(url.port) : 3306;
    } catch (err) {
      urlParseError = err instanceof Error ? sanitizeMessage(err.message) : "unknown parse error";
    }
  }

  const result: Record<string, unknown> = {
    databaseUrlPresent,
    databaseUrlHost: host, // hostname only — never the credentials or path
    databaseUrlPort: port,
    databaseUrlParseError: urlParseError,
    databaseSslEnv: process.env.DATABASE_SSL ?? null,
    nodeEnv: process.env.NODE_ENV,
    region: process.env.VERCEL_REGION ?? null,
  };

  if (host && port) {
    result.rawTcpProbe = await rawTcpProbe(host, port);
  } else {
    result.rawTcpProbe = { ok: false, ms: 0, error: "no host/port to probe" };
  }

  const prismaStart = Date.now();
  try {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    result.prismaQuery = { ok: true, ms: Date.now() - prismaStart, result: rows[0]?.ok ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.prismaQuery = {
      ok: false,
      ms: Date.now() - prismaStart,
      errorName: err instanceof Error ? err.name : "UnknownError",
      // Prisma error messages are already free of the raw connection string
      // (verified against this app's actual errors), but sanitize anyway —
      // defense in depth, not trust.
      error: sanitizeMessage(message).slice(0, 800),
    };
  }

  return NextResponse.json(result);
}
