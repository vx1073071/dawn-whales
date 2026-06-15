/**
 * TemplateUnifiedService.test.ts — R227 JVS-2.1d: 统一模板服务测试
 *
 * ≥10 tests.
 */

import { describe, it, expect } from 'vitest';
import { TemplateUnifiedService } from '../../../../electron/engine/strategies/TemplateUnifiedService';
import type { StrategyTemplate } from '../../../../electron/engine/strategies/strategy-templates';
import type { FactorStrategyTemplate } from '../../../../electron/engine/strategies/factor-strategy-templates-types';

// ─── Mock Data ────────────────────────────────────────────────────────

const MOCK_STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'macd-dual-ma',
    name: 'MACD Dual MA',
    nameCn: 'MACD双均线',
    description: 'Classic MACD crossover',
    oneLiner: 'Classic MACD crossover strategy',
    category: 'trend',
    timeframe: ['1h', '4h', '1d'],
    parameters: [{ name: 'fastPeriod', label: '快线周期', type: 'number', default: 12, min: 5, max: 50, step: 1, description: 'EMA快线' }],
    indicators: ['MACD', 'EMA'],
    rules: { entry: 'MACD金叉', exit: 'MACD死叉', stopLoss: '跌破支撑' },
    risk: { defaultStopLoss: 5, defaultTakeProfit: 15, maxPosition: 0.2 },
    tags: ['trend', 'macd', 'momentum'],
    backtestSummary: '年化12%, 夏普1.5',
    riskLevel: 'aggressive',
  },
  {
    id: 'value-stocks',
    name: 'Value Stocks',
    nameCn: '价值股筛选',
    description: 'Deep value strategy',
    oneLiner: 'Buy undervalued stocks',
    category: 'value',
    timeframe: ['1d', '1w'],
    parameters: [],
    indicators: ['PE', 'PB', 'DIV'],
    rules: { entry: 'PE<15', exit: 'PE>25' },
    risk: { defaultStopLoss: 10, defaultTakeProfit: 30, maxPosition: 0.15 },
    tags: ['value', 'dividend', 'conservative'],
    backtestSummary: '年化8%, 夏普1.2',
    riskLevel: 'conservative',
  },
];

const MOCK_FACTOR_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'hk-ah-premium',
    name: 'AH Premium Arbitrage',
    nameCn: 'AH溢价套利',
    category: 'hk',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '5-20天',
    holdingDays: { min: 5, max: 20, unit: 'day' },
    fourIronRules: {
      humanLine: 'AH溢价套利策略',
      stopLossRule: '溢价扩大5%止损',
      marketScope: [{ market: '🇭🇰', assetClass: '股票' }],
      failureCheck: '溢价连续10日低于10%',
    },
    factorCombo: [
      { factorId: 'FACTOR_AH_PREMIUM', factorName: 'AH溢价', weight: 40, direction: 'long' },
      { factorId: 'HK_SOUTHBOUND', factorName: '港股通资金', weight: 30, direction: 'long' },
      { factorId: 'LOW_VOL', factorName: '低波动', weight: 30, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'diag1', label: '深度诊断', touchpointId: 'DIAG', costUSDT: 1.5, description: '诊断' },
      { id: 'sig1', label: '信号推送', touchpointId: 'SIG', costUSDT: 0.5, description: '推送' },
    ],
    tags: ['hk', 'arbitrage', 'ah-premium'],
    version: '2.1.0',
    riskLevel: 'balanced',
  },
  {
    id: 'crypto-defi-yield',
    name: 'DeFi Yield Strategy',
    nameCn: 'DeFi收益策略',
    category: 'crypto',
    difficulty: 4,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: 'DeFi质押收益',
      stopLossRule: 'TVL下降20%止损',
      marketScope: [{ market: '🪙', assetClass: '加密货币' }],
      failureCheck: 'Gas费飙升',
    },
    factorCombo: [
      { factorId: 'CRYPTO_TVL_GROWTH', factorName: 'TVL增长', weight: 40, direction: 'long' },
      { factorId: 'CRYPTO_STAKING_YIELD', factorName: '质押收益', weight: 35, direction: 'long' },
      { factorId: 'CRYPTO_BTC_CORR', factorName: 'BTC相关', weight: 25, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 'a1', label: '链上分析', touchpointId: 'ONC', costUSDT: 1.5, description: '分析' },
    ],
    tags: ['crypto', 'defi', 'yield'],
    version: '2.1.0',
    riskLevel: 'aggressive',
  },
];

