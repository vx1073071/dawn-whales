// ── R170 A1: Factor ID Registry — Global Canonical Naming ──────────────────
// Single source of truth for all factor identifiers across the DAWN WHALES
// factor system. Every module MUST reference factor IDs through this registry.
//
// Before R170, identical factors appeared under different names:
//   risk-model:    MKT  SMB  HML  MOM   LIQ  VOL   QUALITY  SIZE
//   exposure:      market smb hml momentum lowVol quality size
//   compatibility: MOM_12M SIZE HML MOM_1M LIQ VOL_60D QUAL SIZE
//
// After R170, the compatibility-engine naming (MOM_12M, VOL_60D, QUAL, etc.)
// is established as the canonical standard. All other modules resolve their
// legacy names through LEGACY_ID_MAP.

// ── Canonical Factor IDs ───────────────────────────────────────────────────

/** Canonical factor ID — use this type everywhere. */
export type FactorId = string;

/**
 * All 44 canonical factor IDs, grouped by category.
 * This is the single source of truth. If a factor exists in any engine module
 * but not here, it must be added here first.
 */
export const STANDARD_FACTOR_IDS = {
  // ── Universal / Fama-French (11) ─
  MOM_12M: 'MOM_12M',
  MOM_1M: 'MOM_1M',
  LIQ: 'LIQ',
  VOL_60D: 'VOL_60D',
  GROWTH: 'GROWTH',
  QUAL: 'QUAL',
  SIZE: 'SIZE',
  YIELD: 'YIELD',
  HML: 'HML',
  RMW: 'RMW',
  CMA: 'CMA',

  // ── Technical Indicators (10) ─
  MA_20_60: 'MA_20_60',
  EMA_12_26: 'EMA_12_26',
  RSI_14: 'RSI_14',
  KDJ: 'KDJ',
  BOLL: 'BOLL',
  ATR_14: 'ATR_14',
  ADX: 'ADX',
  OBV: 'OBV',
  CMF: 'CMF',
  ICHIMOKU: 'ICHIMOKU',

  // ── HK-specific (5) ─
  HKEX_SOUTHBOUND: 'HKEX_SOUTHBOUND',
  HKEX_CBCS_PREMIUM: 'HKEX_CBCS_PREMIUM',
  HKEX_WARRANT_IV: 'HKEX_WARRANT_IV',
  HKEX_DLHB: 'HKEX_DLHB',
  HKEX_FUND_HOLD: 'HKEX_FUND_HOLD',

  // ── US-specific (4) ─
  US_VIX: 'US_VIX',
  US_SHORT_RATIO: 'US_SHORT_RATIO',
  US_INST_HOLD: 'US_INST_HOLD',
  US_BUYBACK: 'US_BUYBACK',

  // ── Global (3) ─
  OPTION_PCR: 'OPTION_PCR',
  SECTOR_ROTATION: 'SECTOR_ROTATION',
  FX_EXPOSURE: 'FX_EXPOSURE',

  // ── Old Engine Legacy IDs (mapped to standard) ─
  /** @deprecated Use SIZE instead */
  SMB: 'SMB',
  /** @deprecated Use QUAL instead */
  QUALITY: 'QUALITY',

  // ── Crypto-specific (10) ─
  CRYPTO_FUNDING: 'CRYPTO_FUNDING',
  CRYPTO_OI_DELTA: 'CRYPTO_OI_DELTA',
  CRYPTO_EXCHANGE_FLOW: 'CRYPTO_EXCHANGE_FLOW',
  CRYPTO_ORDERBOOK_IMB: 'CRYPTO_ORDERBOOK_IMB',
  CRYPTO_VOL_RATIO: 'CRYPTO_VOL_RATIO',
  CRYPTO_VOLUME_PROFILE: 'CRYPTO_VOLUME_PROFILE',
  CRYPTO_BTC_CORR: 'CRYPTO_BTC_CORR',
  CRYPTO_NVT: 'CRYPTO_NVT',
  CRYPTO_ACTIVE_ADDR: 'CRYPTO_ACTIVE_ADDR',
  CRYPTO_LIQUIDATIONS: 'CRYPTO_LIQUIDATIONS',

  // ── Market Meta-Factor (used by risk-model, not a tradable factor) ─
  MKT: 'MKT',
} as const;

