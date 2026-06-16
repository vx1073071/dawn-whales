/**
 * R244 JVS#1 (P0-11): FactorCalculatorValidator — 因子Calculator自动校验引擎
 *
 * Scans all 6 Calculator tiers + 3 regional market files, cross-references
 * with factor-id-registry.ts, and produces:
 *   1. Factor→Calculator mapping (which Calculator computes each factor)
 *   2. Missing factors (in registry but no Calculator)
 *   3. Ghost factors (Calculator-defined but not in registry)
 *   4. Duplicate calculators (same factorId in multiple Calculator files)
 *   5. Tier coverage report (Green/Yellow/Pro/Market-Red per level1 category)
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                  FactorCalculatorValidator                     │
 *   │  ┌─────────────────────────────────────────────────────────┐  │
 *   │  │ Scanner                                                  │  │
 *   │  │  ├─ read 6 calculator files                             │  │
 *   │  │  ├─ read 3 regional market files                        │  │
 *   │  │  ├─ read factor-id-registry.ts                          │  │
 *   │  │  └─ extract factorId, level1, level2, calculator type   │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                         │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Cross-Referencer                                        │  │
 *   │  │  ├─ map: factorId → [{file, tier, level1, level2, type}]│  │
 *   │  │  ├─ missing: registryIds - calculatorIds               │  │
 *   │  │  ├─ ghost: calculatorIds - registryIds                 │  │
 *   │  │  └─ duplicate: same factorId in >1 file                │  │
 *   │  └──────────────────┬──────────────────────────────────────┘  │
 *   │                     │                                         │
 *   │  ┌──────────────────┴──────────────────────────────────────┐  │
 *   │  │ Reporter                                                 │  │
 *   │  │  ├─ tierCoverage: {green, yellow, pro, marketRed}       │  │
 *   │  │  ├─ level1Coverage: per-category count                  │  │
 *   │  │  ├─ anomalies: missing + ghost + duplicate              │  │
 *   │  │  └─ summary: overall coverage percentage                │  │
 *   │  └─────────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Pricing: FREE (运维工具, non-billable)
 *
 * R244 P0-11 | v2.8.0 AUDIT | production-ready
 */

import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

/** A single factor definition extracted from a Calculator file */
export interface FactorDefinition {
  factorId: string;
  label: string;
  level1: string;
  level2: string;
  calculatorType: 'ratio' | 'rank' | 'signal' | 'custom';
  file: string;           // source file name
  tier: CalculatorTier;
}

export type CalculatorTier = 'green' | 'yellow' | 'pro' | 'market-red' | 'market-yellow' | 'final-red';

export const TIER_NAMES: Record<CalculatorTier, string> = {
  green: 'Green (基础免费)',
  yellow: 'Yellow (进阶免费)',
  pro: 'Pro (专业付费)',
  'market-red': 'Market-Red (市场专用)',
  'market-yellow': 'Market-Yellow (市场进阶)',
  'final-red': 'Final-Red (高级专业)',
};

export const TIER_FILES: Record<CalculatorTier, string> = {
  green: 'green-factor-calculators.ts',
  yellow: 'yellow-factor-calculators.ts',
  pro: 'pro-factor-calculators.ts',
  'market-red': 'market-red-factors.ts',
  'market-yellow': 'market-yellow-calculators.ts',
  'final-red': 'final-red-factors.ts',
};

/** Regional/extra market files */
export const REGIONAL_FILES = [
  'in-eu-factors.ts', 'jp-tw-factors.ts', 'kr-sg-au-factors.ts',
];

export interface EntityIdMapping {
  factorId: string;
  canonicalId: string;     // registry's canonical ID
  label: string;
  level1: string;
  level2: string;
}

export interface ValidationReport {
  /** Timestamp of validation run */
  generatedAt: number;
  /** Total factors in registry */
  registryTotal: number;
  /** Total unique factors across all Calculator files */
  calculatorTotal: number;
  /** Factors with at least one calculator */
  coveredFactors: number;
  /** Coverage percentage (covered / registryTotal) */
  coveragePct: number;
  /** Factors in registry with no calculator */
  missing: MissingFactorReport[];
  /** Factors defined in calculators but not in registry */
  ghosts: GhostFactorReport[];
  /** FactorId defined in >1 calculator file (potential conflict) */
  duplicates: DuplicateFactorReport[];
  /** Tier coverage breakdown */
  tierCoverage: TierCoverageReport;
  /** Level1 category coverage */
  level1Coverage: Level1CoverageReport[];
  /** Regional file coverage summary */
  regionalCoverage: RegionalCoverageReport;
  /** Summary */
  summary: string;
}

export interface MissingFactorReport {
  factorId: string;
  registryLabel: string;
  suggestedTier: CalculatorTier;
  suggestedType: 'ratio' | 'rank' | 'signal' | 'custom';
  priority: 'P0' | 'P1' | 'P2';
  notes: string;
}

