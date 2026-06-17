/**
 * R273 新兴市场+汇率数据源测试
 * 
 * NseDataSource: 16 tests
 * KrxTwseDataSource: 14 tests
 * FxDataSource: 15 tests
 * Total: 45 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NseDataSource, nseDataSource } from '../../electron/engine/data/nse-data-source';
import { KrxTwseDataSource, krxTwseDataSource } from '../../electron/engine/data/krx-twse-data-source';
import { FxDataSource, fxDataSource } from '../../electron/engine/data/fx-data-source';

// ═══════════════════════════════════════════════════════════════════════════
// NseDataSource Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R273 NseDataSource', () => {
  let source: NseDataSource;

  beforeEach(() => { source = new NseDataSource(); });

  it('should ingest FII/DII and detect surge', () => {
    const signals = source.ingestFiiDii({
      date: '2026-06-17',
      fiiGrossBuy: 15000, fiiGrossSell: 5000, fiiNet: 10000,
      diiGrossBuy: 3000, diiGrossSell: 8000, diiNet: -5000,
      fiiIndexFutNet: 2000, fiiStockFutNet: 500, fiiIndexOptNet: 1000,
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('fii_surge');
    expect(signals[0].severity).toBe('critical');
  });

  it('should not trigger FII alert for small flows', () => {
    const signals = source.ingestFiiDii({
      date: '2026-06-17',
      fiiGrossBuy: 500, fiiGrossSell: 300, fiiNet: 200,
      diiGrossBuy: 200, diiGrossSell: 400, diiNet: -200,
      fiiIndexFutNet: 0, fiiStockFutNet: 0, fiiIndexOptNet: 0,
    });
    expect(signals.length).toBe(0);
  });

  it('should ingest futures and detect OI buildup', () => {
    // Ingest baseline
    source.ingestFutures([{
      symbol: 'RELIANCE', name: 'Reliance',
      expiry: '2026-06-25', futOpenInterest: 100000, futOIDelta: 0,
      futVolume: 50000, futTurnover: 500, futPrice: 2500, spotPrice: 2480,
      costOfCarry: 0.8, rolloverPercent: 65, timestamp: Date.now() - 3600000,
    }]);
    // Ingest surge
    const signals = source.ingestFutures([{
      symbol: 'RELIANCE', name: 'Reliance',
      expiry: '2026-06-25', futOpenInterest: 130000, futOIDelta: 30000,
      futVolume: 80000, futTurnover: 800, futPrice: 2600, spotPrice: 2580,
      costOfCarry: 0.77, rolloverPercent: 70, timestamp: Date.now(),
    }]);

    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('oi_buildup');
  });

  it('should detect OI unwinding with price drop', () => {
    source.ingestFutures([{
      symbol: 'TCS', name: 'TCS',
      expiry: '2026-06-25', futOpenInterest: 80000, futOIDelta: 0,
      futVolume: 40000, futTurnover: 400, futPrice: 3800, spotPrice: 3820,
      costOfCarry: -0.5, rolloverPercent: 50, timestamp: Date.now() - 3600000,
    }]);
    const signals = source.ingestFutures([{
      symbol: 'TCS', name: 'TCS',
      expiry: '2026-06-25', futOpenInterest: 55000, futOIDelta: -25000,
      futVolume: 70000, futTurnover: 700, futPrice: 3600, spotPrice: 3620,
      costOfCarry: -0.55, rolloverPercent: 45, timestamp: Date.now(),
    }]);

    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('oi_unwinding');
  });

  it('should detect rollover alert', () => {
    const signals = source.ingestFutures([{
      symbol: 'HDFCBANK', name: 'HDFC Bank',
      expiry: '2026-06-25', futOpenInterest: 50000, futOIDelta: 0,
      futVolume: 30000, futTurnover: 300, futPrice: 1600, spotPrice: 1590,
      costOfCarry: 0.6, rolloverPercent: 85, timestamp: Date.now(),
    }]);
    expect(signals.some(s => s.type === 'rollover_alert')).toBe(true);
  });

  it('should ingest options and detect extreme PCR', () => {
    const signals = source.ingestOptions([{
      symbol: 'NIFTY', name: 'Nifty 50',
      expiry: '2026-06-25',
      callOI: 50000, putOI: 80000, callVolume: 20000, putVolume: 32000,
      pcr: 1.6, pcrVolume: 1.6, maxPain: 24000,
      ivCall: 14, ivPut: 16, ivAvg: 15, timestamp: Date.now(),
    }]);
    expect(signals.some(s => s.type === 'pcr_extreme')).toBe(true);
  });

  it('should detect IV spike', () => {
    const signals = source.ingestOptions([{
      symbol: 'BANKNIFTY', name: 'Bank Nifty',
      expiry: '2026-06-25',
      callOI: 30000, putOI: 45000, callVolume: 15000, putVolume: 22000,
      pcr: 1.5, pcrVolume: 1.47, maxPain: 52000,
      ivCall: 38, ivPut: 42, ivAvg: 40, timestamp: Date.now(),
    }]);
    expect(signals.some(s => s.type === 'iv_spike')).toBe(true);
  });

  it('should ingest delivery and detect high delivery %', () => {
    const signals = source.ingestDelivery([{
      symbol: 'INFY', name: 'Infosys',
      date: '2026-06-17', deliveryQty: 8000000, tradedQty: 10000000,
      deliveryPercent: 80, deliveryValue: 1200,
    }]);
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('high_delivery');
  });

  it('should ingest sector indices', () => {
    source.ingestSectors([
      { index: 'NIFTY 50', name: 'Nifty 50', value: 24500, change: 120, changePercent: 0.49, open: 24400, high: 24550, low: 24380, prevClose: 24380, timestamp: Date.now() },
    ]);
    const sectors = source.getSectors();
    expect(sectors.length).toBe(1);
    expect(sectors[0].index).toBe('NIFTY 50');
  });

  it('should generate summary', () => {
    source.ingestFiiDii({
      date: '2026-06-17', fiiGrossBuy: 5000, fiiGrossSell: 2000, fiiNet: 3000,
      diiGrossBuy: 1000, diiGrossSell: 3000, diiNet: -2000,
      fiiIndexFutNet: 500, fiiStockFutNet: 200, fiiIndexOptNet: -100,
    });
    source.ingestFutures([{
      symbol: 'RELIANCE', name: 'Reliance Industries',
      expiry: '2026-06-25', futOpenInterest: 120000, futOIDelta: 5000,
      futVolume: 60000, futTurnover: 600, futPrice: 2550, spotPrice: 2530,
      costOfCarry: 0.79, rolloverPercent: 68, timestamp: Date.now(),
    }]);

    const summary = source.getSummary();
    expect(summary).not.toBeNull();
    expect(summary!.activeFutures).toBeGreaterThanOrEqual(1);
    expect(summary!.fiiDii).not.toBeNull();
  });

  it('should filter signals by type', () => {
    source.ingestFutures([{
      symbol: 'A', name: 'A', expiry: '2026-06-25', futOpenInterest: 100000, futOIDelta: 0,
      futVolume: 10000, futTurnover: 100, futPrice: 1000, spotPrice: 990,
      costOfCarry: 1, rolloverPercent: 50, timestamp: Date.now() - 3600000,
    }]);
    source.ingestFutures([{
      symbol: 'A', name: 'A', expiry: '2026-06-25', futOpenInterest: 130000, futOIDelta: 30000,
      futVolume: 15000, futTurnover: 150, futPrice: 1020, spotPrice: 1010,
      costOfCarry: 1, rolloverPercent: 55, timestamp: Date.now(),
    }]);
    source.ingestFutures([{
      symbol: 'B', name: 'B', expiry: '2026-06-25', futOpenInterest: 200000, futOIDelta: 0,
      futVolume: 20000, futTurnover: 200, futPrice: 500, spotPrice: 495,
      costOfCarry: 1, rolloverPercent: 50, timestamp: Date.now() - 3600000,
    }]);
    source.ingestFutures([{
      symbol: 'B', name: 'B', expiry: '2026-06-25', futOpenInterest: 240000, futOIDelta: 40000,
      futVolume: 25000, futTurnover: 250, futPrice: 510, spotPrice: 505,
      costOfCarry: 1, rolloverPercent: 55, timestamp: Date.now(),
    }]);

    const signals = source.getSignals(undefined, 'oi_buildup');
    expect(signals.length).toBeGreaterThanOrEqual(2);
  });

  it('should return FII flow stats', () => {
    source.ingestFiiDii({
      date: '2026-06-15', fiiGrossBuy: 6000, fiiGrossSell: 3000, fiiNet: 3000,
      diiGrossBuy: 1500, diiGrossSell: 3500, diiNet: -2000,
      fiiIndexFutNet: 0, fiiStockFutNet: 0, fiiIndexOptNet: 0,
    });
    source.ingestFiiDii({
      date: '2026-06-16', fiiGrossBuy: 5000, fiiGrossSell: 2000, fiiNet: 3000,
      diiGrossBuy: 1000, diiGrossSell: 3000, diiNet: -2000,
      fiiIndexFutNet: 0, fiiStockFutNet: 0, fiiIndexOptNet: 0,
    });

    const stats = source.getFiiFlowStats(2);
    expect(stats.totalFiiNet).toBe(6000);
    expect(stats.streak.days).toBeGreaterThanOrEqual(2);
  });

  it('should get tracked symbols', () => {
    source.ingestFutures([{
      symbol: 'A', name: 'A', expiry: '2026-06-25', futOpenInterest: 1000, futOIDelta: 0,
      futVolume: 100, futTurnover: 10, futPrice: 100, spotPrice: 99,
      costOfCarry: 1, rolloverPercent: 50, timestamp: Date.now(),
    }]);
    source.ingestFutures([{
      symbol: 'B', name: 'B', expiry: '2026-06-25', futOpenInterest: 2000, futOIDelta: 0,
      futVolume: 200, futTurnover: 20, futPrice: 200, spotPrice: 198,
      costOfCarry: 1, rolloverPercent: 50, timestamp: Date.now(),
    }]);
    expect(source.getTrackedSymbols().length).toBe(2);
  });

  it('should return null summary when empty', () => {
    expect(source.getSummary()).toBeNull();
  });

  it('should get FII/DII history', () => {
    source.ingestFiiDii({
      date: '2026-06-17', fiiGrossBuy: 3000, fiiGrossSell: 1000, fiiNet: 2000,
      diiGrossBuy: 1000, diiGrossSell: 2000, diiNet: -1000,
      fiiIndexFutNet: 0, fiiStockFutNet: 0, fiiIndexOptNet: 0,
    });
    expect(source.getFiiDii(30).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KrxTwseDataSource Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R273 KrxTwseDataSource', () => {
  let source: KrxTwseDataSource;

  beforeEach(() => { source = new KrxTwseDataSource(); });

  it('should ingest KRX institutional flow', () => {
    const signals = source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200',
      market: 'KRX', date: '2026-06-17',
      foreignNet: 1500, foreignBuy: 5000, foreignSell: 3500,
      invTrustNet: 500, invTrustBuy: 2000, invTrustSell: 1500,
      dealerNet: -200, dealerBuy: 1000, dealerSell: 1200,
      totalNet: 1800,
    });
    expect(signals.length).toBe(0); // need history for surge detection
    expect(source.getFlow('KRX', 1).length).toBe(1);
  });

  it('should detect foreign surge after history', () => {
    // Build 6 days of normal flow
    for (let i = 1; i <= 6; i++) {
      source.ingestFlow('KRX', {
        symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
        date: `2026-06-${10 + i}`,
        foreignNet: 500, foreignBuy: 3000, foreignSell: 2500,
        invTrustNet: 100, invTrustBuy: 1000, invTrustSell: 900,
        dealerNet: -50, dealerBuy: 800, dealerSell: 850,
        totalNet: 550,
      });
    }
    // Now surge
    const signals = source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-17',
      foreignNet: 3000, foreignBuy: 8000, foreignSell: 5000,
      invTrustNet: 200, invTrustBuy: 1500, invTrustSell: 1300,
      dealerNet: -100, dealerBuy: 900, dealerSell: 1000,
      totalNet: 3100,
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('foreign_surge');
  });

  it('should detect foreign exit', () => {
    for (let i = 1; i <= 6; i++) {
      source.ingestFlow('TWSE', {
        symbol: 'TAIEX', name: 'TAIEX', market: 'TWSE',
        date: `2026-06-${10 + i}`,
        foreignNet: 300, foreignBuy: 2000, foreignSell: 1700,
        invTrustNet: 100, invTrustBuy: 800, invTrustSell: 700,
        dealerNet: 50, dealerBuy: 600, dealerSell: 550,
        totalNet: 450,
      });
    }
    const signals = source.ingestFlow('TWSE', {
      symbol: 'TAIEX', name: 'TAIEX', market: 'TWSE',
      date: '2026-06-17',
      foreignNet: -2500, foreignBuy: 1000, foreignSell: 3500,
      invTrustNet: -100, invTrustBuy: 500, invTrustSell: 600,
      dealerNet: -50, dealerBuy: 400, dealerSell: 450,
      totalNet: -2650,
    });
    expect(signals.some(s => s.type === 'foreign_exit')).toBe(true);
  });

  it('should detect divergence', () => {
    // Foreign buys, dealer sells simultaneously
    for (let i = 1; i <= 6; i++) {
      source.ingestFlow('KRX', {
        symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
        date: `2026-06-${10 + i}`,
        foreignNet: 100, foreignBuy: 2000, foreignSell: 1900,
        invTrustNet: 100, invTrustBuy: 1000, invTrustSell: 900,
        dealerNet: 50, dealerBuy: 800, dealerSell: 750,
        totalNet: 250,
      });
    }
    const signals = source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-17',
      foreignNet: 2000, foreignBuy: 5000, foreignSell: 3000,
      invTrustNet: 100, invTrustBuy: 1000, invTrustSell: 900,
      dealerNet: -1000, dealerBuy: 500, dealerSell: 1500,
      totalNet: 1100,
    });
    expect(signals.some(s => s.type === 'divergence')).toBe(true);
  });

  it('should detect OI flip', () => {
    source.ingestFuturesOI('KRX', {
      symbol: 'KOSPI200', market: 'KRX', date: '2026-06-16',
      longOI: 8000, shortOI: 3000, netOI: 5000, oiChange: 0,
    });
    const signals = source.ingestFuturesOI('KRX', {
      symbol: 'KOSPI200', market: 'KRX', date: '2026-06-17',
      longOI: 2000, shortOI: 10000, netOI: -8000, oiChange: -13000,
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('oi_flip');
    expect(signals[0].severity).toBe('critical');
  });

  it('should handle OI flip back to long', () => {
    source.ingestFuturesOI('TWSE', {
      symbol: 'TAIEX_FUT', market: 'TWSE', date: '2026-06-16',
      longOI: 2000, shortOI: 12000, netOI: -10000, oiChange: 0,
    });
    const signals = source.ingestFuturesOI('TWSE', {
      symbol: 'TAIEX_FUT', market: 'TWSE', date: '2026-06-17',
      longOI: 15000, shortOI: 3000, netOI: 12000, oiChange: 22000,
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
  });

  it('should ingest margin data', () => {
    const signals = source.ingestMargin('KRX', {
      symbol: 'KOSPI', market: 'KRX', date: '2026-06-17',
      marginBuyBalance: 8000, marginSellBalance: 100,
      marginBuyNew: 500, marginSellNew: 20,
      marginBuyRepay: 300, marginSellRepay: 10,
      marginRatio: 80, shortRatio: 1.2,
    });
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].type).toBe('margin_extreme');
  });

  it('should ingest TWSE margin', () => {
    source.ingestMargin('TWSE', {
      symbol: 'TAIEX', market: 'TWSE', date: '2026-06-17',
      marginBuyBalance: 150000, marginSellBalance: 800000,
      marginBuyNew: 10000, marginSellNew: 5000,
      marginBuyRepay: 8000, marginSellRepay: 3000,
      marginRatio: 0.1875, shortRatio: 84.2,
    });
    expect(source.getMargin('TWSE', 1).length).toBe(1);
  });

  it('should ingest market index', () => {
    source.ingestIndex({
      index: 'KOSPI', name: 'KOSPI', market: 'KRX',
      value: 2700, change: 15, changePercent: 0.56,
      open: 2690, high: 2710, low: 2685, prevClose: 2685,
      volume: 500000, turnover: 10000000, timestamp: Date.now(),
    });
    const idx = source.getIndex('KRX');
    expect(idx).not.toBeNull();
  });

  it('should compare markets', () => {
    source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-17', foreignNet: 1500, foreignBuy: 5000, foreignSell: 3500,
      invTrustNet: 500, invTrustBuy: 2000, invTrustSell: 1500,
      dealerNet: -200, dealerBuy: 1000, dealerSell: 1200, totalNet: 1800,
    });
    source.ingestFlow('TWSE', {
      symbol: 'TAIEX', name: 'TAIEX', market: 'TWSE',
      date: '2026-06-17', foreignNet: -800, foreignBuy: 3000, foreignSell: 3800,
      invTrustNet: 200, invTrustBuy: 1000, invTrustSell: 800,
      dealerNet: 300, dealerBuy: 1200, dealerSell: 900, totalNet: -300,
    });
    const cmp = source.compareMarkets();
    expect(cmp.krx.foreignNet).toBe(1500);
    expect(cmp.twse.foreignNet).toBe(-800);
  });

  it('should get foreign streak', () => {
    source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-15', foreignNet: 1000, foreignBuy: 3000, foreignSell: 2000,
      invTrustNet: 0, invTrustBuy: 0, invTrustSell: 0,
      dealerNet: 0, dealerBuy: 0, dealerSell: 0, totalNet: 1000,
    });
    source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-16', foreignNet: 800, foreignBuy: 2500, foreignSell: 1700,
      invTrustNet: 0, invTrustBuy: 0, invTrustSell: 0,
      dealerNet: 0, dealerBuy: 0, dealerSell: 0, totalNet: 800,
    });
    source.ingestFlow('KRX', {
      symbol: 'KOSPI200', name: 'KOSPI 200', market: 'KRX',
      date: '2026-06-17', foreignNet: 1500, foreignBuy: 4000, foreignSell: 2500,
      invTrustNet: 0, invTrustBuy: 0, invTrustSell: 0,
      dealerNet: 0, dealerBuy: 0, dealerSell: 0, totalNet: 1500,
    });
    const streak = source.getForeignStreak('KRX');
    expect(streak.direction).toBe('buy');
    expect(streak.days).toBe(3);
  });

  it('should generate summary', () => {
    source.ingestIndex({
      index: 'TAIEX', name: 'TAIEX', market: 'TWSE',
      value: 22000, change: 100, changePercent: 0.46,
      open: 21950, high: 22050, low: 21930, prevClose: 21900,
      volume: 3000000, turnover: 250000, timestamp: Date.now(),
    });
    source.ingestFlow('TWSE', {
      symbol: 'TAIEX', name: 'TAIEX', market: 'TWSE',
      date: '2026-06-17', foreignNet: 500, foreignBuy: 3000, foreignSell: 2500,
      invTrustNet: 200, invTrustBuy: 1000, invTrustSell: 800,
      dealerNet: 100, dealerBuy: 800, dealerSell: 700, totalNet: 800,
    });

    const summary = source.getSummary();
    expect(summary).not.toBeNull();
    expect(summary!.twseIndex).not.toBeNull();
    expect(summary!.twseFlow).not.toBeNull();
  });

  it('should return null summary when empty', () => {
    expect(source.getSummary()).toBeNull();
  });

  it('should return empty signals for unknown type', () => {
    expect(source.getSignals('KRX', 'oi_flip').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FxDataSource Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R273 FxDataSource', () => {
  let source: FxDataSource;

  beforeEach(() => { source = new FxDataSource(); });

  it('should ingest FX rate and return correct structure', () => {
    const rate = source.ingestRate({
      base: 'EUR', quote: 'USD',
      rate: 1.0850, bid: 1.0849, ask: 1.0851,
      change: 0.0010, changePercent: 0.09,
      open: 1.0840, high: 1.0855, low: 1.0835, prevClose: 1.0840,
      timestamp: Date.now(),
    });
    expect(rate.pair).toBe('EUR/USD');
    expect(rate.spread).toBeCloseTo(0.0002, 4);
    expect(rate.spreadPercent).toBeCloseTo(0.0184, 1); // (0.0002/1.085)*100 ≈ 0.0184
  });

  it('should bulk ingest snapshot', () => {
    const rates = source.ingestSnapshot([
      { base: 'EUR', quote: 'USD', rate: 1.0850, bid: 1.0849, ask: 1.0851, change: 0.001, changePercent: 0.09, open: 1.0840, high: 1.0855, low: 1.0835, prevClose: 1.0840, timestamp: Date.now() },
      { base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52, change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30, timestamp: Date.now() },
      { base: 'GBP', quote: 'USD', rate: 1.2700, bid: 1.2698, ask: 1.2702, change: -0.002, changePercent: -0.16, open: 1.2720, high: 1.2730, low: 1.2695, prevClose: 1.2720, timestamp: Date.now() },
    ]);
    expect(rates.length).toBe(3);
  });

  it('should get rate by pair', () => {
    source.ingestRate({
      base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52,
      change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30,
      timestamp: Date.now(),
    });
    const rate = source.getRate('USD/JPY');
    expect(rate).toBeDefined();
    expect(rate!.rate).toBe(150.50);
  });

  it('should compute inverse rate', () => {
    source.ingestRate({
      base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52,
      change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30,
      timestamp: Date.now(),
    });
    const inv = source.getRate('JPY/USD');
    expect(inv).toBeDefined();
    expect(inv!.rate).toBeCloseTo(1 / 150.50, 6);
  });

  it('should cross-calculate via USD', () => {
    source.ingestRate({
      base: 'USD', quote: 'EUR', rate: 0.9217, bid: 0.9216, ask: 0.9218,
      change: 0.001, changePercent: 0.11, open: 0.9207, high: 0.9220, low: 0.9205, prevClose: 0.9207,
      timestamp: Date.now(),
    });
    source.ingestRate({
      base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52,
      change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30,
      timestamp: Date.now(),
    });
    const cross = source.getRate('EUR/JPY');
    expect(cross).toBeDefined();
    // EUR/JPY = (1/0.9217)*150.50 ≈ 163.3
    expect(cross!.rate).toBeGreaterThan(160);
  });

  it('should return undefined for unknown pair', () => {
    expect(source.getRate('XYZ/ABC')).toBeUndefined();
  });

  it('should get FX snapshot', () => {
    source.ingestSnapshot([
      { base: 'EUR', quote: 'USD', rate: 1.0850, bid: 1.0849, ask: 1.0851, change: 0.001, changePercent: 0.09, open: 1.0840, high: 1.0855, low: 1.0835, prevClose: 1.0840, timestamp: Date.now() },
      { base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52, change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30, timestamp: Date.now() },
    ]);
    const snap = source.getSnapshot();
    expect(snap.rates.length).toBe(2);
    expect(snap.usdIndex).toBeGreaterThan(0);
    expect(snap.strongest).toBeDefined();
    expect(snap.weakest).toBeDefined();
  });

  it('should convert currency', () => {
    source.ingestRate({
      base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52,
      change: 0.20, changePercent: 0.13, open: 150.30, high: 150.60, low: 150.25, prevClose: 150.30,
      timestamp: Date.now(),
    });
    const conv = source.convert('USD', 'JPY', 10000);
    expect(conv).not.toBeNull();
    expect(conv!.fromAmount).toBe(10000);
    expect(conv!.toAmount).toBeGreaterThan(1504000); // ~1,504,250 after fee
    expect(conv!.fee).toBe(5); // 0.05% of 10000
  });

  it('should calculate volatility', () => {
    // Ingest 30 data points for EUR/USD
    for (let i = 0; i < 30; i++) {
      const base = 1.0800;
      const noise = (Math.random() - 0.5) * 0.01;
      const rate = base + noise;
      source.ingestRate({
        base: 'EUR', quote: 'USD', rate, bid: rate - 0.0001, ask: rate + 0.0001,
        change: 0, changePercent: 0, open: rate, high: rate + 0.001, low: rate - 0.001, prevClose: rate,
        timestamp: Date.now() - (30 - i) * 3600000,
      });
    }
    const vol = source.getVolatility('EUR/USD');
    expect(vol).not.toBeNull();
    expect(vol!.daily).toBeGreaterThanOrEqual(0);
    expect(vol!.annualized).toBeGreaterThanOrEqual(0);
  });

  it('should return null volatility for insufficient data', () => {
    source.ingestRate({
      base: 'EUR', quote: 'USD', rate: 1.0850, bid: 1.0849, ask: 1.0851,
      change: 0, changePercent: 0, open: 1.0850, high: 1.0855, low: 1.0845, prevClose: 1.0850,
      timestamp: Date.now(),
    });
    expect(source.getVolatility('EUR/USD')).toBeNull();
  });

  it('should detect triangular arbitrage', () => {
    source.ingestRate({
      base: 'EUR', quote: 'USD', rate: 1.0850, bid: 1.0849, ask: 1.0851,
      change: 0, changePercent: 0, open: 1.0850, high: 1.0850, low: 1.0850, prevClose: 1.0850,
      timestamp: Date.now(),
    });
    source.ingestRate({
      base: 'USD', quote: 'JPY', rate: 150.50, bid: 150.48, ask: 150.52,
      change: 0, changePercent: 0, open: 150.50, high: 150.50, low: 150.50, prevClose: 150.50,
      timestamp: Date.now(),
    });
    source.ingestRate({
      base: 'JPY', quote: 'EUR', rate: 0.00612, bid: 0.00611, ask: 0.00613,
      change: 0, changePercent: 0, open: 0.00612, high: 0.00612, low: 0.00612, prevClose: 0.00612,
      timestamp: Date.now(),
    });

    const arbs = source.detectArbitrage();
    expect(arbs.length).toBeGreaterThan(0);
  });

  it('should compute correlation matrix', () => {
    const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD'];
    // Build correlated data
    for (let t = 0; t < 30; t++) {
      const baseEur = 1.0850 + (Math.random() - 0.5) * 0.02;
      const baseGbp = 1.2700 + (Math.random() - 0.5) * 0.02;
      source.ingestRate({
        base: 'EUR', quote: 'USD', rate: baseEur, bid: baseEur - 0.0001, ask: baseEur + 0.0001,
        change: 0, changePercent: 0, open: baseEur, high: baseEur, low: baseEur, prevClose: baseEur,
        timestamp: Date.now() - (30 - t) * 3600000,
      });
      source.ingestRate({
        base: 'GBP', quote: 'USD', rate: baseGbp, bid: baseGbp - 0.0001, ask: baseGbp + 0.0001,
        change: 0, changePercent: 0, open: baseGbp, high: baseGbp, low: baseGbp, prevClose: baseGbp,
        timestamp: Date.now() - (30 - t) * 3600000,
      });
      source.ingestRate({
        base: 'USD', quote: 'JPY', rate: 150.5 + (Math.random() - 0.5) * 1.0, bid: 150.49, ask: 150.51,
        change: 0, changePercent: 0, open: 150.5, high: 150.5, low: 150.5, prevClose: 150.5,
        timestamp: Date.now() - (30 - t) * 3600000,
      });
    }

    const matrix = source.getCorrelationMatrix(pairs);
    expect(matrix.length).toBeGreaterThan(0);
    for (const c of matrix) {
      expect(c.correlation).toBeGreaterThanOrEqual(-1);
      expect(c.correlation).toBeLessThanOrEqual(1);
    }
  });

  it('should get all volatilities', () => {
    const pairs = ['EUR/USD', 'USD/JPY', 'GBP/USD'];
    for (let t = 0; t < 30; t++) {
      source.ingestSnapshot(pairs.map(p => {
        const [base, quote] = p.split('/') as [any, any];
        const rate = 1 + (Math.random() - 0.5) * 0.05;
        return { base, quote, rate, bid: rate - 0.0001, ask: rate + 0.0001, change: 0, changePercent: 0, open: rate, high: rate, low: rate, prevClose: rate, timestamp: Date.now() - (30 - t) * 3600000 };
      }));
    }
    const vols = source.getAllVolatilities();
    expect(vols.length).toBeGreaterThanOrEqual(3);
  });

  it('should get currency metadata', () => {
    const meta = source.getCurrencyMeta('INR');
    expect(meta.name).toBe('Indian Rupee');
    expect(meta.region).toBe('Asia');
  });

  it('should get supported currencies', () => {
    expect(source.getSupportedCurrencies().length).toBeGreaterThanOrEqual(24);
  });

  it('should get stats', () => {
    source.ingestSnapshot([
      { base: 'EUR', quote: 'USD', rate: 1.085, bid: 1.0849, ask: 1.0851, change: 0, changePercent: 0, open: 1.085, high: 1.085, low: 1.085, prevClose: 1.085, timestamp: Date.now() },
      { base: 'USD', quote: 'JPY', rate: 150.5, bid: 150.49, ask: 150.51, change: 0, changePercent: 0, open: 150.5, high: 150.5, low: 150.5, prevClose: 150.5, timestamp: Date.now() },
    ]);
    const stats = source.getStats();
    expect(stats.activePairs).toBe(2);
    expect(stats.currenciesCovered).toBeGreaterThanOrEqual(24);
    expect(stats.regionsCovered).toBeGreaterThanOrEqual(4);
  });

  it('should return null conversion for unknown pair', () => {
    expect(source.convert('XYZ', 'ABC', 100)).toBeNull();
  });
});
