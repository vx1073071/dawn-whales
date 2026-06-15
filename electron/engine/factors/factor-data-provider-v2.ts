// R186 J1: FactorDataProvider v2 — Unified Multi-Market Data Adapter
// Provides FactorInput arrays for green-factor-calculators from 3 markets: HK, US, Crypto.
//
// Architecture:
//   FactorDataProviderV2 (unified entry)
//     ├── HKDataAdapter    (Futu/Longbridge → Fundamental + Price)
//     ├── USDataAdapter    (IB/Schwab → Fundamental + Price)
//     └── CryptoDataAdapter (Binance/OKX → OnChain + Price)

import type { FactorInput, PriceSnapshot, FundamentalSnapshot, OnChainSnapshot, MacroSnapshot } from './factor-calculator';
import type { FactorId } from './factor-id-registry';

export type MarketType = 'HK' | 'US' | 'CRYPTO';

export interface DataAdapterConfig {
  market: MarketType;
  symbols: string[];
  lookbackDays?: number;
  includeFundamental?: boolean;
  includeOnChain?: boolean;
}

export interface DataAdapterResult {
  market: MarketType;
  inputs: FactorInput[];
  errors: Array<{ symbol: string; error: string }>;
  timestamp: number;
  sourceLatencyMs?: number;
}

export interface IDataAdapter {
  readonly market: MarketType;
  fetchData(config: DataAdapterConfig): Promise<DataAdapterResult>;
  getSupportedFactors(): FactorId[];
  healthCheck(): Promise<boolean>;
}

export abstract class BaseDataAdapter implements IDataAdapter {
  abstract readonly market: MarketType;
  abstract getSupportedFactors(): FactorId[];

  abstract fetchPriceData(symbols: string[], lookbackDays: number): Promise<Record<string, PriceSnapshot[]>>;
  fetchFundamentalData?(symbols: string[]): Promise<Record<string, FundamentalSnapshot>>;
  fetchOnChainData?(symbols: string[]): Promise<Record<string, OnChainSnapshot>>;

  async fetchData(config: DataAdapterConfig): Promise<DataAdapterResult> {
    const startTime = Date.now();
    const errors: Array<{ symbol: string; error: string }> = [];
    const inputs: FactorInput[] = [];

    try {
      const priceData = await this.fetchPriceData(config.symbols, config.lookbackDays ?? 60);
      const fundamental = config.includeFundamental !== false && this.fetchFundamentalData
        ? await this.fetchFundamentalData(config.symbols)
        : undefined;
      const onChain = config.includeOnChain === true && this.fetchOnChainData
        ? await this.fetchOnChainData(config.symbols)
        : undefined;

      for (const symbol of config.symbols) {
        const prices = priceData[symbol];
        if (!prices || prices.length === 0) {
          errors.push({ symbol, error: 'No price data' });
          continue;
        }
        const latest = prices[prices.length - 1];
        inputs.push({
          symbol,
          market: this.market,
          timestamp: Date.now(),
          priceData: latest,
          fundamental: fundamental ? fundamental[symbol] : undefined,
          onChain: onChain ? onChain[symbol] : undefined,
          extra: { priceHistory: prices },
        });
      }
    } catch (e: any) {
      errors.push({ symbol: '*', error: e?.message ?? String(e) });
    }

    return {
      market: this.market,
      inputs,
      errors,
      timestamp: Date.now(),
      sourceLatencyMs: Date.now() - startTime,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.fetchPriceData(['TEST_SYMBOL'], 1);
      return result !== null;
    } catch {
      return false;
    }
  }
}

export class HKDataAdapter extends BaseDataAdapter {
  readonly market: MarketType = 'HK';

  getSupportedFactors(): FactorId[] {
    return ['HK_AH_PREMIUM', 'AH_PREMIUM_CHANGE', 'HK_SOUTHBOUND_FLOW', 'HSI_CONSTITUENT', 'HK_REIT_YIELD',
      'EP_RATIO', 'HML', 'YIELD', 'ROA', 'GROSS_MARGIN', 'DEBT_TO_EQUITY', 'MKT', 'MAX_DRAWDOWN',
      'KDJ', 'EARNINGS_SURPRISE', 'DIVIDEND_CHANGE', 'CURRENCY_EFFECT'];
  }

  async fetchPriceData(symbols: string[], lookbackDays: number): Promise<Record<string, PriceSnapshot[]>> {
    // Production: call Futu/Longbridge API. Mock for now.
    const result: Record<string, PriceSnapshot[]> = {};
    for (const symbol of symbols) {
      result[symbol] = HKDataAdapter.generateMockPrices(symbol, lookbackDays);
    }
    return result;
  }

