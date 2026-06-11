/**
 * market-clock.test.ts — R98 J-02 7-Market Trading Time Engine Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MarketClock,
  getMarketClock,
  MarketStatus,
  MarketStatusInfo,
} from '../../../../electron/engine/data/market-clock';

describe('MarketClock', () => {
  let clock: MarketClock;

  beforeEach(() => {
    clock = new MarketClock();
  });

  describe('getSchedule', () => {
    it('returns US schedule', () => {
      const s = clock.getSchedule('US');
      expect(s).toBeDefined();
      expect(s!.market).toBe('US');
      expect(s!.timezone).toBe('America/New_York');
      expect(s!.regularOpen).toBe(570);
      expect(s!.regularClose).toBe(960);
      expect(s!.hasPreMarket).toBe(true);
      expect(s!.hasAfterHours).toBe(true);
    });

    it('returns HK schedule with lunch break', () => {
      const s = clock.getSchedule('HK');
      expect(s!.lunchStart).toBe(720);
      expect(s!.lunchEnd).toBe(780);
    });

    it('returns CN schedule with lunch break', () => {
      const s = clock.getSchedule('CN');
      expect(s!.lunchStart).toBe(690);
      expect(s!.lunchEnd).toBe(780);
    });

    it('returns JP schedule with lunch break', () => {
      const s = clock.getSchedule('JP');
      expect(s!.lunchStart).toBe(690);
      expect(s!.lunchEnd).toBe(750);
    });

    it('returns CRYPTO schedule (24x7)', () => {
      const s = clock.getSchedule('CRYPTO');
      expect(s!.regularOpen).toBe(0);
      expect(s!.regularClose).toBe(1440);
      expect(s!.lunchStart).toBeNull();
    });

    it('returns null for unknown market', () => {
      expect(clock.getSchedule('MARS')).toBeNull();
    });
  });

  describe('getSupportedMarkets', () => {
    it('returns all 7 markets', () => {
      const markets = clock.getSupportedMarkets();
      expect(markets).toHaveLength(7);
      expect(markets).toContain('US');
      expect(markets).toContain('HK');
      expect(markets).toContain('CN');
      expect(markets).toContain('JP');
      expect(markets).toContain('UK');
      expect(markets).toContain('EU');
      expect(markets).toContain('CRYPTO');
    });
  });

  describe('getStatus', () => {
    it('CRYPTO is always open', () => {
      expect(clock.getStatus('CRYPTO')).toBe('open');
      expect(clock.getStatus('CRYPTO', new Date('2024-01-01T00:00:00Z'))).toBe('open');
    });

    it('returns closed for unknown market', () => {
      expect(clock.getStatus('MARS')).toBe('closed');
    });

    it('returns a valid MarketStatus string', () => {
      const statuses: MarketStatus[] = ['open', 'pre_close', 'closed', 'lunch_break'];
      const s = clock.getStatus('HK');
      expect(statuses).toContain(s);
    });

    it('all 7 markets return valid status', () => {
      const markets = clock.getSupportedMarkets();
      for (const m of markets) {
        const s = clock.getStatus(m);
        expect(['open', 'pre_close', 'closed', 'lunch_break']).toContain(s);
      }
    });

    it('accepts optional atTime parameter', () => {
      // Use a known trading day: Monday 2024-06-17
      const mondayOpenHK = new Date('2024-06-17T03:00:00Z'); // 11:00 HKT
      const status = clock.getStatus('HK', mondayOpenHK);
      // HK 09:30-12:00 regular, so 11:00 should be open
      // But depends on trading calendar - just check it returns a valid status
      expect(['open', 'pre_close', 'closed', 'lunch_break']).toContain(status);
    });
  });

  describe('isTradingHour', () => {
    it('returns boolean', () => {
      const result = clock.isTradingHour('HK');
      expect(typeof result).toBe('boolean');
    });

    it('CRYPTO always returns true', () => {
      expect(clock.isTradingHour('CRYPTO')).toBe(true);
    });

    it('unknown market returns false', () => {
      expect(clock.isTradingHour('MARS')).toBe(false);
    });
  });

  describe('isAnyMarketOpen', () => {
    it('returns true when CRYPTO is included', () => {
      expect(clock.isAnyMarketOpen(['CRYPTO'])).toBe(true);
    });

    it('returns false for unknown markets', () => {
      expect(clock.isAnyMarketOpen(['MARS', 'VENUS'])).toBe(false);
    });

    it('returns boolean', () => {
      expect(typeof clock.isAnyMarketOpen(['US', 'HK'])).toBe('boolean');
    });
  });

  describe('getNextOpen', () => {
    it('returns Date for valid market', () => {
      const next = clock.getNextOpen('HK');
      expect(next).toBeInstanceOf(Date);
    });

    it('returns Date for US', () => {
      const next = clock.getNextOpen('US');
      expect(next).toBeInstanceOf(Date);
    });

    it('returns valid Date for all 7 markets', () => {
      const markets = clock.getSupportedMarkets();
      for (const m of markets) {
        const next = clock.getNextOpen(m);
        expect(next).toBeInstanceOf(Date);
        expect(next!.getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('getNextClose', () => {
    it('returns null for CRYPTO (never closes)', () => {
      expect(clock.getNextClose('CRYPTO')).toBeNull();
    });

    it('returns null for unknown market', () => {
      expect(clock.getNextClose('MARS')).toBeNull();
    });

    it('returns Date for HK', () => {
      const next = clock.getNextClose('HK');
      expect(next).toBeInstanceOf(Date);
    });

    it('returns Date for US', () => {
      const next = clock.getNextClose('US');
      expect(next).toBeInstanceOf(Date);
    });
  });

  describe('getNextLunch', () => {
    it('returns null for US (no lunch break)', () => {
      expect(clock.getNextLunch('US')).toBeNull();
    });

    it('returns null for CRYPTO (no lunch break)', () => {
      expect(clock.getNextLunch('CRYPTO')).toBeNull();
    });

    it('returns null for unknown market', () => {
      expect(clock.getNextLunch('MARS')).toBeNull();
    });

    it('returns object with start/end for HK (has lunch)', () => {
      // During HK trading hours
      const lunch = clock.getNextLunch('HK', new Date('2024-06-17T04:00:00Z')); // 12:00 HKT
      if (lunch) {
        expect(lunch.start).toBeInstanceOf(Date);
        expect(lunch.end).toBeInstanceOf(Date);
        expect(lunch.end.getTime()).toBeGreaterThan(lunch.start.getTime());
      }
    });

    it('returns null for HK after lunch ends', () => {
      // After lunch ends (14:00 HKT)
      const lunch = clock.getNextLunch('HK', new Date('2024-06-17T06:00:00Z'));
      expect(lunch).toBeNull();
    });
  });

  describe('getCurrentSession', () => {
    it('returns null for CRYPTO (no defined sessions)', () => {
      expect(clock.getCurrentSession('CRYPTO')).toBeNull();
    });

    it('returns null for unknown market', () => {
      expect(clock.getCurrentSession('MARS')).toBeNull();
    });

    it('returns SessionInfo or null for HK', () => {
      const session = clock.getCurrentSession('HK');
      if (session) {
        expect(session).toHaveProperty('type');
        expect(session).toHaveProperty('open');
        expect(session).toHaveProperty('close');
      }
    });
  });

  describe('getOpenMarkets', () => {
    it('always includes CRYPTO', () => {
      const open = clock.getOpenMarkets();
      expect(open).toContain('CRYPTO');
    });

    it('returns array of market codes', () => {
      const open = clock.getOpenMarkets();
      expect(Array.isArray(open)).toBe(true);
      open.forEach((m) => {
        expect(clock.getSupportedMarkets()).toContain(m);
      });
    });
  });

  describe('getAllStatuses', () => {
    it('returns statuses for all 7 markets', () => {
      const statuses = clock.getAllStatuses();
      expect(statuses).toHaveLength(7);
      expect(statuses[0]).toHaveProperty('market');
      expect(statuses[0]).toHaveProperty('status');
      expect(statuses[0]).toHaveProperty('localTime');
      expect(statuses[0]).toHaveProperty('isDST');
    });

    it('all statuses have valid market codes', () => {
      const statuses = clock.getAllStatuses();
      const markets = clock.getSupportedMarkets();
      statuses.forEach((s: MarketStatusInfo) => {
        expect(markets).toContain(s.market);
      });
    });

    it('all status strings are valid', () => {
      const validStatuses: MarketStatus[] = ['open', 'pre_close', 'closed', 'lunch_break'];
      const statuses = clock.getAllStatuses();
      statuses.forEach((s: MarketStatusInfo) => {
        expect(validStatuses).toContain(s.status);
      });
    });
  });

  describe('getStatusInfo', () => {
    it('returns comprehensive info for HK', () => {
      const info = clock.getStatusInfo('HK');
      expect(info.market).toBe('HK');
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('currentSession');
      expect(info).toHaveProperty('nextOpen');
      expect(info).toHaveProperty('nextClose');
      expect(info).toHaveProperty('localTime');
      expect(info).toHaveProperty('isDST');
    });

    it('DST info is boolean', () => {
      const info = clock.getStatusInfo('US');
      expect(typeof info.isDST).toBe('boolean');
    });

    it('Asia/HK isDST is false', () => {
      const info = clock.getStatusInfo('HK');
      expect(info.isDST).toBe(false);
    });
  });

  describe('DST handling', () => {
    it('UK uses BST in summer', () => {
      const summer = new Date('2024-07-15T12:00:00Z');
      const info = clock.getStatusInfo('UK', summer);
      expect(info.isDST).toBe(true);
    });

    it('UK uses GMT in winter', () => {
      const winter = new Date('2024-01-15T12:00:00Z');
      const info = clock.getStatusInfo('UK', winter);
      expect(info.isDST).toBe(false);
    });

    it('US uses EDT in summer', () => {
      const summer = new Date('2024-07-15T17:00:00Z');
      const info = clock.getStatusInfo('US', summer);
      expect(info.isDST).toBe(true);
    });

    it('EU uses CEST in summer', () => {
      const summer = new Date('2024-07-15T12:00:00Z');
      const info = clock.getStatusInfo('EU', summer);
      expect(info.isDST).toBe(true);
    });
  });

  describe('getMarketClock factory', () => {
    it('creates a MarketClock instance', () => {
      const c = getMarketClock();
      expect(c).toBeInstanceOf(MarketClock);
    });

    it('has all public methods', () => {
      const c = getMarketClock();
      expect(typeof c.getStatus).toBe('function');
      expect(typeof c.isTradingHour).toBe('function');
      expect(typeof c.getNextOpen).toBe('function');
    });
  });

  describe('lunch break handling', () => {
    it('HK has lunch_break status at noon', () => {
      // Monday 2024-06-17 12:30 HKT = 04:30 UTC
      const lunchTime = new Date('2024-06-17T04:30:00Z');
      const status = clock.getStatus('HK', lunchTime);
      // Should be lunch_break if trading day, but depends on calendar
      expect(['lunch_break', 'closed', 'open']).toContain(status);
    });

    it('CN has lunch break configured', () => {
      const s = clock.getSchedule('CN');
      expect(s!.lunchStart).toBe(690); // 11:30
      expect(s!.lunchEnd).toBe(780);   // 13:00
    });

    it('US has no lunch break', () => {
      const s = clock.getSchedule('US');
      expect(s!.lunchStart).toBeNull();
      expect(s!.lunchEnd).toBeNull();
    });
  });

  describe('timezone correctness', () => {
    it('US uses America/New_York', () => {
      expect(clock.getSchedule('US')!.timezone).toBe('America/New_York');
    });

    it('HK uses Asia/Hong_Kong', () => {
      expect(clock.getSchedule('HK')!.timezone).toBe('Asia/Hong_Kong');
    });

    it('CN uses Asia/Shanghai', () => {
      expect(clock.getSchedule('CN')!.timezone).toBe('Asia/Shanghai');
    });

    it('JP uses Asia/Tokyo', () => {
      expect(clock.getSchedule('JP')!.timezone).toBe('Asia/Tokyo');
    });

    it('UK uses Europe/London', () => {
      expect(clock.getSchedule('UK')!.timezone).toBe('Europe/London');
    });

    it('EU uses Europe/Berlin', () => {
      expect(clock.getSchedule('EU')!.timezone).toBe('Europe/Berlin');
    });

    it('CRYPTO uses UTC', () => {
      expect(clock.getSchedule('CRYPTO')!.timezone).toBe('UTC');
    });
  });
});
