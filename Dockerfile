# ==============================================================================
# Storyshot Creator — Docker Build v11
# No dependencies on Abacus.AI platform
# Uses server.js spawn wrapper + next start (no standalone mode)
# ==============================================================================

FROM node:20-alpine AS base

# ---------- Stage 1: Install dependencies ----------
FROM base AS deps

RUN apk add --no-cache libc6-compat wget openssl python3 make g++

WORKDIR /build

# Copy package manifest and any available lock file
COPY package.json ./
COPY yarn.loc[k] yarn.lock.ba[k] ./

# Rename yarn.lock.bak → yarn.lock if it exists and yarn.lock is missing/empty
RUN if [ -f yarn.lock.bak ] && [ ! -s yarn.lock ]; then \
      cp yarn.lock.bak yarn.lock; \
    fi

# Install dependencies (--frozen-lockfile if lock exists, otherwise fresh install)
RUN if [ -s yarn.lock ]; then \
      yarn install --frozen-lockfile --network-timeout 120000; \
    else \
      yarn install --network-timeout 120000; \
    fi

# ---------- Stage 2: Build the application ----------
FROM base AS builder

RUN apk add --no-cache libc6-compat wget openssl

WORKDIR /build

# Copy dependencies from deps stage
COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/package.json ./
COPY --from=deps /build/yarn.lock ./

# Copy full source
COPY . .

# Ensure yarn.lock is a real file (not a symlink to Abacus.AI platform paths)
RUN if [ -L yarn.lock ]; then rm -f yarn.lock; fi; \
    if [ -f yarn.lock.bak ] && [ ! -s yarn.lock ]; then cp yarn.lock.bak yarn.lock; fi

# Use clean next.config.js for Docker (no standalone mode, no experimental options)
RUN cp next.config.docker.js next.config.js && \
    echo "=== next.config.js (v11) ===" && cat next.config.js

# Patch Prisma schema: remove Abacus-specific hardcoded output path,
# ensure Docker-compatible binary targets
RUN if [ -f prisma/schema.prisma ]; then \
      echo "[Docker Build] Patching Prisma schema for Docker environment..." && \
      sed -i '/output.*=.*"\/home\/ubuntu/d' prisma/schema.prisma && \
      if ! grep -q 'linux-musl-openssl-3.0.x' prisma/schema.prisma; then \
        sed -i 's/binaryTargets.*=.*/binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]/' prisma/schema.prisma; \
      fi && \
      echo "[Docker Build] Prisma schema patched successfully." && \
      head -5 prisma/schema.prisma; \
    else \
      echo "[Docker Build] ERROR: Prisma schema not found" && exit 1; \
    fi

# Generate Prisma client
RUN npx prisma generate

# Compile seed script to JS so it can run without tsx in production
RUN mkdir -p scripts/compiled && \
    (npx esbuild scripts/seed.ts --bundle --platform=node --outfile=scripts/compiled/seed.js \
      --external:@prisma/client --external:bcryptjs 2>/dev/null || \
    npx tsc scripts/seed.ts --outDir scripts/compiled \
      --esModuleInterop --module commonjs --target es2020 \
      --resolveJsonModule --skipLibCheck --types node 2>/dev/null || \
    echo "[Docker Build] WARNING: Seed script compilation failed")

# Clean previous build artifacts
RUN rm -rf .next

# Build Next.js WITHOUT standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_MODE=""

RUN yarn build

# Verify NO standalone was created
RUN ! test -d .next/standalone || (echo "Removing standalone" && rm -rf .next/standalone)

# ---------- Stage 3: Production runner ----------
FROM base AS runner

RUN apk add --no-cache libc6-compat openssl wget bash

WORKDIR /srv/app

# Runtime user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR=/srv/app/data

# Copy from builder - full node_modules (not standalone traced deps)
COPY --from=builder --chown=nextjs:nodejs /build/package.json ./
COPY --from=builder --chown=nextjs:nodejs /build/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /build/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /build/public ./public

# Copy Prisma schema + client for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /build/prisma ./prisma

# Copy seed script (compiled JS version)
COPY --from=builder --chown=nextjs:nodejs /build/scripts ./scripts

# Copy server.js that spawns next start (works with deployment platforms)
COPY --from=builder --chown=nextjs:nodejs /build/server.js ./server.js

# Create data directory for storyboard images (mount as Docker volume)
RUN mkdir -p /srv/app/data/images && chown -R nextjs:nodejs /srv/app

# Ensure Prisma CLI is in PATH
ENV PATH="/srv/app/node_modules/.bin:$PATH"

# Embedded startup script
RUN cat > /srv/app/start.sh << 'STARTSCRIPT'
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
p.\$connect().then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done
echo "OK: Database connected"

# Sync schema
npx prisma db push --skip-generate --accept-data-loss 2>&1 || \
  npx prisma db push --skip-generate 2>&1 || true
echo "OK: Schema synced"

# Seed if needed
NEEDS_SEED=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(c => console.log(c === 0 ? 'true' : 'false')).catch(() => console.log('true'));
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
STARTSCRIPT

RUN chmod +x /srv/app/start.sh

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["/srv/app/start.sh"]
