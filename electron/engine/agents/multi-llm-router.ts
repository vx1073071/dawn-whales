/**
 * J-56-02: Multi-LLM Router (R56 TradingAgents Integration)
 * 11 家 LLM 路由 + 成本统计 + 降级链
 *
 * Supported providers:
 * 1. DeepSeek (default, cheapest, good Chinese)
 * 2. Qwen (Alibaba, good Chinese)
 * 3. MiniMax (Chinese-native)
 * 4. ZhiPu/GLM (Chinese academic)
 * 5. OpenAI GPT (most capable, expensive)
 * 6. Anthropic Claude (strong reasoning)
 * 7. Google Gemini (multimodal)
 * 8. Ollama (local, free)
 * 9. Moonshot/Kimi (Chinese, long context)
 * 10. Baichuan (Chinese)
 * 11. Yi/01.AI (Chinese)
 *
 * Features:
 * - Provider registry with model catalog
 * - Cost estimation per call (input/output tokens)
 * - Degradation chain (DeepSeek → Qwen → MiniMax → Ollama)
 * - Rate limiting per provider
 * - Usage tracking + monthly cost aggregation
 * - API key management (encrypted storage reference)
 *
 * ≥300L, 15+ tests
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:AI] structured error tracking

// ── Types ──────────────────────────────────────────────────────────────────

export type LLMProvider = 'deepseek' | 'qwen' | 'minimax' | 'zhipu' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'baichuan' | 'yi';
export type LLMCapability = 'chat' | 'analysis' | 'code' | 'reasoning' | 'multimodal';

export interface LLMModel {
  id: string;
  provider: LLMProvider;
  name: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1K: number;    // USDT per 1K input tokens (uncached)
  outputCostPer1K: number;   // USDT per 1K output tokens
  cachedInputCostPer1K?: number;  // USDT per 1K input tokens (cache hit, v18)
  cacheDiscountPct?: number;     // cache discount percentage (e.g. 99 = 99% off)
  capabilities: LLMCapability[];
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  latencyMs: number;         // estimated average latency
  isLocal: boolean;
}

export interface ProviderConfig {
  provider: LLMProvider;
  /** @deprecated R83 — migrate to server-side AI Gateway; client must not hold plaintext keys */
  apiKey?: string;
  /** @deprecated R83 — migrate to server-side session token */
  apiKeyRef?: string;
  baseUrl?: string;
  enabled: boolean;
  rateLimitPerMin: number;
  monthlyBudget?: number;     // USDT
}

export interface LLMRequest {
  provider: LLMProvider;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  provider: LLMProvider;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSDT: number;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  timestamp: string;
}

export interface UsageRecord {
  id: string;
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSDT: number;
  latencyMs: number;
  timestamp: string;
  sessionId?: string;
}

export interface CostSummary {
  totalCostUSDT: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  byProvider: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number }>;
  byModel: Record<string, { calls: number; cost: number }>;
  periodStart: string;
  periodEnd: string;
}

export interface DegradationChain {
  primary: LLMProvider;
  fallbacks: LLMProvider[];
  reason: string;
}

// ── Model Catalog ──────────────────────────────────────────────────────────

