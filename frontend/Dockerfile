# ==============================================================================
# OPTIMIZED DOCKERFILE FOR NEXT.JS FRONTEND
# Build time improvements:
# - Sử dụng Next.js standalone output (nhỏ hơn 80%)
# - npm ci cho deterministic builds
# - Tận dụng Docker layer caching tối đa
# - Loại bỏ toàn bộ devDependencies
# ==============================================================================

# ------------------------------------
# Stage 1: Dependencies
# ------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Install libc6-compat (required for some packages on Alpine)
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# ------------------------------------
# Stage 2: Builder
# ------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
# Output mode: standalone (tự động tree-shake dependencies)
RUN npm run build

# ------------------------------------
# Stage 3: Production runner
# ------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Leverage Next.js standalone output
# Chỉ copy những gì cần thiết (~80% nhỏ hơn)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/ || exit 1

# Start Next.js
CMD ["node", "server.js"]
