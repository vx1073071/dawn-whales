/**
 * stock-code-normalizer.ts — R100 J-01 Stock Code Normalization Engine
 *
 * Recognizes exchange prefixes, normalizes codes to {market, ticker, display},
 * supports fuzzy matching for ambiguous codes, and formats display per locale.
 *
 * Supported markets: US, CN (SH/SZ), HK, JP, UK, EU, KR, CRYPTO
 */

/** Standard market identifier */
export type MarketCode = 'US' | 'CN' | 'HK' | 'JP' | 'UK' | 'EU' | 'KR' | 'CRYPTO';

/** Supported display locales */
export type DisplayLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru' | 'it' | 'pt';

/** Normalized stock code result */
export interface NormalizedCode {
  /** Original input */
  raw: string;
  /** Identified market */
  market: MarketCode;
  /** Clean ticker (no prefix/suffix) */
  ticker: string;
  /** Formatted display code */
  display: string;
  /** Confidence: 'exact' = prefix match, 'fuzzy' = heuristic match */
  confidence: 'exact' | 'fuzzy';
  /** Normalized ISO-style code: MARKET:TICKER */
  iso: string;
}

/** Exchange prefix definitions */
interface ExchangePrefix {
  market: MarketCode;
  prefixes: string[];
  /** Ticker regex pattern */
  tickerPattern: RegExp;
  /** Whether ticker is numeric-only */
  isNumeric?: boolean;
}

const EXCHANGE_PREFIXES: ExchangePrefix[] = [
  // US: no prefix, uppercase tickers 1-5 chars
  { market: 'US', prefixes: [], tickerPattern: /^[A-Z]{1,5}$/ },
  // CN: SH/SZ + 6 digits
  { market: 'CN', prefixes: ['SH', 'SZ', 'SH.', 'SZ.'], tickerPattern: /^\d{6}$/, isNumeric: true },
  // HK: 0 + 4-5 digits, or just 4-5 digits
  { market: 'HK', prefixes: ['HK.'], tickerPattern: /^\d{4,5}$/, isNumeric: true },
  // JP: T suffix or just 4 digits
  { market: 'JP', prefixes: ['TSE.', 'T.'], tickerPattern: /^\d{4}$/, isNumeric: true },
  // UK: L suffix
  { market: 'UK', prefixes: ['LSE.', 'L.', 'LON:'], tickerPattern: /^[A-Z]{2,5}$/ },
  // EU: PA suffix (Euronext Paris), various exchanges
  { market: 'EU', prefixes: ['EPA:', 'EPA.', 'ENX:', 'AMS:', 'MIL:'], tickerPattern: /^[A-Z]{2,5}$/ },
  // KR: 6 digits
  { market: 'KR', prefixes: ['KRX:', 'KRX.'], tickerPattern: /^\d{6}$/, isNumeric: true },
];

/** Fuzzy match heuristics for ambiguous codes */
interface FuzzyRule {
  market: MarketCode;
  pattern: RegExp;
  description: string;
}

const FUZZY_RULES: FuzzyRule[] = [
  // 6-digit numeric codes → CN most likely (SH/SZ)
  { market: 'CN', pattern: /^[0-9]{6}$/, description: '6-digit numeric → CN (SH/SZ)' },
  // 5-digit numeric → HK likely
  { market: 'HK', pattern: /^[0-9]{5}$/, description: '5-digit numeric → HK' },
  // 4-digit numeric → JP if starts with 0-9 range, else HK
  { market: 'JP', pattern: /^[0-4]\d{3}$/, description: '4-digit numeric starting 0-4 → JP' },
  { market: 'HK', pattern: /^[5-9]\d{3}$/, description: '4-digit numeric starting 5-9 → HK' },
  // Korean specific: 005930 → KR (Samsung)
  { market: 'KR', pattern: /^00[0-9]{4}$/, description: '00xxxx numeric → KR' },
  // Pure uppercase letters → US
  { market: 'US', pattern: /^[A-Z]{1,5}$/, description: '1-5 uppercase letters → US' },
  // UK stock codes (LON suffix)
  { market: 'UK', pattern: /^[A-Z]{2,4}\.L$/, description: 'xxx.L format → UK' },
  // Code with JP suffix
  { market: 'JP', pattern: /^\d{4}\.T$/, description: '4-digit.T format → JP' },
];

/** Market display names by locale — externalized to market-names.json */
import marketNamesData from './market-names.json';

const MARKET_NAMES: Record<MarketCode, Record<string, string>> = marketNamesData;

/** Market prefix for ISO code */
const MARKET_ISO_PREFIX: Record<MarketCode, string> = {
  US: 'US',
  CN: 'CN',
  HK: 'HK',
  JP: 'JP',
  UK: 'UK',
  EU: 'EU',
  KR: 'KR',
  CRYPTO: 'CRYPTO',
};

export class StockCodeNormalizer {
  /**
   * Normalize a raw stock code string into a structured result.
   *
   * Steps:
   * 1. Trim and uppercase input
   * 2. Check known prefixes (exact match)
   * 3. Match ticker pattern
   * 4. Fall back to fuzzy heuristics
   */
  normalize(raw: string): NormalizedCode {
    const trimmed = raw.trim().toUpperCase();

    // Step 1: Check exact prefix matches
    const exactResult = this.tryExactMatch(trimmed);
    if (exactResult) return exactResult;

    // Step 2: Try pure ticker pattern match
    const tickerResult = this.tryTickerMatch(trimmed);
    if (tickerResult) return tickerResult;

    // Step 3: Fuzzy heuristic fallback
    const fuzzyResult = this.tryFuzzyMatch(trimmed);
    if (fuzzyResult) return fuzzyResult;

    // Step 4: Best-guess fallback: treat as raw US ticker
    return this.buildResult(trimmed, 'US', trimmed, 'fuzzy');
  }

