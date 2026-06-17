/**
 * R264 autoclaw 综合测试 — 防骚扰 + 回放IPC + 全桥接E2E
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AntiNoiseBridge, antiNoiseBridge } from '../../electron/engine/data/anti-noise-bridge';
import { PlaybackIpcBridge, playbackIpcBridge } from '../../electron/engine/data/playback-ipc-bridge';
import { FullBridgeE2E, fullBridgeE2E } from '../../electron/engine/data/full-bridge-e2e';

// ── Helpers ────────────────────────────────────────────────────────────────
const makeCandidate = (symbol: string, severity: string, change: number) => ({
  pushId: `push:${symbol}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
  symbol, type: 'price_alert',
  severity: severity as any,
  title: `${symbol} ${change > 0 ? '+' : ''}${change}%`,
  titleCn: `${symbol} ${change > 0 ? '+' : ''}${change}%`,
  body: `Price changed ${change}%`,
  bodyCn: `价格变化${change}%`,
  price: 100 + change,
  changePercent: change,
  timestamp: Date.now(),
});

// ═══════════════════════════════════════════════════════════════════════════
// AntiNoiseBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R264 AntiNoiseBridge', () => {
  let bridge: AntiNoiseBridge;
  beforeEach(() => { bridge = new AntiNoiseBridge(); bridge.setQuietHours({ enabled: false }); });

  describe('basic filtering', () => {
    it('should allow valid pushes', () => {
      const result = bridge.filter(makeCandidate('AAPL', 'high', 5));
      expect(result.allowed).toBe(true);
    });

    it('should dedup identical pushes', () => {
      const c = makeCandidate('AAPL', 'high', 5);
      bridge.filter(c);
      const result2 = bridge.filter(c);

      expect(result2.allowed).toBe(false);
      expect(result2.blockReason).toContain('Duplicate');
    });

    it('should allow different pushes through', () => {
      bridge.filter(makeCandidate('AAPL', 'high', 5));
      const result = bridge.filter(makeCandidate('MSFT', 'high', 3));

      expect(result.allowed).toBe(true);
    });
  });

  describe('quiet hours', () => {
    it('should block pushes during quiet hours', () => {
      bridge.setQuietHours({ enabled: true, startHour: 0, endHour: 23, timezone: 'Asia/Hong_Kong', allowCritical: false });

      const result = bridge.filter(makeCandidate('AAPL', 'low', 0.5));
      expect(result.allowed).toBe(false);
      expect(result.blockReason).toContain('quiet');
    });

    it('should allow critical pushes even during quiet hours', () => {
      bridge.setQuietHours({ enabled: true, startHour: 0, endHour: 23, timezone: 'Asia/Hong_Kong', allowCritical: true });

      const result = bridge.filter(makeCandidate('AAPL', 'critical', 30));
      expect(result.allowed).toBe(true);
    });
  });

  describe('noise filter', () => {
    it('should filter micro changes', () => {
      bridge.setNoiseFilter(true);
      const result = bridge.filter(makeCandidate('IBM', 'low', 0.01));
      expect(result.allowed).toBe(false);
      expect(result.blockReason).toContain('Noise');
    });

    it('should allow significant changes through noise filter', () => {
      bridge.setNoiseFilter(true);
      const result = bridge.filter(makeCandidate('TSLA', 'high', 5));
      expect(result.allowed).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should allow pushes within rate limits', () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        // Unique change% to avoid dedup
        results.push(bridge.filter({ ...makeCandidate('AAPL', 'medium', 2 + i * 0.5), pushId: `p${i}` }));
      }
      // Dedup may block duplicates but unique values should pass
      expect(results.some(r => r.allowed)).toBe(true);
    });

    it('should block when per-symbol hourly limit hit', () => {
      bridge.setRateLimit({ maxPerHour: 2, maxPerDay: 20, maxTotalPerHour: 50, maxTotalPerDay: 200 });

      bridge.filter({ ...makeCandidate('AAPL', 'medium', 2.0), pushId: 'p1' });
      bridge.filter({ ...makeCandidate('AAPL', 'medium', 2.5), pushId: 'p2' });
      // 3rd push should hit rate limit
      bridge.filter({ ...makeCandidate('AAPL', 'medium', 3.0), pushId: 'p3' });

      const stats = bridge.getStats();
      // Rate limit should have blocked at least one
      expect(stats.blockedRateLimit).toBeGreaterThanOrEqual(1);
    });
  });

  describe('batch filtering', () => {
    it('should filter batch of candidates', () => {
      const results = bridge.filterBatch([
        makeCandidate('AAPL', 'high', 5),
        makeCandidate('MSFT', 'medium', 2),
      ]);

      expect(results.length).toBe(2);
      expect(results.every(r => r.allowed)).toBe(true);
    });
  });

  describe('batched pushes', () => {
    it('should collect batched pushes', () => {
      bridge.setQuietHours({ enabled: true, startHour: 0, endHour: 23, timezone: 'Asia/Hong_Kong', allowCritical: false });
      bridge.filter(makeCandidate('AAPL', 'low', 0.5));

      const batched = bridge.getBatched();
      expect(batched.length).toBeGreaterThanOrEqual(1);
    });

    it('should flush batched pushes', () => {
      bridge.setQuietHours({ enabled: true, startHour: 0, endHour: 23, timezone: 'Asia/Hong_Kong', allowCritical: false });
      bridge.filter(makeCandidate('AAPL', 'low', 0.5));

      const flushed = bridge.flushBatched();
      expect(flushed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('stats', () => {
    it('should track filter stats', () => {
      bridge.setNoiseFilter(true);
      bridge.filter(makeCandidate('AAPL', 'high', 5));
      bridge.filter(makeCandidate('IBM', 'low', 0.01));

      const stats = bridge.getStats();
      expect(stats.totalCandidates).toBe(2);
      expect(stats.allowed).toBe(1);
      expect(stats.blockedNoise).toBe(1);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = antiNoiseBridge.getStats();
      expect(typeof stats.totalCandidates).toBe('number');
      antiNoiseBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PlaybackIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R264 PlaybackIpcBridge', () => {
  let bridge: PlaybackIpcBridge;
  beforeEach(() => { bridge = new PlaybackIpcBridge(); });

  describe('session', () => {
    it('should register a session', () => {
      const session = bridge.registerSession({
        sessionId: 's1', symbol: 'AAPL', interval: '1m',
        totalTicks: 100, startTime: 1000, endTime: 100_000,
      });

      expect(session.symbol).toBe('AAPL');
      expect(session.state).toBe('stopped');
    });
  });

  describe('frame push', () => {
    it('should push frames and update session', () => {
      bridge.registerSession({
        sessionId: 's1', symbol: 'AAPL', interval: '1m',
        totalTicks: 100, startTime: 1000, endTime: 100_000,
      });

      bridge.pushFrame({
        sessionId: 's1', symbol: 'AAPL', sequence: 1,
        timestamp: 2000, price: 185, volume: 5000,
        state: 'playing', speed: 1, progress: 0.01,
      });

      const session = bridge.getSession('s1');
      expect(session?.state).toBe('playing');
      expect(session?.currentPrice).toBe(185);
    });

    it('should queue frames', () => {
      bridge.registerSession({
        sessionId: 's1', symbol: 'TSLA', interval: '1m',
        totalTicks: 50, startTime: 1000, endTime: 50000,
      });

      bridge.pushFrame({ sessionId: 's1', symbol: 'TSLA', sequence: 1, timestamp: 2000, price: 250, volume: 10000, state: 'playing', speed: 1, progress: 0.02 });
      bridge.pushFrame({ sessionId: 's1', symbol: 'TSLA', sequence: 2, timestamp: 3000, price: 251, volume: 8000, state: 'playing', speed: 1, progress: 0.04 });

      const frames = bridge.getFrames('s1');
      expect(frames.length).toBe(2);
    });
  });

  describe('timeline', () => {
    it('should register and retrieve timeline', () => {
      const timeline = bridge.registerTimeline({
        sessionId: 's1', symbol: 'AAPL', interval: '1m',
        startTime: 1000, endTime: 100_000,
        data: [{ time: 1000, price: 180, volume: 1000 }],
        markers: [],
        stats: { totalTicks: 100, highPrice: 200, lowPrice: 180, openPrice: 180, closePrice: 195, changePercent: 8.3, maxChange: 12 },
      });

      const retrieved = bridge.getTimeline('s1');
      expect(retrieved?.stats.openPrice).toBe(180);
    });
  });

  describe('control', () => {
    it('should handle play control', () => {
      bridge.registerSession({ sessionId: 's1', symbol: 'AAPL', interval: '1m', totalTicks: 100, startTime: 1000, endTime: 100_000 });

      const result = bridge.handleControl({
        sessionId: 's1', action: 'play',
        params: { speed: 2 },
        requestId: 'req1', timestamp: Date.now(),
      });

      expect(result.accepted).toBe(true);
      expect(result.session?.state).toBe('playing');
      expect(result.session?.speed).toBe(2);
    });

    it('should handle pause', () => {
      bridge.registerSession({ sessionId: 's1', symbol: 'AAPL', interval: '1m', totalTicks: 100, startTime: 1000, endTime: 100_000 });
      bridge.handleControl({ sessionId: 's1', action: 'play', params: {}, requestId: 'r1', timestamp: 0 });
      bridge.handleControl({ sessionId: 's1', action: 'pause', params: {}, requestId: 'r2', timestamp: 0 });

      expect(bridge.getSession('s1')?.state).toBe('paused');
    });

    it('should handle stop', () => {
      bridge.registerSession({ sessionId: 's1', symbol: 'AAPL', interval: '1m', totalTicks: 100, startTime: 1000, endTime: 100_000 });
      bridge.handleControl({ sessionId: 's1', action: 'play', params: {}, requestId: 'r1', timestamp: 0 });
      bridge.handleControl({ sessionId: 's1', action: 'stop', params: {}, requestId: 'r2', timestamp: 0 });

      expect(bridge.getSession('s1')?.state).toBe('stopped');
      expect(bridge.getSession('s1')?.progress).toBe(0);
    });

    it('should reject unknown session', () => {
      const result = bridge.handleControl({
        sessionId: 'unknown', action: 'play',
        params: {}, requestId: 'r1', timestamp: 0,
      });
      expect(result.accepted).toBe(false);
    });
  });

  describe('markers', () => {
    it('should format markers with colors', () => {
      const markers = bridge.formatMarkers([
        { markerId: 'm1', time: 5000, type: 'alert', label: 'Alert', labelCn: '预警', severity: 'high' },
        { markerId: 'm2', time: 10000, type: 'news', label: 'News', labelCn: '新闻', severity: 'low' },
      ]);

      expect(markers.length).toBe(2);
      expect(markers[0].color).toBe('#ef4444');
      expect(markers[1].color).toBe('#f59e0b');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = playbackIpcBridge.getStats();
      expect(typeof stats.totalFrames).toBe('number');
      playbackIpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FullBridgeE2E 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R264 FullBridgeE2E', () => {
  let e2e: FullBridgeE2E;
  beforeEach(() => { e2e = new FullBridgeE2E(); });

  describe('bridge registry', () => {
    it('should have 37 bridges registered', () => {
      const bridges = e2e.getBridges();
      expect(bridges.length).toBe(37);
    });

    it('should categorize bridges', () => {
      const dataSources = e2e.getByCategory('data_source');
      const pipelines = e2e.getByCategory('pipeline');
      const intelligence = e2e.getByCategory('intelligence');
      const bridges_ = e2e.getByCategory('bridge');

      expect(dataSources.length).toBeGreaterThan(0);
      expect(pipelines.length).toBeGreaterThan(0);
      expect(intelligence.length).toBeGreaterThan(0);
      expect(bridges_.length).toBeGreaterThan(0);
    });
  });

  describe('verification', () => {
    it('should verify all bridges', () => {
      const { verified, total } = e2e.verifyAll();
      expect(verified).toBe(total);
    });

    it('should verify individual bridges', () => {
      expect(e2e.verifyBridge('push-ipc-bridge')).toBe(true);
      expect(e2e.verifyBridge('invalid')).toBe(false);
    });

    it('should verify all chains', () => {
      e2e.verifyAll();
      const { verified, total } = e2e.verifyChains();
      expect(verified).toBe(total);
    });
  });

  describe('coverage', () => {
    it('should calculate coverage', () => {
      e2e.verifyAll();
      const coverage = e2e.getCoverage();
      expect(coverage.percent).toBe(100);
    });
  });

  describe('report', () => {
    it('should generate full E2E report', () => {
      e2e.verifyAll();
      e2e.verifyChains();

      const report = e2e.generateReport();
      expect(report.totalBridges).toBe(37);
      expect(report.verifiedBridges).toBe(37);
      expect(report.coveragePercent).toBe(100);
      expect(report.chains.length).toBe(6);
      expect(report.summaryEn).not.toBe('');
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const bridges = fullBridgeE2E.getBridges();
      expect(bridges.length).toBe(37);
      fullBridgeE2E.reset();
    });
  });
});
