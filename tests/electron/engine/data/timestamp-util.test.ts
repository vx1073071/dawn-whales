/**
 * timestamp-util.test.ts — R98 J-01 UTC Standardization Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TimestampUtil,
  timestampUtil,
  getTimestampUtil,
  TimestampConversion,
} from '../../../../electron/engine/data/timestamp-util';

describe('TimestampUtil', () => {
  describe('toUTC', () => {
    it('converts Date to UTC ms', () => {
      const d = new Date('2024-06-15T10:30:00Z');
      const ms = TimestampUtil.toUTC(d);
      expect(ms).toBe(d.getTime());
      expect(typeof ms).toBe('number');
    });

    it('converts ISO string to UTC ms', () => {
      const ms = TimestampUtil.toUTC('2024-06-15T10:30:00Z');
      expect(ms).toBe(new Date('2024-06-15T10:30:00Z').getTime());
    });

    it('converts unix seconds to ms', () => {
      const ms = TimestampUtil.toUTC(1700000000);
      expect(ms).toBe(1700000000000);
    });

    it('passes through millisecond values >10^10', () => {
      const ms = TimestampUtil.toUTC(1700000000000);
      expect(ms).toBe(1700000000000);
    });

    it('handles epoch 0 seconds', () => {
      const ms = TimestampUtil.toUTC(0);
      expect(ms).toBe(0);
    });

    it('handles Date object at midnight', () => {
      const d = new Date('2024-01-01T00:00:00Z');
      expect(TimestampUtil.toUTC(d)).toBe(d.getTime());
    });

    it('handles millisecond value at boundary 9999999999', () => {
      expect(TimestampUtil.toUTC(9999999999)).toBe(9999999999000);
    });

    it('handles millisecond value just above boundary', () => {
      expect(TimestampUtil.toUTC(10000000000)).toBe(10000000000);
    });
  });

  describe('fromUTC', () => {
    it('returns Date with same UTC ms', () => {
      const ms = 1700000000000;
      const d = TimestampUtil.fromUTC(ms);
      expect(d).toBeInstanceOf(Date);
      expect(d.getTime()).toBe(ms);
    });

    it('handles epoch', () => {
      const d = TimestampUtil.fromUTC(0);
      expect(d.getTime()).toBe(0);
      expect(d.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('toLocal', () => {
    it('formats UTC ms with timezone', () => {
      const ms = new Date('2024-06-15T10:30:00Z').getTime();
      const result = TimestampUtil.toLocal(ms, 'Asia/Hong_Kong');
      expect(result).toContain('2024');
      expect(result).toContain('06');
      expect(result).toContain('15');
    });

    it('defaults to local timezone when none specified', () => {
      const ms = Date.now();
      const result = TimestampUtil.toLocal(ms);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    });

    it('respects custom format options', () => {
      const ms = new Date('2024-06-15T10:30:00Z').getTime();
      const result = TimestampUtil.toLocal(ms, 'UTC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
      });
      expect(result).toContain('June');
    });

    it('handles negative offset timezones', () => {
      const ms = new Date('2024-06-15T10:30:00Z').getTime();
      const result = TimestampUtil.toLocal(ms, 'America/New_York');
      expect(typeof result).toBe('string');
    });

    it('handles UTC timezone explicitly', () => {
      const ms = new Date('2024-06-15T12:00:00Z').getTime();
      const result = TimestampUtil.toLocal(ms, 'UTC');
      expect(result).toContain('12:00');
    });
  });

  describe('guessTimezone', () => {
    it('returns a valid IANA timezone string', () => {
      const tz = TimestampUtil.guessTimezone();
      expect(typeof tz).toBe('string');
      expect(tz).toContain('/');
    });
  });

  describe('getOffsetMinutes', () => {
    it('returns positive offset for Asia/Hong_Kong', () => {
      const ms = new Date('2024-06-15T00:00:00Z').getTime();
      const offset = TimestampUtil.getOffsetMinutes(ms, 'Asia/Hong_Kong');
      expect(offset).toBe(480); // UTC+8
    });

    it('returns negative offset for America/New_York (EST)', () => {
      const ms = new Date('2024-01-15T12:00:00Z').getTime();
      const offset = TimestampUtil.getOffsetMinutes(ms, 'America/New_York');
      expect(offset).toBe(-300); // UTC-5
    });

    it('returns 0 for UTC', () => {
      const ms = new Date('2024-06-15T00:00:00Z').getTime();
      const offset = TimestampUtil.getOffsetMinutes(ms, 'UTC');
      expect(offset).toBe(0);
    });

    it('returns correct offset for Tokyo (UTC+9)', () => {
      const ms = new Date('2024-06-15T00:00:00Z').getTime();
      const offset = TimestampUtil.getOffsetMinutes(ms, 'Asia/Tokyo');
      expect(offset).toBe(540);
    });

    it('handles invalid timezone gracefully', () => {
      const ms = new Date('2024-06-15T12:00:00Z').getTime();
      const offset = TimestampUtil.getOffsetMinutes(ms, 'Invalid/Zone');
      expect(typeof offset).toBe('number');
    });
  });

  describe('isDST', () => {
    it('returns false for Asia/Hong_Kong (no DST)', () => {
      const ms = new Date('2024-06-15T12:00:00Z').getTime();
      expect(TimestampUtil.isDST(ms, 'Asia/Hong_Kong')).toBe(false);
    });

    it('returns true for US Eastern during summer', () => {
      const ms = new Date('2024-07-15T12:00:00Z').getTime();
      const isDst = TimestampUtil.isDST(ms, 'America/New_York');
      expect(isDst).toBe(true);
    });

    it('returns false for US Eastern during winter', () => {
      const ms = new Date('2024-01-15T12:00:00Z').getTime();
      const isDst = TimestampUtil.isDST(ms, 'America/New_York');
      expect(isDst).toBe(false);
    });

    it('returns true for London during summer (BST)', () => {
      const ms = new Date('2024-07-15T12:00:00Z').getTime();
      const isDst = TimestampUtil.isDST(ms, 'Europe/London');
      expect(isDst).toBe(true);
    });

    it('returns false for London during winter (GMT)', () => {
      const ms = new Date('2024-01-15T12:00:00Z').getTime();
      const isDst = TimestampUtil.isDST(ms, 'Europe/London');
      expect(isDst).toBe(false);
    });
  });

  describe('now', () => {
    it('returns current time in ms', () => {
      const before = Date.now();
      const now = TimestampUtil.now();
      const after = Date.now();
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(after);
    });

    it('returns a number', () => {
      expect(typeof TimestampUtil.now()).toBe('number');
    });
  });

  describe('normalizeISO', () => {
    it('handles date-only string', () => {
      const ms = TimestampUtil.normalizeISO('2024-06-15');
      const d = new Date(ms);
      expect(d.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    });

    it('handles full ISO with Z', () => {
      const ms = TimestampUtil.normalizeISO('2024-06-15T10:30:00Z');
      expect(ms).toBe(new Date('2024-06-15T10:30:00Z').getTime());
    });

    it('handles ISO with offset', () => {
      const ms = TimestampUtil.normalizeISO('2024-06-15T10:30:00+08:00');
      const d = new Date(ms);
      expect(d.toISOString()).toBe('2024-06-15T02:30:00.000Z');
    });

    it('appends Z when no timezone present', () => {
      const ms = TimestampUtil.normalizeISO('2024-06-15T10:30:00');
      expect(ms).toBe(new Date('2024-06-15T10:30:00Z').getTime());
    });

    it('handles extra whitespace', () => {
      const ms = TimestampUtil.normalizeISO('  2024-06-15  ');
      expect(ms).toBe(new Date('2024-06-15T00:00:00Z').getTime());
    });
  });

  describe('localToUTC', () => {
    it('converts HK local time to UTC', () => {
      // 10:00 HKT = 02:00 UTC
      const utcMs = TimestampUtil.localToUTC(2024, 6, 15, 10, 0, 'Asia/Hong_Kong');
      const dt = new Date(utcMs);
      expect(dt.getUTCHours()).toBe(2);
      expect(dt.getUTCFullYear()).toBe(2024);
      expect(dt.getUTCMonth()).toBe(5); // June = 5 (0-indexed)
      expect(dt.getUTCDate()).toBe(15);
    });

    it('handles local midnight to UTC', () => {
      // 00:00 HKT = 16:00 UTC (previous day)
      const utcMs = TimestampUtil.localToUTC(2024, 1, 15, 0, 0, 'Asia/Hong_Kong');
      const dt = new Date(utcMs);
      expect(dt.getUTCHours()).toBe(16);
    });

    it('works with UTC timezone (no offset)', () => {
      const utcMs = TimestampUtil.localToUTC(2024, 6, 15, 12, 0, 'UTC');
      const dt = new Date(utcMs);
      expect(dt.getUTCHours()).toBe(12);
    });
  });

  describe('analyze', () => {
    it('returns TimestampConversion with all fields', () => {
      const ms = new Date('2024-06-15T10:30:00Z').getTime();
      const result = TimestampUtil.analyze(ms, 'Asia/Hong_Kong');
      expect(result.utcMs).toBe(ms);
      expect(result.timezone).toBe('Asia/Hong_Kong');
      expect(result.localISO).toContain('2024');
      expect(typeof result.offsetMinutes).toBe('number');
      expect(typeof result.isDST).toBe('boolean');
    });

    it('uses guessTimezone when no timezone provided', () => {
      const result = TimestampUtil.analyze(Date.now());
      expect(result.timezone).toBe(TimestampUtil.guessTimezone());
    });
  });

  describe('getTimestampUtil', () => {
    it('returns the TimestampUtil class', () => {
      const util = getTimestampUtil();
      expect(util).toBe(TimestampUtil);
    });
  });

  describe('timestampUtil singleton', () => {
    it('is the same as TimestampUtil class', () => {
      expect(timestampUtil).toBe(TimestampUtil);
    });

    it('has all static methods', () => {
      expect(typeof timestampUtil.toUTC).toBe('function');
      expect(typeof timestampUtil.fromUTC).toBe('function');
      expect(typeof timestampUtil.toLocal).toBe('function');
      expect(typeof timestampUtil.guessTimezone).toBe('function');
    });
  });
});
