// R188 J3: Options Data Adapter — OI, PCR, IV Rank
// Provides typed options market data for factor calculators.
// Data sources: exchange options APIs (CBOE, OPRA, Deribit for crypto).

export interface OptionsMetrics {
  /** Put/Call ratio by open interest */
  oiPutCallRatio: number;
  /** Put/Call ratio by volume */
  volumePcr: number;
  /** IV Rank (percentile of IV over lookback period) */
  ivRank: number;
  /** Current at-the-money implied volatility */
  atmIv: number;
  /** IV skew: OTM put IV - ATM IV */
  ivSkew: number;
  /** IV term structure slope: 30-day IV / 7-day IV */
  ivTermSlope: number;
  /** 25-delta risk reversal */
  riskReversal: number;
  /** Total open interest (calls + puts) */
  totalOpenInterest: number;
  /** Call open interest */
  callOpenInterest: number;
  /** Put open interest */
  putOpenInterest: number;
  /** Open interest 24h change (percent) */
  oiDelta: number;
  /** Put/call volume spike (z-score vs 20d avg) */
  pcrVolumeSpike: number;
  /** VIX or equivalent volatility index value */
  vixLevel: number;
  /** Options expiry week flag */
  isExpiryWeek: boolean;
  /** Days to next monthly expiry */
  daysToExpiry: number;
  /** Symbol */
  symbol: string;
  /** Timestamp */
  timestamp: number;
}

export interface OptionsHistoryEntry {
  date: string;
  ivRank: number;
  pcr: number;
  oi: number;
}

export interface OptionsProviderConfig {
  /** API base URL */
  apiBaseUrl?: string;
  /** API key (if required) */
  apiKey?: string;
  /** Cache TTL in ms */
  cacheTtlMs?: number;
  /** Enable mock data on failure */
  mockOnFail?: boolean;
  /** Lookback days for IV Rank percentile */
  ivRankLookbackDays?: number;
}

export class OptionsDataAdapter {
  private config: Required<OptionsProviderConfig>;
  private cache: Map<string, { data: unknown; ts: number }> = new Map();
  private historyCache: Map<string, OptionsHistoryEntry[]> = new Map();

