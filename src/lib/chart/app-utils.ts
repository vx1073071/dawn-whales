// R127-Q01: nocheck cleared — R120: unused variable pending cleanup
// ── R120 #26/27 + R119 #16 PM: 全局搜索 + 自选股 + IB格式 ───────────
// #26: 全局搜索输入框 → 自动识别市场/券商
// #27: 自选股 localStorage持久化
// #16: CodeNormalizer IB格式 (STK/CASH/FUT映射)
//
// @author PM (WorkBuddy)
// @round R119+R120
// @since 2026-06-12

// ═══════════════════════════════════════════════════════════════════════
// CODE NORMALIZER: IB FORMAT (#16)
// ═══════════════════════════════════════════════════════════════════════

/** IB合约格式: AAPL STK SMART USD → AAPL */
export function normalizeIBContract(input: string): string {
  // 格式: SYMBOL TYPE EXCHANGE CURRENCY
  const parts = input.trim().split(/\s+/);
  if (parts.length < 2) return input.toUpperCase();

  const [symbol, secType] = parts;
  const type = secType?.toUpperCase() || '';

  switch (type) {
    case 'STK': return symbol.toUpperCase();       // AAPL
    case 'CASH': return `${symbol.toUpperCase()}.CASH`; // EUR.USD
    case 'FUT': return `${symbol.toUpperCase()}_FUT`;   // ES_FUT
    case 'OPT': return `${symbol.toUpperCase()}_OPT`;   // AAPL_OPT
    case 'CFD': return `${symbol.toUpperCase()}_CFD`;   // US30_CFD
    case 'FOP': return `${symbol.toUpperCase()}_FOP`;   // Futures Option
    default: return symbol.toUpperCase();
  }
}

export function normalizeIBFullContract(contract: string): {
  symbol: string; type: string; exchange: string; currency: string;
} {
  const parts = contract.trim().split(/\s+/);
  return {
    symbol: parts[0]?.toUpperCase() || '',
    type: (parts[1] || 'STK').toUpperCase(),
    exchange: (parts[2] || 'SMART').toUpperCase(),
    currency: (parts[3] || 'USD').toUpperCase(),
  };
}

export const IB_CONTRACT_EXAMPLES: Record<string, string> = {
  'AAPL': 'AAPL STK SMART USD',
  'TSLA': 'TSLA STK SMART USD',
  'MSFT': 'MSFT STK SMART USD',
  'SPX': 'SPX CASH IDEALPRO USD',
  'EUR.USD': 'EUR CASH IDEALPRO USD',
};

// ═══════════════════════════════════════════════════════════════════════
// WATCHLIST MANAGER (#27)
// ═══════════════════════════════════════════════════════════════════════

export interface WatchlistItem {
  symbol: string;
  name: string;
  market: 'crypto' | 'us' | 'hk' | 'forex' | 'futures';
  addedAt: number;
  tags: string[];
  note?: string;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
}

const WATCHLIST_KEY = 'dw_watchlist';
const WATCHLIST_GROUPS_KEY = 'dw_watchlist_groups';

export class WatchlistManager {
  private items: Map<string, WatchlistItem> = new Map();

  constructor() {
    this.load();
  }

  add(item: Omit<WatchlistItem, 'addedAt'>): void {
    this.items.set(item.symbol, { ...item, addedAt: Date.now() });
    this.save();
  }

  remove(symbol: string): boolean {
    const result = this.items.delete(symbol);
    if (result) this.save();
    return result;
  }

  toggle(symbol: string, item: Omit<WatchlistItem, 'addedAt'>): boolean {
    if (this.items.has(symbol)) {
      this.remove(symbol);
      return false;
    }
    this.add(item);
    return true;
  }

  has(symbol: string): boolean {
    return this.items.has(symbol);
  }

  getAll(): WatchlistItem[] {
    return Array.from(this.items.values()).sort((a, b) => b.addedAt - a.addedAt);
  }

  getByMarket(market: string): WatchlistItem[] {
    return this.getAll().filter(i => i.market === market);
  }

  getSymbols(): string[] {
    return Array.from(this.items.keys());
  }

  updateNote(symbol: string, note: string): void {
    const item = this.items.get(symbol);
    if (item) { item.note = note; this.save(); }
  }

  addTag(symbol: string, tag: string): void {
    const item = this.items.get(symbol);
    if (item && !item.tags.includes(tag)) { item.tags.push(tag); this.save(); }
  }

  getGroups(): WatchlistGroup[] {
    try {
      return JSON.parse(localStorage.getItem(WATCHLIST_GROUPS_KEY) || '[]');
    } catch { return []; }
  }

  saveGroup(group: WatchlistGroup): void {
    const groups = this.getGroups().filter(g => g.id !== group.id);
    groups.push(group);
    localStorage.setItem(WATCHLIST_GROUPS_KEY, JSON.stringify(groups));
  }