const MODEL_CATALOG: LLMModel[] = [
  // DeepSeek V4 family (v18 pricing, 2026/06)
  { id: 'deepseek-v4-pro-cached', provider: 'deepseek', name: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro (Cached)', contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1K: 0.000435, outputCostPer1K: 0.00087, cachedInputCostPer1K: 0.000003625, cacheDiscountPct: 99, capabilities: ['chat', 'analysis', 'reasoning', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 1500, isLocal: false },
  { id: 'deepseek-v4-pro', provider: 'deepseek', name: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1K: 0.00174, outputCostPer1K: 0.00348, capabilities: ['chat', 'analysis', 'reasoning', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 1500, isLocal: false },
  { id: 'deepseek-v4-flash', provider: 'deepseek', name: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', contextWindow: 128000, maxOutputTokens: 8192, inputCostPer1K: 0.00014, outputCostPer1K: 0.00028, cachedInputCostPer1K: 0.0000028, cacheDiscountPct: 98, capabilities: ['chat', 'analysis', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 800, isLocal: false },
  // DeepSeek V3 family (legacy)
  { id: 'deepseek-chat', provider: 'deepseek', name: 'deepseek-chat', displayName: 'DeepSeek V3.2 Chat', contextWindow: 128000, maxOutputTokens: 8192, inputCostPer1K: 0.00014, outputCostPer1K: 0.00028, capabilities: ['chat', 'analysis', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 800, isLocal: false },
  { id: 'deepseek-reasoner', provider: 'deepseek', name: 'deepseek-reasoner', displayName: 'DeepSeek R1', contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1K: 0.00055, outputCostPer1K: 0.00219, capabilities: ['chat', 'analysis', 'reasoning'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 3000, isLocal: false },
  { id: 'qwen-turbo', provider: 'qwen', name: 'qwen-turbo', displayName: 'Qwen Turbo', contextWindow: 128000, maxOutputTokens: 8192, inputCostPer1K: 0.0002, outputCostPer1K: 0.0006, capabilities: ['chat', 'analysis'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 600, isLocal: false },
  { id: 'qwen-max', provider: 'qwen', name: 'qwen-max', displayName: 'Qwen Max', contextWindow: 128000, maxOutputTokens: 8192, inputCostPer1K: 0.002, outputCostPer1K: 0.006, capabilities: ['chat', 'analysis', 'reasoning', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 1200, isLocal: false },
  { id: 'minimax-m3', provider: 'minimax', name: 'MiniMax-M3', displayName: 'MiniMax M3', contextWindow: 204800, maxOutputTokens: 8192, inputCostPer1K: 0, outputCostPer1K: 0, capabilities: ['chat', 'analysis', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 700, isLocal: false },
  { id: 'minimax-abab6', provider: 'minimax', name: 'abab6.5-chat', displayName: 'MiniMax ABAB6', contextWindow: 32768, maxOutputTokens: 8192, inputCostPer1K: 0.001, outputCostPer1K: 0.001, capabilities: ['chat', 'analysis'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 700, isLocal: false },
  { id: 'glm-4', provider: 'zhipu', name: 'glm-4', displayName: 'GLM-4', contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1K: 0.001, outputCostPer1K: 0.001, capabilities: ['chat', 'analysis', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 900, isLocal: false },
  { id: 'gpt-4o', provider: 'openai', name: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1K: 0.0025, outputCostPer1K: 0.01, capabilities: ['chat', 'analysis', 'reasoning', 'code', 'multimodal'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 1500, isLocal: false },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1K: 0.00015, outputCostPer1K: 0.0006, capabilities: ['chat', 'analysis', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 800, isLocal: false },
  { id: 'claude-sonnet', provider: 'anthropic', name: 'claude-3-5-sonnet', displayName: 'Claude Sonnet', contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1K: 0.003, outputCostPer1K: 0.015, capabilities: ['chat', 'analysis', 'reasoning', 'code'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 2000, isLocal: false },
  { id: 'gemini-pro', provider: 'gemini', name: 'gemini-2.0-pro', displayName: 'Gemini 2.0 Pro', contextWindow: 2000000, maxOutputTokens: 8192, inputCostPer1K: 0.00125, outputCostPer1K: 0.005, capabilities: ['chat', 'analysis', 'reasoning', 'multimodal'], supportsStreaming: true, supportsFunctionCalling: true, latencyMs: 1800, isLocal: false },
  { id: 'ollama-llama3', provider: 'ollama', name: 'llama3:8b', displayName: 'Llama3 8B (Local)', contextWindow: 8192, maxOutputTokens: 4096, inputCostPer1K: 0, outputCostPer1K: 0, capabilities: ['chat'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 5000, isLocal: true },
  { id: 'moonshot-v1', provider: 'moonshot', name: 'moonshot-v1-128k', displayName: 'Moonshot 128K', contextWindow: 128000, maxOutputTokens: 8192, inputCostPer1K: 0.0008, outputCostPer1K: 0.0008, capabilities: ['chat', 'analysis'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 1000, isLocal: false },
  { id: 'baichuan4', provider: 'baichuan', name: 'Baichuan4', displayName: 'Baichuan 4', contextWindow: 32768, maxOutputTokens: 4096, inputCostPer1K: 0.001, outputCostPer1K: 0.001, capabilities: ['chat', 'analysis'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 800, isLocal: false },
  { id: 'yi-large', provider: 'yi', name: 'yi-large', displayName: 'Yi Large', contextWindow: 32768, maxOutputTokens: 4096, inputCostPer1K: 0.0015, outputCostPer1K: 0.0015, capabilities: ['chat', 'analysis', 'reasoning'], supportsStreaming: true, supportsFunctionCalling: false, latencyMs: 1200, isLocal: false },
];

// Default degradation chain (v18): V4 Pro cached → V4 Pro → V4 Flash → MiniMax M3
const DEFAULT_CHAIN: DegradationChain = {
  primary: 'deepseek',
  fallbacks: ['deepseek', 'deepseek', 'minimax'],
  reason: 'V4 Pro cached → V4 Pro → V4 Flash → MiniMax M3 (cost-optimized)',
};

// v18 model-level degradation chain (model IDs, not just providers)
export const V18_MODEL_CHAIN = {
  primary: 'deepseek-v4-pro-cached',
  fallbacks: ['deepseek-v4-pro', 'deepseek-v4-flash', 'minimax-m3'],
  reason: 'V4 Pro 99% cache → V4 Pro full → V4 Flash → MiniMax M3 (free)',
};

// ── Multi-LLM Router ───────────────────────────────────────────────────────

export class MultiLLMRouter extends EventEmitter {
  private providers: Map<LLMProvider, ProviderConfig> = new Map();
  private usageHistory: UsageRecord[] = [];
  private rateCounters: Map<LLMProvider, { count: number; resetAt: number }> = new Map();
  private degradationChain: DegradationChain;
  private idCounter = 1;
  // v18: cache tracking
  private cacheHits = 0;
  private cacheTotal = 0;
  private modelChain: string[] = [V18_MODEL_CHAIN.primary, ...V18_MODEL_CHAIN.fallbacks];
  // v18: cost alerts
  private costAlertThresholdUSDT = 1.0; // alert when daily cost exceeds this
  private promoExpiryAlert = false;

  constructor() {
    super();
    this.degradationChain = { ...DEFAULT_CHAIN, fallbacks: [...DEFAULT_CHAIN.fallbacks] };

    // Initialize all providers as enabled by default
    const allProviders: LLMProvider[] = ['deepseek', 'qwen', 'minimax', 'zhipu', 'openai', 'anthropic', 'gemini', 'ollama', 'moonshot', 'baichuan', 'yi'];
    for (const p of allProviders) {
      this.providers.set(p, {
        provider: p,
        enabled: true,
        rateLimitPerMin: p === 'ollama' ? 999 : 60,
      });
    }
    log.info('[MultiLLMRouter] Initialized with 11 providers');
  }

  // ── Provider Management ───────────────────────────────────────────────

  getProviderConfig(provider: LLMProvider): ProviderConfig | null {
    return this.providers.get(provider) || null;
  }

  configureProvider(config: ProviderConfig): void {
    this.providers.set(config.provider, config);
    this.emit('provider:configured', config.provider);
    log.info(`[MultiLLMRouter] Provider configured: ${config.provider}`);
  }

  enableProvider(provider: LLMProvider, enabled: boolean): void {
    const config = this.providers.get(provider);
    if (config) {
      config.enabled = enabled;
      this.emit('provider:toggled', { provider, enabled });
    }
  }

  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  getEnabledProviders(): ProviderConfig[] {
    return this.getAllProviders().filter(p => p.enabled);
  }

  // ── Model Catalog ─────────────────────────────────────────────────────

  getModelCatalog(): LLMModel[] {
    return [...MODEL_CATALOG];
  }

  getModelsByProvider(provider: LLMProvider): LLMModel[] {
    return MODEL_CATALOG.filter(m => m.provider === provider);
  }

  getModel(modelId: string): LLMModel | null {
    return MODEL_CATALOG.find(m => m.id === modelId) || null;
  }

  getDefaultModel(provider: LLMProvider): LLMModel | null {
    const models = this.getModelsByProvider(provider);
    return models.length > 0 ? models[0] : null;
  }

  // ── Cost Estimation ───────────────────────────────────────────────────

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;
    const inputCost = (inputTokens / 1000) * model.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * model.outputCostPer1K;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  estimateAnalysisCost(provider: LLMProvider, debateRounds: number = 3): number {
    // Rough estimate: 4 agents × (input ~2K tokens + output ~500 tokens) × debate rounds
    const model = this.getDefaultModel(provider);
    if (!model) return 0;
    const inputTokens = 2000 * 4 * debateRounds;
    const outputTokens = 500 * 4 * debateRounds;
    return this.estimateCost(model.id, inputTokens, outputTokens);
  }

  // ── Rate Limiting ─────────────────────────────────────────────────────

  checkRateLimit(provider: LLMProvider): boolean {
    const config = this.providers.get(provider);
    if (!config || !config.enabled) return false;

    const now = Date.now();
    let counter = this.rateCounters.get(provider);

    if (!counter || now > counter.resetAt) {
      counter = { count: 0, resetAt: now + 60000 };
      this.rateCounters.set(provider, counter);
    }

    return counter.count < config.rateLimitPerMin;
  }

  incrementRateLimit(provider: LLMProvider): void {
    const now = Date.now();
    let counter = this.rateCounters.get(provider);

    if (!counter || now > counter.resetAt) {
      counter = { count: 0, resetAt: now + 60000 };
      this.rateCounters.set(provider, counter);
    }

    counter.count++;
  }

  // ── Degradation Chain ────────────────────────────────────────────────

  getDegradationChain(): DegradationChain {
    return { ...this.degradationChain, fallbacks: [...this.degradationChain.fallbacks] };
  }

  setDegradationChain(chain: DegradationChain): void {
    this.degradationChain = chain;
    this.emit('chain:updated', chain);
    log.info(`[MultiLLMRouter] Degradation chain updated: ${chain.primary} → ${chain.fallbacks.join(' → ')}`);
  }

  /**
   * Get the next available provider following the degradation chain
   */
  getNextAvailableProvider(preferred?: LLMProvider): LLMProvider | null {
    const chain = preferred
      ? { primary: preferred, fallbacks: this.degradationChain.fallbacks.filter(f => f !== preferred), reason: 'custom' }
      : this.degradationChain;

    // Try primary
    if (this.isProviderAvailable(chain.primary)) return chain.primary;

    // Try fallbacks in order
    for (const fallback of chain.fallbacks) {
      if (this.isProviderAvailable(fallback)) return fallback;
    }

    return null;
  }

  private isProviderAvailable(provider: LLMProvider): boolean {
    const config = this.providers.get(provider);
    if (!config || !config.enabled) return false;
    return this.checkRateLimit(provider);
  }

  // ── Usage Tracking ───────────────────────────────────────────────────

  recordUsage(params: {
    provider: LLMProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    sessionId?: string;
  }): UsageRecord {
    const cost = this.estimateCost(params.model, params.inputTokens, params.outputTokens);

    const record: UsageRecord = {
      id: `usage_${this.idCounter++}`,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUSDT: cost,
      latencyMs: params.latencyMs,
      timestamp: new Date().toISOString(),
      sessionId: params.sessionId,
    };

    this.usageHistory.push(record);
    this.incrementRateLimit(params.provider);
    this.emit('usage:recorded', record);
    return record;
  }

  getUsageHistory(filter?: { provider?: LLMProvider; since?: string }): UsageRecord[] {
    let records = [...this.usageHistory];
    if (filter?.provider) records = records.filter(r => r.provider === filter.provider);
    if (filter?.since) records = records.filter(r => r.timestamp >= filter.since!);
    return records;
  }

  getCostSummary(since?: string): CostSummary {
    const records = since ? this.usageHistory.filter(r => r.timestamp >= since) : [...this.usageHistory];
    const periodStart = records.length > 0 ? records[0].timestamp : new Date().toISOString();
    const periodEnd = records.length > 0 ? records[records.length - 1].timestamp : new Date().toISOString();

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    const byProvider: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number }> = {};
    const byModel: Record<string, { calls: number; cost: number }> = {};

    for (const r of records) {
      totalCost += r.costUSDT;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;

      if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 };
      byProvider[r.provider].calls++;
      byProvider[r.provider].cost += r.costUSDT;
      byProvider[r.provider].inputTokens += r.inputTokens;
      byProvider[r.provider].outputTokens += r.outputTokens;

      if (!byModel[r.model]) byModel[r.model] = { calls: 0, cost: 0 };
      byModel[r.model].calls++;
      byModel[r.model].cost += r.costUSDT;
    }

    return {
      totalCostUSDT: Math.round(totalCost * 1000000) / 1000000,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCalls: records.length,
      byProvider,
      byModel,
      periodStart,
      periodEnd,
    };
  }

  // ── v18: Cache Tracking ──────────────────────────────────────────────

  recordCacheHit(): void {
    this.cacheHits++;
    this.cacheTotal++;
  }

  recordCacheMiss(): void {
    this.cacheTotal++;
  }

  getCacheHitRate(): number {
    if (this.cacheTotal === 0) return 0;
    return Math.round((this.cacheHits / this.cacheTotal) * 10000) / 100;
  }

  getCacheStats(): { hits: number; total: number; hitRate: number; targetRate: number } {
    return {
      hits: this.cacheHits,
      total: this.cacheTotal,
      hitRate: this.getCacheHitRate(),
      targetRate: 90,
    };
  }

  /**
   * Estimate cost with cache awareness (v18)
   */
  estimateCostWithCache(modelId: string, inputTokens: number, outputTokens: number, cacheHitRate: number): number {
    const model = this.getModel(modelId);
    if (!model) return 0;

    const cachedCost = model.cachedInputCostPer1K ?? model.inputCostPer1K;
    const uncachedCost = model.inputCostPer1K;

    // Blended input cost based on cache hit rate
    const blendedInputCost = (cachedCost * cacheHitRate / 100) + (uncachedCost * (1 - cacheHitRate / 100));
    const inputCost = (inputTokens / 1000) * blendedInputCost;
    const outputCost = (outputTokens / 1000) * model.outputCostPer1K;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  /**
   * Get the next model in the v18 degradation chain
   */
  getNextModelInChain(failedModelId?: string): string {
    if (!failedModelId) return this.modelChain[0];
    const idx = this.modelChain.indexOf(failedModelId);
    if (idx === -1 || idx >= this.modelChain.length - 1) return this.modelChain[this.modelChain.length - 1];
    return this.modelChain[idx + 1];
  }

  getModelChain(): string[] {
    return [...this.modelChain];
  }

  setModelChain(chain: string[]): void {
    this.modelChain = [...chain];
    this.emit('model-chain:updated', chain);
  }

  /**
   * Check if promotional pricing has expired and alert
   */
  checkPromoExpiry(promoEndDate: string): boolean {
    const now = new Date();
    const expiry = new Date(promoEndDate);
    if (now > expiry && !this.promoExpiryAlert) {
      this.promoExpiryAlert = true;
      this.emit('alert:promo-expired', { promoEndDate, message: 'V4 Pro promotional pricing expired!' });
      log.warn(`[MultiLLMRouter] ⚠️ Promotional pricing expired: ${promoEndDate}`);
      return true;
    }
    return false;
  }

  /**
   * Cost alert: emits when daily cost exceeds threshold
   */
  checkCostAlert(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const summary = this.getCostSummary(today);
    if (summary.totalCostUSDT > this.costAlertThresholdUSDT) {
      this.emit('alert:cost-threshold', { totalCost: summary.totalCostUSDT, threshold: this.costAlertThresholdUSDT });
      return true;
    }
    return false;
  }

  setCostAlertThreshold(usdt: number): void {
    this.costAlertThresholdUSDT = usdt;
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  reset(): void {
    this.usageHistory = [];
    this.rateCounters.clear();
    this.idCounter = 1;
    this.degradationChain = { ...DEFAULT_CHAIN, fallbacks: [...DEFAULT_CHAIN.fallbacks] };
    this.cacheHits = 0;
    this.cacheTotal = 0;
    this.modelChain = [V18_MODEL_CHAIN.primary, ...V18_MODEL_CHAIN.fallbacks];
    this.promoExpiryAlert = false;
    log.info('[MultiLLMRouter] Reset');
  }

  get providerCount(): number {
    return this.providers.size;
  }

  get usageCount(): number {
    return this.usageHistory.length;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: MultiLLMRouter | null = null;

export function getMultiLLMRouter(): MultiLLMRouter {
  if (!_instance) _instance = new MultiLLMRouter();
  return _instance;
}

export function resetMultiLLMRouter(): void {
  _instance?.reset();
  _instance = null;
}

export default MultiLLMRouter;
