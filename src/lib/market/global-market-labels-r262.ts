// ══ R262 QClaw Task 2: 全球指数多语言标签 ══
// 24 markets × zh/en labels — with timezone, hours, indices
// Design: 不是\"市场名称翻译\"——是\"跨时区投资者一眼看懂：市场开没开、几点开、指数在涨还是跌\"

export interface MarketLabel {
  marketId: string;
  zh: { full: string; short: string; index: string; };
  en: { full: string; short: string; index: string; };
  timezone: string; tzOffset: string;  // e.g. "America/New_York" / "UTC-4"
  tradingHours: { zh: string; en: string; };
  lunchBreak?: { zh: string; en: string; };
  flags: { emoji: string; countryCode: string; };
  isOpen: (now: Date) => { zh: string; en: string; };  // 当前状态简短文案
  statusLabels: Record<string, { zh: string; en: string; }>;
}

// ═══════════════ 24全球市场 ═══════════════

// Shared US market config (referenced by NASDAQ/Canada)
const US_MARKET = {
  isOpen: (n: Date) => {
    const h = n.getUTCHours();
    const open = h >= 14 && h < 21;
    return { zh: open ? '🟢 交易中' : '🔴 盘后', en: open ? '🟢 Open' : '🔴 After Hours' } as const;
  },
  statusLabels: {
    open: { zh: '🟢 交易中', en: '🟢 Trading' } as const,
    closed: { zh: '🔴 已收盘', en: '🔴 Closed' } as const,
    preMarket: { zh: '🟠 盘前', en: '🟠 Pre-Market' } as const,
    afterHours: { zh: '🔵 盘后', en: '🔵 After Hours' } as const,
    holiday: { zh: '⏸️ 休市', en: '⏸️ Holiday' } as const,
  },
};