/** Canonical factor IDs array */
export const ALL_STANDARD_FACTOR_IDS: FactorId[] = Object.values(STANDARD_FACTOR_IDS);

// ── Legacy ID Map ──────────────────────────────────────────────────────────

/**
 * Maps legacy / alternative factor names to their canonical standard ID.
 *
 * Sources of legacy names:
 *   - factor-risk-model.ts: MKT/SMB/HML/MOM/LIQ/VOL/GROWTH/QUALITY/SIZE
 *   - factor-exposure.ts: market/smb/hml/momentum/lowVol/quality (camelCase)
 *   - Various comments / old code using short-forms
 */
export const LEGACY_ID_MAP: Record<string, FactorId> = {
  // ── Risk-model legacy names ──────────────────────────────────────────
  MOM: STANDARD_FACTOR_IDS.MOM_12M,
  VOL: STANDARD_FACTOR_IDS.VOL_60D,
  SMB: STANDARD_FACTOR_IDS.SIZE,
  QUALITY: STANDARD_FACTOR_IDS.QUAL,

  // ── Exposure module legacy names ─────────────────────────────────────
  market: STANDARD_FACTOR_IDS.MKT,
  smb: STANDARD_FACTOR_IDS.SIZE,
  hml: STANDARD_FACTOR_IDS.HML,
  rmw: STANDARD_FACTOR_IDS.RMW,
  cma: STANDARD_FACTOR_IDS.CMA,
  momentum: STANDARD_FACTOR_IDS.MOM_12M,
  lowVol: STANDARD_FACTOR_IDS.VOL_60D,
  quality: STANDARD_FACTOR_IDS.QUAL,

  // ── Common shorthand ─────────────────────────────────────────────────
  volatility: STANDARD_FACTOR_IDS.VOL_60D,
  value: STANDARD_FACTOR_IDS.HML,
  profitability: STANDARD_FACTOR_IDS.RMW,
  investment: STANDARD_FACTOR_IDS.CMA,

  // ── Very old / deprecated (pre-R158) ─────────────────────────────────
  MOMENTUM: STANDARD_FACTOR_IDS.MOM_12M,
  VOLATILITY: STANDARD_FACTOR_IDS.VOL_60D,
  LOW_VOL: STANDARD_FACTOR_IDS.VOL_60D,
  LOWVOL: STANDARD_FACTOR_IDS.VOL_60D,
  MARKET_CAP: STANDARD_FACTOR_IDS.SIZE,
  VALUE: STANDARD_FACTOR_IDS.HML,
  PROFITABILITY: STANDARD_FACTOR_IDS.RMW,
  INVESTMENT: STANDARD_FACTOR_IDS.CMA,
  DIVIDEND: STANDARD_FACTOR_IDS.YIELD,
  DIV_YIELD: STANDARD_FACTOR_IDS.YIELD,
} as const;

// ── Factor Category Mapping ────────────────────────────────────────────────

export type FactorCategory =
  | 'momentum' | 'volatility' | 'value' | 'quality' | 'growth'
  | 'size' | 'yield' | 'sentiment' | 'macro' | 'technical'
  | 'hk_specific' | 'us_specific' | 'crypto' | 'market_meta';

