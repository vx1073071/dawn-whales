#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# TradingEasy v2.1.0 — Docker Entrypoint
# ═══════════════════════════════════════════════════════════════════

set -e

echo "=== TradingEasy v2.1.0 Starting ==="
echo "NODE_ENV=${NODE_ENV:-production}"
echo "PORT=${PORT:-4096}"
echo ""

# Start nginx (frontend + reverse proxy)
echo "[1/3] Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Wait for nginx to be ready
sleep 2

# Start Express API server
echo "[2/3] Starting API server on port ${PORT:-4096}..."
node server/index.js &
SERVER_PID=$!

# Start WebSocket push service
echo "[3/3] WebSocket push service ready via /ws endpoint"

# Trap signals for graceful shutdown
trap 'echo "Shutting down..."; kill $SERVER_PID $NGINX_PID 2>/dev/null; exit 0' SIGTERM SIGINT

echo ""
echo "=== TradingEasy v2.1.0 Ready ==="
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:${PORT:-4096}/api"
echo "Health:   http://localhost:${PORT:-4096}/api/health"
echo ""

# Wait for any process to exit
wait -n
