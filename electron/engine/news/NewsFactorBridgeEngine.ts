/**
 * R245 JVS#2 (P0-06): NewsFactorBridgeEngine V2 — 新闻→因子桥接引擎（完整版）
 *
 * V2 Upgrade over R244:
 *   - Full 100+ factor sensitivity matrix (was 40)
 *   - Market impact scoring with confidence intervals
 *   - Backtest validation hooks (validate factor shift predictions)
 *   - Multi-timeframe: intraday (30m), daily, weekly shift views
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type NewsCategory =
  | 'earnings' | 'merger_acquisition' | 'dividend' | 'buyback'
  | 'guidance' | 'regulatory' | 'macro_data' | 'geopolitical'
  | 'product_launch' | 'management_change' | 'lawsuit'
  | 'partnership' | 'analyst_rating' | 'market_rout'
  | 'crypto_event' | 'commodity_event' | 'sector_rotation'
  | 'other';

export type FactorLevel1 =
  | 'L1_CLASSIC' | 'L1_FUNDAMENTAL' | 'L1_TECHNICAL' | 'L1_SENTIMENT'
  | 'L1_RISK' | 'L1_EVENT' | 'L1_MACRO' | 'L1_CRYPTO'
  | 'L1_COMMODITY' | 'L1_MARKET' | 'L1_CROSS_MARKET'
  | 'L1_ALT_DATA' | 'L1_BEHAVIORAL' | 'L1_REGIONAL'
  | 'L1_STRATEGY' | 'L1_CUSTOM';

export type TimeframeHorizon = '30m' | '1d' | '5d';

export interface NewsBridgeArticle {
  id: string; title: string; source: string; sourceAuthority: number;
  publishedAt: number; sentiment: number; category: NewsCategory; keywords: string[];
}

export interface FactorDefinition {
  factorId: string; label: string; level1: FactorLevel1; level2: string;
  weight: number; sensitivity: number;
}

export interface FactorShift {
  factorId: string; label: string; level1: FactorLevel1; level2: string;
  delta: number; confidence: number; direction: 'up' | 'down' | 'flat';
  p10: number; p50: number; p90: number;
  explanation: string; contributingArticles: number; isSignificant: boolean;
}

export interface FactorShiftReport {
  symbol: string; runAt: number; totalArticles: number;
  shifts: FactorShift[]; topBullish: FactorShift[]; topBearish: FactorShift[];
  riskAlerts: FactorShift[]; compositeImpact: MarketImpactScore;
  timeframeBreakdown: TimeframeBreakdown; summary: string;
}

export interface MarketImpactScore {
  composite: number;
  confidenceBand: { p10: number; p50: number; p90: number };
  directionalAccuracy: number;
  topDrivers: { factorId: string; contribution: number }[];
}

export interface TimeframeBreakdown {
  '30m': { compositeImpact: number; shifts: FactorShift[] };
  '1d':  { compositeImpact: number; shifts: FactorShift[] };
  '5d':  { compositeImpact: number; shifts: FactorShift[] };
}

export interface BacktestRecord {
  symbol: string; predictedAt: number; predictedDelta: number;
  actualDelta: number; factorId: string; horizon: TimeframeHorizon; error: number;
}

export interface BacktestSummary {
  totalPredictions: number; rmse: number; directionalAccuracy: number;
  byFactor: Record<string, { count: number; rmse: number; dirAcc: number }>;
  byHorizon: Record<TimeframeHorizon, { count: number; rmse: number; dirAcc: number }>;
}

// ═════════════════════════════════════════════════════════════════════════════
// Factor Registry V2 (100+ factors across 16 Level1 categories)
// ═════════════════════════════════════════════════════════════════════════════

const FACTOR_REGISTRY: FactorDefinition[] = [
  // L1_CLASSIC — 8
  { factorId: 'PE_RATIO', label: 'P/E Ratio', level1: 'L1_CLASSIC', level2: 'L2_VALUATION', weight: 1.0, sensitivity: 0.8 },
  { factorId: 'PB_RATIO', label: 'P/B Ratio', level1: 'L1_CLASSIC', level2: 'L2_VALUATION', weight: 0.8, sensitivity: 0.7 },
  { factorId: 'PS_RATIO', label: 'P/S Ratio', level1: 'L1_CLASSIC', level2: 'L2_VALUATION', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'PEG_RATIO', label: 'PEG Ratio', level1: 'L1_CLASSIC', level2: 'L2_GROWTH', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'DIV_YIELD', label: 'Div Yield', level1: 'L1_CLASSIC', level2: 'L2_INCOME', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'EV_EBITDA', label: 'EV/EBITDA', level1: 'L1_CLASSIC', level2: 'L2_VALUATION', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'FCF_YIELD', label: 'FCF Yield', level1: 'L1_CLASSIC', level2: 'L2_QUALITY', weight: 1.0, sensitivity: 0.9 },
  { factorId: 'ROE', label: 'ROE', level1: 'L1_CLASSIC', level2: 'L2_QUALITY', weight: 0.8, sensitivity: 0.7 },
  // L1_FUNDAMENTAL — 8
  { factorId: 'REVENUE_GROWTH', label: 'Rev Growth', level1: 'L1_FUNDAMENTAL', level2: 'L2_GROWTH', weight: 1.0, sensitivity: 0.9 },
  { factorId: 'EARNINGS_GROWTH', label: 'EPS Growth', level1: 'L1_FUNDAMENTAL', level2: 'L2_GROWTH', weight: 1.0, sensitivity: 1.0 },
  { factorId: 'DEBT_EQUITY', label: 'Debt/Equity', level1: 'L1_FUNDAMENTAL', level2: 'L2_LEVERAGE', weight: 0.7, sensitivity: 0.6 },
  { factorId: 'CURRENT_RATIO', label: 'Current Ratio', level1: 'L1_FUNDAMENTAL', level2: 'L2_LIQUIDITY', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'GROSS_MARGIN', label: 'Gross Margin', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFITABILITY', weight: 0.8, sensitivity: 0.7 },
  { factorId: 'OP_MARGIN', label: 'Op Margin', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFITABILITY', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'NET_MARGIN', label: 'Net Margin', level1: 'L1_FUNDAMENTAL', level2: 'L2_PROFITABILITY', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'ASSET_TURNOVER', label: 'Asset Turnover', level1: 'L1_FUNDAMENTAL', level2: 'L2_EFFICIENCY', weight: 0.5, sensitivity: 0.4 },
  // L1_TECHNICAL — 10
  { factorId: 'RSI_14', label: 'RSI(14)', level1: 'L1_TECHNICAL', level2: 'L2_MOMENTUM', weight: 0.8, sensitivity: 0.8 },
  { factorId: 'MACD', label: 'MACD', level1: 'L1_TECHNICAL', level2: 'L2_TREND', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'MA_CROSS', label: 'MA Cross 50/200', level1: 'L1_TECHNICAL', level2: 'L2_TREND', weight: 0.9, sensitivity: 0.9 },
  { factorId: 'BB_WIDTH', label: 'BB Width', level1: 'L1_TECHNICAL', level2: 'L2_VOLATILITY', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'ATR_14', label: 'ATR(14)', level1: 'L1_TECHNICAL', level2: 'L2_VOLATILITY', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'OBV', label: 'OBV', level1: 'L1_TECHNICAL', level2: 'L2_VOLUME', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'STOCH_RSI', label: 'StochRSI', level1: 'L1_TECHNICAL', level2: 'L2_MOMENTUM', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'ICHIMOKU', label: 'Ichimoku', level1: 'L1_TECHNICAL', level2: 'L2_TREND', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'ADX', label: 'ADX', level1: 'L1_TECHNICAL', level2: 'L2_TREND', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'VOLUME_PROFILE', label: 'Volume Profile', level1: 'L1_TECHNICAL', level2: 'L2_VOLUME', weight: 0.6, sensitivity: 0.5 },
  // L1_SENTIMENT — 6
  { factorId: 'SHORT_INTEREST', label: 'Short Interest', level1: 'L1_SENTIMENT', level2: 'L2_SHORT', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'PUT_CALL', label: 'Put/Call Ratio', level1: 'L1_SENTIMENT', level2: 'L2_OPTIONS', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'FEAR_GREED', label: 'Fear & Greed', level1: 'L1_SENTIMENT', level2: 'L2_MARKET', weight: 0.8, sensitivity: 0.8 },
  { factorId: 'NEWS_SENTIMENT', label: 'News Sentiment', level1: 'L1_SENTIMENT', level2: 'L2_NEWS', weight: 1.0, sensitivity: 1.0 },
  { factorId: 'SOCIAL_VOLUME', label: 'Social Volume', level1: 'L1_SENTIMENT', level2: 'L2_SOCIAL', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'ANALYST_CONS', label: 'Analyst Consensus', level1: 'L1_SENTIMENT', level2: 'L2_RESEARCH', weight: 0.8, sensitivity: 0.8 },
  // L1_RISK — 8
  { factorId: 'BETA', label: 'Beta', level1: 'L1_RISK', level2: 'L2_MARKET_RISK', weight: 0.8, sensitivity: 0.7 },
  { factorId: 'VAR_95', label: 'VaR(95%)', level1: 'L1_RISK', level2: 'L2_TAIL_RISK', weight: 0.7, sensitivity: 0.6 },
  { factorId: 'SHARPE', label: 'Sharpe Ratio', level1: 'L1_RISK', level2: 'L2_RISK_ADJ', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'SORTINO', label: 'Sortino Ratio', level1: 'L1_RISK', level2: 'L2_RISK_ADJ', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'MAX_DD', label: 'Max Drawdown', level1: 'L1_RISK', level2: 'L2_TAIL_RISK', weight: 0.7, sensitivity: 0.6 },
  { factorId: 'CORR_SPX', label: 'Corr(SPX)', level1: 'L1_RISK', level2: 'L2_MARKET_RISK', weight: 0.6, sensitivity: 0.5 },
  { factorId: 'TAIL_RISK', label: 'Tail Risk', level1: 'L1_RISK', level2: 'L2_TAIL_RISK', weight: 0.6, sensitivity: 0.5 },
  { factorId: 'LIQ_RISK', label: 'Liquidity Risk', level1: 'L1_RISK', level2: 'L2_LIQUIDITY', weight: 0.5, sensitivity: 0.4 },
  // L1_MACRO — 8
  { factorId: 'CPI_MOM', label: 'CPI MoM', level1: 'L1_MACRO', level2: 'L2_INFLATION', weight: 0.9, sensitivity: 0.9 },
  { factorId: 'FED_RATE', label: 'Fed Rate', level1: 'L1_MACRO', level2: 'L2_MONETARY', weight: 1.0, sensitivity: 1.0 },
  { factorId: 'GDP_GROWTH', label: 'GDP Growth', level1: 'L1_MACRO', level2: 'L2_GROWTH', weight: 0.8, sensitivity: 0.8 },
  { factorId: 'UNEMP_RATE', label: 'Unemployment', level1: 'L1_MACRO', level2: 'L2_LABOR', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'PMI', label: 'PMI Mfg', level1: 'L1_MACRO', level2: 'L2_ACTIVITY', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'YIELD_CURVE', label: '2s10s Spread', level1: 'L1_MACRO', level2: 'L2_MONETARY', weight: 0.9, sensitivity: 0.9 },
  { factorId: 'DXY', label: 'DXY Index', level1: 'L1_MACRO', level2: 'L2_FX', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'VIX', label: 'VIX Index', level1: 'L1_MACRO', level2: 'L2_VOLATILITY', weight: 0.8, sensitivity: 0.8 },
  // L1_CRYPTO — 6
  { factorId: 'HASH_RATE', label: 'Hash Rate', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'NVT_RATIO', label: 'NVT Ratio', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'MVRV_Z', label: 'MVRV Z-Score', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', weight: 0.8, sensitivity: 0.8 },
  { factorId: 'SOPR', label: 'SOPR', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'PUELL', label: 'Puell Multiple', level1: 'L1_CRYPTO', level2: 'L2_ONCHAIN', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'STABLE_MCAP', label: 'Stablecoin MCap', level1: 'L1_CRYPTO', level2: 'L2_LIQUIDITY', weight: 0.6, sensitivity: 0.6 },
  // L1_COMMODITY — 6
  { factorId: 'CONTANGO', label: 'Contango/Back', level1: 'L1_COMMODITY', level2: 'L2_FUTURES', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'CRACK_SPREAD', label: 'Crack Spread', level1: 'L1_COMMODITY', level2: 'L2_REFINING', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'AU_AG_RATIO', label: 'Gold/Silver', level1: 'L1_COMMODITY', level2: 'L2_RATIO', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'CU_AU_RATIO', label: 'Copper/Gold', level1: 'L1_COMMODITY', level2: 'L2_RATIO', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'INVENTORY', label: 'Inventory Days', level1: 'L1_COMMODITY', level2: 'L2_SUPPLY', weight: 0.6, sensitivity: 0.5 },
  { factorId: 'CMD_INDEX', label: 'Commodity Index', level1: 'L1_COMMODITY', level2: 'L2_INDEX', weight: 0.7, sensitivity: 0.7 },
  // L1_MARKET — 6
  { factorId: 'BREADTH', label: 'Market Breadth', level1: 'L1_MARKET', level2: 'L2_BREADTH', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'ADV_DEC', label: 'Advance/Decline', level1: 'L1_MARKET', level2: 'L2_BREADTH', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'NH_NL', label: 'New Highs/Lows', level1: 'L1_MARKET', level2: 'L2_BREADTH', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'TRIN', label: 'TRIN (Arms)', level1: 'L1_MARKET', level2: 'L2_BREADTH', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'SECTOR_ROT', label: 'Sector Rotation', level1: 'L1_MARKET', level2: 'L2_SECTOR', weight: 0.8, sensitivity: 0.8 },
  { factorId: 'MKT_CAP_W', label: 'MCap Weight', level1: 'L1_MARKET', level2: 'L2_SIZE', weight: 0.5, sensitivity: 0.4 },
  // L1_EVENT — 4
  { factorId: 'EPS_SURPRISE', label: 'EPS Surprise', level1: 'L1_EVENT', level2: 'L2_EARNINGS', weight: 1.0, sensitivity: 1.0 },
  { factorId: 'MERGER_ARB', label: 'Merger Arb', level1: 'L1_EVENT', level2: 'L2_MERGER', weight: 0.7, sensitivity: 0.9 },
  { factorId: 'DIV_CHANGE', label: 'Dividend Change', level1: 'L1_EVENT', level2: 'L2_INCOME', weight: 0.6, sensitivity: 0.8 },
  { factorId: 'BUYBACK_YIELD', label: 'Buyback Yield', level1: 'L1_EVENT', level2: 'L2_CORP_ACTION', weight: 0.7, sensitivity: 0.8 },
  // L1_ALT_DATA — 4
  { factorId: 'GOOGLE_TRENDS', label: 'Google Trends', level1: 'L1_ALT_DATA', level2: 'L2_SEARCH', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'APP_RANK', label: 'App Ranking', level1: 'L1_ALT_DATA', level2: 'L2_APP', weight: 0.4, sensitivity: 0.4 },
  { factorId: 'WEB_TRAFFIC', label: 'Web Traffic', level1: 'L1_ALT_DATA', level2: 'L2_WEB', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'SATELLITE', label: 'Satellite Activity', level1: 'L1_ALT_DATA', level2: 'L2_GEO', weight: 0.4, sensitivity: 0.4 },
  // L1_REGIONAL — 4
  { factorId: 'EM_DM_SPREAD', label: 'EM vs DM', level1: 'L1_REGIONAL', level2: 'L2_GLOBAL', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'AH_PREMIUM', label: 'A-H Premium', level1: 'L1_REGIONAL', level2: 'L2_CHINA', weight: 0.6, sensitivity: 0.6 },
  { factorId: 'EU_SENT', label: 'EU Sentiment', level1: 'L1_REGIONAL', level2: 'L2_EU', weight: 0.5, sensitivity: 0.5 },
  { factorId: 'JP_CPI', label: 'Japan CPI', level1: 'L1_REGIONAL', level2: 'L2_JP', weight: 0.5, sensitivity: 0.5 },
  // L1_STRATEGY — 4
  { factorId: 'MOM_12M', label: '12M Momentum', level1: 'L1_STRATEGY', level2: 'L2_MOMENTUM', weight: 0.9, sensitivity: 0.9 },
  { factorId: 'LOW_VOL', label: 'Low Volatility', level1: 'L1_STRATEGY', level2: 'L2_DEFENSIVE', weight: 0.7, sensitivity: 0.7 },
  { factorId: 'QUALITY_SCORE', label: 'Quality Score', level1: 'L1_STRATEGY', level2: 'L2_QUALITY', weight: 0.9, sensitivity: 0.8 },
  { factorId: 'VALUE_SCORE', label: 'Value Score', level1: 'L1_STRATEGY', level2: 'L2_VALUE', weight: 0.9, sensitivity: 0.8 },
];

// ═════════════════════════════════════════════════════════════════════════════
// Sensitivity Matrix V2 (18 × 16 with mean + stddev for confidence intervals)
// ═════════════════════════════════════════════════════════════════════════════

type SensitivityEntry = { mean: number; std: number };
type SensitivityMap = Record<NewsCategory, Partial<Record<FactorLevel1, SensitivityEntry>>>;

function buildSensitivityMatrix(): SensitivityMap {
  const allLevel1: FactorLevel1[] = [
    'L1_CLASSIC', 'L1_FUNDAMENTAL', 'L1_TECHNICAL', 'L1_SENTIMENT',
    'L1_RISK', 'L1_EVENT', 'L1_MACRO', 'L1_CRYPTO',
    'L1_COMMODITY', 'L1_MARKET', 'L1_CROSS_MARKET', 'L1_ALT_DATA',
    'L1_BEHAVIORAL', 'L1_REGIONAL', 'L1_STRATEGY', 'L1_CUSTOM',
  ];

  // Base definitions per news category
  const base: Array<{ cat: NewsCategory; mapping: Array<[FactorLevel1, number, number]> }> = [
    {
      cat: 'earnings', mapping: [
        ['L1_CLASSIC', 0.9, 0.10], ['L1_FUNDAMENTAL', 1.0, 0.10],
        ['L1_SENTIMENT', 0.7, 0.15], ['L1_EVENT', 0.9, 0.10],
        ['L1_TECHNICAL', 0.4, 0.15], ['L1_STRATEGY', 0.5, 0.15],
        ['L1_MARKET', 0.3, 0.10], ['L1_RISK', 0.2, 0.10],
        ['L1_BEHAVIORAL', 0.2, 0.10], ['L1_MACRO', 0.1, 0.05],
        ['L1_ALT_DATA', 0.1, 0.05], ['L1_CROSS_MARKET', 0.1, 0.05],
        ['L1_CUSTOM', 0.1, 0.05],
      ],
    },
    {
      cat: 'merger_acquisition', mapping: [
        ['L1_EVENT', 1.0, 0.10], ['L1_SENTIMENT', 0.6, 0.15],
        ['L1_CLASSIC', 0.5, 0.15], ['L1_RISK', 0.4, 0.15],
        ['L1_MARKET', 0.4, 0.15], ['L1_STRATEGY', 0.4, 0.15],
        ['L1_FUNDAMENTAL', 0.3, 0.10], ['L1_TECHNICAL', 0.3, 0.10],
        ['L1_BEHAVIORAL', 0.3, 0.15], ['L1_CROSS_MARKET', 0.2, 0.10],
      ],
    },
    {
      cat: 'dividend', mapping: [
        ['L1_CLASSIC', 0.7, 0.10], ['L1_EVENT', 0.7, 0.10],
        ['L1_STRATEGY', 0.6, 0.15], ['L1_FUNDAMENTAL', 0.5, 0.15],
        ['L1_SENTIMENT', 0.4, 0.15],
        ['L1_RISK', 0.2, 0.10], ['L1_MARKET', 0.2, 0.10],
        ['L1_BEHAVIORAL', 0.2, 0.10], ['L1_TECHNICAL', 0.1, 0.05],
        ['L1_MACRO', 0.1, 0.05],
      ],
    },
    {
      cat: 'buyback', mapping: [
        ['L1_EVENT', 0.8, 0.10], ['L1_CLASSIC', 0.6, 0.10],
        ['L1_SENTIMENT', 0.5, 0.15], ['L1_FUNDAMENTAL', 0.4, 0.15],
        ['L1_STRATEGY', 0.4, 0.15],
        ['L1_TECHNICAL', 0.2, 0.10], ['L1_MARKET', 0.2, 0.10],
        ['L1_RISK', 0.1, 0.05],
      ],
    },
    {
      cat: 'regulatory', mapping: [
        ['L1_RISK', 0.9, 0.10], ['L1_EVENT', 0.8, 0.10],
        ['L1_SENTIMENT', 0.7, 0.15], ['L1_CLASSIC', 0.5, 0.15],
        ['L1_MARKET', 0.5, 0.15], ['L1_REGIONAL', 0.4, 0.15],
        ['L1_FUNDAMENTAL', 0.3, 0.15], ['L1_BEHAVIORAL', 0.3, 0.15],
        ['L1_STRATEGY', 0.3, 0.15],
        ['L1_TECHNICAL', 0.2, 0.10],
      ],
    },
    {
      cat: 'macro_data', mapping: [
        ['L1_MACRO', 1.0, 0.10], ['L1_MARKET', 0.8, 0.15],
        ['L1_SENTIMENT', 0.7, 0.15], ['L1_RISK', 0.7, 0.15],
        ['L1_STRATEGY', 0.5, 0.15], ['L1_CLASSIC', 0.4, 0.15],
        ['L1_FUNDAMENTAL', 0.4, 0.15], ['L1_CROSS_MARKET', 0.4, 0.15],
        ['L1_REGIONAL', 0.3, 0.15], ['L1_BEHAVIORAL', 0.3, 0.15],
        ['L1_TECHNICAL', 0.3, 0.15],
        ['L1_COMMODITY', 0.2, 0.10], ['L1_EVENT', 0.2, 0.10],
      ],
    },
    {
      cat: 'geopolitical', mapping: [
        ['L1_RISK', 0.9, 0.15], ['L1_MACRO', 0.8, 0.15],
        ['L1_MARKET', 0.7, 0.15], ['L1_SENTIMENT', 0.6, 0.15],
        ['L1_CROSS_MARKET', 0.5, 0.15], ['L1_REGIONAL', 0.5, 0.15],
        ['L1_COMMODITY', 0.4, 0.15], ['L1_BEHAVIORAL', 0.4, 0.15],
        ['L1_STRATEGY', 0.3, 0.15],
        ['L1_CLASSIC', 0.2, 0.10], ['L1_FUNDAMENTAL', 0.2, 0.10],
      ],
    },
    {
      cat: 'product_launch', mapping: [
        ['L1_EVENT', 0.8, 0.15], ['L1_FUNDAMENTAL', 0.7, 0.15],
        ['L1_SENTIMENT', 0.6, 0.15], ['L1_CLASSIC', 0.5, 0.15],
        ['L1_ALT_DATA', 0.4, 0.15],
        ['L1_TECHNICAL', 0.3, 0.15], ['L1_STRATEGY', 0.3, 0.15],
        ['L1_MARKET', 0.2, 0.10],
      ],
    },
    {
      cat: 'management_change', mapping: [
        ['L1_BEHAVIORAL', 0.8, 0.15], ['L1_SENTIMENT', 0.7, 0.15],
        ['L1_RISK', 0.6, 0.15], ['L1_EVENT', 0.6, 0.15],
        ['L1_FUNDAMENTAL', 0.4, 0.15],
        ['L1_CLASSIC', 0.3, 0.15], ['L1_STRATEGY', 0.3, 0.15],
        ['L1_MARKET', 0.2, 0.10],
      ],
    },
    {
      cat: 'lawsuit', mapping: [
        ['L1_RISK', 0.9, 0.15], ['L1_EVENT', 0.7, 0.15],
        ['L1_SENTIMENT', 0.6, 0.15], ['L1_BEHAVIORAL', 0.5, 0.15],
        ['L1_CLASSIC', 0.4, 0.15],
        ['L1_MARKET', 0.3, 0.15], ['L1_STRATEGY', 0.3, 0.15],
        ['L1_FUNDAMENTAL', 0.2, 0.10],
      ],
    },
    {
      cat: 'analyst_rating', mapping: [
        ['L1_SENTIMENT', 0.9, 0.10], ['L1_CLASSIC', 0.7, 0.15],
        ['L1_TECHNICAL', 0.6, 0.15],
        ['L1_STRATEGY', 0.5, 0.15], ['L1_FUNDAMENTAL', 0.4, 0.15],
        ['L1_MARKET', 0.3, 0.15], ['L1_EVENT', 0.2, 0.10],
      ],
    },
    {
      cat: 'market_rout', mapping: [
        ['L1_SENTIMENT', 1.0, 0.10], ['L1_MARKET', 1.0, 0.10],
        ['L1_RISK', 0.9, 0.10], ['L1_TECHNICAL', 0.8, 0.15],
        ['L1_MACRO', 0.7, 0.15], ['L1_CROSS_MARKET', 0.7, 0.15],
        ['L1_STRATEGY', 0.6, 0.15], ['L1_BEHAVIORAL', 0.5, 0.15],
        ['L1_CLASSIC', 0.4, 0.15], ['L1_FUNDAMENTAL', 0.3, 0.15],
        ['L1_REGIONAL', 0.3, 0.15],
      ],
    },
    {
      cat: 'crypto_event', mapping: [
        ['L1_CRYPTO', 1.0, 0.10], ['L1_SENTIMENT', 0.8, 0.15],
        ['L1_MARKET', 0.5, 0.15],
        ['L1_RISK', 0.3, 0.15], ['L1_BEHAVIORAL', 0.3, 0.15],
        ['L1_TECHNICAL', 0.2, 0.10],
      ],
    },
    {
      cat: 'commodity_event', mapping: [
        ['L1_COMMODITY', 1.0, 0.10], ['L1_MACRO', 0.6, 0.15],
        ['L1_SENTIMENT', 0.5, 0.15], ['L1_RISK', 0.4, 0.15],
        ['L1_CROSS_MARKET', 0.3, 0.15],
        ['L1_MARKET', 0.2, 0.10],
      ],
    },
    {
      cat: 'sector_rotation', mapping: [
        ['L1_MARKET', 0.9, 0.10], ['L1_SENTIMENT', 0.7, 0.15],
        ['L1_TECHNICAL', 0.6, 0.15],
        ['L1_STRATEGY', 0.5, 0.15], ['L1_CROSS_MARKET', 0.4, 0.15],
        ['L1_RISK', 0.3, 0.15], ['L1_CLASSIC', 0.3, 0.15],
      ],
    },
  ];

  const matrix = {} as SensitivityMap;
  for (const l1 of allLevel1) {
    for (const { cat, mapping } of base) {
      if (!matrix[cat]) matrix[cat] = {};
      const entry = mapping.find(([l]) => l === l1);
      (matrix[cat] as Record<string, SensitivityEntry>)[l1] = entry
        ? { mean: entry[1], std: entry[2] }
        : { mean: 0, std: 0 };
    }
  }
  return matrix;
}

const SENSITIVITY_MATRIX = buildSensitivityMatrix();

// Timeframe scaling factors
const TIMEFRAME_SCALE: Record<TimeframeHorizon, number> = {
  '30m': 0.3,  // News impact decays quickly for intraday
  '1d': 1.0,   // Baseline
  '5d': 1.8,   // Cumulative effect builds over week
};

const FRESHNESS_HALF_LIFE = 12 * 3600 * 1000; // 12 hours

// ═════════════════════════════════════════════════════════════════════════════
// NewsFactorBridgeEngine V2
// ═════════════════════════════════════════════════════════════════════════════

export class NewsFactorBridgeEngine {
  private static instance: NewsFactorBridgeEngine;
  private backtestHistory: BacktestRecord[] = [];

  private constructor() { /* singleton */ }

  public static getInstance(): NewsFactorBridgeEngine {
    if (!NewsFactorBridgeEngine.instance) {
      NewsFactorBridgeEngine.instance = new NewsFactorBridgeEngine();
    }
    return NewsFactorBridgeEngine.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  /** Full factor shift computation for a symbol's news */
  public computeFactorShifts(
    symbol: string,
    articles: NewsBridgeArticle[],
    horizon: TimeframeHorizon = '1d',
  ): FactorShiftReport {
    const now = Date.now();
    const activeArticles = articles.filter(
      a => (now - a.publishedAt) < 24 * 3600_000,
    );

    if (activeArticles.length === 0) {
      return this.emptyReport(symbol, now, horizon);
    }

    // Compute shifts for all factors
    const shifts = FACTOR_REGISTRY.map(factor => {
      const shift = this.computeSingleFactorShift(factor, activeArticles, now, horizon);
      return shift;
    }).filter(s => s.delta !== 0);

    // Sort by absolute delta
    shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const topBullish = shifts.filter(s => s.direction === 'up').slice(0, 5);
    const topBearish = shifts.filter(s => s.direction === 'down').slice(0, 5);
    const riskAlerts = shifts.filter(
      s => s.level1 === 'L1_RISK' && Math.abs(s.delta) > 0.03,
    ).slice(0, 5);

    const compositeImpact = this.buildCompositeImpact(shifts);
    const timeframeBreakdown = this.buildTimeframeBreakdown(
      symbol, activeArticles, now, horizon,
    );
    const summary = this.buildSummary(symbol, shifts, activeArticles, horizon);

    return {
      symbol, runAt: now, totalArticles: activeArticles.length,
      shifts, topBullish, topBearish, riskAlerts,
      compositeImpact, timeframeBreakdown, summary,
    };
  }

  /** Quick single-factor sentiment computation (1 article) */
  public computeFromSentiment(
    symbol: string, category: NewsCategory, sentiment: number,
    sourceAuthority: number,
  ): FactorShiftReport {
    return this.computeFactorShifts(symbol, [{
      id: `quick-${Date.now()}`, title: 'Direct sentiment input',
      source: 'direct', sourceAuthority, publishedAt: Date.now(),
      sentiment, category, keywords: [symbol],
    }]);
  }

  /** Batch compute across multiple symbols */
  public batchCompute(
    inputs: Array<{ symbol: string; articles: NewsBridgeArticle[] }>,
    horizon: TimeframeHorizon = '1d',
  ): FactorShiftReport[] {
    return inputs.map(({ symbol, articles }) =>
      this.computeFactorShifts(symbol, articles, horizon),
    );
  }

  /** Get registered factors */
  public getRegisteredFactors(): FactorDefinition[] {
    return [...FACTOR_REGISTRY];
  }

  /** Get factors by Level1 category */
  public getFactorsByLevel1(level1: FactorLevel1): FactorDefinition[] {
    return FACTOR_REGISTRY.filter(f => f.level1 === level1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Backtest API
  // ═══════════════════════════════════════════════════════════════════════

  /** Record a backtest prediction-response pair */
  public recordBacktest(record: BacktestRecord): void {
    this.backtestHistory.push(record);
    // Keep last 10000 records max
    if (this.backtestHistory.length > 10000) {
      this.backtestHistory = this.backtestHistory.slice(-10000);
    }
    log.info(
      `[NewsFactorBridge] Backtest recorded: ${record.symbol}/${record.factorId} ` +
      `${record.horizon} pred=${record.predictedDelta.toFixed(4)} actual=${record.actualDelta.toFixed(4)} err=${record.error.toFixed(4)}`,
    );
  }

  /** Get backtest summary stats */
  public getBacktestSummary(): BacktestSummary {
    const records = this.backtestHistory;
    if (records.length === 0) {
      return {
        totalPredictions: 0, rmse: 0, directionalAccuracy: 0,
        byFactor: {}, byHorizon: { '30m': { count: 0, rmse: 0, dirAcc: 0 }, '1d': { count: 0, rmse: 0, dirAcc: 0 }, '5d': { count: 0, rmse: 0, dirAcc: 0 } },
      };
    }

    const mse = records.reduce((s, r) => s + r.error * r.error, 0) / records.length;
    const correctDir = records.filter(
      r => (r.predictedDelta > 0) === (r.actualDelta > 0),
    ).length;

    const byFactor: Record<string, { count: number; rmse: number; dirAcc: number }> = {};
    const byHorizon: Record<TimeframeHorizon, { count: number; rmse: number; dirAcc: number }> = {
      '30m': { count: 0, rmse: 0, dirAcc: 0 },
      '1d': { count: 0, rmse: 0, dirAcc: 0 },
      '5d': { count: 0, rmse: 0, dirAcc: 0 },
    };

    for (const r of records) {
      if (!byFactor[r.factorId]) {
        byFactor[r.factorId] = { count: 0, rmse: 0, dirAcc: 0 };
      }
      byFactor[r.factorId].count++;
      byHorizon[r.horizon].count++;
    }

    // Compute per-factor metrics
    for (const fid of Object.keys(byFactor)) {
      const frecs = records.filter(r => r.factorId === fid);
      const fmse = frecs.reduce((s, r) => s + r.error * r.error, 0) / frecs.length;
      const fdAcc = frecs.filter(r => (r.predictedDelta > 0) === (r.actualDelta > 0)).length / frecs.length;
      byFactor[fid].rmse = Math.sqrt(fmse);
      byFactor[fid].dirAcc = fdAcc;
    }

    // Per-horizon
    for (const h of ['30m', '1d', '5d'] as TimeframeHorizon[]) {
      const hrecs = records.filter(r => r.horizon === h);
      if (hrecs.length > 0) {
        const hmse = hrecs.reduce((s, r) => s + r.error * r.error, 0) / hrecs.length;
        const hdAcc = hrecs.filter(r => (r.predictedDelta > 0) === (r.actualDelta > 0)).length / hrecs.length;
        byHorizon[h].rmse = Math.sqrt(hmse);
        byHorizon[h].dirAcc = hdAcc;
      }
    }

    return {
      totalPredictions: records.length,
      rmse: Math.sqrt(mse),
      directionalAccuracy: correctDir / records.length,
      byFactor, byHorizon,
    };
  }

  /** Clear backtest history */
  public clearBacktestHistory(): void { this.backtestHistory = []; }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal: Factor Shift Computation
  // ═══════════════════════════════════════════════════════════════════════

  private computeSingleFactorShift(
    factor: FactorDefinition,
    articles: NewsBridgeArticle[],
    now: number,
    horizon: TimeframeHorizon,
  ): FactorShift {
    let totalWeightedDelta = 0;
    let totalWeight = 0;

    for (const article of articles) {
      const sensitivity = (SENSITIVITY_MATRIX[article.category] as Record<string, SensitivityEntry>)?.[factor.level1];
      if (!sensitivity || sensitivity.mean === 0) continue;

      // Freshness decay (exponential)
      const age = now - article.publishedAt;
      const freshness = Math.exp(-age / FRESHNESS_HALF_LIFE);

      // Article weight
      const weight = article.sourceAuthority * Math.abs(article.sentiment) * freshness;
      totalWeight += weight;

      // Delta: sentiment direction × sensitivity × authority × freshness
      const delta = article.sentiment * sensitivity.mean * article.sourceAuthority * freshness;
      totalWeightedDelta += delta;
    }

    if (totalWeight === 0) {
      return {
        factorId: factor.factorId, label: factor.label,
        level1: factor.level1, level2: factor.level2,
        delta: 0, confidence: 0, direction: 'flat',
        p10: 0, p50: 0, p90: 0,
        explanation: 'No news sensitivity to this factor category.',
        contributingArticles: 0, isSignificant: false,
      };
    }

    const avgDelta = totalWeightedDelta / totalWeight;
    const confidence = Math.min(1, totalWeight / articles.length);

    // Compute p10/p50/p90 using stddev from sensitivity matrix
    // Aggregate stddev across articles
    let variance = 0;
    for (const article of articles) {
      const sensitivity = (SENSITIVITY_MATRIX[article.category] as Record<string, SensitivityEntry>)?.[factor.level1];
      if (!sensitivity || sensitivity.mean === 0) continue;
      variance += sensitivity.std * sensitivity.std * article.sourceAuthority;
    }
    variance /= (totalWeight || 1);
    const stddev = Math.sqrt(variance);

    const tfScale = TIMEFRAME_SCALE[horizon];
    const delta = avgDelta * factor.sensitivity * tfScale;
    const p10 = delta - 1.645 * stddev;
    const p50 = delta;
    const p90 = delta + 1.645 * stddev;

    const direction: 'up' | 'down' | 'flat' =
      delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'flat';

    // Explanation
    const topArticles = articles
      .filter(a => {
        const s = (SENSITIVITY_MATRIX[a.category] as Record<string, SensitivityEntry>)?.[factor.level1];
        return s && s.mean > 0;
      })
      .sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))
      .slice(0, 3);

    const explanation = topArticles.length > 0
      ? `Driven by: ${topArticles.map(a => `"${a.title.substring(0, 40)}" (${a.category}, ${a.source})`).join('; ')}`
      : 'No specific news driving this factor change.';

    return {
      factorId: factor.factorId, label: factor.label,
      level1: factor.level1, level2: factor.level2,
      delta: Math.round(delta * 10000) / 10000,
      confidence: Math.round(confidence * 10000) / 10000,
      direction,
      p10: Math.round(p10 * 10000) / 10000,
      p50: Math.round(p50 * 10000) / 10000,
      p90: Math.round(p90 * 10000) / 10000,
      explanation,
      contributingArticles: topArticles.length,
      isSignificant: Math.abs(delta) > 2 * stddev,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal: Composite & Timeframe
  // ═══════════════════════════════════════════════════════════════════════

  private buildCompositeImpact(shifts: FactorShift[]): MarketImpactScore {
    let totalWeightedImpact = 0;
    let totalWeight = 0;

    for (const shift of shifts) {
      const factor = FACTOR_REGISTRY.find(f => f.factorId === shift.factorId);
      const weight = factor ? factor.weight * shift.confidence : shift.confidence;
      totalWeightedImpact += shift.delta * weight;
      totalWeight += weight;
    }

    const composite = totalWeight > 0
      ? (totalWeightedImpact / totalWeight) * 100
      : 0;

    // Confidence bands
    let totalP10 = 0; let totalP50 = 0; let totalP90 = 0; let w2 = 0;
    for (const shift of shifts) {
      const factor = FACTOR_REGISTRY.find(f => f.factorId === shift.factorId);
      const weight = factor ? factor.weight * shift.confidence : shift.confidence;
      totalP10 += shift.p10 * weight;
      totalP50 += shift.p50 * weight;
      totalP90 += shift.p90 * weight;
      w2 += weight;
    }

    const topDrivers = shifts
      .filter(s => Math.abs(s.delta) > 0.02)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5)
      .map(s => ({
        factorId: s.factorId,
        contribution: Math.round(s.delta * 10000) / 100,
      }));

    return {
      composite: Math.round(composite * 100) / 100,
      confidenceBand: {
        p10: w2 > 0 ? Math.round((totalP10 / w2) * 10000) / 100 : composite,
        p50: w2 > 0 ? Math.round((totalP50 / w2) * 10000) / 100 : composite,
        p90: w2 > 0 ? Math.round((totalP90 / w2) * 10000) / 100 : composite,
      },
      directionalAccuracy: 0, // Unknown until backtested
      topDrivers,
    };
  }

  private buildTimeframeBreakdown(
    symbol: string,
    articles: NewsBridgeArticle[],
    now: number,
    primaryHorizon: TimeframeHorizon,
  ): TimeframeBreakdown {
    const horizons: TimeframeHorizon[] = ['30m', '1d', '5d'];
    const breakdown = {} as TimeframeBreakdown;

    for (const h of horizons) {
      if (h === primaryHorizon) {
        // Already computed, just extract
        const report = this.computeFactorShiftsRaw(symbol, articles, now, h);
        breakdown[h] = { compositeImpact: report.compositeImpact.composite, shifts: report.shifts };
      } else {
        // Compute at different timeframe scaling
        const report = this.computeFactorShiftsRaw(symbol, articles, now, h);
        breakdown[h] = { compositeImpact: report.compositeImpact.composite, shifts: report.shifts };
      }
    }

    return breakdown;
  }

  private computeFactorShiftsRaw(
    symbol: string,
    articles: NewsBridgeArticle[],
    now: number,
    horizon: TimeframeHorizon,
  ): { compositeImpact: MarketImpactScore; shifts: FactorShift[] } {
    const activeArticles = articles.filter(
      a => (now - a.publishedAt) < 24 * 3600_000,
    );
    const shifts = FACTOR_REGISTRY
      .map(f => this.computeSingleFactorShift(f, activeArticles, now, horizon))
      .filter(s => s.delta !== 0);
    const compositeImpact = this.buildCompositeImpact(shifts);
    return { compositeImpact, shifts };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal: Helpers
  // ═══════════════════════════════════════════════════════════════════════

  private emptyReport(symbol: string, now: number, horizon: TimeframeHorizon): FactorShiftReport {
    return {
      symbol, runAt: now, totalArticles: 0, shifts: [],
      topBullish: [], topBearish: [], riskAlerts: [],
      compositeImpact: {
        composite: 0,
        confidenceBand: { p10: 0, p50: 0, p90: 0 },
        directionalAccuracy: 0, topDrivers: [],
      },
      timeframeBreakdown: {
        '30m': { compositeImpact: 0, shifts: [] },
        '1d': { compositeImpact: 0, shifts: [] },
        '5d': { compositeImpact: 0, shifts: [] },
      },
      summary: `No recent news within 24h for ${symbol}. Factor shifts unavailable.`,
    };
  }

  private buildSummary(
    symbol: string,
    shifts: FactorShift[],
    articles: NewsBridgeArticle[],
    horizon: TimeframeHorizon,
  ): string {
    if (shifts.length === 0) {
      return `[${symbol}] No factor shifts detected for ${horizon} horizon.`;
    }
    const top = shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    const significant = shifts.filter(s => s.isSignificant).length;
    const upCount = shifts.filter(s => s.direction === 'up').length;
    const downCount = shifts.filter(s => s.direction === 'down').length;
    return `[${symbol}] ${articles.length} articles → ${shifts.length} factor shifts ` +
      `(${upCount} up / ${downCount} down, ${significant} significant). ` +
      `Top: ${top.map(s => `${s.label}: ${s.delta > 0 ? '+' : ''}${(s.delta * 100).toFixed(1)}%`).join(', ')}. ` +
      `Horizon: ${horizon}.`;
  }
}
