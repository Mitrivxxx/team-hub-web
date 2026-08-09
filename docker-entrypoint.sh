#!/bin/sh
set -e

CERT_DIR=/etc/nginx/certs
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

/generate-certs.sh "$CERT_DIR"

if ! openssl x509 -in "$CERT_FILE" -noout >/dev/null 2>&1; then
  echo "Invalid TLS certificate at $CERT_FILE, regenerating..."
  rm -f "$CERT_FILE" "$KEY_FILE"
  /generate-certs.sh "$CERT_DIR"
fi

chmod 644 "$CERT_FILE" "$KEY_FILE" 2>/dev/null || true

if ! openssl x509 -in "$CERT_FILE" -noout -issuer 2>/dev/null | grep -qi mkcert; then
  echo "Using self-signed TLS certs. For a trusted browser certificate run on the host:"
  echo "  ./scripts/setup-certs.sh"
  echo "Then restart: docker compose up --build gw-nginx ui-web"
fi

nginx -t
exec nginx -g 'daemon off;'
