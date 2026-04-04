#!/bin/sh
set -e

echo "[Entrypoint] Starting Storyshot Creator..."

# Run Prisma migrations (push schema to database)
if [ -f prisma/schema.prisma ]; then
  echo "[Entrypoint] Running database migrations..."
  npx prisma db push --skip-generate 2>&1 || {
    echo "[Entrypoint] WARNING: Database migration failed. Retrying in 5 seconds..."
    sleep 5
    npx prisma db push --skip-generate 2>&1 || echo "[Entrypoint] ERROR: Database migration failed after retry."
  }
fi

# Run seed script if available (only creates missing records via upsert, safe to re-run)
if [ -f scripts/compiled/seed.js ]; then
  echo "[Entrypoint] Seeding database (compiled JS)..."
  node scripts/compiled/seed.js 2>&1 || echo "[Entrypoint] WARNING: Seed script failed (may already be seeded)."
elif [ -f scripts/seed.ts ]; then
  echo "[Entrypoint] Seeding database (TypeScript via npx tsx)..."
  npx tsx scripts/seed.ts 2>&1 || echo "[Entrypoint] WARNING: Seed script failed (may already be seeded)."
fi

echo "[Entrypoint] Starting Next.js server..."
exec node server.js
