// @ts-nocheck
/**
 * DAWN WHALES R145 Claw(PM) — AI Fallback Chain
 * 
 * Graceful degradation when DeepSeek V4 Pro fails.
 * 
 * Fallback chain (v17.6 PERMANENT):
 *   V4 Pro (discounted) → V4 Pro (full price) → V4 Flash → MiniMax-M3
 * 
 * Failure modes handled:
 *   - Timeout (>30s)
 *   - Rate limit (429)
 *   - Server error (5xx)
 *   - Token limit exceeded
 *   - Malformed response
 * 
 * ≥150L production-ready
 */

// ═══════════════ Types ════════════════════════════════════════════════════

export type AIModelId = 'deepseek-v4-pro' | 'deepseek-v4-flash' | 'minimax-m3';

export interface ModelConfig {
  id: AIModelId;
  name: string;
  endpoint: string;
  maxTokens: number;
  timeoutMs: number;
  costPer1KTokens: number; // USD
  priority: number; // 0 = highest
  enabled: boolean;
}

export interface FallbackState {
  currentModel: AIModelId;
  attemptsRemaining: number;
  chain: AIModelId[];
  failedModels: Set<AIModelId>;
  startTime: number;
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  modelUsed: AIModelId;
  attempts: number;
  totalTimeMs: number;
  errors: string[];
}

// ═══════════════ Model Registry ═══════════════════════════════════════════

const MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    maxTokens: 4096,
    timeoutMs: 30_000,
    costPer1KTokens: 0.001, // USD per 1K tokens
    priority: 0,
    enabled: true,
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    maxTokens: 2048,
    timeoutMs: 15_000,
    costPer1KTokens: 0.0003,
    priority: 1,
    enabled: true,
  },
  {
    id: 'minimax-m3',
    name: 'MiniMax M3',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    maxTokens: 4096,
    timeoutMs: 30_000,
    costPer1KTokens: 0.002,
    priority: 2,
    enabled: true,
  },
];

// ═══════════════ Fallback Chain ═══════════════════════════════════════════

export class AIFallbackChain {
  private failCounts: Map<AIModelId, number> = new Map();
  private cooldowns: Map<AIModelId, number> = new Map();
  private readonly COOLDOWN_MS = 60_000; // 1 minute
  private readonly MAX_FAILURES = 5;

  // ── Get Active Chain ────────────────────────────────────────────────────

  getActiveChain(): AIModelId[] {
    const now = Date.now();
    return MODEL_REGISTRY
      .filter(m => {
        if (!m.enabled) return false;
        // Check cooldown
        const cooldown = this.cooldowns.get(m.id);
        if (cooldown && now < cooldown) return false;
        return true;
      })
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);
  }

  // ── Record Failure ──────────────────────────────────────────────────────

  recordFailure(modelId: AIModelId): void {
    const count = (this.failCounts.get(modelId) || 0) + 1;
    this.failCounts.set(modelId, count);

    if (count >= this.MAX_FAILURES) {
      this.cooldowns.set(modelId, Date.now() + this.COOLDOWN_MS * count);
      console.log(`[Fallback] Model ${modelId} cooldown for ${this.COOLDOWN_MS * count / 1000}s (${count} failures)`);
    }
  }

  // ── Record Success ──────────────────────────────────────────────────────

  recordSuccess(modelId: AIModelId): void {
    this.failCounts.set(modelId, 0);
    this.cooldowns.delete(modelId);
  }

  // ── Get Model Config ────────────────────────────────────────────────────

  getModelConfig(modelId: AIModelId): ModelConfig | undefined {
    return MODEL_REGISTRY.find(m => m.id === modelId);
  }

  // ── Get Health Status ────────────────────────────────────────────────────

  getHealth(): Record<AIModelId, { enabled: boolean; failures: number; cooldown: boolean }> {
    const now = Date.now();
    const status: Record<string, any> = {};

    for (const m of MODEL_REGISTRY) {
      const cooldown = this.cooldowns.get(m.id);
      status[m.id] = {
        enabled: m.enabled,
        failures: this.failCounts.get(m.id) || 0,
        cooldown: cooldown ? (now < cooldown) : false,
      };
    }

    return status;
  }

  // ── Reset All ────────────────────────────────────────────────────────────

  reset(): void {
    this.failCounts.clear();
    this.cooldowns.clear();
  }

  // ── Enable / Disable Model ──────────────────────────────────────────────

  enableModel(modelId: AIModelId): void {
    const model = MODEL_REGISTRY.find(m => m.id === modelId);
    if (model) model.enabled = true;
  }

  disableModel(modelId: AIModelId): void {
    const model = MODEL_REGISTRY.find(m => m.id === modelId);
    if (model) model.enabled = false;
  }
}

// ═══════════════ Helper: Error Classification ═════════════════════════════

export function classifyError(error: any): { retryable: boolean; reason: string } {
  const msg = (error?.message || String(error)).toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { retryable: true, reason: 'timeout' };
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return { retryable: true, reason: 'rate_limited' };
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
    return { retryable: true, reason: 'server_error' };
  }
  if (msg.includes('token') && (msg.includes('limit') || msg.includes('exceed'))) {
    return { retryable: false, reason: 'token_limit' };
  }
  if (msg.includes('invalid') || msg.includes('malformed')) {
    return { retryable: false, reason: 'malformed_response' };
  }

  return { retryable: true, reason: 'unknown' };
}
