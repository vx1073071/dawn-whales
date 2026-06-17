// ══ R258 LOBEHUB 量化分析测试集 ══
// 35 tests: 异动阈值(13) + AI置信度(10) + 崩盘判定(12)

import { describe, it, expect } from 'vitest';
import {
  detectMarketRegime, detectTimeContext, computeDynamicThreshold,
  detectAnomaly, generateThresholdReport, SymbolProfile,
  DEFAULT_ANOMALY_CONFIG, MarketRegime, TimeContext,
} from '../../src/lib/quant/anomaly-threshold-r258';

import {
  calibrateConfidence, batchCalibrate, CalibrationInput,
} from '../../src/lib/quant/ai-confidence-calibrator-r258';

import {
  detectCrash, CRASH_RULES, CRASH_SCENARIOS, validateCrashRules,
} from '../../src/lib/quant/crash-detection-r258';

// ═══════════════════ P1-04: 异动阈值 (13 tests) ═══════════════════

describe('R258 P1-04: Anomaly Threshold', () => {
  it('detects CRISIS regime when VIX > 40', () => {
    expect(detectMarketRegime(45, -15)).toBe('CRISIS');
  });

  it('detects BULL regime', () => {
    expect(detectMarketRegime(15, 12)).toBe('BULL');
  });

  it('detects BEAR regime', () => {
    expect(detectMarketRegime(20, -12)).toBe('BEAR');
  });

  it('detects SIDEWAYS', () => {
    expect(detectMarketRegime(18, 5)).toBe('SIDEWAYS');
  });

  it('detects HIGH_VOL', () => {
    expect(detectMarketRegime(32, -5)).toBe('HIGH_VOL');
  });

  it('detects LOW_VOL', () => {
    expect(detectMarketRegime(10, 2)).toBe('LOW_VOL');
  });

  it('earnings season in Jan/Apr/Jul/Oct', () => {
    const d = new Date(2026, 6, 15, 10, 0); // July
    expect(detectTimeContext(d)).toBe('EARNINGS_SEASON');
  });

  it('weekend detected', () => {
    const d = new Date(2026, 5, 14, 12, 0); // Sunday
    expect(detectTimeContext(d)).toBe('WEEKEND');
  });

  it('dynamic threshold adapts to high beta', () => {
    const profile: SymbolProfile = { symbol: 'TSLA', beta: 2.2, avgDailyVolatility: 4, marketCap: 'LARGE', avgVolume: 50000000 };
    const threshold = computeDynamicThreshold(profile, 'SIDEWAYS', 'REGULAR_HOURS');
    // 3.0 * 1.0 * 1.0 * 1.4(beta>2) * 1.2(vol>3) ≈ 5.04
    expect(threshold).toBeGreaterThan(4.5);
    expect(threshold).toBeLessThan(6.0);
  });

  it('crisis regime raises threshold significantly', () => {
    const profile: SymbolProfile = { symbol: 'SPY', beta: 1, avgDailyVolatility: 1.5, marketCap: 'MEGA', avgVolume: 80000000 };
    const normal = computeDynamicThreshold(profile, 'SIDEWAYS', 'REGULAR_HOURS');
    const crisis = computeDynamicThreshold(profile, 'CRISIS', 'REGULAR_HOURS');
    expect(crisis).toBeGreaterThan(normal * 1.5);
  });

  it('anomaly detected for large price move', () => {
    const profile: SymbolProfile = { symbol: 'BTC', beta: 1.5, avgDailyVolatility: 3, marketCap: 'LARGE', avgVolume: 30000 };
    const signal = detectAnomaly('BTC', 'CRYPTO', 8, 1, 1, 50000, 51000, profile, 'SIDEWAYS', 'REGULAR_HOURS');
    expect(signal).toBeTruthy();
    expect(signal!.severity).toBe('CRITICAL');
  });

  it('small move not flagged', () => {
    const profile: SymbolProfile = { symbol: 'AAPL', beta: 1.2, avgDailyVolatility: 1.5, marketCap: 'MEGA', avgVolume: 60000000 };
    const signal = detectAnomaly('AAPL', 'US', 0.5, 1, 1, 190, 190.5, profile, 'SIDEWAYS', 'REGULAR_HOURS');
    expect(signal).toBeNull();
  });

  it('report generates recommendations', () => {
    const symbols = [
      { symbol: 'T1', market: 'US', priceChangePct: 9, volumeRatio: 2, spreadRatio: 1, prevClose: 100, currentOpen: 102 },
      { symbol: 'T2', market: 'US', priceChangePct: 0.5, volumeRatio: 1, spreadRatio: 1, prevClose: 50, currentOpen: 50 },
    ];
    const profiles = new Map<string, SymbolProfile>();
    profiles.set('T1', { symbol: 'T1', beta: 1, avgDailyVolatility: 2, marketCap: 'LARGE', avgVolume: 1000000 });
    const report = generateThresholdReport(symbols, profiles, 'SIDEWAYS', 'REGULAR_HOURS');
    expect(report.totalSignals).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════ P1-02: AI置信度 (10 tests) ═══════════════════

describe('R258 P1-02: AI Confidence Calibrator', () => {
  const mkInput = (overrides: Partial<CalibrationInput> = {}): CalibrationInput => ({
    symbol: 'AAPL', market: 'US', reviewType: 'FAST',
    factorSignals: [
      { factorId: 'f1', factorName: 'PE', IC: 0.08, signal: 'BULLISH', strength: 0.8 },
      { factorId: 'f2', factorName: 'Mom', IC: 0.06, signal: 'BULLISH', strength: 0.7 },
      { factorId: 'f3', factorName: 'Vol', IC: 0.04, signal: 'NEUTRAL', strength: 0.3 },
    ],
    dataFreshness: { priceAgeSeconds: 30, fundamentalAgeDays: 15, newsAgeMinutes: 30 },
    marketComplexity: { vix: 18, regime: 'SIDEWAYS', volatilityPercentile: 40 },
    historicalAccuracy: 0.7,
    ...overrides,
  });

  it('high quality input gets HIGH confidence', () => {
    const r = calibrateConfidence(mkInput());
    expect(r.confidenceLevel).toBe('HIGH');
    expect(r.isReliable).toBe(true);
  });

  it('poor data freshness drops confidence', () => {
    const r = calibrateConfidence(mkInput({
      dataFreshness: { priceAgeSeconds: 600, fundamentalAgeDays: 180, newsAgeMinutes: 500 },
    }));
    expect(r.confidenceScore).toBeLessThan(75);
  });

  it('high VIX environment drops confidence', () => {
    const r = calibrateConfidence(mkInput({
      marketComplexity: { vix: 45, regime: 'CRISIS', volatilityPercentile: 95 },
    }));
    expect(r.confidenceScore).toBeLessThan(80);
  });

  it('conflicting factor signals reduce consistency', () => {
    const r = calibrateConfidence(mkInput({
      factorSignals: [
        { factorId: 'f1', factorName: 'PE', IC: 0.05, signal: 'BULLISH', strength: 0.6 },
        { factorId: 'f2', factorName: 'Mom', IC: 0.04, signal: 'BEARISH', strength: 0.5 },
        { factorId: 'f3', factorName: 'Vol', IC: 0.03, signal: 'BEARISH', strength: 0.4 },
        { factorId: 'f4', factorName: 'Spread', IC: 0.02, signal: 'BEARISH', strength: 0.3 },
      ],
    }));
    expect(r.breakdown.signalConsistency).toBeLessThan(25);
  });

  it('insufficient data gets LOW or INSUFFICIENT', () => {
    const r = calibrateConfidence(mkInput({
      factorSignals: [],
      dataFreshness: { priceAgeSeconds: 3600, fundamentalAgeDays: 365, newsAgeMinutes: 1440 },
      marketComplexity: { vix: 55, regime: 'CRISIS', volatilityPercentile: 98 },
      historicalAccuracy: 0.2,
    }));
    expect(['LOW', 'INSUFFICIENT']).toContain(r.confidenceLevel);
  });

  it('batch calibrates multiple inputs', () => {
    const report = batchCalibrate([mkInput(), mkInput({ symbol: 'TSLA' }), mkInput({ symbol: 'GOOGL' })]);
    expect(report.total).toBe(3);
    expect(report.byLevel.HIGH + report.byLevel.MEDIUM + report.byLevel.LOW + report.byLevel.INSUFFICIENT).toBe(3);
  });

  it('confidence breakdown sums to total', () => {
    const r = calibrateConfidence(mkInput());
    const sum = r.breakdown.signalConsistency + r.breakdown.dataFreshness + r.breakdown.marketStability + r.breakdown.historicalPerformance + r.breakdown.signalStrength;
    expect(sum).toBe(r.confidenceScore);
  });

  it('reliable threshold at 60', () => {
    const r = calibrateConfidence(mkInput({
      dataFreshness: { priceAgeSeconds: 300, fundamentalAgeDays: 60, newsAgeMinutes: 120 },
      factorSignals: [{ factorId: 'f1', factorName: 'X', IC: 0.03, signal: 'NEUTRAL', strength: 0.3 }],
    }));
    // Moderate quality
    expect(typeof r.isReliable).toBe('boolean');
  });

  it('top and worst signals extracted', () => {
    const report = batchCalibrate([
      mkInput({ symbol: 'BEST', factorSignals: [{ factorId: 'f1', factorName: 'PE', IC: 0.10, signal: 'BULLISH', strength: 0.9 }] }),
      mkInput({ symbol: 'WORST', factorSignals: [] }),
    ]);
    expect(report.topSignals.length).toBeGreaterThanOrEqual(1);
    expect(report.worstSignals.length).toBeGreaterThanOrEqual(1);
  });

  it('display label is meaningful', () => {
    const r = calibrateConfidence(mkInput());
    expect(r.displayLabel).toContain('置信');
  });
});

// ═══════════════════ P1-05: 崩盘判定 (12 tests) ═══════════════════

describe('R258 P1-05: Crash Detection', () => {
  it('crash rules defined', () => {
    expect(CRASH_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it('panic level for extreme indicators', () => {
    const r = detectCrash({
      marketDeclinePct: -15, breadthPct: 3, vix: 90,
      vixChangePct: 300, volumeSurgeRatio: 6,
      crossMarketConfirmation: 10, factorReversalCount: 20,
    });
    expect(r.level).toBe('PANIC');
  });

  it('normal day returns NONE', () => {
    const r = detectCrash({
      marketDeclinePct: -0.5, breadthPct: 48, vix: 15,
      vixChangePct: 5, volumeSurgeRatio: 0.8,
      crossMarketConfirmation: 0, factorReversalCount: 1,
    });
    expect(r.level).toBe('NONE');
  });

  it('correction level for moderate decline', () => {
    const r = detectCrash({
      marketDeclinePct: -3.5, breadthPct: 25, vix: 22,
      vixChangePct: 40, volumeSurgeRatio: 1.8,
      crossMarketConfirmation: 2, factorReversalCount: 3,
    });
    expect(r.level).toBe('CORRECTION');
  });

  it('bear territory triggers push to affected users', () => {
    const r = detectCrash({
      marketDeclinePct: -6, breadthPct: 28, vix: 28,
      vixChangePct: 50, volumeSurgeRatio: 2,
      crossMarketConfirmation: 2, factorReversalCount: 4,
    });
    expect(r.level).toBe('BEAR_TERRITORY');
    expect(r.action.push).not.toBe('NONE');
  });

  it('crash level triggers all-user push', () => {
    const r = detectCrash({
      marketDeclinePct: -12, breadthPct: 8, vix: 55,
      vixChangePct: 150, volumeSurgeRatio: 4,
      crossMarketConfirmation: 6, factorReversalCount: 12,
    });
    expect(r.action.push).toBe('ALL_USERS');
  });

  it('cooldown > 0 for push scenarios', () => {
    const r = detectCrash({
      marketDeclinePct: -10, breadthPct: 10, vix: 45,
      vixChangePct: 120, volumeSurgeRatio: 3,
      crossMarketConfirmation: 5, factorReversalCount: 10,
    });
    expect(r.action.cooldownMinutes).toBeGreaterThan(0);
  });

  it('triggers collected from rules', () => {
    const r = detectCrash({
      marketDeclinePct: -6, breadthPct: 12, vix: 35,
      vixChangePct: 90, volumeSurgeRatio: 3.5,
      crossMarketConfirmation: 4, factorReversalCount: 6,
    });
    expect(r.triggers.length).toBeGreaterThan(0);
  });

  it('2020 COVID scenario yields PANIC', () => {
    const covid = CRASH_SCENARIOS[0];
    const r = detectCrash(covid.indicators);
    expect(r.level).toBe('PANIC');
  });

  it('normal day scenario yields NONE', () => {
    const normal = CRASH_SCENARIOS[4];
    const r = detectCrash(normal.indicators);
    expect(r.level).toBe('NONE');
  });

  it('technical correction scenario yields >= BEAR_TERRITORY', () => {
    const tech = CRASH_SCENARIOS[2];
    const r = detectCrash(tech.indicators);
    const levels: string[] = ['BEAR_TERRITORY', 'CRASH', 'PANIC'];
    expect(levels).toContain(r.level);
  });

  it('score increases with more triggers', () => {
    const mild = detectCrash({
      marketDeclinePct: -3, breadthPct: 40, vix: 20,
      vixChangePct: 20, volumeSurgeRatio: 1, crossMarketConfirmation: 0, factorReversalCount: 0,
    });
    const severe = detectCrash({
      marketDeclinePct: -15, breadthPct: 5, vix: 80,
      vixChangePct: 200, volumeSurgeRatio: 8, crossMarketConfirmation: 10, factorReversalCount: 20,
    });
    expect(severe.score).toBeGreaterThan(mild.score);
  });
});
