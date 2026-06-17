/**
 * R273 多币种汇率数据源 v5.0
 * 
 * 24 currency pairs + multi-currency quoting:
 *   主要货币 (USD/EUR/JPY/GBP/CHF/AUD/CAD/NZD)
 *   亚洲货币 (CNY/HKD/SGD/KRW/TWD/INR/THB/MYR/IDR/PHP/VND)
 *   新兴市场 (BRL/MXN/ZAR/RUB/TRY)
 *   Crypto报价 (BTC/ETH跨币种)
 *   实时汇率 + 历史 + 波动统计
 *   三角套利检测 (triangular arbitrage)
 *   相关性矩阵
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type CurrencyCode =
  | 'USD' | 'EUR' | 'JPY' | 'GBP' | 'CHF' | 'AUD' | 'CAD' | 'NZD'
  | 'CNY' | 'CNH' | 'HKD' | 'SGD' | 'KRW' | 'TWD' | 'INR' | 'THB'
  | 'MYR' | 'IDR' | 'PHP' | 'VND'
  | 'BRL' | 'MXN' | 'ZAR' | 'RUB' | 'TRY'
  | 'BTC' | 'ETH';

export interface FxRate {
  base: CurrencyCode;
  quote: CurrencyCode;
  pair: string;               // e.g. 'USD/JPY'
  rate: number;               // amount of quote per 1 base
  bid: number;
  ask: number;
  spread: number;             // ask - bid
  spreadPercent: number;      // (spread / rate) × 100
  change: number;             // vs prev close
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  timestamp: number;
}

export interface FxRateHistory {
  pair: string;
  points: Array<{ timestamp: number; rate: number; bid: number; ask: number }>;
}

export interface FxConversion {
  from: CurrencyCode;
  to: CurrencyCode;
  fromAmount: number;
  toAmount: number;
  rate: number;
  spread: number;
  effectiveRate: number;
  fee: number;
  timestamp: number;
}

export interface FxVolatility {
  pair: string;
  daily: number;          // %
  weekly: number;
  monthly: number;
  annualized: number;     // daily × sqrt(252)
  atr20: number;          // 20-period ATR
}

export interface TriangularArb {
  legs: [string, string, string];   // e.g. ['USD/JPY', 'JPY/EUR', 'EUR/USD']
  impliedRate: number;
  actualRate: number;
  deviation: number;       // basis points
  profitable: boolean;
  profitBps: number;       // profit in basis points
  timestamp: number;
}

export interface FxCorrelation {
  pair1: string;
  pair2: string;
  correlation: number;     // Pearson over 30 days
  strength: 'strong_positive' | 'weak_positive' | 'neutral' | 'weak_negative' | 'strong_negative';
}

export interface FxSnapshot {
  timestamp: number;
  rates: FxRate[];
  usdIndex: number;        // DXY-style index
  strongest: { currency: CurrencyCode; change: number };
  weakest: { currency: CurrencyCode; change: number };
}

// ── Currency metadata ──────────────────────────────────────────────────────

const CURRENCY_META: Record<CurrencyCode, { name: string; nameCn: string; symbol: string; region: string }> = {
  USD: { name: 'US Dollar', nameCn: '美元', symbol: '$', region: 'Americas' },
  EUR: { name: 'Euro', nameCn: '欧元', symbol: '€', region: 'Europe' },
  JPY: { name: 'Japanese Yen', nameCn: '日元', symbol: '¥', region: 'Asia' },
  GBP: { name: 'British Pound', nameCn: '英镑', symbol: '£', region: 'Europe' },
  CHF: { name: 'Swiss Franc', nameCn: '瑞郎', symbol: 'Fr', region: 'Europe' },
  AUD: { name: 'Australian Dollar', nameCn: '澳元', symbol: 'A$', region: 'Oceania' },
  CAD: { name: 'Canadian Dollar', nameCn: '加元', symbol: 'C$', region: 'Americas' },
  NZD: { name: 'NZ Dollar', nameCn: '纽元', symbol: 'NZ$', region: 'Oceania' },
  CNY: { name: 'Chinese Yuan', nameCn: '人民币', symbol: '¥', region: 'Asia' },
  CNH: { name: 'Offshore Yuan', nameCn: '离岸人民币', symbol: '¥', region: 'Asia' },
  HKD: { name: 'Hong Kong Dollar', nameCn: '港元', symbol: 'HK$', region: 'Asia' },
  SGD: { name: 'Singapore Dollar', nameCn: '新加坡元', symbol: 'S$', region: 'Asia' },
  KRW: { name: 'Korean Won', nameCn: '韩元', symbol: '₩', region: 'Asia' },
  TWD: { name: 'Taiwan Dollar', nameCn: '新台币', symbol: 'NT$', region: 'Asia' },
  INR: { name: 'Indian Rupee', nameCn: '印度卢比', symbol: '₹', region: 'Asia' },
  THB: { name: 'Thai Baht', nameCn: '泰铢', symbol: '฿', region: 'Asia' },
  MYR: { name: 'Malaysian Ringgit', nameCn: '马来西亚令吉', symbol: 'RM', region: 'Asia' },
  IDR: { name: 'Indonesian Rupiah', nameCn: '印尼盾', symbol: 'Rp', region: 'Asia' },
  PHP: { name: 'Philippine Peso', nameCn: '菲律宾比索', symbol: '₱', region: 'Asia' },
  VND: { name: 'Vietnamese Dong', nameCn: '越南盾', symbol: '₫', region: 'Asia' },
  BRL: { name: 'Brazilian Real', nameCn: '巴西雷亚尔', symbol: 'R$', region: 'Americas' },
  MXN: { name: 'Mexican Peso', nameCn: '墨西哥比索', symbol: 'Mex$', region: 'Americas' },
  ZAR: { name: 'South African Rand', nameCn: '南非兰特', symbol: 'R', region: 'Africa' },
  RUB: { name: 'Russian Ruble', nameCn: '俄罗斯卢布', symbol: '₽', region: 'Europe' },
  TRY: { name: 'Turkish Lira', nameCn: '土耳其里拉', symbol: '₺', region: 'Europe' },
  BTC: { name: 'Bitcoin', nameCn: '比特币', symbol: '₿', region: 'Crypto' },
  ETH: { name: 'Ethereum', nameCn: '以太坊', symbol: 'Ξ', region: 'Crypto' },
};

// ── FX Data Source ─────────────────────────────────────────────────────────

export class FxDataSource extends EventEmitter {
  private rates_: Map<string, FxRate> = new Map();          // pair → latest
  private history_: Map<string, FxRateHistory> = new Map(); // pair → history
  private readonly MAX_HISTORY = 500;

  // Standard pairs to track
  private readonly PAIRS = [
    'EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
    'USD/CNY', 'USD/CNH', 'USD/HKD', 'USD/SGD', 'USD/KRW', 'USD/TWD', 'USD/INR',
    'USD/THB', 'USD/MYR', 'USD/IDR', 'USD/PHP', 'USD/VND',
    'USD/BRL', 'USD/MXN', 'USD/ZAR', 'USD/RUB', 'USD/TRY',
    'BTC/USD', 'ETH/USD',
  ];

  // ── Ingestion ──────────────────────────────────────────────────────────

  /** Ingest a single FX rate tick */
  ingestRate(rate: Omit<FxRate, 'pair' | 'spread' | 'spreadPercent'> & { base: CurrencyCode; quote: CurrencyCode }): FxRate {
    const pair = `${rate.base}/${rate.quote}`;
    const spread = rate.ask - rate.bid;
    const full: FxRate = {
      ...rate, pair,
      spread,
      spreadPercent: rate.rate > 0 ? (spread / rate.rate) * 100 : 0,
    };

    this.rates_.set(pair, full);

    // Append to history
    if (!this.history_.has(pair)) this.history_.set(pair, { pair, points: [] });
    const hist = this.history_.get(pair)!;
    hist.points.push({ timestamp: full.timestamp, rate: full.rate, bid: full.bid, ask: full.ask });
    if (hist.points.length > this.MAX_HISTORY) hist.points.shift();

    this.emit('fx_tick', full);
    return full;
  }

  /** Bulk ingest a snapshot */
  ingestSnapshot(rates: Array<Omit<FxRate, 'pair' | 'spread' | 'spreadPercent'> & { base: CurrencyCode; quote: CurrencyCode }>): FxRate[] {
    return rates.map(r => this.ingestRate(r));
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getRate(pair: string): FxRate | undefined {
    // Try both directions
    const direct = this.rates_.get(pair);
    if (direct) return direct;

    // Try inverse
    const [base, quote] = pair.split('/');
    const inverse = this.rates_.get(`${quote}/${base}`);
    if (inverse) {
      return {
        ...inverse,
        pair,
        base: base as CurrencyCode,
        quote: quote as CurrencyCode,
        rate: 1 / inverse.rate,
        bid: 1 / inverse.ask,
        ask: 1 / inverse.bid,
        spread: (1 / inverse.bid) - (1 / inverse.ask),
        spreadPercent: inverse.rate > 0 ? ((1/inverse.bid - 1/inverse.ask) / (1/inverse.rate)) * 100 : 0,
      };
    }

    // Cross via USD
    const baseUsd = this.rates_.get(`USD/${base}`);
    const usdQuote = this.rates_.get(`USD/${quote}`);
    if (baseUsd && usdQuote) {
      const synthetic = (1 / baseUsd.rate) * usdQuote.rate;
      return {
        pair, base: base as CurrencyCode, quote: quote as CurrencyCode,
        rate: synthetic,
        bid: synthetic * 0.9998, ask: synthetic * 1.0002,
        spread: synthetic * 0.0004,
        spreadPercent: 0.04,
        change: 0, changePercent: 0,
        open: synthetic, high: synthetic, low: synthetic, prevClose: synthetic,
        timestamp: Date.now(),
      };
    }

    return undefined;
  }

  getAllRates(): FxRate[] {
    return Array.from(this.rates_.values());
  }

  getSnapshot(): FxSnapshot {
    const rates = this.getAllRates();
    // USD Index-style calculation (simple weighted average of major pairs)
    const majorWeights: Record<string, number> = {
      'EUR/USD': 0.576, 'USD/JPY': 0.136, 'GBP/USD': 0.119,
      'USD/CAD': 0.091, 'USD/CHF': 0.036, 'AUD/USD': 0.036, 'NZD/USD': 0.006,
    };
    let usdIndexWeight = 0;
    let usdIndexDiv = 0;
    for (const [pair, weight] of Object.entries(majorWeights)) {
      const rate = this.rates_.get(pair);
      if (rate) {
        const contribution = pair.endsWith('/USD') ? rate.rate : 1 / rate.rate;
        usdIndexWeight += contribution * weight;
        usdIndexDiv += weight;
      }
    }
    const usdIndex = usdIndexDiv > 0 ? usdIndexWeight / usdIndexDiv : 1;

    const sorted = [...rates].sort((a, b) => b.changePercent - a.changePercent);
    const strongest = sorted.length > 0 ? { currency: sorted[0].base, change: sorted[0].changePercent } : { currency: 'USD' as CurrencyCode, change: 0 };
    const weakest = sorted.length > 0 ? { currency: sorted[sorted.length - 1].base, change: sorted[sorted.length - 1].changePercent } : { currency: 'USD' as CurrencyCode, change: 0 };

    return { timestamp: Date.now(), rates, usdIndex, strongest, weakest };
  }

  getHistory(pair: string, limit = 100): FxRateHistory | undefined {
    const hist = this.history_.get(pair);
    if (!hist) return undefined;
    return { pair: hist.pair, points: hist.points.slice(-limit) };
  }

  // ── Conversion ─────────────────────────────────────────────────────────

  convert(from: CurrencyCode, to: CurrencyCode, amount: number): FxConversion | null {
    const pair = `${from}/${to}`;
    const rate = this.getRate(pair);
    if (!rate) return null;

    const fee = amount * 0.0005; // 0.05% fee
    return {
      from, to, fromAmount: amount,
      toAmount: (amount - fee) * rate.rate,
      rate: rate.rate, spread: rate.spread,
      effectiveRate: rate.rate * (1 - 0.0005),
      fee, timestamp: Date.now(),
    };
  }

  // ── Volatility ─────────────────────────────────────────────────────────

  getVolatility(pair: string): FxVolatility | null {
    const hist = this.history_.get(pair);
    if (!hist || hist.points.length < 20) return null;

    const points = hist.points;
    const returns: number[] = [];
    for (let i = 1; i < points.length; i++) {
      returns.push(Math.log(points[i].rate / points[i - 1].rate));
    }

    const stdDev = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length);
    const daily = stdDev * 100;
    const weekly = daily * Math.sqrt(5);
    const monthly = daily * Math.sqrt(21);
    const annualized = daily * Math.sqrt(252);

    // ATR-20
    const highs = points.slice(-20).map(p => p.rate);
    const lows = points.slice(-20).map(p => p.rate);
    let atr20 = 0;
    for (let i = 1; i < highs.length; i++) {
      atr20 += Math.abs(highs[i] - lows[i - 1]);
    }
    atr20 /= highs.length;

    return { pair, daily, weekly, monthly, annualized, atr20 };
  }

  getAllVolatilities(): FxVolatility[] {
    return this.PAIRS.map(p => this.getVolatility(p)).filter(Boolean) as FxVolatility[];
  }

  // ── Triangular Arbitrage ───────────────────────────────────────────────

  detectArbitrage(): TriangularArb[] {
    const results: TriangularArb[] = [];
    const currencies = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD'] as CurrencyCode[];

    for (let i = 0; i < currencies.length; i++) {
      for (let j = 0; j < currencies.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < currencies.length; k++) {
          if (k === i || k === j) continue;

          const pair1 = `${currencies[i]}/${currencies[j]}`;
          const pair2 = `${currencies[j]}/${currencies[k]}`;
          const pair3 = `${currencies[k]}/${currencies[i]}`;

          const r1 = this.getRate(pair1);
          const r2 = this.getRate(pair2);
          const r3 = this.getRate(pair3);

          if (r1 && r2 && r3) {
            const impliedRate = r1.rate * r2.rate * r3.rate;
            const deviation = (impliedRate - 1) * 10000; // basis points
            const profitable = deviation > 1 || deviation < -1; // > 1bp after costs
            results.push({
              legs: [pair1, pair2, pair3],
              impliedRate,
              actualRate: 1,
              deviation,
              profitable,
              profitBps: Math.abs(deviation),
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.profitBps - a.profitBps).slice(0, 20);
  }

  // ── Correlation Matrix ─────────────────────────────────────────────────

  getCorrelationMatrix(pairs?: string[]): FxCorrelation[] {
    const targetPairs = pairs || this.PAIRS.slice(0, 10);
    const results: FxCorrelation[] = [];

    for (let i = 0; i < targetPairs.length; i++) {
      for (let j = i + 1; j < targetPairs.length; j++) {
        const h1 = this.history_.get(targetPairs[i]);
        const h2 = this.history_.get(targetPairs[j]);
        if (!h1 || !h2 || h1.points.length < 10 || h2.points.length < 10) continue;

        const n = Math.min(h1.points.length, h2.points.length);
        const r1 = h1.points.slice(-n).map(p => p.rate);
        const r2 = h2.points.slice(-n).map(p => p.rate);
        const corr = this._pearson(r1, r2);

        let strength: FxCorrelation['strength'] = 'neutral';
        if (corr > 0.7) strength = 'strong_positive';
        else if (corr > 0.3) strength = 'weak_positive';
        else if (corr < -0.7) strength = 'strong_negative';
        else if (corr < -0.3) strength = 'weak_negative';

        results.push({ pair1: targetPairs[i], pair2: targetPairs[j], correlation: corr, strength });
      }
    }

    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  private _pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
    const dx = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0));
    const dy = Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
    return dx === 0 || dy === 0 ? 0 : num / (dx * dy);
  }

  // ── Utility ────────────────────────────────────────────────────────────

  getCurrencyMeta(code: CurrencyCode) { return CURRENCY_META[code]; }

  getSupportedCurrencies(): CurrencyCode[] { return Object.keys(CURRENCY_META) as CurrencyCode[]; }

  getSupportedPairs(): string[] { return this.PAIRS; }

  getStats() {
    return {
      activePairs: this.rates_.size,
      totalHistoryPoints: Array.from(this.history_.values()).reduce((s, h) => s + h.points.length, 0),
      currenciesCovered: Object.keys(CURRENCY_META).length,
      regionsCovered: new Set(Object.values(CURRENCY_META).map(m => m.region)).size,
    };
  }

  reset(): void {
    this.rates_ = new Map();
    this.history_ = new Map();
  }
}

export const fxDataSource = new FxDataSource();
