/**
 * J-58-02: Creator LLM Configuration Engine (R58 v19)
 * Backend for creator's LLM provider/model selection + budget management
 *
 * Features:
 * - CreatorLLMConfig persistence: creator ↔ provider ↔ model ↔ budget
 * - 11 provider availability status (online/offline/rate-limited)
 * - Budget management: monthly limit → alerts → auto-disable on overage
 * - Usage statistics per creator/agent/model dimension
 * - Cost estimator: input symbol + agent count → estimated USDT
 * - Integration with multi-llm-router + AICostMonitor
 *
 * ≥300L, 10 tests
 */

import { EventEmitter } from 'events';
import { EngineError, ErrorCode } from '../errors';


// ── Types ──────────────────────────────────────────────────────────────────

export interface CreatorLLMConfig {
  creator: string;
  provider: string;           // preferred provider
  model: string;              // preferred model
  fallbackProvider: string;   // fallback if primary unavailable
  fallbackModel: string;
  monthlyBudgetUSDT: number;
  maxSingleCallUSDT: number;
  maxDebateRounds: number;
  maxArenaModels: number;
  enableArena: boolean;        // multi-model arena mode
  enableDebate: boolean;       // debate mode
  autoDowngrade: boolean;      // auto switch to cheaper model on budget warning
  created: string;
  updated: string;
}

export interface ProviderStatus {
  provider: string;
  status: 'online' | 'offline' | 'rate-limited' | 'degraded';
  latencyMs: number;
  lastChecked: string;
  models: ModelStatus[];
}

export interface ModelStatus {
  model: string;
  status: 'online' | 'offline' | 'deprecated';
  currentPriceInput: number;
  currentPriceOutput: number;
  priceValidUntil?: string;
}

export interface UsageStats {
  creator: string;
  period: string;              // 'daily' | 'monthly' | 'total'
  totalCalls: number;
  totalCostUSDT: number;
  totalTokens: number;
  byProvider: Record<string, { calls: number; cost: number }>;
  byModel: Record<string, { calls: number; cost: number }>;
  byAgent: Record<string, { calls: number; cost: number }>;
}

export interface CostEstimate {
  symbol: string;
  agentCount: number;
  debateRounds: number;
  arenaModels: number;
  providers: { provider: string; model: string; estimatedCost: number }[];
  cheapest: { provider: string; model: string; cost: number };
  fastest: { provider: string; model: string; cost: number };
  recommended: { provider: string; model: string; cost: number; reason: string };
}

export interface ProviderCatalogEntry {
  provider: string;
  displayName: string;
  models: { id: string; displayName: string; costTier: 'free' | 'budget' | 'standard' | 'premium'; inputPer1K: number; outputPer1K: number; cachedDiscount: number; contextWindow: number }[];
}

// ── Provider Catalog (11 providers + models) ───────────────────────────────

