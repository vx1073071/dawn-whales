// ── JVS-108: User Preferences Tests (vitest) ───────────────────────────────
import { describe, it, expect } from 'vitest';

function getDefaults() {
  return {
    ui: { theme: 'dark', language: 'zh-CN', fontSize: 'medium', chartType: 'candlestick', animationsEnabled: true, compactMode: false },
    trading: { defaultOrderType: 'MARKET', confirmBeforeTrade: true, oneClickTrading: false, defaultQuantity: 100, maxPositionSize: 20, defaultStopLossPct: 5, defaultTakeProfitPct: 10, autoRefreshIntervalSec: 30 },
    notifications: { enabled: true, soundEnabled: true, desktopNotifications: true, tradeSignals: true, riskAlerts: true, quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '08:00' },
  };
}

function mergeWithDefaults(saved: any) {
  const d = getDefaults();
  return { ui: { ...d.ui, ...(saved.ui || {}) }, trading: { ...d.trading, ...(saved.trading || {}) }, notifications: { ...d.notifications, ...(saved.notifications || {}) } };
}

describe('Defaults', () => {
  const d = getDefaults();
  it('theme dark', () => expect(d.ui.theme).toBe('dark'));
  it('language zh-CN', () => expect(d.ui.language).toBe('zh-CN'));
  it('quantity 100', () => expect(d.trading.defaultQuantity).toBe(100));
  it('confirm enabled', () => expect(d.trading.confirmBeforeTrade).toBe(true));
  it('notifications enabled', () => expect(d.notifications.enabled).toBe(true));
});

describe('Merge with Defaults', () => {
  it('override theme', () => expect(mergeWithDefaults({ ui: { theme: 'light' } }).ui.theme).toBe('light'));
  it('keep defaults', () => expect(mergeWithDefaults({ ui: { theme: 'light' } }).ui.language).toBe('zh-CN'));
  it('override quantity', () => expect(mergeWithDefaults({ trading: { defaultQuantity: 50 } }).trading.defaultQuantity).toBe(50));
  it('empty override keeps all', () => { const m = mergeWithDefaults({}); expect(m.ui.theme).toBe('dark'); expect(m.trading.defaultQuantity).toBe(100); });
});

describe('Validation', () => {
  function validateTrading(d: any): string[] {
    const e: string[] = [];
    if (d.defaultQuantity !== undefined && d.defaultQuantity <= 0) e.push('qty');
    if (d.maxPositionSize !== undefined && (d.maxPositionSize <= 0 || d.maxPositionSize > 100)) e.push('pos');
    if (d.defaultStopLossPct !== undefined && (d.defaultStopLossPct < 0 || d.defaultStopLossPct > 50)) e.push('sl');
    return e;
  }
  it('valid prefs', () => expect(validateTrading({ defaultQuantity: 100, maxPositionSize: 20 })).toHaveLength(0));
  it('negative qty', () => expect(validateTrading({ defaultQuantity: -1 })).toContain('qty'));
  it('oversized position', () => expect(validateTrading({ maxPositionSize: 150 })).toContain('pos'));
  it('negative SL', () => expect(validateTrading({ defaultStopLossPct: -5 })).toContain('sl'));
});

describe('Quiet Hours', () => {
  function isQuiet(hour: number, start: string, end: string, enabled: boolean): boolean {
    if (!enabled) return false;
    const s = parseInt(start.split(':')[0]), e = parseInt(end.split(':')[0]);
    return s <= e ? (hour >= s && hour < e) : (hour >= s || hour < e);
  }
  it('23:00 in quiet', () => expect(isQuiet(23, '22:00', '08:00', true)).toBe(true));
  it('03:00 in quiet', () => expect(isQuiet(3, '22:00', '08:00', true)).toBe(true));
  it('12:00 not quiet', () => expect(isQuiet(12, '22:00', '08:00', true)).toBe(false));
  it('disabled', () => expect(isQuiet(23, '22:00', '08:00', false)).toBe(false));
});

describe('Tab Definitions', () => {
  const tabs = [{ id: 'ui', label: '界面设置' }, { id: 'trading', label: '交易设置' }, { id: 'notifications', label: '通知设置' }, { id: 'advanced', label: '高级' }];
  it('4 tabs', () => expect(tabs.length).toBe(4));
  it('first is UI', () => expect(tabs[0].id).toBe('ui'));
  it('last is advanced', () => expect(tabs[3].id).toBe('advanced'));
});
