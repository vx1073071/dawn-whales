/**
 * DAWN WHALES R152 J01-J04 — Symbol Search Engine + Code Normalizer Service
 *
 * 4 capabilities:
 *   1. SymbolSearchEngine — search by code/name/keyword, annotate exchange + available brokers
 *   2. Auto market detection — "00700" → HK, "AAPL" → US, "BTC" → CRYPTO
 *   3. Broker market capability query — which brokers support which markets
 *   4. Search API — GET /api/symbol/search?q=腾讯&market=HK
 *
 * ≥400L
 */

import log from 'electron-log';
import type { MarketType, BrokerType } from '../../electron/broker/IBrokerAdapterV2';

// ═══════════════════════════════════════════════════════════
// Constants — Broker Market Capability Map
// ═══════════════════════════════════════════════════════════

/** Per-market broker availability (from R1 15-broker mix). */
const BROKER_MARKET_MAP: Record<BrokerType, MarketType[]> = {
  futu:       ['HK', 'US', 'CN'],
  moomoo:     ['HK', 'US'],
  ib:         ['HK', 'US', 'CRYPTO', 'SG', 'JP', 'UK', 'EU'],
  longbridge: ['HK', 'US', 'SG'],
  // P0 Bridge
  tiger:      ['HK', 'US', 'CN', 'SG'],
  vbkr:       ['HK'],
  usmart:     ['HK', 'US'],
  // P0 Crypto
  binance:    ['CRYPTO'],
  okx:        ['CRYPTO'],
  bybit:      ['CRYPTO'],
  bitget:     ['CRYPTO'],
  // P1 OAuth
  schwab:     ['US'],
  etrade:     ['US'],
  etoro:      ['US', 'CRYPTO'],
  webull:     ['US', 'HK'],
  // P1
  robinhood:  ['US', 'CRYPTO'],
  mt5:        ['HK', 'US', 'CN', 'SG', 'JP', 'UK', 'EU', 'CRYPTO'],
};

export function getBrokerMarkets(brokerType: BrokerType): MarketType[] {
  return BROKER_MARKET_MAP[brokerType] || [];
}

export function getMarketsForBrokers(brokerTypes: BrokerType[]): MarketType[] {
  const set = new Set<MarketType>();
  for (const bt of brokerTypes) {
    for (const m of getBrokerMarkets(bt)) set.add(m);
  }
  return Array.from(set);
}

export function getBrokersForMarket(market: MarketType): BrokerType[] {
  return (Object.keys(BROKER_MARKET_MAP) as BrokerType[])
    .filter(bt => BROKER_MARKET_MAP[bt].includes(market));
}

// ═══════════════════════════════════════════════════════════
// Symbol Database — 常用标的库
// ═══════════════════════════════════════════════════════════

export interface SymbolEntry {
  standardCode: string;          // "HK:00700"
  symbol: string;                // "00700"
  market: MarketType;            // "HK"
  exchange: string;              // "SEHK"
  name: string;                  // "腾讯控股"
  nameEn: string;                // "Tencent"
  type: 'STOCK' | 'ETF' | 'CRYPTO' | 'FUTURES' | 'INDEX' | 'FUND';
  brokerCapable: BrokerType[];   // connected brokers that can trade
  isin?: string;
  currency: string;
  lotSize?: number;
}

