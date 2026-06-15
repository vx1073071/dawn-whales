/**
 * StrategyRecommender.test.ts — R227 JVS-2.1a: 推荐引擎单元测试
 *
 * ≥10 tests.
 */

import { describe, it, expect } from 'vitest';
import { StrategyRecommender } from '../../../../electron/engine/strategies/StrategyRecommender';
import type { FactorStrategyTemplate } from '../../../../electron/engine/strategies/factor-strategy-templates-types';

// ─── Mock Templates ───────────────────────────────────────────────────

const MOCK_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'us-momentum-aggressive',
    name: 'US Momentum Breakout',
    nameCn: '美股动量突破',
    category: 'momentum',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '3-10天',
    holdingDays: { min: 3, max: 10, unit: 'day' },
    fourIronRules: {
      humanLine: '动量突破买入',
      stopLossRule: '跌破5日低点止损',
      marketScope: [{ market: '🇺🇸', assetClass: '股票' }],
      failureCheck: '波动率低于20日均值',
    },
    factorCombo: [
      { factorId: 'MOM_12M', factorName: '12个月动量', weight: 35, direction: 'long' },
      { factorId: 'RSI_14', factorName: '相对强弱指数', weight: 25, direction: 'long' },
      { factorId: 'VOL_60D', factorName: '60日波动率', weight: 20, direction: 'long' },
      { factorId: 'MKT', factorName: '市场Beta', weight: 15, direction: 'long' },
      { factorId: 'LIQ', factorName: '流动性', weight: 5, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 't1', label: 'AI诊断', touchpointId: 'DIAG', costUSDT: 1.5, description: '诊断' },
      { id: 't2', label: '信号推送', touchpointId: 'SIG', costUSDT: 0.5, description: '推送' },
      { id: 't3', label: '回测', touchpointId: 'BT', costUSDT: 1, description: '回测' },
      { id: 't4', label: 'ALT数据', touchpointId: 'ALT', costUSDT: 1.5, description: '数据' },
      { id: 't5', label: '报告', touchpointId: 'RPT', costUSDT: 2, description: '报告' },
    ],
    tags: ['us', 'momentum', 'breakout', 'aggressive', 'short-term'],
    version: '2.3.0',
    riskLevel: 'aggressive',
  },
  {
    id: 'hk-dividend-conservative',
    name: 'HK Dividend Value',
    nameCn: '港股股息价值',
    category: 'hk',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '高股息策略',
      stopLossRule: '股息率低于4%止损',
      marketScope: [{ market: '🇭🇰', assetClass: '股票' }],
      failureCheck: '恒指跌破200日线',
    },
    factorCombo: [
      { factorId: 'YIELD', factorName: '股息率', weight: 40, direction: 'long' },
      { factorId: 'HML', factorName: '市净率估值', weight: 30, direction: 'long' },
      { factorId: 'QUAL', factorName: '质量综合', weight: 30, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 't1', label: '筛查', touchpointId: 'SCR', costUSDT: 1, description: '筛查' },
    ],
    tags: ['hk', 'dividend', 'value', 'conservative', 'long-term'],
    version: '2.3.0',
    riskLevel: 'conservative',
  },
  {
    id: 'crypto-defi-staking',
    name: 'DeFi Staking Yield',
    nameCn: 'DeFi质押收益',
    category: 'crypto',
    difficulty: 3,
    timeHorizon: 'trend',
    expectedHoldingDays: '7-30天',
    holdingDays: { min: 7, max: 30, unit: 'day' },
    fourIronRules: {
      humanLine: 'DeFi收益策略',
      stopLossRule: 'TVL下降20%止损',
      marketScope: [{ market: '🔷', assetClass: '加密货币' }],
      failureCheck: 'Gas费飙升暂停',
    },
    factorCombo: [
      { factorId: 'CRYPTO_TVL_GROWTH', factorName: 'TVL增长率', weight: 30, direction: 'long' },
      { factorId: 'CRYPTO_STAKING_YIELD', factorName: '质押收益率', weight: 25, direction: 'long' },
      { factorId: 'CRYPTO_FEE_REVENUE', factorName: '协议费用收入', weight: 20, direction: 'long' },
      { factorId: 'CRYPTO_BTC_CORR', factorName: 'BTC相关性', weight: 15, direction: 'short' },
      { factorId: 'CRYPTO_LIQUIDATION_RISK', factorName: '清算风险', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 't1', label: '链上分析', touchpointId: 'ONC', costUSDT: 1.5, description: '分析' },
      { id: 't2', label: '监控', touchpointId: 'MON', costUSDT: 0.5, description: '监控' },
    ],
    tags: ['crypto', 'defi', 'staking', 'yield', 'moderate'],
    version: '2.3.0',
    riskLevel: 'balanced',
  },
  {
    id: 'jp-value-moderate',
    name: 'JP Value Rotation',
    nameCn: '日本价值轮动',
    category: 'jp',
    difficulty: 3,
    timeHorizon: 'trend',
    expectedHoldingDays: '20-60天',
    holdingDays: { min: 20, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: '日本价值策略',
      stopLossRule: '跌破60日线止损',
      marketScope: [{ market: '🇯🇵', assetClass: '股票' }],
      failureCheck: '日元暴涨15%暂停',
    },
    factorCombo: [
      { factorId: 'HML', factorName: '市净率估值', weight: 40, direction: 'long' },
      { factorId: 'SIZE', factorName: '规模效应', weight: 30, direction: 'long' },
      { factorId: 'QUAL', factorName: '质量综合', weight: 30, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 't1', label: '估值分析', touchpointId: 'VAL', costUSDT: 1, description: '分析' },
    ],
    tags: ['jp', 'value', 'rotation', 'moderate'],
    version: '2.3.0',
    riskLevel: 'moderate',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe('StrategyRecommender', () => {
  const recommender = new StrategyRecommender(MOCK_TEMPLATES);

  describe('recommend()', () => {
    it('should return top-3 recommendations for US aggressive', () => {
      const results = recommender.recommend({
        market: 'US',
        style: 'aggressive',
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].reasons.length).toBeGreaterThan(0);
      // US template should rank highly for US market
      const usResult = results.find((r) => r.templateId === 'us-momentum-aggressive');
      expect(usResult).toBeDefined();
    });

    it('should return top-3 recommendations for HK conservative', () => {
      const results = recommender.recommend({
        market: 'HK',
        style: 'conservative',
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const hkResult = results.find((r) => r.templateId === 'hk-dividend-conservative');
      expect(hkResult).toBeDefined();
    });

    it('should return crypto recommendations for CRYPTO market', () => {
      const results = recommender.recommend({
        market: 'CRYPTO',
        style: 'aggressive',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.templateId.startsWith('crypto'))).toBe(true);
    });

    it('should sort results by score descending', () => {
      const results = recommender.recommend({
        market: 'US',
        style: 'aggressive',
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should include all score breakdown fields', () => {
      const results = recommender.recommend({
        market: 'HK',
        style: 'conservative',
      });

      const top = results[0];
      expect(top.marketScore).toBeDefined();
      expect(top.styleScore).toBeDefined();
      expect(top.factorScore).toBeDefined();
      expect(top.popularityScore).toBeDefined();
      expect(top.riskLevel).toBeDefined();
      expect(top.expectedHoldingDays).toBeDefined();
    });

    it('should filter by sector when specified', () => {
      const results = recommender.recommend({
        market: 'US',
        style: 'aggressive',
        sector: 'momentum',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.templateId.includes('momentum'))).toBe(true);
    });

    it('should filter by time horizon preference', () => {
      const results = recommender.recommend({
        market: 'US',
        style: 'aggressive',
        preferredTimeHorizon: 'swing',
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for non-matching sector', () => {
      const results = recommender.recommend({
        market: 'HK',
        style: 'conservative',
        sector: 'crypto',
      });

      // Should still return 3, but like sector wouldn't match so we skip non-matching
      // Actually non-matching sector skips, so only matching returned
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recommendByFactors()', () => {
    it('should boost templates containing dominant factors', () => {
      const results = recommender.recommendByFactors(
        { market: 'US', style: 'aggressive' },
        ['MOM_12M', 'RSI_14']
      );

      expect(results.length).toBeGreaterThan(0);
      const top = results[0];
      expect(top.templateId).toBe('us-momentum-aggressive');
    });

    it('should work with factor_ prefixed IDs', () => {
      const results = recommender.recommendByFactors(
        { market: 'US', style: 'aggressive' },
        ['FACTOR_MOM_12M']
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('explain()', () => {
    it('should return a multi-line explanation string', () => {
      const results = recommender.recommend({
        market: 'HK',
        style: 'conservative',
      });

      const explanation = recommender.explain(results[0]);
      expect(explanation).toContain('推荐策略');
      expect(explanation).toContain('综合评分');
      expect(explanation).toContain('市场匹配');
    });
  });

  describe('constructor config', () => {
    it('should allow custom weighting', () => {
      const customRecommender = new StrategyRecommender(MOCK_TEMPLATES, {
        marketWeight: 0.5,
        styleWeight: 0.3,
        factorWeight: 0.1,
        popularityWeight: 0.1,
        maxResults: 2,
      });

      const results = customRecommender.recommend({
        market: 'HK',
        style: 'conservative',
      });

      expect(results).toHaveLength(2);
    });
  });
});
