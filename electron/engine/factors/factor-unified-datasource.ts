// ── R192 A2: FactorDataProvider Unified Data Source Bridge ─────────────────
// Exposes all 5 data source types from a single entry point:
//   1. stock_diagnosis (PE/ROA/Graham等基本面 + CAPEX/AlmanZ等财务)
//   2. sentiment (管理层指引/内部人/情绪指标)
//   3. capital_flow (南向/北向/ETF流量/杠杆反向)
//   4. factor_cloud (窝轮/期权/牛熊证/Tick/0DTE/SPAC/爆仓/加密)
//   5. factor_research (学术因子BAB/PEAD/GDP_BETA/HMM/Gamma/Puell/MVRV-Z等)
//
// Market routing: hk / us / crypto / global → auto-select relevant sources.

import log from 'electron-log';
import { FactorDataProvider, type FactorSource } from './factor-data-provider';
import { CryptoFactorPipeline } from './crypto-factor-pipeline';
import { registerR186DataSources } from './factor-provider-adapter-r186';

// ── Source Registry ────────────────────────────────────────────────────────

export const UNIFIED_SOURCES: Record<string, { name: string; market: string[]; factorCount: number }> = {
  stock_diagnosis: { name: '个股诊断', market: ['hk', 'us', 'global'], factorCount: 45 },
  sentiment: { name: '市场情绪', market: ['hk', 'us', 'global'], factorCount: 25 },
  capital_flow: { name: '资金流向', market: ['hk', 'us', 'global'], factorCount: 20 },
  factor_cloud: { name: '因子云', market: ['hk', 'us', 'crypto', 'global'], factorCount: 60 },
  factor_research: { name: '因子研究', market: ['hk', 'us', 'crypto', 'global'], factorCount: 47 },
};

// ── Unified Data Source Manager ────────────────────────────────────────────

export class UnifiedDataSourceManager {
  private provider: FactorDataProvider;
  private cryptoPipeline: CryptoFactorPipeline | null = null;
  private initialized = false;

  constructor(provider: FactorDataProvider) {
    this.provider = provider;
  }

  /** Initialize all 5 data sources + crypto pipeline */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register R186 adapter sources (stock_diagnosis/sentiment/capital_flow)
    registerR186DataSources(this.provider);

    // Initialize crypto pipeline
    try {
      const { getCryptoPipeline } = require('./crypto-factor-pipeline');
      this.cryptoPipeline = getCryptoPipeline();
      await this.cryptoPipeline?.initialize();
    } catch (err: any) {
      log.warn(`[UnifiedDataSource] Crypto pipeline init skipped: ${err.message}`);
    }

    this.initialized = true;
    log.info(`[UnifiedDataSource] Initialized: ${Object.keys(UNIFIED_SOURCES).length} source types across ${['hk', 'us', 'crypto', 'global'].join(', ')} markets`);
  }

  /** Get active sources for a given market */
  getSourcesForMarket(market: string): Array<{ name: string; factorCount: number }> {
    return Object.entries(UNIFIED_SOURCES)
      .filter(([_, v]) => v.market.includes(market))
      .map(([k, v]) => ({ name: v.name, factorCount: v.factorCount }));
  }

  /** Fetch factors from all 5 sources for a given symbol+market */
  async fetchAllSources(symbol: string, market: string): Promise<Record<string, any>> {
    const factors: Record<string, any> = {};

    // Source 1-3: via FactorDataProvider (stock_diagnosis, sentiment, capital_flow)
    try {
      const providerResult = await this.provider.fetchFactors(symbol, '1m');
      Object.assign(factors, providerResult.factors ?? {});
    } catch (err: any) {
      log.warn(`[UnifiedDataSource] Provider fetch failed: ${err.message}`);
    }

    // Source 4-5: via crypto pipeline (for crypto markets)
    if (market === 'crypto' && this.cryptoPipeline) {
      try {
        const cryptoFactors = await this.cryptoPipeline.computeAllFactors(symbol);
        for (const fv of cryptoFactors) {
          factors[fv.factorId] = fv;
        }
      } catch (err: any) {
        log.warn(`[UnifiedDataSource] Crypto fetch failed: ${err.message}`);
      }
    }

    return factors;
  }

  /** Health check across all sources */
  async healthCheck(): Promise<{
    provider: boolean;
    crypto: boolean;
    allHealthy: boolean;
    details: string[];
  }> {
    const details: string[] = [];
    let providerHealthy = false;
    let cryptoHealthy = false;

    // Check provider
    try {
      const registered = this.provider.getRegisteredSources();
      providerHealthy = registered.length >= 3; // at least 3 sources registered
      details.push(`Provider: ${registered.length} sources registered`);
    } catch (err: any) {
      details.push(`Provider: FAILED - ${err.message}`);
    }

    // Check crypto
    if (this.cryptoPipeline) {
      try {
        const cryptoHealth = await this.cryptoPipeline.healthCheck();
        cryptoHealthy = cryptoHealth.sourcesHealthy >= 2;
        details.push(`Crypto: ${cryptoHealth.sourcesHealthy}/${cryptoHealth.totalSources} healthy`);
      } catch (err: any) {
        details.push(`Crypto: FAILED - ${err.message}`);
      }
    } else {
      details.push('Crypto: not initialized');
      cryptoHealthy = true; // Not required for non-crypto markets
    }

    return {
      provider: providerHealthy,
      crypto: cryptoHealthy,
      allHealthy: providerHealthy && cryptoHealthy,
      details,
    };
  }

  /** Get overall stats */
  getStats(): {
    totalSources: number;
    totalFactorsCovered: number;
    markets: string[];
    initialized: boolean;
  } {
    const totalFactors = Object.values(UNIFIED_SOURCES).reduce((sum, s) => sum + s.factorCount, 0);
    const markets = [...new Set(Object.values(UNIFIED_SOURCES).flatMap(s => s.market))];
    return {
      totalSources: Object.keys(UNIFIED_SOURCES).length,
      totalFactorsCovered: totalFactors,
      markets,
      initialized: this.initialized,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _unifiedManager: UnifiedDataSourceManager | null = null;

export function getUnifiedDataSource(provider?: FactorDataProvider): UnifiedDataSourceManager {
  if (!_unifiedManager) {
    if (!provider) throw new Error('UnifiedDataSourceManager requires a FactorDataProvider on first call');
    _unifiedManager = new UnifiedDataSourceManager(provider);
  }
  return _unifiedManager;
}

export function resetUnifiedDataSource(): void {
  _unifiedManager = null;
}