  // Placeholder overload: these will be wired to real broker APIs
  async fetchFundamentalData(symbols: string[]): Promise<Record<string, FundamentalSnapshot>> {
    const result: Record<string, FundamentalSnapshot> = {};
    for (const symbol of symbols) {
      result[symbol] = {
        marketCap: 50_000_000_000,
        revenue: 10_000_000_000,
        netIncome: 2_000_000_000,
        bookValuePerShare: 25,
        eps: 3.5,
        dps: 1.2,
        freeCashFlow: 1_500_000_000,
        totalAssets: 80_000_000_000,
        totalLiabilities: 40_000_000_000,
        currentRatio: 1.5,
        roe: 0.15,
        grossMargin: 0.40,
      };
    }
    return result;
  }

  static generateMockPrices(symbol: string, days: number): PriceSnapshot[] {
    const prices: PriceSnapshot[] = [];
    const basePrice = symbol.includes('07') ? 300 : symbol.includes('03') ? 80 : 150;
    const volatility = 0.015;
    let price = basePrice;
    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      const close = price * (1 + change);
      const high = close * (1 + Math.random() * volatility);
      const low = close * (1 - Math.random() * volatility);
      const open = low + Math.random() * (high - low);
      prices.push({
        open,
        high,
        low,
        close,
        volume: 1_000_000 + Math.random() * 9_000_000,
        prevClose: price,
        adjClose: close,
      });
      price = close;
    }
    return prices;
  }
}

export class USDataAdapter extends BaseDataAdapter {
  readonly market: MarketType = 'US';

  getSupportedFactors(): FactorId[] {
    return ['US_EARNINGS_CALENDAR', 'US_SECTOR_ROTATION', 'US_SMALL_CAP_MOMENTUM',
      'US_DIVIDEND_ARISTOCRATS', 'US_SP500_EQUAL_WEIGHT',
      'EP_RATIO', 'HML', 'YIELD', 'ROA', 'GROSS_MARGIN', 'DEBT_TO_EQUITY', 'MKT', 'MAX_DRAWDOWN',
      'INSIDER_BUYING', 'FUND_FLOW', 'ETF_FLOW', 'EARNINGS_SURPRISE', 'DIVIDEND_CHANGE',
      'SECTOR_STRENGTH', 'IV_RANK', 'FREE_CASH_FLOW_YIELD', 'EQUITY_MULTIPLIER',
      'DISPOSITION_EFFECT', 'ANCHORING', 'KDJ', 'CURRENCY_EFFECT'];
  }

  async fetchPriceData(symbols: string[], lookbackDays: number): Promise<Record<string, PriceSnapshot[]>> {
    const result: Record<string, PriceSnapshot[]> = {};
    for (const symbol of symbols) {
      result[symbol] = USDataAdapter.generateMockPrices(symbol, lookbackDays);
    }
    return result;
  }

  async fetchFundamentalData(symbols: string[]): Promise<Record<string, FundamentalSnapshot>> {
    const result: Record<string, FundamentalSnapshot> = {};
    for (const symbol of symbols) {
      result[symbol] = {
        marketCap: 500_000_000_000,
        revenue: 100_000_000_000,
        netIncome: 20_000_000_000,
        bookValuePerShare: 15,
        eps: 6.0,
        dps: 1.0,
        freeCashFlow: 25_000_000_000,
        totalAssets: 300_000_000_000,
        totalLiabilities: 150_000_000_000,
        currentRatio: 1.2,
        roe: 0.30,
        grossMargin: 0.55,
        operatingCashFlow: 30_000_000_000,
        ebitda: 35_000_000_000,
      };
    }
    return result;
  }

  static generateMockPrices(symbol: string, days: number): PriceSnapshot[] {
    const prices: PriceSnapshot[] = [];
    const basePrice = symbol.includes('AAPL') ? 190 : symbol.includes('TSLA') ? 250 : 100;
    const volatility = 0.02;
    let price = basePrice;
    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      const close = price * (1 + change);
      const high = close * (1 + Math.random() * volatility);
      const low = close * (1 - Math.random() * volatility);
      const open = low + Math.random() * (high - low);
      prices.push({
        open,
        high,
        low,
        close,
        volume: 10_000_000 + Math.random() * 90_000_000,
        prevClose: price,
        adjClose: close,
      });
      price = close;
    }
    return prices;
  }
}

export class CryptoDataAdapter extends BaseDataAdapter {
  readonly market: MarketType = 'CRYPTO';

