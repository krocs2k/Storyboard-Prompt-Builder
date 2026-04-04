#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  SSC v11 - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
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

# Sync schema
echo "Syncing database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 || \
  npx prisma db push --skip-generate 2>&1 || true
echo "OK: Schema synced"

# Seed if needed
NEEDS_SEED=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(c => { console.log(c === 0 ? 'true' : 'false'); p.\$disconnect(); }).catch(() => { console.log('true'); p.\$disconnect(); });
" 2>/dev/null || echo "true")

if [ "$NEEDS_SEED" = "true" ]; then
  echo "Seeding database..."
  if [ -f scripts/compiled/seed.js ]; then
    node scripts/compiled/seed.js
  elif [ -f scripts/seed.js ]; then
    node scripts/seed.js
  fi
else
  echo "Database has data, syncing..."
  if [ -f scripts/compiled/seed.js ]; then
    node scripts/compiled/seed.js || true
  elif [ -f scripts/seed.js ]; then
    node scripts/seed.js || true
  fi
fi

echo ""
echo "Starting Next.js..."
exec node server.js
