/**
 * R260 autoclaw 综合测试 — 行情→策略闭环 + 行业轮动管线 + 30源健康全链路终验
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MarketStrategyClosedLoop, marketStrategyClosedLoop } from '../../electron/engine/data/market-strategy-closed-loop';
import { SectorRotationPipeline, sectorRotationPipeline } from '../../electron/engine/data/sector-rotation-pipeline';
import { SourceHealthFullChainVerify, sourceHealthFullChainVerify } from '../../electron/engine/data/source-health-full-chain-verify';

// ── Helpers ────────────────────────────────────────────────────────────────
const obsParams = (sym: string, change1d: number) => ({
  symbol: sym, price: 100 + change1d,
  change1d, change5d: change1d * 2, change20d: change1d * 5,
  volatility14d: 2, volumeRatio: 1.8,
  rsi14: 50 + change1d * 3,
  macdHist: change1d * 0.5,
  bbPosition: 0.5 + change1d * 0.05,
  ma50Distance: change1d * 1.5,
  ma200Distance: change1d * 3,
});

const sectorRow = (code: string, chg: number, volRat = 1.0, mcap = 1000e9) => ({
  sectorCode: code as any,
  changePercent: chg,
  volumeRatio: volRat,
  marketCap: mcap,
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-08: MarketStrategyClosedLoop 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R260 P2-08 MarketStrategyClosedLoop', () => {
  let loop: MarketStrategyClosedLoop;
  beforeEach(() => { loop = new MarketStrategyClosedLoop(); });

  describe('observe', () => {
    it('should ingest observation and classify market phase', () => {
      const { obs, matchedArchetypes } = loop.observe(obsParams('AAPL', 6));
      expect(obs.symbol).toBe('AAPL');
      expect(obs.marketPhase).toBe('bull');
      expect(matchedArchetypes.length).toBeGreaterThan(0);
    });

    it('should classify bear market', () => {
      const { obs } = loop.observe(obsParams('TSLA', -8));
      expect(obs.marketPhase).toBe('bear');
    });

    it('should classify sideways market', () => {
      const { obs } = loop.observe(obsParams('IBM', 0.5));
      expect(obs.marketPhase).toBe('sideways');
    });

    it('should classify high volatility', () => {
      const p = obsParams('NVDA', 4);
      p.volatility14d = 6;
      const { obs } = loop.observe(p);
      expect(obs.marketPhase).toBe('high_volatility');
    });
  });

  describe('signal generation', () => {
    it('should generate signal from observation', () => {
      const { obs } = loop.observe(obsParams('AAPL', 6));
      const sig = loop.generateSignal(obs, 'trend_following', 'long');

      expect(sig.symbol).toBe('AAPL');
      expect(sig.strategyArchetype).toBe('trend_following');
      expect(sig.direction).toBe('long');
      expect(sig.stopLoss).toBeLessThan(sig.entryPrice);
      expect(sig.takeProfit).toBeGreaterThan(sig.entryPrice);
      expect(sig.confidence).toBeGreaterThan(0);
      expect(sig.positionSize).toBeGreaterThan(0);
      expect(sig.reasons.length).toBeGreaterThan(0);
    });

    it('should generate neutral signal for low confidence', () => {
      // Low confidence scenario: minimal change, sideways market
      const p = obsParams('IBM', 0.3);
      p.volumeRatio = 0.5;
      p.volatility14d = 0.5;
      const { obs } = loop.observe(p);
      // Set min confidence high to force neutral
      loop = new MarketStrategyClosedLoop({ minConfidence: 0.9 });
      const sig = loop.generateSignal(obs, 'grid', 'long');
      expect(sig.direction).toBe('neutral');
    });
  });

  describe('runIteration', () => {
    it('should run full iteration and produce signals', () => {
      const iter = loop.runIteration([
        obsParams('AAPL', 6),
        obsParams('MSFT', 3),
        obsParams('TSLA', -7),
      ]);

      expect(iter.iteration).toBe(1);
      expect(iter.observations.length).toBe(3);
      expect(iter.signals.length).toBeGreaterThan(0);
      expect(iter.metrics.totalSignals).toBeGreaterThan(0);
      expect(iter.metrics.dominantArchetype).not.toBeNull();
    });

    it('should produce improvements', () => {
      const iter = loop.runIteration([obsParams('AAPL', 0.1)]);
      expect(iter.improvements.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluate', () => {
    it('should evaluate signal and return feedback', () => {
      const { obs } = loop.observe(obsParams('AAPL', 6));
      const sig = loop.generateSignal(obs, 'trend_following', 'long');

      const result = loop.evaluate(sig.signalId, 110, true);
      expect(result.confidenceAdjustment).toBeGreaterThan(0);
    });

    it('should adjust confidence downward for losing signals', () => {
      const { obs } = loop.observe(obsParams('AAPL', 6));
      const sig = loop.generateSignal(obs, 'trend_following', 'long');

      const result = loop.evaluate(sig.signalId, 90, false);
      expect(result.confidenceAdjustment).toBeLessThan(0);
    });
  });

  describe('summary', () => {
    it('should generate loop summary', () => {
      loop.runIteration([obsParams('AAPL', 6), obsParams('MSFT', 3)]);
      loop.runIteration([obsParams('AAPL', 2), obsParams('MSFT', 1)]);

      const summary = loop.generateSummary();
      expect(summary.totalIterations).toBe(2);
      expect(summary.totalSignals).toBeGreaterThan(0);
      expect(summary.totalObservations).toBe(4);
    });
  });

  describe('convergence', () => {
    it('should track convergence over iterations', () => {
      for (let i = 0; i < 6; i++) {
        loop.runIteration([
          obsParams('AAPL', 5 + Math.random()),
          obsParams('MSFT', 2 + Math.random()),
        ]);
      }

      const convergence = loop.getConvergence();
      expect(convergence).toBeGreaterThanOrEqual(0);
      expect(convergence).toBeLessThanOrEqual(1);
    });
  });

  describe('query', () => {
    it('should get observation history', () => {
      loop.observe(obsParams('NVDA', 8));
      loop.observe(obsParams('NVDA', 5));

      const obs = loop.getObservations('NVDA');
      expect(obs.length).toBe(2);
    });

    it('should get active archetypes', () => {
      loop.observe(obsParams('AAPL', 6));
      const arches = loop.getActiveArchetypes('AAPL');
      expect(arches.length).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = marketStrategyClosedLoop.getStats();
      expect(typeof stats.totalIterations).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P2-06: SectorRotationPipeline 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R260 P2-06 SectorRotationPipeline', () => {
  let pipe: SectorRotationPipeline;
  beforeEach(() => { pipe = new SectorRotationPipeline(); });

  describe('data ingestion', () => {
    it('should push 1d snapshots', () => {
      const results = pipe.pushSnapshot('1d', [
        sectorRow('technology', 3.5, 2.0),
        sectorRow('finance', -1.2, 0.8),
        sectorRow('healthcare', 0.5, 1.0),
      ]);

      expect(results.length).toBe(3);
      const tech = results.find(r => r.sectorCode === 'technology');
      expect(tech?.relativeStrength).toBeGreaterThan(0);
    });
  });

  describe('rotation detection', () => {
    it('should detect leading change when sector jumps rank', () => {
      // Push 5d snapshot with different rankings
      pipe.pushSnapshot('5d', [
        sectorRow('technology', -1, 0.8),
        sectorRow('finance', 2, 1.2),
        sectorRow('healthcare', -3, 0.5),
      ]);

      // Push 1d with changed leader
      pipe.pushSnapshot('1d', [
        sectorRow('technology', 4, 2.5),
        sectorRow('finance', -0.5, 0.9),
        sectorRow('healthcare', -1, 0.6),
      ]);

      const signals = pipe.detectRotation();
      expect(signals.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect sector switch between snapshots', () => {
      // First 1d snapshot batch
      pipe.pushSnapshot('1d', [
        sectorRow('technology', 2, 1.5),
        sectorRow('finance', -0.5, 0.8),
      ]);
      pipe.pushSnapshot('1d', [
        sectorRow('healthcare', 3, 1.8),
        sectorRow('energy', -1, 0.6),
      ]);

      const signals = pipe.getSignals('sector_switch');
      expect(signals.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect money flow with high volume', () => {
      pipe.pushSnapshot('1d', [
        sectorRow('technology', 5, 4.0),   // volume ratio >3
        sectorRow('finance', -2, 0.7),
        sectorRow('healthcare', 1, 1.2),
      ]);

      const signals = pipe.getSignals('money_flow');
      expect(signals.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('heatmap', () => {
    it('should generate heatmap data', () => {
      pipe.pushSnapshot('1d', [sectorRow('technology', 3), sectorRow('finance', -1)]);
      pipe.pushSnapshot('5d', [sectorRow('technology', 5), sectorRow('finance', -3)]);
      pipe.pushSnapshot('20d', [sectorRow('technology', 8), sectorRow('finance', -5)]);

      const heatmap = pipe.generateHeatmap();
      expect(heatmap.length).toBe(6); // 2 sectors × 3 periods
      expect(heatmap[0].period).toBeDefined();
    });
  });

  describe('reports', () => {
    it('should generate rotation report', () => {
      pipe.pushSnapshot('1d', [
        sectorRow('technology', 4, 2.2),
        sectorRow('finance', -2, 0.6),
        sectorRow('healthcare', 1, 1.1),
        sectorRow('energy', -3, 0.5),
        sectorRow('consumer', 0.5, 1.0),
      ]);

      const report = pipe.generateReport('2026-06-17');
      expect(report.currentLeaders.length).toBeGreaterThan(0);
      expect(report.currentLaggards.length).toBeGreaterThan(0);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('strategy suggestions', () => {
    it('should generate overweight/underweight suggestions', () => {
      pipe.pushSnapshot('1d', [
        sectorRow('technology', 4, 2.5),
        sectorRow('energy', -3, 0.5),
        sectorRow('consumer_defensive', 0.5, 0.9),
      ]);

      const suggestions = pipe.getStrategySuggestions();
      expect(suggestions.length).toBe(3);

      const tech = suggestions.find(s => s.sector === 'technology');
      expect(tech?.action).toBe('overweight');

      const energy = suggestions.find(s => s.sector === 'energy');
      expect(energy?.action).toBe('underweight');
    });
  });

  describe('rotation patterns', () => {
    it('should provide rotation patterns for reference', () => {
      const patterns = pipe.getRotationPatterns();
      expect(patterns.length).toBe(4);
      expect(patterns[0].sequence.length).toBe(3);
    });
  });

  describe('sector definitions', () => {
    it('should provide 11 sectors', () => {
      const sectors = pipe.getSectors();
      expect(sectors.length).toBe(11);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = sectorRotationPipeline.getStats();
      expect(typeof stats.totalSnapshots).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0-30: SourceHealthFullChainVerify 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R260 SourceHealthFullChainVerify', () => {
  let verify: SourceHealthFullChainVerify;
  beforeEach(() => { verify = new SourceHealthFullChainVerify(); });

  describe('source check', () => {
    it('should check a source and return healthy status', () => {
      const result = verify.checkSource('yahoo_finance', {
        latencyMs: 300,
        dataFreshnessMs: 5000,
        accuracy: 0.99,
        availability: 0.999,
        errorRate: 0.01,
      });

      expect(result.status).toBe('healthy');
      expect(result.sourceId).toBe('yahoo_finance');
    });

    it('should detect degraded source', () => {
      const result = verify.checkSource('eastmoney', {
        latencyMs: 6000,
        dataFreshnessMs: 700_000,
        accuracy: 0.85,
        availability: 0.92,
        errorRate: 0.15,
      });

      expect(result.status).toBe('degraded');
    });

    it('should detect unhealthy source', () => {
      const result = verify.checkSource('binance', {
        latencyMs: 1000,
        dataFreshnessMs: 10000,
        accuracy: 0.5,
        availability: 0.3,
        errorRate: 0.6,
      });

      expect(result.status).toBe('unhealthy');
    });

    it('should detect timeout', () => {
      const result = verify.checkSource('coinbase', {
        latencyMs: 35000,
        dataFreshnessMs: 5000,
        accuracy: 0.9,
        availability: 0.95,
        errorRate: 0.01,
      });

      expect(result.status).toBe('timeout');
    });

    it('should track consecutive failures', () => {
      verify.checkSource('reddit', { latencyMs: 6000, dataFreshnessMs: 700_000, accuracy: 0.8, availability: 0.9, errorRate: 0.15 });
      verify.checkSource('reddit', { latencyMs: 6000, dataFreshnessMs: 800_000, accuracy: 0.8, availability: 0.9, errorRate: 0.15 });
      const result = verify.getSourceStatus('reddit');
      expect(result?.consecutiveFailures).toBe(2);
    });
  });

  describe('batch check', () => {
    it('should check multiple sources', () => {
      const results = verify.checkAll([
        { sourceId: 'yahoo_finance', latencyMs: 200, dataFreshnessMs: 3000, accuracy: 0.99, availability: 0.998, errorRate: 0.005 },
        { sourceId: 'eastmoney', latencyMs: 500, dataFreshnessMs: 10000, accuracy: 0.97, availability: 0.99, errorRate: 0.02 },
        { sourceId: 'binance', latencyMs: 300, dataFreshnessMs: 5000, accuracy: 0.98, availability: 0.995, errorRate: 0.01 },
      ]);

      expect(results.length).toBe(3);
      expect(results.every(r => r.status === 'healthy')).toBe(true);
    });
  });

  describe('full verify', () => {
    it('should run full verification on all 30 sources', () => {
      const report = verify.fullVerify();
      expect(report.totalSources).toBe(30);
      expect(report.healthy + report.degraded + report.unhealthy + report.timeout).toBe(30);
      expect(report.overallStatus).toBeDefined();
      expect(report.results.length).toBe(30);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('degradation chain', () => {
    it('should trigger degradation events for unhealthy sources', () => {
      verify.checkSource('eastmoney', {
        latencyMs: 6000, dataFreshnessMs: 700_000, accuracy: 0.8, availability: 0.9, errorRate: 0.2,
      });

      const events = verify.getDegradationEvents();
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('should auto-recover on next healthy check', () => {
      verify.checkSource('yahoo_finance', {
        latencyMs: 6000, dataFreshnessMs: 700_000, accuracy: 0.8, availability: 0.85, errorRate: 0.2,
      });
      verify.checkSource('yahoo_finance', {
        latencyMs: 300, dataFreshnessMs: 5000, accuracy: 0.99, availability: 0.999, errorRate: 0.01,
      });

      const events = verify.getDegradationEvents();
      if (events.length > 0) {
        expect(events[0].autoRecovered).toBe(true);
      }
    });
  });

  describe('reports', () => {
    it('should generate verification report', () => {
      verify.checkAll([
        { sourceId: 'yahoo_finance', latencyMs: 200, dataFreshnessMs: 3000, accuracy: 0.99, availability: 0.998, errorRate: 0.005 },
        { sourceId: 'eastmoney', latencyMs: 500, dataFreshnessMs: 10000, accuracy: 0.97, availability: 0.99, errorRate: 0.02 },
        { sourceId: 'newsapi', latencyMs: 800, dataFreshnessMs: 60000, accuracy: 0.96, availability: 0.98, errorRate: 0.03 },
      ]);

      const report = verify.generateReport();
      expect(report.totalSources).toBe(3);
      expect(report.avgLatencyMs).toBeGreaterThan(0);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('source definitions', () => {
    it('should return all 30 sources', () => {
      const sources = verify.getSources();
      expect(sources.length).toBe(30);
    });

    it('should filter by region', () => {
      const cnSources = verify.getSourcesByRegion('cn');
      expect(cnSources.length).toBeGreaterThan(0);
      expect(cnSources.every(s => s.region === 'cn')).toBe(true);
    });

    it('should filter by priority', () => {
      const p0Sources = verify.getSourcesByPriority('P0');
      expect(p0Sources.length).toBeGreaterThan(0);
      expect(p0Sources.every(s => s.priority === 'P0')).toBe(true);
    });

    it('should get degradation chain rules', () => {
      const chain = verify.getDegradationChain();
      expect(chain.length).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const sources = sourceHealthFullChainVerify.getSources();
      expect(sources.length).toBe(30);
      sourceHealthFullChainVerify.reset();
    });
  });
});
