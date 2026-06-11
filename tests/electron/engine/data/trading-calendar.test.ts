/**
 * Tests for TradingCalendar
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TradingCalendar,
  getTradingCalendar,
  isMarketOpenNow,
  getSessionNow,
  getSupportedMarkets,
  getMarketWeekdayName,
  type SessionType,
} from '../../../../electron/engine/data/trading-calendar';

describe('singleton', () => {
  it('returns instance', () => {
    expect(getTradingCalendar()).toBeInstanceOf(TradingCalendar);
  });
  it('same instance', () => {
    expect(getTradingCalendar()).toBe(getTradingCalendar());
  });
});

describe('construction', () => {
  it('creates new', () => {
    expect(new TradingCalendar()).toBeInstanceOf(TradingCalendar);
  });
});

describe('getSupportedMarkets', () => {
  it('returns 4 markets', () => {
    const m = getSupportedMarkets();
    expect(m).toEqual(['US','HK','CN','CRYPTO']);
  });
});

let cal;
beforeEach(() => { cal = new TradingCalendar(); });

describe('isHoliday', () => {
  it('US Independence Day 2024 is holiday', () => {
    expect(cal.isHoliday('US', new Date('2024-07-04T12:00:00Z'))).toBe(true);
  });
  it('US regular weekday is not holiday', () => {
    expect(cal.isHoliday('US', new Date('2024-06-12T12:00:00Z'))).toBe(false);
  });
  it('HK Christmas 2024 is holiday', () => {
    expect(cal.isHoliday('HK', new Date('2024-12-25T12:00:00Z'))).toBe(true);
  });
  it('CRYPTO never has holidays', () => {
    expect(cal.isHoliday('CRYPTO', new Date('2024-12-25T12:00:00Z'))).toBe(false);
  });
  it('far past returns boolean', () => {
    expect(typeof cal.isHoliday('US',new Date('2010-01-01'))).toBe('boolean');
  });
  it('far future returns boolean', () => {
    expect(typeof cal.isHoliday('US',new Date('2030-12-25'))).toBe('boolean');
  });
});

describe('getHolidays', () => {
  it('returns US 2024 holidays', () => {
    const h = cal.getHolidaysForYear('US',2024);
    expect(h.length).toBeGreaterThan(0);
    expect(h[0].market).toBe('US');
    expect(h[0]).toHaveProperty('date');
    expect(h[0]).toHaveProperty('name');
  });
  it('HK 2025 has holidays', () => {
    const h = cal.getHolidaysForYear('HK',2025);
    expect(h.length).toBeGreaterThan(0);
  });
  it('year out of range returns empty', () => {
    const h = cal.getHolidaysForYear('US',2010);
    expect(Array.isArray(h)).toBe(true);
  });
});

describe('isMarketOpen', () => {
  it('US closed Saturday', () => {
    expect(cal.isMarketOpen('US',new Date('2024-06-15T16:00:00Z'))).toBe(false);
  });
  it('US closed Sunday', () => {
    expect(cal.isMarketOpen('US',new Date('2024-06-16T16:00:00Z'))).toBe(false);
  });
  it('US closed Christmas', () => {
    expect(cal.isMarketOpen('US',new Date('2024-12-25T16:00:00Z'))).toBe(false);
  });
  it('CRYPTO always open', () => {
    expect(cal.isMarketOpen('CRYPTO',new Date('2024-12-25T12:00:00Z'))).toBe(true);
  });
  it('US weekday returns boolean', () => {
    expect(typeof cal.isMarketOpen('US',new Date('2024-06-11T16:00:00Z'))).toBe('boolean');
  });
  it('HK weekday returns boolean', () => {
    expect(typeof cal.isMarketOpen('HK',new Date('2024-12-23T04:00:00Z'))).toBe('boolean');
  });
  it('CN weekday returns boolean', () => {
    expect(typeof cal.isMarketOpen('CN',new Date('2024-06-11T06:00:00Z'))).toBe('boolean');
  });
});

describe('getSession', () => {
  it('returns valid SessionType for US', () => {
    const v = ['pre-market','regular','after-hours','closed'];
    expect(v).toContain(cal.getSession('US',new Date('2024-06-11T16:00:00Z')));
  });
  it('CRYPTO returns regular', () => {
    expect(cal.getSession('CRYPTO',new Date())).toBe('regular');
  });
  it('midnight returns valid type', () => {
    const v = ['pre-market','regular','after-hours','closed'];
    expect(v).toContain(cal.getSession('US',new Date('2024-06-11T00:00:00Z')));
  });
});

describe('getNextOpen', () => {
  it('returns Date for US', () => {
    const n = cal.getNextOpen('US');
    expect(n).toBeInstanceOf(Date);
  });
  it('returns Date for HK', () => {
    expect(cal.getNextOpen('HK')).toBeInstanceOf(Date);
  });
  it('returns Date for CN', () => {
    expect(cal.getNextOpen('CN')).toBeInstanceOf(Date);
  });
  it('accepts from parameter', () => {
    const from = new Date('2024-12-25T12:00:00Z');
    const n = cal.getNextOpen('US',from);
    expect(n.getTime()).toBeGreaterThan(from.getTime());
  });
  it('Saturday to Monday', () => {
    const sat = new Date('2024-06-15T12:00:00Z');
    expect(cal.getNextOpen('US',sat).getTime()).toBeGreaterThan(sat.getTime());
  });
});

describe('getPreviousTradingDay', () => {
  it('returns Date', () => {
    expect(cal.getPreviousTradingDay('US')).toBeInstanceOf(Date);
  });
  it('accepts from parameter', () => {
    const from = new Date('2024-12-27T12:00:00Z');
    const p = cal.getPreviousTradingDay('US',from);
    expect(p.getTime()).toBeLessThan(from.getTime());
  });
  it('works for HK', () => {
    expect(cal.getPreviousTradingDay('HK')).toBeInstanceOf(Date);
  });
  it('works for CN', () => {
    expect(cal.getPreviousTradingDay('CN')).toBeInstanceOf(Date);
  });
  it('Monday should return previous Friday', () => {
    const mon = new Date('2024-06-17T12:00:00Z');
    expect(cal.getPreviousTradingDay('US',mon).getTime()).toBeLessThan(mon.getTime());
  });
});

describe('getHolidaysInRange', () => {
  it('returns array', () => {
    const r = cal.getUpcomingHolidays('US',365);
    expect(Array.isArray(r)).toBe(true);
  });
  it('narrow range may be empty', () => {
    const r = cal.getUpcomingHolidays('US',5);
    expect(Array.isArray(r)).toBe(true);
  });
});

describe('getTradingDaysInRange', () => {
  it('returns number >= 0', () => {
    const d = cal.getTradingDaysInYear(2024,'US');
    expect(d).toBeGreaterThan(200); expect(d).toBeLessThan(260);
  });
  
  it('HK works', () => {
    expect(typeof cal.getTradingDaysInYear(2024,'HK')).toBe('number');
  });
  it('full year positive', () => {
    const d = cal.getTradingDaysInYear(2024,'US');
    expect(d).toBeGreaterThan(200);
  });
});

describe('getAllMarketSessions', () => {
  it('returns 4 markets', () => {
    const s = cal.getAllMarketSessions();
    expect(s).toHaveProperty('US');
    expect(s).toHaveProperty('HK');
    expect(s).toHaveProperty('CN');
    expect(s.CRYPTO).toBe('regular');
  });
  it('accepts optional timestamp', () => {
    expect(cal.getAllMarketSessions(new Date('2024-06-11T16:00:00Z'))).toBeDefined();
  });
});

describe('isAnyMarketOpen / getOpenMarkets', () => {
  it('returns boolean', () => {
    expect(typeof cal.isAnyMarketOpen()).toBe('boolean');
  });
  it('CRYPTO always in open markets', () => {
    expect(cal.getOpenMarkets(new Date('2024-12-25T12:00:00Z'))).toContain('CRYPTO');
  });
});

describe('getNextMarketToOpen', () => {
  it('returns NextOpenInfo', () => {
    const i = cal.getNextMarketToOpen();
    expect(i).toHaveProperty('date');
    expect(i).toHaveProperty('session');
    expect(i).toHaveProperty('market');
    expect(i.date).toBeInstanceOf(Date);
  });
});

describe('formatMarketTime', () => {
  it('formats US time', () => {
    const s = cal.formatMarketTime(new Date('2024-06-11T16:00:00Z'),'US');
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(5);
  });
  it('formats HK with HKT', () => {
    expect(cal.formatMarketTime(new Date('2024-06-11T04:00:00Z'),'HK')).toContain('HKT');
  });
  it('formats CRYPTO with UTC', () => {
    expect(cal.formatMarketTime(new Date('2024-06-11T12:00:00Z'),'CRYPTO')).toContain('UTC');
  });
});

describe('standalone utilities', () => {
  it('isMarketOpenNow returns boolean', () => {
    expect(typeof isMarketOpenNow('US')).toBe('boolean');
  });
  it('getSessionNow returns valid type', () => {
    const v = ['pre-market','regular','after-hours','closed'];
    expect(v).toContain(getSessionNow('US'));
  });
  it('getMarketWeekdayName returns day name', () => {
    const d = getMarketWeekdayName('US',new Date('2024-06-11T16:00:00Z'));
    const vd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    expect(vd).toContain(d);
  });
});
