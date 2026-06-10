// ── TradingCalendar — 交易日历引擎 ────────────────────────────────────────
// J-31-02: 多市场交易时段管理
// 支持 US (NYSE/NASDAQ), HK (HKEX), CN (SSE/SZSE), CRYPTO (24/7)
// 内部使用 UTC，显示时转换为市场本地时区

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

/** 支持的市场类型 */
export type MarketType = 'US' | 'HK' | 'CN' | 'CRYPTO';

/** 交易时段类型 */
export type SessionType = 'pre-market' | 'regular' | 'after-hours' | 'closed';

/** 假期定义 */
export interface Holiday {
  date: string;   // 'YYYY-MM-DD' in market's local timezone
  name: string;   // English holiday name
  market: MarketType;
}

/** 交易时段定义（本地时间，分钟为单位） */
interface SessionDef {
  type: SessionType;
  open: number;   // minutes from midnight (local)
  close: number;  // minutes from midnight (local)
}

/** 时段详细信息（UTC Date 对象） */
export interface SessionInfo {
  type: SessionType;
  openUTC: Date;
  closeUTC: Date;
}

/** 下一个开盘信息 */
export interface NextOpenInfo {
  date: Date;
  session: SessionType;
  market: MarketType;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MAX_SEARCH_DAYS = 366;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 市场时区偏移（分钟），正数 = UTC 以东 */
const MARKET_TIMEZONES: Record<MarketType, string> = {
  US: 'America/New_York',
  HK: 'Asia/Hong_Kong',
  CN: 'Asia/Shanghai',
  CRYPTO: 'UTC',
};

const MARKET_LABELS: Record<MarketType, string> = {
  US: 'US (NYSE/NASDAQ)',
  HK: 'HK (HKEX)',
  CN: 'CN (SSE/SZSE)',
  CRYPTO: 'Crypto (24/7)',
};

// ── Holiday Data (2024–2026) ───────────────────────────────────────────────

const HOLIDAYS: Holiday[] = [
  // ═══════════════════════════════════════════════════════════════════════
  //  US Market Holidays (NYSE / NASDAQ)
  // ═══════════════════════════════════════════════════════════════════════

  // ── 2024 ──
  { date: '2024-01-01', name: "New Year's Day", market: 'US' },
  { date: '2024-01-15', name: 'Martin Luther King Jr. Day', market: 'US' },
  { date: '2024-02-19', name: "Presidents' Day", market: 'US' },
  { date: '2024-03-29', name: 'Good Friday', market: 'US' },
  { date: '2024-05-27', name: 'Memorial Day', market: 'US' },
  { date: '2024-06-19', name: 'Juneteenth National Independence Day', market: 'US' },
  { date: '2024-07-04', name: 'Independence Day', market: 'US' },
  { date: '2024-09-02', name: 'Labor Day', market: 'US' },
  { date: '2024-11-28', name: 'Thanksgiving Day', market: 'US' },
  { date: '2024-12-25', name: 'Christmas Day', market: 'US' },

  // ── 2025 ──
  { date: '2025-01-01', name: "New Year's Day", market: 'US' },
  { date: '2025-01-20', name: 'Martin Luther King Jr. Day', market: 'US' },
  { date: '2025-02-17', name: "Presidents' Day", market: 'US' },
  { date: '2025-04-18', name: 'Good Friday', market: 'US' },
  { date: '2025-05-26', name: 'Memorial Day', market: 'US' },
  { date: '2025-06-19', name: 'Juneteenth National Independence Day', market: 'US' },
  { date: '2025-07-04', name: 'Independence Day', market: 'US' },
  { date: '2025-09-01', name: 'Labor Day', market: 'US' },
  { date: '2025-11-27', name: 'Thanksgiving Day', market: 'US' },
  { date: '2025-12-25', name: 'Christmas Day', market: 'US' },

  // ── 2026 ──
  { date: '2026-01-01', name: "New Year's Day", market: 'US' },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day', market: 'US' },
  { date: '2026-02-16', name: "Presidents' Day", market: 'US' },
  { date: '2026-04-03', name: 'Good Friday', market: 'US' },
  { date: '2026-05-25', name: 'Memorial Day', market: 'US' },
  { date: '2026-06-19', name: 'Juneteenth National Independence Day', market: 'US' },
  { date: '2026-07-03', name: 'Independence Day (Observed)', market: 'US' },
  { date: '2026-09-07', name: 'Labor Day', market: 'US' },
  { date: '2026-11-26', name: 'Thanksgiving Day', market: 'US' },
  { date: '2026-12-25', name: 'Christmas Day', market: 'US' },

  // ═══════════════════════════════════════════════════════════════════════
  //  Hong Kong Market Holidays (HKEX)
  // ═══════════════════════════════════════════════════════════════════════

  // ── 2024 ──
  { date: '2024-01-01', name: "New Year's Day", market: 'HK' },
  { date: '2024-02-12', name: 'Lunar New Year (Day 3)', market: 'HK' },
  { date: '2024-02-13', name: 'Lunar New Year (Day 4)', market: 'HK' },
  { date: '2024-04-04', name: 'Ching Ming Festival', market: 'HK' },
  { date: '2024-03-29', name: 'Good Friday', market: 'HK' },
  { date: '2024-04-01', name: 'Easter Monday', market: 'HK' },
  { date: '2024-05-01', name: 'Labour Day', market: 'HK' },
  { date: '2024-05-15', name: "Buddha's Birthday", market: 'HK' },
  { date: '2024-06-10', name: 'Tuen Ng Festival', market: 'HK' },
  { date: '2024-07-01', name: 'HKSAR Establishment Day', market: 'HK' },
  { date: '2024-09-18', name: 'Day after Mid-Autumn Festival', market: 'HK' },
  { date: '2024-10-01', name: 'National Day', market: 'HK' },
  { date: '2024-10-11', name: 'Chung Yeung Festival', market: 'HK' },
  { date: '2024-12-25', name: 'Christmas Day', market: 'HK' },
  { date: '2024-12-26', name: 'Boxing Day', market: 'HK' },

  // ── 2025 ──
  { date: '2025-01-01', name: "New Year's Day", market: 'HK' },
  { date: '2025-01-29', name: 'Lunar New Year (Day 1)', market: 'HK' },
  { date: '2025-01-30', name: 'Lunar New Year (Day 2)', market: 'HK' },
  { date: '2025-01-31', name: 'Lunar New Year (Day 3)', market: 'HK' },
  { date: '2025-04-04', name: 'Ching Ming Festival', market: 'HK' },
  { date: '2025-04-18', name: 'Good Friday', market: 'HK' },
  { date: '2025-04-21', name: 'Easter Monday', market: 'HK' },
  { date: '2025-05-01', name: 'Labour Day', market: 'HK' },
  { date: '2025-05-05', name: "Buddha's Birthday", market: 'HK' },
  { date: '2025-05-31', name: 'Tuen Ng Festival', market: 'HK' },
  { date: '2025-07-01', name: 'HKSAR Establishment Day', market: 'HK' },
  { date: '2025-10-01', name: 'National Day', market: 'HK' },
  { date: '2025-10-07', name: 'Day after Mid-Autumn Festival', market: 'HK' },
  { date: '2025-10-29', name: 'Chung Yeung Festival', market: 'HK' },
  { date: '2025-12-25', name: 'Christmas Day', market: 'HK' },
  { date: '2025-12-26', name: 'Boxing Day', market: 'HK' },

  // ── 2026 ──
  { date: '2026-01-01', name: "New Year's Day", market: 'HK' },
  { date: '2026-02-17', name: 'Lunar New Year (Day 1)', market: 'HK' },
  { date: '2026-02-18', name: 'Lunar New Year (Day 2)', market: 'HK' },
  { date: '2026-02-19', name: 'Lunar New Year (Day 3)', market: 'HK' },
  { date: '2026-04-03', name: 'Good Friday', market: 'HK' },
  { date: '2026-04-05', name: 'Ching Ming Festival', market: 'HK' },
  { date: '2026-04-06', name: 'Easter Monday', market: 'HK' },
  { date: '2026-05-01', name: 'Labour Day', market: 'HK' },
  { date: '2026-05-24', name: "Buddha's Birthday", market: 'HK' },
  { date: '2026-06-19', name: 'Tuen Ng Festival', market: 'HK' },
  { date: '2026-07-01', name: 'HKSAR Establishment Day', market: 'HK' },
  { date: '2026-09-26', name: 'Day after Mid-Autumn Festival', market: 'HK' },
  { date: '2026-10-01', name: 'National Day', market: 'HK' },
  { date: '2026-10-19', name: 'Chung Yeung Festival', market: 'HK' },
  { date: '2026-12-25', name: 'Christmas Day', market: 'HK' },
  { date: '2026-12-26', name: 'Boxing Day', market: 'HK' },

  // ═══════════════════════════════════════════════════════════════════════
  //  China Market Holidays (SSE / SZSE)
  // ═══════════════════════════════════════════════════════════════════════

  // ── 2024 ──
  { date: '2024-01-01', name: i18n.t('tradingCalendar.k1'), market: 'CN' },
  { date: '2024-02-09', name: i18n.t('tradingCalendar.k2'), market: 'CN' },
  { date: '2024-02-10', name: i18n.t('tradingCalendar.k3'), market: 'CN' },
  { date: '2024-02-11', name: i18n.t('tradingCalendar.k4'), market: 'CN' },
  { date: '2024-02-12', name: i18n.t('tradingCalendar.k5'), market: 'CN' },
  { date: '2024-02-13', name: i18n.t('tradingCalendar.k6'), market: 'CN' },
  { date: '2024-02-14', name: i18n.t('tradingCalendar.k7'), market: 'CN' },
  { date: '2024-02-15', name: i18n.t('tradingCalendar.k8'), market: 'CN' },
  { date: '2024-02-16', name: i18n.t('tradingCalendar.k9'), market: 'CN' },
  { date: '2024-02-17', name: i18n.t('tradingCalendar.k10'), market: 'CN' },
  { date: '2024-04-04', name: i18n.t('tradingCalendar.k11'), market: 'CN' },
  { date: '2024-04-05', name: i18n.t('tradingCalendar.k12'), market: 'CN' },
  { date: '2024-04-06', name: i18n.t('tradingCalendar.k13'), market: 'CN' },
  { date: '2024-05-01', name: i18n.t('tradingCalendar.k14'), market: 'CN' },
  { date: '2024-05-02', name: i18n.t('tradingCalendar.k15'), market: 'CN' },
  { date: '2024-05-03', name: i18n.t('tradingCalendar.k16'), market: 'CN' },
  { date: '2024-05-04', name: i18n.t('tradingCalendar.k17'), market: 'CN' },
  { date: '2024-05-05', name: i18n.t('tradingCalendar.k18'), market: 'CN' },
  { date: '2024-06-08', name: i18n.t('tradingCalendar.k19'), market: 'CN' },
  { date: '2024-06-09', name: i18n.t('tradingCalendar.k20'), market: 'CN' },
  { date: '2024-06-10', name: i18n.t('tradingCalendar.k21'), market: 'CN' },
  { date: '2024-09-15', name: i18n.t('tradingCalendar.k22'), market: 'CN' },
  { date: '2024-09-16', name: i18n.t('tradingCalendar.k23'), market: 'CN' },
  { date: '2024-09-17', name: i18n.t('tradingCalendar.k24'), market: 'CN' },
  { date: '2024-10-01', name: i18n.t('tradingCalendar.k25'), market: 'CN' },
  { date: '2024-10-02', name: i18n.t('tradingCalendar.k26'), market: 'CN' },
  { date: '2024-10-03', name: i18n.t('tradingCalendar.k27'), market: 'CN' },
  { date: '2024-10-04', name: i18n.t('tradingCalendar.k28'), market: 'CN' },
  { date: '2024-10-05', name: i18n.t('tradingCalendar.k29'), market: 'CN' },
  { date: '2024-10-06', name: i18n.t('tradingCalendar.k30'), market: 'CN' },
  { date: '2024-10-07', name: i18n.t('tradingCalendar.k31'), market: 'CN' },

  // ── 2025 ──
  { date: '2025-01-01', name: i18n.t('tradingCalendar.k32'), market: 'CN' },
  { date: '2025-01-28', name: i18n.t('tradingCalendar.k33'), market: 'CN' },
  { date: '2025-01-29', name: i18n.t('tradingCalendar.k34'), market: 'CN' },
  { date: '2025-01-30', name: i18n.t('tradingCalendar.k35'), market: 'CN' },
  { date: '2025-01-31', name: i18n.t('tradingCalendar.k36'), market: 'CN' },
  { date: '2025-02-01', name: i18n.t('tradingCalendar.k37'), market: 'CN' },
  { date: '2025-02-02', name: i18n.t('tradingCalendar.k38'), market: 'CN' },
  { date: '2025-02-03', name: i18n.t('tradingCalendar.k39'), market: 'CN' },
  { date: '2025-02-04', name: i18n.t('tradingCalendar.k40'), market: 'CN' },
  { date: '2025-04-04', name: i18n.t('tradingCalendar.k41'), market: 'CN' },
  { date: '2025-04-05', name: i18n.t('tradingCalendar.k42'), market: 'CN' },
  { date: '2025-04-06', name: i18n.t('tradingCalendar.k43'), market: 'CN' },
  { date: '2025-05-01', name: i18n.t('tradingCalendar.k44'), market: 'CN' },
  { date: '2025-05-02', name: i18n.t('tradingCalendar.k45'), market: 'CN' },
  { date: '2025-05-03', name: i18n.t('tradingCalendar.k46'), market: 'CN' },
  { date: '2025-05-04', name: i18n.t('tradingCalendar.k47'), market: 'CN' },
  { date: '2025-05-05', name: i18n.t('tradingCalendar.k48'), market: 'CN' },
  { date: '2025-05-31', name: i18n.t('tradingCalendar.k49'), market: 'CN' },
  { date: '2025-06-01', name: i18n.t('tradingCalendar.k50'), market: 'CN' },
  { date: '2025-06-02', name: i18n.t('tradingCalendar.k51'), market: 'CN' },
  { date: '2025-10-01', name: i18n.t('tradingCalendar.k52'), market: 'CN' },
  { date: '2025-10-02', name: i18n.t('tradingCalendar.k53'), market: 'CN' },
  { date: '2025-10-03', name: i18n.t('tradingCalendar.k54'), market: 'CN' },
  { date: '2025-10-04', name: i18n.t('tradingCalendar.k55'), market: 'CN' },
  { date: '2025-10-05', name: i18n.t('tradingCalendar.k56'), market: 'CN' },
  { date: '2025-10-06', name: i18n.t('tradingCalendar.k57'), market: 'CN' },
  { date: '2025-10-07', name: i18n.t('tradingCalendar.k58'), market: 'CN' },
  { date: '2025-10-08', name: i18n.t('tradingCalendar.k59'), market: 'CN' },

  // ── 2026 (estimated based on lunar calendar) ──
  { date: '2026-01-01', name: i18n.t('tradingCalendar.k60'), market: 'CN' },
  { date: '2026-01-02', name: i18n.t('tradingCalendar.k61'), market: 'CN' },
  { date: '2026-01-03', name: i18n.t('tradingCalendar.k62'), market: 'CN' },
  { date: '2026-02-16', name: i18n.t('tradingCalendar.k63'), market: 'CN' },
  { date: '2026-02-17', name: i18n.t('tradingCalendar.k64'), market: 'CN' },
  { date: '2026-02-18', name: i18n.t('tradingCalendar.k65'), market: 'CN' },
  { date: '2026-02-19', name: i18n.t('tradingCalendar.k66'), market: 'CN' },
  { date: '2026-02-20', name: i18n.t('tradingCalendar.k67'), market: 'CN' },
  { date: '2026-02-21', name: i18n.t('tradingCalendar.k68'), market: 'CN' },
  { date: '2026-02-22', name: i18n.t('tradingCalendar.k69'), market: 'CN' },
  { date: '2026-04-05', name: i18n.t('tradingCalendar.k70'), market: 'CN' },
  { date: '2026-04-06', name: i18n.t('tradingCalendar.k71'), market: 'CN' },
  { date: '2026-04-07', name: i18n.t('tradingCalendar.k72'), market: 'CN' },
  { date: '2026-05-01', name: i18n.t('tradingCalendar.k73'), market: 'CN' },
  { date: '2026-05-02', name: i18n.t('tradingCalendar.k74'), market: 'CN' },
  { date: '2026-05-03', name: i18n.t('tradingCalendar.k75'), market: 'CN' },
  { date: '2026-05-04', name: i18n.t('tradingCalendar.k76'), market: 'CN' },
  { date: '2026-05-05', name: i18n.t('tradingCalendar.k77'), market: 'CN' },
  { date: '2026-06-19', name: i18n.t('tradingCalendar.k78'), market: 'CN' },
  { date: '2026-06-20', name: i18n.t('tradingCalendar.k79'), market: 'CN' },
  { date: '2026-06-21', name: i18n.t('tradingCalendar.k80'), market: 'CN' },
  { date: '2026-09-25', name: i18n.t('tradingCalendar.k81'), market: 'CN' },
  { date: '2026-09-26', name: i18n.t('tradingCalendar.k82'), market: 'CN' },
  { date: '2026-09-27', name: i18n.t('tradingCalendar.k83'), market: 'CN' },
  { date: '2026-10-01', name: i18n.t('tradingCalendar.k84'), market: 'CN' },
  { date: '2026-10-02', name: i18n.t('tradingCalendar.k85'), market: 'CN' },
  { date: '2026-10-03', name: i18n.t('tradingCalendar.k86'), market: 'CN' },
  { date: '2026-10-04', name: i18n.t('tradingCalendar.k87'), market: 'CN' },
  { date: '2026-10-05', name: i18n.t('tradingCalendar.k88'), market: 'CN' },
  { date: '2026-10-06', name: i18n.t('tradingCalendar.k89'), market: 'CN' },
  { date: '2026-10-07', name: i18n.t('tradingCalendar.k90'), market: 'CN' },
];

// ── Session Definitions (local time, minutes from midnight) ────────────────

const SESSIONS: Record<Exclude<MarketType, 'CRYPTO'>, SessionDef[]> = {
  US: [
    { type: 'pre-market',   open: 240,   close: 570  },  // 04:00–09:30 ET
    { type: 'regular',      open: 570,   close: 960  },  // 09:30–16:00 ET
    { type: 'after-hours',  open: 960,   close: 1200 },  // 16:00–20:00 ET
  ],
  HK: [
    { type: 'regular', open: 570, close: 720 },           // 09:30–12:00 HKT
    { type: 'regular', open: 780, close: 960 },           // 13:00–16:00 HKT
  ],
  CN: [
    { type: 'regular', open: 570, close: 690 },           // 09:30–11:30 CST
    { type: 'regular', open: 780, close: 900 },           // 13:00–15:00 CST
  ],
};

// ── US DST Helpers ─────────────────────────────────────────────────────────

/**
 * Calculate the start of US Eastern Daylight Time (second Sunday of March).
 * Returns a Date at 02:00 EST (07:00 UTC) on that day.
 */
function getDSTStartUTC(year: number): Date {
  const mar1 = new Date(Date.UTC(year, 2, 1)); // March 1
  const mar1Day = mar1.getUTCDay(); // 0=Sun … 6=Sat
  const firstSunday = 1 + ((7 - mar1Day) % 7);
  const secondSunday = firstSunday + 7;
  return new Date(Date.UTC(year, 2, secondSunday, 7, 0, 0)); // 07:00 UTC = 02:00 EST
}

/**
 * Calculate the end of US Eastern Daylight Time (first Sunday of November).
 * Returns a Date at 02:00 EDT (06:00 UTC) on that day.
 */
function getDSTEndUTC(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1)); // November 1
  const nov1Day = nov1.getUTCDay();
  const firstSunday = 1 + ((7 - nov1Day) % 7);
  return new Date(Date.UTC(year, 10, firstSunday, 6, 0, 0)); // 06:00 UTC = 02:00 EDT
}

