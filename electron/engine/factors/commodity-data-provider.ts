// R198 J2: CommodityDataProvider — Unified Commodity Factor Data Source
// Inherits FactorDataProvider pattern from R186. Provides a single entry point
// for commodity factor data: contract chains, CFTC positions, EIA inventory,
// LME warehouse stock, gold ETF flows, and seasonal patterns.
//
// PM rule: "商品因子仅信号灯(免费)，不接深度服务(回测1U仅股票)"

import log from 'electron-log';
import {
  ContractChain, RollYieldResult, BasisResult, TermStructureResult,
  DominantContractResult, CommodityFactorInput, CommodityCategory,
  EIAInventoryData, CFTCData, LMEInventoryData, GoldETFData,
  CommoditySeasonalData, CommodityBalanceSheet,
  COMMODITY_SYMBOLS, getCommodityCategory, ALL_COMMODITY_SYMBOLS,
  buildMockContractChain, calculateRollYield, calculateBasis,
  calculateTermStructure, detectDominantContract,
  getSeasonalSignal,
} from './commodity-types';
import { CFTCAdapter } from './cftc-cot-adapter';
import { EIAAdapter } from './eia-energy-adapter';
import { LMEAdapter } from './lme-metal-adapter';

// ── Provider Configuration ───────────────────────────────────────

export interface CommodityProviderConfig {
  mockMode: boolean;           // use mock data for offline/testing
  cacheMinutes: number;        // cache duration in minutes
  enableCFTC: boolean;
  enableEIA: boolean;
  enableLME: boolean;
  enableGoldETF: boolean;
}

const DEFAULT_CONFIG: CommodityProviderConfig = {
  mockMode: true,
  cacheMinutes: 30,
  enableCFTC: true,
  enableEIA: true,
  enableLME: true,
  enableGoldETF: true,
};

// ── Cache Entry ──────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ── CommodityDataProvider ────────────────────────────────────────

export class CommodityDataProvider {
  private config: CommodityProviderConfig;
  private cftcAdapter: CFTCAdapter | null = null;
  private eiaAdapter: EIAAdapter | null = null;
  private lmeAdapter: LMEAdapter | null = null;

  // Caches
  private chainCache = new Map<string, CacheEntry<ContractChain>>();
  private rollYieldCache = new Map<string, CacheEntry<RollYieldResult>>();
  private basisCache = new Map<string, CacheEntry<BasisResult>>();
  private eiaCache = new Map<string, CacheEntry<EIAInventoryData>>();
  private cftcCache = new Map<string, CacheEntry<CFTCData>>();
  private lmeCache = new Map<string, CacheEntry<LMEInventoryData>>();
  private goldETFCache = new Map<string, CacheEntry<GoldETFData>>();
  private seasonalityCache = new Map<string, CacheEntry<CommoditySeasonalData>>();

