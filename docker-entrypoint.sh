#!/bin/sh
set -e

/generate-certs.sh /etc/nginx/certs

if ! openssl x509 -in /etc/nginx/certs/localhost.pem -noout -issuer 2>/dev/null | grep -qi mkcert; then
  echo "Using self-signed TLS certs. For a trusted browser certificate run on the host:"
  echo "  ./scripts/setup-certs.sh"
  echo "Then restart: docker compose up --build web gateway"
fi

exec nginx -g 'daemon off;'