const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    provider: 'deepseek', displayName: 'DeepSeek',
    models: [
      { id: 'deepseek-v4-pro-cached', displayName: 'V4 Pro (Cached)', costTier: 'budget', inputPer1K: 0.00000435, outputPer1K: 0.000435, cachedDiscount: 99, contextWindow: 128000 },
      { id: 'deepseek-v4-pro', displayName: 'V4 Pro', costTier: 'premium', inputPer1K: 0.000435, outputPer1K: 0.000435, cachedDiscount: 0, contextWindow: 128000 },
      { id: 'deepseek-v4-flash', displayName: 'V4 Flash', costTier: 'budget', inputPer1K: 0.000002175, outputPer1K: 0.0002175, cachedDiscount: 99, contextWindow: 128000 },
    ],
  },
  {
    provider: 'openai', displayName: 'OpenAI',
    models: [
      { id: 'gpt-4o', displayName: 'GPT-4o', costTier: 'premium', inputPer1K: 0.0025, outputPer1K: 0.01, cachedDiscount: 50, contextWindow: 128000 },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', costTier: 'standard', inputPer1K: 0.00015, outputPer1K: 0.0006, cachedDiscount: 50, contextWindow: 128000 },
    ],
  },
  {
    provider: 'anthropic', displayName: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet', displayName: 'Claude Sonnet', costTier: 'premium', inputPer1K: 0.003, outputPer1K: 0.015, cachedDiscount: 90, contextWindow: 200000 },
    ],
  },
  {
    provider: 'qwen', displayName: 'Qwen (Tongyi)',
    models: [
      { id: 'qwen-max', displayName: 'Qwen Max', costTier: 'standard', inputPer1K: 0.0004, outputPer1K: 0.0008, cachedDiscount: 90, contextWindow: 128000 },
      { id: 'qwen-turbo', displayName: 'Qwen Turbo', costTier: 'budget', inputPer1K: 0.00005, outputPer1K: 0.0001, cachedDiscount: 90, contextWindow: 128000 },
    ],
  },
  {
    provider: 'zhipu', displayName: 'Zhipu AI',
    models: [
      { id: 'glm-4', displayName: 'GLM-4', costTier: 'budget', inputPer1K: 0.0001, outputPer1K: 0.0001, cachedDiscount: 0, contextWindow: 128000 },
    ],
  },
  {
    provider: 'minimax', displayName: 'MiniMax',
    models: [
      { id: 'MiniMax-M3', displayName: 'MiniMax M3', costTier: 'free', inputPer1K: 0, outputPer1K: 0, cachedDiscount: 0, contextWindow: 128000 },
    ],
  },
  {
    provider: 'gemini', displayName: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-pro', displayName: 'Gemini 2.0 Pro', costTier: 'standard', inputPer1K: 0.00125, outputPer1K: 0.005, cachedDiscount: 25, contextWindow: 1000000 },
    ],
  },
  {
    provider: 'moonshot', displayName: 'Moonshot',
    models: [
      { id: 'moonshot-v1-128k', displayName: 'Moonshot 128K', costTier: 'standard', inputPer1K: 0.0002, outputPer1K: 0.0004, cachedDiscount: 0, contextWindow: 128000 },
    ],
  },
  {
    provider: 'baichuan', displayName: 'Baichuan',
    models: [
      { id: 'Baichuan4', displayName: 'Baichuan 4', costTier: 'standard', inputPer1K: 0.0002, outputPer1K: 0.0002, cachedDiscount: 0, contextWindow: 128000 },
    ],
  },
  {
    provider: 'yi', displayName: 'Yi (01.AI)',
    models: [
      { id: 'yi-large', displayName: 'Yi Large', costTier: 'standard', inputPer1K: 0.0003, outputPer1K: 0.0006, cachedDiscount: 0, contextWindow: 32768 },
    ],
  },
  {
    provider: 'ollama', displayName: 'Ollama (Local)',
    models: [
      { id: 'llama3:8b', displayName: 'Llama3 8B', costTier: 'free', inputPer1K: 0, outputPer1K: 0, cachedDiscount: 0, contextWindow: 8192 },
    ],
  },
];

// ── CreatorLLMConfigManager ────────────────────────────────────────────────

export class CreatorLLMConfigManager extends EventEmitter {
  private configs: Map<string, CreatorLLMConfig> = new Map();
  private providerStatuses: Map<string, ProviderStatus> = new Map();