/**
 * Check if a given UTC timestamp falls within US Eastern Daylight Time.
 */
function isUSEasternDST(utcDate: Date): boolean {
  const year = utcDate.getUTCFullYear();
  const dstStart = getDSTStartUTC(year);
  const dstEnd = getDSTEndUTC(year);
  return utcDate.getTime() >= dstStart.getTime() && utcDate.getTime() < dstEnd.getTime();
}

/**
 * Get the UTC offset in minutes for a market at a given UTC timestamp.
 * Positive values mean east of UTC.
 */
function getOffsetMinutes(market: MarketType, utcDate: Date): number {
  switch (market) {
    case 'US':
      return isUSEasternDST(utcDate) ? -240 : -300; // EDT=-4h or EST=-5h
    case 'HK':
    case 'CN':
      return 480; // UTC+8 year-round (no DST)
    case 'CRYPTO':
      return 0; // UTC
    default:
      return 0;
  }
}

// ── Date Formatting Helpers ────────────────────────────────────────────────

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Format a UTC Date as 'YYYY-MM-DD' in a market's local timezone.
 */
function toMarketDateStr(utcDate: Date, offsetMinutes: number): string {
  const local = new Date(utcDate.getTime() + offsetMinutes * MS_PER_MINUTE);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}

/**
 * Get the day of week (0=Sunday … 6=Saturday) in a market's local timezone.
 */
