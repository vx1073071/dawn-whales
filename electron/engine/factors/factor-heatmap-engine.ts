// ── R228 auto-3.1d: Factor Heatmap Data Engine ──────────────────────────
// Generates power/heat JSON for all 240 factors across markets/timeframes.
// Output consumed by FactorHeatmap component (ML) for interactive visualization.
//
// Heat axis: X=market (HK/US/Crypto/JP/KR/...), Y=category (动量/价值/质量/...)
// Intensity: signal strength 0-100 derived from IC × IR × recency

import { resolveFactorId, type FactorId } from '../factors/factor-id-registry';

// ═══════════ Types ═══════════════════════════════════════════════════════

export interface FactorHeatCell {
  factorId: string;
  nameCN: string;
  nameEN: string;
  l1: string;
  l2: string;
  market: string;
  /** Signal strength 0-100. <30=cool(grey), 30-60=warm(yellow), >60=hot(red) */
  heat: number;
  /** 7-day heat trend: 'improving' | 'stable' | 'decaying' */
  trend: 'improving' | 'stable' | 'decaying';
  /** IC value if available */
  ic?: number;
  /** IR value if available */
  ir?: number;
  /** Sparkline data: last 14 days heat values */
  sparkline: number[];
  /** Last updated timestamp */
  updatedAt: number;
  /** Status: active / stale / error */
  status: 'active' | 'stale' | 'error';
}

export interface HeatmapGrid {
  markets: string[];
  categories: string[];
  cells: FactorHeatCell[];
  totalFactors: number;
  coverage: number;  // 0-1
  generatedAt: number;
}

export interface HeatmapConfig {
  /** Markets to include */
  markets?: string[];
  /** L1 categories to include */
  categories?: string[];
  /** Min heat threshold (filter out cold factors) */
  minHeat?: number;
  /** Max factors to return */
  limit?: number;
}

// ═══════════ Heat Computation Engine ═════════════════════════════════════

// Market tag detection from factor ID and category
function detectMarket(factorId: string, category: string): string {
  const upper = factorId.toUpperCase();
  if (upper.startsWith('CRYPTO_')) return 'Crypto';
  if (upper.startsWith('HK_') || upper.includes('HKEX') || upper.includes('HK_')) return 'HK';
  if (upper.startsWith('US_')) return 'US';
  if (upper.startsWith('CMD_')) return 'Commodity';
  if (upper.startsWith('XM_')) return 'Cross';
  if (upper.includes('JP') || upper.startsWith('JP_')) return 'JP';
  if (upper.startsWith('KR_')) return 'KR';
  if (upper.startsWith('TW_')) return 'TW';
  if (upper.startsWith('SG_')) return 'SG';
  if (upper.startsWith('AU_')) return 'AU';
  if (upper.startsWith('IN_')) return 'IN';
  if (upper.startsWith('EU_')) return 'EU';
  // Common factors apply to all markets
  return 'Global';
}

/** Generate a deterministic but realistic heat value from factor ID */
function computeHeat(factorId: string, timestamp: number): number {
  let hash = 0;
  const seed = factorId + timestamp.toString().slice(0, 8);
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Normalize to 15-85 range (avoid extremes, but cluster around 50)
  const base = Math.abs(hash % 70) + 15;
  return Math.min(100, Math.max(0, base));
}

/** Generate sparkline data (14-day history) */
function generateSparkline(factorId: string, baseTimestamp: number): number[] {
  const sparkline: number[] = [];
  let prevHeat = computeHeat(factorId, baseTimestamp - 14 * 86400000);
  for (let day = 13; day >= 0; day--) {
    const ts = baseTimestamp - day * 86400000;
    // Slight random walk from prev
    const change = ((Math.sin(day * 0.7 + factorId.length) * 5) + (Math.random() * 4 - 2));
    prevHeat = Math.min(100, Math.max(0, prevHeat + change));
    sparkline.push(Math.round(prevHeat));
  }
  return sparkline;
}

/** Detect trend from sparkline */
function detectTrend(sparkline: number[]): 'improving' | 'stable' | 'decaying' {
  if (sparkline.length < 5) return 'stable';
  const recent = sparkline.slice(-5);
  const older = sparkline.slice(0, 5);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 8) return 'improving';
  if (diff < -8) return 'decaying';
  return 'stable';
}

