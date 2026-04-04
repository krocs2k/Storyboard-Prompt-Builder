# ==============================================================================
# Storyshot Creator — Self-Contained Docker Build
# No dependencies on Abacus.AI platform
# ==============================================================================

# ---------- Stage 1: Install dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

# Install OS-level build tools needed by native modules (sharp, bcrypt, prisma)
RUN apk add --no-cache libc6-compat openssl python3 make g++

# Copy package manifest and any available lock file
# Priority: yarn.lock.bak (platform-resolved) > yarn.lock (repo) > fresh install
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
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/yarn.lock ./

# Copy full source
COPY . .

# Ensure yarn.lock is a real file (not a symlink to Abacus.AI platform paths)
RUN if [ -L yarn.lock ]; then rm -f yarn.lock; fi; \
    if [ -f yarn.lock.bak ] && [ ! -s yarn.lock ]; then cp yarn.lock.bak yarn.lock; fi

# Patch Prisma schema: remove Abacus-specific hardcoded output path,
# ensure Docker-compatible binary targets
# (inlined to avoid dependency on external script being in build context)
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
# Using esbuild (bundled with tsx) for a single self-contained JS file
RUN npx esbuild scripts/seed.ts --bundle --platform=node --outfile=scripts/compiled/seed.js \
      --external:@prisma/client --external:bcryptjs 2>/dev/null || \
    npx tsc scripts/seed.ts --outDir scripts/compiled \
      --esModuleInterop --module commonjs --target es2020 \
      --resolveJsonModule --skipLibCheck 2>/dev/null || true

# Build Next.js with standalone output
ENV NEXT_OUTPUT_MODE=standalone
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DIST_DIR=.next

RUN yarn build

# ---------- Stage 3: Production runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime dependencies only
RUN apk add --no-cache libc6-compat openssl wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR=/app/data

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + client for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy seed script (compiled JS version if available, otherwise TS source)
COPY --from=builder /app/scripts ./scripts

# Copy bcryptjs for seed script (needed at runtime for password hashing)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy entrypoint
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Create data directory for storyboard images (mount as Docker volume)
RUN mkdir -p /app/data/images && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
