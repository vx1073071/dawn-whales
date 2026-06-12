// ── DAWN WHALES — CodeNormalizer ───────────────────────────────────────
// R1 CONC-01: 统一代码映射器 + UnifiedCode映射表
// 职责: normalize(券商原生代码) → standardCode, denormalize(standardCode, brokerId) → 券商代码

import { log } from 'electron-log';
import type { BrokerType, MarketType } from '../broker/IBrokerAdapterV2';

/**
 * UnifiedCode format: "{market}:{standardSymbol}"
 * Examples:
 *   US:AAPL — US stock Apple
 *   HK:00700 — HK stock Tencent
 *   CRYPTO:BTC-USDT — Crypto BTC/USDT
 *   SG:D05 — Singapore DBS
 */
export type UnifiedCode = string;

export interface NormalizationResult {
  standardCode: UnifiedCode;
  originalCode: string;
  brokerId: string;
  brokerType: BrokerType;
  market: MarketType;
  raw: string;
  normalized: boolean;         // true if successfully mapped
  confidence: number;          // 0-1, quality of match
}

/**
 * Broker-specific code patterns for parsing.
 */
interface CodePattern {
  prefix: string;              // e.g. "US." for US stocks
  market: MarketType;
  extractPattern: RegExp;      // Extract symbol from broker-specific format
}

const BROKER_PATTERNS: Record<string, CodePattern[]> = {
  futu: [
    { prefix: 'US.', market: 'US', extractPattern: /^US\.(.+)/ },
    { prefix: 'HK.', market: 'HK', extractPattern: /^HK\.(.+)/ },
    { prefix: 'SH.', market: 'CN', extractPattern: /^SH\.(.+)/ },
    { prefix: 'SZ.', market: 'CN', extractPattern: /^SZ\.(.+)/ },
    { prefix: 'SG.', market: 'SG', extractPattern: /^SG\.(.+)/ },
  ],
  moomoo: [
    { prefix: 'US.', market: 'US', extractPattern: /^US\.(.+)/ },
    { prefix: 'HK.', market: 'HK', extractPattern: /^HK\.(.+)/ },
  ],
  ib: [
    { prefix: '', market: 'US', extractPattern: /^([A-Z]{1,5})$/ },       // AAPL → US
    { prefix: '', market: 'HK', extractPattern: /^(\d{5})$/ },            // 00700 → HK
    { prefix: '', market: 'CRYPTO', extractPattern: /^([A-Z]{2,5})\/([A-Z]{2,5})$/ },
  ],
  binance: [
    { prefix: '', market: 'CRYPTO', extractPattern: /^([A-Z0-9]{2,10})(USDT|BTC|ETH|BNB|BUSD|USDC)$/ },
  ],
  okx: [
    { prefix: '', market: 'CRYPTO', extractPattern: /^([A-Z0-9]{2,10})-([A-Z]{2,10})$/ },
  ],
  bybit: [
    { prefix: '', market: 'CRYPTO', extractPattern: /^([A-Z0-9]{2,10})(USDT|USDC)$/ },
  ],
  bitget: [
    { prefix: '', market: 'CRYPTO', extractPattern: /^([A-Z0-9]{2,10})(USDT)$/i },
  ],
};

/**
 * Symbol mappings for common assets across exchanges.
 * Key: UnifiedCode, Value: Record<BrokerType, broker-specific symbol>
 */
const UNIFIED_SYMBOLS: Record<string, Partial<Record<BrokerType, string>>> = {
  'US:AAPL': { futu: 'US.AAPL', moomoo: 'US.AAPL', ib: 'AAPL', tiger: 'AAPL' },
  'US:NVDA': { futu: 'US.NVDA', moomoo: 'US.NVDA', ib: 'NVDA', tiger: 'NVDA' },
  'US:TSLA': { futu: 'US.TSLA', moomoo: 'US.TSLA', ib: 'TSLA', tiger: 'TSLA' },
  'US:SPY': { futu: 'US.SPY', moomoo: 'US.SPY', ib: 'SPY', tiger: 'SPY' },
  'US:QQQ': { futu: 'US.QQQ', moomoo: 'US.QQQ', ib: 'QQQ', tiger: 'QQQ' },
  'HK:00700': { futu: 'HK.00700', moomoo: 'HK.00700', ib: '00700', tiger: '00700' },
  'HK:09988': { futu: 'HK.09988', moomoo: 'HK.09988', ib: '09988' },
  'CRYPTO:BTC-USDT': {
    binance: 'BTCUSDT', okx: 'BTC-USDT', bybit: 'BTCUSDT', bitget: 'BTCUSDT',
    ib: 'BTC/USD', robinhood: 'BTC-USD',
  },
  'CRYPTO:ETH-USDT': {
    binance: 'ETHUSDT', okx: 'ETH-USDT', bybit: 'ETHUSDT', bitget: 'ETHUSDT',
    ib: 'ETH/USD', robinhood: 'ETH-USD',
  },
  'CRYPTO:SOL-USDT': { binance: 'SOLUSDT', okx: 'SOL-USDT', bybit: 'SOLUSDT' },
  'CRYPTO:DOGE-USDT': { binance: 'DOGEUSDT', okx: 'DOGE-USDT', bybit: 'DOGEUSDT' },
};

export class CodeNormalizer {
  private customMappings = new Map<string, string>(); // original → UnifiedCode

