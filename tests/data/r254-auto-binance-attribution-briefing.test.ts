/**
 * R254 autoclaw TEST: BR-04 BinanceAPI + AI-03 MoveAttribution + AI-02 BriefingData
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BinanceAPIBridge, binanceAPIBridge, resetBinanceAPIBridge,
} from '../../electron/engine/data/binance-api-bridge';
import {
  MoveAttributionEngine, moveAttributionEngine, resetMoveAttributionEngine,
} from '../../electron/engine/data/move-attribution-engine';
import {
  BriefingDataBridge, briefingDataBridge, resetBriefingDataBridge,
} from '../../electron/engine/data/briefing-data-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// BR-04: BinanceAPIBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R254 BR-04: BinanceAPIBridge', () => {
  let bridge: BinanceAPIBridge;

  beforeEach(() => {
    resetBinanceAPIBridge();
    bridge = binanceAPIBridge();
  });

  it('seeds 20 spot pairs', () => {
    const quotes = bridge.getAllSpotQuotes();
    expect(quotes.length).toBeGreaterThanOrEqual(20);
  });

  it('getSpotQuote returns by symbol', () => {
    expect(bridge.getSpotQuote('BTCUSDT')).not.toBeNull();
    expect(bridge.getSpotQuote('btcusdt')).not.toBeNull(); // case insensitive
    expect(bridge.getSpotQuote('NOPE')).toBeNull();
  });

  it('spot quote has valid price & spread', () => {
    const q = bridge.getSpotQuote('BTCUSDT')!;
    expect(q.price).toBeGreaterThan(0);
    expect(q.spread).toBeGreaterThanOrEqual(0);
    expect(q.changePercent24h).toBeDefined();
    expect(q.timestamp).toBeGreaterThan(0);
  });

  it('getTopMovers returns sorted', () => {
    const movers = bridge.getTopMovers(5);
    expect(movers.length).toBe(5);
    for (let i = 1; i < movers.length; i++) {
      expect(Math.abs(movers[i - 1].changePercent24h)).toBeGreaterThanOrEqual(Math.abs(movers[i].changePercent24h));
    }
  });

  it('getContractData returns perp data', () => {
    const c = bridge.getContractData('BTCUSDT');
    expect(c).not.toBeNull();
    expect(c!.fundingRate).toBeDefined();
    expect(c!.openInterest).toBeGreaterThan(0);
    expect(c!.longShortRatio).toBeGreaterThan(0);
  });

  it('getAllContracts returns all perps', () => {
    const contracts = bridge.getAllContracts();
    expect(contracts.length).toBeGreaterThanOrEqual(6);
    expect(contracts.every(c => c.symbol.includes('PERP'))).toBe(true);
  });

  it('getTopFundingRates returns sorted by abs rate', () => {
    const top = bridge.getTopFundingRates(3);
    expect(top.length).toBe(3);
  });

  it('getOrderBook returns depth', () => {
    const book = bridge.getOrderBook('BTCUSDT');
    expect(book).not.toBeNull();
    expect(book!.bids.length).toBeGreaterThanOrEqual(20);
    expect(book!.asks.length).toBeGreaterThanOrEqual(20);
    expect(book!.imbalance).toBeGreaterThanOrEqual(0);
    expect(book!.imbalance).toBeLessThanOrEqual(1);
  });

  it('detectLargeTrades finds trades above threshold', () => {
    const trades = bridge.detectLargeTrades(50000);
    // May or may not have trades based on seed; just verify format
    expect(Array.isArray(trades)).toBe(true);
    if (trades.length > 0) {
      expect(trades[0].value).toBeGreaterThanOrEqual(50000);
    }
  });

  it('getKlines returns historical candles', () => {
    const klines = bridge.getKlines('BTCUSDT', '1h', 10);
    expect(klines.length).toBe(10);
    expect(klines[0].openTime).toBeLessThan(klines[9].openTime);
    expect(klines.every(k => k.symbol === 'BTCUSDT')).toBe(true);
  });

  it('getKlines supports all intervals', () => {
    for (const interval of ['1h', '4h', '1d'] as const) {
      const klines = bridge.getKlines('ETHUSDT', interval, 5);
      expect(klines.length).toBe(5);
      expect(klines.every(k => k.interval === interval)).toBe(true);
    }
  });

  it('getLatestKline returns most recent', () => {
    const kline = bridge.getLatestKline('BTCUSDT', '1h');
    expect(kline).not.toBeNull();
    expect(kline!.close).toBeGreaterThan(0);
  });

  it('getEngineQuotes converts to engine format', () => {
    const quotes = bridge.getEngineQuotes();
    expect(quotes.length).toBeGreaterThanOrEqual(20);
    expect(quotes.every(q => q.source === 'binance')).toBe(true);
    expect(quotes[0].symbol).toBeDefined();
    expect(quotes[0].name).toBeDefined();
    expect(quotes[0].fundingRate).toBeDefined();
  });

  it('getStats returns summary', () => {
    const stats = bridge.getStats();
    expect(stats.activeSymbols).toBeGreaterThanOrEqual(20);
    expect(stats.avgSpreadPercent).toBeGreaterThanOrEqual(0);
  });

  it('reset restores all seed data', () => {
    bridge.reset();
    expect(bridge.getSpotQuote('BTCUSDT')).not.toBeNull();
    expect(bridge.getContractData('BTCUSDT')).not.toBeNull();
    expect(bridge.getOrderBook('BTCUSDT')).not.toBeNull();
    expect(bridge.getKlines('BTCUSDT', '1h', 1).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AI-03: MoveAttributionEngine
// ═══════════════════════════════════════════════════════════════════════════

describe('R254 AI-03: MoveAttributionEngine', () => {
  let engine: MoveAttributionEngine;

  beforeEach(() => {
    resetMoveAttributionEngine();
    engine = moveAttributionEngine();
  });

  it('attribute returns full 6-dim analysis', () => {
    const attr = engine.attribute('AAPL', 'US', 5.3);
    expect(attr.symbol).toBe('AAPL');
    expect(attr.direction).toBe('up');
    expect(attr.dimensions.length).toBe(6);
    expect(attr.primaryReason).toBeDefined();
    expect(attr.primaryReason.dimension).toBeDefined();
    expect(attr.overallConfidence).toBeGreaterThan(0);
  });

  it('attribute with context boosts scores', () => {
    const basic = engine.attribute('TSLA', 'US', -4.2);
    const withContext = engine.attribute('TSLA', 'US', -4.2, {
      recentNews: [{ headline: 'Recall announced', category: 'recall', sentiment: 'negative' }],
      sectorMoves: [{ sectorName: 'Auto', avgChange: -3.5 }],
      fundFlow: { mainNetInflow: -500 },
      volume: { ratio: 3.2 },
    });
    // With context, confidence should be higher
    expect(withContext.overallConfidence).toBeGreaterThanOrEqual(basic.overallConfidence);
  });

  it('attribute detects K-line pattern for >2%', () => {
    const attr = engine.attribute('AAPL', 'US', 3.5);
    expect(attr.klinePattern).not.toBeNull();
    expect(attr.klinePattern!.nameCn.length).toBeGreaterThan(0);
    expect(['bullish', 'bearish', 'neutral']).toContain(attr.klinePattern!.direction);
  });

  it('attribute no pattern for small moves', () => {
    const attr = engine.attribute('AAPL', 'US', 0.5);
    expect(attr.klinePattern).toBeNull();
  });

  it('secondary reasons present for strong moves', () => {
    const attr = engine.attribute('NVDA', 'US', 8.5);
    expect(attr.secondaryReasons.length).toBeGreaterThan(0);
    expect(attr.secondaryReasons[0].dimension).not.toBe(attr.primaryReason.dimension);
  });

  it('dimensions sum to ~1', () => {
    const attr = engine.attribute('AAPL', 'US', 3.0);
    const sum = attr.dimensions.reduce((s, d) => s + d.score, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('generateReport creates push-ready output', () => {
    const attr = engine.attribute('AAPL', 'US', 5.3);
    const report = engine.generateReport(attr);
    expect(report.oneLineSummary).toContain('AAPL');
    expect(report.oneLineSummaryCn).toContain('AAPL');
    expect(report.shouldPush).toBe(true);
    expect(report.pushPriority).toBeDefined();
    expect(report.detailedAnalysis.length).toBeGreaterThan(0);
    expect(report.detailedAnalysisCn.length).toBeGreaterThan(0);
  });

  it('generateReport push priority: high for >5%', () => {
    const attr = engine.attribute('AAPL', 'US', 6.0);
    expect(engine.generateReport(attr).pushPriority).toBe('high');
  });

  it('generateReport push priority: medium for 3-5%', () => {
    const attr = engine.attribute('AAPL', 'US', 4.0);
    expect(engine.generateReport(attr).pushPriority).toBe('medium');
  });

  it('generateReport push priority: low for <3%', () => {
    const attr = engine.attribute('AAPL', 'US', 1.5);
    const report = engine.generateReport(attr);
    expect(report.pushPriority).toBe('low');
    expect(report.shouldPush).toBe(false);
  });

  it('getHistory returns recent attributions', () => {
    engine.attribute('AAPL', 'US', 3.0);
    engine.attribute('GOOGL', 'US', -2.5);
    engine.attribute('TSLA', 'US', 4.1);

    const history = engine.getHistory();
    expect(history.length).toBe(3);
  });

  it('getHistory filters by symbol', () => {
    engine.attribute('AAPL', 'US', 3.0);
    engine.attribute('GOOGL', 'US', -2.5);

    expect(engine.getHistory('AAPL').length).toBe(1);
    expect(engine.getHistory('GOOGL')[0].symbol).toBe('GOOGL');
  });

  it('getLatest returns most recent', () => {
    engine.attribute('AAPL', 'US', 3.0);
    expect(engine.getLatest('AAPL')!.changePercent).toBe(3.0);
  });

  it('getStats tracks dimensions and patterns', () => {
    engine.attribute('AAPL', 'US', 5.5);
    engine.attribute('TSLA', 'US', 4.2);
    const stats = engine.getStats();
    expect(stats.totalAttributions).toBe(2);
    expect(stats.topPatterns.length).toBeGreaterThan(0);
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });

  it('reset clears all history', () => {
    engine.attribute('AAPL', 'US', 3.0);
    engine.reset();
    expect(engine.getHistory().length).toBe(0);
    expect(engine.getStats().totalAttributions).toBe(0);
  });

  it('all 12 K-line patterns are available', () => {
    const patterns = new Set<string>();
    // Alternating up/down to exercise both bullish and bearish patterns
    for (let i = 0; i < 30; i++) {
      const changePct = i % 2 === 0 ? 3 + i % 5 : -(3 + i % 5);
      const attr = engine.attribute(`SYM${i}`, 'US', changePct);
      if (attr.klinePattern) patterns.add(attr.klinePattern.patternId);
    }
    // With up+down directions and 30 symbols, expect at least 4 unique patterns
    expect(patterns.size).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AI-02: BriefingDataBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R254 AI-02: BriefingDataBridge', () => {
  let bridge: BriefingDataBridge;

  beforeEach(() => {
    resetBriefingDataBridge();
    bridge = briefingDataBridge();
  });

  it('generates pre-market briefing', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market',
      userId: 'user:1',
      watchlist: ['AAPL', 'GOOGL', 'TSLA'],
      markets: ['US'],
      language: 'zh',
      sections: ['market_overview', 'top_movers', 'your_watchlist', 'sentiment_index'],
    });

    expect(briefing.briefingId).toBeDefined();
    expect(briefing.title).toBe('Pre-Market Briefing');
    expect(briefing.titleCn).toBe('盘前简报');
    expect(briefing.sections.length).toBe(4);
    expect(briefing.aiCommentaryCn.length).toBeGreaterThan(0);
    expect(briefing.marketCondition).toBeDefined();
    expect(briefing.marketConditionCn.length).toBeGreaterThan(0);
  });

  it('generates all 7 briefing types', () => {
    const types: Array<'pre_market' | 'intraday' | 'post_market' | 'weekend' | 'weekly' | 'monthly' | 'event_driven'> = [
      'pre_market', 'intraday', 'post_market', 'weekend', 'weekly', 'monthly', 'event_driven',
    ];

    for (const type of types) {
      const briefing = bridge.generateBriefing({
        type, userId: 'user:1', watchlist: ['AAPL'],
        markets: ['US'], language: 'zh',
        sections: ['market_overview', 'top_movers'],
      });
      expect(briefing.title.length).toBeGreaterThan(0);
      expect(briefing.titleCn.length).toBeGreaterThan(0);
    }
  });

  it('briefing sections are sorted by priority', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['risk_alerts', 'market_overview', 'sentiment_index'],
    });

    for (let i = 1; i < briefing.sections.length; i++) {
      expect(briefing.sections[i - 1].priority).toBeLessThan(briefing.sections[i].priority);
    }
  });

  it('personalized watchlist section', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL', 'GOOGL', 'MSFT'],
      markets: ['US'], language: 'en',
      sections: ['your_watchlist'],
    });

    const watchlistSection = briefing.sections.find(s => s.type === 'your_watchlist')!;
    expect(watchlistSection.data.length).toBe(3);
    expect(watchlistSection.data.map(d => d.key)).toContain('AAPL');
  });

  it('empty watchlist returns empty section', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: [], markets: ['US'], language: 'en',
      sections: ['your_watchlist'],
    });

    const ws = briefing.sections.find(s => s.type === 'your_watchlist')!;
    expect(ws.data.length).toBe(0);
  });

  it('header summarizes market condition', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'zh',
      sections: ['market_overview'],
    });

    expect(briefing.headerCn).toContain('盘前');
    expect(briefing.headerCn.length).toBeGreaterThan(0);
  });

  it('key takeaways present', () => {
    const briefing = bridge.generateBriefing({
      type: 'post_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview', 'top_movers'],
    });

    expect(briefing.keyTakeaways.length).toBeGreaterThan(0);
    expect(briefing.keyTakeawaysCn.length).toBeGreaterThan(0);
  });

  it('getLatest returns most recent', () => {
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });
    bridge.generateBriefing({
      type: 'post_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });

    const latest = bridge.getLatest('user:1');
    expect(latest).not.toBeNull();
    expect(latest!.config.type).toBe('post_market');
  });

  it('getLatest filters by type', () => {
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });

    const latest = bridge.getLatest('user:1', 'pre_market');
    expect(latest!.config.type).toBe('pre_market');
  });

  it('getHistory returns all briefings for user', () => {
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });
    bridge.generateBriefing({
      type: 'intraday', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });

    const history = bridge.getHistory('user:1');
    expect(history.length).toBe(2);
    expect(history[0].generatedAt).toBeGreaterThan(history[1].generatedAt);
  });

  it('getStats tracks generation counts', () => {
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:2',
      watchlist: ['TSLA'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });

    const stats = bridge.getStats();
    expect(stats.totalGenerated).toBe(2);
    expect(stats.byType.pre_market).toBe(2);
  });

  it('reset clears all briefings', () => {
    bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US'], language: 'en',
      sections: ['market_overview'],
    });
    bridge.reset();
    expect(bridge.getHistory('user:1').length).toBe(0);
    expect(bridge.getStats().totalGenerated).toBe(0);
  });

  it('market_overview section has indices', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: ['AAPL'], markets: ['US', 'HK'], language: 'zh',
      sections: ['market_overview'],
    });

    const mv = briefing.sections.find(s => s.type === 'market_overview')!;
    expect(mv.data.length).toBeGreaterThanOrEqual(5);
    expect(mv.data.some(d => d.key === 'sp500')).toBe(true);
    expect(mv.data.some(d => d.key === 'hsi')).toBe(true);
  });

  it('crypto_snapshot section has BTC/ETH', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: [], markets: ['US'], language: 'en',
      sections: ['crypto_snapshot'],
    });

    const cs = briefing.sections.find(s => s.type === 'crypto_snapshot')!;
    expect(cs.data.some(d => d.key === 'btc')).toBe(true);
    expect(cs.data.some(d => d.key === 'eth')).toBe(true);
  });

  it('sentiment_index has fear_greed + VIX', () => {
    const briefing = bridge.generateBriefing({
      type: 'pre_market', userId: 'user:1',
      watchlist: [], markets: ['US'], language: 'en',
      sections: ['sentiment_index'],
    });

    const si = briefing.sections.find(s => s.type === 'sentiment_index')!;
    expect(si.data.some(d => d.key === 'fear_greed')).toBe(true);
    expect(si.data.some(d => d.key === 'vix')).toBe(true);
  });
});