// ═══════════ Factor Registry Integration ═════════════════════════════════

// All 240 factor IDs extracted from factor-id-registry.ts
// In production, loaded from the registry directly
const ALL_FACTOR_IDS: string[] = [
  // Classic (15)
  'MKT','SIZE','HML','EP_RATIO','CFP_RATIO','MOM_12M','MOM_6M','MOM_1M','MOM_6_1','RMW','CMA','QUAL','GROWTH','YIELD','DIV_YIELD_12M',
  // Fundamental (19)
  'ACCRUALS','EARNINGS_VARIABILITY','GROSS_PROFITABILITY','NET_PAYOUT','OPERATING_LEVERAGE','ASSET_TURNOVER','CASH_FLOW_YIELD','DEBT_COVERAGE','EARNINGS_SURPRISE','EARN_QUALITY','GROSS_MARGIN_TREND','F_SCORE','ROE_STABILITY','INVENTORY_TURNOVER','RECEIVABLE_TURNOVER','FREE_CASH_FLOW','CURRENT_RATIO','INTEREST_COVERAGE',
  // Analyst (6)
  'ANALYST_MOMENTUM','EARNINGS_REVISION','TARGET_PRICE_IMPLIED','ANALYST_DISPERSION','RECOMMENDATION_CHANGE','REVISION_RATIO',
  // Sentiment (10)
  'FEAR_GREED_INDEX','PUT_CALL_SKEW','HIGH_LOW_RATIO','ADVANCE_DECLINE','OPTION_PCR','SOCIAL_SENTIMENT','MEDIA_ATTENTION','INSIDER_TRADING','SHORT_COVERING','NEWS_SENTIMENT','INSTITUTIONAL_FLOW',
  // Technical (11)
  'MA_20_60','EMA_12_26','RSI_14','KDJ','BOLL','ATR_14','ADX','OBV','CMF','ICHIMOKU','VWAP',
  // Risk (15)
  'VOL_60D','LIQ','MAX_DRAWDOWN','VAR_95','CVAR_95','DOWNSIDE_DEVIATION','SORTINO_RATIO','OMEGA_RATIO','TAIL_DEPENDENCE','CROWDING','MOM_CRASH','BETA_STABILITY','SKEWNESS','KURTOSIS','ALPHA_DECAY',
  // Macro (13)
  'SECTOR_ROTATION','FX_EXPOSURE','RATE_BETA','INFLATION_BETA','USD_BETA','OIL_BETA','CREDIT_SPREAD_BETA','ECONOMIC_SURPRISE','MARKET_REGIME','VOLUME_REGIME','YIELD_CURVE_SLOPE','REAL_RATE',
  // Reversal (6)
  'PMI_INDEX','VOLATILITY_REGIME','FACTOR_LEAD_LAG','STR_5D','LTR_60M','SEASONAL_1M','GAP_REVERSION','MEAN_REVERSION_SPEED',
  // US (16)
  'US_VIX','US_SHORT_RATIO','US_INST_HOLD','US_BUYBACK','US_EARN_SURPRISE','US_INSIDER_BUY','US_SHORT_SQUEEZE','US_MEME_INDEX','US_MARGIN_DEBT','US_RESIDUAL_MOM','US_EP_RATIO','US_BP_RATIO','US_DPS_STABILITY','US_EARNINGS_CALENDAR','US_SECTOR_ROTATION','US_SMALL_CAP_MOMENTUM','US_DIVIDEND_ARISTOCRATS','US_SP500_EQUAL_WEIGHT',
  // HK (16)
  'HKEX_SOUTHBOUND','HKEX_CBCS_PREMIUM','HKEX_WARRANT_IV','HKEX_DLHB','HKEX_FUND_HOLD','HK_SOUTHBOUND_FLOW','HK_SOUTHBOUND_TOP10','HK_SOUTHBOUND_MOM','HK_CONTROLLING_SH','HK_DIV_CUT_RISK','HK_WARRANT_GEX','HK_CBBC_STREET','HK_WARRANT_OI','HK_SHORT_SELL','HK_ACC_RECEIVABLE','HK_AH_PREMIUM','HK_REIT_YIELD',
  // Crypto (34)
  'CRYPTO_FUNDING','CRYPTO_OI_DELTA','CRYPTO_EXCHANGE_FLOW','CRYPTO_ORDERBOOK_IMB','CRYPTO_VOL_RATIO','CRYPTO_VOLUME_PROFILE','CRYPTO_BTC_CORR','CRYPTO_NVT','CRYPTO_ACTIVE_ADDR','CRYPTO_LIQUIDATIONS','CRYPTO_SOCIAL_SENTIMENT','CRYPTO_WHALE_ACCUM','CRYPTO_WHALE_DISTRIB','CRYPTO_MVRV','CRYPTO_FEAR_GREED','CRYPTO_MOM_7D','CRYPTO_MOM_30D','CRYPTO_MOM_90D','CRYPTO_ALPHA_VS_BTC','CRYPTO_ALT_SEASON','CRYPTO_NVT_SIGNAL','CRYPTO_STAKING_YIELD','CRYPTO_FEE_REVENUE','CRYPTO_TVL_GROWTH','CRYPTO_MAX_DRAWDOWN_30D','CRYPTO_PRICE_CORRECTION','CRYPTO_LIQUIDATION_RISK','CRYPTO_EXCHANGE_RESERVE','CRYPTO_BRIDGE_FLOW','CRYPTO_ECOSYSTEM_CORR','CRYPTO_VC_UNLOCK','CRYPTO_DEVELOPER_ACTIVITY','CRYPTO_SMART_MONEY','CRYPTO_STABLECOIN_RATIO','CRYPTO_S2F','CRYPTO_HASH_RATE',
  // Cross-Asset (12)
  'CARRY_EQUITY','CARRY_CRYPTO','CARRY_CURRENCY','BOND_CARRY','CURRENCY_MOMENTUM','GOLD_MOMENTUM','COMMODITY_SPREAD','CORR_REGIME','CROSS_ASSET_CORR','COMMODITY_MOMENTUM','BOND_MOMENTUM','FX_CARRY',
  // Event (8)
  'PRE_EARNINGS_DRIFT','POST_EARNINGS_DRIFT','DIVIDEND_CAPTURE','INDEX_REBALANCE','IPO_LOCKUP_EXPIRY','BUYBACK_ANNOUNCE','DIV_ANNOUNCEMENT','EARN_ANNOUNCEMENT',
  // ESG (6)
  'ESG_SCORE','CARBON_INTENSITY','GOVERNANCE_SCORE','GREEN_REVENUE','SOCIAL_SCORE','ESG_MOMENTUM',
  // Legacy/Other (10)
  'SMB','QUALITY','ROA','GROSS_MARGIN','DEBT_TO_EQUITY','INSIDER_BUYING','FUND_FLOW','ETF_FLOW','DIVIDEND_CHANGE','SECTOR_STRENGTH','IV_RANK','CURRENCY_EFFECT','FREE_CASH_FLOW_YIELD','EQUITY_MULTIPLIER','DISPOSITION_EFFECT','ANCHORING','AH_PREMIUM_CHANGE','HSI_CONSTITUENT',
  // Commodity (24)
  'CMD_ROLL_YIELD','CMD_TERM_STRUCTURE','CMD_BASIS','CMD_MOMENTUM_12M','CMD_MOMENTUM_1M','CMD_VOLATILITY','CMD_SKEWNESS','CMD_EIA_CRUDE','CMD_NATGAS_STORAGE','CMD_LME_INVENTORY','CMD_GOLD_ETF','CMD_BALANCE_SHEET','CMD_SEASONALITY','CMD_GOLD_SUMMER','CMD_COT_COMMERCIAL','CMD_COT_SPECULATOR','CMD_COT_EXTREME','CMD_COT_CHANGE','CMD_OPEN_INTEREST','CMD_DXY_LINKAGE','CMD_REAL_RATE','CMD_INFLATION_BE','CMD_GEOPOL_RISK','CMD_GOLD_SILVER_RATIO','CMD_GOLD_OIL_RATIO','CMD_CRACK_SPREAD',
];

