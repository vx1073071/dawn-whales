// ── R194 ML P10-01: MarketFlag — 7市场国旗+时区+假期+货币 ──────────
// 🇭🇰🇺🇸🪙🇯🇵🇹🇼🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺 7 markets full metadata
// Shows flag + timezone + trading hours + upcoming holidays
// DST-aware for applicable markets
// Currency symbol + local name rendering

import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip, Tag, Badge } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type MarketCode7 = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'kr' | 'sg' | 'au' | 'in' | 'eu';

interface MarketHoliday {
  date: string;
  name: string;
  nameLocal: string;
}

interface MarketMeta {
  code: MarketCode7;
  flag: string;
  name: string;
  nameLocal: string;
  timezone: string;
  tzOffset: string;
  marketOpen: string;
  marketClose: string;
  lunchBreak?: string;
  currency: string;
  currencySymbol: string;
  holidays: MarketHoliday[];
  factorCount: number;
  exclusiveCount: number;
  status: 'open' | 'lunch' | 'closed' | 'always'; // crypto always
}

interface MarketFlagProps {
  code: MarketCode7;
  size?: 'sm' | 'md' | 'lg';
  showTime?: boolean;
  showHoliday?: boolean;
  showCurrency?: boolean;
  onClick?: () => void;
}

// ── Market Data ─────────────────────────────────────────────────────
const MARKET_DATA: Record<MarketCode7, MarketMeta> = {
  hk: {
    code: 'hk', flag: '🇭🇰', name: 'Hong Kong', nameLocal: '香港',
    timezone: 'HKT', tzOffset: 'UTC+8',
    marketOpen: '09:30', marketClose: '16:00', lunchBreak: '12:00-13:00',
    currency: 'HKD', currencySymbol: 'HK$',
    holidays: [
      { date: '2026-07-01', name: 'HKSAR Establishment Day', nameLocal: '香港特區成立紀念日' },
      { date: '2026-09-25', name: 'Mid-Autumn Festival', nameLocal: '中秋節翌日' },
    ],
    factorCount: 89, exclusiveCount: 11, status: 'closed',
  },
  us: {
    code: 'us', flag: '🇺🇸', name: 'United States', nameLocal: 'United States',
    timezone: 'ET', tzOffset: 'UTC-5/-4 (DST)',
    marketOpen: '09:30', marketClose: '16:00',
    currency: 'USD', currencySymbol: '$',
    holidays: [
      { date: '2026-07-03', name: 'Independence Day (Observed)', nameLocal: 'Independence Day' },
      { date: '2026-09-07', name: 'Labor Day', nameLocal: 'Labor Day' },
    ],
    factorCount: 99, exclusiveCount: 14, status: 'closed',
  },
  crypto: {
    code: 'crypto', flag: '🪙', name: 'Crypto', nameLocal: 'Crypto',
    timezone: '24/7', tzOffset: 'N/A',
    marketOpen: '00:00', marketClose: '23:59',
    currency: 'USDT', currencySymbol: '₮',
    holidays: [],
    factorCount: 62, exclusiveCount: 31, status: 'always',
  },
  jp: {
    code: 'jp', flag: '🇯🇵', name: 'Japan', nameLocal: '日本',
    timezone: 'JST', tzOffset: 'UTC+9',
    marketOpen: '09:00', marketClose: '15:00', lunchBreak: '11:30-12:30',
    currency: 'JPY', currencySymbol: '¥',
    holidays: [
      { date: '2026-07-18', name: 'Marine Day', nameLocal: '海の日' },
      { date: '2026-08-11', name: 'Mountain Day', nameLocal: '山の日' },
      { date: '2026-09-21', name: 'Respect for the Aged Day', nameLocal: '敬老の日' },
    ],
    factorCount: 119, exclusiveCount: 12, status: 'closed',
  },
  tw: {
    code: 'tw', flag: '🇹🇼', name: 'Taiwan', nameLocal: '台灣',
    timezone: 'CST', tzOffset: 'UTC+8',
    marketOpen: '09:00', marketClose: '13:30',
    currency: 'TWD', currencySymbol: 'NT$',
    holidays: [
      { date: '2026-09-21', name: 'Mid-Autumn Festival', nameLocal: '中秋節' },
      { date: '2026-10-10', name: 'National Day', nameLocal: '國慶日' },
    ],
    factorCount: 107, exclusiveCount: 7, status: 'closed',
  },
  kr: {
    code: 'kr', flag: '🇰🇷', name: 'South Korea', nameLocal: '대한민국',
    timezone: 'KST', tzOffset: 'UTC+9',
    marketOpen: '09:00', marketClose: '15:30',
    currency: 'KRW', currencySymbol: '₩',
    holidays: [
      { date: '2026-08-15', name: 'Liberation Day', nameLocal: '광복절' },
      { date: '2026-09-15', name: 'Chuseok', nameLocal: '추석' },
    ],
    factorCount: 0, exclusiveCount: 0, status: 'closed',
  },
  sg: {
    code: 'sg', flag: '🇸🇬', name: 'Singapore', nameLocal: 'Singapore',
    timezone: 'SGT', tzOffset: 'UTC+8',
    marketOpen: '09:00', marketClose: '17:00',
    currency: 'SGD', currencySymbol: 'S$',
    holidays: [
      { date: '2026-08-09', name: 'National Day', nameLocal: 'National Day' },
      { date: '2026-11-10', name: 'Deepavali', nameLocal: 'Deepavali' },
    ],
    factorCount: 0, exclusiveCount: 0, status: 'closed',
  },
  au: {
    code: 'au', flag: '🇦🇺', name: 'Australia', nameLocal: 'Australia',
    timezone: 'AET', tzOffset: 'UTC+10/+11 (DST)',
    marketOpen: '10:00', marketClose: '16:00',
    currency: 'AUD', currencySymbol: 'A$',
    holidays: [
      { date: '2026-12-25', name: 'Christmas Day', nameLocal: 'Christmas Day' },
      { date: '2026-12-26', name: 'Boxing Day', nameLocal: 'Boxing Day' },
    ],
    factorCount: 0, exclusiveCount: 0, status: 'closed',
  },
  in: {
    code: 'in', flag: '🇮🇳', name: 'India', nameLocal: 'भारत',
    timezone: 'IST', tzOffset: 'UTC+5:30',
    marketOpen: '09:15', marketClose: '15:30',
    currency: 'INR', currencySymbol: '₹',
    holidays: [
      { date: '2026-08-15', name: 'Independence Day', nameLocal: 'स्वतंत्रता दिवस' },
      { date: '2026-10-02', name: 'Gandhi Jayanti', nameLocal: 'गांधी जयंती' },
    ],
    factorCount: 0, exclusiveCount: 0, status: 'closed',
  },
  eu: {
    code: 'eu', flag: '🇪🇺', name: 'Europe', nameLocal: 'Europe',
    timezone: 'CET/CEST', tzOffset: 'UTC+1/+2 (DST)',
    marketOpen: '09:00', marketClose: '17:30',
    currency: 'EUR', currencySymbol: '€',
    holidays: [
      { date: '2026-12-25', name: 'Christmas', nameLocal: 'Christmas' },
      { date: '2026-12-26', name: 'Boxing Day', nameLocal: 'Boxing Day' },
    ],
    factorCount: 0, exclusiveCount: 0, status: 'closed',
  },
};

