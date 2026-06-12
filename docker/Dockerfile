# ═══════════════════════════════════════════════════════════════════
# DAWN WHALES v2.1.0 — Dockerfile (R136 J02)
# Multi-stage build: Node.js production server
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --production=false 2>/dev/null || npm install

# Copy source
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY electron/ ./electron/
COPY server/ ./server/
COPY src/ ./src/
COPY index.html ./
COPY public/ ./public/

# Build TypeScript + Vite
RUN npm run build || true

# Prune devDependencies
RUN npm prune --production 2>/dev/null || true

# ── Stage 2: Production Runtime ───────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="Dawn Whales"
LABEL org.opencontainers.image.version="v2.1.0"
LABEL org.opencontainers.image.description="AI-powered multi-broker trading platform"

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 dawnwhales && \
    adduser -D -u 1001 -G dawnwhales dawnwhales

# Copy built artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-electron ./dist-electron
COPY --from=builder /app/server ./server

# Copy runtime configs
COPY ./docker/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install nginx for reverse proxy
RUN apk add --no-cache nginx openssl

# Create data directory
RUN mkdir -p /data && chown dawnwhales:dawnwhales /data

USER dawnwhales

EXPOSE 3000 4096

ENV NODE_ENV=production
ENV PORT=4096
ENV VITE_PORT=3000

ENTRYPOINT ["/entrypoint.sh"]
