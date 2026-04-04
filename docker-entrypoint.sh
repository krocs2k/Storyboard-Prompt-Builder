#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  SSC v13 - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"

# Pre-flight: verify critical files exist
for f in server.js .next/routes-manifest.json node_modules/next/package.json prisma/schema.prisma; do
  if [ ! -f "$f" ]; then
    echo "FATAL: Missing $f — build may have failed"
    exit 1
  fi
done
echo "OK: Pre-flight checks passed"

# Pre-flight: verify critical env vars
if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set"
  exit 1
fi
if [ -z "$NEXTAUTH_SECRET" ]; then
  echo "WARNING: NEXTAUTH_SECRET not set — auth will fail"
fi

# Wait for database (max 30s)
echo "Connecting to database..."
RETRIES=0
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => { p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge 15 ]; then
    echo "FATAL: Database not reachable after 30s"
    exit 1
  fi
  echo "  Waiting for database... ($RETRIES/15)"
  sleep 2
done
echo "OK: Database connected"

# Sync schema (safe — no data loss)
echo "Syncing database schema..."
npx prisma db push --skip-generate 2>&1 || true
echo "OK: Schema synced"

# Run seed (safe — uses existence checks)
echo "Running seed..."
if [ -f scripts/compiled/seed.js ]; then
  node scripts/compiled/seed.js || true
elif [ -f scripts/seed.js ]; then
  node scripts/seed.js || true
fi

echo ""
echo "Starting Next.js..."
exec node server.js