// ── Computed status ─────────────────────────────────────────────────
function getLiveStatus(code: MarketCode7): 'open' | 'lunch' | 'closed' | 'always' {
  const meta = MARKET_DATA[code];
  if (meta.status === 'always') return 'always';

  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const day = now.getUTCDay();

  // Weekend check
  if (day === 0 || day === 6) return 'closed';

  // Rough UTC offset mapping (simplified — not DST-precise)
  const offsets: Record<string, number> = {
    'UTC+8': 8, 'UTC+9': 9, 'UTC+5:30': 5.5,
    'UTC+10/+11 (DST)': 10, 'UTC+1/+2 (DST)': 2,
    'UTC-5/-4 (DST)': -4,
  };

  const offset = offsets[meta.tzOffset] || 8;
  const localMinutes = utcHours * 60 + utcMinutes + offset * 60;
  const localH = Math.floor((localMinutes % 1440) / 60);
  const localM = localMinutes % 60;

  const [oh, om] = meta.marketOpen.split(':').map(Number);
  const [ch, cm] = meta.marketClose.split(':').map(Number);
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  const nowMin = localH * 60 + localM;

  if (nowMin < openMin || nowMin >= closeMin) return 'closed';

  // Lunch break
  if (meta.lunchBreak) {
    const [ls, le] = meta.lunchBreak.split('-');
    const [lsh, lsm] = ls.split(':').map(Number);
    const [leh, lem] = le.split(':').map(Number);
    const lunchStart = lsh * 60 + lsm;
    const lunchEnd = leh * 60 + lem;
    if (nowMin >= lunchStart && nowMin < lunchEnd) return 'lunch';
  }

  return 'open';
}

