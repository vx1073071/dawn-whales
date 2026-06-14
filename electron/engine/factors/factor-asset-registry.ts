// ── R160 P0-F3: Factor Asset Registry ─────────────────────────────────────
// 7 AssetTypes × Factor Subsets → Single source of truth for factor-asset mapping
// Before: switching to BTC returned all 50 factors indiscriminately
// After:  each AssetType returns only its relevant factor subset
//
// Integration points:
//   - FactorCompatibilityEngine.getCompatibleFactors() → getFactorsByAssetType()
//   - StockScreener filter by asset type → getDefaultFilters()
//   - MultiFactorScorer composite → getFactorWeights()
//   - Portfolio optimizer → getOptimizationConstraints()

import type { FactorDefinition, Market, InstrumentType } from './factor-compatibility-engine';

// ── Asset Type Enum ────────────────────────────────────────────────────────

export enum AssetType {
  US_STOCK = 'US_STOCK',               // NYSE + NASDAQ equities
  HK_STOCK = 'HK_STOCK',               // HKEX equities
  ETF = 'ETF',                         // Exchange-traded funds (all markets)
  FUTURES = 'FUTURES',                 // Futures contracts (all markets)
  OPTION = 'OPTION',                   // Options (US + HK)
  CRYPTO_SPOT = 'CRYPTO_SPOT',         // Crypto spot trading
  CRYPTO_FUTURES = 'CRYPTO_FUTURES',   // Crypto perpetual/dated futures
}

// ── Asset Type Metadata ────────────────────────────────────────────────────

export interface AssetTypeInfo {
  type: AssetType;
  label: string;
  labelCN: string;
  description: string;
  markets: Market[];
  instruments: InstrumentType[];
  /** Recommended default strategy type */
  defaultStrategy: 'momentum' | 'value' | 'growth' | 'balanced' | 'defensive';
  /** Minimum data points for factor computation */
  minDataPoints: number;
  /** Typical holding period (days) */
  typicalHoldPeriod: number;
  /** Icon key for UI */
  icon: string;
}

// ── Factor Subset Registry ─────────────────────────────────────────────────

/**
 * Factor ID subset for each AssetType.
 * Each AssetType only gets relevant factors — no stock-specific factors for crypto,
 * no crypto-specific factors for equities, etc.
 */
const ASSET_TYPE_FACTORS: Record<AssetType, string[]> = {
  [AssetType.US_STOCK]: [
    // Universal Fama-French + fundamentals (11)
    'MOM_12M', 'MOM_1M', 'LIQ', 'VOL_60D',
    'GROWTH', 'QUAL', 'SIZE', 'YIELD',
    'HML', 'RMW', 'CMA',
    // Technical (10)
    'MA_20_60', 'EMA_12_26', 'RSI_14', 'KDJ',
    'BOLL', 'ATR_14', 'ADX', 'OBV', 'CMF', 'ICHIMOKU',
    // US-specific (4)
    'US_VIX', 'US_SHORT_RATIO', 'US_INST_HOLD', 'US_BUYBACK',
    // Global
    'SECTOR_ROTATION',
  ],

  [AssetType.HK_STOCK]: [
    // Universal Fama-French + fundamentals (11)
    'MOM_12M', 'MOM_1M', 'LIQ', 'VOL_60D',
    'GROWTH', 'QUAL', 'SIZE', 'YIELD',
    'HML', 'RMW', 'CMA',
    // Technical (9 — fewer than US, no OBV for HK microstructure)
    'MA_20_60', 'EMA_12_26', 'RSI_14', 'KDJ',
    'BOLL', 'ATR_14', 'ADX', 'CMF', 'ICHIMOKU',
    // HK-specific (2)
    'HKEX_SOUTHBOUND', 'HKEX_FUND_HOLD',
    // Global
    'SECTOR_ROTATION',
  ],

  [AssetType.ETF]: [
    // ETF: technical + momentum heavy, light fundamentals
    'MOM_12M', 'MOM_1M', 'LIQ', 'VOL_60D',
    'YIELD',  // Dividend yield for income ETFs
    // Technical
    'MA_20_60', 'EMA_12_26', 'RSI_14',
    'BOLL', 'ATR_14', 'ADX',
    // Global
    'SECTOR_ROTATION',
  ],

  [AssetType.FUTURES]: [
    // Futures: trend + momentum + vol — no fundamentals
    'MOM_12M', 'MOM_1M', 'VOL_60D', 'LIQ',
    // Technical
    'MA_20_60', 'EMA_12_26', 'RSI_14',
    'BOLL', 'ATR_14', 'ADX',
  ],

  [AssetType.OPTION]: [
    // Options: IV/greeks focused
    'VOL_60D',
    // Option-specific
    'OPTION_PCR',
    // Market context
    'US_VIX',
    // Technical (lighter subset)
    'ATR_14', 'BOLL', 'RSI_14',
    'MOM_1M', 'MA_20_60',
  ],

  [AssetType.CRYPTO_SPOT]: [
    // Crypto spot: price action + on-chain, no equities fundamentals
    'MOM_12M', 'MOM_1M', 'VOL_60D', 'LIQ',
    // Technical (crypto-friendly subset)
    'MA_20_60', 'RSI_14',
    // Crypto-specific on-chain (2)
    'CRYPTO_NVT', 'CRYPTO_EXCHANGE_FLOW',
  ],

  [AssetType.CRYPTO_FUTURES]: [
    // Crypto futures: leveraged + derivatives specific
    'MOM_12M', 'MOM_1M', 'VOL_60D', 'LIQ',
    // Technical (crypto-friendly)
    'MA_20_60', 'EMA_12_26', 'RSI_14',
    // Crypto derivatives-specific (3)
    'CRYPTO_FUNDING', 'CRYPTO_OI_DELTA', 'CRYPTO_LIQUIDATIONS',
  ],
};