  /**
   * Normalize broker-specific code to UnifiedCode.
   * Priority: customMappings > UNIFIED_SYMBOLS reverse > pattern matching
   */
  normalize(code: string, brokerId: string, brokerType: BrokerType): NormalizationResult {
    const baseResult: NormalizationResult = {
      standardCode: `UNKNOWN:${code}`,
      originalCode: code,
      brokerId,
      brokerType,
      market: 'US',
      raw: code,
      normalized: false,
      confidence: 0,
    };

    // 1. Check custom mappings
    const custom = this.customMappings.get(`${brokerType}:${code}`);
    if (custom) {
      return { ...baseResult, standardCode: custom, normalized: true, confidence: 1.0, market: this._extractMarket(custom) };
    }

    // 2. Check UNIFIED_SYMBOLS reverse lookup
    for (const [standardCode, mappings] of Object.entries(UNIFIED_SYMBOLS)) {
      if (mappings[brokerType] === code) {
        return { ...baseResult, standardCode, normalized: true, confidence: 1.0, market: this._extractMarket(standardCode) };
      }
    }

    // 3. Pattern matching
    const patterns = BROKER_PATTERNS[brokerType] || [];
    for (const pattern of patterns) {
      const match = code.match(pattern.extractPattern);
      if (match) {
        let symbol = match[1];
        // Crypto: Binance format is BTCUSDT → BTC-USDT
        if (pattern.market === 'CRYPTO') {
          if (match[2]) {
            symbol = `${match[1]}-${match[2]}`;
          } else {
            // Try to split known quote assets
            const quoteAssets = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC', 'BUSD', 'USD'];
            for (const qa of quoteAssets) {
              if (symbol.endsWith(qa) && symbol.length > qa.length) {
                symbol = `${symbol.slice(0, -qa.length)}-${qa}`;
                break;
              }
            }
          }
        }
        return {
          ...baseResult,
          standardCode: `${pattern.market}:${symbol}`,
          market: pattern.market,
          normalized: true,
          confidence: 0.8,
        };
      }
    }

    // 4. Heuristic: if starts with known market prefix
    const marketPrefixes: Record<string, MarketType> = { 'US.': 'US', 'HK.': 'HK', 'SH.': 'CN', 'SZ.': 'CN', 'SG.': 'SG', 'JP.': 'JP' };
    for (const [prefix, mkt] of Object.entries(marketPrefixes)) {
      if (code.startsWith(prefix)) {
        const symbol = code.slice(prefix.length);
        return { ...baseResult, standardCode: `${mkt}:${symbol}`, market: mkt, normalized: true, confidence: 0.6 };
      }
    }

    log.warn(`[CodeNormalizer] Could not normalize: ${code} (${brokerType})`);
    return baseResult;
  }

  /**
   * Convert UnifiedCode back to broker-specific code.
   */
  denormalize(standardCode: UnifiedCode, brokerType: BrokerType): string | null {
    // 1. Check UNIFIED_SYMBOLS
    const mappings = UNIFIED_SYMBOLS[standardCode];
    if (mappings?.[brokerType]) {
      return mappings[brokerType]!;
    }

    // 2. Custom mappings
    for (const [key, value] of this.customMappings) {
      if (value === standardCode && key.startsWith(brokerType + ':')) {
        return key.slice(brokerType.length + 1);
      }
    }

    // 3. Pattern-based reverse
    return this._denormalizeByPattern(standardCode, brokerType);
  }

  /**
   * Register a custom mapping.
   */
  registerMapping(brokerType: BrokerType, brokerCode: string, standardCode: UnifiedCode): void {
    this.customMappings.set(`${brokerType}:${brokerCode}`, standardCode);
    log.info(`[CodeNormalizer] Registered: ${brokerType}:${brokerCode} → ${standardCode}`);
  }

  /**
   * Batch normalize codes for QuoteAggregator.
   */
  normalizeBatch(codes: Array<{ code: string; brokerId: string; brokerType: BrokerType }>): NormalizationResult[] {
    return codes.map(c => this.normalize(c.code, c.brokerId, c.brokerType));
  }

  /**
   * Get all known UnifiedCodes that map to a specific broker.
   */
  getBrokerCodes(brokerType: BrokerType): Map<UnifiedCode, string> {
    const result = new Map<UnifiedCode, string>();
    for (const [standardCode, mappings] of Object.entries(UNIFIED_SYMBOLS)) {
      const brokerCode = mappings[brokerType];
      if (brokerCode) result.set(standardCode, brokerCode);
    }
    return result;
  }

  // ═══ Private ═══════════════════════════════════════════
  private _extractMarket(standardCode: string): MarketType {
    const colonIdx = standardCode.indexOf(':');
    if (colonIdx > 0) {
      const mkt = standardCode.slice(0, colonIdx);
      const validMarkets: MarketType[] = ['HK', 'US', 'CN', 'CRYPTO', 'SG', 'JP', 'UK', 'EU'];
      if (validMarkets.includes(mkt as MarketType)) return mkt as MarketType;
    }
    return 'US';
  }

  private _denormalizeByPattern(standardCode: UnifiedCode, brokerType: BrokerType): string | null {
    const colonIdx = standardCode.indexOf(':');
    if (colonIdx < 0) return null;
    const market = standardCode.slice(0, colonIdx);
    const symbol = standardCode.slice(colonIdx + 1);

    const patterns = BROKER_PATTERNS[brokerType] || [];
    for (const p of patterns) {
      if (p.market === market) {
        // Crypto normalization reversed
        if (market === 'CRYPTO') {
          // Remove the dash: BTC-USDT → BTCUSDT (Binance/Bybit/Bitget) or keep BTC-USDT (OKX)
          if (brokerType === 'okx') return symbol;
          return symbol.replace('-', '');
        }
        // Stock: add prefix
        if (p.prefix) return p.prefix + symbol;
        return symbol;
      }
    }

    return null;
  }
}