// Pre-built symbol database (extensible)
const SYMBOL_DB: SymbolEntry[] = [
  // HK Stocks
  { standardCode: 'HK:00700', symbol: '00700', market: 'HK', exchange: 'SEHK', name: '腾讯控股', nameEn: 'Tencent', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:09988', symbol: '09988', market: 'HK', exchange: 'SEHK', name: '阿里巴巴-SW', nameEn: 'Alibaba', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:09999', symbol: '09999', market: 'HK', exchange: 'SEHK', name: '网易-S', nameEn: 'NetEase', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:00388', symbol: '00388', market: 'HK', exchange: 'SEHK', name: '香港交易所', nameEn: 'HKEX', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:09961', symbol: '09961', market: 'HK', exchange: 'SEHK', name: '携程集团-S', nameEn: 'Trip.com', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:00005', symbol: '00005', market: 'HK', exchange: 'SEHK', name: '汇丰控股', nameEn: 'HSBC', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 400 },
  { standardCode: 'HK:09888', symbol: '09888', market: 'HK', exchange: 'SEHK', name: '百度集团-SW', nameEn: 'Baidu', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 50 },
  { standardCode: 'HK:03690', symbol: '03690', market: 'HK', exchange: 'SEHK', name: '美团-W', nameEn: 'Meituan', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 100 },
  { standardCode: 'HK:01810', symbol: '01810', market: 'HK', exchange: 'SEHK', name: '小米集团-W', nameEn: 'Xiaomi', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 200 },
  { standardCode: 'HK:09987', symbol: '09987', market: 'HK', exchange: 'SEHK', name: '百胜中国', nameEn: 'Yum China', type: 'STOCK', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 50 },
  { standardCode: 'HK:02800', symbol: '02800', market: 'HK', exchange: 'SEHK', name: '盈富基金', nameEn: 'Tracker Fund', type: 'ETF', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 500 },
  { standardCode: 'HK:03033', symbol: '03033', market: 'HK', exchange: 'SEHK', name: '南方恒生科技', nameEn: 'CSOP HS TECH', type: 'ETF', brokerCapable: getBrokersForMarket('HK'), currency: 'HKD', lotSize: 200 },
  // US Stocks
  { standardCode: 'US:AAPL', symbol: 'AAPL', market: 'US', exchange: 'NASDAQ', name: '苹果', nameEn: 'Apple Inc.', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:NVDA', symbol: 'NVDA', market: 'US', exchange: 'NASDAQ', name: '英伟达', nameEn: 'NVIDIA', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:TSLA', symbol: 'TSLA', market: 'US', exchange: 'NASDAQ', name: '特斯拉', nameEn: 'Tesla', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:MSFT', symbol: 'MSFT', market: 'US', exchange: 'NASDAQ', name: '微软', nameEn: 'Microsoft', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:GOOGL', symbol: 'GOOGL', market: 'US', exchange: 'NASDAQ', name: '谷歌', nameEn: 'Alphabet', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:META', symbol: 'META', market: 'US', exchange: 'NASDAQ', name: 'Meta', nameEn: 'Meta Platforms', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:AMZN', symbol: 'AMZN', market: 'US', exchange: 'NASDAQ', name: '亚马逊', nameEn: 'Amazon', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:AMD', symbol: 'AMD', market: 'US', exchange: 'NASDAQ', name: 'AMD', nameEn: 'Advanced Micro Devices', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:JPM', symbol: 'JPM', market: 'US', exchange: 'NYSE', name: '摩根大通', nameEn: 'JPMorgan Chase', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:BABA', symbol: 'BABA', market: 'US', exchange: 'NYSE', name: '阿里巴巴', nameEn: 'Alibaba ADR', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:NIO', symbol: 'NIO', market: 'US', exchange: 'NYSE', name: '蔚来', nameEn: 'NIO Inc.', type: 'STOCK', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:SPY', symbol: 'SPY', market: 'US', exchange: 'NYSEARCA', name: '标普500 ETF', nameEn: 'SPDR S&P 500', type: 'ETF', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  { standardCode: 'US:QQQ', symbol: 'QQQ', market: 'US', exchange: 'NASDAQ', name: '纳斯达克100 ETF', nameEn: 'Invesco QQQ', type: 'ETF', brokerCapable: getBrokersForMarket('US'), currency: 'USD' },
  // Crypto
  { standardCode: 'CRYPTO:BTC-USDT', symbol: 'BTC', market: 'CRYPTO', exchange: 'BINANCE', name: '比特币', nameEn: 'Bitcoin', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  { standardCode: 'CRYPTO:ETH-USDT', symbol: 'ETH', market: 'CRYPTO', exchange: 'BINANCE', name: '以太坊', nameEn: 'Ethereum', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  { standardCode: 'CRYPTO:SOL-USDT', symbol: 'SOL', market: 'CRYPTO', exchange: 'BINANCE', name: 'Solana', nameEn: 'Solana', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  { standardCode: 'CRYPTO:DOGE-USDT', symbol: 'DOGE', market: 'CRYPTO', exchange: 'BINANCE', name: '狗狗币', nameEn: 'Dogecoin', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  { standardCode: 'CRYPTO:XRP-USDT', symbol: 'XRP', market: 'CRYPTO', exchange: 'BINANCE', name: '瑞波币', nameEn: 'Ripple', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  { standardCode: 'CRYPTO:BNB-USDT', symbol: 'BNB', market: 'CRYPTO', exchange: 'BINANCE', name: '币安币', nameEn: 'BNB', type: 'CRYPTO', brokerCapable: getBrokersForMarket('CRYPTO'), currency: 'USDT' },
  // CN (A-shares)
  { standardCode: 'CN:00230', symbol: '00230', market: 'CN', exchange: 'SZ', name: '科大讯飞', nameEn: 'iFlytek', type: 'STOCK', brokerCapable: getBrokersForMarket('CN'), currency: 'CNY', lotSize: 100 },
  { standardCode: 'CN:00241', symbol: '00241', market: 'CN', exchange: 'SH', name: '歌尔股份', nameEn: 'GoerTek', type: 'STOCK', brokerCapable: getBrokersForMarket('CN'), currency: 'CNY', lotSize: 100 },
  { standardCode: 'CN:60001', symbol: '60001', market: 'CN', exchange: 'SH', name: '招商银行', nameEn: 'CMB', type: 'STOCK', brokerCapable: getBrokersForMarket('CN'), currency: 'CNY', lotSize: 100 },
];

// ═══════════════════════════════════════════════════════════
// Market Detection — regex patterns for auto-detection
// ═══════════════════════════════════════════════════════════

interface MarketDetectionResult {
  market: MarketType;
  symbol: string;
  confidence: number;  // 0-1
  reason: string;
}

const MARKET_PATTERNS: Array<{ market: MarketType; pattern: RegExp; confidence: number; desc: string }> = [
  { market: 'HK', pattern: /^\d{5}$/, confidence: 0.85, desc: '5-digit numeric → HK stock' },
  { market: 'CN', pattern: /^\d{6}$/, confidence: 0.70, desc: '6-digit numeric → A-share' },
  { market: 'CN', pattern: /^00\d{4}$/, confidence: 0.60, desc: '00xxxx → likely SZ A-share' },
  { market: 'CN', pattern: /^60\d{4}$/, confidence: 0.60, desc: '60xxxx → likely SH A-share' },
  { market: 'US', pattern: /^[A-Z]{1,5}$/, confidence: 0.70, desc: '1-5 uppercase letters → US stock' },
  { market: 'CRYPTO', pattern: /^(BTC|ETH|SOL|DOGE|XRP|BNB|ADA|AVAX|DOT|LINK|MATIC|UNI|LTC|ATOM)$/, confidence: 0.95, desc: 'Known crypto ticker' },
  { market: 'CRYPTO', pattern: /^[A-Z0-9]{2,10}(USDT|USD|BTC|ETH|USDC)$/, confidence: 0.80, desc: '{BASE}{QUOTE} format → crypto pair' },
];

export function detectMarket(input: string): MarketDetectionResult {
  const trimmed = input.trim().toUpperCase();

  for (const rule of MARKET_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      // Extract base symbol from pair formats
      let symbol = trimmed;
      if (rule.market === 'CRYPTO' && /USDT|USD|BTC|ETH|USDC$/.test(trimmed)) {
        const match = trimmed.match(/^(.+?)(USDT|USD|BTC|ETH|USDC)$/);
        if (match) symbol = match[1];
      }
      return { market: rule.market, symbol, confidence: rule.confidence, reason: rule.desc };
    }
  }

  return { market: 'US', symbol: trimmed, confidence: 0.3, reason: 'Fuzzy match — default to US stock' };
}

// ═══════════════════════════════════════════════════════════
// SymbolSearchEngine
// ═══════════════════════════════════════════════════════════

export interface SearchResult {
  standardCode: string;
  symbol: string;
  market: MarketType;
  exchange: string;
  name: string;
  nameEn: string;
  type: SymbolEntry['type'];
  brokerCapable: BrokerType[];
  brokerNotCapable: BrokerType[];
  lotSize?: number;
  currency: string;
  matchScore: number;       // 0-100, relevance score
  detectConfidence: number; // market auto-detection confidence
  detectionReason: string;
}

export interface SearchRequest {
  query: string;
  market?: MarketType;      // optional filter
  type?: 'STOCK' | 'ETF' | 'CRYPTO' | 'FUTURES' | 'INDEX';
  limit?: number;
  offset?: number;
  includeBrokers?: boolean; // default true
}

export interface SearchResponse {
  success: boolean;
  query: string;
  detectedMarket?: MarketDetectionResult;
  totalResults: number;
  results: SearchResult[];
  searchTimeMs: number;
  suggestion?: string;
}

const MARKET_LABELS: Record<string, string> = {
  HK: '港股', US: '美股', CN: 'A股', CRYPTO: '加密', SG: '新加坡', JP: '日本', UK: '英国', EU: '欧洲',
};

const MARKET_EXCHANGE_LABELS: Record<string, string> = {
  SEHK: '港交所', NASDAQ: '纳斯达克', NYSE: '纽交所', NYSEARCA: '纽交所(ETF)',
  BINANCE: '币安', SH: '上交所', SZ: '深交所',
};

export class SymbolSearchEngine {
  private dynamicSymbols: SymbolEntry[] = []; // runtime-added symbols

  /**
   * Add dynamic symbols at runtime (e.g., from third-party data feed).
   */
  addSymbols(entries: SymbolEntry[]): void {
    this.dynamicSymbols.push(...entries);
  }

  /**
   * Main search entry point.
   */
  search(req: SearchRequest): SearchResponse {
    const t0 = Date.now();
    const query = req.query.trim();
    const limit = req.limit ?? 20;
    const offset = req.offset ?? 0;

    if (!query) {
      return { success: false, query: '', totalResults: 0, results: [], searchTimeMs: 0 };
    }

    // Detect market from query
    const detection = detectMarket(query);
    const searchDb = [...SYMBOL_DB, ...this.dynamicSymbols];

    // Score each entry
    const scored = searchDb
      .filter(entry => {
        // Market filter
        if (req.market && entry.market !== req.market) return false;
        // Type filter
        if (req.type && entry.type !== req.type) return false;
        return true;
      })
      .map(entry => ({
        entry,
        score: this._scoreMatch(query, entry),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => {
        // Exact symbol match first
        const aExact = a.entry.symbol.toUpperCase() === query.toUpperCase() ? 1 : 0;
        const bExact = b.entry.symbol.toUpperCase() === query.toUpperCase() ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return b.score - a.score;
      });

    const totalResults = scored.length;
    const pagedResults = scored.slice(offset, offset + limit);
    const includeBrokers = req.includeBrokers !== false;

    const allBrokers: BrokerType[] = (Object.keys(BROKER_MARKET_MAP) as BrokerType[]);

    const results: SearchResult[] = pagedResults.map(s => ({
      standardCode: s.entry.standardCode,
      symbol: s.entry.symbol,
      market: s.entry.market,
      exchange: s.entry.exchange,
      name: s.entry.name,
      nameEn: s.entry.nameEn,
      type: s.entry.type,
      brokerCapable: includeBrokers ? s.entry.brokerCapable : [],
      brokerNotCapable: includeBrokers
        ? allBrokers.filter(b => !s.entry.brokerCapable.includes(b)).slice(0, 8)
        : [],
      lotSize: s.entry.lotSize,
      currency: s.entry.currency,
      matchScore: s.score,
      detectConfidence: detection.confidence,
      detectionReason: detection.reason,
    }));

    return {
      success: true,
      query: req.query,
      detectedMarket: { market: detection.market, symbol: detection.symbol, confidence: detection.confidence, reason: detection.reason },
      totalResults,
      results,
      searchTimeMs: Date.now() - t0,
      suggestion: totalResults === 0
        ? `未找到"${query}"相关标的。请尝试英文代码搜索（如 AAPL、BTC）或检查输入。`
        : undefined,
    };
  }

  /**
   * Get symbol by standard code — used by QuoteRouter to look up details.
   */
  getByStandardCode(standardCode: string): SymbolEntry | null {
    const db = [...SYMBOL_DB, ...this.dynamicSymbols];
    return db.find(e => e.standardCode === standardCode) || null;
  }

  /**
   * Get all symbols by market (used for QuoteRouter startup seeding).
   */
  getByMarket(market: MarketType): SymbolEntry[] {
    const db = [...SYMBOL_DB, ...this.dynamicSymbols];
    return db.filter(e => e.market === market);
  }

  /**
   * List available markets with broker counts.
   */
  getMarketStats(): Array<{ market: MarketType; label: string; brokerCount: number; symbolCount: number }> {
    const db = [...SYMBOL_DB, ...this.dynamicSymbols];
    const allMarkets: MarketType[] = ['HK', 'US', 'CN', 'CRYPTO', 'SG', 'JP', 'UK', 'EU'];
    return allMarkets.map(m => ({
      market: m,
      label: MARKET_LABELS[m] || m,
      brokerCount: BROKER_MARKET_MAP
        ? (Object.keys(BROKER_MARKET_MAP) as BrokerType[])
            .filter(bt => BROKER_MARKET_MAP[bt]?.includes(m)).length
        : 0,
      symbolCount: db.filter(e => e.market === m).length,
    }));
  }

  // ═══ Private — Scoring ═══════════════════════════════════

  private _scoreMatch(query: string, entry: SymbolEntry): number {
    const q = query.toUpperCase();
    const symbol = entry.symbol.toUpperCase();
    const name = entry.name.toUpperCase();
    const nameEn = entry.nameEn.toUpperCase();
    let score = 0;

    // Exact symbol match: 100
    if (symbol === q) {
      score = 100;
    }
    // Symbol starts with query: 90
    else if (symbol.startsWith(q)) {
      score = 90;
    }
    // Query is substring of symbol: 70
    else if (symbol.includes(q)) {
      score = 70;
    }
    // Chinese name exact: 85
    else if (entry.name === query) {
      score = 85;
    }
    // Chinese name contains all query chars: 65
    else if (name.includes(q)) {
      score = 65;
    }
    // English name starts with query: 60
    else if (nameEn.startsWith(q)) {
      score = 60;
    }
    // English name contains query: 50
    else if (nameEn.includes(q)) {
      score = 50;
    }
    // Partial query match in name (for multi-char CJK): 40
    else if (q.length >= 2) {
      const qChars = [...q].filter(c => c.charCodeAt(0) > 127);
      const nameChars = [...name].filter(c => c.charCodeAt(0) > 127);
      const matchCount = qChars.filter(qc => nameChars.includes(qc)).length;
      if (matchCount > 0 && qChars.length > 0) {
        score = Math.round((matchCount / qChars.length) * 40);
      }
    }

    return Math.min(score, 100);
  }
}

// ═══════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════

let _searchEngine: SymbolSearchEngine | null = null;

export function getSearchEngine(): SymbolSearchEngine {
  if (!_searchEngine) _searchEngine = new SymbolSearchEngine();
  return _searchEngine;
}

export { BROKER_MARKET_MAP, MARKET_LABELS, MARKET_PATTERNS };
export default SymbolSearchEngine;