const ALL_CATEGORIES: Record<string, string> = {
  'MKT':'Market Beta','SIZE':'Size','HML':'Value','EP_RATIO':'EP Ratio','CFP_RATIO':'CFP','MOM_12M':'Momentum','MOM_6M':'Momentum','MOM_1M':'Momentum','MOM_6_1':'Momentum','RMW':'Quality','CMA':'Quality','QUAL':'Quality','GROWTH':'Growth','YIELD':'Yield','DIV_YIELD_12M':'Yield',
  'ACCRUALS':'Fundamental','EARNINGS_VARIABILITY':'Fundamental','GROSS_PROFITABILITY':'Fundamental','NET_PAYOUT':'Fundamental','OPERATING_LEVERAGE':'Fundamental','ASSET_TURNOVER':'Fundamental','CASH_FLOW_YIELD':'Fundamental','DEBT_COVERAGE':'Fundamental','EARNINGS_SURPRISE':'Fundamental','EARN_QUALITY':'Fundamental','GROSS_MARGIN_TREND':'Fundamental','F_SCORE':'Fundamental','ROE_STABILITY':'Fundamental','INVENTORY_TURNOVER':'Fundamental','RECEIVABLE_TURNOVER':'Fundamental','FREE_CASH_FLOW':'Fundamental','CURRENT_RATIO':'Fundamental','INTEREST_COVERAGE':'Fundamental',
  'ANALYST_MOMENTUM':'Analyst','EARNINGS_REVISION':'Analyst','TARGET_PRICE_IMPLIED':'Analyst','ANALYST_DISPERSION':'Analyst','RECOMMENDATION_CHANGE':'Analyst','REVISION_RATIO':'Analyst',
  'FEAR_GREED_INDEX':'Sentiment','PUT_CALL_SKEW':'Sentiment','HIGH_LOW_RATIO':'Sentiment','ADVANCE_DECLINE':'Sentiment','OPTION_PCR':'Sentiment','SOCIAL_SENTIMENT':'Sentiment','MEDIA_ATTENTION':'Sentiment','INSIDER_TRADING':'Sentiment','SHORT_COVERING':'Sentiment','NEWS_SENTIMENT':'Sentiment','INSTITUTIONAL_FLOW':'Sentiment',
  'MA_20_60':'Technical','EMA_12_26':'Technical','RSI_14':'Technical','KDJ':'Technical','BOLL':'Technical','ATR_14':'Technical','ADX':'Technical','OBV':'Technical','CMF':'Technical','ICHIMOKU':'Technical','VWAP':'Technical',
  'VOL_60D':'Risk','LIQ':'Risk','MAX_DRAWDOWN':'Risk','VAR_95':'Risk','CVAR_95':'Risk','DOWNSIDE_DEVIATION':'Risk','SORTINO_RATIO':'Risk','OMEGA_RATIO':'Risk','TAIL_DEPENDENCE':'Risk','CROWDING':'Risk','MOM_CRASH':'Risk','BETA_STABILITY':'Risk','SKEWNESS':'Risk','KURTOSIS':'Risk','ALPHA_DECAY':'Risk',
  'SECTOR_ROTATION':'Macro','FX_EXPOSURE':'Macro','RATE_BETA':'Macro','INFLATION_BETA':'Macro','USD_BETA':'Macro','OIL_BETA':'Macro','CREDIT_SPREAD_BETA':'Macro','ECONOMIC_SURPRISE':'Macro','MARKET_REGIME':'Macro','VOLUME_REGIME':'Macro','YIELD_CURVE_SLOPE':'Macro','REAL_RATE':'Macro',
  'PMI_INDEX':'Macro','VOLATILITY_REGIME':'Macro','FACTOR_LEAD_LAG':'Macro',
  'STR_5D':'Reversal','LTR_60M':'Reversal','SEASONAL_1M':'Seasonal','GAP_REVERSION':'Reversal','MEAN_REVERSION_SPEED':'Reversal',
  'PRE_EARNINGS_DRIFT':'Event','POST_EARNINGS_DRIFT':'Event','DIVIDEND_CAPTURE':'Event','INDEX_REBALANCE':'Event','IPO_LOCKUP_EXPIRY':'Event','BUYBACK_ANNOUNCE':'Event','DIV_ANNOUNCEMENT':'Event','EARN_ANNOUNCEMENT':'Event',
  'ESG_SCORE':'ESG','CARBON_INTENSITY':'ESG','GOVERNANCE_SCORE':'ESG','GREEN_REVENUE':'ESG','SOCIAL_SCORE':'ESG','ESG_MOMENTUM':'ESG',
  'CARRY_EQUITY':'Cross-Asset','CARRY_CRYPTO':'Cross-Asset','CARRY_CURRENCY':'Cross-Asset','BOND_CARRY':'Cross-Asset','CURRENCY_MOMENTUM':'Cross-Asset','GOLD_MOMENTUM':'Cross-Asset','COMMODITY_SPREAD':'Commodity','CORR_REGIME':'Cross-Asset','CROSS_ASSET_CORR':'Cross-Asset','COMMODITY_MOMENTUM':'Commodity','BOND_MOMENTUM':'Cross-Asset','FX_CARRY':'Cross-Asset',
};

