// ── Vitest tests: R175 E1续 — 5 new specialized intents ────────────
import { describe, it, expect } from 'vitest';
import { AIFactorAdvisor } from '../../../../electron/engine/agents/ai-factor-advisor';

describe('AIFactorAdvisor R175 E1续: 5 new specialized intents', () => {
  const advisor = new AIFactorAdvisor();

  // ── macro_hedge ──
  describe('macro_hedge intent', () => {
    it('detects macro keywords (双关键词)', () => {
      const result = advisor['parseIntent']('宏观对冲', 'US');
      expect(result.intent).toBe('macro_hedge');
    });

    it('detects inflation keyword', () => {
      const result = advisor['parseIntent']('通胀怎么配置因子', 'US');
      expect(result.intent).toBe('macro_hedge');
    });

    it('detects 衰退 keyword', () => {
      const result = advisor['parseIntent']('衰退期用什么因子', 'US');
      expect(result.intent).toBe('macro_hedge');
    });

    it('detects English macro patterns', () => {
      const result = advisor['parseIntent']('macro hedge inflation', 'US');
      expect(result.intent).toBe('macro_hedge');
    });

    it('recommend returns success with correct intent', async () => {
      const rec = await advisor.recommend({
        query: '宏观对冲',
        market: 'US',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.success).toBe(true);
      expect(rec.intent).toBe('macro_hedge');
      expect(rec.factors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── style_rotation ──
  describe('style_rotation intent', () => {
    it('detects style rotation keyword', () => {
      const result = advisor['parseIntent']('风格轮动', 'US');
      expect(result.intent).toBe('style_rotation');
    });

    it('detects growth vs value', () => {
      const result = advisor['parseIntent']('growth vs value rotate', 'US');
      expect(result.intent).toBe('style_rotation');
    });

    it('detects 切换 keyword', () => {
      const result = advisor['parseIntent']('风格切换', 'US');
      expect(result.intent).toBe('style_rotation');
    });

    it('recommend returns success', async () => {
      const rec = await advisor.recommend({
        query: '风格轮动',
        market: 'US',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.success).toBe(true);
      expect(rec.intent).toBe('style_rotation');
      expect(rec.factors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── tail_risk ──
  describe('tail_risk intent', () => {
    it('detects tail risk keywords', () => {
      const result = advisor['parseIntent']('尾部风险', 'US');
      expect(result.intent).toBe('tail_risk');
    });

    it('detects black swan (tail keyword prioritized)', () => {
      const result = advisor['parseIntent']('black swan tail', 'US');
      expect(result.intent).toBe('tail_risk');
    });

    it('detects 崩盘 protection', () => {
      const result = advisor['parseIntent']('崩盘保护', 'US');
      expect(result.intent).toBe('tail_risk');
    });

    it('detects 暴跌 protection', () => {
      const result = advisor['parseIntent']('预防暴跌', 'US');
      expect(result.intent).toBe('tail_risk');
    });

    it('recommend returns success', async () => {
      const rec = await advisor.recommend({
        query: '尾部风险',
        market: 'US',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.success).toBe(true);
      expect(rec.intent).toBe('tail_risk');
      expect(rec.factors.length).toBeGreaterThanOrEqual(4);
    });

    it('has lower expected return (defensive)', async () => {
      const rec = await advisor.recommend({
        query: '尾部风险',
        market: 'US',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.intent).toBe('tail_risk');
      expect(rec.backtest.expectedReturn).toBeLessThan(15);
    });
  });

  // ── factor_substitution ──
  describe('factor_substitution intent', () => {
    it('detects factor substitution keywords', () => {
      const result = advisor['parseIntent']('换因子', 'US');
      expect(result.intent).toBe('factor_substitution');
    });

    it('detects replace keywords', () => {
      const result = advisor['parseIntent']('replace momentum factor', 'US');
      expect(result.intent).toBe('factor_substitution');
    });

    it('detects 替代 pattern', () => {
      const result = advisor['parseIntent']('替代动量因子', 'US');
      expect(result.intent).toBe('factor_substitution');
    });

    it('recommend returns success', async () => {
      const rec = await advisor.recommend({
        query: '换因子',
        market: 'US',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.success).toBe(true);
      expect(rec.intent).toBe('factor_substitution');
      expect(rec.factors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── crypto_portfolio ──
  describe('crypto_portfolio intent', () => {
    it('detects crypto portfolio keywords', () => {
      const result = advisor['parseIntent']('加密组合', 'CRYPTO');
      expect(result.intent).toBe('crypto_portfolio');
    });

    it('detects defi keywords', () => {
      const result = advisor['parseIntent']('deFi layer2 config', 'CRYPTO');
      expect(result.intent).toBe('crypto_portfolio');
    });

    it('detects btc/eth portfolio', () => {
      const result = advisor['parseIntent']('btc eth 配置比例', 'CRYPTO');
      expect(result.intent).toBe('crypto_portfolio');
    });

    it('recommend returns success', async () => {
      const rec = await advisor.recommend({
        query: '加密组合',
        market: 'CRYPTO',
        userId: 'test-user',
        walletBalanceUSDT: 10,
      });
      expect(rec.success).toBe(true);
      expect(rec.intent).toBe('crypto_portfolio');
      expect(rec.factors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── Cross-check: legacy intents still work ──
  describe('legacy intents still intact', () => {
    it('balanced_all_weather persists', () => {
      const result = advisor['parseIntent']('均衡配置全天候', 'US');
      expect(result.intent).toBe('balanced_all_weather');
    });

    it('question intent persists', () => {
      const result = advisor['parseIntent']('怎么看这个因子', 'US');
      expect(result.intent).toBe('question');
    });

    it('crypto_trend persists for crypto keyword', () => {
      const result = advisor['parseIntent']('加密趋势', 'CRYPTO');
      expect(result.intent).toBe('crypto_trend');
    });
  });
});
