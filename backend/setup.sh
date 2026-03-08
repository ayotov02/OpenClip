#!/bin/bash
set -e

DOMAIN="openclip.local"
CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/certs"

echo "=== OpenClip Local Development Setup ==="
echo

# 1. /etc/hosts entry
if grep -q "$DOMAIN" /etc/hosts; then
    echo "[OK] /etc/hosts already has $DOMAIN"
else
    echo "[+] Adding $DOMAIN to /etc/hosts (requires sudo)..."
    echo "127.0.0.1 $DOMAIN" | sudo tee -a /etc/hosts > /dev/null
    echo "[OK] Added $DOMAIN to /etc/hosts"
fi

# 2. mkcert
if ! command -v mkcert &> /dev/null; then
    echo "[!] mkcert not found. Install it first:"
    echo "    macOS:  brew install mkcert"
    echo "    Linux:  https://github.com/FiloSottile/mkcert#installation"
    exit 1
fi

# 3. Install local CA if not already done
echo "[+] Installing mkcert local CA (if needed)..."
mkcert -install

# 4. Generate certs
mkdir -p "$CERTS_DIR"
if [ -f "$CERTS_DIR/$DOMAIN.pem" ] && [ -f "$CERTS_DIR/$DOMAIN-key.pem" ]; then
    echo "[OK] Certs already exist in $CERTS_DIR"
else
    echo "[+] Generating TLS certificates for $DOMAIN..."
    mkcert -cert-file "$CERTS_DIR/$DOMAIN.pem" -key-file "$CERTS_DIR/$DOMAIN-key.pem" "$DOMAIN"
    echo "[OK] Certs generated in $CERTS_DIR"
fi

# 5. Copy .env if needed
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "[+] Copying .env.example to .env..."
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo "[OK] Created .env — edit it to customize settings"
else
    echo "[OK] .env already exists"
fi

echo
echo "=== Setup Complete ==="
echo
echo "Next steps:"
echo "  1. Edit .env if needed"
echo "  2. docker compose up -d"
echo "  3. docker compose exec ollama ollama pull qwen3:32b"
echo "  4. Open https://$DOMAIN"
echo
