/**
 * MarketClock — 7-Market Trading Time Engine
 * R98 J-02: Real-time market status for US/HK/CN/JP/UK/EU/CRYPTO.
 * Uses trading-calendar.ts existing data: SESSIONS, MarketType, TradingCalendar.
 *
 * Key features:
 * - getStatus(market) → open | pre_close | closed | lunch_break
 * - isTradingHour(market) → boolean (regular session only)
 * - getNextOpen(market) → NextOpenInfo
 * - getNextClose(market) → NextOpenInfo
 * - getCurrentSession(market) → current session details
 *
 * Lunch breaks:
 * - CN: 11:30-13:00 CST
 * - HK: 12:00-13:00 HKT
 * - JP: 11:30-12:30 JST
 *
 * DST awareness: uses timestamp-util.ts TimestampUtil.getOffsetMinutes()
 * for US (EST/EDT), UK (GMT/BST), EU (CET/CEST).
 */

import {
  TradingCalendar,
  getTradingCalendar,
  MarketType,
  SessionType,
  SessionInfo,
} from './trading-calendar';
import { TimestampUtil } from './timestamp-util';

export type MarketStatus = 'open' | 'pre_close' | 'closed' | 'lunch_break';

export type SupportedMarket = Exclude<MarketType, 'FUTURES' | 'FOREX' | 'BOND' | 'COMMODITY' | 'INDEX'> | 'JP' | 'UK' | 'EU' | 'CRYPTO';

export interface MarketStatusInfo {
  market: string;
  status: MarketStatus;
  currentSession: SessionInfo | null;
  nextOpen: Date | null;
  nextClose: Date | null;
  nextLunchStart: Date | null;
  nextLunchEnd: Date | null;
  localTime: string;
  isDST: boolean;
}

export interface MarketSchedule {
  market: string;
  timezone: string;
  regularOpen: number;   // minutes from midnight
  regularClose: number;  // minutes from midnight
  lunchStart: number | null;  // minutes from midnight, null if no lunch
  lunchEnd: number | null;
  hasPreMarket: boolean;
  hasAfterHours: boolean;
}

/** 7 market schedules (minutes from midnight local time) */
const SCHEDULES: Record<string, MarketSchedule> = {
  US: {
    market: 'US',
    timezone: 'America/New_York',
    regularOpen: 570,    // 09:30
    regularClose: 960,   // 16:00
    lunchStart: null,
    lunchEnd: null,
    hasPreMarket: true,
    hasAfterHours: true,
  },
  HK: {
    market: 'HK',
    timezone: 'Asia/Hong_Kong',
    regularOpen: 570,    // 09:30
    regularClose: 960,   // 16:00
    lunchStart: 720,     // 12:00
    lunchEnd: 780,       // 13:00
    hasPreMarket: false,
    hasAfterHours: false,
  },
  CN: {
    market: 'CN',
    timezone: 'Asia/Shanghai',
    regularOpen: 570,    // 09:30
    regularClose: 900,   // 15:00
    lunchStart: 690,     // 11:30
    lunchEnd: 780,       // 13:00
    hasPreMarket: false,
    hasAfterHours: false,
  },
  JP: {
    market: 'JP',
    timezone: 'Asia/Tokyo',
    regularOpen: 540,    // 09:00
    regularClose: 900,   // 15:00
    lunchStart: 690,     // 11:30
    lunchEnd: 750,       // 12:30
    hasPreMarket: false,
    hasAfterHours: false,
  },
  UK: {
    market: 'UK',
    timezone: 'Europe/London',
    regularOpen: 480,    // 08:00
    regularClose: 990,   // 16:30
    lunchStart: null,
    lunchEnd: null,
    hasPreMarket: false,
    hasAfterHours: false,
  },
  EU: {
    market: 'EU',
    timezone: 'Europe/Berlin',
    regularOpen: 540,    // 09:00
    regularClose: 1050,  // 17:30
    lunchStart: null,
    lunchEnd: null,
    hasPreMarket: false,
    hasAfterHours: false,
  },
  CRYPTO: {
    market: 'CRYPTO',
    timezone: 'UTC',
    regularOpen: 0,      // 00:00
    regularClose: 1440,  // 24:00 (always open)
    lunchStart: null,
    lunchEnd: null,
    hasPreMarket: false,
    hasAfterHours: false,
  },
};

export class MarketClock {
  private calendar: TradingCalendar;

  constructor(calendar?: TradingCalendar) {
    this.calendar = calendar || getTradingCalendar();
  }

  /**
   * Get schedule for a market.
   */
  getSchedule(market: string): MarketSchedule | null {
    return SCHEDULES[market] || null;
  }

  /**
   * Get all supported market codes.
   */
  getSupportedMarkets(): string[] {
    return Object.keys(SCHEDULES);
  }