// ── Asset Type Metadata Registry ───────────────────────────────────────────

const ASSET_TYPE_INFO: Record<AssetType, AssetTypeInfo> = {
  [AssetType.US_STOCK]: {
    type: AssetType.US_STOCK,
    label: 'US Stocks',
    labelCN: '美股',
    description: 'NYSE & NASDAQ listed equities — 20+ factors covering momentum, value, quality, growth, size, and US-specific sentiment indicators',
    markets: ['NYSE', 'NASDAQ'],
    instruments: ['stock'],
    defaultStrategy: 'balanced',
    minDataPoints: 60,
    typicalHoldPeriod: 90,
    icon: 'flag-us',
  },
  [AssetType.HK_STOCK]: {
    type: AssetType.HK_STOCK,
    label: 'HK Stocks',
    labelCN: '港股',
    description: 'HKEX listed equities — 18+ factors including southbound flow, fund holdings, and Hang Seng sector rotation',
    markets: ['HKEX'],
    instruments: ['stock'],
    defaultStrategy: 'value',
    minDataPoints: 60,
    typicalHoldPeriod: 90,
    icon: 'flag-hk',
  },
  [AssetType.ETF]: {
    type: AssetType.ETF,
    label: 'ETFs',
    labelCN: 'ETF',
    description: 'Exchange-traded funds across all markets — 12 factors optimized for sector rotation, trend following, and dividend yield',
    markets: ['HKEX', 'NYSE', 'NASDAQ'],
    instruments: ['etf'],
    defaultStrategy: 'momentum',
    minDataPoints: 30,
    typicalHoldPeriod: 30,
    icon: 'etf',
  },
  [AssetType.FUTURES]: {
    type: AssetType.FUTURES,
    label: 'Futures',
    labelCN: '期货',
    description: 'Futures contracts — 10 trend/momentum/volatility factors. No fundamental data (earnings/balance sheet don\'t apply)',
    markets: ['HKEX', 'NYSE', 'NASDAQ', 'CRYPTO'],
    instruments: ['future'],
    defaultStrategy: 'momentum',
    minDataPoints: 30,
    typicalHoldPeriod: 15,
    icon: 'futures',
  },
  [AssetType.OPTION]: {
    type: AssetType.OPTION,
    label: 'Options',
    labelCN: '期权',
    description: 'Options — 8 factors focused on IV/VIX/PCR plus volatility regime detection. Greeks-driven, not price-driven',
    markets: ['NYSE', 'NASDAQ', 'HKEX'],
    instruments: ['option'],
    defaultStrategy: 'defensive',
    minDataPoints: 10,
    typicalHoldPeriod: 7,
    icon: 'option',
  },
  [AssetType.CRYPTO_SPOT]: {
    type: AssetType.CRYPTO_SPOT,
    label: 'Crypto Spot',
    labelCN: '加密货币现货',
    description: 'Cryptocurrency spot trading — 8 factors with on-chain NVT, exchange flow. No stock fundamentals (P/E, ROE, D/E don\'t exist for BTC/ETH)',
    markets: ['CRYPTO'],
    instruments: ['crypto_spot'],
    defaultStrategy: 'momentum',
    minDataPoints: 30,
    typicalHoldPeriod: 30,
    icon: 'bitcoin',
  },
  [AssetType.CRYPTO_FUTURES]: {
    type: AssetType.CRYPTO_FUTURES,
    label: 'Crypto Futures',
    labelCN: '加密货币合约',
    description: 'Cryptocurrency perpetual/dated futures — 10 factors with funding rate, OI delta, liquidation heat. Derivatives-specific risk signals',
    markets: ['CRYPTO'],
    instruments: ['crypto_perp'],
    defaultStrategy: 'momentum',
    minDataPoints: 10,
    typicalHoldPeriod: 3,
    icon: 'crypto-futures',
  },
};

