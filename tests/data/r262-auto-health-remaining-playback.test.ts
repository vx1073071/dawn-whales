/**
 * R262 autoclaw 综合测试 — 源健康桥接 + 剩余桥接收尾 + 回放数据桥接
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SourceHealthIpcBridge, sourceHealthIpcBridge } from '../../electron/engine/data/source-health-ipc-bridge';
import { RemainingBridgeFinalize, remainingBridgeFinalize } from '../../electron/engine/data/remaining-bridge-finalize';
import { PlaybackDataBridge, playbackDataBridge } from '../../electron/engine/data/playback-data-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// SourceHealthIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R262 SourceHealthIpcBridge', () => {
  let bridge: SourceHealthIpcBridge;
  beforeEach(() => { bridge = new SourceHealthIpcBridge(); });

  describe('feed source health', () => {
    it('should feed and retrieve health row', () => {
      const row = bridge.feedSourceHealth({
        sourceId: 'yahoo_finance', name: 'Yahoo Finance', nameCn: '雅虎财经',
        region: 'global', category: 'aggregator', priority: 'P0',
        status: 'healthy', latencyMs: 200, accuracy: 0.99,
        availability: 0.998, uptimePercent: 99.8,
      });

      expect(row.sourceId).toBe('yahoo_finance');
      expect(row.status).toBe('healthy');
      expect(row.trend).toBe('stable');
    });

    it('should detect trend changes', () => {
      bridge.feedSourceHealth({
        sourceId: 'eastmoney', name: 'EastMoney', nameCn: '东方财富',
        region: 'cn', category: 'aggregator', priority: 'P0',
        status: 'healthy', latencyMs: 300, accuracy: 0.97,
        availability: 0.99, uptimePercent: 99,
      });

      const row2 = bridge.feedSourceHealth({
        sourceId: 'eastmoney', name: 'EastMoney', nameCn: '东方财富',
        region: 'cn', category: 'aggregator', priority: 'P0',
        status: 'degraded', latencyMs: 5000, accuracy: 0.85,
        availability: 0.92, uptimePercent: 92,
      });

      expect(row2.trend).toBe('down');
    });
  });

  describe('alerts', () => {
    it('should create critical alert for unhealthy source', () => {
      bridge.feedSourceHealth({
        sourceId: 'binance', name: 'Binance', nameCn: '币安',
        region: 'crypto', category: 'exchange', priority: 'P0',
        status: 'unhealthy', latencyMs: 30000, accuracy: 0.5,
        availability: 0.3, uptimePercent: 30,
      });

      const alerts = bridge.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should create warning alert for degraded source', () => {
      bridge.feedSourceHealth({
        sourceId: 'newsapi', name: 'NewsAPI', nameCn: 'NewsAPI',
        region: 'global', category: 'news', priority: 'P0',
        status: 'degraded', latencyMs: 4000, accuracy: 0.88,
        availability: 0.95, uptimePercent: 95,
      });

      const alerts = bridge.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('warning');
    });

    it('should acknowledge alerts', () => {
      bridge.feedSourceHealth({
        sourceId: 'binance', name: 'Binance', nameCn: '币安',
        region: 'crypto', category: 'exchange', priority: 'P0',
        status: 'unhealthy', latencyMs: 30000, accuracy: 0.5,
        availability: 0.3, uptimePercent: 30,
      });

      const alerts = bridge.getActiveAlerts();
      bridge.acknowledgeAlert(alerts[0].eventId);
      expect(bridge.getActiveAlerts().length).toBe(0);
    });
  });

  describe('dashboard', () => {
    it('should generate dashboard data', () => {
      bridge.feedSourceHealth({ sourceId: 's1', name: 'S1', nameCn: 'S1', region: 'global', category: 'exchange', priority: 'P0', status: 'healthy', latencyMs: 200, accuracy: 0.99, availability: 0.99, uptimePercent: 99 });
      bridge.feedSourceHealth({ sourceId: 's2', name: 'S2', nameCn: 'S2', region: 'cn', category: 'news', priority: 'P0', status: 'degraded', latencyMs: 5000, accuracy: 0.85, availability: 0.9, uptimePercent: 90 });

      const dashboard = bridge.generateDashboard();
      expect(dashboard.summary.total).toBe(2);
      expect(dashboard.summary.healthy).toBe(1);
      expect(dashboard.summary.degraded).toBe(1);
      expect(dashboard.rows.length).toBe(2);
    });
  });

  describe('IPC payload', () => {
    it('should generate minimal IPC payload for tray', () => {
      bridge.feedSourceHealth({ sourceId: 's1', name: 'S1', nameCn: 'S1', region: 'global', category: 'exchange', priority: 'P0', status: 'healthy', latencyMs: 200, accuracy: 0.99, availability: 0.99, uptimePercent: 99 });

      const payload = bridge.getIpcPayload();
      expect(payload.healthyCount).toBe(1);
      expect(payload.totalCount).toBe(1);
      expect(payload.status).toBe('healthy');
    });

    it('should show warning when degraded sources exist', () => {
      bridge.feedSourceHealth({ sourceId: 's1', name: 'S1', nameCn: 'S1', region: 'global', category: 'exchange', priority: 'P0', status: 'degraded', latencyMs: 5000, accuracy: 0.85, availability: 0.9, uptimePercent: 90 });

      const payload = bridge.getIpcPayload();
      expect(payload.status).toBe('warning');
    });
  });

  describe('trend', () => {
    it('should track health trend over time', () => {
      bridge.feedSourceHealth({ sourceId: 's1', name: 'S1', nameCn: 'S1', region: 'global', category: 'exchange', priority: 'P0', status: 'healthy', latencyMs: 200, accuracy: 0.99, availability: 0.99, uptimePercent: 99 });
      bridge.generateDashboard();
      bridge.generateDashboard();

      const trend = bridge.getTrend();
      expect(trend.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const rows = sourceHealthIpcBridge.getRows();
      expect(Array.isArray(rows)).toBe(true);
      sourceHealthIpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RemainingBridgeFinalize 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R262 RemainingBridgeFinalize', () => {
  let finalize: RemainingBridgeFinalize;
  beforeEach(() => { finalize = new RemainingBridgeFinalize(); });

  describe('wiring', () => {
    it('should wire all remaining bridges', () => {
      const result = finalize.wireAll();
      expect(result.channels).toContain('community');
      expect(result.channels).toContain('comparison');
      expect(result.channels).toContain('tray');
    });

    it('should verify wiring', () => {
      finalize.wireAll();
      expect(finalize.verifyWiring()).toBe(true);
    });
  });

  describe('community IPC', () => {
    it('should bridge follow events', () => {
      const event = finalize.bridgeCommunityEvent({
        type: 'follow_event', actorName: 'TraderA', actorId: 'a1',
        targetName: 'TraderB', targetId: 'b1',
      });

      expect(event.type).toBe('follow_event');
      expect(event.message).toContain('TraderA');
    });

    it('should bridge like events', () => {
      const event = finalize.bridgeCommunityEvent({
        type: 'like_event', actorName: 'TraderA', actorId: 'a1',
        targetName: 'Golden Cross', targetId: 's1',
      });

      expect(event.type).toBe('like_event');
      expect(event.messageCn).toContain('点赞');
    });

    it('should bridge leaderboard', () => {
      const event = finalize.bridgeLeaderboard([
        { rank: 1, userId: 'a', username: 'a', displayName: 'Alpha', score: 95, category: 'total_return' },
        { rank: 2, userId: 'b', username: 'b', displayName: 'Beta', score: 80, category: 'total_return' },
      ]);

      expect(event.type).toBe('leaderboard_update');
    });
  });

  describe('comparison PK IPC', () => {
    it('should bridge PK results', () => {
      const data = finalize.bridgeComparison({
        pkId: 'pk:AAPL:MSFT:123',
        symbols: ['AAPL', 'MSFT'],
        winner: 'AAPL',
        winnerName: 'Apple',
        compositeScores: { AAPL: 78, MSFT: 65 },
        radarData: [
          { symbol: 'AAPL', name: 'Apple', values: [70, 80, 60, 75, 85, 70, 65] },
          { symbol: 'MSFT', name: 'Microsoft', values: [60, 65, 70, 60, 70, 65, 50] },
        ],
        summaryEn: 'AAPL wins',
        summaryCn: 'AAPL胜出',
      });

      expect(data.winner).toBe('AAPL');
      expect(data.radarData.length).toBe(2);
    });
  });

  describe('tray IPC', () => {
    it('should bridge tray quote updates', () => {
      const update = finalize.bridgeTrayQuote('AAPL', 185.5, 2.3);
      expect(update.type).toBe('quote_update');
      expect(update.data.price).toBe(185.5);
    });

    it('should bridge tray alerts', () => {
      const update = finalize.bridgeTrayAlert('AAPL', 'price_alert', 'AAPL up 5%', 'AAPL涨5%');
      expect(update.type).toBe('alert_update');
      expect(update.data.symbol).toBe('AAPL');
    });

    it('should bridge tray mini toggle', () => {
      const update = finalize.bridgeTrayMiniToggle(true, 'AAPL');
      expect(update.type).toBe('mini_toggle');
      expect(update.data.visible).toBe(true);
    });

    it('should bridge tray health', () => {
      const update = finalize.bridgeTrayHealth(28, 30, ['Binance', 'NewsAPI']);
      expect(update.type).toBe('health_update');
      expect(update.data.healthyCount).toBe(28);
      expect(update.data.status).toBe('mostly_healthy');
    });
  });

  describe('IPC messages', () => {
    it('should queue IPC messages for each bridge event', () => {
      finalize.bridgeCommunityEvent({ type: 'follow_event', actorName: 'A', actorId: 'a' });
      finalize.bridgeComparison({ pkId: 'pk:1', symbols: ['A','B'], winner: 'A', winnerName: 'A', compositeScores: {A:1,B:0}, radarData: [], summaryEn: '', summaryCn: '' });
      finalize.bridgeTrayQuote('AAPL', 185, 1);

      const messages = finalize.getIpcMessages();
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by channel', () => {
      finalize.bridgeTrayQuote('AAPL', 185, 1);
      finalize.bridgeTrayAlert('AAPL', 'price', 'test', '测试');

      const trayMsgs = finalize.getIpcMessages('tray');
      expect(trayMsgs.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark messages as delivered', () => {
      finalize.bridgeTrayQuote('AAPL', 185, 1);
      const msgs = finalize.getIpcMessages('tray');
      const ids = msgs.map(m => m.messageId);

      const delivered = finalize.markDelivered(ids);
      expect(delivered).toBeGreaterThanOrEqual(1);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const stats = remainingBridgeFinalize.getStats();
      expect(typeof stats.totalMessages).toBe('number');
      remainingBridgeFinalize.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PlaybackDataBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R262 PlaybackDataBridge', () => {
  let bridge: PlaybackDataBridge;
  beforeEach(() => { bridge = new PlaybackDataBridge(); });

  describe('data loading', () => {
    it('should load ticks', () => {
      const ticks = bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
        { timestamp: 3000, price: 182, volume: 1500 },
      ]);

      expect(ticks.length).toBe(3);
      expect(bridge.getTickCount('AAPL')).toBe(3);
    });

    it('should load candles from ticks', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 0, price: 180, volume: 1000 },
        { timestamp: 30_000, price: 181, volume: 2000 },
        { timestamp: 60_000, price: 182, volume: 1500 },
        { timestamp: 90_000, price: 179, volume: 3000 },
      ]);

      const candles = bridge.loadCandles('AAPL', '1m');
      expect(candles.length).toBeGreaterThanOrEqual(1);
      expect(candles[0].open).toBeDefined();
      expect(candles[0].high).toBeDefined();
    });
  });

  describe('markers', () => {
    it('should add markers', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 190, volume: 5000 },
      ]);

      bridge.addMarker('AAPL', {
        timestamp: 2000, type: 'alert',
        label: 'Price spike', labelCn: '价格跳升', severity: 'high',
      });

      const session = bridge.createSession('AAPL');
      expect(session?.markers.length).toBe(1);
    });

    it('should batch add markers', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 5000, price: 185, volume: 2000 },
      ]);

      bridge.addMarkers('AAPL', [
        { timestamp: 1000, type: 'event', label: 'Start', labelCn: '开始', severity: 'low' },
        { timestamp: 5000, type: 'signal', label: 'Buy signal', labelCn: '买入', severity: 'high' },
      ]);

      const session = bridge.createSession('AAPL');
      expect(session?.markers.length).toBe(2);
    });
  });

  describe('session management', () => {
    it('should create a playback session', () => {
      bridge.loadTicks('TSLA', [
        { timestamp: 1000, price: 250, volume: 5000 },
        { timestamp: 2000, price: 252, volume: 3000 },
        { timestamp: 3000, price: 248, volume: 8000 },
      ]);

      const session = bridge.createSession('TSLA');
      expect(session).not.toBeNull();
      if (session) {
        expect(session.symbol).toBe('TSLA');
        expect(session.totalTicks).toBe(3);
        expect(session.state).toBe('stopped');
      }
    });
  });

  describe('playback control', () => {
    it('should play and advance frames', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
        { timestamp: 3000, price: 182, volume: 1500 },
      ]);

      const session = bridge.createSession('AAPL')!;
      bridge.play(session.sessionId, 1);

      const frame = bridge.nextFrame(session.sessionId);
      expect(frame).not.toBeNull();
      if (frame) {
        expect(frame.price).toBe(181);
        expect(frame.state).toBe('playing');
      }
    });

    it('should pause and resume', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
      ]);

      const session = bridge.createSession('AAPL')!;
      bridge.play(session.sessionId);
      bridge.pause(session.sessionId);

      const s = bridge.getSession(session.sessionId);
      expect(s?.state).toBe('paused');

      bridge.play(session.sessionId);
      expect(bridge.getSession(session.sessionId)?.state).toBe('playing');
    });

    it('should stop and reset', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 190, volume: 2000 },
      ]);

      const session = bridge.createSession('AAPL')!;
      bridge.play(session.sessionId);
      bridge.nextFrame(session.sessionId);
      bridge.stop(session.sessionId);

      const s = bridge.getSession(session.sessionId);
      expect(s?.state).toBe('stopped');
      expect(s?.currentTick).toBe(0);
      expect(s?.progress).toBe(0);
    });

    it('should seek to specific tick', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
        { timestamp: 3000, price: 182, volume: 1500 },
      ]);

      const session = bridge.createSession('AAPL')!;
      const frame = bridge.seek(session.sessionId, 2);
      expect(frame?.price).toBe(182);
    });

    it('should set playback speed', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
        { timestamp: 3000, price: 182, volume: 1500 },
      ]);

      const session = bridge.createSession('AAPL')!;
      bridge.setSpeed(session.sessionId, 4);
      bridge.play(session.sessionId, 4);

      expect(bridge.getSession(session.sessionId)?.speed).toBe(4);
    });
  });

  describe('time axis', () => {
    it('should return time axis data', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 181, volume: 2000 },
      ]);

      const session = bridge.createSession('AAPL')!;
      const axis = bridge.getTimeAxis(session.sessionId);
      expect(axis).not.toBeNull();
      expect(axis!.length).toBeGreaterThan(0);
    });
  });

  describe('stats', () => {
    it('should calculate playback stats', () => {
      bridge.loadTicks('AAPL', [
        { timestamp: 1000, price: 180, volume: 1000 },
        { timestamp: 2000, price: 190, volume: 2000 },
        { timestamp: 3000, price: 185, volume: 1500 },
      ]);

      const session = bridge.createSession('AAPL')!;
      expect(session.sessionStats.openPrice).toBe(180);
      expect(session.sessionStats.closePrice).toBe(185);
      expect(session.sessionStats.highPrice).toBe(190);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const symbols = playbackDataBridge.getLoadedSymbols();
      expect(Array.isArray(symbols)).toBe(true);
      playbackDataBridge.reset();
    });
  });
});