  /**
   * Format a stock code for display in a given locale.
   * Example: normalize('AAPL') → formatDisplay('AAPL', 'zh-CN') → '美股 AAPL'
   */
  formatDisplay(raw: string, locale?: DisplayLocale): string {
    const normalized = this.normalize(raw);
    const loc = locale || 'en';
    return `${normalized.ticker} (${normalized.market})`;
  }

  /**
   * Get market name in a given locale.
   */
  getMarketName(market: MarketCode, locale?: DisplayLocale): string {
    const loc = locale || 'en';
    return MARKET_NAMES[market]?.[loc] ?? market;
  }

  /**
   * Check if a code is valid for a given market.
   */
  isValidForMarket(raw: string, expectedMarket: MarketCode): boolean {
    const result = this.normalize(raw);
    return result.market === expectedMarket;
  }

  /**
   * Normalize to ISO-style code: MARKET:TICKER
   */
  toISO(raw: string): string {
    return this.normalize(raw).iso;
  }

  /**
   * Extract just the ticker from a raw code.
   */
  getTicker(raw: string): string {
    return this.normalize(raw).ticker;
  }

  /**
   * Get the market from a raw code.
   */
  getMarket(raw: string): MarketCode {
    return this.normalize(raw).market;
  }

  /**
   * Batch normalize multiple codes.
   */
  normalizeBatch(codes: string[]): NormalizedCode[] {
    return codes.map(c => this.normalize(c));
  }

  // ─────── Private helpers ───────

  private tryExactMatch(input: string): NormalizedCode | null {
    // Check for .L / .T suffixed codes first (exact format match)
    if (/^[A-Z]{2,4}\.L$/.test(input)) {
      const ticker = input.slice(0, -2);
      return this.buildResult(input, 'UK', ticker, 'exact');
    }
    if (/^\d{4}\.T$/.test(input)) {
      const ticker = input.slice(0, -2);
      return this.buildResult(input, 'JP', ticker, 'exact');
    }

    // Check exchange prefixes (e.g., SH600000, HK.0700)
    for (const xch of EXCHANGE_PREFIXES) {
      for (const prefix of xch.prefixes) {
        if (input.startsWith(prefix)) {
          const ticker = input.slice(prefix.length);
          if (xch.tickerPattern.test(ticker)) {
            return this.buildResult(input, xch.market, ticker, 'exact');
          }
        }
      }
    }

    return null;
  }

  private tryTickerMatch(input: string): NormalizedCode | null {
    // US: pure uppercase ticker
    if (/^[A-Z]{1,5}$/.test(input)) {
      return this.buildResult(input, 'US', input, 'exact');
    }

    // 6-digit numeric: 005xxx → KR, others → CN
    if (/^\d{6}$/.test(input)) {
      if (input.startsWith('005')) {
        return this.buildResult(input, 'KR', input, 'exact');
      }
      return this.buildResult(input, 'CN', input, 'exact');
    }

    // HK: 5-digit numeric (always HK)
    if (/^\d{5}$/.test(input)) {
      return this.buildResult(input, 'HK', input, 'exact');
    }

    // 4-digit numeric: 0xxx → HK, others → JP
    if (/^\d{4}$/.test(input)) {
      if (input.startsWith('0')) {
        return this.buildResult(input, 'HK', input, 'exact');
      }
      // 1xxx-4xxx → JP, 5xxx-9xxx → HK
      const first = parseInt(input[0]);
      if (first >= 1 && first <= 4) {
        return this.buildResult(input, 'JP', input, 'exact');
      }
      return this.buildResult(input, 'HK', input, 'exact');
    }

    return null;
  }

  private tryFuzzyMatch(input: string): NormalizedCode | null {
    for (const rule of FUZZY_RULES) {
      if (rule.pattern.test(input)) {
        const ticker = this.extractTicker(input, rule.market);
        return this.buildResult(input, rule.market, ticker, 'fuzzy');
      }
    }
    return null;
  }

  private extractTicker(input: string, market: MarketCode): string {
    // Remove known patterns
    for (const xch of EXCHANGE_PREFIXES) {
      for (const prefix of xch.prefixes) {
        if (input.startsWith(prefix)) {
          return input.slice(prefix.length);
        }
      }
    }
    // Remove .L / .T suffixes
    return input.replace(/\.(L|T)$/, '');
  }

  private buildResult(
    raw: string,
    market: MarketCode,
    ticker: string,
    confidence: 'exact' | 'fuzzy'
  ): NormalizedCode {
    const iso = `${MARKET_ISO_PREFIX[market]}:${ticker}`;
    return {
      raw,
      market,
      ticker,
      display: `${market}:${ticker}`,
      confidence,
      iso,
    };
  }
}

/** Singleton instance */
let _normalizer: StockCodeNormalizer | null = null;

export function getStockCodeNormalizer(): StockCodeNormalizer {
  if (!_normalizer) {
    _normalizer = new StockCodeNormalizer();
  }
  return _normalizer;
}

export const stockCodeNormalizer = getStockCodeNormalizer();

/** Standalone functions for quick use */
export function normalizeCode(code: string): NormalizedCode {
  return stockCodeNormalizer.normalize(code);
}

export function formatCodeDisplay(code: string, locale?: DisplayLocale): string {
  return stockCodeNormalizer.formatDisplay(code, locale);
}

export function getMarketName(code: string, locale?: DisplayLocale): string {
  const normalized = stockCodeNormalizer.normalize(code);
  return stockCodeNormalizer.getMarketName(normalized.market, locale);
}