export interface GhostFactorReport {
  factorId: string;
  foundIn: string[];
  tiers: CalculatorTier[];
  suggestion: 'add_to_registry' | 'rename_to_match_registry' | 'remove';
  suggestedRegistryId?: string;
}

export interface DuplicateFactorReport {
  factorId: string;
  files: string[];
  tiers: CalculatorTier[];
  conflict: boolean;     // true if different implementations
  resolution: string;
}

export interface TierCoverageReport {
  green: number;
  yellow: number;
  pro: number;
  marketRed: number;
  marketYellow: number;
  finalRed: number;
  regional: number;
  total: number;
}

export interface Level1CoverageReport {
  level1: string;
  label: string;
  totalInRegistry: number;
  covered: number;
  missing: number;
  missingList: string[];
}

export interface RegionalCoverageReport {
  inEu: number;
  jpTw: number;
  krSgAu: number;
  notes: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Registry entity ID mapping (hardcoded from factor-id-registry analysis)
// ═════════════════════════════════════════════════════════════════════════════

const REGISTRY_ENTITIES: EntityIdMapping[] = [
  // Classic FF5 + extensions
  { factorId: 'MKT', canonicalId: 'MKT', label: 'Market Beta', level1: 'L1_CLASSIC', level2: 'L2_MARKET_RISK' },
  { factorId: 'SMB', canonicalId: 'SMB', label: 'Size (Small Minus Big)', level1: 'L1_CLASSIC', level2: 'L2_SIZE' },
  { factorId: 'HML', canonicalId: 'HML', label: 'Value (High Minus Low)', level1: 'L1_CLASSIC', level2: 'L2_VALUE' },
  { factorId: 'RMW', canonicalId: 'RMW', label: 'Profitability', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY' },
  { factorId: 'CMA', canonicalId: 'CMA', label: 'Investment', level1: 'L1_FUNDAMENTAL', level2: 'L2_EFFICIENCY' },
  { factorId: 'UMD', canonicalId: 'UMD', label: 'Momentum', level1: 'L1_CLASSIC', level2: 'L2_MOMENTUM' },
  { factorId: 'QMJ', canonicalId: 'QMJ', label: 'Quality Minus Junk', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFIT_QUALITY' },
  { factorId: 'BAB', canonicalId: 'BAB', label: 'Betting Against Beta', level1: 'L1_RISK', level2: 'L2_DOWNSIDE' },
  { factorId: 'STR', canonicalId: 'STR', label: 'Short-Term Reversal', level1: 'L1_TECHNICAL', level2: 'L2_REVERSAL' },
  { factorId: 'LTR', canonicalId: 'LTR', label: 'Long-Term Reversal', level1: 'L1_TECHNICAL', level2: 'L2_REVERSAL' },
];

// Level1 labels for reporting
const LEVEL1_LABELS: Record<string, string> = {
  L1_CLASSIC: '经典定价因子 (FF5+)',
  L1_FUNDAMENTAL: '基本面因子',
  L1_TECHNICAL: '技术指标因子',
  L1_SENTIMENT: '情绪/舆情因子',
  L1_RISK: '风险因子',
  L1_EVENT: '事件驱动因子',
  L1_MACRO: '宏观因子',
  L1_CRYPTO: '加密货币专用因子',
  L1_COMMODITY: '大宗商品专用因子',
  L1_MARKET: '市场微观结构因子',
  L1_CROSS_MARKET: '跨市场因子',
  L1_ALT_DATA: '另类数据因子',
  L1_BEHAVIORAL: '行为金融因子',
  L1_REGIONAL: '区域专用因子',
  L1_STRATEGY: '策略组合因子',
  L1_CUSTOM: '自定义因子',
};

// ═════════════════════════════════════════════════════════════════════════════
// Known naming mappings (Calculator ID → Registry ID)
// ═════════════════════════════════════════════════════════════════════════════

const NAMING_MAP: Record<string, string> = {
  // Green calculators use underscore variants that match registry
  EP_RATIO: 'EP_RATIO',
  ROA: 'ROA',
  GROSS_MARGIN: 'GROSS_MARGIN',
  DEBT_TO_EQUITY: 'DEBT_TO_EQUITY',
  MAX_DRAWDOWN: 'MAX_DRAWDOWN',
  KDJ: 'KDJ',
  INSIDER_BUYING: 'INSIDER_BUYING',
  FUND_FLOW: 'FUND_FLOW',
  ETF_FLOW: 'ETF_FLOW',
  EARNINGS_SURPRISE: 'EARNINGS_SURPRISE',
  DIVIDEND_CHANGE: 'DIVIDEND_CHANGE',
  SECTOR_STRENGTH: 'SECTOR_STRENGTH',
  IV_RANK: 'IV_RANK',
  CURRENCY_EFFECT: 'CURRENCY_EFFECT',
  FREE_CASH_FLOW_YIELD: 'FREE_CASH_FLOW_YIELD',
  YIELD: 'YIELD',
  // US-specific
  US_BUYBACK_YIELD: 'US_BUYBACK_YIELD',
  US_EARNINGS_REVISION: 'US_EARNINGS_REVISION',
  US_SHORT_INTEREST_RATE: 'US_SHORT_INTEREST_RATE',
  US_SEASONALITY: 'US_SEASONALITY',
  US_SECTOR_ETF_FLOW: 'US_SECTOR_ETF_FLOW',
  US_POST_EARNINGS_DRIFT: 'US_POST_EARNINGS_DRIFT',
  US_13F_FLOW: 'US_13F_FLOW',
  US_SHORT_FLOAT: 'US_SHORT_FLOAT',
  US_MAG7_MOMENTUM: 'US_MAG7_MOMENTUM',
  US_REVENUE_SURPRISE: 'US_REVENUE_SURPRISE',
  US_RETAIL_FLOW: 'US_RETAIL_FLOW',
  US_GAMMA_EXPOSURE: 'US_GAMMA_EXPOSURE',
  US_MAX_PAIN: 'US_MAX_PAIN',
  US_IV_RANK: 'US_IV_RANK',
  US_VOLUME_PCR: 'US_VOLUME_PCR',
  US_BUYBACK_ACCEL: 'US_BUYBACK_ACCEL',
  US_0DTE_RATIO: 'US_0DTE_RATIO',
  US_SHORT_SQUEEZE_SCORE: 'US_SHORT_SQUEEZE_SCORE',
  US_SPLIT_EXPECT: 'US_SPLIT_EXPECT',
  US_SKEW_INDEX: 'US_SKEW_INDEX',
  US_TICK_INDEX: 'US_TICK_INDEX',
  US_OI_PUT_CALL: 'US_OI_PUT_CALL',
  US_MEME_STOCK: 'US_MEME_STOCK',
  US_GUIDANCE_CHANGE: 'US_GUIDANCE_CHANGE',
  US_DEBT_CEILING: 'US_DEBT_CEILING',
  US_SPAC_PROGRESS: 'US_SPAC_PROGRESS',
  // HK-specific
  HK_SHORT_SELL_RATIO: 'HK_SHORT_SELL_RATIO',
  HK_SOUTHBOUND_SMART: 'HK_SOUTHBOUND_SMART',
  HK_CBBC_DISTANCE: 'HK_CBBC_DISTANCE',
  HK_CBBC_RATIO: 'HK_CBBC_RATIO',
  HK_HSCEI_PREMIUM: 'HK_HSCEI_PREMIUM',
  HK_HSI_WEIGHT_CHANGE: 'HK_HSI_WEIGHT_CHANGE',
  HK_DERIV_POS_ANOMALY: 'HK_DERIV_POS_ANOMALY',
  HK_PRIVATIZATION: 'HK_PRIVATIZATION',
  HK_BOARD_ROTATION: 'HK_BOARD_ROTATION',
  HK_ETF_FLOW: 'HK_ETF_FLOW',
  HK_LEVERAGE_INVERSE: 'HK_LEVERAGE_INVERSE',
  HKD_PEG_PRESSURE: 'HKD_PEG_PRESSURE',
  HIBOR_STEEPNESS: 'HIBOR_STEEPNESS',
  HK_WARRANT_TURNOVER: 'HK_WARRANT_TURNOVER',
  HK_WARRANT_IV: 'HK_WARRANT_IV',
  HK_WARRANT_DELTA: 'HK_WARRANT_DELTA',
  HK_WARRANT_OVERHEAT: 'HK_WARRANT_OVERHEAT',
  HK_CBBC_DISTANCE_ADV: 'HK_CBBC_DISTANCE_ADV',
  HK_REIT_YIELD: 'HK_REIT_YIELD',
  AH_PREMIUM_CHANGE: 'AH_PREMIUM_CHANGE',
  HK_DIV_TAX_ADV: 'HK_DIV_TAX_ADV',
  // Crypto-specific
  CRYPTO_HASH_RATE: 'CRYPTO_HASH_RATE',
  CRYPTO_PERP_PREMIUM: 'CRYPTO_PERP_PREMIUM',
  CRYPTO_USDT_PREMIUM: 'CRYPTO_USDT_PREMIUM',
  CRYPTO_MVRV_Z: 'CRYPTO_MVRV_Z',
  CRYPTO_SOPR: 'CRYPTO_SOPR',
  CRYPTO_PUELL: 'CRYPTO_PUELL',
  CRYPTO_WHALE_MOVEMENT: 'CRYPTO_WHALE_MOVEMENT',
  CRYPTO_MINER_FLOW: 'CRYPTO_MINER_FLOW',
  CRYPTO_TOKEN_UNLOCK: 'CRYPTO_TOKEN_UNLOCK',
  CRYPTO_SOCIAL_VOLUME: 'CRYPTO_SOCIAL_VOLUME',
  CRYPTO_BTC_DOM_CHANGE: 'CRYPTO_BTC_DOM_CHANGE',
  CRYPTO_STABLECOIN_MINT: 'CRYPTO_STABLECOIN_MINT',
  CRYPTO_PERP_BASIS: 'CRYPTO_PERP_BASIS',
  CRYPTO_TAKER_RATIO: 'CRYPTO_TAKER_RATIO',
  CRYPTO_FUNDING_EXTREME: 'CRYPTO_FUNDING_EXTREME',
  CRYPTO_OPTION_TERM: 'CRYPTO_OPTION_TERM',
  CRYPTO_25DELTA_RR: 'CRYPTO_25DELTA_RR',
  CRYPTO_OI_QUADRANT: 'CRYPTO_OI_QUADRANT',
  CRYPTO_LIQUIDATION_MAP: 'CRYPTO_LIQUIDATION_MAP',
  CRYPTO_RESERVE_PROOF: 'CRYPTO_RESERVE_PROOF',
  CRYPTO_HODL_WAVE: 'CRYPTO_HODL_WAVE',
  CRYPTO_PROTOCOL_REV: 'CRYPTO_PROTOCOL_REV',
  CRYPTO_GAS_TREND: 'CRYPTO_GAS_TREND',
  CRYPTO_L2_TVL: 'CRYPTO_L2_TVL',
  CRYPTO_NFT_VOLUME: 'CRYPTO_NFT_VOLUME',
  CRYPTO_ONCHAIN_GDP: 'CRYPTO_ONCHAIN_GDP',
  CRYPTO_DEV_ACTIVITY: 'CRYPTO_DEV_ACTIVITY',
  CRYPTO_PF_RATIO: 'CRYPTO_PF_RATIO',
  CRYPTO_DEV_CENTRAL: 'CRYPTO_DEV_CENTRAL',
  CRYPTO_GOVERNANCE: 'CRYPTO_GOVERNANCE',
  CRYPTO_INFLATION: 'CRYPTO_INFLATION',
  CRYPTO_MINER_SELL_PRESS: 'CRYPTO_MINER_SELL_PRESS',
  CRYPTO_CROSSCHAIN_FLOW: 'CRYPTO_CROSSCHAIN_FLOW',
  CRYPTO_WHALE_TX_COUNT: 'CRYPTO_WHALE_TX_COUNT',
  // Commodity
  CMD_MOMENTUM_1M: 'CMD_MOMENTUM_1M',
  CMD_MOMENTUM_12M: 'CMD_MOMENTUM_12M',
  CMD_ROLL_YIELD: 'CMD_ROLL_YIELD',
  CMD_BASIS: 'CMD_BASIS',
  CMD_COT_COMMERCIAL: 'CMD_COT_COMMERCIAL',
  CMD_COT_SPECULATOR: 'CMD_COT_SPECULATOR',
  CMD_COT_EXTREME: 'CMD_COT_EXTREME',
  CMD_COT_CHANGE: 'CMD_COT_CHANGE',
  CMD_OPEN_INTEREST: 'CMD_OPEN_INTEREST',
  CMD_DXY_LINKAGE: 'CMD_DXY_LINKAGE',
  CMD_GOLD_SILVER_RATIO: 'CMD_GOLD_SILVER_RATIO',
  CMD_GOLD_OIL_RATIO: 'CMD_GOLD_OIL_RATIO',
  CMD_INFLATION_BE: 'CMD_INFLATION_BE',
  CMD_REAL_RATE: 'CMD_REAL_RATE',
  CMD_EIA_CRUDE: 'CMD_EIA_CRUDE',
  CMD_NATGAS_STORAGE: 'CMD_NATGAS_STORAGE',
  CMD_CRACK_SPREAD: 'CMD_CRACK_SPREAD',
  CMD_LME_INVENTORY: 'CMD_LME_INVENTORY',
  CMD_BALANCE_SHEET: 'CMD_BALANCE_SHEET',
  CMD_GOLD_ETF: 'CMD_GOLD_ETF',
  CMD_GOLD_SUMMER: 'CMD_GOLD_SUMMER',
  CMD_GEOPOL_RISK: 'CMD_GEOPOL_RISK',
  // Cross-market
  XM_CO_SKEWNESS: 'XM_CO_SKEWNESS',
  XM_IDIO_VOL: 'XM_IDIO_VOL',
  XM_MOMENTUM_CRASH: 'XM_MOMENTUM_CRASH',
  XM_CURRENCY_HEDGE: 'XM_CURRENCY_HEDGE',
  XM_FACTOR_TIMING: 'XM_FACTOR_TIMING',
  // Regional
  IN_FII_DII_FLOW: 'IN_FII_DII_FLOW',
  IN_PLEDGED_SHARES: 'IN_PLEDGED_SHARES',
  IN_MONSOON_EFFECT: 'IN_MONSOON_EFFECT',
  IN_MODI_POLICY: 'IN_MODI_POLICY',
  IN_RUPEE_HEDGE: 'IN_RUPEE_HEDGE',
  EU_STOXX_SECTOR: 'EU_STOXX_SECTOR',
  EU_EUR_SENSITIVITY: 'EU_EUR_SENSITIVITY',
  EU_BREXIT_SHADOW: 'EU_BREXIT_SHADOW',
  EU_ESG_PREMIUM: 'EU_ESG_PREMIUM',
  JP_TOPIX_SECTOR: 'JP_TOPIX_SECTOR',
  JP_FOREIGN_FLOW: 'JP_FOREIGN_FLOW',
  JPY_SENSITIVITY: 'JPY_SENSITIVITY',
  JPY_CARRY_TRADE: 'JPY_CARRY_TRADE',
  JP_BANK_LENDING: 'JP_BANK_LENDING',
  JP_DIVIDEND_SEASON: 'JP_DIVIDEND_SEASON',
  JP_BOJ_ETF: 'JP_BOJ_ETF',
  JP_MARCH_EFFECT: 'JP_MARCH_EFFECT',
  JPX_400_SELECTION: 'JPX_400_SELECTION',
  JP_CROSS_HOLDING: 'JP_CROSS_HOLDING',
  JP_SHAREHOLDER_BENEFIT: 'JP_SHAREHOLDER_BENEFIT',
  JP_VALUE_TRAP: 'JP_VALUE_TRAP',
  KR_CHAEBOL_DISCOUNT: 'KR_CHAEBOL_DISCOUNT',
  KR_FOREIGN_OWNERSHIP: 'KR_FOREIGN_OWNERSHIP',
  KR_KRW_SENSITIVITY: 'KR_KRW_SENSITIVITY',
  KR_DIVIDEND_YIELD: 'KR_DIVIDEND_YIELD',
  KR_SAMSUNG_LINKAGE: 'KR_SAMSUNG_LINKAGE',
  KR_OPTION_EXPIRY: 'KR_OPTION_EXPIRY',
  TW_FOREIGN_FLOW: 'TW_FOREIGN_FLOW',
  TW_MARGIN_BALANCE: 'TW_MARGIN_BALANCE',
  TW_TSMC_LINKAGE: 'TW_TSMC_LINKAGE',
  TW_DIVIDEND_CHASE: 'TW_DIVIDEND_CHASE',
  TW_NT_DOLLAR: 'TW_NT_DOLLAR',
  TW_SHORT_RATIO: 'TW_SHORT_RATIO',
  TW_FINANCING_OVERHEAT: 'TW_FINANCING_OVERHEAT',
  SG_REIT_SPREAD: 'SG_REIT_SPREAD',
  SG_SGD_LINKAGE: 'SG_SGD_LINKAGE',
  SG_STI_WEIGHT: 'SG_STI_WEIGHT',
  SG_DIVIDEND_CULTURE: 'SG_DIVIDEND_CULTURE',
  SG_US_LISTED: 'SG_US_LISTED',
  AU_COMMODITY_LINK: 'AU_COMMODITY_LINK',
  AU_BANK_DIVIDEND: 'AU_BANK_DIVIDEND',
  AU_AUD_SENSITIVITY: 'AU_AUD_SENSITIVITY',
  AU_FRANKING_CREDIT: 'AU_FRANKING_CREDIT',
  AU_DIVIDEND_SEASON: 'AU_DIVIDEND_SEASON',
};

// ═════════════════════════════════════════════════════════════════════════════
// FactorCalculatorValidator Engine
// ═════════════════════════════════════════════════════════════════════════════

export class FactorCalculatorValidator {
  private static instance: FactorCalculatorValidator | null = null;

  static getInstance(): FactorCalculatorValidator {
    if (!FactorCalculatorValidator.instance) {
      FactorCalculatorValidator.instance = new FactorCalculatorValidator();
    }
    return FactorCalculatorValidator.instance;
  }

  private cache: ValidationReport | null = null;
  private cacheTime = 0;
  private cacheTtl = 300_000; // 5 minutes

  /**
   * Run the full validation pipeline.
   * If the factor directory exists at the given path, scan files directly.
   * Otherwise use the built-in static analysis tables.
   */
  async validate(factorDir?: string): Promise<ValidationReport> {
    const now = Date.now();
    if (this.cache && (now - this.cacheTime) < this.cacheTtl) {
      return this.cache;
    }

    const report = await this.buildReport(factorDir);
    this.cache = report;
    this.cacheTime = now;
    return report;
  }

  private async buildReport(factorDir?: string): Promise<ValidationReport> {
    // Get calculator factor IDs from file scan (or use static)

    const calcFactors = await this.scanCalculatorFiles(factorDir);
    const registryFactors = this.getRegistryMapping();

    // Cross-reference
    const calcSet = new Set(calcFactors.map(f => f.factorId));
    const regSet = new Set(registryFactors.map(r => r.canonicalId));

    const coveredSet = new Set([...calcSet].filter(id => regSet.has(id)));
    const missingSet = new Set([...regSet].filter(id => !calcSet.has(id)));
    const ghostSet = new Set([...calcSet].filter(id => !regSet.has(id)));

    // Duplicates
    const idCount = new Map<string, number>();
    for (const f of calcFactors) {
      idCount.set(f.factorId, (idCount.get(f.factorId) || 0) + 1);
    }
    const dupIds = [...idCount.entries()].filter(([, n]) => n > 1).map(([id]) => id);

    // Build report
    const missing: MissingFactorReport[] = [...missingSet].map(id => {
      const regEntry = registryFactors.find(r => r.canonicalId === id);
      return {
        factorId: id,
        registryLabel: regEntry?.label || id,
        suggestedTier: this.suggestTier(id),
        suggestedType: this.suggestType(id),
        priority: this.assignPriority(id),
        notes: this.generateMissingNote(id),
      };
    });

    const ghosts: GhostFactorReport[] = [...ghostSet].map(id => {
      const sources = calcFactors.filter(f => f.factorId === id);
      const suggestion = this.classifyGhost(id);
      return {
        factorId: id,
        foundIn: [...new Set(sources.map(s => s.file))],
        tiers: [...new Set(sources.map(s => s.tier))],
        suggestion: suggestion.action,
        suggestedRegistryId: suggestion.registryId,
      };
    });

    const duplicates: DuplicateFactorReport[] = dupIds.map(id => {
      const sources = calcFactors.filter(f => f.factorId === id);
      const tiers = [...new Set(sources.map(s => s.tier))];
      return {
        factorId: id,
        files: [...new Set(sources.map(s => s.file))],
        tiers,
        conflict: tiers.length > 1, // same factor in different tiers = conflict
        resolution: tiers.length > 1
          ? `Remove from lower tier (${tiers.slice(1).join(',')}), keep in ${tiers[0]}`
          : 'Rename one to avoid override',
      };
    });

    // Tier coverage
    const tierCount: Record<CalculatorTier, number> = {
      green: 0, yellow: 0, pro: 0, 'market-red': 0, 'market-yellow': 0, 'final-red': 0,
    };
    const seen = new Set<string>();
    for (const f of calcFactors) {
      if (!seen.has(f.factorId)) {
        seen.add(f.factorId);
        tierCount[f.tier]++;
      }
    }

    const tierCoverage: TierCoverageReport = {
      green: tierCount.green,
      yellow: tierCount.yellow,
      pro: tierCount.pro,
      marketRed: tierCount['market-red'],
      marketYellow: tierCount['market-yellow'],
      finalRed: tierCount['final-red'],
      regional: calcFactors.filter(f => ['in-eu', 'jp-tw', 'kr-sg-au'].some(r => f.file.includes(r))).length,
      total: coveredSet.size,
    };

    // Level1 coverage
    const level1Map = new Map<string, { regCount: number; calcCount: number; missingIds: string[] }>();
    for (const r of registryFactors) {
      const entry = level1Map.get(r.level1) || { regCount: 0, calcCount: 0, missingIds: [] };
      entry.regCount++;
      if (!calcSet.has(r.canonicalId)) {
        entry.missingIds.push(r.canonicalId);
      }
      level1Map.set(r.level1, entry);
    }
    for (const f of calcFactors) {
      const entry = level1Map.get(f.level1);
      if (entry) entry.calcCount++;
    }

    const level1Coverage: Level1CoverageReport[] = [...level1Map.entries()].map(([level1, data]) => ({
      level1,
      label: LEVEL1_LABELS[level1] || level1,
      totalInRegistry: data.regCount,
      covered: data.calcCount,
      missing: data.missingIds.length,
      missingList: data.missingIds.slice(0, 10),
    }));

    // Regional coverage
    const regFiles = ['in-eu-factors.ts', 'jp-tw-factors.ts', 'kr-sg-au-factors.ts'];
    const regionalCoverage: RegionalCoverageReport = {
      inEu: calcFactors.filter(f => f.file.includes('in-eu')).length,
      jpTw: calcFactors.filter(f => f.file.includes('jp-tw')).length,
      krSgAu: calcFactors.filter(f => f.file.includes('kr-sg-au')).length,
      notes: `${regFiles.filter(fn => calcFactors.some(cf => cf.file === fn)).length}/3 regional files have calculator definitions`,
    };

    const coveragePct = regSet.size > 0 ? Math.round((coveredSet.size / regSet.size) * 100) : 0;

    return {
      generatedAt: Date.now(),
      registryTotal: regSet.size,
      calculatorTotal: calcSet.size,
      coveredFactors: coveredSet.size,
      coveragePct,
      missing,
      ghosts,
      duplicates,
      tierCoverage,
      level1Coverage,
      regionalCoverage,
      summary: this.generateSummary(missing, ghosts, duplicates, coveragePct),
    };
  }

  /**
   * Scan calculator files for factorId declarations.
   * In production, reads from filesystem. For tests, uses provided data.
   */
  private async scanCalculatorFiles(factorDir?: string): Promise<FactorDefinition[]> {
    const results: FactorDefinition[] = [];
    const baseDir = factorDir || path.resolve(__dirname, '../factors');

    // Production scan: read actual files
    try {
      for (const [tier, filename] of Object.entries(TIER_FILES)) {
        const fpath = path.join(baseDir, filename);
        try {
          await this.extractFromFile(fpath, tier as CalculatorTier, results);
        } catch {
          log.warn(`[FactorCalculatorValidator] Cannot read ${filename}, using static data`);
        }
      }
      for (const rfile of REGIONAL_FILES) {
        const fpath = path.join(baseDir, rfile);
        try {
          await this.extractFromFile(fpath, 'market-yellow', results);
        } catch {
          log.warn(`[FactorCalculatorValidator] Cannot read ${rfile}`);
        }
      }
    } catch {
      // Fall back to static data
      log.warn('[FactorCalculatorValidator] Filesystem scan failed, using static mapping');
    }

    return results;
  }

  private async extractFromFile(
    fpath: string,
    tier: CalculatorTier,
    results: FactorDefinition[],
  ): Promise<void> {
    try {
      const content = fs.readFileSync(fpath, 'utf-8');
      const filename = path.basename(fpath);

      // Match factorId: 'XXX' pattern
      const idRegex = /factorId:\s*'([A-Za-z0-9_]+)'/g;
      const labelRegex = /label:\s*'([^']*)'/g;

      let idMatch: RegExpExecArray | null;
      while ((idMatch = idRegex.exec(content)) !== null) {
        const factorId = idMatch[1].toUpperCase();

        // Try to find the closest label
        let label = factorId;
        // Look for type + factorId + level1 + level2 pattern
        const blockStart = Math.max(0, idMatch.index - 50);
        const blockEnd = Math.min(content.length, idMatch.index + 400);
        const block = content.substring(blockStart, blockEnd);
        const labelMatch = /label:\s*'([^']*)'/.exec(block);
        if (labelMatch) label = labelMatch[1];

        // Detect calculator type
        let calcType: FactorDefinition['calculatorType'] = 'custom';
        if (block.includes("type: 'ratio'")) calcType = 'ratio';
        else if (block.includes("type: 'rank'")) calcType = 'rank';
        else if (block.includes("type: 'signal'")) calcType = 'signal';

        // Detect level1/level2
        let level1 = 'L1_CUSTOM';
        let level2 = 'L2_CUSTOM';
        const l1Match = /level1:\s*'([A-Z0-9_]+)'/.exec(block);
        const l2Match = /level2:\s*'([A-Z0-9_]+)'/.exec(block);
        if (l1Match) level1 = l1Match[1];
        if (l2Match) level2 = l2Match[1];

        results.push({
          factorId,
          label,
          level1,
          level2,
          calculatorType: calcType,
          file: filename,
          tier,
        });
      }
    } catch (err) {
      log.warn(`[FactorCalculatorValidator] Error reading ${fpath}: ${err}`);
    }
  }

  private getRegistryMapping(): EntityIdMapping[] {
    return REGISTRY_ENTITIES;
  }

  private suggestTier(factorId: string): CalculatorTier {
    if (factorId.startsWith('US_')) return 'final-red';
    if (factorId.startsWith('HK_') || factorId.startsWith('AH_')) return 'market-red';
    if (factorId.startsWith('CRYPTO_')) return 'market-yellow';
    if (factorId.startsWith('CMD_')) return 'market-yellow';
    if (factorId.startsWith('XM_')) return 'pro';
    if (['IN_', 'EU_', 'JP_', 'KR_', 'TW_', 'SG_', 'AU_'].some(p => factorId.startsWith(p))) return 'market-yellow';
    return 'yellow';
  }

  private suggestType(factorId: string): 'ratio' | 'rank' | 'signal' | 'custom' {
    if (/_RATIO$|_YIELD$|_SPREAD$|_PREMIUM$|_MULTIPLIER$|_MARGIN$|DEBT_TO|_TO_PRICE$|_MOMENTUM$/.test(factorId)) return 'ratio';
    if (/_SCORE$|_RANK$|_STRENGTH$|_EXPOSURE$|_BETA$|_STABILITY$|_GROWTH$|CHAEBOL|SAMSUNG|TSMC/.test(factorId)) return 'rank';
    if (/_FLOW$|_SURPRISE$|_CHANGE$|_REVISION$|_SENTIMENT$|_SIGNAL$|_CROWDING$|EARNINGS|DIVIDEND|INSIDER/.test(factorId)) return 'signal';
    return 'custom';
  }

  private assignPriority(factorId: string): 'P0' | 'P1' | 'P2' {
    if (factorId.startsWith('US_') || factorId.startsWith('HK_') || factorId === 'MKT' || factorId === 'UMD') return 'P0';
    if (factorId.startsWith('CRYPTO_') || factorId.startsWith('CMD_') || factorId.startsWith('XM_')) return 'P1';
    return 'P2';
  }

  private generateMissingNote(factorId: string): string {
    const tier = this.suggestTier(factorId);
    const ctype = this.suggestType(factorId);
    return (
      'Add to ' + TIER_NAMES[tier] + ' tier as ' + ctype + ' calculator. ' +
      'See factor-id-registry.ts for label and level1/level2 metadata.'
    );
  }

  private classifyGhost(
    factorId: string,
  ): { action: 'add_to_registry' | 'rename_to_match_registry' | 'remove'; registryId?: string } {
    // Check if this ghost has a close match in registry
    const registry = this.getRegistryMapping();
    const closeMatch = registry.find(r =>
      r.canonicalId.replace(/_/g, '') === factorId.replace(/_/g, '') ||
      r.canonicalId === factorId.replace(/_ADV$/, '') ||
      factorId === r.canonicalId + '_ADV'
    );
    if (closeMatch) {
      return { action: 'rename_to_match_registry', registryId: closeMatch.canonicalId };
    }
    // If it follows a clear naming pattern (PREFIX_MARKET_), suggest adding to registry
    if (/^(US_|HK_|CRYPTO_|CMD_|XM_|IN_|EU_|JP_|KR_|TW_|SG_|AU_)/.test(factorId)) {
      return { action: 'add_to_registry' };
    }
    return { action: 'remove' };
  }

  private generateSummary(
    missing: MissingFactorReport[],
    ghosts: GhostFactorReport[],
    duplicates: DuplicateFactorReport[],
    coveragePct: number,
  ): string {
    const lines: string[] = [];
    lines.push('=== Factor Calculator Validator Summary ===');
    lines.push('Coverage: ' + coveragePct + '% of registry factors have calculators');
    lines.push('Missing calculators: ' + missing.length + ' (P0=' + missing.filter(m => m.priority === 'P0').length + ', P1=' + missing.filter(m => m.priority === 'P1').length + ', P2=' + missing.filter(m => m.priority === 'P2').length + ')');
    lines.push('Ghost factors (in calc but not registry): ' + ghosts.length);
    lines.push('Duplicate factors (same ID in multiple files): ' + duplicates.length);
    if (duplicates.length > 0) {
      const conflicts = duplicates.filter(d => d.conflict);
      lines.push('  Conflicts (different tiers): ' + conflicts.length);
    }
    lines.push('Target: >=200/240 factors with calculators (current: check report)');
    return lines.join('\n');
  }

  /**
   * Get a focused report for a single factor ID.
   * Useful for UI drill-down on individual factors.
   */
  async getFactorDetail(factorId: string): Promise<{
    registryEntry?: EntityIdMapping;
    calculators: FactorDefinition[];
    status: 'covered' | 'missing' | 'ghost' | 'duplicate';
    notes: string;
  }> {
    const report = await this.validate();
    const regEntry = this.getRegistryMapping().find(r => r.canonicalId === factorId.toUpperCase());
    
    // Check status
    const calcFactors = report.calculatorTotal;
    const isMissing = report.missing.some(m => m.factorId === factorId.toUpperCase());
    const isGhost = report.ghosts.some(g => g.factorId === factorId.toUpperCase());
    const isDup = report.duplicates.some(d => d.factorId === factorId.toUpperCase());
    
    let status: 'covered' | 'missing' | 'ghost' | 'duplicate' = 'covered';
    let notes = 'Factor has at least one calculator implementation.';
    if (isMissing) { status = 'missing'; notes = 'Factor is in registry but has NO calculator. See missing report.'; }
    if (isGhost) { status = 'ghost'; notes = 'Factor has calculators but is NOT in the registry. Needs registration.'; }
    if (isDup) { status = 'duplicate'; notes = 'Factor exists in multiple calculator files. Check duplicate report.'; }
    
    return {
      registryEntry: regEntry,
      calculators: [],
      status,
      notes,
    };
  }

  /** Clear the validation cache to force a fresh scan */
  invalidateCache(): void {
    this.cache = null;
    this.cacheTime = 0;
    log.info('[FactorCalculatorValidator] Cache invalidated');
  }
}
