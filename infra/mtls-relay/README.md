# Phase 2 — mTLS relay (EC2 proxy → RDS)

Scripts to run yourself (this environment has no AWS CLI/SSH access to your
account, so nothing here executes automatically). Run in order:

1. **`01-generate-ca-and-certs.sh`** — run locally (recommended) or on the
   EC2 box. Produces `certs/ca.{key,crt}`, `certs/server.{key,crt}`,
   `certs/client.{key,crt}`. `certs/` is gitignored — never commit it.
2. Copy `ca.crt`, `server.crt`, `server.key` to the EC2 instance
   (`13.63.60.102`, `i-03ed3c733f414b462`).
3. **`02-install-stunnel.sh`** — run on the EC2 instance as root (via
   Instance Connect). Installs stunnel, places the certs at
   `/etc/stunnel/certs/`, installs `stunnel.conf`, starts the service on
   `:8443` with mandatory client-cert verification (`verify = 2`).
4. **`03-test-checklist.md`** — the 7 required Phase 2 tests, with exact
   commands, run from your own machine against the public endpoint.

## Where each secret lives

| Item | Location | Notes |
|---|---|---|
| `ca.key` (CA private key) | Wherever you ran script 1 — keep offline | **Never** copy to EC2 long-term, never commit, never share |
| `ca.crt` | EC2 `/etc/stunnel/certs/ca.crt` + your test machine | Public, safe to distribute |
| `server.key` | EC2 `/etc/stunnel/certs/server.key` only | Proxy's private key |
| `server.crt` | EC2 `/etc/stunnel/certs/server.crt` | Public |
| `client.key` / `client.crt` | Your test machine now; **Vercel env vars in Phase 3** | This is what the Next.js app will present to authenticate — do not wire into Vercel yet per the Phase 2 stop point |

## What the application will eventually need (Phase 3, not yet)

- `DATABASE_URL` pointed at `13.63.60.102:8443` instead of the RDS endpoint directly (exact driver/connection approach TBD in Phase 3 — MySQL wire protocol over a raw TLS tunnel needs either a TLS-terminating local step or a driver that supports it)
- Client cert/key/CA as Vercel secrets (e.g. `DB_RELAY_CLIENT_CERT`, `DB_RELAY_CLIENT_KEY`, `DB_RELAY_CA_CERT`), base64 or multiline env vars
- No changes to `DATABASE_URL`, Prisma config, or any other production env var are made by these scripts — that's explicitly deferred to Phase 3 per the stop point.

## Do not do yet (per Phase 2 stop point)

- Change Vercel `DATABASE_URL` or any other production env var
- Change Prisma production configuration
- Make RDS private / remove the existing public RDS rule
- Configure Yoco or Resend
- Modify booking logic