export const FACTOR_CATEGORY_MAP: Record<FactorId, FactorCategory> = {
  [STANDARD_FACTOR_IDS.MOM_12M]: 'momentum',
  [STANDARD_FACTOR_IDS.MOM_1M]: 'momentum',
  [STANDARD_FACTOR_IDS.LIQ]: 'technical',
  [STANDARD_FACTOR_IDS.VOL_60D]: 'volatility',
  [STANDARD_FACTOR_IDS.GROWTH]: 'growth',
  [STANDARD_FACTOR_IDS.QUAL]: 'quality',
  [STANDARD_FACTOR_IDS.SIZE]: 'size',
  [STANDARD_FACTOR_IDS.YIELD]: 'yield',
  [STANDARD_FACTOR_IDS.HML]: 'value',
  [STANDARD_FACTOR_IDS.RMW]: 'quality',
  [STANDARD_FACTOR_IDS.CMA]: 'quality',
  [STANDARD_FACTOR_IDS.MA_20_60]: 'technical',
  [STANDARD_FACTOR_IDS.EMA_12_26]: 'technical',
  [STANDARD_FACTOR_IDS.RSI_14]: 'momentum',
  [STANDARD_FACTOR_IDS.KDJ]: 'momentum',
  [STANDARD_FACTOR_IDS.BOLL]: 'volatility',
  [STANDARD_FACTOR_IDS.ATR_14]: 'volatility',
  [STANDARD_FACTOR_IDS.ADX]: 'technical',
  [STANDARD_FACTOR_IDS.OBV]: 'technical',
  [STANDARD_FACTOR_IDS.CMF]: 'technical',
  [STANDARD_FACTOR_IDS.ICHIMOKU]: 'technical',
  [STANDARD_FACTOR_IDS.HKEX_SOUTHBOUND]: 'sentiment',
  [STANDARD_FACTOR_IDS.HKEX_CBCS_PREMIUM]: 'hk_specific',
  [STANDARD_FACTOR_IDS.HKEX_WARRANT_IV]: 'hk_specific',
  [STANDARD_FACTOR_IDS.HKEX_DLHB]: 'hk_specific',
  [STANDARD_FACTOR_IDS.HKEX_FUND_HOLD]: 'hk_specific',
  [STANDARD_FACTOR_IDS.US_VIX]: 'volatility',
  [STANDARD_FACTOR_IDS.US_SHORT_RATIO]: 'us_specific',
  [STANDARD_FACTOR_IDS.US_INST_HOLD]: 'us_specific',
  [STANDARD_FACTOR_IDS.US_BUYBACK]: 'us_specific',
  [STANDARD_FACTOR_IDS.OPTION_PCR]: 'sentiment',
  [STANDARD_FACTOR_IDS.SECTOR_ROTATION]: 'macro',
  [STANDARD_FACTOR_IDS.FX_EXPOSURE]: 'macro',
  [STANDARD_FACTOR_IDS.CRYPTO_FUNDING]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_OI_DELTA]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_EXCHANGE_FLOW]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_ORDERBOOK_IMB]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_VOL_RATIO]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_VOLUME_PROFILE]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_BTC_CORR]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_NVT]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_ACTIVE_ADDR]: 'crypto',
  [STANDARD_FACTOR_IDS.CRYPTO_LIQUIDATIONS]: 'crypto',
  [STANDARD_FACTOR_IDS.MKT]: 'market_meta',
};

// ── Utility Functions ──────────────────────────────────────────────────────

/**
 * Resolve any factor ID (standard or legacy) to its canonical form.
 * Returns the same ID if already canonical and not in the legacy map.
 */
export function resolveFactorId(id: string): FactorId {
  // Check legacy map first
  const mapped = (LEGACY_ID_MAP as Record<string, string>)[id];
  if (mapped) return mapped;
  // Check standard IDs
  if (ALL_STANDARD_FACTOR_IDS.includes(id)) return id;
  // Not recognized — return as-is (safe fallback)
  return id;
}

/**
 * Check if a factor ID is a canonical standard ID.
 */
export function isStandardFactorId(id: string): boolean {
  return ALL_STANDARD_FACTOR_IDS.includes(id);
}

/**
 * Resolve multiple factor IDs at once.
 */
export function resolveFactorIds(ids: string[]): FactorId[] {
  return ids.map(resolveFactorId);
}

/**
 * Get all canonical factor IDs excluding deprecated ones.
 */
export function getCanonicalFactorIds(): FactorId[] {
  return ALL_STANDARD_FACTOR_IDS.filter(id => id !== 'SMB' && id !== 'QUALITY');
}

/**
 * Get factor IDs by category.
 */
export function getFactorIdsByCategory(category: FactorCategory): FactorId[] {
  return Object.entries(FACTOR_CATEGORY_MAP)
    .filter(([, cat]) => cat === category)
    .map(([id]) => id);
}

/**
 * Get the category for a factor ID (resolves legacy IDs first).
 */
export function getFactorCategory(id: string): FactorCategory | undefined {
  const resolved = resolveFactorId(id);
  return FACTOR_CATEGORY_MAP[resolved];
}
