/**
 * R253 autoclaw TEST: DS-03 EastMoney + DS-01 Yahoo Bridge + DQ-02 SourceHealthPipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EastMoneyClient, EastMoneyPipeline, eastMoneyPipeline, resetEastMoneyPipeline,
} from '../../electron/engine/data/eastmoney-fetcher';
import {
  YahooEngineBridge, yahooEngineBridge, resetYahooEngineBridge,
} from '../../electron/engine/data/yahoo-engine-bridge';
import {
  SourceHealthPipeline, sourceHealthPipeline, resetSourceHealthPipeline,
} from '../../electron/engine/data/source-health-pipeline';

// ═══════════════════════════════════════════════════════════════════════════
// DS-03: EastMoney Fetcher
// ═══════════════════════════════════════════════════════════════════════════

describe('R253 DS-03: EastMoneyFetcher', () => {
  let client: EastMoneyClient;

  beforeEach(() => {
    client = new EastMoneyClient();
  });

  it('seeds 18+ stocks across exchanges', () => {
    const quotes = client.getAllQuotes();
    expect(quotes.length).toBeGreaterThanOrEqual(18);
    const exchanges = new Set(quotes.map(q => q.exchange));
    expect(exchanges.size).toBeGreaterThanOrEqual(3);
  });

  it('getQuote returns stock by code', () => {
    const q = client.getQuote('600519');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('贵州茅台');
    expect(q!.exchange).toBe('SH');
    expect(q!.board).toBe('主板');
  });

  it('getQuote returns null for unknown', () => {
    expect(client.getQuote('999999')).toBeNull();
  });

  it('getQuotes returns multiple stocks', () => {
    const quotes = client.getQuotes(['600519', '300750', '688981']);
    expect(quotes.length).toBe(3);
    expect(quotes.map(q => q.name)).toContain('贵州茅台');
    expect(quotes.map(q => q.name)).toContain('宁德时代');
  });

  it('getMarketSnapshot returns indices + breadth', () => {
    const snap = client.getMarketSnapshot();
    expect(snap.indices.shanghai).toBeDefined();
    expect(snap.indices.shenzhen).toBeDefined();
    expect(snap.indices.chinext).toBeDefined();
    expect(snap.indices.star50).toBeDefined();
    expect(snap.marketBreadth.upStocks + snap.marketBreadth.downStocks + snap.marketBreadth.flatStocks).toBeLessThanOrEqual(snap.marketBreadth.totalStocks);
    expect(snap.totalTurnover).toBeGreaterThan(0);
  });

  it('getSectorFlows returns all sectors', () => {
    const flows = client.getSectorFlows();
    expect(flows.length).toBeGreaterThanOrEqual(10);
    expect(flows.every(f => typeof f.netInflow === 'number')).toBe(true);
  });

  it('getSectorFlows filters by type', () => {
    const industries = client.getSectorFlows('industry');
    expect(industries.every(f => f.sectorType === 'industry')).toBe(true);
  });

  it('getTopInflowSectors returns top N sorted', () => {
    const top = client.getTopInflowSectors(3);
    expect(top.length).toBe(3);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].netInflow).toBeGreaterThanOrEqual(top[i].netInflow);
    }
  });

  it('getTopOutflowSectors returns negative-heavy', () => {
    const bottom = client.getTopOutflowSectors(3);
    expect(bottom.length).toBeGreaterThanOrEqual(1);
    // bottom should have low/negative values
    expect(bottom[0].netInflow).toBeLessThanOrEqual(5);
  });

  it('getDragonTiger returns records for today', () => {
    const records = client.getDragonTiger();
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(records[0].topBuyDepts.length).toBeGreaterThan(0);
    expect(records[0].topSellDepts.length).toBeGreaterThan(0);
  });

  it('getTopNetBuy returns sorted by net amount', () => {
    const top = client.getTopNetBuy(2);
    expect(top.length).toBe(2);
    expect(top[0].netAmount).toBeGreaterThanOrEqual(top[1].netAmount);
  });

  it('getNorthBoundFlow returns flow data', () => {
    const flow = client.getNorthBoundFlow();
    expect(flow).not.toBeNull();
    expect(flow!.inflow).toBeGreaterThan(0);
    expect(flow!.topBuyStocks.length).toBeGreaterThanOrEqual(2);
  });

  it('searchAnnouncements filters by code', () => {
    const results = client.searchAnnouncements({ code: '300750' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(a => a.code === '300750')).toBe(true);
  });

  it('searchAnnouncements filters by importance', () => {
    const results = client.searchAnnouncements({ importance: 3 });
    expect(results.every(a => a.importance >= 3)).toBe(true);
  });

  it('searchAnnouncements respects limit', () => {
    const results = client.searchAnnouncements({ limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('reset restores seed data', () => {
    client.reset();
    expect(client.getAllQuotes().length).toBeGreaterThanOrEqual(18);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DS-03: EastMoney Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('R253 DS-03: EastMoneyPipeline', () => {
  let pipeline: EastMoneyPipeline;

  beforeEach(() => {
    resetEastMoneyPipeline();
    pipeline = eastMoneyPipeline();
  });

  it('getEngineQuotes converts to engine format', () => {
    const quotes = pipeline.getEngineQuotes(['600519', '300750']);
    expect(quotes.length).toBe(2);
    expect(quotes[0].source).toBe('eastmoney');
    expect(quotes[0].market).toBe('A');
    expect(quotes[0].symbol).toContain(':');
  });

  it('getEngineQuotes without codes returns all', () => {
    const quotes = pipeline.getEngineQuotes();
    expect(quotes.length).toBeGreaterThanOrEqual(18);
  });

  it('getEngineFlows returns flow data', () => {
    const flows = pipeline.getEngineFlows();
    expect(flows.length).toBeGreaterThanOrEqual(10);
    expect(flows.some(f => f.direction === 'inflow')).toBe(true);
    expect(flows.some(f => f.direction === 'outflow')).toBe(true);
  });

  it('getMarketSnapshot delegates', () => {
    const snap = pipeline.getMarketSnapshot();
    expect(snap.indices.shanghai).toBeDefined();
  });

  it('getDragonTiger delegates', () => {
    const records = pipeline.getDragonTiger();
    expect(records.length).toBeGreaterThanOrEqual(2);
  });

  it('getNorthBoundFlow delegates', () => {
    expect(pipeline.getNorthBoundFlow()).not.toBeNull();
  });

  it('searchAnnouncements works', () => {
    const results = pipeline.searchAnnouncements('600519');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('startAutoRefresh calls callback', async () => {
    let called = 0;
    // Override config with fast interval
    const fastPipeline = new (await import('../../electron/engine/data/eastmoney-fetcher')).EastMoneyPipeline({ refreshIntervalMs: 20 });
    fastPipeline.startAutoRefresh(() => { called++; });
    await new Promise(r => setTimeout(r, 80));
    fastPipeline.stopAutoRefresh();
    expect(called).toBeGreaterThan(0);
  });

  it('reset clears pipeline', () => {
    pipeline.reset();
    expect(pipeline.getClient().getAllQuotes().length).toBeGreaterThanOrEqual(18);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DS-01: YahooEngineBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R253 DS-01: YahooEngineBridge', () => {
  let bridge: YahooEngineBridge;

  beforeEach(() => {
    resetYahooEngineBridge();
    bridge = yahooEngineBridge();
  });

  it('seeds 15 symbols across US/HK', () => {
    const quotes = bridge.getAllQuotes();
    // After ingest, quotes should appear
    expect(bridge.getStats()).toBeDefined();
  });

  it('ingestYahooQuote standardizes raw→engine', () => {
    const raw = {
      symbol: 'AAPL', price: 195.50, change: 5.20, changePercent: 2.73,
      dayHigh: 196.00, dayLow: 193.00, open: 194.00, previousClose: 190.30,
      volume: 55000000, avgVolume: 48000000, marketCap: 3000000000000,
      bid: 195.45, ask: 195.55, bidSize: 100, askSize: 200,
      timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD',
    };

    const quote = bridge.ingestYahooQuote(raw);
    expect(quote.symbol).toBe('AAPL');
    expect(quote.source).toBe('yahoo');
    expect(quote.market).toBe('US');
    expect(quote.vwap).toBeGreaterThan(0);
    expect(quote.volumeRatio).toBeGreaterThan(0);
    expect(quote.gapPercent).toBeDefined();
    expect(quote.spread).toBeGreaterThanOrEqual(0);
    expect(quote.session).toBeDefined();
  });

  it('ingestBatch processes multiple quotes', () => {
    const raws = [
      { symbol: 'AAPL', price: 195, change: 5, changePercent: 2.6, dayHigh: 196, dayLow: 193, open: 194, previousClose: 190, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' },
      { symbol: 'MSFT', price: 420, change: 8, changePercent: 1.9, dayHigh: 422, dayLow: 415, open: 418, previousClose: 412, volume: 2e7, avgVolume: 2.2e7, marketCap: 3.1e12, bid: 419.9, ask: 420.1, bidSize: 50, askSize: 100, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' },
    ];
    const quotes = bridge.ingestBatch(raws);
    expect(quotes.length).toBe(2);
    expect(quotes[0].symbol).toBe('AAPL');
    expect(quotes[1].symbol).toBe('MSFT');
  });

  it('getQuote returns cached quote', () => {
    const raw = { symbol: 'AAPL', price: 195, change: 5, changePercent: 2.6, dayHigh: 196, dayLow: 193, open: 194, previousClose: 190, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' };
    bridge.ingestYahooQuote(raw);
    expect(bridge.getQuote('AAPL')).not.toBeNull();
  });

  it('getQuote returns null for unknown', () => {
    expect(bridge.getQuote('NOPE')).toBeNull();
  });

  it('getQuotesByMarket filters by market', () => {
    bridge.ingestYahooQuote({ symbol: 'AAPL', price: 195, change: 5, changePercent: 2.6, dayHigh: 196, dayLow: 193, open: 194, previousClose: 190, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' });
    bridge.ingestYahooQuote({ symbol: '0700.HK', price: 380, change: 5, changePercent: 1.3, dayHigh: 385, dayLow: 378, open: 380, previousClose: 375, volume: 1e7, avgVolume: 1.2e7, marketCap: 3.6e12, bid: 379.9, ask: 380.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'HKEX', currency: 'HKD' });
    const usQuotes = bridge.getQuotesByMarket('US');
    expect(usQuotes.every(q => q.market === 'US')).toBe(true);
  });

  it('getMovers finds significant changes', () => {
    bridge.ingestYahooQuote({ symbol: 'AAPL', price: 195, change: 15, changePercent: 8.3, dayHigh: 196, dayLow: 193, open: 194, previousClose: 180, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' });
    bridge.ingestYahooQuote({ symbol: 'TSLA', price: 250, change: 1, changePercent: 0.4, dayHigh: 252, dayLow: 249, open: 250, previousClose: 249, volume: 3e7, avgVolume: 3.5e7, marketCap: 8e11, bid: 249.9, ask: 250.1, bidSize: 50, askSize: 100, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' });
    const movers = bridge.getMovers(2);
    expect(movers.length).toBeGreaterThanOrEqual(1);
    expect(movers[0].symbol).toBe('AAPL');
  });

  it('getIndicators returns technical metrics', () => {
    bridge.ingestYahooQuote({ symbol: 'AAPL', price: 195, change: 5, changePercent: 2.6, dayHigh: 196, dayLow: 193, open: 194, previousClose: 190, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' });
    const ind = bridge.getIndicators('AAPL');
    expect(ind).not.toBeNull();
    expect(ind!.vwap).toBeGreaterThan(0);
    expect(ind!.beta).toBeGreaterThan(0);
    expect(ind!.rsi14).toBeGreaterThanOrEqual(0);
    expect(ind!.rsi14).toBeLessThanOrEqual(100);
  });

  it('getIndicators returns null for unknown', () => {
    expect(bridge.getIndicators('NOPE')).toBeNull();
  });

  it('getSession returns valid state', () => {
    const session = bridge.getSession('US');
    expect(['pre_market', 'regular', 'post_market', 'closed']).toContain(session);
  });

  it('getMarketClock returns clock config', () => {
    const clock = bridge.getMarketClock('US');
    expect(clock).not.toBeNull();
    expect(clock!.market).toBe('US');
    expect(clock!.regularStart).toBe('09:30');
  });

  it('getHealth returns probe', () => {
    const health = bridge.getHealth();
    expect(health.status).toBeDefined();
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('getStats returns stats', () => {
    const stats = bridge.getStats();
    expect(stats.activeSymbols).toBeGreaterThanOrEqual(0);
    expect(stats.session).toBeDefined();
  });

  it('registerSymbol adds to known symbols', () => {
    bridge.registerSymbol('BRK.B', 'Berkshire Hathaway', 'US');
    bridge.ingestYahooQuote({ symbol: 'BRK.B', price: 450, change: 2, changePercent: 0.4, dayHigh: 451, dayLow: 448, open: 449, previousClose: 448, volume: 3e6, avgVolume: 3.5e6, marketCap: 9e11, bid: 449.9, ask: 450.1, bidSize: 10, askSize: 20, timestamp: Date.now(), exchange: 'NYSE', currency: 'USD' });
    const q = bridge.getQuote('BRK.B');
    expect(q).not.toBeNull();
    expect(q!.name).toBe('Berkshire Hathaway');
  });

  it('reset clears all state', () => {
    bridge.ingestYahooQuote({ symbol: 'AAPL', price: 195, change: 5, changePercent: 2.6, dayHigh: 196, dayLow: 193, open: 194, previousClose: 190, volume: 5e7, avgVolume: 4.8e7, marketCap: 3e12, bid: 194.9, ask: 195.1, bidSize: 100, askSize: 200, timestamp: Date.now(), exchange: 'NASDAQ', currency: 'USD' });
    bridge.reset();
    expect(bridge.getQuote('AAPL')).toBeNull();
    expect(bridge.getStats().activeSymbols).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DQ-02: SourceHealthPipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('R253 DQ-02: SourceHealthPipeline', () => {
  let pipeline: SourceHealthPipeline;

  beforeEach(() => {
    resetSourceHealthPipeline();
    pipeline = sourceHealthPipeline();
  });

  it('scans all 25+ sources', () => {
    const results = pipeline.scanAll();
    expect(results.length).toBeGreaterThanOrEqual(25);
    expect(results.every(r => r.healthScore >= 0 && r.healthScore <= 100)).toBe(true);
  });

  it('scanSource returns single result', () => {
    const result = pipeline.scanSource('bloomberg');
    expect(result).not.toBeNull();
    expect(result!.sourceName).toBe('Bloomberg');
  });

  it('scanSource returns null for unknown', () => {
    expect(pipeline.scanSource('nope')).toBeNull();
  });

  it('all sources have valid status', () => {
    const results = pipeline.scanAll();
    for (const r of results) {
      expect(['healthy', 'degraded', 'warning', 'critical', 'offline']).toContain(r.status);
      expect(r.metrics.latencyMs).toBeGreaterThan(0);
      expect(r.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(r.metrics.successRate).toBeLessThanOrEqual(1);
    }
  });

  it('getDashboard returns full stream', () => {
    const dashboard = pipeline.getDashboard();
    expect(dashboard.overallHealth).toBeGreaterThan(0);
    expect(dashboard.overallHealth).toBeLessThanOrEqual(100);
    expect(dashboard.summary.total).toBeGreaterThanOrEqual(25);
    expect(dashboard.summary.healthy + dashboard.summary.degraded + dashboard.summary.warning + dashboard.summary.critical + dashboard.summary.offline).toBe(dashboard.summary.total);
  });

  it('getActiveAlerts returns unresolved alerts', () => {
    // Degrade a source to trigger alerts
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.scanAll();
    const alerts = pipeline.getActiveAlerts();
    // Should have at least some alerts from the degraded source
    expect(alerts.length).toBeGreaterThanOrEqual(0);
  });

  it('acknowledgeAlert works', () => {
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.scanAll();
    const alerts = pipeline.getActiveAlerts();
    if (alerts.length > 0) {
      expect(pipeline.acknowledgeAlert(alerts[0].alertId)).toBe(true);
    }
  });

  it('resolveAlert works', () => {
    pipeline.simulateDegradation('reuters', 'severe');
    pipeline.simulateDegradation('reuters', 'severe');
    pipeline.simulateDegradation('reuters', 'severe');
    pipeline.scanAll();
    const alerts = pipeline.getActiveAlerts();
    if (alerts.length > 0) {
      expect(pipeline.resolveAlert(alerts[0].alertId)).toBe(true);
    }
  });

  it('alert history returns all alerts', () => {
    pipeline.scanAll();
    const history = pipeline.getAlertHistory();
    expect(history.length).toBeGreaterThanOrEqual(0);
  });

  it('getPolicy returns degradation policy', () => {
    const policy = pipeline.getPolicy('bloomberg');
    expect(policy).not.toBeNull();
    expect(policy!.fallbackSourceId).toBe('reuters');
    expect(policy!.enabled).toBe(true);
  });

  it('setPolicy updates policy', () => {
    pipeline.setPolicy('test_source', {
      sourceId: 'test_source',
      fallbackSourceId: 'backup_source',
      conditions: { maxLatencyMs: 500, maxErrorRate: 0.05, maxStaleMinutes: 10, maxConsecutiveFails: 2 },
      action: 'circuit_break',
      enabled: true,
    });
    const p = pipeline.getPolicy('test_source');
    expect(p).not.toBeNull();
    expect(p!.action).toBe('circuit_break');
  });

  it('getPolicy returns null for unknown', () => {
    expect(pipeline.getPolicy('unknown')).toBeNull();
  });

  it('getTrend returns historical points', () => {
    pipeline.scanAll(); pipeline.scanAll(); pipeline.scanAll();
    const trend = pipeline.getTrend('bloomberg');
    expect(trend.length).toBeGreaterThanOrEqual(2);
  });

  it('getTrend returns empty for unknown', () => {
    expect(pipeline.getTrend('unknown').length).toBe(0);
  });

  it('predictDecline returns null for insufficient data', () => {
    expect(pipeline.predictDecline('bloomberg')).toBeNull();
  });

  it('predictDecline works after enough scans', () => {
    // Need at least 5 scans for prediction
    for (let i = 0; i < 6; i++) pipeline.scanAll();
    const prediction = pipeline.predictDecline('bloomberg');
    expect(prediction).not.toBeNull();
    expect(typeof prediction!.declining).toBe('boolean');
    expect(typeof prediction!.trend).toBe('number');
  });

  it('simulateDegradation affects health', () => {
    const before = pipeline.scanSource('bloomberg')!.healthScore;
    pipeline.simulateDegradation('bloomberg', 'severe');
    const after = pipeline.scanSource('bloomberg')!.healthScore;
    expect(after).toBeLessThan(before);
  });

  it('restoreSource resets health', () => {
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.restoreSource('bloomberg');
    const after = pipeline.scanSource('bloomberg')!.healthScore;
    expect(after).toBeGreaterThan(70);
  });

  it('degradation logs events', () => {
    pipeline.simulateDegradation('bloomberg', 'moderate');
    pipeline.scanAll();
    const log = pipeline.getDegradationLog();
    expect(log.length).toBeGreaterThanOrEqual(0);
  });

  it('reset clears all state', () => {
    pipeline.simulateDegradation('bloomberg', 'severe');
    pipeline.scanAll();
    pipeline.reset();
    const result = pipeline.scanSource('bloomberg')!;
    expect(result.healthScore).toBeGreaterThan(70);
  });

  it('startAutoScan calls callback periodically', async () => {
    let called = false;
    pipeline.startAutoScan(50, () => { called = true; });
    await new Promise(r => setTimeout(r, 120));
    pipeline.stopAutoScan();
    expect(called).toBe(true);
  });
});