  getSupportedFactors(): FactorId[] {
    return ['CRYPTO_MVRV', 'CRYPTO_NVT', 'CRYPTO_S2F', 'CRYPTO_EXCHANGE_FLOW',
      'CRYPTO_ACTIVE_ADDR', 'CRYPTO_HASH_RATE',
      'MKT', 'MAX_DRAWDOWN', 'KDJ', 'FUND_FLOW', 'CURRENCY_EFFECT',
      'DISPOSITION_EFFECT', 'ANCHORING'];
  }

  async fetchPriceData(symbols: string[], lookbackDays: number): Promise<Record<string, PriceSnapshot[]>> {
    const result: Record<string, PriceSnapshot[]> = {};
    for (const symbol of symbols) {
      result[symbol] = CryptoDataAdapter.generateMockPrices(symbol, lookbackDays);
    }
    return result;
  }

  async fetchOnChainData(symbols: string[]): Promise<Record<string, OnChainSnapshot>> {
    const result: Record<string, OnChainSnapshot> = {};
    for (const symbol of symbols) {
      const isBTC = symbol.includes('BTC');
      const isETH = symbol.includes('ETH');
      result[symbol] = {
        mvrv: isBTC ? 2.1 : isETH ? 1.8 : 1.5,
        nvt: isBTC ? 80 : isETH ? 65 : 50,
        activeAddresses: isBTC ? 800_000 : isETH ? 500_000 : 100_000,
        exchangeNetFlow: isBTC ? -500_000_000 : isETH ? -200_000_000 : -50_000_000,
        hashRate: isBTC ? 500e18 : undefined,
        gasUsed: isETH ? 100e9 : undefined,
        stakingRatio: isETH ? 0.27 : undefined,
        totalValueLocked: isETH ? 50_000_000_000 : 10_000_000_000,
        whaleTransactionCount: isBTC ? 150 : 80,
        supplyOnExchanges: isBTC ? 2_300_000 : 15_000_000,
      };
    }
    return result;
  }

  static generateMockPrices(symbol: string, days: number): PriceSnapshot[] {
    const prices: PriceSnapshot[] = [];
    const basePrice = symbol.includes('BTC') ? 68000 : symbol.includes('ETH') ? 3500 : 150;
    const volatility = 0.03;
    let price = basePrice;
    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.5) * 2 * volatility;
      const close = price * (1 + change);
      const high = close * (1 + Math.random() * volatility);
      const low = close * (1 - Math.random() * volatility);
      const open = low + Math.random() * (high - low);
      prices.push({
        open, high, low, close,
        volume: 100_000 + Math.random() * 900_000,
        prevClose: price,
        adjClose: close,
      });
      price = close;
    }
    return prices;
  }
}

export class FactorDataProviderV2 {
  private adapters: Map<MarketType, IDataAdapter> = new Map();

  constructor() {
    this.adapters.set('HK', new HKDataAdapter());
    this.adapters.set('US', new USDataAdapter());
    this.adapters.set('CRYPTO', new CryptoDataAdapter());
  }

  async fetchMarketData(market: MarketType, config: DataAdapterConfig): Promise<DataAdapterResult> {
    const adapter = this.adapters.get(market);
    if (!adapter) throw new Error('Unsupported market: ' + market);
    return adapter.fetchData({ ...config, market });
  }

  async fetchAllMarkets(symbolsByMarket: Record<MarketType, string[]>, opts?: Partial<DataAdapterConfig>): Promise<DataAdapterResult[]> {
    const results = await Promise.all(
      (Object.entries(symbolsByMarket) as Array<[MarketType, string[]]>).map(([market, symbols]) =>
        this.fetchMarketData(market, { market, symbols, ...opts })
      )
    );
    return results;
  }

  getAdapter(market: MarketType): IDataAdapter | undefined {
    return this.adapters.get(market);
  }

  getSupportedFactors(market: MarketType): FactorId[] {
    const adapter = this.adapters.get(market);
    return adapter?.getSupportedFactors() ?? [];
  }

  getAvailableMarkets(): MarketType[] {
    return ['HK', 'US', 'CRYPTO'];
  }

  async healthCheckAll(): Promise<Record<MarketType, boolean>> {
    const results: Record<MarketType, boolean> = { HK: false, US: false, CRYPTO: false };
    for (const [market, adapter] of Array.from(this.adapters.entries())) {
      results[market] = await adapter.healthCheck();
    }
    return results;
  }
}

let defaultProvider: FactorDataProviderV2 | null = null;

export function getFactorDataProviderV2(): FactorDataProviderV2 {
  if (!defaultProvider) defaultProvider = new FactorDataProviderV2();
  return defaultProvider;
}

export function resetFactorDataProviderV2(): void {
  defaultProvider = null;
}