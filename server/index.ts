// ── DAWN WHALES Server ────────────────────────────────────────────────
// R148: Full integration + performance + chain stability + rate limiting
// R151: AI health cron + monthly spending report
// R152: Symbol search engine + broker market API
// R153: WebSocket push + quote cache + latency monitor
// R154: Broker priority config + Market status + Playback
// R155: Mount quote-router/cache/health — data pipeline live!

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { registerApiRoutes } from '../electron/api-routes';
import { initDatabases, getDatabase } from './db/database';
import { registerAuthRoutes } from './middleware/jwt-auth';
import { auditMiddleware } from './middleware/audit-logger';
import { globalErrorHandler } from './middleware/error-handler';
import { config, validateConfig } from './config/env';
import signalRoutes from './routes/signal';
import walletRoutes from './routes/wallet';
import symbolRoutes from './routes/symbol'; // R152: symbol search
import deadLetterRoutes from './middleware/dead-letter';

// R148: Integration + optimizations
import { APIIntegration, unifiedErrorHandler } from './services/api-integration';
import { RateLimiter, rateLimitMiddleware, AIRateLimiter, IndexOptimizer, LRUCache, BatchExecutor } from './middleware/optimizations';
import { ChainMonitorV2 } from './services/chain-monitor-v2';
import { AIHealthCheckService } from './services/ai-health';
import { AIBillingService } from './services/ai-billing';

// R155: Quote data pipeline — mounted!
import { getQuoteRouter } from './services/quote-router';
import { getQuoteCache } from './services/quote-cache';
import { QuoteHealthMonitor } from './services/quote-health';

// R157: Watchlist import/export API
import watchlistRoutes from './routes/watchlist';

// R162: Backtest snapshot + comparison API
import backtestRoutes from './routes/backtest';

const app = express();
const PORT = config.port;

// ── R148: Rate limiters ────────────────────────────────────────────
const generalLimiter = new RateLimiter(60000, 100);  // 100 req/min
const aiLimiter = new AIRateLimiter();                // 10 req/min for AI

// ── R130: Audit logging ─────────────────────────────────────────────
app.use(auditMiddleware);

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ── R148: General rate limiting ─────────────────────────────────────
app.use(rateLimitMiddleware(generalLimiter));

// ── R129: Init databases ─────────────────────────────────────────────
let db: ReturnType<typeof getDatabase>;
try {
  initDatabases();
  db = getDatabase();
  console.log('[Server] Databases initialized');
} catch (err) {
  console.error('[Server] Database init failed:', err);
  process.exit(1);
}

// ── R155: Quote pipeline initialization ──────────────────────────────
const quoteRouter = getQuoteRouter();
const quoteCache = getQuoteCache();
const quoteHealth = new QuoteHealthMonitor(db!);
console.log('[Server] Quote pipeline mounted: router + cache + health');

// ── R155: Quote health endpoint ──────────────────────────────────────
app.get('/api/quote/health', (_req, res) => {
  res.json({
    router: quoteRouter.getStats(),
    cache: quoteCache.getCacheStats(),
    brokerHealth: quoteHealth.getAllBrokerHealth(),
    markets: quoteHealth.getAllMarketStatuses(),
  });
});

// ── R148: Index optimization ─────────────────────────────────────────
try {
  const optimizer = new IndexOptimizer(db!);
  const created = optimizer.ensureIndexes();
  console.log(`[Server] Index optimizer: ensured ${created.length} indexes`);
} catch (err) {
  console.warn('[Server] Index optimization failed:', err);
}

// ── R148: Chain monitor v2 (resilience) ──────────────────────────────
let chainMonitor: ChainMonitorV2;
try {
  chainMonitor = new ChainMonitorV2();
  chainMonitor.startHealthChecks();
  console.log('[Server] Chain monitor v2 started');
} catch (err) {
  console.warn('[Server] Chain monitor init failed:', err);
}

