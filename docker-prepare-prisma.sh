#!/bin/sh
# This script patches the Prisma schema for Docker builds by:
# 1. Removing the hardcoded output path (Abacus.AI platform-specific)
# 2. Adding linux-musl binary target for Alpine Docker
set -e

SCHEMA="prisma/schema.prisma"

if [ -f "$SCHEMA" ]; then
  echo "[Docker Build] Patching Prisma schema for Docker environment..."
  
  # Remove the output line (Abacus.AI specific hardcoded path)
  sed -i '/output.*=.*"\/home\/ubuntu/d' "$SCHEMA"
  
  # Ensure linux-musl-openssl target exists (for Alpine Docker)
  if ! grep -q 'linux-musl-openssl-3.0.x' "$SCHEMA"; then
    sed -i 's/binaryTargets.*=.*/binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]/' "$SCHEMA"
  fi
  
  echo "[Docker Build] Prisma schema patched successfully."
  cat "$SCHEMA" | head -5
else
  echo "[Docker Build] ERROR: Prisma schema not found at $SCHEMA"
  exit 1
fi