  /**
   * Get the current status of a market.
   * Returns: open | pre_close | closed | lunch_break
   */
  getStatus(market: string, atTime?: Date): MarketStatus {
    const now = atTime || new Date();
    const schedule = SCHEDULES[market];
    if (!schedule) return 'closed';

    // CRYPTO is always open
    if (market === 'CRYPTO') return 'open';

    // Check if market is open today (trading calendar) for US/HK/CN
    const isCalendarMarket = ['US', 'HK', 'CN'].includes(market);
    if (isCalendarMarket) {
      const mkt = market as MarketType;
      if (!this.calendar.isMarketOpen(mkt, now)) return 'closed';
    } else {
      // JP/UK/EU: check weekday only
      const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
      const localMs = now.getTime() + offset * 60000;
      const localDate = new Date(localMs);
      const dayOfWeek = localDate.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return 'closed';
    }

    // Convert current time to market-local minutes from midnight
    const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
    const marketLocalMs = now.getTime() + offset * 60000;
    const marketLocalDate = new Date(marketLocalMs);
    const currentMinutes =
      marketLocalDate.getUTCHours() * 60 + marketLocalDate.getUTCMinutes();

    // Check lunch break
    if (
      schedule.lunchStart !== null &&
      schedule.lunchEnd !== null &&
      currentMinutes >= schedule.lunchStart &&
      currentMinutes < schedule.lunchEnd
    ) {
      return 'lunch_break';
    }

    // Check regular session
    if (
      currentMinutes >= schedule.regularOpen &&
      currentMinutes < schedule.regularClose
    ) {
      return 'open';
    }

    return 'closed';
  }

  /**
   * Check if currently in regular trading hours.
   */
  isTradingHour(market: string, atTime?: Date): boolean {
    return this.getStatus(market, atTime) === 'open';
  }

  /**
   * Check if any of the specified markets are open.
   */
  isAnyMarketOpen(markets: string[], atTime?: Date): boolean {
    return markets.some((m) => this.isTradingHour(m, atTime));
  }

  /**
   * Get next open time for a market.
   */
  getNextOpen(market: string, atTime?: Date): Date | null {
    if (market === 'CRYPTO' || market === 'US' || market === 'HK' || market === 'CN') {
      const mkt = market as MarketType;
      return this.calendar.getNextOpen(mkt, atTime);
    }
    // JP/UK/EU: compute next open from schedule
    const schedule = SCHEDULES[market];
    if (!schedule) return null;
    const now = atTime || new Date();
    const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
    const localMs = now.getTime() + offset * 60000;
    const localDate = new Date(localMs);
    const currentMinutes = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

    let nextOpenMs: number;
    if (currentMinutes < schedule.regularOpen) {
      // Later today
      const midnight = new Date(localDate);
      midnight.setUTCHours(0, 0, 0, 0);
      nextOpenMs = midnight.getTime() + schedule.regularOpen * 60000 - offset * 60000;
    } else {
      // Tomorrow
      const tomorrow = new Date(localDate);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      nextOpenMs = tomorrow.getTime() + schedule.regularOpen * 60000 - offset * 60000;
    }
    return new Date(nextOpenMs);
  }

  /**
   * Get next close time for a market.
   * Calculates from the schedule and current time.
   */
  getNextClose(market: string, atTime?: Date): Date | null {
    const schedule = SCHEDULES[market];
    if (!schedule) return null;
    if (market === 'CRYPTO') return null; // never closes

    const now = atTime || new Date();
    const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
    const marketLocalMs = now.getTime() + offset * 60000;
    const marketLocalDate = new Date(marketLocalMs);
    const currentMinutes =
      marketLocalDate.getUTCHours() * 60 + marketLocalDate.getUTCMinutes();

    let targetMinutes: number;
    let targetDate: Date;

    if (currentMinutes < schedule.regularOpen) {
      // Market hasn't opened yet — close is today
      targetMinutes = schedule.regularClose;
      targetDate = marketLocalDate;
    } else if (currentMinutes < schedule.regularClose) {
      // During session — close is today
      targetMinutes = schedule.regularClose;
      targetDate = marketLocalDate;
    } else {
      // After close — next trading day's close
      const nextDayLocal = new Date(marketLocalDate);
      nextDayLocal.setUTCDate(nextDayLocal.getUTCDate() + 1);
      // Skip weekends for JP/UK/EU (US/HK/CN handled by calendar in getStatus)
      if (['JP', 'UK', 'EU'].includes(market)) {
        while (nextDayLocal.getUTCDay() === 0 || nextDayLocal.getUTCDay() === 6) {
          nextDayLocal.setUTCDate(nextDayLocal.getUTCDate() + 1);
        }
      }
      targetMinutes = schedule.regularClose;
      targetDate = nextDayLocal;
    }

    // Build close time in market-local, then convert to UTC
    const utcHours = Math.floor(targetMinutes / 60);
    const utcMins = targetMinutes % 60;
    const midnightLocal = new Date(targetDate);
    midnightLocal.setUTCHours(0, 0, 0, 0);
    const midnightUTC = midnightLocal.getTime() - offset * 60000;
    return new Date(midnightUTC + targetMinutes * 60000);
  }

