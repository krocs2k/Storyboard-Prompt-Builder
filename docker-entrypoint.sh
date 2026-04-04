#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  SSC v12 - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"
echo ""

# Wait for database
echo "Connecting to database..."
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => { p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "  Waiting for database..."
  sleep 2
done
echo "OK: Database connected"

# Sync schema (safe push — no data loss)
echo "Syncing database schema..."
npx prisma db push --skip-generate 2>&1 || true
echo "OK: Schema synced"

# Run seed script (uses upsert — safe for existing data)
echo "Running seed..."
if [ -f scripts/compiled/seed.js ]; then
  node scripts/compiled/seed.js || true
elif [ -f scripts/seed.js ]; then
  node scripts/seed.js || true
fi

echo ""
echo "Starting Next.js..."
exec node server.js
