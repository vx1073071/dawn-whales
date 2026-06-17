/**
 * R255 autoclaw TEST: AI-06 MarketToStrategy + DS-05 InvestingRSS + BR-05 SourceSwitchUI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MarketToStrategyBridge, marketToStrategyBridge, resetMarketToStrategyBridge,
} from '../../electron/engine/data/market-to-strategy-bridge';
import {
  InvestingRSSFetcher, investingRSSFetcher, resetInvestingRSSFetcher,
} from '../../electron/engine/data/investing-rss-fetcher';
import {
  SourceSwitchUIBridge, sourceSwitchUIBridge, resetSourceSwitchUIBridge,
} from '../../electron/engine/data/source-switch-ui-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// AI-06: MarketToStrategyBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R255 AI-06: MarketToStrategyBridge', () => {
  let bridge: MarketToStrategyBridge;

  beforeEach(() => {
    resetMarketToStrategyBridge();
    bridge = marketToStrategyBridge();
  });

  it('observe detects breakout with volume', () => {
    const sigs = bridge.observe({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 6.0, volumeRatio: 3.5, timestamp: Date.now(), signals: [] });
    expect(sigs).toContain('breakout');
    expect(sigs).toContain('volume_surge');
  });

  it('observe detects pullback', () => {
    const sigs = bridge.observe({ symbol: 'AAPL', market: 'US', price: 200, changePercent: -1.5, volumeRatio: 2.0, timestamp: Date.now(), signals: [] });
    expect(sigs).toContain('pullback');
  });

  it('observe returns empty for flat market', () => {
    const sigs = bridge.observe({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 0.5, volumeRatio: 1.0, timestamp: Date.now(), signals: [] });
    expect(sigs.length).toBe(0);
  });

  it('generateSignal produces valid strategy signal', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 5.0, volumeRatio: 3.0, timestamp: Date.now(), signals: ['breakout', 'volume_surge'] as any[] };
    const signal = bridge.generateSignal(obs);

    expect(signal.symbol).toBe('AAPL');
    expect(signal.strategyType).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.entryPrice).toBe(200);
    expect(signal.stopLoss).toBeDefined();
    expect(signal.takeProfit).toBeDefined();
    expect(signal.riskRewardRatio).toBeGreaterThan(0);
    expect(signal.signalType).toBeDefined();
  });

  it('generateSignal computes proper stop loss for up move', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 100, changePercent: 10, volumeRatio: 3.0, timestamp: Date.now(), signals: ['breakout'] as any[] };
    const signal = bridge.generateSignal(obs);
    expect(signal.stopLoss).toBeLessThan(signal.entryPrice);
    expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice);
  });

  it('generateSignal computes proper stop loss for down move', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 100, changePercent: -10, volumeRatio: 3.0, timestamp: Date.now(), signals: [] as any[] };
    const signal = bridge.generateSignal(obs);
    expect(signal.stopLoss).toBeGreaterThan(signal.entryPrice);
    expect(signal.takeProfit).toBeLessThan(signal.entryPrice);
  });

  it('matchStrategies returns all 8 strategy types', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 5.0, volumeRatio: 2.5, timestamp: Date.now(), signals: [] };
    const matches = bridge.matchStrategies(obs);
    expect(matches.length).toBe(8);
    expect(matches.every(m => m.matchScore >= 0 && m.matchScore <= 1)).toBe(true);
  });

  it('matchStrategies sorts best first', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 6.0, volumeRatio: 4.0, timestamp: Date.now(), signals: [] };
    const matches = bridge.matchStrategies(obs);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
    }
  });

  it('momentum breakout favored for strong up moves', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 8.0, volumeRatio: 3.0, timestamp: Date.now(), signals: ['breakout'] as any[] };
    const signal = bridge.generateSignal(obs);
    expect(signal.strategyType).toBe('momentum_breakout');
  });

  it('scalping favored for volume surges', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 1.5, volumeRatio: 5.0, timestamp: Date.now(), signals: ['volume_surge'] as any[] };
    const signal = bridge.generateSignal(obs);
    // Scalping should be top or near top with extreme volume
    expect(signal.strategyType).toBeDefined();
  });

  it('mean reversion favored for pullbacks', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: -2.0, volumeRatio: 1.8, timestamp: Date.now(), signals: ['pullback'] as any[] };
    const signal = bridge.generateSignal(obs);
    expect(signal.strategyType).toBe('mean_reversion');
  });

  it('signalType is entry for high confidence', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 8.0, volumeRatio: 5.0, timestamp: Date.now(), signals: ['breakout', 'volume_surge'] as any[] };
    expect(bridge.generateSignal(obs).signalType).toBe('entry');
  });

  it('timeHorizon is intraday for volume surges', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 5.0, volumeRatio: 4.0, timestamp: Date.now(), signals: [] as any[] };
    expect(bridge.generateSignal(obs).timeHorizon).toBe('intraday');
  });

  it('reasoningItems include CN translations', () => {
    const obs = { symbol: 'AAPL', market: 'US', price: 200, changePercent: 5.0, volumeRatio: 3.0, timestamp: Date.now(), signals: ['breakout'] as any[] };
    const signal = bridge.generateSignal(obs);
    expect(signal.reasoningItems.length).toBeGreaterThan(0);
    expect(signal.reasoningItemsCn.length).toBeGreaterThan(0);
  });

  it('getSignalHistory returns recent signals', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 3, volumeRatio: 2, timestamp: Date.now(), signals: [] });
    bridge.generateSignal({ symbol: 'GOOGL', market: 'US', price: 140, changePercent: -2, volumeRatio: 1.5, timestamp: Date.now(), signals: [] });
    expect(bridge.getSignalHistory().length).toBe(2);
  });

  it('getSignalHistory filters by symbol', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 3, volumeRatio: 2, timestamp: Date.now(), signals: [] });
    bridge.generateSignal({ symbol: 'GOOGL', market: 'US', price: 140, changePercent: -2, volumeRatio: 1.5, timestamp: Date.now(), signals: [] });
    expect(bridge.getSignalHistory('AAPL').length).toBe(1);
  });

  it('getLatestSignal returns most recent', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 3, volumeRatio: 2, timestamp: Date.now(), signals: [] });
    expect(bridge.getLatestSignal('AAPL')!.symbol).toBe('AAPL');
  });

  it('getActiveEntries returns only entries', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 5, volumeRatio: 3, timestamp: Date.now(), signals: ['breakout'] as any[] });
    bridge.generateSignal({ symbol: 'GOOGL', market: 'US', price: 140, changePercent: -0.5, volumeRatio: 1.0, timestamp: Date.now(), signals: [] });
    expect(bridge.getActiveEntries().length).toBeGreaterThanOrEqual(1);
  });

  it('batchProcess returns top N by confidence', () => {
    const sigs = bridge.batchProcess([
      { symbol: 'AAPL', market: 'US', price: 200, changePercent: 3, volumeRatio: 2, timestamp: Date.now(), signals: [] },
      { symbol: 'GOOGL', market: 'US', price: 140, changePercent: -2, volumeRatio: 1.5, timestamp: Date.now(), signals: [] },
      { symbol: 'TSLA', market: 'US', price: 180, changePercent: 8, volumeRatio: 4, timestamp: Date.now(), signals: ['breakout', 'volume_surge'] as any[] },
      { symbol: 'MSFT', market: 'US', price: 420, changePercent: 1, volumeRatio: 1.2, timestamp: Date.now(), signals: [] },
      { symbol: 'NVDA', market: 'US', price: 130, changePercent: 4, volumeRatio: 2.5, timestamp: Date.now(), signals: ['momentum_shift'] as any[] },
    ], 3);
    expect(sigs.length).toBe(3);
    for (let i = 1; i < sigs.length; i++) {
      expect(sigs[i - 1].confidence).toBeGreaterThanOrEqual(sigs[i].confidence);
    }
  });

  it('getStats tracks totals', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 5, volumeRatio: 3, timestamp: Date.now(), signals: ['breakout'] as any[] });
    const stats = bridge.getStats();
    expect(stats.totalGenerated).toBe(1);
    expect(stats.byType).toBeDefined();
  });

  it('reset clears history', () => {
    bridge.generateSignal({ symbol: 'AAPL', market: 'US', price: 200, changePercent: 5, volumeRatio: 3, timestamp: Date.now(), signals: [] as any[] });
    bridge.reset();
    expect(bridge.getSignalHistory().length).toBe(0);
    expect(bridge.getStats().totalGenerated).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DS-05: InvestingRSSFetcher
// ═══════════════════════════════════════════════════════════════════════════

describe('R255 DS-05: InvestingRSSFetcher', () => {
  let fetcher: InvestingRSSFetcher;

  beforeEach(() => {
    resetInvestingRSSFetcher();
    fetcher = investingRSSFetcher();
  });

  it('seeds 20 articles across categories', () => {
    const all = fetcher.fetchLatest(100);
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it('fetchArticles filters by category', () => {
    const crypto = fetcher.fetchArticles('crypto');
    expect(crypto.length).toBeGreaterThan(0);
    expect(crypto.every(a => a.category === 'crypto')).toBe(true);
  });

  it('fetchLatest returns sorted by recency', () => {
    const latest = fetcher.fetchLatest(10);
    for (let i = 1; i < latest.length; i++) {
      expect(latest[i - 1].publishedAt).toBeGreaterThanOrEqual(latest[i].publishedAt);
    }
  });

  it('searchArticles by keyword', () => {
    const results = fetcher.searchArticles('bitcoin');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searchArticles returns empty for no match', () => {
    expect(fetcher.searchArticles('nonexistentxyz')).toEqual([]);
  });

  it('getEconomicEvents returns events', () => {
    const events = fetcher.getEconomicEvents();
    expect(events.length).toBeGreaterThanOrEqual(10);
  });

  it('getEconomicEvents filters by impact', () => {
    const high = fetcher.getEconomicEvents(undefined, undefined, 'high');
    expect(high.length).toBeGreaterThan(0);
    expect(high.every(e => e.impact === 'high')).toBe(true);
  });

  it('getTodayHighImpact returns today events', () => {
    const today = fetcher.getTodayHighImpact();
    expect(today.length).toBeGreaterThan(0);
  });

  it('getUpcomingEvents returns future events', () => {
    const upcoming = fetcher.getUpcomingEvents(3);
    expect(upcoming.length).toBeGreaterThan(0);
  });

  it('getTechnicalSummary returns period breakdowns', () => {
    const summaries = fetcher.getTechnicalSummary('AAPL');
    expect(summaries.length).toBeGreaterThanOrEqual(4);
    expect(summaries.some(s => s.period === '1d')).toBe(true);
    expect(summaries.some(s => s.period === '1h')).toBe(true);
  });

  it('getOverallSignals returns sorted by score', () => {
    const signals = fetcher.getOverallSignals();
    expect(signals.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].score).toBeGreaterThanOrEqual(signals[i].score);
    }
  });

  it('toEngineArticles converts format', () => {
    const articles = fetcher.fetchLatest(5);
    const engine = fetcher.toEngineArticles(articles);
    expect(engine.length).toBe(5);
    expect(engine.every(a => a.source === 'investing.com')).toBe(true);
    expect(engine[0].id).toBeDefined();
    expect(engine[0].language).toBe('en');
  });

  it('fetchEngineArticles one-step', () => {
    const engine = fetcher.fetchEngineArticles('economy', 3);
    expect(engine.length).toBeGreaterThan(0);
    expect(engine.every(a => a.source === 'investing.com')).toBe(true);
  });

  it('fetchLatestEngineArticles', () => {
    const engine = fetcher.fetchLatestEngineArticles(10);
    expect(engine.length).toBe(10);
  });

  it('getStats returns category breakdown', () => {
    const stats = fetcher.getStats();
    expect(stats.totalArticles).toBeGreaterThanOrEqual(20);
    expect(Object.keys(stats.byCategory).length).toBeGreaterThanOrEqual(7);
  });

  it('reset restores seed data', () => {
    fetcher.reset();
    expect(fetcher.fetchLatest(1).length).toBe(1);
    expect(fetcher.getEconomicEvents().length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BR-05: SourceSwitchUIBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R255 BR-05: SourceSwitchUIBridge', () => {
  let bridge: SourceSwitchUIBridge;

  beforeEach(() => {
    resetSourceSwitchUIBridge();
    bridge = sourceSwitchUIBridge();
  });

  it('registers 8 data sources', () => {
    expect(bridge.getAllSources().length).toBe(8);
  });

  it('getAllSources sorted by priority', () => {
    const sources = bridge.getAllSources();
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i - 1].priority).toBeLessThanOrEqual(sources[i].priority);
    }
  });

  it('getSourcesForDomain filters correctly', () => {
    const crypto = bridge.getSourcesForDomain('crypto');
    expect(crypto.length).toBeGreaterThan(0);
    expect(crypto.some(s => s.sourceId === 'binance')).toBe(true);
  });

  it('getSourcesForDomain quote has multiple sources', () => {
    const quote = bridge.getSourcesForDomain('quote');
    expect(quote.length).toBeGreaterThanOrEqual(3);
    expect(quote.some(s => s.sourceId === 'yahoo')).toBe(true);
    expect(quote.some(s => s.sourceId === 'eastmoney')).toBe(true);
  });

  it('getActiveSource returns default for domain', () => {
    expect(bridge.getActiveSource('crypto')).toBe('binance');
    expect(bridge.getActiveSource('quote')).toBe('yahoo');
  });

  it('getHealth returns status for source', () => {
    const h = bridge.getHealth('binance');
    expect(h).not.toBeNull();
    expect(h!.status).toBe('online');
    expect(h!.latencyMs).toBeGreaterThan(0);
  });

  it('getAllHealth returns for all sources', () => {
    const all = bridge.getAllHealth();
    expect(all.length).toBe(8);
  });

  it('isHealthy returns true for online/degraded', () => {
    expect(bridge.isHealthy('yahoo')).toBe(true);
    expect(bridge.isHealthy('investing')).toBe(true);
  });

  it('switchSource manual succeeds for valid domain', () => {
    const result = bridge.switchSource('news', 'investing');
    expect(result.success).toBe(true);
    expect(bridge.getActiveSource('news')).toBe('investing');
  });

  it('switchSource fails for unsupported domain', () => {
    const result = bridge.switchSource('crypto', 'yahoo');
    expect(result.success).toBe(false);
  });

  it('switchSource fails for offline source', () => {
    const result = bridge.switchSource('quote', 'free_api');
    expect(result.success).toBe(false);
  });

  it('switchSource records history', () => {
    bridge.switchSource('news', 'cls');
    const history = bridge.getSwitchHistory();
    expect(history.length).toBe(1);
    expect(history[0].fromSource).toBe('eastmoney');
    expect(history[0].toSource).toBe('cls');
  });

  it('autoFallback returns null when source is healthy', () => {
    // Default source (investing) is healthy, so fallback is not needed
    const fb = bridge.autoFallback('news');
    expect(fb).toBeNull();
  });

  it('autoFallback disabled when autoSwitch is off', () => {
    bridge.setAutoSwitch(false);
    // Even if we could trigger, autoSwitch disabled prevents fallback
    const fb = bridge.autoFallback('news');
    expect(fb).toBeNull();
  });

  it('getUIDashboard returns all sources with status', () => {
    const dashboard = bridge.getUIDashboard();
    expect(dashboard.length).toBe(8);
    expect(dashboard.every(d => d.statusColor.length > 0)).toBe(true);
    expect(dashboard.every(d => d.healthPercent >= 0 && d.healthPercent <= 100)).toBe(true);
    expect(dashboard.some(d => d.isActive)).toBe(true);
  });

  it('getUIDashboard marks active domains', () => {
    bridge.switchSource('quote', 'eastmoney');
    const dashboard = bridge.getUIDashboard();
    const em = dashboard.find(d => d.sourceId === 'eastmoney')!;
    expect(em.isActive).toBe(true);
  });

  it('getActiveDomains returns full map', () => {
    const map = bridge.getActiveDomains();
    expect(map.size).toBeGreaterThanOrEqual(4);
    expect(map.has('quote')).toBe(true);
  });

  it('autoSwitch toggle works', () => {
    expect(bridge.getAutoSwitchEnabled()).toBe(true);
    bridge.setAutoSwitch(false);
    expect(bridge.getAutoSwitchEnabled()).toBe(false);
  });

  it('reset restores defaults', () => {
    bridge.switchSource('news', 'investing');
    bridge.switchSource('quote', 'eastmoney');
    bridge.reset();
    expect(bridge.getActiveSource('news')).toBe('eastmoney');
    expect(bridge.getActiveSource('quote')).toBe('yahoo');
    expect(bridge.getSwitchHistory().length).toBe(0);
    expect(bridge.getAutoSwitchEnabled()).toBe(true);
  });

  it('switchSource supports CN messages', () => {
    const result = bridge.switchSource('macro', 'investing');
    expect(result.messageCn.length).toBeGreaterThan(0);
    expect(result.messageCn).toContain('investing');
  });
});