  /**
   * Get next lunch break times.
   */
  getNextLunch(market: string, atTime?: Date): { start: Date; end: Date } | null {
    const schedule = SCHEDULES[market];
    if (
      !schedule ||
      schedule.lunchStart === null ||
      schedule.lunchEnd === null
    )
      return null;

    const now = atTime || new Date();
    const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
    const marketLocalMs = now.getTime() + offset * 60000;
    const marketLocalDate = new Date(marketLocalMs);
    const currentMinutes =
      marketLocalDate.getUTCHours() * 60 + marketLocalDate.getUTCMinutes();

    if (currentMinutes >= schedule.lunchEnd) {
      // Lunch already over — return null (no upcoming lunch today)
      return null;
    }

    // Build today's lunch times from current local time
    const midnightLocal = new Date(marketLocalDate);
    midnightLocal.setUTCHours(0, 0, 0, 0);
    const midnightUTC = midnightLocal.getTime() - offset * 60000;

    const startUtcMs = midnightUTC + schedule.lunchStart * 60000;
    const endUtcMs = midnightUTC + schedule.lunchEnd * 60000;

    return {
      start: new Date(startUtcMs),
      end: new Date(endUtcMs),
    };
  }

  /**
   * Get comprehensive status info for a market.
   */
  getStatusInfo(market: string, atTime?: Date): MarketStatusInfo {
    const now = atTime || new Date();
    const schedule = SCHEDULES[market];
    const tz = schedule?.timezone || 'UTC';

    const lunch = this.getNextLunch(market, now);

    return {
      market,
      status: this.getStatus(market, now),
      currentSession: this.getCurrentSession(market, now),
      nextOpen: this.getNextOpen(market, now),
      nextClose: this.getNextClose(market, now),
      nextLunchStart: lunch?.start ?? null,
      nextLunchEnd: lunch?.end ?? null,
      localTime: TimestampUtil.toLocal(now.getTime(), tz),
      isDST: TimestampUtil.isDST(now.getTime(), tz),
    };
  }

  /**
   * Get current session info for a market.
   */
  getCurrentSession(market: string, atTime?: Date): SessionInfo | null {
    const now = atTime || new Date();
    const schedule = SCHEDULES[market];
    if (!schedule) return null;

    // CRYPTO has no sessions in trading-calendar
    if (market === 'CRYPTO') return null;

    // Only US/HK/CN use trading-calendar sessions
    if (market !== 'US' && market !== 'HK' && market !== 'CN') {
      // For JP/UK/EU/CRYPTO, return a simple session info
      const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
      const localMs = now.getTime() + offset * 60000;
      const localDate = new Date(localMs);
      const currentMinutes = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
      if (currentMinutes >= schedule.regularOpen && currentMinutes < schedule.regularClose) {
        const midnight = new Date(localDate);
        midnight.setUTCHours(0, 0, 0, 0);
        const midnightUTC = midnight.getTime() - offset * 60000;
        return {
          type: 'regular' as SessionType,
          openUTC: new Date(midnightUTC + schedule.regularOpen * 60000),
          closeUTC: new Date(midnightUTC + schedule.regularClose * 60000),
        };
      }
      return null;
    }

    const mkt = market as MarketType;
    const sessions = this.calendar.getSessionTimes(mkt, now);
    if (!sessions || sessions.length === 0) return null;

    const offset = TimestampUtil.getOffsetMinutes(now.getTime(), schedule.timezone);
    const marketLocalMs = now.getTime() + offset * 60000;
    const marketLocalDate = new Date(marketLocalMs);
    const currentMinutes =
      marketLocalDate.getUTCHours() * 60 + marketLocalDate.getUTCMinutes();

    return (
      sessions.find(
        (s) => currentMinutes >= s.open && currentMinutes < s.close
      ) || null
    );
  }

  /**
   * Get all open markets at a given time.
   */
  getOpenMarkets(atTime?: Date): string[] {
    const markets = Object.keys(SCHEDULES);
    return markets.filter((m) => this.isTradingHour(m, atTime));
  }

  /**
   * Get all market statuses at a given time.
   */
  getAllStatuses(atTime?: Date): MarketStatusInfo[] {
    return Object.keys(SCHEDULES).map((m) => this.getStatusInfo(m, atTime));
  }
}

export function getMarketClock(calendar?: TradingCalendar): MarketClock {
  return new MarketClock(calendar);
}
