import { createServer, type Server, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";

/**
 * Loopback-only TCP-to-mTLS bridge for reaching RDS through the EC2 proxy
 * from Vercel's serverless environment.
 *
 * Why this exists: the `mariadb` driver (verified against its installed
 * source in node_modules/mariadb/lib/connection.js) only supports MySQL's
 * native protocol-embedded TLS upgrade (plaintext handshake first, then
 * upgrade the socket in place) — not a raw TLS socket from byte zero,
 * which is what the EC2 proxy's stunnel listener requires. So the driver
 * can't point directly at the mTLS relay endpoint. This module bridges
 * that gap: it runs a tiny loopback-only TCP server that the driver
 * connects to as if it were a plain local MySQL server, and for every
 * connection accepted, opens a real mTLS connection out to the EC2 relay
 * and pipes bytes bidirectionally — functionally equivalent to a local
 * `stunnel` client, implemented in plain Node core modules so nothing
 * needs to spawn an external binary (which Vercel Functions can't reliably
 * run as a persistent process).
 *
 * See infra/mtls-relay/ for how the EC2 side (stunnel, certs) is set up,
 * and lib/db/prisma.ts for how this is wired into the Prisma adapter.
 */

export interface MtlsRelayConfig {
  proxyHost: string;
  proxyPort: number;
  clientCert: string;
  clientKey: string;
  caCert: string;
  /** Milliseconds to wait for the outgoing mTLS handshake before giving up
   *  on that one connection. Defaults to 8000. A hung EC2/network path must
   *  not hang the caller (mariadb's own pool) indefinitely. */
  connectTimeoutMs?: number;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 8_000;

interface RelayHandle {
  server: Server;
  address: { host: string; port: number };
}

// Module-scope cache so a warm serverless invocation (or a long-lived local
// process) reuses the same listening relay instead of starting a new one
// per call — mirrors the globalThis.__prisma singleton pattern this module
// is used from in lib/db/prisma.ts.
let cachedRelay: Promise<RelayHandle> | undefined;

/**
 * Pipes a single accepted local connection through a fresh mTLS connection
 * to the relay. One local TCP connection = one outgoing mTLS connection —
 * this mirrors exactly how a local `stunnel` client would behave, and
 * lets the mariadb driver's own connection pool control concurrency same
 * as it would against a direct connection.
 */
function bridgeConnection(local: Socket, config: MtlsRelayConfig): void {
  local.pause(); // don't lose bytes the driver sends before the tunnel is up

  const connectTimeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  let handshakeComplete = false;

  // No `servername` (SNI) here: proxyHost is an IP address (the EC2
  // Elastic IP), and Node's tls module rejects setting SNI to a bare IP
  // (SNI is a DNS-name-only mechanism). The server cert's SAN is itself
  // IP-based (see infra/mtls-relay/01-generate-ca-and-certs.*), so
  // rejectUnauthorized's IP-SAN check still fully verifies identity
  // without SNI.
  const secure = tlsConnect(
    {
      host: config.proxyHost,
      port: config.proxyPort,
      cert: config.clientCert,
      key: config.clientKey,
      ca: config.caCert,
      rejectUnauthorized: true,
      timeout: connectTimeoutMs,
    },
    () => {
      handshakeComplete = true;
      local.pipe(secure);
      secure.pipe(local);
      local.resume();
    },
  );

  const cleanup = () => {
    local.destroy();
    secure.destroy();
  };

  // `timeout` on tls.connect applies to the whole socket's idle time, not
  // just the handshake — that's too aggressive for a long-lived query
  // connection. Use it only to bound the handshake itself, then disable it
  // once the tunnel is actually up.
  secure.once("secureConnect", () => secure.setTimeout(0));
  secure.on("timeout", () => {
    if (!handshakeComplete) cleanup();
  });

  secure.on("error", cleanup);
  local.on("error", cleanup);
  secure.on("close", () => local.destroy());
  local.on("close", () => secure.destroy());
}

/**
 * Starts (or reuses) the loopback relay server for the given config.
 * Config must be supplied explicitly by the caller (lib/db/prisma.ts reads
 * it from env vars) — this module has no opinion on env var names, so it
 * can be reused identically by production code and diagnostic scripts.
 */
export function ensureRelayListening(config: MtlsRelayConfig): Promise<{ host: string; port: number }> {
  if (cachedRelay) return cachedRelay.then((r) => r.address);

  cachedRelay = new Promise<RelayHandle>((resolve, reject) => {
    const server = createServer((local) => bridgeConnection(local, config));
    server.on("error", (err) => {
      cachedRelay = undefined;
      reject(err);
    });

    // Bind to loopback only (127.0.0.1, not 0.0.0.0) — this must never be
    // reachable from outside the process's own container/machine. Port 0
    // lets the OS assign a free ephemeral port, avoiding collisions.
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("mtlsRelay: unexpected server address after listen()"));
        return;
      }
      resolve({ server, address: { host: "127.0.0.1", port: addr.port } });
    });
  });

  return cachedRelay.then((r) => r.address);
}

/**
 * Closes the relay's listener, if one is running. Safe to call even if
 * nothing is listening. Not required on Vercel (frozen/killed containers
 * don't get a clean shutdown hook to call this from), but used by the CLI
 * diagnostic script and tests so a process can exit cleanly.
 */
export async function closeRelay(): Promise<void> {
  if (!cachedRelay) return;
  const { server } = await cachedRelay;
  cachedRelay = undefined;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

/** Test-only: forces the next ensureRelayListening() call to start fresh. */
export function _resetRelayForTests(): void {
  cachedRelay = undefined;
}