  constructor(config: Partial<CommodityProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.enableCFTC) this.cftcAdapter = new CFTCAdapter();
    if (this.config.enableEIA) this.eiaAdapter = new EIAAdapter();
    if (this.config.enableLME) this.lmeAdapter = new LMEAdapter();
    log.info('[CommodityDataProvider] Initialized, mockMode=' + this.config.mockMode);
  }

  // ── Core Methods ───────────────────────────────────────────

  async fetchFullInput(symbol: string): Promise<CommodityFactorInput> {
    const category = getCommodityCategory(symbol);
    if (!category) {
      const msg = 'Unknown commodity symbol: ' + symbol + '. Supported: ' + ALL_COMMODITY_SYMBOLS.join(', ');
      throw new Error(msg);
    }

    const chain = await this.fetchContractChain(symbol);
    const rollYield = calculateRollYield(chain);
    const basis = calculateBasis(chain);
    const termStructure = calculateTermStructure(chain);
    const dominant = detectDominantContract(chain);

    const input: CommodityFactorInput = {
      symbol, category, chain, rollYield, basis, termStructure, dominant,
    };

    // Optional data sources (non-blocking)
    try { if (this.config.enableEIA && (symbol === 'CL' || symbol === 'NG'))
      input.eia = await this.fetchEIAInventory(symbol); } catch (e) { log.warn('[CommodityProvider] EIA fetch failed for ' + symbol, e); }

    try { if (this.config.enableCFTC)
      input.cftc = await this.fetchCFTC(symbol); } catch (e) { log.warn('[CommodityProvider] CFTC fetch failed for ' + symbol, e); }

    try { if (this.config.enableLME && symbol.startsWith('LME_'))
      input.lme = await this.fetchLMEInventory(symbol); } catch (e) { log.warn('[CommodityProvider] LME fetch failed for ' + symbol, e); }

    try { if (this.config.enableGoldETF && symbol === 'GC')
      input.goldETF = await this.fetchGoldETF(symbol); } catch (e) { log.warn('[CommodityProvider] GoldETF fetch failed for ' + symbol, e); }

    return input;
  }

  async fetchContractChain(symbol: string): Promise<ContractChain> {
    const cached = this.chainCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const chain = this.config.mockMode
      ? buildMockContractChain(symbol)
      : await this.fetchRealContractChain(symbol);

    this.chainCache.set(symbol, { data: chain, expiresAt: Date.now() + this.config.cacheMinutes * 60000 });
    return chain;
  }

  async fetchEIAInventory(symbol: string): Promise<EIAInventoryData> {
    const cached = this.eiaCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = this.eiaAdapter
      ? await this.eiaAdapter.fetchInventory(symbol)
      : this.mockEIA(symbol);

    this.eiaCache.set(symbol, { data, expiresAt: Date.now() + this.config.cacheMinutes * 60000 });
    return data;
  }

  async fetchCFTC(symbol: string): Promise<CFTCData> {
    const cached = this.cftcCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = this.cftcAdapter
      ? await this.cftcAdapter.fetchPositions(symbol)
      : this.mockCFTC(symbol);

    this.cftcCache.set(symbol, { data, expiresAt: Date.now() + this.config.cacheMinutes * 60000 });
    return data;
  }

  async fetchLMEInventory(symbol: string): Promise<LMEInventoryData> {
    const cached = this.lmeCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = this.lmeAdapter
      ? await this.lmeAdapter.fetchInventory(symbol)
      : this.mockLME(symbol);

    this.lmeCache.set(symbol, { data, expiresAt: Date.now() + this.config.cacheMinutes * 60000 });
    return data;
  }

  async fetchGoldETF(symbol: string): Promise<GoldETFData> {
    const cached = this.goldETFCache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = this.mockGoldETF(symbol);
    this.goldETFCache.set(symbol, { data, expiresAt: Date.now() + this.config.cacheMinutes * 60000 });
    return data;
  }

  getSeasonality(symbol: string, month?: number): CommoditySeasonalData {
    return getSeasonalSignal(symbol, month);
  }

  getAllSymbols(): string[] { return ALL_COMMODITY_SYMBOLS; }
  getSymbolsByCategory(cat: CommodityCategory): string[] {
    return Object.entries(COMMODITY_SYMBOLS).filter(([, c]) => c === cat).map(([s]) => s);
  }

  // ── Mock/Real stubs ──────────────────────────────────────

  private async fetchRealContractChain(symbol: string): Promise<ContractChain> {
    // Placeholder: real data fetch from broker/yahoo/etc
    log.warn('[CommodityProvider] Real chain fetch not implemented for ' + symbol + ', using mock');
    return buildMockContractChain(symbol);
  }

  // ── Mock Implementations ─────────────────────────────────

  private mockEIA(symbol: string): EIAInventoryData {
    const isCrude = symbol === 'CL';
    const baseStock = isCrude ? 420 : 3200; // million barrels or bcf
    const expected = baseStock + (Math.random() - 0.6) * (isCrude ? 2.0 : 30);
    const actual = expected + (Math.random() - 0.5) * (isCrude ? 3.0 : 50);
    const prev = baseStock + (Math.random() - 0.5) * (isCrude ? 2.0 : 30);

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      actual, expected, previous: prev,
      change: actual - prev,
      changeExpected: expected - prev,
      surprise: actual - expected,
      historical: Array(52).fill(0).map((_, i) => ({
        week: new Date(Date.now() - (52 - i) * 7 * 86400000).toISOString().slice(0, 10),
        stock: baseStock + (Math.random() - 0.5) * (isCrude ? 10 : 200),
      })),
    };
  }

  private mockCFTC(symbol: string): CFTCData {
    const mmLong = 50000 + Math.random() * 100000;
    const mmShort = 30000 + Math.random() * 80000;
    const commLong = 60000 + Math.random() * 50000;
    const commShort = 80000 + Math.random() * 80000;
    const totalOI = 400000 + Math.random() * 300000;
    const prevNet = mmLong - mmShort - (Math.random() - 0.5) * 10000;
    const currNet = mmLong - mmShort;

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      mmLong: mmLong, mmShort: mmShort, mmNet: currNet,
      mmNetChange: currNet - prevNet, mmSpread: Math.random() * 20000,
      commLong: commLong, commShort: commShort, commNet: commLong - commShort,
      otherLong: Math.random() * 30000, otherShort: Math.random() * 20000,
      otherNet: Math.random() * 10000 - 5000,
      totalOI: totalOI,
      mmPctLong: mmLong / (mmLong + mmShort) * 100,
      hedgingPressure: commShort / totalOI,
      signal: currNet > prevNet ? 'green' : currNet < prevNet * 0.9 ? 'red' : 'yellow',
    };
  }

  private mockLME(symbol: string): LMEInventoryData {
    const base = symbol === 'LME_CU' ? 150000 : symbol === 'LME_AL' ? 800000 : 20000;
    const onWarrant = base + (Math.random() - 0.5) * base * 0.3;
    const cancelled = Math.random() * onWarrant * 0.4;
    const change = (Math.random() - 0.5) * onWarrant * 0.02;

    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      onWarrant: onWarrant, cancelledWarrants: cancelled, total: onWarrant + cancelled,
      changeOnWarrant: change, changeCancelled: (Math.random() - 0.5) * cancelled * 0.1,
      trend: change < -500 ? 'destocking' : change > 500 ? 'restocking' : 'stable',
      signal: change < -500 ? 'green' : change > 500 ? 'red' : 'yellow',
    };
  }

  private mockGoldETF(symbol: string): GoldETFData {
    const tonnes = 3200 + Math.random() * 400;
    const daily = (Math.random() - 0.48) * 3;
    const weekly = daily * 5 + (Math.random() - 0.5) * 2;
    return {
      symbol, reportDate: new Date().toISOString().slice(0, 10),
      totalTonnes: tonnes, dailyChange: daily, weeklyChange: weekly,
      monthlyChange: weekly * 4 + (Math.random() - 0.5) * 5,
      price: 2800 + Math.random() * 100,
      signal: daily > 0.5 ? 'green' : daily < -0.5 ? 'red' : 'yellow',
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────

let instance: CommodityDataProvider | null = null;

export function getCommodityDataProvider(config?: Partial<CommodityProviderConfig>): CommodityDataProvider {
  if (!instance) instance = new CommodityDataProvider(config);
  return instance;
}

export function resetCommodityDataProvider(): void { instance = null; }
