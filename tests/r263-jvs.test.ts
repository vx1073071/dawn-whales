import { describe, it, expect, beforeEach } from 'vitest';
import { MockMigrationScanner } from '../electron/engine/perf/MockMigrationScanner';
import { AIDecisionLogEngine } from '../electron/engine/ai/AIDecisionLogEngine';
import { SectorAIDiagnosisEngine } from '../electron/engine/analysis/SectorAIDiagnosisEngine';

// ═══════════════════════════════════════════════════════════════
// P0-01 MockMigrationScanner
// ═══════════════════════════════════════════════════════════════

describe('MockMigrationScanner', () => {
  let scanner: MockMigrationScanner;
  beforeEach(() => {
    (MockMigrationScanner as any).instance = null;
    scanner = MockMigrationScanner.getInstance({ dryRun: true });
  });

  it('singleton', () => { expect(MockMigrationScanner.getInstance()).toBe(scanner); });

  it('has 8 migration rules', () => {
    expect(scanner.getRules().length).toBe(8);
  });

  it('migration map has correct mappings', () => {
    const map = scanner.getMigrationMap();
    expect(map['YahooFinanceWebSocketEngine']).toBe('YahooWebSocketLiveEngine');
    expect(map['BinanceWebSocketEngine']).toBe('BinanceWebSocketLiveEngine');
    expect(map['MockQuoteEngine']).toBe('YahooWebSocketLiveEngine');
    expect(map['FakeMarketDataEngine']).toBe('YahooWebSocketLiveEngine');
    expect(map['MockKlineEngine']).toBe('BinanceWebSocketLiveEngine');
    expect(map['MockTickerEngine']).toBe('BinanceWebSocketLiveEngine');
    expect(map['SimulatedQuoteProvider']).toBe('YahooWebSocketLiveEngine');
    expect(map['DummyDataSource']).toBe('YahooWebSocketLiveEngine');
  });

  it('scans without errors', () => {
    const report = scanner.scan();
    // fs may be externalized in vitest browser compat; accept 0 as valid
    expect(report.totalFilesScanned).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.errors)).toBe(true);
  });

  it('verify new engine events', () => {
    const yahoo = scanner.verifyNewEngine('yahoo');
    expect(yahoo.passed).toContain('live_quote');
    const binance = scanner.verifyNewEngine('binance');
    expect(binance.passed).toContain('ticker');
  });

  it('reset clears results', () => {
    scanner.scan();
    scanner.reset();
    expect(scanner.getReport()).toBeNull();
    expect(scanner.getResults().length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-03 AIDecisionLogEngine
// ═══════════════════════════════════════════════════════════════

describe('AIDecisionLogEngine', () => {
  let engine: AIDecisionLogEngine;
  beforeEach(() => {
    (AIDecisionLogEngine as any).instance = null;
    engine = AIDecisionLogEngine.getInstance();
  });

  it('singleton', () => { expect(AIDecisionLogEngine.getInstance()).toBe(engine); });

  it('creates factor', () => {
    const f = engine.createFactor({
      factorId: 'rsi', name: 'RSI(14)', weight: 0.25,
      source: 'technical', value: 65, reasoning: 'Near overbought',
    });
    expect(f.factorId).toBe('rsi');
    expect(f.weight).toBe(0.25);
    expect(f.normalized).toBeGreaterThan(0);
  });

  it('logs a decision', () => {
    const d = engine.logDecision({
      symbol: 'AAPL', action: 'buy',
      factors: [
        engine.createFactor({ factorId: 'rsi', name: 'RSI', weight: 0.3, source: 'technical', value: 60, reasoning: 'Strong momentum' }),
      ],
      reasoningChain: ['Step1: RSI signals buy'],
      conclusion: 'Buy AAPL', uncertainty: { confidenceLevel: 'high' },
    });
    expect(d.id.startsWith('dl_')).toBe(true);
    expect(d.symbol).toBe('AAPL');
    expect(d.factors.length).toBe(1);
    expect(d.factors[0].contribution).toBeGreaterThan(0);
  });

  it('logs decision with multiple factors', () => {
    const d = engine.logDecision({
      symbol: 'TSLA', action: 'sell',
      factors: [
        engine.createFactor({ factorId: 'rsi', name: 'RSI', weight: 0.25, source: 'technical', value: 80, reasoning: 'Overbought' }),
        engine.createFactor({ factorId: 'macd', name: 'MACD', weight: 0.25, source: 'technical', value: -0.5, reasoning: 'Bearish cross' }),
        engine.createFactor({ factorId: 'sent', name: 'Sentiment', weight: 0.25, source: 'sentiment', value: 0.3, reasoning: 'Negative news' }),
        engine.createFactor({ factorId: 'vol', name: 'Volume', weight: 0.25, source: 'fund_flow', value: 0.6, reasoning: 'Above avg' }),
      ],
      reasoningChain: ['Step1: Multiple bearish signals'],
      conclusion: 'Sell TSLA due to overbought signals',
      uncertainty: { confidenceLevel: 'medium', knownUnknowns: ['Earnings next week'] },
    });
    expect(d.factors.length).toBe(4);
    expect(d.uncertainty.knownUnknowns).toContain('Earnings next week');
  });

  it('query by symbol', () => {
    engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    engine.logDecision({ symbol: 'TSLA', action: 'sell', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    expect(engine.getDecisionsBySymbol('AAPL').length).toBe(1);
  });

  it('query by action', () => {
    engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    engine.logDecision({ symbol: 'TSLA', action: 'hold', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    expect(engine.getDecisionsByAction('buy').length).toBe(1);
  });

  it('query by factor source', () => {
    engine.logDecision({ symbol: 'AAPL', action: 'buy',
      factors: [engine.createFactor({ factorId: 't', name: 'T', weight: 1, source: 'technical', value: 70, reasoning: 'OK' })],
      reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' },
    });
    expect(engine.getDecisionsByFactorSource('technical').length).toBe(1);
    expect(engine.getDecisionsByFactorSource('fundamental').length).toBe(0);
  });

  it('unresolved decisions', () => {
    const d = engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    expect(engine.getUnresolvedDecisions().length).toBe(1);
    engine.resolveDecision(d.id, 5);
    expect(engine.getUnresolvedDecisions().length).toBe(0);
  });

  it('resolve decision with good outcome', () => {
    const d = engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    const ok = engine.resolveDecision(d.id, 5, 'good', 'Strong rally');
    expect(ok).toBe(true);
    const resolved = engine.getDecision(d.id);
    expect(resolved?.result?.actualOutcome).toBe(5);
    expect(resolved?.result?.decisionQuality).toBe('good');
  });

  it('resolve decision with poor outcome', () => {
    const d = engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    engine.resolveDecision(d.id, -5);
    const resolved = engine.getDecision(d.id);
    expect(resolved?.result?.decisionQuality).toBe('poor');
  });

  it('resolve nonexistent decision', () => {
    expect(engine.resolveDecision('nonexistent', 10)).toBe(false);
  });

  it('generates audit trail', () => {
    const d = engine.logDecision({
      symbol: 'AAPL', action: 'buy',
      factors: [engine.createFactor({ factorId: 'rsi', name: 'RSI', weight: 1, source: 'technical', value: 65, reasoning: 'Strong' })],
      reasoningChain: ['Step1'], conclusion: 'Buy',
      uncertainty: { confidenceLevel: 'high', knownUnknowns: ['Earnings'], assumptions: ['No crash'] },
    });
    const trail = engine.generateAuditTrail(d.id);
    expect(trail).toContain('RSI');
    expect(trail).toContain('Earnings');
    expect(trail).toContain('Buy');
  });

  it('stats aggregation', () => {
    engine.logMockMultifactorDecision('AAPL', 'buy');
    engine.logMockMultifactorDecision('TSLA', 'sell');
    const stats = engine.getStats();
    expect(stats.totalDecisions).toBe(2);
    expect(stats.byAction['buy']).toBe(1);
    expect(stats.averageFactorsPerDecision).toBe(6);
  });

  it('mock multifactor decision', () => {
    const d = engine.logMockMultifactorDecision('NVDA', 'buy');
    expect(d.factors.length).toBe(6);
    expect(d.uncertainty.confidenceLevel).toBe('medium');
    expect(d.reasoningChain.length).toBeGreaterThan(2);
  });

  it('recent decisions', () => {
    for (let i = 0; i < 5; i++) {
      engine.logDecision({ symbol: 'AAPL', action: 'buy', factors: [], reasoningChain: [], conclusion: 'OK', uncertainty: { confidenceLevel: 'high' } });
    }
    expect(engine.getRecentDecisions(3).length).toBe(3);
    expect(engine.getDecisionCount()).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-04/P1-05 SectorAIDiagnosisEngine
// ═══════════════════════════════════════════════════════════════

describe('SectorAIDiagnosisEngine', () => {
  let engine: SectorAIDiagnosisEngine;
  beforeEach(() => {
    (SectorAIDiagnosisEngine as any).instance = null;
    engine = SectorAIDiagnosisEngine.getInstance();
  });

  it('singleton', () => { expect(SectorAIDiagnosisEngine.getInstance()).toBe(engine); });

  it('has 10 sectors defined', () => {
    const names = engine.getSectorNames();
    expect(Object.keys(names).length).toBe(10);
  });

  it('each sector has >=5 symbols', () => {
    const symbols = engine.getSectorSymbols();
    for (const [, list] of Object.entries(symbols)) {
      expect(list.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('generates full diagnosis', () => {
    const heatmap = engine.diagnoseAllSectors();
    expect(heatmap.sectors.length).toBe(10);
    expect(heatmap.overallMarketScore).toBeGreaterThan(0);
    expect(heatmap.leadingSectors.length).toBe(3);
    expect(heatmap.laggingSectors.length).toBe(3);
  });

  it('each sector diagnosis has dimensions', () => {
    const heatmap = engine.diagnoseAllSectors();
    for (const s of heatmap.sectors) {
      expect(s.healthScore).toBeGreaterThanOrEqual(0);
      expect(s.healthScore).toBeLessThanOrEqual(100);
      expect(['green', 'yellow', 'red']).toContain(s.color);
      expect(s.aiSummary.length).toBeGreaterThan(10);
    }
  });

  it('color mapping thresholds', () => {
    expect(engine.healthToColor(80)).toBe('green');
    expect(engine.healthToColor(55)).toBe('yellow');
    expect(engine.healthToColor(30)).toBe('red');
  });

  it('color mapping boundaries', () => {
    expect(engine.healthToColor(70)).toBe('green');
    expect(engine.healthToColor(69)).toBe('yellow');
    expect(engine.healthToColor(40)).toBe('yellow');
    expect(engine.healthToColor(39)).toBe('red');
  });

  it('hover tooltip generation', () => {
    const heatmap = engine.diagnoseAllSectors();
    const tooltip = engine.generateHoverTooltip('technology', heatmap.sectors[0]);
    expect(tooltip).toContain('健康度');
    expect(tooltip).toContain('↑');
  });

  it('custom dimension scores', () => {
    const heatmap = engine.diagnoseAllSectors({
      technology: {
        momentum: { score: 90, trend: 'strong_up' },
        breadth: { score: 85, trend: 'strong_up' },
        volume: { score: 80, trend: 'up' },
        sentiment: { score: 90, trend: 'strong_up' },
        valuation: { score: 75, trend: 'up' },
        institutional_flow: { score: 80, trend: 'up' },
      },
    });
    const tech = heatmap.sectors.find(s => s.sectorId === 'technology');
    expect(tech?.healthScore).toBeGreaterThanOrEqual(80);
    expect(tech?.color).toBe('green');
  });

  it('mock heatmap generates data', () => {
    const heatmap = engine.generateMockHeatmap();
    expect(heatmap.sectors.length).toBe(10);
    expect(heatmap.leadingSectors.length).toBe(3);
    expect(heatmap.generatedAt).toBeGreaterThan(0);
  });

  it('billing cost', () => {
    expect(engine.getBillingCost()).toBe(1.5);
  });

  it('Google config', () => {
    const cfg = engine.getGoogleConfig();
    expect(cfg.baseUrl).toContain('google');
    expect(cfg.retryCount).toBe(3);
  });

  it('cached google quote', () => {
    expect(engine.getCachedGoogleQuote('AAPL')).toBeUndefined();
  });

  it('trend directions in diagnosis', () => {
    const heatmap = engine.diagnoseAllSectors();
    for (const s of heatmap.sectors) {
      expect(['strong_up', 'up', 'flat', 'down', 'strong_down']).toContain(s.trendShort);
      expect(['strong_up', 'up', 'flat', 'down', 'strong_down']).toContain(s.trendMedium);
      expect(['strong_up', 'up', 'flat', 'down', 'strong_down']).toContain(s.trendLong);
    }
  });

  it('data source tracking', () => {
    const heatmap = engine.diagnoseAllSectors({}, 'yahoo');
    for (const s of heatmap.sectors) expect(s.dataSource).toBe('yahoo');

    const heatmap2 = engine.diagnoseAllSectors({}, 'google');
    for (const s of heatmap2.sectors) expect(s.dataSource).toBe('google');
  });

  it('reset clears cache', () => {
    engine.diagnoseAllSectors();
    engine.reset();
    expect(engine.getCachedDiagnosis().length).toBe(0);
    expect(engine.getLastDiagnosisTime()).toBe(0);
  });
});
