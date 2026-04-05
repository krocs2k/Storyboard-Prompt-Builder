# ==============================================================================
# Storyshot Creator — Docker Build v13
# No dependencies on Abacus.AI platform
# Uses server.js spawn wrapper + next start (no standalone mode)
# Uses Debian slim (glibc) for native SWC support
#
# IMPORTANT: The GitHub backup (lib/github.ts → applyGitHubReadiness) transforms
# all platform-specific files BEFORE they reach this repo:
#   - prisma/schema.prisma  → generic output path + Docker binary targets
#   - package.json          → @next/swc-wasm-nodejs removed
#   - .yarnrc.yml           → Abacus cache paths stripped
#   - next.config.js        → experimental/distDir removed
#   - layout.tsx            → Abacus chatllm script removed
#   - scripts/seed.ts       → test credentials → env-var placeholders
#
# This Dockerfile assumes a CLEAN repo — no re-patching needed.
# ==============================================================================

FROM node:20-slim AS base

# ---------- Stage 1: Install dependencies ----------
FROM base AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl wget python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY package.json ./
COPY yarn.loc[k] yarn.lock.ba[k] ./

# yarn.lock.bak is the canonical lock file from the backup
RUN if [ -f yarn.lock.bak ] && [ ! -s yarn.lock ]; then \
      cp yarn.lock.bak yarn.lock; \
    fi

RUN if [ -s yarn.lock ]; then \
      yarn install --frozen-lockfile --network-timeout 120000 || yarn install --network-timeout 120000; \
    else \
      yarn install --network-timeout 120000; \
    fi

# ---------- Stage 2: Build the application ----------
FROM base AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY --from=deps /build/node_modules ./node_modules
COPY --from=deps /build/package.json ./
COPY --from=deps /build/yarn.lock ./

COPY . .

# Resolve any leftover dev symlinks
RUN if [ -L yarn.lock ]; then rm -f yarn.lock; fi; \
    if [ -f yarn.lock.bak ] && [ ! -s yarn.lock ]; then cp yarn.lock.bak yarn.lock; fi

# Use Docker-specific next.config (no standalone, no experimental)
RUN cp next.config.docker.js next.config.js

# Verify Prisma schema exists (already transformed by backup)
RUN test -f prisma/schema.prisma || (echo "ERROR: prisma/schema.prisma not found" && exit 1)

RUN npx prisma generate

# Compile seed script to JS (no tsx at runtime)
RUN mkdir -p scripts/compiled && \
    npx esbuild scripts/seed.ts --bundle --platform=node \
      --outfile=scripts/compiled/seed.js \
      --external:@prisma/client --external:bcryptjs 2>/dev/null || \
    echo "[Docker] WARNING: Seed compilation skipped"

RUN rm -rf .next

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_MODE=""

RUN yarn build

# ---------- Stage 3: Production runner ----------
FROM base AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl wget bash ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR=/srv/app/data

COPY --from=builder --chown=nextjs:nodejs /build/package.json ./
COPY --from=builder --chown=nextjs:nodejs /build/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /build/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /build/public ./public
COPY --from=builder --chown=nextjs:nodejs /build/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /build/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /build/server.js ./server.js

RUN mkdir -p /srv/app/data/images /srv/app/data/category-images && chown -R nextjs:nodejs /srv/app

ENV PATH="/srv/app/node_modules/.bin:$PATH"

COPY --from=builder --chown=nextjs:nodejs /build/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /srv/app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/srv/app/docker-entrypoint.sh"]