// ── Filter Presets per Asset Type ─────────────────────────────────────────

export interface AssetFilterPreset {
  assetType: AssetType;
  /** Default min composite score for screening */
  minScore: number;
  /** Default top-N picks */
  topN: number;
  /** Default factor weights (factorId → weight) */
  defaultWeights: Record<string, number>;
  /** Max drawdown filter */
  maxDrawdownPct: number;
  /** Min liquidity threshold (USD equivalent) */
  minLiquidityUSD: number;
}

const ASSET_FILTER_PRESETS: Record<AssetType, AssetFilterPreset> = {
  [AssetType.US_STOCK]: {
    assetType: AssetType.US_STOCK,
    minScore: 40,
    topN: 30,
    defaultWeights: {
      MOM_12M: 0.15, QUAL: 0.15, HML: 0.12, GROWTH: 0.10,
      SIZE: 0.05, VOL_60D: 0.05, LIQ: 0.05, RMW: 0.05,
      MA_20_60: 0.03, RSI_14: 0.03, US_VIX: 0.03,
      US_SHORT_RATIO: 0.03, US_INST_HOLD: 0.03, SECTOR_ROTATION: 0.03,
      US_BUYBACK: 0.02, YIELD: 0.02, CMA: 0.02, ADX: 0.02, EMA_12_26: 0.02,
    },
    maxDrawdownPct: 0.25,
    minLiquidityUSD: 5_000_000,
  },
  [AssetType.HK_STOCK]: {
    assetType: AssetType.HK_STOCK,
    minScore: 35,
    topN: 25,
    defaultWeights: {
      HKEX_SOUTHBOUND: 0.15, MOM_12M: 0.12, QUAL: 0.12,
      HML: 0.10, YIELD: 0.08, GROWTH: 0.08, LIQ: 0.05,
      VOL_60D: 0.05, HKEX_FUND_HOLD: 0.05, SIZE: 0.03,
      RMW: 0.03, SECTOR_ROTATION: 0.03, MA_20_60: 0.02,
      RSI_14: 0.02, ADX: 0.02, CMA: 0.02, EMA_12_26: 0.01,
      BOLL: 0.01, ATR_14: 0.01,
    },
    maxDrawdownPct: 0.25,
    minLiquidityUSD: 2_000_000,
  },
  [AssetType.ETF]: {
    assetType: AssetType.ETF,
    minScore: 30,
    topN: 15,
    defaultWeights: {
      MOM_12M: 0.20, MOM_1M: 0.12, SECTOR_ROTATION: 0.15,
      MA_20_60: 0.10, EMA_12_26: 0.08, LIQ: 0.08,
      VOL_60D: 0.07, RSI_14: 0.05, ADX: 0.05,
      YIELD: 0.05, BOLL: 0.03, ATR_14: 0.02,
    },
    maxDrawdownPct: 0.20,
    minLiquidityUSD: 10_000_000,
  },
  [AssetType.FUTURES]: {
    assetType: AssetType.FUTURES,
    minScore: 35,
    topN: 10,
    defaultWeights: {
      MOM_12M: 0.20, MOM_1M: 0.15, ADX: 0.12,
      MA_20_60: 0.12, RSI_14: 0.10, VOL_60D: 0.08,
      BOLL: 0.07, LIQ: 0.06, EMA_12_26: 0.05,
      ATR_14: 0.05,
    },
    maxDrawdownPct: 0.20,
    minLiquidityUSD: 50_000_000,
  },
  [AssetType.OPTION]: {
    assetType: AssetType.OPTION,
    minScore: 25,
    topN: 8,
    defaultWeights: {
      OPTION_PCR: 0.25, US_VIX: 0.20, VOL_60D: 0.18,
      RSI_14: 0.10, BOLL: 0.08, ATR_14: 0.08,
      MOM_1M: 0.06, MA_20_60: 0.05,
    },
    maxDrawdownPct: 0.30,
    minLiquidityUSD: 1_000_000,
  },
  [AssetType.CRYPTO_SPOT]: {
    assetType: AssetType.CRYPTO_SPOT,
    minScore: 30,
    topN: 10,
    defaultWeights: {
      MOM_12M: 0.18, MOM_1M: 0.12, CRYPTO_NVT: 0.15,
      CRYPTO_EXCHANGE_FLOW: 0.15, MA_20_60: 0.10,
      RSI_14: 0.10, VOL_60D: 0.10, LIQ: 0.10,
    },
    maxDrawdownPct: 0.30,
    minLiquidityUSD: 10_000_000,
  },
  [AssetType.CRYPTO_FUTURES]: {
    assetType: AssetType.CRYPTO_FUTURES,
    minScore: 25,
    topN: 8,
    defaultWeights: {
      CRYPTO_FUNDING: 0.20, CRYPTO_OI_DELTA: 0.15,
      MOM_12M: 0.12, MOM_1M: 0.10,
      CRYPTO_LIQUIDATIONS: 0.10, EMA_12_26: 0.08,
      RSI_14: 0.08, MA_20_60: 0.07,
      VOL_60D: 0.05, LIQ: 0.05,
    },
    maxDrawdownPct: 0.35,
    minLiquidityUSD: 100_000_000,
  },
};