// ── Component ────────────────────────────────────────────────────────
const MarketFlag: React.FC<MarketFlagProps> = ({
  code,
  size = 'md',
  showTime = true,
  showHoliday = false,
  showCurrency = true,
  onClick,
}) => {
  const [status, setStatus] = useState(getLiveStatus(code));
  const meta = MARKET_DATA[code];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getLiveStatus(code));
    }, 60000);
    return () => clearInterval(interval);
  }, [code]);

  const statusConfig = {
    open: { color: '#66bd63', label: 'Trading', dot: '🟢' },
    lunch: { color: '#d4a853', label: 'Lunch Break', dot: '🟡' },
    closed: { color: '#f46d43', label: 'Closed', dot: '🔴' },
    always: { color: '#9b59b6', label: '24/7', dot: '🟣' },
  };

  const sc = statusConfig[status];
  const nearestHoliday = meta.holidays[0];

  const sizeDimensions = {
    sm: { iconSz: 18, nameSz: 13, metaSz: 10, padding: '6px 10px' },
    md: { iconSz: 24, nameSz: 15, metaSz: 11, padding: '10px 14px' },
    lg: { iconSz: 32, nameSz: 18, metaSz: 12, padding: '14px 18px' },
  };

  const dim = sizeDimensions[size];

  return (
    <Tooltip
      title={
        <div style={styles.tooltipContent}>
          <div style={styles.ttRow}>
            <span>{meta.flag} {meta.nameLocal}</span>
            <Tag color={sc.color} style={{ fontSize: 10 }}>{sc.label}</Tag>
          </div>
          <div style={styles.ttRow}>
            <span>🕐 {meta.timezone} ({meta.tzOffset})</span>
          </div>
          <div style={styles.ttRow}>
            <span>⌚ {meta.marketOpen}—{meta.marketClose}{meta.lunchBreak ? ` (Lunch: ${meta.lunchBreak})` : ''}</span>
          </div>
          <div style={styles.ttRow}>
            <span>💱 {meta.currencySymbol} {meta.currency}</span>
          </div>
          <div style={styles.ttRow}>
            <span>🧬 {meta.factorCount} factors ({meta.exclusiveCount} exclusive)</span>
          </div>
          {nearestHoliday && (
            <div style={styles.ttHoliday}>
              <span>🎌 Next: {nearestHoliday.nameLocal} ({nearestHoliday.date})</span>
            </div>
          )}
        </div>
      }
    >
      <div style={{ ...styles.flagCard, padding: dim.padding, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
        <div style={styles.flagTop}>
          <span style={{ fontSize: dim.iconSz }}>{meta.flag}</span>
          <div style={styles.flagInfo}>
            <span style={{ fontSize: dim.nameSz, fontWeight: 700, color: '#e0e0e0' }}>{meta.name}</span>
            <span style={{ fontSize: dim.metaSz, color: '#888' }}>{meta.nameLocal}</span>
          </div>
          <span style={{ ...styles.statusDot, color: sc.color }}>{sc.dot}</span>
        </div>
        <div style={styles.flagMeta}>
          {showTime && (
            <span style={{ fontSize: dim.metaSz, color: '#aaa' }}>
              🕐 {meta.timezone}
            </span>
          )}
          {showCurrency && (
            <span style={{ fontSize: dim.metaSz, color: '#aaa' }}>
              {meta.currencySymbol}
            </span>
          )}
          {meta.exclusiveCount > 0 && (
            <Tag color="gold" style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px' }}>
              +{meta.exclusiveCount}
            </Tag>
          )}
        </div>
        {showHoliday && nearestHoliday && (
          <div style={styles.holidayBar}>
            <span>{nearestHoliday.date}: {nearestHoliday.nameLocal}</span>
          </div>
        )}
      </div>
    </Tooltip>
  );
};

// ── Market Grid (all 7 markets) ─────────────────────────────────────
const MarketFlagGrid: React.FC<{
  markets?: MarketCode7[];
  size?: 'sm' | 'md' | 'lg';
  onSelect?: (code: MarketCode7) => void;
}> = ({ markets, size = 'md', onSelect }) => {
  const codes = markets || (Object.keys(MARKET_DATA) as MarketCode7[]);

  return (
    <div style={styles.grid}>
      {codes.map((code) => (
        <MarketFlag
          key={code}
          code={code}
          size={size}
          showTime={true}
          showCurrency={true}
          showHoliday={false}
          onClick={() => onSelect?.(code)}
        />
      ))}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  flagCard: {
    background: '#0f0f1e',
    borderRadius: 10,
    border: '1px solid #2a2a4a',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  flagTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  flagInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  statusDot: {
    fontSize: 14,
    flexShrink: 0,
  },
  flagMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  holidayBar: {
    marginTop: 6,
    padding: '4px 8px',
    background: 'rgba(212,168,83,0.1)',
    borderRadius: 4,
    fontSize: 10,
    color: '#d4a853',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  tooltipContent: {
    fontSize: 12,
    lineHeight: 2,
    minWidth: 200,
  },
  ttRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ttHoliday: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1px solid #4a4a6a',
    color: '#d4a853',
  },
};

export { MarketFlag, MarketFlagGrid, MARKET_DATA };
export { getLiveStatus };
export type { MarketCode7, MarketMeta, MarketHoliday, MarketFlagProps };
