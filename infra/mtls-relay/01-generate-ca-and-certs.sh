#!/usr/bin/env bash
# Phase 2 — Step 1: Generate the private CA, the EC2 proxy's server cert,
# and the Vercel client cert.
#
# WHERE TO RUN THIS:
#   Run it somewhere OTHER than the public EC2 box if you can — e.g. your
#   own laptop (Git Bash / WSL / macOS / Linux all have openssl) — so the
#   CA private key never has to touch the internet-facing instance. If
#   that's not practical, running it on the EC2 instance via Instance
#   Connect is acceptable, but then move ca.key off the box afterward
#   (e.g. `scp` it to your laptop, then `shred -u ca.key` on the instance).
#
# The CA key (ca.key) is the most sensitive file this project will ever
# produce: anyone holding it can mint a certificate that talks to your
# database. NEVER commit it, NEVER upload it anywhere other than the one
# offline location you choose to keep it.
#
# Output goes to ./certs/ (already gitignored — see /infra/mtls-relay/certs/
# in .gitignore). Run this script from the infra/mtls-relay directory.

set -euo pipefail

PROXY_IP="13.63.60.102"
OUT="$(dirname "$0")/certs"
mkdir -p "$OUT"
cd "$OUT"

DAYS_CA=3650
DAYS_LEAF=825   # keep leaf certs well under the 825-day CA/Browser Forum cap

echo "== 1. Private CA =="
if [[ -f ca.key ]]; then
  echo "ca.key already exists — reusing existing CA (delete certs/ manually to regenerate)"
else
  openssl genrsa -out ca.key 4096
  openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" \
    -subj "/C=ZA/O=KwaNomzi Lodge/CN=KwaNomzi DB Relay CA" \
    -out ca.crt
fi

echo "== 2. EC2 proxy server certificate (CN/SAN = $PROXY_IP) =="
openssl genrsa -out server.key 2048
openssl req -new -key server.key \
  -subj "/C=ZA/O=KwaNomzi Lodge/CN=$PROXY_IP" \
  -out server.csr

cat > server.ext <<EOF
subjectAltName = IP:$PROXY_IP
extendedKeyUsage = serverAuth
EOF

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$DAYS_LEAF" -sha256 -extfile server.ext

echo "== 3. Vercel client certificate =="
openssl genrsa -out client.key 2048
openssl req -new -key client.key \
  -subj "/C=ZA/O=KwaNomzi Lodge/CN=vercel-app-client" \
  -out client.csr

cat > client.ext <<EOF
extendedKeyUsage = clientAuth
EOF

openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days "$DAYS_LEAF" -sha256 -extfile client.ext

rm -f server.csr client.csr server.ext client.ext

echo
echo "Done. Files in $OUT:"
ls -la
echo
echo "Next:"
echo "  - Copy ca.crt + server.crt + server.key to the EC2 proxy (see 02-install-stunnel.sh)."
echo "  - Keep ca.key OFFLINE. Do not put it on the EC2 instance long-term or in the repo."
echo "  - client.crt + client.key + ca.crt are what the Next.js app will eventually need"
echo "    as Vercel env vars/secrets in Phase 3 — do not wire them up yet."