// ── Optimization Constraints per Asset Type ────────────────────────────────

export interface OptimizationConstraints {
  assetType: AssetType;
  /** Min number of positions */
  minPositions: number;
  /** Max single position weight */
  maxPositionPct: number;
  /** Max factor exposure (single factor) */
  maxFactorExposure: number;
  /** Turnover limit (daily, as % of portfolio) */
  maxTurnoverPct: number;
  /** Slippage estimate (bps) */
  slippageEstimateBps: number;
}

const OPTIMIZATION_CONSTRAINTS: Record<AssetType, OptimizationConstraints> = {
  [AssetType.US_STOCK]: {
    assetType: AssetType.US_STOCK,
    minPositions: 10, maxPositionPct: 0.15,
    maxFactorExposure: 0.40, maxTurnoverPct: 0.20,
    slippageEstimateBps: 5,
  },
  [AssetType.HK_STOCK]: {
    assetType: AssetType.HK_STOCK,
    minPositions: 8, maxPositionPct: 0.18,
    maxFactorExposure: 0.40, maxTurnoverPct: 0.25,
    slippageEstimateBps: 10,
  },
  [AssetType.ETF]: {
    assetType: AssetType.ETF,
    minPositions: 5, maxPositionPct: 0.30,
    maxFactorExposure: 0.50, maxTurnoverPct: 0.15,
    slippageEstimateBps: 3,
  },
  [AssetType.FUTURES]: {
    assetType: AssetType.FUTURES,
    minPositions: 3, maxPositionPct: 0.40,
    maxFactorExposure: 0.50, maxTurnoverPct: 0.40,
    slippageEstimateBps: 2,
  },
  [AssetType.OPTION]: {
    assetType: AssetType.OPTION,
    minPositions: 3, maxPositionPct: 0.25,
    maxFactorExposure: 0.40, maxTurnoverPct: 0.50,
    slippageEstimateBps: 25,
  },
  [AssetType.CRYPTO_SPOT]: {
    assetType: AssetType.CRYPTO_SPOT,
    minPositions: 5, maxPositionPct: 0.25,
    maxFactorExposure: 0.45, maxTurnoverPct: 0.40,
    slippageEstimateBps: 5,
  },
  [AssetType.CRYPTO_FUTURES]: {
    assetType: AssetType.CRYPTO_FUTURES,
    minPositions: 3, maxPositionPct: 0.30,
    maxFactorExposure: 0.45, maxTurnoverPct: 0.60,
    slippageEstimateBps: 3,
  },
};

// ── Factor Asset Registry Class ────────────────────────────────────────────

export class FactorAssetRegistry {
  private factorStore: Map<string, FactorDefinition> = new Map();
  private ready = false;

  constructor() {}

