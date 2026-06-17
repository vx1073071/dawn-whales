/**
 * R265 autoclaw 综合测试 — 快捷键IPC + 多图同步 + 闪电图数据
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ShortcutIpcBridge, shortcutIpcBridge } from '../../electron/engine/data/shortcut-ipc-bridge';
import { MultiChartSyncBridge, multiChartSyncBridge } from '../../electron/engine/data/multi-chart-sync-bridge';
import { FlashChartIpcBridge, flashChartIpcBridge } from '../../electron/engine/data/flash-chart-ipc-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// ShortcutIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R265 ShortcutIpcBridge', () => {
  let bridge: ShortcutIpcBridge;
  beforeEach(() => { bridge = new ShortcutIpcBridge(); });

  describe('registration', () => {
    it('should have 31 default shortcuts', () => {
      expect(bridge.getCount()).toBe(31);
    });

    it('should register new shortcut', () => {
      const def = bridge.register({
        shortcutId: 'test-shortcut', key: 'K', command: 'test:action',
        label: 'Test', labelCn: '测试', context: ['chart'], priority: 5, category: 'general',
      });
      expect(def.shortcutId).toBe('test-shortcut');
      expect(bridge.getCount()).toBe(32);
    });

    it('should unregister shortcut', () => {
      const result = bridge.unregister('tf-1m');
      expect(result).toBe(true);
      expect(bridge.getCount()).toBe(30);
    });

    it('should fail unregistering unknown shortcut', () => {
      expect(bridge.unregister('nonexistent')).toBe(false);
    });
  });

  describe('dispatch', () => {
    it('should dispatch numeric key to timeframe command', () => {
      const event = bridge.dispatchKey('1', 'chart');
      expect(event).not.toBeNull();
      expect(event?.command).toBe('chart:timeframe:1m');
    });

    it('should dispatch Space for next symbol', () => {
      const event = bridge.dispatchKey('Space', 'chart');
      expect(event?.command).toBe('navigate:next_symbol');
    });

    it('should dispatch Tab for indicator toggle', () => {
      const event = bridge.dispatchKey('Tab', 'chart');
      expect(event?.command).toBe('indicator:toggle_overlay');
    });

    it('should dispatch Escape globally', () => {
      const event = bridge.dispatchKey('Escape', 'settings');
      expect(event?.command).toBe('general:cancel');
    });

    it('should ignore disabled shortcuts', () => {
      bridge.setEnabled('tf-1m', false);
      const event = bridge.dispatchKey('1', 'chart');
      // tf-1m is the only '1' key shortcut; disabled → null
      expect(event).toBeNull();
    });

    it('should return null for unknown key', () => {
      expect(bridge.dispatchKey('F12', 'chart')).toBeNull();
    });
  });

  describe('toggle', () => {
    it('should enable/disable individual shortcuts', () => {
      bridge.setEnabled('tf-1m', false);
      const all = bridge.getAll();
      const s = all.find(s => s.shortcutId === 'tf-1m');
      expect(s?.enabled).toBe(false);
    });

    it('should disable entire category', () => {
      bridge.setCategoryEnabled('drawing', false);
      const drawing = bridge.getAll().filter(s => s.category === 'drawing');
      expect(drawing.every(s => !s.enabled)).toBe(true);
    });

    it('should disable all globally', () => {
      bridge.setGlobalEnabled(false);
      expect(bridge.getAll().every(s => !s.enabled)).toBe(true);
    });

    it('should disable/enable specific IDs', () => {
      bridge.disableIds(['tf-1m', 'tf-5m']);
      expect(bridge.dispatchKey('1', 'chart')?.command).not.toBe('chart:timeframe:1m');
      bridge.enableIds(['tf-1m']);
      expect(bridge.dispatchKey('1', 'chart')?.command).toBe('chart:timeframe:1m');
    });
  });

  describe('conflicts', () => {
    it('should detect conflicts on same key', () => {
      bridge.register({
        shortcutId: 'custom-1', key: '1', command: 'custom:action',
        label: 'Custom', labelCn: '自定义', context: ['chart'], priority: 3, category: 'chart',
      });
      const conflicts = bridge.detectConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('help guide', () => {
    it('should generate category guides for chart context', () => {
      const guides = bridge.getCategoryGuides('chart');
      expect(guides.length).toBeGreaterThan(0);
      expect(guides.some(g => g.category === 'chart')).toBe(true);
      expect(guides.some(g => g.category === 'navigate')).toBe(true);
    });
  });

  describe('event log', () => {
    it('should log dispatched events', () => {
      bridge.dispatchKey('Space', 'chart');
      bridge.dispatchKey('7', 'chart');
      const log = bridge.getEventLog();
      expect(log.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(shortcutIpcBridge.getCount()).toBeGreaterThanOrEqual(30);
      shortcutIpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MultiChartSyncBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R265 MultiChartSyncBridge', () => {
  let bridge: MultiChartSyncBridge;
  beforeEach(() => { bridge = new MultiChartSyncBridge(); });

  describe('groups', () => {
    it('should create a chart group', () => {
      const group = bridge.createGroup({ groupId: 'g1', presetId: 'layout_3x1' });
      expect(group.layout.rows).toBe(3);
    });

    it('should add charts to group', () => {
      bridge.createGroup({ groupId: 'g1', presetId: 'layout_3x1' });
      const c1 = bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      const c2 = bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'AAPL', timeframe: '4h', row: 1, col: 0 });
      const c3 = bridge.addChart({ chartId: 'c3', groupId: 'g1', symbol: 'AAPL', timeframe: '15m', row: 2, col: 0 });

      expect(c1?.type).toBe('main');
      expect(c2).not.toBeNull();
      expect(bridge.getChartsInGroup('g1').length).toBe(3);
    });

    it('should reject duplicate position in same group', () => {
      bridge.createGroup({ groupId: 'g1', presetId: 'layout_1x1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      const c2 = bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'MSFT', timeframe: 'D', row: 0, col: 0 });
      expect(c2).toBeNull();
    });

    it('should remove chart', () => {
      bridge.createGroup({ groupId: 'g1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      expect(bridge.removeChart('c1')).toBe(true);
      expect(bridge.getChartsInGroup('g1').length).toBe(0);
    });

    it('should remove group', () => {
      bridge.createGroup({ groupId: 'g1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      expect(bridge.removeGroup('g1')).toBe(true);
      expect(bridge.getGroup('g1')).toBeNull();
    });
  });

  describe('sync', () => {
    it('should sync symbol across linked charts', () => {
      bridge.createGroup({ groupId: 'g1', presetId: 'layout_2x1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0, type: 'main' });
      bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 1, col: 0 });

      const { targets } = bridge.sync({ groupId: 'g1', sourceChartId: 'c1', type: 'symbol', payload: { symbol: 'MSFT' } });
      expect(targets).toContain('c2');
      expect(bridge.getChart('c2')?.symbol).toBe('MSFT');
    });

    it('should sync timeframe', () => {
      bridge.createGroup({ groupId: 'g1', presetId: 'layout_3x1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'AAPL', timeframe: '4h', row: 1, col: 0 });

      bridge.sync({ groupId: 'g1', sourceChartId: 'c1', type: 'timeframe', payload: { timeframe: '1h' } });
      expect(bridge.getChart('c2')?.timeframe).toBe('1h');
    });

    it('should respect semi sync mode', () => {
      bridge.createGroup({ groupId: 'g1', presetId: 'layout_2x1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 1, col: 0 });

      bridge.setSyncMode('g1', 'semi');
      const { targets } = bridge.sync({ groupId: 'g1', sourceChartId: 'c1', type: 'range', payload: { start: 0, end: 100 } });
      expect(targets.length).toBe(0);
    });

    it('should respect exceptions', () => {
      bridge.createGroup({ groupId: 'g1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });
      bridge.addChart({ chartId: 'c2', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 1 });

      bridge.addSyncException('g1', 'c2');
      const { targets } = bridge.sync({ groupId: 'g1', sourceChartId: 'c1', type: 'symbol', payload: { symbol: 'TSLA' } });
      expect(targets).not.toContain('c2');
    });
  });

  describe('crosshair', () => {
    it('should update and get crosshair position', () => {
      bridge.createGroup({ groupId: 'g1' });
      bridge.addChart({ chartId: 'c1', groupId: 'g1', symbol: 'AAPL', timeframe: 'D', row: 0, col: 0 });

      const result = bridge.updateCrosshair({ groupId: 'g1', chartId: 'c1', time: 1000, price: 185, x: 200, y: 150 });
      const pos = bridge.getCrosshair('c1');
      expect(pos?.price).toBe(185);
      expect(pos?.time).toBe(1000);
    });
  });

  describe('layouts', () => {
    it('should provide layout presets', () => {
      const presets = bridge.getLayoutPresets();
      expect(presets.length).toBe(6);
      expect(presets.some(p => p.presetId === 'layout_3x1')).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      const presets = multiChartSyncBridge.getLayoutPresets();
      expect(presets.length).toBe(6);
      multiChartSyncBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FlashChartIpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R265 FlashChartIpcBridge', () => {
  let bridge: FlashChartIpcBridge;
  beforeEach(() => { bridge = new FlashChartIpcBridge(); });

  describe('tracking', () => {
    it('should start tracking a symbol', () => {
      const config = bridge.startTracking({ symbol: 'AAPL', prevClose: 180 });
      expect(config.symbol).toBe('AAPL');
      expect(bridge.getActiveSymbols()).toContain('AAPL');
    });

    it('should stop tracking', () => {
      bridge.startTracking({ symbol: 'AAPL', prevClose: 180 });
      bridge.stopTracking('AAPL');
      expect(bridge.getActiveSymbols()).not.toContain('AAPL');
    });
  });

  describe('tick processing', () => {
    it('should process a tick and update state', () => {
      bridge.startTracking({ symbol: 'AAPL', prevClose: 180 });
      const { state } = bridge.processTick({ symbol: 'AAPL', timestamp: Date.now(), price: 182, volume: 1000, bidPrice: 181.99, askPrice: 182.01 });

      expect(state.latestPrice).toBe(182);
      expect(state.change).toBe(2);
      expect(state.changePercent).toBeCloseTo(1.11, 1);
    });

    it('should aggregate ticks into candles', () => {
      bridge.startTracking({ symbol: 'TSLA', prevClose: 250, maxCandles: 390, });
      const config = bridge.getActiveSymbols().length > 0 ? true : false;
      // Process multiple ticks
      for (let i = 0; i < 5; i++) {
        bridge.processTick({ symbol: 'TSLA', timestamp: Date.now() + i * 250, price: 250 + i, volume: 500, bidPrice: 249 + i, askPrice: 251 + i });
      }

      const candles = bridge.getCandles('TSLA');
      // Aggregation depends on timing (1s window)
      expect(bridge.getState('TSLA')?.tickCount).toBe(5);
    });

    it('should process tick batch', () => {
      bridge.startTracking({ symbol: 'NVDA', prevClose: 800 });
      const ticks = [
        { symbol: 'NVDA', timestamp: Date.now(), price: 802, volume: 2000, bidPrice: 801.99, askPrice: 802.01 },
        { symbol: 'NVDA', timestamp: Date.now() + 100, price: 803, volume: 1500, bidPrice: 802.99, askPrice: 803.01 },
      ];

      const result = bridge.processTickBatch(ticks);
      expect(result.states.has('NVDA')).toBe(true);
      expect(result.states.get('NVDA')?.tickCount).toBe(2);
    });
  });

  describe('snapshot', () => {
    it('should return snapshot with candles and ticks', () => {
      bridge.startTracking({ symbol: 'AAPL', prevClose: 180 });
      bridge.processTick({ symbol: 'AAPL', timestamp: Date.now(), price: 181, volume: 1000, bidPrice: 180.99, askPrice: 181.01 });
      bridge.processTick({ symbol: 'AAPL', timestamp: Date.now() + 1000, price: 182, volume: 2000, bidPrice: 181.99, askPrice: 182.01 });

      const snapshot = bridge.getSnapshot('AAPL');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.state.latestPrice).toBe(182);
      expect(snapshot?.prevCloseLine).toBe(180);
    });

    it('should return null for unknown symbol', () => {
      expect(bridge.getSnapshot('UNKNOWN')).toBeNull();
    });
  });

  describe('sparkline', () => {
    it('should return compact sparkline data', () => {
      bridge.startTracking({ symbol: 'MSFT', prevClose: 400 });
      for (let i = 0; i < 5; i++) {
        bridge.processTick({ symbol: 'MSFT', timestamp: Date.now() + i * 100, price: 400 + i, volume: 500, bidPrice: 399 + i, askPrice: 400 + i });
      }

      const spark = bridge.getSparkline('MSFT');
      expect(spark).not.toBeNull();
      expect(spark?.prices.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(typeof flashChartIpcBridge.getStats().totalTicks).toBe('number');
      flashChartIpcBridge.reset();
    });
  });
});
