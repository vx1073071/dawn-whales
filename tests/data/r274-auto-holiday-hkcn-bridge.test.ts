/**
 * R274 假期日历 + HK/CN指标桥接 测试
 * HolidayCalendarSource: 18 tests
 * HkCnIndicatorBridge: 17 tests
 * Total: 35 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HolidayCalendarSource, holidayCalendarSource } from '../../electron/engine/data/holiday-calendar-source';
import { HkCnIndicatorBridge, hkCnIndicatorBridge } from '../../electron/engine/data/hk-cn-indicator-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// HolidayCalendarSource Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R274 HolidayCalendarSource', () => {
  let src: HolidayCalendarSource;

  beforeEach(() => { src = new HolidayCalendarSource(); });

  it('should recognize a trading day', () => {
    // 2026-06-17 is a Wednesday (weekday, no known holiday for most exchanges)
    const result = src.isTradingDay('HKEX', '2026-06-17');
    expect(result.isTradingDay).toBe(true);
    expect(result.isHalfDay).toBe(false);
    expect(result.holidayName).toBeNull();
  });

  it('should recognize a weekend as non-trading', () => {
    // 2026-06-20 is Saturday
    const result = src.isTradingDay('HKEX', '2026-06-20');
    expect(result.isTradingDay).toBe(false);
    expect(result.holidayName).toBe('Weekend');
  });

  it('should recognize holidays', () => {
    // HKEX: 2026-07-01 HKSAR Establishment Day
    const result = src.isTradingDay('HKEX', '2026-07-01');
    expect(result.isTradingDay).toBe(false);
    expect(result.holidayName).toBe('HKSAR Establishment Day');
  });

  it('should recognize half-day trading', () => {
    // HKEX: 2026-12-24 Christmas Eve half day
    const result = src.isTradingDay('HKEX', '2026-12-24');
    expect(result.isTradingDay).toBe(true);
    expect(result.isHalfDay).toBe(true);
    expect(result.closeTime).toBe('12:00');
  });

  it('should get next trading day after a holiday weekend', () => {
    // 2026-10-01 Thu — National Day holiday, next trading day = 2026-10-02 Fri (not weekend)
    // Actually 2026-10-02 is also a holiday for some... let's check SSE
    const next = src.nextTradingDay('HKEX', '2026-09-30');
    expect(next).toBe('2026-10-02'); // Oct 1 is holiday, Oct 2 is trading day
  });

  it('should skip weekends for next trading day', () => {
    // Friday 2026-06-19 is Tuen Ng (HKEX holiday), Saturday 20, Sunday 21
    const next = src.nextTradingDay('HKEX', '2026-06-18');
    expect(next).toBe('2026-06-22'); // Monday after weekend
  });

  it('should get previous trading day', () => {
    const prev = src.prevTradingDay('HKEX', '2026-06-17');
    expect(prev).toBe('2026-06-16'); // Tuesday
  });

  it('should skip holidays for previous trading day', () => {
    // 2026-10-02 is a Friday, Oct 1 is holiday
    const prev = src.prevTradingDay('HKEX', '2026-10-02');
    expect(prev).toBe('2026-09-30'); // Wednesday before holiday
  });

  it('should list holidays for an exchange', () => {
    const holidays = src.getHolidays('HKEX', '2026-01-01', '2026-12-31');
    expect(holidays.length).toBeGreaterThanOrEqual(14);
    expect(holidays.every(h => h.exchange === 'HKEX')).toBe(true);
  });

  it('should get upcoming holidays', () => {
    const upcoming = src.getUpcoming('HKEX', 365);
    expect(upcoming.length).toBeGreaterThanOrEqual(1);
  });

  it('should get global upcoming', () => {
    const global = src.getGlobalUpcoming(365);
    expect(global.length).toBeGreaterThanOrEqual(10);
  });

  it('should add custom holiday', () => {
    src.addHoliday({
      exchange: 'HKEX', date: '2026-08-15',
      name: 'Typhoon Day', nameCn: '台风休市',
      isHalfDay: false, openTime: null, closeTime: null,
    });
    const result = src.isTradingDay('HKEX', '2026-08-15');
    expect(result.isTradingDay).toBe(false);
    expect(result.holidayName).toBe('Typhoon Day');
  });

  it('should batch add holidays', () => {
    src.addHolidays('JPX', [
      { date: '2026-05-10', name: 'Golden Week', nameCn: '黄金周', isHalfDay: false, openTime: null, closeTime: null },
      { date: '2026-05-11', name: 'Golden Week', nameCn: '黄金周', isHalfDay: false, openTime: null, closeTime: null },
    ]);
    expect(src.isTradingDay('JPX', '2026-05-10').isTradingDay).toBe(false);
  });

  it('should find cross-market overlaps', () => {
    const overlaps = src.getCrossMarketOverlaps(2);
    expect(overlaps.length).toBeGreaterThan(0);
    // 2026-04-03: Good Friday — HKEX + LSE should overlap
    const gf = overlaps.find(o => o.date === '2026-04-03');
    if (gf) {
      expect(gf.exchanges.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should get open exchanges on a date', () => {
    const open = src.getOpenExchanges('2026-06-17');
    expect(open.length).toBeGreaterThanOrEqual(10);
    expect(open).toContain('HKEX');
  });

  it('should count trading days', () => {
    const count = src.countTradingDays('HKEX', '2026-06-15', '2026-06-19');
    // Mon 15, Tue 16, Wed 17, Thu 18, Fri 19 = 5 weekdays, but 19 is holiday
    expect(count).toBe(4); // Mon-Tue-Wed-Thu
  });

  it('should add N trading days', () => {
    const result = src.addTradingDays('HKEX', '2026-06-15', 3);
    expect(result).toBe('2026-06-18'); // Mon+1=Tue, +2=Wed, +3=Thu
  });

  it('should get stats', () => {
    const stats = src.getStats();
    expect(stats.totalExchanges).toBeGreaterThanOrEqual(16);
    expect(stats.totalHolidays).toBeGreaterThan(0);
  });

  it('should get exchange metadata', () => {
    const meta = src.getExchangeMeta('NSE');
    expect(meta.nameCn).toBe('印度国家交易所');
    expect(meta.region).toBe('Asia');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HkCnIndicatorBridge Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('R274 HkCnIndicatorBridge', () => {
  let bridge: HkCnIndicatorBridge;

  beforeEach(() => { bridge = new HkCnIndicatorBridge(); });

  it('should evaluate high shortsell ratio as critical', () => {
    const signal = bridge.evaluateShortsell(10000000, 5000000); // 50% shortsell
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe('critical');
    expect(signal!.direction).toBe('bearish');
    expect(signal!.category).toBe('shortsell');
  });

  it('should evaluate normal shortsell ratio as info', () => {
    const signal = bridge.evaluateShortsell(10000000, 500000); // 5%
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe('info');
    expect(signal!.direction).toBe('bullish');
  });

  it('should handle zero shortsell', () => {
    const signal = bridge.evaluateShortsell(0, 0);
    // 0/0 → ratio=0 (safe fallback), triggers LOW branch
    expect(signal).not.toBeNull();
    expect(signal!.severity).toBe('info');
    expect(signal!.value).toBe(0);
  });

  it('should evaluate strong northbound inflow', () => {
    const signal = bridge.evaluateNorthbound(200); // 200 亿
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bullish');
  });

  it('should evaluate normal northbound', () => {
    const signal = bridge.evaluateNorthbound(20);
    expect(signal.severity).toBe('info');
    expect(signal.direction).toBe('neutral');
  });

  it('should evaluate DDX bullish', () => {
    const signal = bridge.evaluateDdx(1.2);
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bullish');
  });

  it('should evaluate DDX bearish', () => {
    const signal = bridge.evaluateDdx(-0.7);
    expect(signal.severity).toBe('warning');
    expect(signal.direction).toBe('bearish');
  });

  it('should evaluate stock connect bullish inflow', () => {
    const signal = bridge.evaluateStockConnect(1000, 500);
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bullish');
  });

  it('should evaluate stock connect bearish outflow', () => {
    const signal = bridge.evaluateStockConnect(-700, -500);
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bearish');
  });

  it('should evaluate HK market breadth bullish', () => {
    const signal = bridge.evaluateHkBreadth(800, 200, 100);
    expect(signal.value).toBe(4); // 800/200
    expect(signal.direction).toBe('bullish');
    expect(signal.severity).toBe('critical');
  });

  it('should evaluate HK market breadth bearish', () => {
    const signal = bridge.evaluateHkBreadth(200, 800, 100);
    expect(signal.value).toBe(0.25);
    expect(signal.direction).toBe('bearish');
    expect(signal.severity).toBe('warning');
  });

  it('should evaluate market width with limit-up frenzy', () => {
    const signal = bridge.evaluateMarketWidth(500, 10, 5000); // 10% limit up
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bullish');
  });

  it('should evaluate market width with limit-down flood', () => {
    const signal = bridge.evaluateMarketWidth(5, 500, 5000); // 10% limit down
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bearish');
  });

  it('should evaluate whale activity', () => {
    const signal = bridge.evaluateWhale(2000, 500, '贵州茅台');
    expect(signal.severity).toBe('critical');
    expect(signal.direction).toBe('bullish');
    expect(signal.messageCn).toContain('贵州茅台');
  });

  it('should do cross-market comparison', () => {
    const result = bridge.compareHkCn({
      hkShortsellRatio: 12,
      hkStockConnectNet: 800,
      hkAdvancing: 700,
      hkDeclining: 300,
      cnNorthboundNet: 150,
      cnDdxScore: 0.8,
      cnLimitUp: 100,
      cnLimitDown: 5,
      cnTotalStocks: 5000,
    });
    expect(result).not.toBeNull();
    expect(result.hk.sentimentScore).toBeGreaterThan(0);
    expect(result.cn.sentimenScore).toBeGreaterThan(0);
    expect(result.signals.riskLevel).toBe('low');
  });

  it('should detect extreme risk cross-market', () => {
    const result = bridge.compareHkCn({
      hkShortsellRatio: 45,
      hkStockConnectNet: -1500,
      hkAdvancing: 100,
      hkDeclining: 900,
      cnNorthboundNet: -200,
      cnDdxScore: -1.5,
      cnLimitUp: 2,
      cnLimitDown: 600,
      cnTotalStocks: 5000,
    });
    expect(result.signals.riskLevel).toBe('extreme');
  });

  it('should get HK signals by category', () => {
    bridge.evaluateShortsell(10000000, 3000000); // 30% → warning
    bridge.evaluateShortsell(10000000, 5000000); // 50% → critical
    bridge.evaluateStockConnect(1000, 500);
    const shortsell = bridge.getHkSignals('shortsell');
    expect(shortsell.length).toBe(2);
  });

  it('should get CN signals', () => {
    bridge.evaluateNorthbound(100);
    bridge.evaluateDdx(0.6);
    bridge.evaluateMarketWidth(100, 10, 5000);
    const signals = bridge.getCnSignals();
    expect(signals.length).toBe(3);
  });

  it('should return null when no cross comparison done', () => {
    expect(bridge.getLatestComparison()).toBeNull();
  });

  it('should return all signals', () => {
    bridge.evaluateShortsell(10000000, 1000000);
    bridge.evaluateNorthbound(50);
    const all = bridge.getAllSignals();
    expect(all.hk.length).toBe(1);
    expect(all.cn.length).toBe(1);
    expect(all.cross).toBeNull();
  });
});
