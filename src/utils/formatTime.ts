/**
 * formatTime.ts — Global time formatting utilities (R98 M-02)
 *
 * All timestamps stored as UTC ms. Display uses local timezone.
 * Based on Intl.DateTimeFormat for full i18n support.
 *
 * API:
 *   formatTime(ts, options?)         → "3:45 PM" / "15:45"
 *   formatDate(ts, mode?, options?)  → "Jun 12" / "June 12, 2026"
 *   formatDateTime(ts, options?)     → "Jun 12, 2026 3:45 PM"
 *   timeAgo(ts, options?)            → "3 minutes ago" / "in 2 hours"
 *   getTimezoneOffset(tz)            → "+08:00"
 *   getWeekStartDay(locale)          → 0 (Sun) | 1 (Mon) | 6 (Sat)
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface FormatOptions {
  locale?: string;
  timezone?: string;
  hour12?: boolean; // force 12/24h; undefined = locale default
}

export type DateMode = 'short' | 'medium' | 'long' | 'full';

// ── Helpers ───────────────────────────────────────────────────────────────

const LOCALE_CACHE = new Map<string, Intl.DateTimeFormat>();

function getFormatter(key: string, locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${key}:${locale}:${JSON.stringify(opts)}`;
  let fmt = LOCALE_CACHE.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    LOCALE_CACHE.set(cacheKey, fmt);
  }
  return fmt;
}

function resolveLocale(locale?: string): string {
  return locale || 'en';
}

function resolveTimezone(timezone?: string): string {
  return timezone || getTimezone();
}

// ── Core API ──────────────────────────────────────────────────────────────

/**
 * Format a timestamp as time only (e.g., "3:45 PM" or "15:45").
 */
export function formatTime(ts: number | Date, options?: FormatOptions): string {
  const locale = resolveLocale(options?.locale);
  const timezone = resolveTimezone(options?.timezone);
  const hour12 = options?.hour12;

  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    ...(hour12 !== undefined ? { hour12 } : {}),
  };

  const date = typeof ts === 'number' ? new Date(ts) : ts;
  return getFormatter('time', locale, opts).format(date);
}

/**
 * Format a timestamp as date (e.g., "Jun 12" or "June 12, 2026").
 */
export function formatDate(ts: number | Date, mode: DateMode = 'short', options?: FormatOptions): string {
  const locale = resolveLocale(options?.locale);
  const timezone = resolveTimezone(options?.timezone);

  const modeMap: Record<DateMode, Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric', timeZone: timezone },
    medium: { year: 'numeric', month: 'short', day: 'numeric', timeZone: timezone },
    long: { year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone },
  };

  const date = typeof ts === 'number' ? new Date(ts) : ts;
  return getFormatter(`date:${mode}`, locale, modeMap[mode]).format(date);
}

/**
 * Format a timestamp as date + time (e.g., "Jun 12, 2026 3:45 PM").
 */
export function formatDateTime(ts: number | Date, options?: FormatOptions): string {
  const locale = resolveLocale(options?.locale);
  const timezone = resolveTimezone(options?.timezone);
  const hour12 = options?.hour12;

  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    ...(hour12 !== undefined ? { hour12 } : {}),
  };

  const date = typeof ts === 'number' ? new Date(ts) : ts;
  return getFormatter('datetime', locale, opts).format(date);
}

/**
 * Smart relative time (e.g., "3 minutes ago", "in 2 hours", "yesterday").
 * Falls back to formatDate for dates older than 30 days.
 */
export function timeAgo(ts: number | Date, options?: FormatOptions & { now?: number }): string {
  const locale = resolveLocale(options?.locale);
  const date = typeof ts === 'number' ? new Date(ts) : ts;
  const now = options?.now ?? Date.now();
  const diffMs = now - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  // Use Intl.RelativeTimeFormat for proper i18n
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (seconds < 60) {
      return rtf.format(isFuture ? seconds : -seconds, 'second');
    } else if (minutes < 60) {
      return rtf.format(isFuture ? minutes : -minutes, 'minute');
    } else if (hours < 24) {
      return rtf.format(isFuture ? hours : -hours, 'hour');
    } else if (days < 7) {
      return rtf.format(isFuture ? days : -days, 'day');
    } else if (weeks < 5) {
      return rtf.format(isFuture ? weeks : -weeks, 'week');
    }
  } catch {
    // Fallback for unsupported locales
  }

  // Fallback: absolute date for older than 30 days
  return formatDate(date, 'medium', options);
}

// ── Timezone Utilities ────────────────────────────────────────────────────

const STORAGE_KEY = 'dw_timezone';
const RECENT_KEY = 'dw_timezone_recent';

/**
 * Get the current user timezone (localStorage → browser guess → UTC).
 */
export function getTimezone(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // SSR or no localStorage
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Set the user timezone and persist to localStorage.
 */
export function setTimezone(tz: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tz);
    // Add to recent list
    const recent = getRecentTimezones();
    const updated = [tz, ...recent.filter((r) => r !== tz)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // SSR or no localStorage
  }
}

/**
 * Get recently used timezones.
 */
export function getRecentTimezones(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore
  }
  return [];
}

/**
 * Get all IANA timezone identifiers.
 */
export function getAllTimezones(): string[] {
  try {
    // Modern API (Chrome 99+, Node 18+)
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      return (Intl as any).supportedValuesOf('timeZone') as string[];
    }
  } catch {
    // fallback
  }
  // Fallback: common timezone list
  return COMMON_TIMEZONES;
}

/**
 * Format timezone offset string (e.g., "+08:00").
 */
export function getTimezoneOffset(tz: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find((p) => p.type === 'timeZoneName');
  if (tzPart) {
    // "GMT+8" → "+08:00" or "GMT-5" → "-05:00"
    const val = tzPart.value.replace('GMT', '');
    if (!val || val === '') return '+00:00';
    const match = val.match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
    if (match) {
      const sign = match[1] || '+';
      const h = match[2].padStart(2, '0');
      const m = match[3] || '00';
      return `${sign}${h}:${m}`;
    }
    return val;
  }
  return '+00:00';
}

/**
 * Get the week start day for a locale: 0=Sunday, 1=Monday, 6=Saturday.
 */
export function getWeekStartDay(locale: string): 0 | 1 | 6 {
  // Common knowledge: US/JP/CA = Sunday (0), most of Europe/ISO = Monday (1)
  // Middle East (ar-SA, ar-AE) = Saturday (6)
  const sundayLocales = ['en-US', 'en-CA', 'ja', 'ja-JP', 'ko', 'ko-KR', 'zh-TW'];
  const saturdayLocales = ['ar-SA', 'ar-AE', 'fa-IR'];

  if (sundayLocales.some((l) => locale.startsWith(l))) return 0;
  if (saturdayLocales.some((l) => locale.startsWith(l))) return 6;
  return 1; // Monday (ISO default)
}

/**
 * Check if a timezone is currently in DST.
 */
export function isDST(tz: string): boolean {
  const jan = new Date(new Date().getFullYear(), 0, 1);
  const jul = new Date(new Date().getFullYear(), 6, 1);
  const janOffset = new Date(jan.toLocaleString('en-US', { timeZone: tz })).getTime() - jan.getTime();
  const julOffset = new Date(jul.toLocaleString('en-US', { timeZone: tz })).getTime() - jul.getTime();
  const now = new Date();
  const nowOffset = new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime() - now.getTime();
  const stdOffset = Math.min(janOffset, julOffset);
  return nowOffset !== stdOffset;
}

// ── Fallback timezone list ────────────────────────────────────────────────

const COMMON_TIMEZONES: string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Kuala_Lumpur',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];