  /**
   * Get or create creator config
   */
  getCreatorConfig(creator: string): CreatorLLMConfig {
    if (this.configs.has(creator)) return this.configs.get(creator)!;

    // Default config: V4 Pro cached (cheapest with quality)
    const defaultConfig: CreatorLLMConfig = {
      creator,
      provider: 'deepseek',
      model: 'deepseek-v4-pro-cached',
      fallbackProvider: 'minimax',
      fallbackModel: 'MiniMax-M3',
      monthlyBudgetUSDT: 50,
      maxSingleCallUSDT: 1.0,
      maxDebateRounds: 3,
      maxArenaModels: 3,
      enableArena: false,
      enableDebate: false,
      autoDowngrade: true,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    this.configs.set(creator, defaultConfig);
    return defaultConfig;
  }

  /**
   * Update creator config
   */
  updateCreatorConfig(creator: string, updates: Partial<CreatorLLMConfig>): CreatorLLMConfig {
    const config = this.getCreatorConfig(creator);
    const updated: CreatorLLMConfig = {
      ...config,
      ...updates,
      creator,
      updated: new Date().toISOString(),
    };

    // Validate provider/model exists in catalog
    const provider = PROVIDER_CATALOG.find(p => p.provider === updated.provider);
    if (!provider) throw new EngineError(ErrorCode.AI_QUERY_FAILED, `Unknown provider: ${updated.provider}`);
    const model = provider.models.find(m => m.id === updated.model);
    if (!model) throw new EngineError(ErrorCode.AI_QUERY_FAILED, `Unknown model: ${updated.model} for provider ${updated.provider}`);

    this.configs.set(creator, updated);
    this.emit('config:updated', { creator, config: updated });
    return updated;
  }

  /**
   * Get provider catalog (for UI)
   */
  getProviderCatalog(): ProviderCatalogEntry[] {
    return PROVIDER_CATALOG;
  }

  /**
   * Get models for a provider
   */
  getModelsForProvider(provider: string): ModelStatus[] {
    const catalog = PROVIDER_CATALOG.find(p => p.provider === provider);
    if (!catalog) return [];
    const status = this.providerStatuses.get(provider);
    return catalog.models.map(m => ({
      model: m.id,
      status: status?.models.find(s => s.model === m.id)?.status ?? 'online',
      currentPriceInput: m.inputPer1K,
      currentPriceOutput: m.outputPer1K,
    }));
  }

  /**
   * Update provider availability status
   */
  updateProviderStatus(provider: string, status: Partial<ProviderStatus>): void {
    const existing = this.providerStatuses.get(provider) || {
      provider,
      status: 'online',
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      models: [],
    };
    this.providerStatuses.set(provider, {
      ...existing,
      ...status,
      lastChecked: new Date().toISOString(),
    });
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providerStatuses.values());
  }

  /**
   * Get provider status
   */
  getProviderStatus(provider: string): ProviderStatus | undefined {
    return this.providerStatuses.get(provider);
  }

  /**
   * Check if a creator can afford a call
   */
  canAfford(creator: string, currentMonthlyUsage: number, estimatedCost: number): boolean {
    const config = this.getCreatorConfig(creator);
    if (estimatedCost > config.maxSingleCallUSDT) return false;
    if (config.monthlyBudgetUSDT === 0) return true; // unlimited
    return (currentMonthlyUsage + estimatedCost) <= config.monthlyBudgetUSDT;
  }

  /**
   * Auto-downgrade to cheaper model if budget is tight
   */
  autoDowngrade(creator: string, currentMonthlyUsage: number): CreatorLLMConfig | null {
    const config = this.getCreatorConfig(creator);
    if (!config.autoDowngrade) return null;

    const usagePct = (currentMonthlyUsage / config.monthlyBudgetUSDT) * 100;
    if (usagePct < 80) return null; // no need

    // Switch to V4 Flash cached
    if (config.model !== 'deepseek-v4-flash') {
      const downgraded = this.updateCreatorConfig(creator, {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
      });
      this.emit('alert:auto-downgraded', {
        creator,
        from: config.model,
        to: 'deepseek-v4-flash',
        reason: `Budget protection: ${Math.round(usagePct)}% used`,
      });
      return downgraded;
    }

    return null;
  }