function getMarketDayOfWeek(utcDate: Date, offsetMinutes: number): number {
  const local = new Date(utcDate.getTime() + offsetMinutes * MS_PER_MINUTE);
  return local.getUTCDay();
}

/**
 * Get minutes from midnight in a market's local timezone.
 */
function getMarketMinutesFromMidnight(utcDate: Date, offsetMinutes: number): number {
  const local = new Date(utcDate.getTime() + offsetMinutes * MS_PER_MINUTE);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/**
 * Convert a local time (date string + minutes from midnight) to a UTC Date.
 * Useful for external consumers needing market-time → UTC conversion.
 */
export function localToUTC(dateStr: string, minutesFromMidnight: number, offsetMinutes: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const hours = Math.floor(minutesFromMidnight / 60);
  const mins = minutesFromMidnight % 60;
  return new Date(Date.UTC(y, m - 1, d, hours, mins, 0, 0) - offsetMinutes * MS_PER_MINUTE);
}

/**
 * Get the start of a market's local day (midnight local) as a UTC timestamp.
 */
function getMarketDayStartUTC(utcDate: Date, offsetMinutes: number): Date {
  const local = new Date(utcDate.getTime() + offsetMinutes * MS_PER_MINUTE);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(dayStart - offsetMinutes * MS_PER_MINUTE);
}

// ── TradingCalendar Class ──────────────────────────────────────────────────

/**
 * TradingCalendar manages trading hours for multiple markets.
 *
 * Supported markets:
 *  - US: NYSE/NASDAQ (9:30–16:00 ET, with pre-market & after-hours)
 *  - HK: HKEX (9:30–12:00, 13:00–16:00 HKT)
 *  - CN: SSE/SZSE (9:30–11:30, 13:00–15:00 CST)
 *  - CRYPTO: 24/7
 *
 * All internal calculations use UTC. Market-local times are used only
 * for holiday matching and session boundary display.
 */
export class TradingCalendar {
  /** Holiday lookup map: 'market|YYYY-MM-DD' → Holiday */
  private readonly holidayMap: Map<string, Holiday>;

  /** All holidays (raw array) */
  private readonly allHolidays: Holiday[];

  constructor() {
    this.allHolidays = HOLIDAYS;
    this.holidayMap = new Map<string, Holiday>();

    for (const h of HOLIDAYS) {
      this.holidayMap.set(`${h.market}|${h.date}`, h);
    }

    log.info(
      `[TradingCalendar] Initialized — ${HOLIDAYS.length} holidays loaded ` +
      `(US: ${HOLIDAYS.filter(h => h.market === 'US').length}, ` +
      `HK: ${HOLIDAYS.filter(h => h.market === 'HK').length}, ` +
      `CN: ${HOLIDAYS.filter(h => h.market === 'CN').length})`
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Core Public API
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Check if the market is currently open (regular session only).
   * Pre-market and after-hours do NOT count as "open".
   * CRYPTO is always open.
   */
  isMarketOpen(market: MarketType, timestamp?: Date): boolean {
    const now = timestamp ?? new Date();

    if (market === 'CRYPTO') return true;

    const offset = getOffsetMinutes(market, now);
    const dow = getMarketDayOfWeek(now, offset);

    // Weekend check
    if (dow === 0 || dow === 6) return false;

    // Holiday check
    if (this.isHoliday(market, now)) return false;

    const mins = getMarketMinutesFromMidnight(now, offset);
    const sessions = SESSIONS[market];

    // Only regular sessions count as "market open"
    return sessions.some(s => s.type === 'regular' && mins >= s.open && mins < s.close);
  }

  /**
   * Determine the current trading session for a market.
   * For HK/CN with split regular sessions, both are reported as 'regular'.
   * Returns 'closed' for weekends, holidays, and outside-session times.
   */
  getSession(market: MarketType, timestamp?: Date): SessionType {
    const now = timestamp ?? new Date();

    if (market === 'CRYPTO') return 'regular';

    const offset = getOffsetMinutes(market, now);
    const dow = getMarketDayOfWeek(now, offset);

    if (dow === 0 || dow === 6) return 'closed';
    if (this.isHoliday(market, now)) return 'closed';

    const mins = getMarketMinutesFromMidnight(now, offset);
    const sessions = SESSIONS[market];

    for (const s of sessions) {
      if (mins >= s.open && mins < s.close) {
        return s.type;
      }
    }

    return 'closed';
  }

  /**
   * Check if a specific date is a market holiday.
   * The date is converted to the market's local timezone for matching.
   */
  isHoliday(market: MarketType, date: Date): boolean {
    if (market === 'CRYPTO') return false;

    const offset = getOffsetMinutes(market, date);
    const dateStr = toMarketDateStr(date, offset);
    return this.holidayMap.has(`${market}|${dateStr}`);
  }

  /**
   * Get the next regular session open time for a market.
   * If the market is currently in regular session, returns the NEXT regular open.
   * Skips weekends and holidays.
   */
  getNextOpen(market: MarketType, from?: Date): Date {
    const startFrom = from ?? new Date();

    if (market === 'CRYPTO') {
      // Crypto is always open — return the next minute boundary
      const next = new Date(startFrom.getTime());
      next.setUTCSeconds(0, 0);
      if (next.getTime() <= startFrom.getTime()) {
        next.setUTCMinutes(next.getUTCMinutes() + 1);
      }
      return next;
    }

    // Search forward day by day
    let cursor = new Date(startFrom.getTime());

    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
      const offset = getOffsetMinutes(market, cursor);
      const dow = getMarketDayOfWeek(cursor, offset);

      if (dow !== 0 && dow !== 6 && !this.isHoliday(market, cursor)) {
        const dayStart = getMarketDayStartUTC(cursor, offset);
        const sessions = SESSIONS[market];
        const regularSessions = sessions.filter(s => s.type === 'regular');

        for (const session of regularSessions) {
          const openUTC = new Date(
            dayStart.getTime() + session.open * MS_PER_MINUTE
          );
          if (openUTC.getTime() > startFrom.getTime()) {
            return openUTC;
          }
        }
      }

      // Advance to next day start
      cursor = this.advanceToNextDay(cursor, market);
    }

    log.warn(`[TradingCalendar] Could not find next open for ${market} within ${MAX_SEARCH_DAYS} days`);
    return new Date(startFrom.getTime() + MAX_SEARCH_DAYS * MS_PER_DAY);
  }

  /**
   * Get the next market close time (end of current or next regular session).
   * If a regular session is currently active, returns its close time.
   * Otherwise, returns the close of the next regular session.
   */
  getNextClose(market: MarketType, from?: Date): Date {
    const startFrom = from ?? new Date();

    if (market === 'CRYPTO') {
      // Crypto never closes — return far future
      return new Date(Date.UTC(2099, 11, 31, 23, 59, 59));
    }

    let cursor = new Date(startFrom.getTime());

    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
      const offset = getOffsetMinutes(market, cursor);
      const dow = getMarketDayOfWeek(cursor, offset);

      if (dow !== 0 && dow !== 6 && !this.isHoliday(market, cursor)) {
        const dayStart = getMarketDayStartUTC(cursor, offset);
        const sessions = SESSIONS[market];
        const regularSessions = sessions.filter(s => s.type === 'regular');

        for (const session of regularSessions) {
          const closeUTC = new Date(
            dayStart.getTime() + session.close * MS_PER_MINUTE
          );
          if (closeUTC.getTime() > startFrom.getTime()) {
            return closeUTC;
          }
        }
      }

      cursor = this.advanceToNextDay(cursor, market);
    }

    log.warn(`[TradingCalendar] Could not find next close for ${market} within ${MAX_SEARCH_DAYS} days`);
    return new Date(startFrom.getTime() + MAX_SEARCH_DAYS * MS_PER_DAY);
  }

  /**
   * Get upcoming holidays for a market within the specified number of days.
   */
  getUpcomingHolidays(market: MarketType, days: number): Holiday[] {
    if (market === 'CRYPTO') return [];

    const now = new Date();
    const endDate = new Date(now.getTime() + days * MS_PER_DAY);

    return this.allHolidays
      .filter(h => {
        if (h.market !== market) return false;
        const hDate = this.parseHolidayDate(h.date, market);
        return hDate.getTime() >= now.getTime() && hDate.getTime() <= endDate.getTime();
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Determine if a scheduled task should run for a market at a given time.
   * Returns false if the market is fully closed (no session active).
   * Returns true during pre-market, regular, or after-hours sessions.
   */
  shouldScheduleTask(market: MarketType, timestamp?: Date): boolean {
    const session = this.getSession(market, timestamp);
    return session !== 'closed';
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Extended Utilities
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Get the next session of any type (pre-market, regular, or after-hours).
   * Returns session info including open/close in UTC.
   */
  getNextSession(market: MarketType, from?: Date): SessionInfo | null {
    const startFrom = from ?? new Date();

    if (market === 'CRYPTO') {
      return {
        type: 'regular',
        openUTC: new Date(0),
        closeUTC: new Date(Date.UTC(2099, 11, 31, 23, 59, 59)),
      };
    }

    let cursor = new Date(startFrom.getTime());

    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
      const offset = getOffsetMinutes(market, cursor);
      const dow = getMarketDayOfWeek(cursor, offset);

      if (dow !== 0 && dow !== 6 && !this.isHoliday(market, cursor)) {
        const dayStart = getMarketDayStartUTC(cursor, offset);
        const sessions = SESSIONS[market];

        for (const session of sessions) {
          const openUTC = new Date(dayStart.getTime() + session.open * MS_PER_MINUTE);
          const closeUTC = new Date(dayStart.getTime() + session.close * MS_PER_MINUTE);

          if (closeUTC.getTime() > startFrom.getTime()) {
            return {
              type: session.type,
              openUTC,
              closeUTC,
            };
          }
        }
      }

      cursor = this.advanceToNextDay(cursor, market);
    }

    return null;
  }

  /**
   * Get the session times for a specific date and market.
   * Returns all sessions for that day, or empty array if closed.
   */
  getSessionTimes(market: MarketType, date: Date): SessionInfo[] {
    if (market === 'CRYPTO') {
      const dayStart = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ));
      const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
      return [{ type: 'regular', openUTC: dayStart, closeUTC: dayEnd }];
    }

    const offset = getOffsetMinutes(market, date);
    const dow = getMarketDayOfWeek(date, offset);

    if (dow === 0 || dow === 6) return [];
    if (this.isHoliday(market, date)) return [];

    const dayStart = getMarketDayStartUTC(date, offset);
    const sessions = SESSIONS[market];

    return sessions.map(s => ({
      type: s.type,
      openUTC: new Date(dayStart.getTime() + s.open * MS_PER_MINUTE),
      closeUTC: new Date(dayStart.getTime() + s.close * MS_PER_MINUTE),
    }));
  }

  /**
   * Check if a date falls on a weekend in a market's timezone.
   */
  isWeekend(market: MarketType, date: Date): boolean {
    const offset = getOffsetMinutes(market, date);
    const dow = getMarketDayOfWeek(date, offset);
    return dow === 0 || dow === 6;
  }

  /**
   * Get the IANA timezone name for a market.
   */
  getTimezone(market: MarketType): string {
    return MARKET_TIMEZONES[market];
  }

  /**
   * Get a human-readable label for a market.
   */
  getMarketLabel(market: MarketType): string {
    return MARKET_LABELS[market];
  }

  /**
   * Get the current UTC offset in minutes for a market.
   */
  getCurrentOffset(market: MarketType, timestamp?: Date): number {
    return getOffsetMinutes(market, timestamp ?? new Date());
  }

  /**
   * Get all holidays for a specific year and market.
   */
  getHolidaysForYear(market: MarketType, year: number): Holiday[] {
    if (market === 'CRYPTO') return [];

    const prefix = `${year}-`;
    return this.allHolidays
      .filter(h => h.market === market && h.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get the total number of trading days for a market in a given year.
   * Excludes weekends and holidays.
   */
  getTradingDaysInYear(year: number, market: MarketType): number {
    if (market === 'CRYPTO') return 365;

    let count = 0;
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    for (let d = new Date(start); d < end; d = new Date(d.getTime() + MS_PER_DAY)) {
      const offset = getOffsetMinutes(market, d);
      const dow = getMarketDayOfWeek(d, offset);

      if (dow !== 0 && dow !== 6 && !this.isHoliday(market, d)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Find the previous trading day before a given date.
   */
  getPreviousTradingDay(market: MarketType, from?: Date): Date {
    const startFrom = from ?? new Date();
    let cursor = new Date(startFrom.getTime() - MS_PER_DAY);

    for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
      const offset = getOffsetMinutes(market, cursor);
      const dow = getMarketDayOfWeek(cursor, offset);

      if (dow !== 0 && dow !== 6 && !this.isHoliday(market, cursor)) {
        return getMarketDayStartUTC(cursor, offset);
      }

      cursor = new Date(cursor.getTime() - MS_PER_DAY);
    }

    log.warn(`[TradingCalendar] Could not find previous trading day for ${market}`);
    return new Date(startFrom.getTime() - MS_PER_DAY);
  }

  /**
   * Get all markets and their current session status.
   */
  getAllMarketSessions(timestamp?: Date): Record<MarketType, SessionType> {
    const now = timestamp ?? new Date();
    const markets: MarketType[] = ['US', 'HK', 'CN', 'CRYPTO'];
    const result = {} as Record<MarketType, SessionType>;

    for (const market of markets) {
      result[market] = this.getSession(market, now);
    }

    return result;
  }

  /**
   * Check if any market is currently open.
   */
  isAnyMarketOpen(timestamp?: Date): boolean {
    const markets: MarketType[] = ['US', 'HK', 'CN'];
    return markets.some(m => this.isMarketOpen(m, timestamp));
  }

  /**
   * Get markets that are currently open.
   */
  getOpenMarkets(timestamp?: Date): MarketType[] {
    const markets: MarketType[] = ['US', 'HK', 'CN', 'CRYPTO'];
    return markets.filter(m => this.isMarketOpen(m, timestamp));
  }

  /**
   * Get the next market to open (across all markets).
   */
  getNextMarketToOpen(from?: Date): NextOpenInfo {
    const startFrom = from ?? new Date();
    const markets: Exclude<MarketType, 'CRYPTO'>[] = ['US', 'HK', 'CN'];

    let earliest: NextOpenInfo | null = null;

    for (const market of markets) {
      const nextOpen = this.getNextOpen(market, startFrom);
      if (!earliest || nextOpen.getTime() < earliest.date.getTime()) {
        earliest = { date: nextOpen, session: 'regular', market };
      }
    }

    return earliest ?? {
      date: startFrom,
      session: 'regular',
      market: 'CRYPTO',
    };
  }

  /**
   * Format a UTC Date as a human-readable string in the market's timezone.
   * Example: "2025-01-15 09:30 EST"
   */
  formatMarketTime(utcDate: Date, market: MarketType): string {
    const offset = getOffsetMinutes(market, utcDate);
    const local = new Date(utcDate.getTime() + offset * MS_PER_MINUTE);

    const dateStr = `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
    const timeStr = `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`;
    const tzLabel = this.getTimezoneLabel(market, utcDate);

    return `${dateStr} ${timeStr} ${tzLabel}`;
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Private Helpers
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Advance a date to the start of the next calendar day in the market's timezone.
   */
  private advanceToNextDay(utcDate: Date, market: MarketType): Date {
    const offset = getOffsetMinutes(market, utcDate);
    const dayStart = getMarketDayStartUTC(utcDate, offset);
    return new Date(dayStart.getTime() + MS_PER_DAY);
  }

  /**
   * Parse a holiday date string into a UTC Date, adjusted for market timezone.
   * The holiday date is in the market's local timezone, so we subtract the offset.
   */
  private parseHolidayDate(dateStr: string, market: MarketType): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Approximate: use noon UTC to avoid DST edge cases for offset calc
    const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const offset = getOffsetMinutes(market, noonUTC);
    // Midnight local = midnight_local - offset
    const midnightLocal = Date.UTC(y, m - 1, d, 0, 0, 0);
    return new Date(midnightLocal - offset * MS_PER_MINUTE);
  }

  /**
   * Get the timezone abbreviation for display purposes.
   */
  private getTimezoneLabel(market: MarketType, utcDate: Date): string {
    switch (market) {
      case 'US':
        return isUSEasternDST(utcDate) ? 'EDT' : 'EST';
      case 'HK':
        return 'HKT';
      case 'CN':
        return 'CST';
      case 'CRYPTO':
        return 'UTC';
      default:
        return 'UTC';
    }
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────

let _instance: TradingCalendar | null = null;

/**
 * Get or create the singleton TradingCalendar instance.
 */
export function getTradingCalendar(): TradingCalendar {
  if (!_instance) {
    _instance = new TradingCalendar();
  }
  return _instance;
}

// ── Exported utility functions (standalone) ────────────────────────────────

/**
 * Quick check: is a market open right now?
 */
export function isMarketOpenNow(market: MarketType): boolean {
  return getTradingCalendar().isMarketOpen(market);
}

/**
 * Quick check: what session is a market in right now?
 */
export function getSessionNow(market: MarketType): SessionType {
  return getTradingCalendar().getSession(market);
}

/**
 * Get all supported market types.
 */
export function getSupportedMarkets(): MarketType[] {
  return ['US', 'HK', 'CN', 'CRYPTO'];
}

/**
 * Get the weekday name for a date in a market's timezone.
 */
export function getMarketWeekdayName(market: MarketType, date: Date): string {
  const offset = getOffsetMinutes(market, date);
  const dow = getMarketDayOfWeek(date, offset);
  return WEEKDAYS[dow];
}