// ── R151: AI health check daily cron ──────────────────────────────
let aiHealthCheck: AIHealthCheckService | null = null;
let aiHealthCheckTimer: ReturnType<typeof setInterval> | null = null;
try {
  const aiBilling = new AIBillingService(db!);
  aiHealthCheck = new AIHealthCheckService(db!, aiBilling);
  console.log('[Server] AI health check service initialized');

  // Run daily at 02:00 UTC (10:00 HKT)
  aiHealthCheckTimer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === 2 && now.getUTCMinutes() < 30) {
      console.log('[Server] Running daily AI health check...');
      try {
        const users = db!.prepare('SELECT DISTINCT user_id, id as wallet_id FROM wallets').all() as any[];
        for (const user of users) {
          try {
            aiHealthCheck!.checkHealth(user.user_id, user.wallet_id, `daily-cron-${now.toISOString().split('T')[0]}-${user.user_id}`);
          } catch (userErr) {
            console.warn(`[Server] AI health check failed for user ${user.user_id}:`, userErr);
          }
        }
        console.log(`[Server] Daily AI health check complete — ${users.length} users scanned`);
      } catch (err) {
        console.warn('[Server] Daily AI health check error:', err);
      }
    }
  }, 30 * 60 * 1000); // Every 30 minutes, check if it's 02:00 UTC

  console.log('[Server] AI health check daily cron registered (02:00 UTC)');
} catch (err) {
  console.warn('[Server] AI health check init failed:', err);
}

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '2.1.0',
    services: Array.from(integration['services']?.keys() || []),
  });
});

// R148: Extended health with chain + AI health status
app.get('/api/health/extended', async (_req, res) => {
  const chainStatus = chainMonitor ? await chainMonitor.getStatus() : [];
  res.json({
    status: 'ok',
    version: '2.1.0',
    uptime: process.uptime(),
    chainStatus,
    aiHealthCheck: aiHealthCheck ? 'active' : 'disabled',
    rateLimiter: generalLimiter.stats(),
    aiRateLimiter: aiLimiter.stats(),
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

// ── R148: AI routes with stricter rate limiting ────────────────────
app.use('/api/ai', aiLimiter ? rateLimitMiddleware(aiLimiter) : (_req, _res, next) => next());

// ── R129: Auth routes ────────────────────────────────────────────────
registerAuthRoutes(app);

// ── R129: Signal routes ──────────────────────────────────────────────
app.use('/api/signal', signalRoutes);

// ── R141: Wallet + Ledger + Idempotency routes ─────────────────────────
app.use('/api/wallet', walletRoutes);

// ── R152: Symbol Search + Broker Markets routes ─────────────────────────
app.use('/api/symbol', symbolRoutes);

// ── R154: Broker Config + Market Status + Playback routes ───────────────
import brokerConfigRoutes from './routes/broker-config';
app.use('/api/broker', brokerConfigRoutes);
app.use('/api/market', brokerConfigRoutes);

// ── R157: Watchlist Import/Export routes ────────────────────────────────
app.use('/api/watchlist', watchlistRoutes);

// ── R162: Backtest Snapshot + Comparison routes ───────────────────────────
app.use('/api/backtest/snapshots', backtestRoutes);

// ── R163 P1-X3: Factor Spot-Check + Compare API ──────────────────────
import factorApiRoutes from './routes/factor-api';
app.use('/api/factor', factorApiRoutes);

// ── R132: Dead letter queue ──────────────────────────────────────────
app.use('/api/dead-letter', deadLetterRoutes);

// ── R148: Integration health ────────────────────────────────────────
integration.mountAll(app, db!);

// ── Existing API routes (AI chat, report, billing, wallet) ──────────
registerApiRoutes(app);

// ── Config validation ────────────────────────────────────────────────
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.warn('[Server] Configuration warnings:', configErrors);
}

// ── R148: Unified error handler (replaces globalErrorHandler) ──────
app.use(unifiedErrorHandler);

// ── Start server ─────────────────────────────────────────────────────
export function startServer(port: number = PORT): ReturnType<typeof createServer> {
  const server = app.listen(port, () => {
    console.log(`[Server] HTTP server listening on http://localhost:${port}`);
    console.log(`[Server] Health: http://localhost:${port}/api/health`);
    console.log(`[Server] Signal API: http://localhost:${port}/api/signal`);
    console.log(`[Server] Version: v2.1.0`);
  });
  return server;
}

export { app, chainMonitor, aiHealthCheck, integration, generalLimiter, aiLimiter };

if (require.main === module) {
  startServer();
}