  constructor(config: OptionsProviderConfig = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl ?? '',
      apiKey: config.apiKey ?? '',
      cacheTtlMs: config.cacheTtlMs ?? 60_000, // 1 min default
      mockOnFail: config.mockOnFail ?? true,
      ivRankLookbackDays: config.ivRankLookbackDays ?? 252,
    };
  }

  async initialize(): Promise<void> {}

  /** Fetch options metrics for a symbol */
  async fetchOptionsMetrics(symbol: string): Promise<OptionsMetrics> {
    const cacheKey = 'opt:' + symbol;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.config.cacheTtlMs) {
      return cached.data as OptionsMetrics;
    }

    let metrics: OptionsMetrics;
    try {
      if (this.config.apiBaseUrl) {
        metrics = await this.fetchFromApi(symbol);
      } else {
        metrics = this.generateMockMetrics(symbol);
      }
    } catch {
      if (this.config.mockOnFail) {
        metrics = this.generateMockMetrics(symbol);
      } else {
        throw new Error('Options data fetch failed for ' + symbol);
      }
    }

    this.cache.set(cacheKey, { data: metrics, ts: Date.now() });
    // Store in history for IV rank calculation
    this.updateHistory(symbol, { date: new Date().toISOString().slice(0, 10), ivRank: metrics.ivRank, pcr: metrics.oiPutCallRatio, oi: metrics.totalOpenInterest });
    return metrics;
  }

  /** Fetch options metrics for multiple symbols in parallel */
  async fetchBatch(symbols: string[]): Promise<Map<string, OptionsMetrics>> {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const m = await this.fetchOptionsMetrics(sym);
        return [sym, m] as const;
      })
    );
    return new Map(results);
  }

  /** Calculate IV Rank: where current IV stands in historical distribution */
  calculateIVRank(symbol: string, currentIv: number): number {
    const history = this.historyCache.get(symbol);
    if (!history || history.length < 20) return 0.5;

    const ivs = history.map(h => h.ivRank).sort((a, b) => a - b);
    let rank = 0;
    for (let i = 0; i < ivs.length; i++) {
      if (ivs[i] <= currentIv) rank = i;
      else break;
    }
    return Math.min(1, Math.max(0, rank / ivs.length));
  }

  /** Calculate Put/Call ratio spike (z-score) */
  calculatePCRSpike(symbol: string, currentPcr: number): number {
    const history = this.historyCache.get(symbol);
    if (!history || history.length < 10) return 0;

    const recent = history.slice(-20).map(h => h.pcr);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
    const std = Math.sqrt(variance);
    if (std === 0) return 0;
    return (currentPcr - mean) / std;
  }

  /** Get historical options data for a symbol */
  getHistory(symbol: string): OptionsHistoryEntry[] {
    return this.historyCache.get(symbol) ?? [];
  }

  /** Clear all caches */
  clearCache(): void {
    this.cache.clear();
    this.historyCache.clear();
  }

  /** Generate a snapshot of options data for factor pipeline */
  getSnapshot(symbol: string): OptionsMetrics {
    const cached = this.cache.get('opt:' + symbol);
    if (cached) return cached.data as OptionsMetrics;
    return this.generateMockMetrics(symbol);
  }

  private async fetchFromApi(symbol: string): Promise<OptionsMetrics> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) headers['Authorization'] = 'Bearer ' + this.config.apiKey;
    const url = this.config.apiBaseUrl + '/options/' + encodeURIComponent(symbol);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Options API returned ' + res.status);
    const data = await res.json();
    return this.normalizeApiResponse(data, symbol);
  }

  private normalizeApiResponse(data: Record<string, unknown>, symbol: string): OptionsMetrics {
    return {
      oiPutCallRatio: (data.pcr as number) ?? 0.7,
      volumePcr: (data.volumePcr as number) ?? 0.7,
      ivRank: (data.ivRank as number) ?? 0.5,
      atmIv: (data.atmIv as number) ?? 0.3,
      ivSkew: (data.ivSkew as number) ?? 0,
      ivTermSlope: (data.ivTermSlope as number) ?? 1,
      riskReversal: (data.riskReversal as number) ?? 0,
      totalOpenInterest: (data.totalOi as number) ?? 0,
      callOpenInterest: (data.callOi as number) ?? 0,
      putOpenInterest: (data.putOi as number) ?? 0,
      oiDelta: (data.oiDelta as number) ?? 0,
      pcrVolumeSpike: 0,
      vixLevel: (data.vixLevel as number) ?? 15,
      isExpiryWeek: false,
      daysToExpiry: (data.daysToExpiry as number) ?? 20,
      symbol,
      timestamp: Date.now(),
    };
  }

  private generateMockMetrics(symbol: string): OptionsMetrics {
    const seed = this.hashSymbol(symbol);
    const now = Date.now();
    const isOptionable = symbol.includes('.') || /^[A-Z]+$/.test(symbol);
    return {
      oiPutCallRatio: 0.5 + seed * 0.8,
      volumePcr: 0.3 + seed * 1.0,
      ivRank: 0.1 + seed * 0.8,
      atmIv: 0.15 + seed * 0.5,
      ivSkew: -0.05 + seed * 0.15,
      ivTermSlope: 0.8 + seed * 0.4,
      riskReversal: -0.03 + seed * 0.06,
      totalOpenInterest: isOptionable ? 100_000 + seed * 5_000_000 : 0,
      callOpenInterest: isOptionable ? 50_000 + seed * 2_500_000 : 0,
      putOpenInterest: isOptionable ? 50_000 + seed * 2_500_000 : 0,
      oiDelta: -0.1 + seed * 0.2,
      pcrVolumeSpike: -2 + seed * 4,
      vixLevel: 10 + seed * 30,
      isExpiryWeek: seed > 0.9,
      daysToExpiry: 1 + Math.floor(seed * 30),
      symbol,
      timestamp: now,
    };
  }

  private updateHistory(symbol: string, entry: OptionsHistoryEntry): void {
    const history = this.historyCache.get(symbol) ?? [];
    history.push(entry);
    // Keep last 2 years of data
    if (history.length > 504) history.splice(0, history.length - 504);
    this.historyCache.set(symbol, history);
  }

  private hashSymbol(symbol: string): number {
    let h = 0;
    for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) & 0xffffffff;
    return (h % 1000) / 1000;
  }
}

// Singleton
let defaultOptions: OptionsDataAdapter | null = null;

export function getOptionsDataAdapter(config?: OptionsProviderConfig): OptionsDataAdapter {
  if (!defaultOptions) defaultOptions = new OptionsDataAdapter(config);
  return defaultOptions;
}

export function resetOptionsDataAdapter(): void {
  defaultOptions = null;
}