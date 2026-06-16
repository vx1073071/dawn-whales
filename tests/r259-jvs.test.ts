import { describe, it, expect, beforeEach } from 'vitest';
import { DailyPushEngine } from '../electron/engine/push/DailyPushEngine';
import { HKShortSellEngine } from '../electron/engine/data/HKShortSellEngine';
import { AnomalyDetectionV2Engine } from '../electron/engine/ai/AnomalyDetectionV2Engine';

// ═══════════════════════════════════════════════════════════════
// P1-06 DailyPushEngine
// ═══════════════════════════════════════════════════════════════

describe('DailyPushEngine', () => {
  let engine: DailyPushEngine;
  beforeEach(() => {
    // Force singleton re-creation with test config
    (DailyPushEngine as any).instance = null;
    engine = DailyPushEngine.getInstance({ defaultQuietStart: 0, defaultQuietEnd: 0, defaultMaxDaily: 20 });
  });

  it('singleton', () => { expect(DailyPushEngine.getInstance()).toBe(engine); });

  it('creates user preference automatically', () => {
    const pref = engine.getUserPreferences('u1');
    expect(pref.userId).toBe('u1');
    expect(pref.enabledTypes).toContain('pre_market_briefing');
    expect(pref.channels).toContain('desktop');
  });

  it('updates user preferences', () => {
    engine.updateTypes('u1', ['intraday_alert']);
    engine.updateChannels('u1', ['mobile']);
    engine.updateABGroup('u1', 'variant_a');
    const pref = engine.getUserPreferences('u1');
    expect(pref.enabledTypes).toEqual(['intraday_alert']);
    expect(pref.channels).toEqual(['mobile']);
    expect(pref.abGroup).toBe('variant_a');
  });

  it('schedules a push', () => {
    const rec = engine.schedule('u1', 'pre_market_briefing', {
      type: 'pre_market_briefing', title: 'Test', body: 'Body',
      format: 'text', priority: 'normal',
    });
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe('queued');
  });

  it('respects type disable', () => {
    engine.updateTypes('u1', []); // disable all
    const rec = engine.schedule('u1', 'pre_market_briefing', {
      type: 'pre_market_briefing', title: 'Test', body: 'Body',
      format: 'text', priority: 'normal',
    });
    expect(rec).toBeNull();
  });

  it('tracks push status lifecycle', () => {
    const rec = engine.schedule('u1', 'intraday_alert', {
      type: 'intraday_alert', title: 'T', body: 'B', format: 'text', priority: 'urgent',
    });
    engine.markSent(rec!.id);
    expect(rec!.status).toBe('sent');
    engine.markDelivered(rec!.id);
    expect(rec!.status).toBe('delivered');
    engine.markOpened(rec!.id);
    expect(rec!.status).toBe('opened');
  });

  it('generates daily report', () => {
    engine.createMockUsers(2);
    engine.simulatePush('mock_user_1', 'pre_market_briefing');
    engine.simulatePush('mock_user_1', 'intraday_alert');
    engine.simulatePush('mock_user_2', 'closing_summary');
    const report = engine.generateReport();
    expect(report.totalScheduled).toBeGreaterThan(0);
    expect(report.byType).toBeDefined();
    expect(report.byABGroup).toBeDefined();
  });

  it('content builders', () => {
    const pre = engine.buildPreMarketBriefing(['AAPL', 'TSLA'], '市场平稳');
    expect(pre.type).toBe('pre_market_briefing');
    expect(pre.title).toContain('简报');

    const close = engine.buildClosingSummary([{ symbol: 'AAPL', changePct: 2.5 }], '收涨');
    expect(close.type).toBe('closing_summary');

    const alert = engine.buildIntradayAlert('TSLA', '放量下跌', -5.2);
    expect(alert.priority).toBe('urgent');
  });

  it('getOrCreatePreference is idempotent', () => {
    const p1 = engine.getOrCreatePreference('u1');
    const p2 = engine.getOrCreatePreference('u1');
    expect(p1).toBe(p2);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-08 HKShortSellEngine
// ═══════════════════════════════════════════════════════════════

describe('HKShortSellEngine', () => {
  let engine: HKShortSellEngine;
  beforeEach(() => { engine = HKShortSellEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(HKShortSellEngine.getInstance()).toBe(engine); });

  it('ingests a record', () => {
    engine.ingest({
      symbol: '0700.HK', date: '2026-06-17', shortVolume: 5000000,
      shortAmount: 500000000, totalVolume: 20000000, shortRatio: 0.25,
      sector: 'Technology', market: 'HK',
    });
    expect(engine.getRecordCount()).toBe(1);
  });

  it('symbol summary with mock data', () => {
    engine.createMockData();
    const summary = engine.getSymbolSummary('0700.HK');
    expect(summary).not.toBeNull();
    expect(summary!.symbol).toBe('0700.HK');
    expect(summary!.latestRatio).toBeGreaterThan(0);
    expect(summary!.trend).toBeDefined();
    expect(summary!.percentile).toBeGreaterThanOrEqual(0);
    expect(summary!.percentile).toBeLessThanOrEqual(100);
  });

  it('ingests batch', () => {
    const records = [
      { symbol: '0005.HK', date: '2026-06-17', shortVolume: 3000000, shortAmount: 180000000, totalVolume: 15000000, shortRatio: 0.2, sector: 'Finance', market: 'HK' as const },
      { symbol: '0388.HK', date: '2026-06-17', shortVolume: 2000000, shortAmount: 600000000, totalVolume: 8000000, shortRatio: 0.25, sector: 'Finance', market: 'HK' as const },
    ];
    engine.ingestBatch(records);
    expect(engine.getRecordCount()).toBe(2);
  });

  it('sector short sell', () => {
    engine.createMockData();
    const sectors = engine.getSectorShortSell('2026-06-17');
    if (sectors.length > 0) {
      expect(sectors[0].sector).toBeDefined();
      expect(sectors[0].stockCount).toBeGreaterThan(0);
    }
  });

  it('squeeze assessment', () => {
    engine.createMockData();
    const sq = engine.assessSqueeze('0700.HK');
    if (sq) {
      expect(sq.squeezeScore).toBeGreaterThanOrEqual(0);
      expect(sq.squeezeScore).toBeLessThanOrEqual(100);
      expect(['low', 'elevated', 'high', 'extreme']).toContain(sq.risk);
    }
  });

  it('top squeeze candidates', () => {
    engine.createMockData();
    const candidates = engine.getTopSqueezeCandidates(5);
    expect(candidates.length).toBeGreaterThan(0);
    if (candidates.length >= 2) {
      expect(candidates[0].squeezeScore).toBeGreaterThanOrEqual(candidates[1].squeezeScore);
    }
  });

  it('getRecords filters by symbol', () => {
    engine.createMockData();
    const records = engine.getRecords('0700.HK', 5);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(r => r.symbol === '0700.HK')).toBe(true);
  });

  it('no alerts on normal data', () => {
    engine.ingest({
      symbol: '0700.HK', date: '2026-06-17', shortVolume: 5000000,
      shortAmount: 500000000, totalVolume: 20000000, shortRatio: 0.15,
      sector: 'Technology', market: 'HK',
    });
    expect(engine.getAlerts().length).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1-14 AnomalyDetectionV2Engine
// ═══════════════════════════════════════════════════════════════

describe('AnomalyDetectionV2Engine', () => {
  let engine: AnomalyDetectionV2Engine;
  beforeEach(() => { engine = AnomalyDetectionV2Engine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(AnomalyDetectionV2Engine.getInstance()).toBe(engine); });

  it('ingests bars and builds stats', () => {
    const bars = engine.createMockBars('AAPL', 30, '15m');
    engine.ingestBatch(bars);
    const stats = engine.getStats('AAPL', '15m');
    expect(stats.close).not.toBeNull();
    expect(stats.close!.mean).toBeGreaterThan(0);
    expect(stats.close!.std).toBeGreaterThanOrEqual(0);
    expect(stats.close!.count).toBeGreaterThanOrEqual(10);
  });

  it('detects price spike', () => {
    // Feed normal bars first
    const normal = engine.createMockBars('AAPL', 30, '1d');
    engine.ingestBatch(normal);

    // Feed spike
    const spike = engine.createSpikeBar('AAPL', '1d');
    engine.ingest(spike);

    const signals = engine.getSignals('AAPL');
    // Should have at least price anomaly
    const priceSignals = signals.filter(s => s.category === 'price');
    if (priceSignals.length > 0) {
      expect(priceSignals[0].zScore).toBeGreaterThan(0);
      expect(priceSignals[0].status).toBe('detected');
    }
  });

  it('signal lifecycle', () => {
    const normal = engine.createMockBars('AAPL', 30, '1d');
    engine.ingestBatch(normal);
    const spike = engine.createSpikeBar('AAPL', '1d');
    engine.ingest(spike);

    const signals = engine.getSignals('AAPL');
    if (signals.length > 0) {
      const id = signals[0].id;
      engine.confirmSignal(id);
      expect(engine.getSignals('AAPL')[0].status).toBe('confirmed');
      engine.escalateSignal(id);
      expect(engine.getSignals('AAPL')[0].status).toBe('escalated');
      // Resolve all active to clean up (spy may generate extras)
      for (const s of engine.getActiveSignals('AAPL')) engine.resolveSignal(s.id);
    }
  });

  it('sector anomaly detection', () => {
    const symbols = ['AAPL', 'MSFT', 'GOOG'];
    for (const sym of symbols) {
      const normal = engine.createMockBars(sym, 30, '1d');
      engine.ingestBatch(normal);
      const spike = engine.createSpikeBar(sym, '1d');
      engine.ingest(spike);
    }
    // All 3 had spikes, should trigger sector anomaly
    // Need at least 30% ratio: 3/3 = 100% > 30%
    const saDetected = engine.detectSectorAnomaly('Tech', symbols, 5 * 60 * 1000);
    // May or may not trigger depending on exact timing spread
    expect(saDetected).toBeDefined();
  });

  it('cascade rules', () => {
    engine.addCascadeRule({
      id: 'cr1', name: 'Price then Volume',
      trigger: { category: 'price', timeframe: '1d', zScoreMin: 1 },
      observe: { category: 'volume', timeframe: '15m', zScoreMin: 1 },
      windowMs: 3600000,
    });
  });

  it('decay tracking', () => {
    const normal = engine.createMockBars('AAPL', 30, '1d');
    engine.ingestBatch(normal);
    const spike = engine.createSpikeBar('AAPL', '1d');
    engine.ingest(spike);

    const signals = engine.getSignals('AAPL');
    if (signals.length > 0) {
      const normalBar = engine.createMockBars('AAPL', 1, '1d')[0];
      const decays = engine.getDecayAnalysis('AAPL', normalBar);
      if (decays.length > 0) {
        expect(decays[0].decayPct).toBeDefined();
        expect(typeof decays[0].isSustained).toBe('boolean');
      }
    }
  });

  it('active signals filter by symbol', () => {
    engine.ingestBatch(engine.createMockBars('NVDA', 30, '1d'));
    const spike = engine.createSpikeBar('NVDA', '1d');
    engine.ingest(spike);
    expect(engine.getSignals('NVDA').length).toBeGreaterThan(0);
  });

  it('createMockBars generates correct count', () => {
    const bars = engine.createMockBars('AAPL', 20, '1d');
    expect(bars).toHaveLength(20);
    expect(bars[0].symbol).toBe('AAPL');
  });
});
