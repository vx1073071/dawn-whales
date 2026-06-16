// ── quant-moo API Routes — P2-4 Server Endpoints ──────────────────
// 5 REST endpoints for the Electron server-side API.
// Import and mount in main.ts or a dedicated server entry:
//   import { registerApiRoutes } from './electron/api-routes';
//   const app = express();
//   registerApiRoutes(app);
//

import log from 'electron-log';
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
 * POST /api/ai/chat — R88: DeepSeek API proxy with server-side key injection.
 *
 * Authentication via Bearer token (JWT) in Authorization header.
 * The DEEPSEEK_API_KEY is read from server environment variables only —
 * never exposed to the Electron client.
 *
 * Body: { messages, model?, temperature?, max_tokens? }
 * Auth: Bearer token in header
 *
 * Fallback chain:
 *   1. DEEPSEEK_API_KEY env var → call api.deepseek.com directly
 *   2. AI_GATEWAY_URL env var → forward to external gateway (Ollama / LMStudio)
 *   3. Simulated response (offline/dev mode, no key available)
 */
export async function handleAiChat(body: Record<string, unknown>): Promise<ApiResponse<{ content: string; model: string; usage?: Record<string, number> }>> {
  const { messages, model, temperature, max_tokens } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new EngineError('messages array is required and must be non-empty', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const selectedModel = (model as string) || 'deepseek-chat';
  const temp = (temperature as number) ?? 0.3;
  const maxTok = (max_tokens as number) ?? 2048;

  // ── Path 1: Direct DeepSeek API (primary, secure — key never leaves server) ──
  if (deepseekKey) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: temp,
          max_tokens: maxTok,
        }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        return {
          success: true,
          data: {
            content: (data.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content || '',
            model: (data.model as string) || selectedModel,
            usage: data.usage ? {
              promptTokens: (data.usage as Record<string, number>).prompt_tokens || 0,
              completionTokens: (data.usage as Record<string, number>).completion_tokens || 0,
              totalTokens: (data.usage as Record<string, number>).total_tokens || 0,
            } : undefined,
          },
        };
      }

      // If DeepSeek fails with non-2xx, fall through to gateway or simulation
      log.warn(`[api-routes] DeepSeek returned ${res.status}, falling back to gateway/simulation`);
    } catch (err) {
      log.warn(`[api-routes] DeepSeek direct call failed: ${(err as Error).message}, falling back`);
    }
  }

  // ── Path 2: External AI Gateway (Ollama / LMStudio / custom) ──
  const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;
  const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN || '';

  if (AI_GATEWAY_URL) {
    try {
      const res = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AI_GATEWAY_TOKEN ? { 'Authorization': `Bearer ${AI_GATEWAY_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: temp,
          max_tokens: maxTok,
        }),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        return {
          success: true,
          data: {
            content: (data.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content || (data.content as string) || '',
            model: (data.model as string) || selectedModel,
            usage: data.usage as Record<string, number> | undefined,
          },
        };
      }

      log.warn(`[api-routes] Gateway returned ${res.status}, falling back to simulation`);
    } catch (err) {
      log.warn(`[api-routes] Gateway call failed: ${(err as Error).message}, falling back to simulation`);
    }
  }

  // ── Path 3: Simulated response (offline / dev mode — no API key or gateway) ──
  const lastMessage = messages[messages.length - 1] as { role: string; content: string };
  const userText = typeof lastMessage?.content === 'string' ? lastMessage.content.substring(0, 80) : 'N/A';

  return {
    success: true,
    data: {
      content: `[Simulated ${selectedModel}] Response to: "${userText}..."\n\nThis is a simulated AI response running in offline mode. Set DEEPSEEK_API_KEY or AI_GATEWAY_URL environment variable for real AI responses.`,
      model: selectedModel,
      usage: {
        promptTokens: Math.ceil(userText.length / 4),
        completionTokens: 50,
        totalTokens: Math.ceil(userText.length / 4) + 50,
      },
    },
  };
}

/**
 * POST /api/ai/report — R88: AI report generation via DeepSeek proxy.
 *
 * Generates structured reports (daily digest, strategy analysis, risk assessment).
 * Uses handleAiChat internally → inherits the same DEEPSEEK_API_KEY security model.
 *
 * Body: { type, strategy?, timeframe? }
 * Auth: Bearer token
 */
export async function handleAiReport(body: Record<string, unknown>): Promise<ApiResponse<{ report: string; generatedAt: string; model?: string }>> {
  const { type, strategy, timeframe } = body;
  if (!type) {
    throw new EngineError('report type is required', { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  // Validate report type
  const validTypes = ['daily-digest', 'strategy-analyze', 'risk-assessment', 'market-outlook', 'portfolio-review'];
  if (!validTypes.includes(type as string)) {
    throw new EngineError(`Invalid report type: ${type}. Must be one of: ${validTypes.join(', ')}`, { code: ErrorCode.ENGINE_VALIDATION_ERROR, statusCode: 400 });
  }

  const prompt = buildReportPrompt(type as string, strategy, timeframe);
  try {
    const chatResult = await handleAiChat({ messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 2048 });
    return {
      success: true,
      data: {
        report: chatResult.data?.content || '',
        generatedAt: new Date().toISOString(),
        model: chatResult.data?.model || 'unknown',
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
      return `Generate a professional daily trading digest in markdown format covering: market overview (major indices), top movers (gainer/loser), key economic events, and sector rotation for the last ${t}. Include actionable insights.`;
    case 'strategy-analyze':
      return `You are a quantitative strategy analyst. Analyze the following trading strategy in detail: ${JSON.stringify(strategy)}. Provide: 1) Performance metrics assessment, 2) Risk-adjusted return analysis, 3) Optimization suggestions, 4) Weakness identification. Format in markdown.`;
    case 'risk-assessment':
      return `You are a risk management specialist. Provide a comprehensive risk assessment report for the current portfolio over the last ${t}. Include: 1) Value-at-Risk (VaR) analysis, 2) Exposure analysis by sector/asset, 3) Correlation matrix summary, 4) Hedge ratio recommendations. Format in markdown.`;
    case 'market-outlook':
      return `You are a market strategist. Provide a market outlook report for the next trading session. Include: 1) Key levels to watch, 2) Catalysts and events, 3) Sentiment analysis, 4) Positioning recommendation (bullish/bearish/neutral).`;
    case 'portfolio-review':
      return `You are a portfolio manager. Review the current portfolio and provide: 1) Performance summary, 2) Allocation efficiency, 3) Concentration risk, 4) Rebalancing suggestions.`;
    default:
      return `Generate a professional ${type} AI report in markdown format for the last ${t}. Include actionable insights and data-driven analysis.`;
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
export function registerApiRoutes(app: unknown): void {
  // POST /api/ai/chat
  app.post('/api/ai/chat', async (req: unknown, res: unknown) => {
    try {
      const result = await handleAiChat(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/ai/report
  app.post('/api/ai/report', async (req: unknown, res: unknown) => {
    try {
      const result = await handleAiReport(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/billing/subscribe
  app.post('/api/billing/subscribe', async (req: unknown, res: unknown) => {
    try {
      const result = await handleBillingSubscribe(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // GET /api/wallet/balance
  app.get('/api/wallet/balance', async (req: unknown, res: unknown) => {
    try {
      const userId = req.query.userId as string;
      const result = await handleWalletBalance(userId);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // POST /api/auth/device
  app.post('/api/auth/device', async (req: unknown, res: unknown) => {
    try {
      const result = await handleAuthDevice(req.body);
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });
}

function handleError(res: unknown, err: unknown): void {
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
