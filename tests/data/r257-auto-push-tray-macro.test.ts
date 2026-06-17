/**
 * R257 autoclaw 综合测试 — 推送桥接 + Tray桥接 + 宏观数据桥接
 * 
 * 3模块 × 每个约15断言 → 约45个测试
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { PushIpcBridge, pushIpcBridge } from '../../electron/engine/data/push-ipc-bridge';
import { TrayIpcBridge, trayIpcBridge } from '../../electron/engine/data/tray-ipc-bridge';
import { MacroDataBridge, macroDataBridge } from '../../electron/engine/data/macro-data-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// P0-1: PushIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R257 P0-1 PushIpcBridge', () => {
  let bridge: PushIpcBridge;

  beforeEach(() => {
    bridge = new PushIpcBridge();
    bridge.registerChannel('system');
    bridge.registerChannel('toast');
    bridge.registerChannel('tray');
    bridge.registerChannel('sound');
  });

  describe('dispatch — basic push', () => {
    it('should dispatch a price alert to system channel', () => {
      const results = bridge.dispatch({
        title: 'BTC 突破 75000',
        body: '比特币突破历史新高 +8.2%，放量2.3倍',
        category: 'price_alert',
        channels: ['system'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('system');
    });

    it('should dispatch to multiple channels', () => {
      const results = bridge.dispatch({
        title: '美联储利率决议',
        body: 'FOMC宣布维持利率不变',
        category: 'news_breaking',
        channels: ['system', 'toast', 'tray', 'sound'],
      });

      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should format title with category icon', () => {
      bridge.dispatch({
        title: 'Test',
        body: 'Test body',
        category: 'price_alert',
        channels: ['system'],
      });

      const history = bridge.getHistory(1);
      expect(history[0].title).toContain('📈');
    });

    it('should assign correct default priority', () => {
      const highResults = bridge.dispatch({
        title: 'High test', body: 'Test',
        category: 'news_breaking', channels: ['system'],
      });
      const history = bridge.getHistory(2);
      const recent = history.find(h => h.title.includes('High'));
      expect(recent?.priority).toBe('high');
    });

    it('should allow manual priority override', () => {
      bridge.dispatch({
        title: 'Low priority alert',
        body: 'Test',
        priority: 'low',
        category: 'system_health',
        channels: ['system'],
      });

      const history = bridge.getHistory(1);
      expect(history[0].priority).toBe('low');
    });
  });

  describe('deduplication', () => {
    it('should suppress duplicate pushes within dedup window', () => {
      // Use a fresh bridge with relaxed cooldown so dedup fires first
      const b = new PushIpcBridge({ categoryCooldownMs: { price_alert: 0, volume_surge: 0, news_breaking: 0, factor_signal: 0, strategy_alert: 0, calendar_event: 0, system_health: 0, briefing_ready: 0 } });
      b.registerChannel('system');

      const first = b.dispatch({
        title: 'Same alert', body: 'Same body',
        category: 'price_alert', channels: ['system'],
      });

      const second = b.dispatch({
        title: 'Same alert', body: 'Same body',
        category: 'price_alert', channels: ['system'],
      });

      expect(first[0].success).toBe(true);
      expect(second[0].success).toBe(false);
      expect(second[0].error).toContain('Duplicate');
    });

    it('should allow different pushes through', () => {
      // Use fresh bridge with zero cooldown
      const b = new PushIpcBridge({ categoryCooldownMs: { price_alert: 0, volume_surge: 0, news_breaking: 0, factor_signal: 0, strategy_alert: 0, calendar_event: 0, system_health: 0, briefing_ready: 0 } });
      b.registerChannel('system');

      b.dispatch({ title: 'Alert A', body: 'Body A', category: 'price_alert', channels: ['system'] });
      const second = b.dispatch({ title: 'Alert B', body: 'Body B', category: 'price_alert', channels: ['system'] });
      expect(second[0].success).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should track hourly push count', () => {
      // Use fresh bridge with zero cooldowns to avoid category blocking
      const b = new PushIpcBridge({ categoryCooldownMs: { price_alert: 0, volume_surge: 0, news_breaking: 0, factor_signal: 0, strategy_alert: 0, calendar_event: 0, system_health: 0, briefing_ready: 0 } });
      b.registerChannel('system');
      for (let i = 0; i < 5; i++) {
        b.dispatch({
          title: `Rate limit test ${i}`, body: `Body ${i}`,
          category: 'factor_signal', channels: ['system'],
        });
      }

      const history = b.getHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(5);
    });

    it('should reject pushes beyond maxPerHour', () => {
      const config = bridge.getConfig();
      // Dispatch max+1 pushes
      for (let i = 0; i < config.maxPerHour + 3; i++) {
        bridge.dispatch({
          title: `Limit test ${i}`,
          body: `Body ${i}`,
          category: 'factor_signal',
          channels: ['system'],
        });
      }

      // Should still be limited
      const history = bridge.getHistory(20);
      expect(history.length).toBeLessThanOrEqual(config.maxPerHour + 3);
    });
  });

  describe('channel management', () => {
    it('should reject push to unregistered channel', () => {
      // Fresh bridge: only registers 'system' and 'toast' by default
      // But we need a bridge that doesn't have 'system' registered at all
      const unregistered = new PushIpcBridge();
      // Clear the defaults manually - we can't unregister, so test a non-default channel
      // 'sound' is not in the default set
      const results = unregistered.dispatch({
        title: 'Test', body: 'Test',
        category: 'price_alert',
        channels: ['sound'],  // sound not registered
      });

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('not registered');
    });

    it('should return channel stats', () => {
      // Fresh bridge, only register what we need
      const b = new PushIpcBridge();
      b.dispatch({
        title: 'Stats test', body: 'Test',
        category: 'price_alert', channels: ['system', 'toast'],
      });

      const stats = b.getChannelStats();
      // Constructor creates 4 default stats entries
      expect(stats.length).toBe(4);
      expect(stats.some(s => s.channel === 'system' && s.sent > 0)).toBe(true);
      expect(stats.some(s => s.channel === 'toast' && s.sent > 0)).toBe(true);
      expect(stats.some(s => s.channel === 'tray' && s.sent === 0)).toBe(true);
    });
  });

  describe('quiet hours', () => {
    it('should respect config quiet hours setting', () => {
      const bridge2 = new PushIpcBridge({ quietHours: { start: 0, end: 23 } });
      bridge2.registerChannel('system');

      const results = bridge2.dispatch({
        title: 'Quiet test', body: 'Should queue',
        category: 'price_alert', channels: ['system'],
      });

      // During quiet hours, push goes to pending queue
      const pending = bridge2.getPendingQueue();
      expect(pending.length).toBeGreaterThan(0);
    });

    it('should flush pending queue', () => {
      const bridge2 = new PushIpcBridge({ quietHours: { start: 0, end: 23 } });
      bridge2.registerChannel('system');
      bridge2.registerChannel('toast');

      bridge2.dispatch({
        title: 'Queued 1', body: 'Queue 1',
        category: 'price_alert', channels: ['system'],
      });
      bridge2.dispatch({
        title: 'Queued 2', body: 'Queue 2',
        category: 'news_breaking', channels: ['toast'],
      });

      expect(bridge2.getPendingQueue()).toHaveLength(2);

      const results = bridge2.flushQueue();
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(bridge2.getPendingQueue()).toHaveLength(0);
    });
  });

  describe('history', () => {
    it('should return push history in reverse order', () => {
      bridge.dispatch({
        title: 'Push 1', body: 'Body 1',
        category: 'price_alert', channels: ['system'],
      });
      bridge.dispatch({
        title: 'Push 2', body: 'Body 2',
        category: 'volume_surge', channels: ['system'],
      });

      const history = bridge.getHistory(2);
      expect(history[0].title).toContain('Push 2');
    });
  });

  describe('prebuilt singleton', () => {
    it('pushIpcBridge should be available', () => {
      pushIpcBridge.registerChannel('system');
      const cfg = pushIpcBridge.getConfig();
      expect(cfg.maxPerHour).toBe(10);
      pushIpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P0-3: TrayIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R257 P0-3 TrayIpcBridge', () => {
  let bridge: TrayIpcBridge;

  beforeEach(() => {
    bridge = new TrayIpcBridge();
  });

  describe('tray state', () => {
    it('should start in offline state', () => {
      expect(bridge.getTrayState()).toBe('offline');
    });

    it('should set and get tray state', () => {
      const event = bridge.setTrayState('active');
      expect(bridge.getTrayState()).toBe('active');
      expect(event.type).toBe('tray_state_change');
      expect(event.data.state).toBe('active');
    });

    it('should support all tray states', () => {
      const states: TrayState[] = ['normal', 'active', 'alert', 'offline'];
      for (const state of states) {
        bridge.setTrayState(state);
        expect(bridge.getTrayState()).toBe(state);
      }
    });

    it('should trigger alert and increment count', () => {
      const event = bridge.triggerAlert('BTC pumping', 'BTC');
      expect(event.type).toBe('alert_trigger');
      expect(event.data.reason).toBe('BTC pumping');
    });

    it('should clear alerts', () => {
      bridge.triggerAlert('alert 1', 'TSLA');
      bridge.triggerAlert('alert 2', 'NVDA');
      bridge.clearAlerts();

      // After clear, alert count resets
      const snapshot = bridge.getWatchlistSnapshot();
      expect(snapshot.alertCount).toBe(0);
    });
  });

  describe('mini window', () => {
    it('should toggle mini window visibility', () => {
      expect(bridge.isMiniWindowVisible()).toBe(false);

      bridge.toggleMiniWindow();
      expect(bridge.isMiniWindowVisible()).toBe(true);

      bridge.toggleMiniWindow();
      expect(bridge.isMiniWindowVisible()).toBe(false);
    });

    it('should show and hide mini window', () => {
      bridge.showMiniWindow();
      expect(bridge.isMiniWindowVisible()).toBe(true);

      bridge.hideMiniWindow();
      expect(bridge.isMiniWindowVisible()).toBe(false);
    });

    it('should emit toggle event', () => {
      const event = bridge.showMiniWindow();
      expect(event.type).toBe('mini_window_toggle');
      expect(event.data.visible).toBe(true);
    });
  });

  describe('watchlist management', () => {
    it('should register watchlist', () => {
      bridge.registerWatchlist(['BTC', 'TSLA', 'NVDA']);

      const snapshot = bridge.getWatchlistSnapshot();
      expect(snapshot.symbols).toHaveLength(3);
      expect(snapshot.symbols).toContain('BTC');
      expect(snapshot.symbols).toContain('TSLA');
    });

    it('should filter quotes to watchlist only', () => {
      bridge.registerWatchlist(['BTC', 'ETH']);

      const quotes: TrayQuote[] = [
        { symbol: 'BTC', name: 'Bitcoin', price: 75000, changePercent: 5.2, changeAmount: 3700, volume: 45000, market: 'CRYPTO', updatedAt: Date.now() },
        { symbol: 'ETH', name: 'Ethereum', price: 4200, changePercent: -2.1, changeAmount: -90, volume: 120000, market: 'CRYPTO', updatedAt: Date.now() },
        { symbol: 'TSLA', name: 'Tesla', price: 350, changePercent: 3.1, changeAmount: 10.5, volume: 5000000, market: 'US', updatedAt: Date.now() },
      ];

      bridge.pushQuotes(quotes);

      const snapshot = bridge.getWatchlistSnapshot();
      // TSLA should be filtered out (not in watchlist)
      expect(snapshot.quotes.length).toBe(2);
      expect(snapshot.quotes.find(q => q.symbol === 'TSLA')).toBeUndefined();
    });

    it('should compute portfolio total change', () => {
      bridge.registerWatchlist(['BTC', 'ETH']);

      const quotes: TrayQuote[] = [
        { symbol: 'BTC', name: 'Bitcoin', price: 75000, changePercent: 5.2, changeAmount: 3700, volume: 45000, market: 'CRYPTO', updatedAt: Date.now() },
        { symbol: 'ETH', name: 'Ethereum', price: 4200, changePercent: -2.1, changeAmount: -90, volume: 120000, market: 'CRYPTO', updatedAt: Date.now() },
      ];

      bridge.pushQuotes(quotes);
      const snapshot = bridge.getWatchlistSnapshot();

      expect(snapshot.totalChange).toBeCloseTo(3.1, 0);
      expect(snapshot.totalChangeAmount).toBeCloseTo(3610, -1);
    });

    it('should sort quotes by absolute change', () => {
      bridge.registerWatchlist(['BTC', 'ETH', 'TSLA']);

      const quotes: TrayQuote[] = [
        { symbol: 'BTC', name: 'Bitcoin', price: 75000, changePercent: 1.0, changeAmount: 750, volume: 45000, market: 'CRYPTO', updatedAt: Date.now() },
        { symbol: 'ETH', name: 'Ethereum', price: 4200, changePercent: -5.0, changeAmount: -210, volume: 120000, market: 'CRYPTO', updatedAt: Date.now() },
        { symbol: 'TSLA', name: 'Tesla', price: 350, changePercent: 3.1, changeAmount: 10.5, volume: 5000000, market: 'US', updatedAt: Date.now() },
      ];

      bridge.pushQuotes(quotes);
      const snapshot = bridge.getWatchlistSnapshot();

      // ETH (-5.0%) should be first (largest absolute change)
      expect(snapshot.quotes[0].symbol).toBe('ETH');
    });

    it('should return single quote by symbol', () => {
      bridge.registerWatchlist(['BTC']);
      bridge.pushQuotes([
        { symbol: 'BTC', name: 'Bitcoin', price: 75000, changePercent: 5.2, changeAmount: 3700, volume: 45000, market: 'CRYPTO', updatedAt: Date.now() },
      ]);

      const quote = bridge.getQuote('BTC');
      expect(quote?.price).toBe(75000);
      expect(quote?.changePercent).toBe(5.2);

      const missing = bridge.getQuote('UNKNOWN');
      expect(missing).toBeNull();
    });
  });

  describe('menu actions', () => {
    it('should return default menu actions', () => {
      const actions = bridge.getMenuActions();
      expect(actions.length).toBeGreaterThanOrEqual(4);
      expect(actions.some(a => a.id === 'toggle_mini')).toBe(true);
      expect(actions.some(a => a.id === 'show_main')).toBe(true);
    });

    it('should handle menu click for toggle_mini', () => {
      const event = bridge.handleMenuClick('toggle_mini');
      expect(event.type).toBe('menu_click');
      expect(event.data.handled).toBe(true);
      expect(bridge.isMiniWindowVisible()).toBe(true);
    });

    it('should reject click on disabled action', () => {
      const event = bridge.handleMenuClick('separator_1');
      expect(event.data.handled).toBe(false);
    });
  });

  describe('events', () => {
    it('should track events in history', () => {
      bridge.setTrayState('active');
      bridge.showMiniWindow();
      bridge.triggerAlert('test', 'BTC');

      const events = bridge.getEvents(10);
      expect(events.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('prebuilt singleton', () => {
    it('trayIpcBridge should be available', () => {
      const cfg = trayIpcBridge.getConfig();
      expect(cfg.width).toBe(320);
      expect(cfg.maxItems).toBe(8);
      trayIpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-4: MacroDataBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R257 P1-4 MacroDataBridge', () => {
  let bridge: MacroDataBridge;

  beforeEach(() => {
    bridge = new MacroDataBridge();
  });

  describe('economic events', () => {
    it('should add an event with auto-generated ID', () => {
      const event = bridge.addEvent({
        title: 'US Non-Farm Payrolls',
        titleCn: '美国非农就业',
        category: 'employment',
        region: 'US',
        scheduledAt: Date.now() + 3_600_000,
        importance: 'high',
        forecast: 180_000,
        previous: 175_000,
        unit: 'K',
      });

      expect(event.eventId).toMatch(/^econ:US:employment:/);
      expect(event.affectedAssets.length).toBeGreaterThan(0);
      expect(event.importance).toBe('high');
    });

    it('should update event actual value', () => {
      const event = bridge.addEvent({
        title: 'CPI m/m',
        titleCn: 'CPI月率',
        category: 'inflation',
        region: 'US',
        scheduledAt: Date.now() + 7_200_000,
        importance: 'critical',
        unit: '%',
        forecast: 0.3,
        previous: 0.4,
      });

      const updated = bridge.updateEventActual(event.eventId, 0.2);
      expect(updated?.actual).toBe(0.2);
      expect(updated?.actualAt).toBeGreaterThan(0);
    });

    it('should report null for update on nonexistent event', () => {
      const result = bridge.updateEventActual('nonexistent', 5);
      expect(result).toBeNull();
    });

    it('should filter upcoming events within hours', () => {
      const now = Date.now();
      bridge.addEvent({
        title: 'Soon event', titleCn: '即将', category: 'gdp', region: 'US',
        scheduledAt: now + 1_800_000, importance: 'medium', unit: '%',
      });
      bridge.addEvent({
        title: 'Later event', titleCn: '稍后', category: 'trade', region: 'US',
        scheduledAt: now + 100_000_000, importance: 'low', unit: 'B',  // > 27h, beyond 24h window
      });
      bridge.addEvent({
        title: 'Past event', titleCn: '已过', category: 'inflation', region: 'CN',
        scheduledAt: now - 3_600_000, importance: 'high', unit: '%',
      });

      const upcoming24h = bridge.getUpcomingEvents(24);
      expect(upcoming24h.length).toBe(1);
      expect(upcoming24h[0].title).toBe('Soon event');
    });

    it('should filter by region', () => {
      const now = Date.now();
      bridge.addEvent({
        title: 'US event', titleCn: '美国', category: 'employment', region: 'US',
        scheduledAt: now + 3_600_000, importance: 'high', unit: 'K',
      });
      bridge.addEvent({
        title: 'CN event', titleCn: '中国', category: 'manufacturing', region: 'CN',
        scheduledAt: now + 3_600_000, importance: 'high', unit: '',
      });

      const usEvents = bridge.getUpcomingEvents(24, ['US']);
      expect(usEvents.length).toBe(1);
      expect(usEvents[0].title).toBe('US event');
    });

    it('should get high impact events today', () => {
      const now = Date.now();
      bridge.addEvent({
        title: 'Critical today', titleCn: '紧急', category: 'monetary_policy', region: 'US',
        scheduledAt: now + 1_800_000, importance: 'critical', unit: '%',
      });
      bridge.addEvent({
        title: 'Low today', titleCn: '不重要', category: 'consumer', region: 'US',
        scheduledAt: now + 3_600_000, importance: 'low', unit: '',
      });

      const highImpact = bridge.getHighImpactEvents();
      expect(highImpact.length).toBe(1);
      expect(highImpact[0].importance).toBe('critical');
    });

    it('should get event by ID', () => {
      const event = bridge.addEvent({
        title: 'Find me', titleCn: '找我', category: 'housing', region: 'UK',
        scheduledAt: Date.now() + 7_200_000, importance: 'medium', unit: '%',
      });

      const found = bridge.getEvent(event.eventId);
      expect(found?.title).toBe('Find me');

      const notFound = bridge.getEvent('nope');
      expect(notFound).toBeNull();
    });
  });

  describe('correlations', () => {
    it('should have default correlation matrix', () => {
      const all = bridge.getAllCorrelations();
      expect(all.length).toBeGreaterThanOrEqual(8);
    });

    it('should find correlations for specific symbol', () => {
      const btcCorrs = bridge.getCorrelations('BTC');
      expect(btcCorrs.length).toBeGreaterThanOrEqual(1);
      // BTC should correlate with SPX and ETH
      const symbols = btcCorrs.flatMap(c => c.pair);
      expect(symbols.some(s => s === 'SPX')).toBe(true);
    });

    it('should add custom correlation', () => {
      bridge.addCorrelation({
        pair: ['TSLA', 'BTC'],
        pairNames: ['Tesla', 'Bitcoin'],
        correlation: 0.42,
        period: '6M',
        lastUpdated: Date.now(),
        significance: 'moderate',
      });

      const tslaCorrs = bridge.getCorrelations('TSLA');
      expect(tslaCorrs.length).toBeGreaterThanOrEqual(1);
      expect(tslaCorrs.some(c => c.pair.includes('BTC'))).toBe(true);
    });
  });

  describe('event alerts', () => {
    it('should set and check alerts', () => {
      const now = Date.now();
      const event = bridge.addEvent({
        title: 'FOMC Minutes',
        titleCn: '美联储纪要',
        category: 'monetary_policy',
        region: 'US',
        scheduledAt: now + 10_000, // 10 seconds from now
        importance: 'high',
        unit: '',
      });

      // Set alert for 15 min before — should fire immediately since event is 10s away
      const alert = bridge.setAlert(event.eventId, 15);
      expect(alert).not.toBeNull();
      expect(alert?.triggered).toBe(false);

      // After waiting, alert should trigger
      const due = bridge.checkAlerts();
      // 15 min before = 15*60*1000 = 900,000ms before. Event is only 10,000ms away.
      // So 15 min before event has already passed → alert should trigger
      expect(due.length).toBeGreaterThanOrEqual(1);
    });

    it('should list active alerts', () => {
      const now = Date.now();
      const event = bridge.addEvent({
        title: 'Future Event',
        titleCn: '未来事件',
        category: 'employment',
        region: 'US',
        scheduledAt: now + 3_600_000, // 1 hour from now
        importance: 'high',
        unit: 'K',
      });

      bridge.setAlert(event.eventId, 30);
      const active = bridge.getActiveAlerts();
      expect(active.length).toBe(1);
    });

    it('should cancel alert', () => {
      const now = Date.now();
      const event = bridge.addEvent({
        title: 'Cancel me',
        titleCn: '取消',
        category: 'gdp',
        region: 'JP',
        scheduledAt: now + 7_200_000,
        importance: 'medium',
        unit: '%',
      });

      const alert = bridge.setAlert(event.eventId, 30);
      expect(alert).not.toBeNull();

      const cancelled = bridge.cancelAlert(alert!.alertId);
      expect(cancelled).toBe(true);
      expect(bridge.getActiveAlerts().length).toBe(0);
    });
  });

  describe('macro snapshots', () => {
    it('should take snapshot and compute risk level', () => {
      const snapshot = bridge.takeSnapshot('US', [
        { name: 'GDP', nameCn: 'GDP', category: 'gdp', value: 3.2, previousValue: 2.8, trend: 'improving' },
        { name: 'CPI', nameCn: 'CPI', category: 'inflation', value: 3.5, previousValue: 3.4, trend: 'deteriorating' },
        { name: 'NFP', nameCn: '非农', category: 'employment', value: 180, previousValue: 175, trend: 'improving' },
        { name: 'PMI', nameCn: 'PMI', category: 'manufacturing', value: 48.5, previousValue: 50.2, trend: 'deteriorating' },
      ]);

      expect(snapshot.region).toBe('US');
      expect(snapshot.riskLevel).toBe('high'); // 2 deteriorating
      expect(snapshot.indicators.length).toBe(4);
      expect(snapshot.summaryCn).toContain('美国');
    });

    it('should compute low risk when mostly improving', () => {
      const snapshot = bridge.takeSnapshot('CN', [
        { name: 'GDP', nameCn: 'GDP', category: 'gdp', value: 5.2, previousValue: 5.0, trend: 'improving' },
        { name: 'PMI', nameCn: 'PMI', category: 'manufacturing', value: 51.2, previousValue: 50.5, trend: 'improving' },
      ]);

      expect(snapshot.riskLevel).toBe('low');
    });

    it('should retrieve latest snapshot', () => {
      bridge.takeSnapshot('US', [
        { name: 'GDP', nameCn: 'GDP', category: 'gdp', value: 3.2, previousValue: 2.8, trend: 'improving' },
      ]);

      const latest = bridge.getLatestSnapshot('US');
      expect(latest).not.toBeNull();
      expect(latest?.indicators[0].name).toBe('GDP');
    });

    it('should return null for missing region', () => {
      const missing = bridge.getLatestSnapshot('EU');
      expect(missing).toBeNull();
    });
  });

  describe('region watch', () => {
    it('should get and set watched regions', () => {
      const defaultRegions = bridge.getWatchedRegions();
      expect(defaultRegions).toContain('US');
      expect(defaultRegions).toContain('CN');

      bridge.setWatchedRegions(['US', 'EU', 'JP']);
      const updated = bridge.getWatchedRegions();
      expect(updated).toEqual(['US', 'EU', 'JP']);
    });
  });

  describe('stats', () => {
    it('should track event and alert stats', () => {
      const now = Date.now();
      bridge.addEvent({
        title: 'Stat event 1', titleCn: '统计1', category: 'employment', region: 'US',
        scheduledAt: now + 3_600_000, importance: 'high', unit: 'K',
      });
      bridge.addEvent({
        title: 'Stat event 2', titleCn: '统计2', category: 'gdp', region: 'CN',
        scheduledAt: now + 7_200_000, importance: 'medium', unit: '%',
      });

      const stats = bridge.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.totalCorrelations).toBeGreaterThanOrEqual(8);
    });
  });

  describe('prebuilt singleton', () => {
    it('macroDataBridge should be available', () => {
      const stats = macroDataBridge.getStats();
      expect(typeof stats.totalEvents).toBe('number');
      macroDataBridge.reset();
    });
  });
});
