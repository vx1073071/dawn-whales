/**
 * @vitest-environment node
 * J-56-02: Multi-LLM Router Tests (15+ tests)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiLLMRouter,
  getMultiLLMRouter,
  resetMultiLLMRouter,
} from '../electron/engine/agents/multi-llm-router';

// ── Section 1: Provider Management ─────────────────────────────────────────

describe('J-56-02-01: Providers', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('01: has 11 providers', () => {
    expect(router.providerCount).toBe(11);
  });

  it('02: all providers enabled by default', () => {
    const enabled = router.getEnabledProviders();
    expect(enabled.length).toBe(11);
  });

  it('03: disable provider', () => {
    router.enableProvider('openai', false);
    const config = router.getProviderConfig('openai');
    expect(config!.enabled).toBe(false);
    expect(router.getEnabledProviders().length).toBe(10);
  });

  it('04: configure provider with API key ref', () => {
    router.configureProvider({
      provider: 'deepseek',
      apiKeyRef: 'vault://deepseek-key',
      enabled: true,
      rateLimitPerMin: 100,
    });
    const config = router.getProviderConfig('deepseek');
    expect(config!.apiKeyRef).toBe('vault://deepseek-key');
    expect(config!.rateLimitPerMin).toBe(100);
  });
});

// ── Section 2: Model Catalog ──────────────────────────────────────────────

describe('J-56-02-02: Model Catalog', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('05: catalog has models for all providers', () => {
    const catalog = router.getModelCatalog();
    expect(catalog.length).toBeGreaterThan(10);
    const providers = new Set(catalog.map(m => m.provider));
    expect(providers.size).toBeGreaterThanOrEqual(10);
  });

  it('06: DeepSeek models are cheapest', () => {
    const deepseek = router.getModelsByProvider('deepseek');
    expect(deepseek.length).toBeGreaterThanOrEqual(2);
    expect(deepseek[0].inputCostPer1K).toBeLessThan(0.001);
  });

  it('07: Ollama is free (local)', () => {
    const ollama = router.getModelsByProvider('ollama');
    expect(ollama.length).toBeGreaterThan(0);
    expect(ollama[0].inputCostPer1K).toBe(0);
    expect(ollama[0].outputCostPer1K).toBe(0);
    expect(ollama[0].isLocal).toBe(true);
  });

  it('08: getModel returns specific model', () => {
    const model = router.getModel('gpt-4o');
    expect(model).not.toBeNull();
    expect(model!.provider).toBe('openai');
    expect(model!.displayName).toBe('GPT-4o');
  });
});

// ── Section 3: Cost Estimation ────────────────────────────────────────────

describe('J-56-02-03: Cost Estimation', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('09: estimateCost for DeepSeek is very low', () => {
    const cost = router.estimateCost('deepseek-chat', 10000, 2000);
    expect(cost).toBeLessThan(0.01); // Less than 1 cent
  });

  it('10: estimateCost for GPT-4o is higher', () => {
    const dsCost = router.estimateCost('deepseek-chat', 10000, 2000);
    const gptCost = router.estimateCost('gpt-4o', 10000, 2000);
    expect(gptCost).toBeGreaterThan(dsCost);
  });

  it('11: estimateAnalysisCost gives rough budget', () => {
    const cost = router.estimateAnalysisCost('deepseek', 3);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1); // Should be well under $1
  });
});

// ── Section 4: Degradation Chain ─────────────────────────────────────────

describe('J-56-02-04: Degradation', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('12: default chain is V4 Pro cached → V4 Pro → V4 Flash → MiniMax M3 (v18)', () => {
    const chain = router.getDegradationChain();
    expect(chain.primary).toBe('deepseek');
    expect(chain.fallbacks).toContain('minimax');
    // v18 model chain should be V4 Pro cached → V4 Pro → V4 Flash → MiniMax M3
    const modelChain = router.getModelChain();
    expect(modelChain[0]).toBe('deepseek-v4-pro-cached');
    expect(modelChain).toContain('deepseek-v4-flash');
    expect(modelChain).toContain('minimax-m3');
  });

  it('13: getNextAvailableProvider returns primary when available', () => {
    const provider = router.getNextAvailableProvider();
    expect(provider).toBe('deepseek');
  });

  it('14: getNextAvailableProvider falls back when primary disabled', () => {
    router.enableProvider('deepseek', false);
    const provider = router.getNextAvailableProvider();
    expect(provider).not.toBe('deepseek');
    expect(provider).toBeDefined();
  });

  it('15: setDegradationChain updates chain', () => {
    router.setDegradationChain({
      primary: 'qwen',
      fallbacks: ['deepseek', 'ollama'],
      reason: 'Prefer Qwen for Chinese analysis',
    });
    const chain = router.getDegradationChain();
    expect(chain.primary).toBe('qwen');
    expect(chain.fallbacks[0]).toBe('deepseek');
  });
});

// ── Section 5: Usage Tracking ─────────────────────────────────────────────

describe('J-56-02-05: Usage', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('16: recordUsage tracks calls', () => {
    router.recordUsage({
      provider: 'deepseek', model: 'deepseek-chat',
      inputTokens: 5000, outputTokens: 1000, latencyMs: 800,
    });
    expect(router.usageCount).toBe(1);
  });

  it('17: getCostSummary aggregates correctly', () => {
    for (let i = 0; i < 5; i++) {
      router.recordUsage({
        provider: 'deepseek', model: 'deepseek-chat',
        inputTokens: 2000, outputTokens: 500, latencyMs: 500,
      });
    }
    const summary = router.getCostSummary();
    expect(summary.totalCalls).toBe(5);
    expect(summary.totalCostUSDT).toBeGreaterThan(0);
    expect(summary.byProvider.deepseek.calls).toBe(5);
  });

  it('18: rate limiting works', () => {
    router.configureProvider({
      provider: 'deepseek', enabled: true, rateLimitPerMin: 2,
    });
    expect(router.checkRateLimit('deepseek')).toBe(true);
    router.recordUsage({ provider: 'deepseek', model: 'deepseek-chat', inputTokens: 100, outputTokens: 50, latencyMs: 100 });
    router.recordUsage({ provider: 'deepseek', model: 'deepseek-chat', inputTokens: 100, outputTokens: 50, latencyMs: 100 });
    expect(router.checkRateLimit('deepseek')).toBe(false);
  });

  it('19: reset clears usage', () => {
    router.recordUsage({ provider: 'deepseek', model: 'deepseek-chat', inputTokens: 100, outputTokens: 50, latencyMs: 100 });
    router.reset();
    expect(router.usageCount).toBe(0);
  });
});

// ── v18: Cache + Degradation + Cost Alerts ─────────────────────────────

describe('J-56-02-v18: Cache Tracking + Model Chain + Alerts', () => {
  let router: MultiLLMRouter;

  beforeEach(() => {
    resetMultiLLMRouter();
    router = getMultiLLMRouter();
  });

  it('V18-01: cache hit rate starts at 0', () => {
    expect(router.getCacheHitRate()).toBe(0);
    const stats = router.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.targetRate).toBe(90);
  });

  it('V18-02: cache hit/miss tracking', () => {
    for (let i = 0; i < 9; i++) router.recordCacheHit();
    router.recordCacheMiss();
    expect(router.getCacheHitRate()).toBe(90);
    expect(router.getCacheStats().hits).toBe(9);
    expect(router.getCacheStats().total).toBe(10);
  });

  it('V18-03: V4 Pro cached model exists in catalog', () => {
    const model = router.getModel('deepseek-v4-pro-cached');
    expect(model).not.toBeNull();
    expect(model!.cachedInputCostPer1K).toBeDefined();
    expect(model!.cacheDiscountPct).toBe(99);
    expect(model!.cachedInputCostPer1K!).toBeLessThan(model!.inputCostPer1K);
  });

  it('V18-04: V4 Flash model exists in catalog', () => {
    const model = router.getModel('deepseek-v4-flash');
    expect(model).not.toBeNull();
    expect(model!.cacheDiscountPct).toBe(98);
  });

  it('V18-05: MiniMax M3 model exists (free fallback)', () => {
    const model = router.getModel('minimax-m3');
    expect(model).not.toBeNull();
    expect(model!.inputCostPer1K).toBe(0);
    expect(model!.outputCostPer1K).toBe(0);
  });

  it('V18-06: estimateCostWithCache respects hit rate', () => {
    const cost100 = router.estimateCostWithCache('deepseek-v4-pro-cached', 10000, 1000, 100);
    const cost0 = router.estimateCostWithCache('deepseek-v4-pro-cached', 10000, 1000, 0);
    // 100% cache hit should be much cheaper than 0%
    expect(cost100).toBeLessThan(cost0);
    expect(cost100).toBeGreaterThan(0);
  });

  it('V18-07: model chain defaults to v18 chain', () => {
    const chain = router.getModelChain();
    expect(chain[0]).toBe('deepseek-v4-pro-cached');
    expect(chain[1]).toBe('deepseek-v4-pro');
    expect(chain[2]).toBe('deepseek-v4-flash');
    expect(chain[3]).toBe('minimax-m3');
  });

  it('V18-08: getNextModelInChain returns next on failure', () => {
    expect(router.getNextModelInChain()).toBe('deepseek-v4-pro-cached');
    expect(router.getNextModelInChain('deepseek-v4-pro-cached')).toBe('deepseek-v4-pro');
    expect(router.getNextModelInChain('deepseek-v4-pro')).toBe('deepseek-v4-flash');
    expect(router.getNextModelInChain('deepseek-v4-flash')).toBe('minimax-m3');
    // Last in chain stays at last
    expect(router.getNextModelInChain('minimax-m3')).toBe('minimax-m3');
  });

  it('V18-09: cost alert triggers when threshold exceeded', () => {
    router.setCostAlertThreshold(0.001);
    // Record enough usage to exceed threshold
    for (let i = 0; i < 20; i++) {
      router.recordUsage({ provider: 'openai', model: 'gpt-4o', inputTokens: 5000, outputTokens: 1000, latencyMs: 100 });
    }
    const alerted = router.checkCostAlert();
    expect(alerted).toBe(true);
  });

  it('V18-10: promo expiry alert fires after date', () => {
    const pastDate = '2025-01-01T00:00:00Z';
    expect(router.checkPromoExpiry(pastDate)).toBe(true);
    // Second call should not re-alert
    expect(router.checkPromoExpiry(pastDate)).toBe(false);
  });

  it('V18-11: reset clears cache stats and model chain', () => {
    router.recordCacheHit();
    router.recordCacheHit();
    router.recordCacheMiss();
    router.reset();
    expect(router.getCacheHitRate()).toBe(0);
    expect(router.getModelChain()[0]).toBe('deepseek-v4-pro-cached');
  });
});
