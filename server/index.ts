import express from 'express';
import { createServer } from 'http';
import { registerApiRoutes } from '../electron/api-routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());

// Health check: lightweight, always-on readiness probe
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.9.0',
  });
});

// AI Gateway status endpoint — R88: enhanced with key presence check
app.get('/api/ai/status', (_req, res) => {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const gatewayUrl = process.env.AI_GATEWAY_URL;

  res.json({
    gateway: deepseekKey ? 'direct' : gatewayUrl ? 'proxy' : 'offline',
    providers: ['deepseek-v4-pro', 'deepseek-flash', 'minimax-abab'],
    cacheEnabled: true,
    hasApiKey: !!deepseekKey,
    gatewayUrl: gatewayUrl || null,
    model: process.env.AI_DEFAULT_MODEL || 'deepseek-chat',
    timestamp: new Date().toISOString(),
  });
});

// Mount all API routes (AI chat, report, billing, wallet, auth)
registerApiRoutes(app);

// ── Health check middleware for other routes ───────────────────────────────

function healthCheckMiddleware(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  // Attach server status to response headers for monitoring
  res.setHeader('X-Server-Status', 'healthy');
  res.setHeader('X-Response-Time', Date.now().toString());
  next();
}

app.use(healthCheckMiddleware);

// ── Start server ───────────────────────────────────────────────────────────

export function startServer(port: number = PORT): ReturnType<typeof createServer> {
  const server = app.listen(port, () => {
    console.log(`[Server] HTTP server listening on http://localhost:${port}`);
    console.log(`[Server] Health check: http://localhost:${port}/api/health`);
  });

  return server;
}

export { app };

// ── CLI entry ──────────────────────────────────────────────────────────────

if (require.main === module) {
  startServer();
}
