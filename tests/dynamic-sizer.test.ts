// ── Q16: Dynamic Position Sizing Tests ──────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicSizer, initDynamicSizer, getDynamicSizer } from '../electron/engine/dynamic-sizer';

describe('Q16: Dynamic Position Sizing', () => {
  let sizer: DynamicSizer;

  beforeEach(() => {
    sizer = new DynamicSizer({
      kellyFraction: 0.25,
      maxPositionPct: 0.25,
      stopLossPct: 0.05,
      sentimentWeight: 0,
    });
  });

  it('should initialize with default config', () => {
    const s = new DynamicSizer();
    const config = s.getConfig();
    
    expect(config.kellyFraction).toBe(0.25);
    expect(config.maxPositionPct).toBe(0.25);
    expect(config.stopLossPct).toBe(0.05);
  });

  it('should calculate size with Kelly (mocked)', async () => {
    // Mock trade history with positive win rate
    sizer['tradeHistory'] = [
      { strategyId: 'test', symbol: '600519', entryPrice: 100, exitPrice: 110, shares: 100, pnl: 1000, pnlPct: 0.10, timestamp: Date.now() },
      { strategyId: 'test', symbol: '600519', entryPrice: 100, exitPrice: 105, shares: 100, pnl: 500, pnlPct: 0.05, timestamp: Date.now() },
      { strategyId: 'test', symbol: '600519', entryPrice: 100, exitPrice: 95, shares: 100, pnl: -500, pnlPct: -0.05, timestamp: Date.now() },
    ];

    const result = await sizer.calculateSize({
      strategyId: 'test',
      symbol: '600519',
      capital: 1000000,
      currentPrice: 100,
    });

    expect(result.success).toBe(true);
    expect(result.recommendedShares).toBeGreaterThan(0);
    expect(result.positionPct).toBeGreaterThan(0);
    expect(result.stopLossPrice).toBe(95); // 100 * (1 - 0.05)
  });

  it('should use fixed fraction if not enough trades', async () => {
    const result = await sizer.calculateSize({
      strategyId: 'new-strategy',
      symbol: '600519',
      capital: 1000000, // 1M to get meaningful shares
      currentPrice: 100,
    });

    expect(result.success).toBe(true);
    // Should use default 10% if < kellyMinTrades
    const expectedShares = Math.floor((1000000 * 0.10) / 100 / 100) * 100;
    expect(result.recommendedShares).toBe(expectedShares);
  });

  it('should adjust for volatility', async () => {
    // High volatility → lower position
    const resultHighVol = await sizer.calculateSize({
      strategyId: 'test',
      symbol: '600519',
      capital: 1000000,
      currentPrice: 100,
      volatility: 0.40, // 40% vol
    });
    
    // Low volatility → higher position
    const resultLowVol = await sizer.calculateSize({
      strategyId: 'test2',
      symbol: '000858',
      capital: 1000000,
      currentPrice: 200,
      volatility: 0.10, // 10% vol
    });
    
    // Low vol should have larger position than high vol
    const sizeHighVol = resultHighVol.positionPct!;
    const sizeLowVol = resultLowVol.positionPct!;
    
    expect(sizeLowVol).toBeGreaterThan(sizeHighVol);
  });

  it('should adjust for regime', async () => {
    // Bull regime → 1.2x multiplier
    const resultBull = await sizer.calculateSize({
      strategyId: 'test',
      symbol: '600519',
      capital: 1000000,
      currentPrice: 100,
      regime: 'bull',
    });
    
    // Bear regime → 0.5x multiplier
    const resultBear = await sizer.calculateSize({
      strategyId: 'test2',
      symbol: '000858',
      capital: 1000000,
      currentPrice: 200,
      regime: 'bear',
    });
    
    expect(resultBull.positionPct!).toBeGreaterThan(resultBear.positionPct!);
  });

  it('should cap at maxPositionPct', async () => {
    const result = await sizer.calculateSize({
      strategyId: 'test',
      symbol: '600519',
      capital: 100000,
      currentPrice: 10,
      winRate: 1.0, // 100% win rate
      avgWinLossRatio: 10.0, // Very high win/loss
    });

    // Even with very high Kelly, should cap at maxPositionPct (25%)
    expect(result.positionPct!).toBeLessThanOrEqual(0.25);
  });

  it('should return singleton from initDynamicSizer', () => {
    const s1 = initDynamicSizer();
    const s2 = getDynamicSizer();
    expect(s1).toBe(s2); // Same instance
  });

  it('should record trade and calculate win rate', () => {
    sizer.recordTrade({
      strategyId: 'test',
      symbol: '600519',
      entryPrice: 100,
      exitPrice: 110,
      shares: 100,
    });

    sizer.recordTrade({
      strategyId: 'test',
      symbol: '000858',
      entryPrice: 50,
      exitPrice: 48,
      shares: 200,
    });

    const history = sizer.getTradeHistory('test');
    expect(history.length).toBe(2);

    const winRate = sizer.getWinRate('test');
    expect(winRate).toBe(0.5); // 1 win / 2 trades
  });

  it('should calculate portfolio sizes', async () => {
    const result = await sizer.calculatePortfolioSizes({
      strategyId: 'test',
      positions: [
        { symbol: '600519', currentShares: 100, currentPrice: 100, entryPrice: 95 },
        { symbol: '000858', currentShares: 50, currentPrice: 200, entryPrice: 210 },
      ],
      capital: 1000000,
    });

    expect(result.success).toBe(true);
    expect(result.positionSizes.length).toBe(2);
    expect(result.totalExposurePct).toBeGreaterThan(0);
  });

  it('should handle empty request', async () => {
    const result = await sizer.calculateSize({
      strategyId: 'test',
      symbol: '600519',
      capital: 0, // No capital
      currentPrice: 100,
    });

    expect(result.success).toBe(true);
    expect(result.recommendedShares).toBe(0);
  });

  it('should update config', () => {
    sizer.updateConfig({
      kellyFraction: 0.5,
      maxPositionPct: 0.30,
    });

    const config = sizer.getConfig();
    expect(config.kellyFraction).toBe(0.5);
    expect(config.maxPositionPct).toBe(0.30);
  });
});
