import express from 'express';
import { createServer } from 'http';

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