  /**
   * Get usage stats for a creator
   */
  getUsageStats(creator: string, costLog: { agent: string; creator: string; provider: string; model: string; costUSDT: number; inputTokens: number; outputTokens: number }[]): UsageStats {
    const creatorLog = costLog.filter(r => r.creator === creator);
    const totalCost = Math.round(creatorLog.reduce((s, r) => s + r.costUSDT, 0) * 1000000) / 1000000;

    const byProvider: Record<string, { calls: number; cost: number }> = {};
    const byModel: Record<string, { calls: number; cost: number }> = {};
    const byAgent: Record<string, { calls: number; cost: number }> = {};

    for (const r of creatorLog) {
      if (!byProvider[r.provider]) byProvider[r.provider] = { calls: 0, cost: 0 };
      byProvider[r.provider].calls++;
      byProvider[r.provider].cost = Math.round((byProvider[r.provider].cost + r.costUSDT) * 1000000) / 1000000;

      if (!byModel[r.model]) byModel[r.model] = { calls: 0, cost: 0 };
      byModel[r.model].calls++;
      byModel[r.model].cost = Math.round((byModel[r.model].cost + r.costUSDT) * 1000000) / 1000000;

      if (!byAgent[r.agent]) byAgent[r.agent] = { calls: 0, cost: 0 };
      byAgent[r.agent].calls++;
      byAgent[r.agent].cost = Math.round((byAgent[r.agent].cost + r.costUSDT) * 1000000) / 1000000;
    }

    return {
      creator,
      period: 'total',
      totalCalls: creatorLog.length,
      totalCostUSDT: totalCost,
      totalTokens: creatorLog.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      byProvider,
      byModel,
      byAgent,
    };
  }

  /**
   * Estimate cost for an analysis scenario
   */
  estimateAnalysisCost(symbol: string, agentCount: number, debateRounds: number, arenaModels: number): CostEstimate {
    const providers = PROVIDER_CATALOG.flatMap(c =>
      c.models.map(m => {
        const inputTokens = 800 * agentCount * (1 + debateRounds);  // ~800 tokens per agent
        const outputTokens = 400 * agentCount;
        const cost = (inputTokens / 1000) * m.inputPer1K + (outputTokens / 1000) * m.outputPer1K;
        return { provider: c.provider, model: m.id, estimatedCost: Math.round(cost * 1000000) / 1000000, inputPer1K: m.inputPer1K };
      }),
    );

    const sorted = providers.sort((a, b) => a.estimatedCost - b.estimatedCost);
    const cheapest = sorted[0];
    const fastest = sorted.find(p => p.provider === 'deepseek' && p.model.includes('v4-pro'))
      || sorted.find(p => p.provider === 'deepseek')
      || sorted[0];

    return {
      symbol,
      agentCount,
      debateRounds,
      arenaModels,
      providers,
      cheapest: { provider: cheapest.provider, model: cheapest.model, cost: cheapest.estimatedCost },
      fastest: { provider: fastest.provider, model: fastest.model, cost: fastest.estimatedCost },
      recommended: {
        provider: sorted.find(p => p.model.includes('cached') || p.estimatedCost < 0.0005)?.provider ?? sorted[0].provider,
        model: sorted.find(p => p.model.includes('cached') || p.estimatedCost < 0.0005)?.model ?? sorted[0].model,
        cost: sorted.find(p => p.model.includes('cached') || p.estimatedCost < 0.0005)?.estimatedCost ?? sorted[0].estimatedCost,
        reason: 'Best quality/cost ratio: 99% cache discount with V4 Pro-level quality',
      },
    };
  }

  /**
   * Get all creator configs
   */
  getAllConfigs(): CreatorLLMConfig[] {
    return Array.from(this.configs.values());
  }

  reset(): void {
    this.configs.clear();
    this.providerStatuses.clear();
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _configInstance: CreatorLLMConfigManager | null = null;

export function getCreatorLLMConfigManager(): CreatorLLMConfigManager {
  if (!_configInstance) _configInstance = new CreatorLLMConfigManager();
  return _configInstance;
}

export function resetCreatorLLMConfigManager(): void {
  _configInstance?.reset();
  _configInstance = null;
}

export { PROVIDER_CATALOG };

export default { CreatorLLMConfigManager, getCreatorLLMConfigManager, resetCreatorLLMConfigManager, PROVIDER_CATALOG };
