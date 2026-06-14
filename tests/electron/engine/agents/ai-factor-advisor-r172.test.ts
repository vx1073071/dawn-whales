/**
 * R172 E5: AI Recommendation History Tracking tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AIFactorAdvisor,
  createAIFactorAdvisor,
  type FactorAdvisorRequest,
} from '../../../../electron/engine/agents/ai-factor-advisor';

function makeRequest(query: string, market: 'US' | 'HK' | 'CRYPTO' = 'US'): FactorAdvisorRequest {
  return { query, market, userId: 'test-user', walletBalanceUSDT: 100 };
}

function makeAdvisor(): AIFactorAdvisor {
  const advisor = createAIFactorAdvisor();
  advisor.setBillingHandler(async () => ({ success: true, transactionId: `tx-${Date.now()}` }));
  return advisor;
}

describe('R172 E5: AI Recommendation History', () => {
  let advisor: AIFactorAdvisor;

  beforeEach(() => {
    advisor = createAIFactorAdvisor();
    advisor.setBillingHandler(async () => ({ success: true, transactionId: 'tx-test' }));
    advisor.clearHistory();
  });

  it('automatically records recommendations', async () => {
    await advisor.recommend(makeRequest('稳健配置'));
    await advisor.recommend(makeRequest('高成长推荐'));
    await advisor.recommend(makeRequest('深度学习因子分析'));

    const history = advisor.getRecommendationHistory();
    expect(history.length).toBe(3);
    // Each entry has required fields
    for (const entry of history) {
      expect(entry.sessionId).toBeDefined();
      expect(entry.intent).toBeDefined();
      expect(entry.factors.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeGreaterThan(0);
    }
  });

  it('getRecommendationHistory filters by intent', async () => {
    await advisor.recommend(makeRequest('推荐'));
    await advisor.recommend(makeRequest('深度分析'));
    await advisor.recommend(makeRequest('动量策略会失效吗'));

    const selection = advisor.getRecommendationHistory({ intent: 'selection' });
    expect(selection.length).toBe(1);
    expect(selection[0].intent).toBe('selection');

    const deep = advisor.getRecommendationHistory({ intent: 'deep_analysis' });
    expect(deep.length).toBe(1);
    expect(deep[0].intent).toBe('deep_analysis');
  });

  it('getRecommendationHistory filters by since', async () => {
    const before = Date.now();
    await advisor.recommend(makeRequest('推荐'));
    const after = Date.now();

    const recent = advisor.getRecommendationHistory({ since: after + 1000 });
    expect(recent.length).toBe(0);

    const all = advisor.getRecommendationHistory({ since: before - 1000 });
    expect(all.length).toBe(1);
  });

  it('getRecommendationHistory filters by limit', async () => {
    for (let i = 0; i < 5; i++) {
      await advisor.recommend(makeRequest(`推荐${i + 1}`));
    }

    const limited = advisor.getRecommendationHistory({ limit: 3 });
    expect(limited.length).toBe(3);
  });

  it('clearHistory empties the store', async () => {
    await advisor.recommend(makeRequest('推荐'));
    expect(advisor.getRecommendationHistory().length).toBe(1);

    advisor.clearHistory();
    expect(advisor.getRecommendationHistory().length).toBe(0);
  });

  it('getHistoryStats returns correct aggregates', async () => {
    // 3x selection, 2x skeptical, 1x deep_analysis
    for (let i = 0; i < 3; i++) await advisor.recommend(makeRequest('推荐'));
    for (let i = 0; i < 2; i++) await advisor.recommend(makeRequest('靠谱吗'));
    await advisor.recommend(makeRequest('深度分析'));

    const stats = advisor.getHistoryStats();
    expect(stats.totalRecommendations).toBe(6);
    expect(stats.uniqueIntents).toBeGreaterThanOrEqual(2);
    expect(stats.mostUsedIntent).toBeDefined();
    expect(stats.topFactors.length).toBeGreaterThan(0);
    expect(stats.avgFactorsPerRecommendation).toBeGreaterThan(0);
    expect(stats.lastRecommendationTime).toBeGreaterThan(0);
  });

  it('history is capped at MAX_HISTORY (50)', async () => {
    for (let i = 0; i < 55; i++) {
      await advisor.recommend(makeRequest(`推荐${i + 1}`));
    }
    const history = advisor.getRecommendationHistory();
    expect(history.length).toBeLessThanOrEqual(50);
  });

  it('history is a readonly snapshot', async () => {
    await advisor.recommend(makeRequest('推荐'));
    const history1 = advisor.getRecommendationHistory();
    const len1 = history1.length;

    // Add another
    await advisor.recommend(makeRequest('深度分析'));
    // Old snapshot unchanged
    expect(history1.length).toBe(len1);
    // New snapshot has more
    expect(advisor.getRecommendationHistory().length).toBe(2);
  });
});
