/**
 * TimestampUtil — UTC Standardization Utility
 * R98 J-01: All timestamp storage unified to UTC milliseconds.
 * Data entry points auto-convert; DST-safe via Intl.DateTimeFormat.
 */

export type SupportedTimezone =
  | 'UTC'
  | 'America/New_York'
  | 'America/Chicago'
  | 'Asia/Hong_Kong'
  | 'Asia/Shanghai'
  | 'Asia/Tokyo'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'Australia/Sydney'
  | 'Asia/Dubai'
  | (string & {});

export interface TimestampConversion {
  utcMs: number;
  timezone: string;
  localISO: string;
  offsetMinutes: number;
  isDST: boolean;
}

export class TimestampUtil {
  static toUTC(input: Date | string | number): number {
    if (input instanceof Date) return input.getTime();
    if (typeof input === 'string') return new Date(input).getTime();
    if (input <= 9999999999) return input * 1000;
    return input;
  }

  static fromUTC(utcMs: number): Date {
    return new Date(utcMs);
  }

  static toLocal(
    utcMs: number,
    timezone?: string,
    options?: Intl.DateTimeFormatOptions
  ): string {
    const tz = timezone || TimestampUtil.guessTimezone();
    const opts: Intl.DateTimeFormatOptions = options || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      hour12: false,
    };
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).format(
      new Date(utcMs)
    );
  }

  static guessTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  static getOffsetMinutes(utcMs: number, timezone: string): number {
    try {
      const dt = new Date(utcMs);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'longOffset',
      }).formatToParts(dt);

      const offsetStr =
        parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';

      const match = offsetStr.match(/([+-])\s*(\d{1,2}):?(\d{2})?/);
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const mins = parseInt(match[3] || '0', 10);
        return sign * (hours * 60 + mins);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  static isDST(utcMs: number, timezone: string): boolean {
    const jan1 = new Date(new Date(utcMs).getFullYear(), 0, 1).getTime();
    const janOffset = TimestampUtil.getOffsetMinutes(jan1, timezone);
    const currOffset = TimestampUtil.getOffsetMinutes(utcMs, timezone);
    return currOffset !== janOffset;
  }

  static now(): number {
    return Date.now();
  }

  static normalizeISO(iso: string): number {
    let s = iso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      s += 'T00:00:00Z';
    }
    if (
      !/[Zz]$/.test(s) &&
      !/[+\-]\d{2}:\d{2}$/.test(s) &&
      !/[+\-]\d{4}$/.test(s)
    ) {
      s += 'Z';
    }
    return new Date(s).getTime();
  }

  static localToUTC(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timezone: string
  ): number {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const iso =
      pad(year) +
      '-' +
      pad(month) +
      '-' +
      pad(day) +
      'T' +
      pad(hour) +
      ':' +
      pad(minute) +
      ':00';
    const offset = TimestampUtil.getOffsetMinutes(
      new Date(iso + 'Z').getTime(),
      timezone
    );
    const localMs = new Date(iso + 'Z').getTime();
    return localMs - offset * 60000;
  }

  static analyze(utcMs: number, timezone?: string): TimestampConversion {
    const tz = timezone || TimestampUtil.guessTimezone();
    return {
      utcMs,
      timezone: tz,
      localISO: new Date(utcMs).toISOString(),
      offsetMinutes: TimestampUtil.getOffsetMinutes(utcMs, tz),
      isDST: TimestampUtil.isDST(utcMs, tz),
    };
  }
}

export function getTimestampUtil(): typeof TimestampUtil {
  return TimestampUtil;
}

export const timestampUtil = TimestampUtil;
