// ── DAWN WHALES API Routes — P2-4 Server Endpoints ──────────────────
// 5 REST endpoints for the Electron server-side API.
// Import and mount in main.ts or a dedicated server entry:
//   import { registerApiRoutes } from './electron/api-routes';
//   const app = express();
//   registerApiRoutes(app);
//

import { EngineError, ErrorCode } from './errors';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ApiRequest {
  token?: string;
  body?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── Endpoint Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/ai/chat
 * Forward chat completions through the AI Gateway.
 * Body: { messages, model?, temperature?, max_tokens? }
 * Auth: Bearer token in header or token in body
 */
export async function handleAiChat(body: Record<string, unknown>): Promise<ApiResponse<{ content: string; model: string; usage?: Record<string, number> }>> {
  const { messages, model, temperature, max_tokens } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new EngineError('messages array is required and must be non-empty', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // Forward to AI Gateway (server-side multi-LLM router)
  const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:11434/v1';
  const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN || '';
  
  try {
    const res = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_GATEWAY_TOKEN ? { 'Authorization': `Bearer ${AI_GATEWAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        temperature: temperature ?? 0.3,
        max_tokens: max_tokens ?? 2048,
      }),
    });
    
    if (!res.ok) {
      throw new EngineError(`AI Gateway returned ${res.status}`, { code: ErrorCode.ENGINE_AI_ERROR, statusCode: res.status });
    }
    
    const data = await res.json() as any;
    return {
      success: true,
      data: {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model || 'unknown',
        usage: data.usage,
      },
    };
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError(`AI chat failed: ${(err as Error).message}`, { code: ErrorCode.ENGINE_AI_ERROR, statusCode: 502 });
  }
}

/**
 * POST /api/ai/report
 * Generate AI report (daily digest, strategy analysis, etc.)
 * Body: { type, strategy?, timeframe? }
 * Auth: Bearer token
 */
export async function handleAiReport(body: Record<string, unknown>): Promise<ApiResponse<{ report: string; generatedAt: string }>> {
  const { type, strategy, timeframe } = body;
  if (!type) {
    throw new EngineError('report type is required', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // Uses same AI Gateway for report generation
  const prompt = buildReportPrompt(type as string, strategy, timeframe);
  try {
    const chatResult = await handleAiChat({ messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2048 });
    return {
      success: true,
      data: {
        report: chatResult.data?.content || '',
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw new EngineError(`Report generation failed: ${(err as Error).message}`, { code: ErrorCode.ENGINE_AI_ERROR, statusCode: 502 });
  }
}

function buildReportPrompt(type: string, strategy?: unknown, timeframe?: unknown): string {
  const t = timeframe || '24h';
  switch (type) {
    case 'daily-digest':
      return `Generate a daily trading digest covering market overview, top movers, and key events for the last ${t}.`;
    case 'strategy-analyze':
      return `Analyze the following trading strategy: ${JSON.stringify(strategy)}. Provide performance insights and optimization suggestions.`;
    case 'risk-assessment':
      return `Provide a risk assessment report for the current portfolio over the last ${t}. Include VaR, exposure analysis, and hedge recommendations.`;
    default:
      return `Generate a ${type} AI report for the last ${t}.`;
  }
}

/**
 * POST /api/billing/subscribe
 * Create or update billing subscription.
 * Body: { userId, tier, paymentMethod? }
 * Auth: Bearer token
 */
export async function handleBillingSubscribe(body: Record<string, unknown>): Promise<ApiResponse<{ subscriptionId: string; tier: string; expiresAt: string }>> {
  const { userId, tier, paymentMethod } = body;
  if (!userId || !tier) {
    throw new EngineError('userId and tier are required', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  const validTiers = ['free', 'basic', 'pro', 'elite'];
  if (!validTiers.includes(tier as string)) {
    throw new EngineError(`Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}`, { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // TODO: Integrate with billing-wallet-server.ts for actual subscription creation
  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  return {
    success: true,
    data: {
      subscriptionId,
      tier: tier as string,
      expiresAt,
    },
  };
}

/**
 * GET /api/wallet/balance
 * Query wallet balance for a user.
 * Query: ?userId=xxx
 * Auth: Bearer token
 */
export async function handleWalletBalance(userId: string): Promise<ApiResponse<{ balance: number; currency: string; frozen: number }>> {
  if (!userId) {
    throw new EngineError('userId query parameter is required', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // TODO: Integrate with billing-wallet-server.ts for actual wallet query
  return {
    success: true,
    data: {
      balance: 0,
      currency: 'USDT',
      frozen: 0,
    },
  };
}

/**
 * POST /api/auth/device
 * Authenticate device and return session token.
 * Body: { deviceId, deviceName?, platform? }
 */
export async function handleAuthDevice(body: Record<string, unknown>): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
  const { deviceId, deviceName, platform } = body;
  if (!deviceId) {
    throw new EngineError('deviceId is required', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // Generate a session token (JWT-style placeholder)
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  return {
    success: true,
    data: {
      token,
      expiresAt,
    },
  };
}

// ── Route Registration ────────────────────────────────────────────────────

/**
 * Mount all API routes on an Express app instance.
 * Import and call from main.ts:
 *   import express from 'express';
 *   import { registerApiRoutes } from './electron/api-routes';
 *   const app = express();
 *   app.use(express.json());
 *   registerApiRoutes(app);
 *   app.listen(3001);
 */
export function registerApiRoutes(app: any): void {
  // POST /api/ai/chat
  app.post('/api/ai/chat', async (req: any, res: any) => {
    try {
      const result = await handleAiChat(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/ai/report
  app.post('/api/ai/report', async (req: any, res: any) => {
    try {
      const result = await handleAiReport(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/billing/subscribe
  app.post('/api/billing/subscribe', async (req: any, res: any) => {
    try {
      const result = await handleBillingSubscribe(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/wallet/balance
  app.get('/api/wallet/balance', async (req: any, res: any) => {
    try {
      const userId = req.query.userId as string;
      const result = await handleWalletBalance(userId);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/auth/device
  app.post('/api/auth/device', async (req: any, res: any) => {
    try {
      const result = await handleAuthDevice(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });
}

function handleError(res: any, err: unknown): void {
  if (err instanceof EngineError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  } else {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({
      success: false,
      error: message,
      code: ErrorCode.ENGINE_INTERNAL_ERROR,
    });
  }
}