  /** Initialize with factor definitions from FactorCompatibilityEngine */
  registerFactor(factor: FactorDefinition): void {
    this.factorStore.set(factor.id, factor);
  }

  /** Bulk register factors */
  registerFactors(factors: FactorDefinition[]): void {
    for (const f of factors) this.factorStore.set(f.id, f);
  }

  /** Mark as initialized */
  setReady(): void { this.ready = true; }
  isReady(): boolean { return this.ready; }

  // ── Factor Lookup by Asset Type ─────────────────────────────────────────

  /**
   * Get factor IDs for an asset type.
   * @returns Ordered array of factor IDs specific to this asset type
   */
  getFactorIds(assetType: AssetType): string[] {
    return [...ASSET_TYPE_FACTORS[assetType]];
  }

  /**
   * Get full FactorDefinition objects for an asset type.
   * Filters by what's available in the registered factor store.
   */
  getFactors(assetType: AssetType): FactorDefinition[] {
    const ids = ASSET_TYPE_FACTORS[assetType];
    const results: FactorDefinition[] = [];
    for (const id of ids) {
      const factor = this.factorStore.get(id);
      if (factor) results.push(factor);
    }
    return results;
  }

  /**
   * Get factor count per asset type.
   * Useful for UI display and validation.
   */
  getFactorCount(assetType: AssetType): number {
    return ASSET_TYPE_FACTORS[assetType].length;
  }

  /**
   * Get all asset type factor counts as a summary.
   */
  getFactorCountSummary(): Record<AssetType, number> {
    const summary: Record<string, number> = {} as Record<AssetType, number>;
    for (const type of ALL_ASSET_TYPES) {
      summary[type] = this.getFactorCount(type);
    }
    return summary;
  }

  // ── Asset Type Metadata ──────────────────────────────────────────────────

  /** Get all asset types */
  getAssetTypes(): AssetType[] {
    return [...ALL_ASSET_TYPES];
  }

  /** Get metadata for an asset type */
  getAssetTypeInfo(assetType: AssetType): AssetTypeInfo {
    return ASSET_TYPE_INFO[assetType];
  }

  /** Get all asset type metadata */
  getAllAssetTypeInfo(): AssetTypeInfo[] {
    return ALL_ASSET_TYPES.map(t => ASSET_TYPE_INFO[t]);
  }

