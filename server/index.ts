// ── DAWN WHALES Server ────────────────────────────────────────────────
// R129-131: all layers. R132: dead letter queue

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { registerApiRoutes } from '../electron/api-routes';
import { initDatabases } from './db/database';
import { registerAuthRoutes } from './middleware/jwt-auth';
import { auditMiddleware } from './middleware/audit-logger';
import { globalErrorHandler } from './middleware/error-handler';
import { config, validateConfig } from './config/env';
import signalRoutes from './routes/signal';
import walletRoutes from './routes/wallet';
import deadLetterRoutes from './middleware/dead-letter';

const app = express();
const PORT = config.port;

// ── R130: Audit logging ─────────────────────────────────────────────
app.use(auditMiddleware);

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ── R129: Init databases ─────────────────────────────────────────────
try {
  initDatabases();
  console.log('[Server] Databases initialized');
} catch (err) {
  console.error('[Server] Database init failed:', err);
  process.exit(1);
}

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '2.0.0',
  });
});

// AI Gateway status
app.get('/api/ai/status', (_req, res) => {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  res.json({
    gateway: deepseekKey ? 'direct' : process.env.AI_GATEWAY_URL ? 'proxy' : 'offline',
    providers: ['deepseek-v4-pro', 'deepseek-flash', 'minimax-abab'],
    hasApiKey: !!deepseekKey,
    timestamp: new Date().toISOString(),
  });
});

// ── R129: Auth routes ────────────────────────────────────────────────
registerAuthRoutes(app);

// ── R129: Signal routes ──────────────────────────────────────────────
app.use('/api/signal', signalRoutes);

// ── R141: Wallet + Ledger + Idempotency routes ─────────────────────────
app.use('/api/wallet', walletRoutes);

// ── R132: Dead letter queue ──────────────────────────────────────────
app.use('/api/dead-letter', deadLetterRoutes);

// ── Existing API routes (AI chat, report, billing, wallet) ──────────
registerApiRoutes(app);

// ── Config validation ────────────────────────────────────────────────
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.warn('[Server] Configuration warnings:', configErrors);
}

// ── R131: Error handler (must be last) ─────────────────────────────
app.use(globalErrorHandler);

// ── Start server ─────────────────────────────────────────────────────
export function startServer(port: number = PORT): ReturnType<typeof createServer> {
  const server = app.listen(port, () => {
    console.log(`[Server] HTTP server listening on http://localhost:${port}`);
    console.log(`[Server] Health: http://localhost:${port}/api/health`);
    console.log(`[Server] Signal API: http://localhost:${port}/api/signal`);
  });
  return server;
}

export { app };

if (require.main === module) {
  startServer();
}
