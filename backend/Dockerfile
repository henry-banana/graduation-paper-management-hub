# ==============================================================================
# OPTIMIZED DOCKERFILE FOR NESTJS BACKEND
# Build time improvements:
# - Multi-stage caching tối ưu
# - Sử dụng .dockerignore để giảm context size
# - npm ci thay vì npm install (faster, deterministic)
# - Tách riêng dependencies install và build steps
# - Loại bỏ devDependencies trong production
# ==============================================================================

# ------------------------------------
# Stage 1: Dependencies (cached layer)
# ------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files only (tận dụng Docker layer caching)
COPY package.json package-lock.json ./

# Install ALL dependencies (bao gồm devDependencies để build)
# npm ci: faster, requires package-lock.json, deterministic
RUN npm ci --prefer-offline --no-audit

# ------------------------------------
# Stage 2: Builder
# ------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies từ stage trước
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build application
# NestJS compilation output → dist/
RUN npm run build

# Prune devDependencies (giảm image size)
RUN npm prune --production

# ------------------------------------
# Stage 3: Production runner (minimal)
# ------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Security: Tạo non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nestjs -u 1001

# Copy ONLY production node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy resources nếu cần (fonts, templates, etc.)
COPY --from=builder --chown=nestjs:nodejs /app/resources ./resources

# Copy package.json để runtime có thể đọc metadata
COPY --chown=nestjs:nodejs package.json ./

USER nestjs

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/v1/health || exit 1

# Start application
CMD ["sh", "-c", "if [ -f /app/dist/main.js ]; then exec node /app/dist/main.js; elif [ -f /app/dist/src/main.js ]; then exec node /app/dist/src/main.js; else echo 'ERROR: Cannot find NestJS entrypoint in /app/dist'; ls -la /app/dist || true; exit 1; fi"]
