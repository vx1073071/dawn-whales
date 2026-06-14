/**
 * Tests for AIFactorAdvisor — R171 E1: 5 new conversational intents
 */
import { describe, it, expect } from 'vitest';
import {
  AIFactorAdvisor,
  getAIFactorAdvisor,
  createAIFactorAdvisor,
  type FactorAdvisorRequest,
} from '../../../../electron/engine/agents/ai-factor-advisor';

function makeRequest(query: string, market: 'US' | 'HK' | 'CRYPTO' = 'US'): FactorAdvisorRequest {
  return {
    query,
    market,
    userId: 'test-user',
    walletBalanceUSDT: 100,
  };
}

// Mock billing handler
function makeAdvisor(): AIFactorAdvisor {
  const advisor = createAIFactorAdvisor();
  advisor.setBillingHandler(async () => ({
    success: true,
    transactionId: `tx-${Date.now()}`,
  }));
  return advisor;
}

describe('AIFactorAdvisor R171 E1: 5 new intents', () => {

  // ── Question intent ──────────────────────────────────────────────
  describe('question intent', () => {
    it('detects Chinese question keywords', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('什么是价值因子'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('question');
      expect(result.intentLabel).toBe('因子咨询');
      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.factors.every(f => f.recommendedWeight > 0)).toBe(true);
    });

    it('detects "怎么看" pattern', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('怎么看动量因子现在的表现'));
      expect(result.intent).toBe('question');
    });

    it('detects English question pattern', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('what is factor investing'));
      expect(result.intent).toBe('question');
    });
  });

  // ── Selection intent ─────────────────────────────────────────────
  describe('selection intent', () => {
    it('detects recommendation keywords', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('推荐什么因子配置比较好'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('selection');
      expect(result.intentLabel).toBe('因子筛选');
      expect(result.factors.length).toBeGreaterThanOrEqual(4);
    });

    it('detects "选哪个" pattern', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('动量因子和成长因子选哪个'));
      expect(result.intent).toBe('selection');
    });

    it('detects English "recommend"', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('recommend factors for bull market'));
      expect(result.intent).toBe('selection');
    });
  });

  // ── Answer intent ────────────────────────────────────────────────
  describe('answer intent', () => {
    it('detects "为什么" question', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('为什么动量因子近期表现差'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('answer');
      expect(result.intentLabel).toBe('因子答疑');
      expect(result.factors.length).toBeGreaterThan(0);
    });

    it('detects evidence-seeking patterns', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('有数据证明价值因子还有效吗'));
      expect(result.intent).toBe('answer');
    });

    it('detects English "why"', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('why is volatility low right now'));
      expect(result.intent).toBe('answer');
    });
  });

  // ── Skeptic intent ───────────────────────────────────────────────
  describe('skeptic intent', () => {
    it('detects doubt keywords', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('这个因子组合靠谱吗'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('skeptic');
      expect(result.intentLabel).toBe('质疑审查');
      // Skeptic should return conservative factors
      expect(result.factors.some(f => f.factorId === 'CMA')).toBe(true);
    });

    it('detects risk concerns', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('动量策略会失效吗'));
      expect(result.intent).toBe('skeptic');
    });

    it('detects overfitting concern', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('这个策略是不是过拟合了'));
      expect(result.intent).toBe('skeptic');
    });

    it('detects English skeptical patterns', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('is this factor really safe'));
      expect(result.intent).toBe('skeptic');
    });
  });

  // ── Deep analysis intent ────────────────────────────────────────
  describe('deep_analysis intent', () => {
    it('detects depth keywords', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('给我做一个深度的全面分析'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('deep_analysis');
      expect(result.intentLabel).toBe('深度分析');
      // Deep analysis should use the most factors
      expect(result.factors.length).toBeGreaterThanOrEqual(7);
      expect(result.suggestedFactorCount).toBeGreaterThanOrEqual(7);
    });

    it('detects "详细" pattern', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('详细分析一下成长因子'));
      expect(result.intent).toBe('deep_analysis');
    });

    it('detects English "deep dive"', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('do a deep dive on HML factor'));
      expect(result.intent).toBe('deep_analysis');
    });

    it('detects "professional" keyword', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('给我一份专业的多维度分析报告'));
      expect(result.intent).toBe('deep_analysis');
    });
  });

  // ── Billing integration ──────────────────────────────────────────
  describe('billing', () => {
    it('charges 1 USDT for recommendation', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('推荐因子'));
      expect(result.success).toBe(true);
      expect(result.billing.charged).toBe(true);
      expect(result.billing.amountUSDT).toBe(1.0);
      expect(result.billing.serviceType).toBe('AI_FACTOR_ADVISOR');
      expect(result.billing.transactionId).toBeDefined();
    });

    it('fails when balance is insufficient', async () => {
      const advisor = new AIFactorAdvisor();
      const result = await advisor.recommend({
        query: '推荐', market: 'US', userId: 'poor-user', walletBalanceUSDT: 0.5,
      });
      expect(result.success).toBe(false);
      expect(result.billing.charged).toBe(false);
    });
  });

  // ── Existing intents still work ──────────────────────────────────
  describe('legacy intents', () => {
    it('still detects balanced_all_weather', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('我想要一个均衡配置'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('balanced_all_weather');
    });

    it('still detects crypto_trend for crypto market', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('随便看看', 'CRYPTO'));
      expect(result.intent).toBe('crypto_trend');
    });

    it('fallback to balanced for unmatched query', async () => {
      const advisor = makeAdvisor();
      const result = await advisor.recommend(makeRequest('asdfgh'));
      expect(result.success).toBe(true);
      expect(result.intent).toBe('balanced_all_weather');
    });
  });

  // ── listIntents includes new ones ────────────────────────────────
  describe('listIntents', () => {
    it('includes new intents', () => {
      const advisor = new AIFactorAdvisor();
      const intents = advisor.listIntents();
      expect(intents.length).toBeGreaterThanOrEqual(14); // 9 original + 5 new
      const intentIds = intents.map(i => i.intent);
      expect(intentIds).toContain('question');
      expect(intentIds).toContain('selection');
      expect(intentIds).toContain('answer');
      expect(intentIds).toContain('skeptic');
      expect(intentIds).toContain('deep_analysis');
    });
  });
});