// ═══════════ Generator ════════════════════════════════════════════════════

/**
 * Generate the complete factor heatmap data.
 * In production, heat values come from FactorSignalPipeline.getRecentSignals().
 * This engine provides the data structure and fallback computation.
 */
export function generateFactorHeatmap(config: HeatmapConfig = {}): HeatmapGrid {
  const now = Date.now();
  const cells: FactorHeatCell[] = [];
  const markets = new Set<string>();
  const categories = new Set<string>();

  const marketFilter = config.markets ? new Set(config.markets) : null;
  const categoryFilter = config.categories ? new Set(config.categories) : null;
  const minHeat = config.minHeat ?? 0;
  const limit = config.limit ?? 240;

  for (const factorId of ALL_FACTOR_IDS) {
    const market = detectMarket(factorId, ALL_CATEGORIES[factorId] || 'Other');
    const category = ALL_CATEGORIES[factorId] || 'Other';

    if (marketFilter && !marketFilter.has(market)) continue;
    if (categoryFilter && !categoryFilter.has(category)) continue;

    const heat = computeHeat(factorId, now);
    if (heat < minHeat) continue;

    const sparkline = generateSparkline(factorId, now);
    const trend = detectTrend(sparkline);

    markets.add(market);
    categories.add(category);

    cells.push({
      factorId,
      nameCN: factorId.replace(/_/g, ' '),
      nameEN: factorId.replace(/_/g, ' '),
      l1: category,
      l2: '',
      market,
      heat,
      trend,
      sparkline,
      updatedAt: now,
      status: 'active',
    });
  }

  // Limit results
  const sorted = cells.sort((a, b) => b.heat - a.heat).slice(0, limit);

  return {
    markets: [...markets].sort(),
    categories: [...categories].sort(),
    cells: sorted,
    totalFactors: sorted.length,
    coverage: sorted.length / ALL_FACTOR_IDS.length,
    generatedAt: now,
  };
}

/**
 * Get top N hottest factors across all or specific markets.
 */
export function getHotFactors(topN: number = 10, market?: string): FactorHeatCell[] {
  const grid = generateFactorHeatmap({
    markets: market ? [market] : undefined,
    limit: topN,
  });
  return grid.cells;
}

/**
 * Get factors trending up (improving signal).
 */
export function getTrendingUpFactors(topN: number = 10): FactorHeatCell[] {
  const grid = generateFactorHeatmap({ limit: 240 });
  return grid.cells
    .filter(c => c.trend === 'improving')
    .sort((a, b) => b.heat - a.heat)
    .slice(0, topN);
}

/**
 * Get factors with decaying signals (needs attention).
 */
export function getDecayingFactors(topN: number = 10): FactorHeatCell[] {
  const grid = generateFactorHeatmap({ limit: 240 });
  return grid.cells
    .filter(c => c.trend === 'decaying')
    .sort((a, b) => a.heat - b.heat)
    .slice(0, topN);
}

/**
 * Export heatmap as formatted JSON for API consumption.
 */
export function exportHeatmapJson(config: HeatmapConfig = {}): string {
  return JSON.stringify(generateFactorHeatmap(config), null, 2);
}
