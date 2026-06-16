/**
 * QUANT MOO — Engine Constants (R84 P2-3)
 * Extracted magic numbers to improve code readability and maintainability.
 * Replace literal numbers throughout the codebase with these named constants.
 */

// ── Time Constants ────────────────────────────────────────────────────────
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1_440;
export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;
export const TRADING_DAYS_PER_YEAR = 252;
export const MONTHS_PER_YEAR = 12;
export const WEEKS_PER_YEAR = 52;

// ── Polling / Refresh Intervals (ms) ──────────────────────────────────────
export const POLL_FAST = 3_000;        // Real-time: order book, price ticker
export const POLL_NORMAL = 5_000;       // Normal: broker status, live trading
export const POLL_MEDIUM = 10_000;      // Medium: positions, account data
export const POLL_SLOW = 30_000;        // Slow: portfolio, dashboard
export const POLL_VERY_SLOW = 60_000;   // Very slow: news, sentiment
export const POLL_ULTRA_SLOW = 300_000; // Ultra slow: capital flow, sector

// ── Trading / Commission Constants ────────────────────────────────────────
export const FUTU_US_COMMISSION = 0.0049;   // USD per share
export const FUTU_HK_COMMISSION_RATE = 0.0003; // 0.03%
export const IBKR_US_COMMISSION_FIXED = 0.005;
export const IBKR_US_COMMISSION_TIERED = 0.0035;
export const IBKR_HK_COMMISSION_RATE = 0.0008; // 0.08%

// ── Default Fee Constants ─────────────────────────────────────────────────
export const DEFAULT_COMMISSION_RATE = 0.0003;  // 0.03%
export const DEFAULT_SLIPPAGE = 0.001;          // 0.1%
export const DEFAULT_STAMP_DUTY_HK = 0.0013;    // 0.13%

// ── Risk / Position Constants ─────────────────────────────────────────────
export const MAX_POSITION_PCT = 0.2;         // 20% max single position
export const MAX_SECTOR_PCT = 0.3;           // 30% max sector exposure
export const DAILY_LOSS_LIMIT_PCT = 0.15;    // 15% daily loss hard limit
export const DEFAULT_VAR_CONFIDENCE = 0.95;  // 95% VaR confidence
export const DEFAULT_CVAR_CONFIDENCE = 0.95; // 95% CVaR

// ── UI / Display Constants ────────────────────────────────────────────────
export const TOAST_DURATION_SHORT = 2_000;   // 2s
export const TOAST_DURATION_NORMAL = 3_000;  // 3s
export const TOAST_DURATION_LONG = 5_000;    // 5s
export const DEBOUNCE_DELAY = 300;           // 300ms input debounce
export const AUTO_SAVE_DELAY = 2_000;        // 2s auto-save throttle

// ── Pricing Constants (USDT) ──────────────────────────────────────────────
export const PRICE_STANDARD_USDT = 1.0;
export const PRICE_PREMIUM_USDT = 1.5;
export const PRICE_FLAGSHIP_USDT = 2.0;
export const P2P_FEE_RATE = 0.003;           // 0.3% bidirectional
export const P2P_FREEZE_DAYS = 14;

// ── Numeric Constants ─────────────────────────────────────────────────────
export const PERCENT = 0.01;
export const ONE_PERCENT = 0.01;
export const HALF_PERCENT = 0.005;
export const ONE_TENTH = 0.1;
export const ONE_QUARTER = 0.25;
export const ONE_HALF = 0.5;
export const ONE_MILLION = 1_000_000;
export const ONE_BILLION = 1_000_000_000;