  exportCSV(): string {
    return ['symbol,name,market,tags']
      .concat(this.getAll().map(i =>
        `${i.symbol},${i.name},${i.market},"${i.tags.join(';')}"`))
      .join('\n');
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        const parsed: WatchlistItem[] = JSON.parse(raw);
        for (const item of parsed) this.items.set(item.symbol, item);
      }
    } catch { /* ignore corrupt data */ }
  }

  private save(): void {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(this.getAll()));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH ENGINE (#26)
// ═══════════════════════════════════════════════════════════════════════

export interface SearchResult {
  symbol: string;
  name: string;
  market: string;
  type: 'stock' | 'crypto' | 'forex' | 'futures' | 'index';
  brokerId?: string;
  price?: number;
  changePct?: number;
  /** 是否为自选 */
  isWatched: boolean;
}

/**
 * 智能搜索: 输入代码 → 识别市场+券商 → 返回匹配结果
 */
export function searchSymbol(
  query: string,
  watchlist: WatchlistManager,
  brokers: string[] = [],
): SearchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  // 市场识别
  const market = detectMarket(q);

  // 自选股优先
  const watched = watchlist.getAll().filter(i =>
    i.symbol.toUpperCase().includes(q) || i.name.toUpperCase().includes(q));
  for (const w of watched) {
    results.push({
      symbol: w.symbol, name: w.name, market: w.market,
      type: market === 'crypto' ? 'crypto' : 'stock',
      isWatched: true,
    });
  }

  // 默认映射 (常见代码)
  const defaults = getDefaultSymbols(q, market);
  for (const d of defaults) {
    if (!results.find(r => r.symbol === d.symbol)) {
      results.push(d);
    }
  }

  return results.slice(0, 20);
}

function detectMarket(query: string): string {
  if (/\.(HK|HKEX)$/i.test(query)) return 'hk';
  if (/\.(US|NYSE|NASDAQ)$/i.test(query)) return 'us';
  if (/USDT$|USDC$|BUSD$|PERP$/i.test(query)) return 'crypto';
  if (/^\d{5,6}$/.test(query)) return 'us'; // OTC BB
  if (/^[A-Z]+$/.test(query) && query.length <= 5) return 'us';
  if (/\/(USD|EUR|GBP|JPY)$/i.test(query)) return 'forex';
  return 'us';
}

function getDefaultSymbols(query: string, market: string): SearchResult[] {
  const defaults: Record<string, { n: string; m: string; t: SearchResult['type'] }> = {
    'BTC': { n: 'Bitcoin', m: 'crypto', t: 'crypto' },
    'ETH': { n: 'Ethereum', m: 'crypto', t: 'crypto' },
    'BNB': { n: 'BNB', m: 'crypto', t: 'crypto' },
    'SOL': { n: 'Solana', m: 'crypto', t: 'crypto' },
    '00700': { n: '腾讯控股', m: 'hk', t: 'stock' },
    '09988': { n: '阿里巴巴-SW', m: 'hk', t: 'stock' },
    'AAPL': { n: 'Apple Inc.', m: 'us', t: 'stock' },
    'TSLA': { n: 'Tesla Inc.', m: 'us', t: 'stock' },
    'MSFT': { n: 'Microsoft Corp.', m: 'us', t: 'stock' },
    'NVDA': { n: 'NVIDIA Corp.', m: 'us', t: 'stock' },
    'SPX': { n: 'S&P 500', m: 'us', t: 'index' },
    'NDX': { n: 'Nasdaq 100', m: 'us', t: 'index' },
  };

  const d = defaults[query];
  if (d) return [{ symbol: query, name: d.n, market: d.m, type: d.t, isWatched: false }];
  return [{ symbol: query, name: query, market, type: 'stock', isWatched: false }];
}

// ═══════════════════════════════════════════════════════════════════════
// CSV EXPORT (#45)
// ═══════════════════════════════════════════════════════════════════════

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    });
    lines.push(values.join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportKlineToCSV(bars: { time: number; open: number; high: number; low: number; close: number; volume: number }[], symbol: string): void {
  exportToCSV(
    bars.map(b => ({
      time: new Date(b.time).toISOString(),
      open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    })),
    `kline_${symbol}_${new Date().toISOString().slice(0, 10)}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MOBILE RESPONSIVE BREAKPOINTS (#46)
// ═══════════════════════════════════════════════════════════════════════

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
};

export function useResponsiveLayout() {
  if (typeof window === 'undefined') return { isMobile: false, isTablet: false, isDesktop: true };
  const w = window.innerWidth;
  return {
    isMobile: w < BREAKPOINTS.mobile,
    isTablet: w >= BREAKPOINTS.mobile && w < BREAKPOINTS.tablet,
    isDesktop: w >= BREAKPOINTS.tablet,
  };
}

/** 移动端面板自动折叠序号 */
export function getMobilePanelPriority(): string[] {
  return ['kline', 'depth', 'tick', 'indicator', 'drawing', 'alert', 'scanner'];
}