  /** Resolve asset type from market + instrument combo */
  resolveAssetType(market: Market, instrument: InstrumentType): AssetType | null {
    for (const type of ALL_ASSET_TYPES) {
      const info = ASSET_TYPE_INFO[type];
      if (info.markets.includes(market) && info.instruments.includes(instrument)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Get compatible asset types for a given symbol.
   * Most symbols will match exactly one; some may match multiple
   * (e.g., a crypto symbol could be traded as both spot and futures).
   */
  getCompatibleAssetTypes(market: Market, instruments: InstrumentType[]): AssetType[] {
    const result = new Set<AssetType>();
    for (const inst of instruments) {
      for (const type of ALL_ASSET_TYPES) {
        const info = ASSET_TYPE_INFO[type];
        if (info.markets.includes(market) && info.instruments.includes(inst)) {
          result.add(type);
        }
      }
    }
    return [...result];
  }

  // ── Filter Presets ──────────────────────────────────────────────────────

  getFilterPreset(assetType: AssetType): AssetFilterPreset {
    return ASSET_FILTER_PRESETS[assetType];
  }

  getDefaultWeights(assetType: AssetType): Record<string, number> {
    return { ...ASSET_FILTER_PRESETS[assetType].defaultWeights };
  }

  // ── Optimization Constraints ────────────────────────────────────────────

  getOptimizationConstraints(assetType: AssetType): OptimizationConstraints {
    return OPTIMIZATION_CONSTRAINTS[assetType];
  }

  // ── Cross-Asset-Type Operations ─────────────────────────────────────────

  /**
   * Get factors shared between two asset types.
   * Useful for strategy transition (e.g., switching from US stock to HK stock).
   */
  getSharedFactors(typeA: AssetType, typeB: AssetType): string[] {
    const factorsA = new Set(ASSET_TYPE_FACTORS[typeA]);
    return ASSET_TYPE_FACTORS[typeB].filter(id => factorsA.has(id));
  }

  /**
   * Get factors unique to an asset type (not shared with another).
   */
  getUniqueFactors(type: AssetType, vsType: AssetType): string[] {
    const vsFactors = new Set(ASSET_TYPE_FACTORS[vsType]);
    return ASSET_TYPE_FACTORS[type].filter(id => !vsFactors.has(id));
  }

  /**
   * When switching asset types, determine which factor weights to keep,
   * which to drop, and which new ones to add with default weights.
   */
  switchAssetType(
    fromType: AssetType,
    toType: AssetType,
    currentWeights: Record<string, number>,
  ): {
    keptFactors: string[];
    droppedFactors: string[];
    newFactors: string[];
    newWeights: Record<string, number>;
  } {
    const fromIds = new Set(ASSET_TYPE_FACTORS[fromType]);
    const toIds = new Set(ASSET_TYPE_FACTORS[toType]);
    const defaultWeights = this.getDefaultWeights(toType);

    const keptFactors: string[] = [];
    const droppedFactors: string[] = [];
    const newFactors: string[] = [];

    // Check current weights against new asset type
    for (const id of Object.keys(currentWeights)) {
      if (toIds.has(id)) {
        keptFactors.push(id);
      } else {
        droppedFactors.push(id);
      }
    }

    // Find factors in new type that don't have current weights
    for (const id of toIds) {
      if (!(id in currentWeights) && !fromIds.has(id)) {
        newFactors.push(id);
      }
    }

    // Build new weights: keep existing where applicable, fill new with defaults
    const newWeights: Record<string, number> = {};
    for (const id of keptFactors) {
      newWeights[id] = currentWeights[id];
    }
    for (const id of newFactors) {
      newWeights[id] = defaultWeights[id] ?? 0;
    }

    // Normalize to sum to 1.0
    const total = Object.values(newWeights).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const id of Object.keys(newWeights)) {
        newWeights[id] = Number((newWeights[id] / total).toFixed(4));
      }
    }

    return { keptFactors, droppedFactors, newFactors, newWeights };
  }

  // ── Validation ──────────────────────────────────────────────────────────

  /**
   * Validate that BTC (CRYPTO_SPOT) does NOT return stock-only factors like
   * QUAL, SIZE, YIELD, HML, RMW, CMA, GROWTH, which wouldn't exist for crypto.
   */
  validateCryptoFactors(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const cryptoSpotIds = new Set(ASSET_TYPE_FACTORS[AssetType.CRYPTO_SPOT]);
    const cryptoFutIds = new Set(ASSET_TYPE_FACTORS[AssetType.CRYPTO_FUTURES]);

    // Factors that MUST NOT appear in any crypto asset type
    const stockOnlyFactors = ['QUAL', 'SIZE', 'YIELD', 'HML', 'RMW', 'CMA', 'GROWTH',
      'US_VIX', 'US_SHORT_RATIO', 'US_INST_HOLD', 'US_BUYBACK',
      'HKEX_SOUTHBOUND', 'HKEX_FUND_HOLD', 'HKEX_DLHB',
      'HKEX_CBCS_PREMIUM', 'HKEX_WARRANT_IV', 'OPTION_PCR',
      'SECTOR_ROTATION', 'FX_EXPOSURE', 'KDJ', 'OBV', 'CMF', 'ICHIMOKU'];

    for (const fid of stockOnlyFactors) {
      if (cryptoSpotIds.has(fid)) {
        issues.push(`CRYPTO_SPOT: stock-only factor ${fid} should not be in crypto factor set`);
      }
      if (cryptoFutIds.has(fid)) {
        issues.push(`CRYPTO_FUTURES: stock-only factor ${fid} should not be in crypto factor set`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /** Reset for testing */
  reset(): void {
    this.factorStore.clear();
    this.ready = false;
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

export const ALL_ASSET_TYPES: AssetType[] = [
  AssetType.US_STOCK,
  AssetType.HK_STOCK,
  AssetType.ETF,
  AssetType.FUTURES,
  AssetType.OPTION,
  AssetType.CRYPTO_SPOT,
  AssetType.CRYPTO_FUTURES,
];

export const ALL_ASSET_TYPE_IDS = ALL_ASSET_TYPES as readonly AssetType[];

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: FactorAssetRegistry | null = null;

export function getFactorAssetRegistry(): FactorAssetRegistry {
  if (!instance) instance = new FactorAssetRegistry();
  return instance;
}

export function resetFactorAssetRegistry(): void {
  instance?.reset();
  instance = null;
}

export default {
  FactorAssetRegistry,
  AssetType,
  getFactorAssetRegistry,
  resetFactorAssetRegistry,
  ALL_ASSET_TYPES,
};
