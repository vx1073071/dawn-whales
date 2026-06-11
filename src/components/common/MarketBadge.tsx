/**
 * MarketBadge — Market flag + code + trading status badge (R100 M-01)
 *
 * Displays: 🇺🇸 US · Open
 *           🇭🇰 HK · Lunch Break
 *           🇨🇳 CN · Closed
 *           etc.
 */

export interface MarketBadgeProps {
  market: string; // 'US' | 'HK' | 'CN' | 'JP' | 'UK' | 'EU' | 'CRYPTO'
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  className?: string;
}

// Market configuration
const MARKET_CONFIG: Record<string, {
  flag: string;
  code: string;
  timezone: string;
  openHour: number;
  openMin: number;
  closeHour: number;
  closeMin: number;
  lunchStart?: number;
  lunchEnd?: number;
  days: number[];
}> = {
  US: {
    flag: '🇺🇸', code: 'US', timezone: 'America/New_York',
    openHour: 9, openMin: 30, closeHour: 16, closeMin: 0,
    days: [1, 2, 3, 4, 5],
  },
  HK: {
    flag: '🇭🇰', code: 'HK', timezone: 'Asia/Hong_Kong',
    openHour: 9, openMin: 30, closeHour: 16, closeMin: 0,
    lunchStart: 12 * 60, lunchEnd: 13 * 60,
    days: [1, 2, 3, 4, 5],
  },
  CN: {
    flag: '🇨🇳', code: 'CN', timezone: 'Asia/Shanghai',
    openHour: 9, openMin: 30, closeHour: 15, closeMin: 0,
    lunchStart: 11 * 60 + 30, lunchEnd: 13 * 60,
    days: [1, 2, 3, 4, 5],
  },
  JP: {
    flag: '🇯🇵', code: 'JP', timezone: 'Asia/Tokyo',
    openHour: 9, openMin: 0, closeHour: 15, closeMin: 0,
    lunchStart: 11 * 60 + 30, lunchEnd: 12 * 60 + 30,
    days: [1, 2, 3, 4, 5],
  },
  UK: {
    flag: '🇬🇧', code: 'UK', timezone: 'Europe/London',
    openHour: 8, openMin: 0, closeHour: 16, closeMin: 30,
    days: [1, 2, 3, 4, 5],
  },
  EU: {
    flag: '🇪🇺', code: 'EU', timezone: 'Europe/Paris',
    openHour: 9, openMin: 0, closeHour: 17, closeMin: 30,
    days: [1, 2, 3, 4, 5],
  },
  CRYPTO: {
    flag: '₿', code: 'CRYPTO', timezone: 'UTC',
    openHour: 0, openMin: 0, closeHour: 24, closeMin: 0,
    days: [0, 1, 2, 3, 4, 5, 6],
  },
};

export type TradingStatus = 'open' | 'closed' | 'lunch' | 'pre-open';

export function getMarketTradingStatus(market: string): {
  status: TradingStatus;
  label: string;
  color: string;
  bgColor: string;
} {
  const config = MARKET_CONFIG[market];
  if (!config) return { status: 'closed', label: 'Unknown', color: '#6B7280', bgColor: '#6B728022' };

  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  const day = tzNow.getDay();
  const hour = tzNow.getHours();
  const min = tzNow.getMinutes();
  const minutes = hour * 60 + min;

  // Weekend check
  if (!config.days.includes(day)) {
    return { status: 'closed', label: 'Closed', color: '#6B7280', bgColor: '#6B728022' };
  }

  const openMin = config.openHour * 60 + config.openMin;
  const closeMin = config.closeHour * 60 + config.closeMin;

  // Pre-open (within 60 min before open)
  if (minutes >= openMin - 60 && minutes < openMin) {
    return { status: 'pre-open', label: 'Pre-Open', color: '#D4A853', bgColor: '#D4A85322' };
  }

  // Lunch break check
  if (config.lunchStart && config.lunchEnd && minutes >= config.lunchStart && minutes < config.lunchEnd) {
    return { status: 'lunch', label: 'Lunch', color: '#F59E0B', bgColor: '#F59E0B22' };
  }

  // Open check
  if (minutes >= openMin && minutes < closeMin) {
    return { status: 'open', label: 'Open', color: '#22C55E', bgColor: '#22C55E22' };
  }

  // Closed
  return { status: 'closed', label: 'Closed', color: '#6B7280', bgColor: '#6B728022' };
}

export function getMarketConfig(market: string) {
  return MARKET_CONFIG[market] || MARKET_CONFIG['US'];
}

export default function MarketBadge({ market, size = 'md', showStatus = true, className = '' }: MarketBadgeProps) {
  const config = getMarketConfig(market);
  const status = getMarketTradingStatus(market);

  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs';
  const flagSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <span className={`inline-flex items-center gap-1.5 ${fontSize} ${className}`}>
      <span className={flagSize}>{config.flag}</span>
      <span className="font-semibold" style={{ color: 'var(--dw-text, #E5E7EB)' }}>
        {config.code}
      </span>
      {showStatus && (
        <span
          className="px-1.5 py-0.5 rounded text-xs font-medium"
          style={{ color: status.color, background: status.bgColor }}
        >
          {status.label}
        </span>
      )}
    </span>
  );
}
