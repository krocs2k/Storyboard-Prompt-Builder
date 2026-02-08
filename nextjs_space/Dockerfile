# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for Prisma and native modules
RUN apk add --no-cache libc6-compat openssl wget

# Copy package files
COPY package.json ./

# Install dependencies
RUN yarn install --frozen-lockfile || yarn install

# Copy source code
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Set standalone output mode and build
ENV NEXT_OUTPUT_MODE=standalone
ENV NEXT_TELEMETRY_DISABLED=1

RUN yarn build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat openssl wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
