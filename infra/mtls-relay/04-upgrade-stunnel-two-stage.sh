#!/usr/bin/env bash
# Phase 3 — upgrade the EC2 proxy from single-stage (Phase 2) to two-stage
# stunnel: mTLS in from Vercel, real TLS out to RDS.
#
# RUN ON EC2 (i-03ed3c733f414b462) AS ROOT, after copying these two files to
# /tmp/ first:
#   /tmp/stunnel-two-stage.conf   (from infra/mtls-relay/stunnel-two-stage.conf)
#   /tmp/rds-eu-north-1-bundle.pem (from certs/rds-eu-north-1-bundle.pem)
#
# Safe by construction: backs up the working Phase 2 config first, and
# automatically rolls back to it if the new config fails to bring stunnel
# up cleanly.

set -uo pipefail  # deliberately not -e: we need to handle failures ourselves to roll back

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash 04-upgrade-stunnel-two-stage.sh" >&2
  exit 1
fi

BACKUP="/etc/stunnel/stunnel.conf.phase2.bak.$(date +%Y%m%d%H%M%S)"

echo "== 1. Preconditions =="
for f in /tmp/stunnel-two-stage.conf /tmp/rds-eu-north-1-bundle.pem; do
  if [[ ! -f "$f" ]]; then
    echo "Missing $f — copy it up before running this script." >&2
    exit 1
  fi
done

echo "== 2. Backing up current (Phase 2) config =="
cp /etc/stunnel/stunnel.conf "$BACKUP"
echo "Backed up to $BACKUP"

echo "== 3. Installing RDS CA bundle =="
cp /tmp/rds-eu-north-1-bundle.pem /etc/stunnel/certs/rds-eu-north-1-bundle.pem
chown root:root /etc/stunnel/certs/rds-eu-north-1-bundle.pem
chmod 644 /etc/stunnel/certs/rds-eu-north-1-bundle.pem
sed -i 's/\r$//' /etc/stunnel/certs/rds-eu-north-1-bundle.pem

echo "== 4. Independently verifying RDS accepts TLS with this bundle (before touching stunnel) =="
if ! echo | timeout 8 openssl s_client -connect 172.31.29.62:3306 -starttls mysql \
      -CAfile /etc/stunnel/certs/rds-eu-north-1-bundle.pem \
      -verify_hostname kwanomzi-production.c5aggco0gclx.eu-north-1.rds.amazonaws.com \
      2>&1 | grep -q "Verify return code: 0"; then
  echo "FAILED: could not establish a verified TLS connection to RDS directly from EC2." >&2
  echo "Not touching the running stunnel config. Aborting." >&2
  exit 1
fi
echo "OK — RDS accepts TLS, cert+hostname verified independently of stunnel."

echo "== 5. Installing new two-stage config =="
cp /tmp/stunnel-two-stage.conf /etc/stunnel/stunnel.conf
sed -i 's/\r$//' /etc/stunnel/stunnel.conf

echo "== 6. Restarting stunnel with the new config =="
systemctl restart stunnel
sleep 2

if ! systemctl is-active --quiet stunnel; then
  echo "FAILED: stunnel did not come up with the new config. Rolling back." >&2
  cp "$BACKUP" /etc/stunnel/stunnel.conf
  systemctl restart stunnel
  sleep 1
  systemctl status stunnel --no-pager || true
  echo "Rolled back to Phase 2 config ($BACKUP). stunnel restarted with the old config." >&2
  exit 1
fi

echo "== 7. Confirming both listeners are up =="
if ! ss -tlnp | grep -q ':8443'; then
  echo "FAILED: :8443 listener missing after restart. Rolling back." >&2
  cp "$BACKUP" /etc/stunnel/stunnel.conf
  systemctl restart stunnel
  exit 1
fi
if ! ss -tlnp | grep -q '127.0.0.1:23306'; then
  echo "FAILED: internal :23306 handoff listener missing after restart. Rolling back." >&2
  cp "$BACKUP" /etc/stunnel/stunnel.conf
  systemctl restart stunnel
  exit 1
fi
echo "OK — both :8443 (external) and 127.0.0.1:23306 (internal handoff) are listening."

echo
echo "== DONE =="
echo "Two-stage stunnel is live. Backup of the Phase 2 config is at: $BACKUP"
echo "If anything looks wrong, roll back manually with:"
echo "  sudo cp $BACKUP /etc/stunnel/stunnel.conf && sudo systemctl restart stunnel"
echo
echo "Next: from an external client, connect with mTLS to 13.63.60.102:8443 and"
echo "confirm you still see the MySQL/MariaDB greeting through the full chain,"
echo "then check 'sudo journalctl -u stunnel -n 30' for the [kwanomzi-db-relay-out]"
echo "block's own successful TLS handshake log lines to RDS."
