#!/usr/bin/env bash
# Generate production secrets for .env
set -euo pipefail

echo "# Paste into your .env file:"
echo
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
echo "DEFAULT_ADMIN_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