const MOCK_REGION_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'jp-value-rotation',
    name: 'JP Value Rotation',
    nameCn: '日本价值轮动',
    category: 'jp',
    difficulty: 2,
    timeHorizon: 'trend',
    expectedHoldingDays: '20-60天',
    holdingDays: { min: 20, max: 60, unit: 'day' },
    fourIronRules: {
      humanLine: '日本价值轮动策略',
      stopLossRule: '跌破60日线止损',
      marketScope: [{ market: '🇯🇵', assetClass: '股票' }],
      failureCheck: '日元暴涨15%',
    },
    factorCombo: [
      { factorId: 'HML', factorName: '市净率', weight: 50, direction: 'long' },
      { factorId: 'SIZE', factorName: '规模', weight: 50, direction: 'long' },
    ],
    aiTriggerPoints: [],
    tags: ['jp', 'value', 'rotation'],
    version: '2.2.0',
    riskLevel: 'conservative',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe('TemplateUnifiedService', () => {
  const service = new TemplateUnifiedService(
    MOCK_STRATEGY_TEMPLATES,
    MOCK_FACTOR_TEMPLATES,
    MOCK_REGION_TEMPLATES
  );

  describe('getTemplate()', () => {
    it('should return a strategy template by ID', () => {
      const t = service.getTemplate('macd-dual-ma');
      expect(t).not.toBeNull();
      expect(t!.nameCn).toBe('MACD双均线');
      expect(t!.source).toBe('strategy-22');
    });

    it('should return a factor template by ID', () => {
      const t = service.getTemplate('hk-ah-premium');
      expect(t).not.toBeNull();
      expect(t!.nameCn).toBe('AH溢价套利');
      expect(t!.source).toBe('factor-36');
    });

    it('should return a region template by ID', () => {
      const t = service.getTemplate('jp-value-rotation');
      expect(t).not.toBeNull();
      expect(t!.source).toBe('region-46');
    });

    it('should return null for unknown ID', () => {
      const t = service.getTemplate('nonexistent-id');
      expect(t).toBeNull();
    });
  });

  describe('listTemplates()', () => {
    it('should return all templates with no filters', () => {
      const all = service.listTemplates();
      expect(all).toHaveLength(5);
    });

    it('should filter by market', () => {
      const hk = service.listTemplates({ market: 'HK' });
      expect(hk.length).toBeGreaterThan(0);
      expect(hk.every((t) => t.market === 'HK')).toBe(true);
    });

    it('should filter by riskLevel', () => {
      const aggressive = service.listTemplates({ riskLevel: 'aggressive' });
      expect(aggressive.length).toBeGreaterThan(0);
      expect(aggressive.some((t) => t.riskLevel === 'aggressive')).toBe(true);
    });

    it('should filter by category', () => {
      const trend = service.listTemplates({ category: 'trend' });
      expect(trend.length).toBeGreaterThan(0);
      expect(trend.every((t) => t.category === 'trend')).toBe(true);
    });

    it('should support limit and offset', () => {
      const first = service.listTemplates({ limit: 2 });
      expect(first).toHaveLength(2);
    });
  });

  describe('searchTemplates()', () => {
    it('should search by Chinese name', () => {
      const results = service.searchTemplates('MACD');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by tag', () => {
      const results = service.searchTemplates('arbitrage');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'hk-ah-premium')).toBe(true);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', () => {
      const stats = service.getStats();
      expect(stats.total).toBe(5);
      expect(stats.bySource['strategy-22']).toBe(2);
      expect(stats.bySource['factor-36']).toBe(2);
      expect(stats.bySource['region-46']).toBe(1);
    });

    it('should have market distribution', () => {
      const stats = service.getStats();
      expect(Object.keys(stats.byMarket).length).toBeGreaterThan(0);
    });
  });

  describe('count()', () => {
    it('should return total template count', () => {
      expect(service.count()).toBe(5);
    });
  });
});