export const GLOBAL_MARKETS: MarketLabel[] = [

  // ── 北美 (2) ──
  {
    marketId: 'US', timezone: 'America/New_York', tzOffset: 'UTC-4/-5',
    zh: { full: '美国股市', short: '美股', index: '标普500' },
    en: { full: 'US Market', short: 'US', index: 'S&P 500' },
    tradingHours: { zh: '21:30-04:00(夏令时) 22:30-05:00(冬令时)', en: '9:30 AM-4:00 PM ET' },
    flags: { emoji: '🇺🇸', countryCode: 'US' },
    isOpen: US_MARKET.isOpen,
    statusLabels: US_MARKET.statusLabels as unknown as Record<string, { zh: string; en: string }>,
  },
  {
    marketId: 'US_NASDAQ', timezone: 'America/New_York', tzOffset: 'UTC-4/-5',
    zh: { full: '纳斯达克', short: '纳斯达克', index: '纳斯达克综合' },
    en: { full: 'NASDAQ', short: 'NASDAQ', index: 'NASDAQ Composite' },
    tradingHours: { zh: '21:30-04:00(夏令时)', en: '9:30 AM-4:00 PM ET' },
    flags: { emoji: '🇺🇸', countryCode: 'US' },
    isOpen: US_MARKET.isOpen,
    statusLabels: US_MARKET.statusLabels as unknown as Record<string, { zh: string; en: string }>,
  },

  // ── 加拿大 (1) ──
  {
    marketId: 'CA', timezone: 'America/Toronto', tzOffset: 'UTC-4/-5',
    zh: { full: '加拿大股市', short: '加股', index: '多伦多S&P/TSX' },
    en: { full: 'Canada Market', short: 'Canada', index: 'S&P/TSX' },
    tradingHours: { zh: '21:30-04:00(夏令时)', en: '9:30 AM-4:00 PM ET' },
    flags: { emoji: '🇨🇦', countryCode: 'CA' },
    isOpen: US_MARKET.isOpen,
    statusLabels: US_MARKET.statusLabels as unknown as Record<string, { zh: string; en: string }>,
  },

  // ── 拉丁美洲 (2) ──
  {
    marketId: 'BR', timezone: 'America/Sao_Paulo', tzOffset: 'UTC-3',
    zh: { full: '巴西股市', short: '巴西', index: '巴西Bovespa' },
    en: { full: 'Brazil Market', short: 'Brazil', index: 'Bovespa' },
    tradingHours: { zh: '21:00-04:00(夏令时)', en: '10:00 AM-5:00 PM BRT' },
    flags: { emoji: '🇧🇷', countryCode: 'BR' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'MX', timezone: 'America/Mexico_City', tzOffset: 'UTC-6',
    zh: { full: '墨西哥股市', short: '墨西哥', index: '墨西哥IPC' },
    en: { full: 'Mexico Market', short: 'Mexico', index: 'IPC' },
    tradingHours: { zh: '22:30-04:00(夏令时)', en: '8:30 AM-3:00 PM CST' },
    flags: { emoji: '🇲🇽', countryCode: 'MX' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },

  // ── 欧洲 (7) ──
  {
    marketId: 'UK', timezone: 'Europe/London', tzOffset: 'UTC+0/+1',
    zh: { full: '英国股市', short: '英股', index: '富时100' },
    en: { full: 'UK Market', short: 'UK', index: 'FTSE 100' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '8:00 AM-4:30 PM GMT' },
    flags: { emoji: '🇬🇧', countryCode: 'GB' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'DE', timezone: 'Europe/Berlin', tzOffset: 'UTC+1/+2',
    zh: { full: '德国股市', short: '德股', index: 'DAX 40' },
    en: { full: 'Germany Market', short: 'Germany', index: 'DAX 40' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇩🇪', countryCode: 'DE' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'FR', timezone: 'Europe/Paris', tzOffset: 'UTC+1/+2',
    zh: { full: '法国股市', short: '法股', index: 'CAC 40' },
    en: { full: 'France Market', short: 'France', index: 'CAC 40' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇫🇷', countryCode: 'FR' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'NL', timezone: 'Europe/Amsterdam', tzOffset: 'UTC+1/+2',
    zh: { full: '荷兰股市', short: '荷兰', index: 'AEX' },
    en: { full: 'Netherlands Market', short: 'Netherlands', index: 'AEX' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇳🇱', countryCode: 'NL' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'CH', timezone: 'Europe/Zurich', tzOffset: 'UTC+1/+2',
    zh: { full: '瑞士股市', short: '瑞士', index: 'SMI' },
    en: { full: 'Switzerland Market', short: 'Switzerland', index: 'SMI' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇨🇭', countryCode: 'CH' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'IT', timezone: 'Europe/Rome', tzOffset: 'UTC+1/+2',
    zh: { full: '意大利股市', short: '意股', index: 'FTSE MIB' },
    en: { full: 'Italy Market', short: 'Italy', index: 'FTSE MIB' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇮🇹', countryCode: 'IT' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'ES', timezone: 'Europe/Madrid', tzOffset: 'UTC+1/+2',
    zh: { full: '西班牙股市', short: '西股', index: 'IBEX 35' },
    en: { full: 'Spain Market', short: 'Spain', index: 'IBEX 35' },
    tradingHours: { zh: '15:00-23:30(夏令时)', en: '9:00 AM-5:30 PM CET' },
    flags: { emoji: '🇪🇸', countryCode: 'ES' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },

  // ── 亚太 (8) ──
  {
    marketId: 'CN_SH', timezone: 'Asia/Shanghai', tzOffset: 'UTC+8',
    zh: { full: '上海证券交易所', short: '沪市', index: '上证综指' },
    en: { full: 'Shanghai Exchange', short: 'Shanghai', index: 'SSE Composite' },
    tradingHours: { zh: '09:30-11:30 / 13:00-15:00', en: '9:30-11:30 AM / 1:00-3:00 PM CST' },
    lunchBreak: { zh: '午休11:30-13:00', en: 'Lunch 11:30-1:00 PM' },
    flags: { emoji: '🇨🇳', countryCode: 'CN' },
    isOpen: () => ({ zh: '🟢/🔴/🟡(午休)', en: '🟢/🔴/🟡(Lunch)' }),
    statusLabels: {
      open: { zh: '🟢 交易中', en: '🟢 Trading' },
      closed: { zh: '🔴 已收盘', en: '🔴 Closed' },
      lunch: { zh: '🟡 午间休市', en: '🟡 Lunch Break' },
      holiday: { zh: '⏸️ 休市', en: '⏸️ Holiday' },
    },
  },
  {
    marketId: 'CN_SZ', timezone: 'Asia/Shanghai', tzOffset: 'UTC+8',
    zh: { full: '深圳证券交易所', short: '深市', index: '深证成指' },
    en: { full: 'Shenzhen Exchange', short: 'Shenzhen', index: 'SZSE Component' },
    tradingHours: { zh: '09:30-11:30 / 13:00-15:00', en: '9:30-11:30 AM / 1:00-3:00 PM CST' },
    lunchBreak: { zh: '午休11:30-13:00', en: 'Lunch 11:30-1:00 PM' },
    flags: { emoji: '🇨🇳', countryCode: 'CN' },
    isOpen: () => ({ zh: '🟢/🔴/🟡(午休)', en: '🟢/🔴/🟡(Lunch)' }),
    statusLabels: {
      open: { zh: '🟢 交易中', en: '🟢 Trading' },
      closed: { zh: '🔴 已收盘', en: '🔴 Closed' },
      lunch: { zh: '🟡 午间休市', en: '🟡 Lunch Break' },
      holiday: { zh: '⏸️ 休市', en: '⏸️ Holiday' },
    },
  },
  {
    marketId: 'HK', timezone: 'Asia/Hong_Kong', tzOffset: 'UTC+8',
    zh: { full: '香港交易所', short: '港股', index: '恒生指数' },
    en: { full: 'Hong Kong Exchange', short: 'HK', index: 'Hang Seng' },
    tradingHours: { zh: '09:30-12:00 / 13:00-16:00', en: '9:30 AM-12:00 PM / 1:00-4:00 PM HKT' },
    lunchBreak: { zh: '午休12:00-13:00', en: 'Lunch 12:00-1:00 PM' },
    flags: { emoji: '🇭🇰', countryCode: 'HK' },
    isOpen: () => ({ zh: '🟢/🔴/🟡(午休)', en: '🟢/🔴/🟡(Lunch)' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' }, lunch: { zh: '🟡 午间休市', en: '🟡 Lunch Break' } },
  },
  {
    marketId: 'JP', timezone: 'Asia/Tokyo', tzOffset: 'UTC+9',
    zh: { full: '日本股市', short: '日股', index: '日经225' },
    en: { full: 'Japan Market', short: 'Japan', index: 'Nikkei 225' },
    tradingHours: { zh: '08:00-10:30 / 11:30-14:00', en: '9:00-11:30 AM / 12:30-3:00 PM JST' },
    lunchBreak: { zh: '午休10:30-11:30', en: 'Lunch 11:30-12:30 PM' },
    flags: { emoji: '🇯🇵', countryCode: 'JP' },
    isOpen: () => ({ zh: '🟢/🔴/🟡(午休)', en: '🟢/🔴/🟡(Lunch)' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' }, lunch: { zh: '🟡 午间休市', en: '🟡 Lunch Break' } },
  },
  {
    marketId: 'KR', timezone: 'Asia/Seoul', tzOffset: 'UTC+9',
    zh: { full: '韩国股市', short: '韩股', index: 'KOSPI' },
    en: { full: 'Korea Market', short: 'Korea', index: 'KOSPI' },
    tradingHours: { zh: '08:00-14:30', en: '9:00 AM-3:30 PM KST' },
    flags: { emoji: '🇰🇷', countryCode: 'KR' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'IN', timezone: 'Asia/Kolkata', tzOffset: 'UTC+5:30',
    zh: { full: '印度股市', short: '印股', index: '印度Nifty 50' },
    en: { full: 'India Market', short: 'India', index: 'Nifty 50' },
    tradingHours: { zh: '09:45-16:00', en: '9:15 AM-3:30 PM IST' },
    flags: { emoji: '🇮🇳', countryCode: 'IN' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'AU', timezone: 'Australia/Sydney', tzOffset: 'UTC+10/+11',
    zh: { full: '澳大利亚股市', short: '澳股', index: '澳洲ASX 200' },
    en: { full: 'Australia Market', short: 'Australia', index: 'ASX 200' },
    tradingHours: { zh: '07:00-13:00(夏令时)', en: '10:00 AM-4:00 PM AEDT' },
    flags: { emoji: '🇦🇺', countryCode: 'AU' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'SG', timezone: 'Asia/Singapore', tzOffset: 'UTC+8',
    zh: { full: '新加坡股市', short: '新加股', index: '海峡时报' },
    en: { full: 'Singapore Market', short: 'Singapore', index: 'STI' },
    tradingHours: { zh: '09:00-12:00 / 13:00-17:00', en: '9:00 AM-12:00 PM / 1:00-5:00 PM SGT' },
    lunchBreak: { zh: '午休12:00-13:00', en: 'Lunch 12:00-1:00 PM' },
    flags: { emoji: '🇸🇬', countryCode: 'SG' },
    isOpen: () => ({ zh: '🟢/🔴/🟡(午休)', en: '🟢/🔴/🟡(Lunch)' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' }, lunch: { zh: '🟡 午间休市', en: '🟡 Lunch Break' } },
  },

  // ── 中东 (2) ──
  {
    marketId: 'SA', timezone: 'Asia/Riyadh', tzOffset: 'UTC+3',
    zh: { full: '沙特股市', short: '沙特', index: '沙特Tadawul' },
    en: { full: 'Saudi Market', short: 'Saudi', index: 'Tadawul' },
    tradingHours: { zh: '13:00-18:00', en: '10:00 AM-3:00 PM AST' },
    flags: { emoji: '🇸🇦', countryCode: 'SA' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },
  {
    marketId: 'AE', timezone: 'Asia/Dubai', tzOffset: 'UTC+4',
    zh: { full: '阿联酋股市', short: '阿联酋', index: '迪拜DFM' },
    en: { full: 'UAE Market', short: 'UAE', index: 'DFM' },
    tradingHours: { zh: '12:00-17:00', en: '10:00 AM-3:00 PM GST' },
    flags: { emoji: '🇦🇪', countryCode: 'AE' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },

  // ── 非洲 (1) ──
  {
    marketId: 'ZA', timezone: 'Africa/Johannesburg', tzOffset: 'UTC+2',
    zh: { full: '南非股市', short: '南非', index: '南非JSE 40' },
    en: { full: 'South Africa Market', short: 'S. Africa', index: 'JSE Top 40' },
    tradingHours: { zh: '15:00-23:00', en: '9:00 AM-5:00 PM SAST' },
    flags: { emoji: '🇿🇦', countryCode: 'ZA' },
    isOpen: () => ({ zh: '🟢/🔴', en: '🟢/🔴' }),
    statusLabels: { open: { zh: '🟢 交易中', en: '🟢 Trading' }, closed: { zh: '🔴 已收盘', en: '🔴 Closed' } },
  },

  // ── 加密货币 (1，非传统市场) ──
  {
    marketId: 'CRYPTO', timezone: 'UTC', tzOffset: 'UTC',
    zh: { full: '加密货币', short: '加密', index: 'BTC/USDT' },
    en: { full: 'Crypto', short: 'Crypto', index: 'BTC/USDT' },
    tradingHours: { zh: '24×7 永不休市', en: '24/7 Always Open' },
    flags: { emoji: '₿', countryCode: 'CRYPTO' },
    isOpen: () => ({ zh: '🟢 24×7', en: '🟢 24/7' }),
    statusLabels: { open: { zh: '🟢 永续交易', en: '🟢 Perpetual' }, closed: { zh: '— 不适用', en: '— N/A' } },
  },
];

// ═══════════════════════════════════════
// 多语言工具函数
// ═══════════════════════════════════════

export function getMarketLabel(marketId: string): MarketLabel | undefined {
  return GLOBAL_MARKETS.find(m => m.marketId === marketId);
}

export function getMarketName(marketId: string, lang: 'zh' | 'en' = 'zh'): string {
  const m = getMarketLabel(marketId);
  return m ? m[lang].full : marketId;
}

export function getMarketShort(marketId: string, lang: 'zh' | 'en' = 'zh'): string {
  const m = getMarketLabel(marketId);
  return m ? m[lang].short : marketId;
}

export function getMarketIndex(marketId: string, lang: 'zh' | 'en' = 'zh'): string {
  const m = getMarketLabel(marketId);
  return m ? m[lang].index : marketId;
}

export function getMarketStatus(marketId: string, lang: 'zh' | 'en' = 'zh'): string {
  const m = getMarketLabel(marketId);
  if (!m) return '';
  const now = new Date();
  return m.isOpen(now)[lang];
}

export function getMarketByStatus(status: string, lang: 'zh' | 'en' = 'zh'): MarketLabel[] {
  const now = new Date();
  return GLOBAL_MARKETS.filter(m => m.isOpen(now)[lang].includes(status));
}

export function getAllMarketRegions(): Record<string, string[]> {
  return {
    '🌎 北美': ['US', 'US_NASDAQ', 'CA'],
    '🌎 拉美': ['BR', 'MX'],
    '🌍 欧洲': ['UK', 'DE', 'FR', 'NL', 'CH', 'IT', 'ES'],
    '🌏 亚太': ['CN_SH', 'CN_SZ', 'HK', 'JP', 'KR', 'IN', 'AU', 'SG'],
    '🌍 中东/非洲': ['SA', 'AE', 'ZA'],
    '📡 加密货币': ['CRYPTO'],
  };
}

export function getTradingHours(marketId: string, lang: 'zh' | 'en' = 'zh'): string {
  const m = getMarketLabel(marketId);
  if (!m) return '';
  return m.tradingHours[lang];
}

export default GLOBAL_MARKETS;
