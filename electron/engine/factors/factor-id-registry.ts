// ══ R184 P0: Factor ID Registry v2 ══ 187 Factors + 3-Level Classification ══
// Single source of truth for ALL factor identifiers across the DAWN WHALES
// factor system. Every module MUST reference factor IDs through this registry.
//
// v2 changes (R184):
//   - Expanded from 44 to 187 canonical factor IDs (+143)
//   - Added 3-level classification: L1 (15 major) / L2 (55 sub) / L3 (187 factors)
//   - All new factor IDs are globally unique
//   - Backward compatible — all existing IDs preserved
//
// v1 (R170): 44 factors, flat category map
// v2 (R184): 187 factors, 3-level hierarchy
//
// Reference: autoclaw 101-factor proposal + JVS HK/US/Crypto deep audit
// Coverage: US equities, HK equities, Crypto (no A-share)

// ── L1 Major Category (15 categories) ─────────────────────────────

export type FactorLevel1 =
  | 'L1_CLASSIC'      // Classic Factor (Fama-French + Carhart)
  | 'L1_FUNDAMENTAL'  // Fundamental Deep-Dive
  | 'L1_ANALYST'      // Analyst Sentiment
  | 'L1_SENTIMENT'    // Market Sentiment & Behavioral
  | 'L1_TECHNICAL'    // Technical Indicators
  | 'L1_RISK'         // Risk & Tail
  | 'L1_MACRO'        // Macro Sensitivity
  | 'L1_REVERSAL'     // Reversal & Seasonality
  | 'L1_US'           // US-Specific
  | 'L1_HK'           // HK-Specific
  | 'L1_CRYPTO'       // Crypto
  | 'L1_CROSS_ASSET'  // Cross-Asset & Carry
  | 'L1_EVENT'        // Event-Driven
  | 'L1_ESG'          // ESG & Sustainability
  | 'L1_LEGACY'       // Legacy / Deprecated
  | 'L1_COMMODITY'    // Commodity Futures

// ── L2 Sub-Category (55 sub-categories) ───────────────────────────

export type FactorLevel2 =
  // Classic
  | 'L2_MARKET_RISK' | 'L2_SIZE' | 'L2_VALUE' | 'L2_MOMENTUM'
  | 'L2_QUALITY' | 'L2_GROWTH' | 'L2_YIELD'
  // Fundamental
  | 'L2_PROFIT_QUALITY' | 'L2_YIELD_QUALITY' | 'L2_RISK_STRUCTURE'
  | 'L2_EFFICIENCY' | 'L2_VALUE_DEEP' | 'L2_HEALTH'
  // Analyst
  | 'L2_RATING' | 'L2_FORECAST'
  // Sentiment
  | 'L2_MARKET_MOOD' | 'L2_OPTIONS' | 'L2_SOCIAL' | 'L2_FLOW'
  // Technical
  | 'L2_TREND' | 'L2_OSCILLATOR' | 'L2_VOLATILITY' | 'L2_VOLUME'
  // Risk
  | 'L2_LIQUIDITY' | 'L2_DOWNSIDE' | 'L2_RISK_ADJUSTED' | 'L2_STRUCTURAL'
  // Macro
  | 'L2_CYCLE' | 'L2_CURRENCY' | 'L2_SENSITIVITY'
  // Reversal
  | 'L2_SHORT_TERM' | 'L2_LONG_TERM' | 'L2_SEASONAL' | 'L2_STATISTICAL'
  // Commodity
  | 'L2_TERM_STRUCTURE' | 'L2_INVENTORY' | 'L2_MOMENTUM' | 'L2_VOLATILITY'
  | 'L2_FLOW' | 'L2_FUNDAMENTAL' | 'L2_SEASONAL'
  // US
  | 'L2_CORPORATE' | 'L2_EVENT' | 'L2_STATS' | 'L2_VALUE'
  | 'L2_SENTIMENT' | 'L2_YIELD' | 'L2_FLOW' | 'L2_SOCIAL' | 'L2_VOLATILITY'
  // HK
  | 'L2_PRICING' | 'L2_DERIVATIVES' | 'L2_RISK' | 'L2_SENTIMENT' | 'L2_FLOW'
  // Crypto
  | 'L2_MICROSTRUCTURE' | 'L2_VALUATION' | 'L2_ONCHAIN' | 'L2_CORRELATION'
  | 'L2_PERFORMANCE' | 'L2_FUNDAMENTAL' | 'L2_YIELD' | 'L2_MOMENTUM'
  | 'L2_SENTIMENT' | 'L2_DERIVATIVES' | 'L2_RISK' | 'L2_EVENT'
  | 'L2_VOLUME' | 'L2_FLOW' | 'L2_SOCIAL'
  // Cross-Asset
  | 'L2_CARRY' | 'L2_PRICING' | 'L2_CORRELATION' | 'L2_MOMENTUM'
  // Event
  | 'L2_EARNINGS' | 'L2_REBALANCE' | 'L2_CORPORATE'
  // ESG
  | 'L2_OVERALL' | 'L2_ENVIRONMENT' | 'L2_GOVERNANCE' | 'L2_SOCIAL'
  // Legacy
  | 'L2_DEPRECATED';

// ── Factor Level 3 Metadata ───────────────────────────────────────

export interface FactorLevel3Meta {
  /** Canonical factor ID (unique string) */
  id: string;
  /** Human-readable English name */
  nameEn: string;
  /** Human-readable Chinese name */
  nameCn: string;
  /** L1 major category */
  level1: FactorLevel1;
  /** L2 sub-category */
  level2: FactorLevel2;
}

// ── Canonical Factor ID type ──────────────────────────────────────

export type FactorId = string;

// ── 187 Factor Registry — Single Source of Truth ──────────────────
// Format: [id, nameEn, nameCn, level1, level2]

const FACTOR_SPEC: [string, string, string, FactorLevel1, FactorLevel2][] = [
  // ════════════════════════════════════════ 1. Classic Factor (Fama-French + Carhart) ════════════════════════════════════════
  ['MKT', 'MarketBeta', '市场Beta', 'L1_CLASSIC', 'L2_MARKET_RISK'],
  ['SIZE', 'Size', '规模效应', 'L1_CLASSIC', 'L2_SIZE'],
  ['HML', 'BookToMarket', '市净率估值', 'L1_CLASSIC', 'L2_VALUE'],
  ['EP_RATIO', 'EarningsYield', '市盈率倒数', 'L1_CLASSIC', 'L2_VALUE'],
  ['CFP_RATIO', 'CashFlowPrice', '现金收益率', 'L1_CLASSIC', 'L2_VALUE'],
  ['MOM_12M', 'Momentum12M', '12月动量', 'L1_CLASSIC', 'L2_MOMENTUM'],
  ['MOM_6M', 'Momentum6M', '6月动量', 'L1_CLASSIC', 'L2_MOMENTUM'],
  ['MOM_1M', 'Momentum1M', '1月动量', 'L1_CLASSIC', 'L2_MOMENTUM'],
  ['MOM_6_1', 'Momentum6Minus1', '6-1月动量', 'L1_CLASSIC', 'L2_MOMENTUM'],
  ['RMW', 'RobustMinusWeak', '盈利能力', 'L1_CLASSIC', 'L2_QUALITY'],
  ['CMA', 'ConservativeMinusAggressive', '投资风格', 'L1_CLASSIC', 'L2_QUALITY'],
  ['QUAL', 'Quality', '质量综合', 'L1_CLASSIC', 'L2_QUALITY'],
  ['GROWTH', 'Growth', '成长性', 'L1_CLASSIC', 'L2_GROWTH'],
  ['YIELD', 'DividendYield', '股息率', 'L1_CLASSIC', 'L2_YIELD'],
  ['DIV_YIELD_12M', 'DividendYield12M', '12月股息率', 'L1_CLASSIC', 'L2_YIELD'],
  // ════════════════════════════════════════ 2. Fundamental Deep-Dive ════════════════════════════════════════
  ['ACCRUALS', 'Accruals', '应计利润', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['EARNINGS_VARIABILITY', 'EarningsVariability', '盈利波动率', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['GROSS_PROFITABILITY', 'GrossProfitability', '毛利润率', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['NET_PAYOUT', 'NetPayout', '净派息率', 'L1_FUNDAMENTAL', 'L2_YIELD_QUALITY'],
  ['OPERATING_LEVERAGE', 'OperatingLeverage', '经营杠杆', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  ['ASSET_TURNOVER', 'AssetTurnover', '资产周转率', 'L1_FUNDAMENTAL', 'L2_EFFICIENCY'],
  ['CASH_FLOW_YIELD', 'CashFlowYield', '自由现金流收益率', 'L1_FUNDAMENTAL', 'L2_VALUE_DEEP'],
  ['DEBT_COVERAGE', 'DebtCoverage', '利息覆盖倍数', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  ['EARNINGS_SURPRISE', 'EarningsSurprise', '盈利超预期', 'L1_FUNDAMENTAL', 'L2_EVENT'],
  ['EARN_QUALITY', 'EarningsQuality', '盈利质量', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['GROSS_MARGIN_TREND', 'GrossMarginTrend', '毛利率趋势', 'L1_FUNDAMENTAL', 'L2_EFFICIENCY'],
  ['F_SCORE', 'PiotroskiFScore', 'F分数财务健康', 'L1_FUNDAMENTAL', 'L2_HEALTH'],
  ['ROE_STABILITY', 'RoeStability', 'ROE稳定性', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['INVENTORY_TURNOVER', 'InventoryTurnover', '存货周转率', 'L1_FUNDAMENTAL', 'L2_EFFICIENCY'],
  ['RECEIVABLE_TURNOVER', 'ReceivableTurnover', '应收账款周转', 'L1_FUNDAMENTAL', 'L2_EFFICIENCY'],
  ['FREE_CASH_FLOW', 'FreeCashFlow', '自由现金流', 'L1_FUNDAMENTAL', 'L2_VALUE_DEEP'],
  ['CURRENT_RATIO', 'CurrentRatio', '流动比率', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  ['INTEREST_COVERAGE', 'InterestCoverage', '利息覆盖', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  // ════════════════════════════════════════ 3. Analyst Sentiment ════════════════════════════════════════
  ['ANALYST_MOMENTUM', 'AnalystMomentum', '分析师动量', 'L1_ANALYST', 'L2_RATING'],
  ['EARNINGS_REVISION', 'EarningsRevision', '盈利修正', 'L1_ANALYST', 'L2_FORECAST'],
  ['TARGET_PRICE_IMPLIED', 'TargetPriceImplied', '目标价隐含空间', 'L1_ANALYST', 'L2_FORECAST'],
  ['ANALYST_DISPERSION', 'AnalystDispersion', '分析师分歧度', 'L1_ANALYST', 'L2_FORECAST'],
  ['RECOMMENDATION_CHANGE', 'RecommendationChange', '评级变化方向', 'L1_ANALYST', 'L2_RATING'],
  ['REVISION_RATIO', 'RevisionRatio', '上调下调比', 'L1_ANALYST', 'L2_RATING'],
  // ════════════════════════════════════════ 4. Market Sentiment & Behavioral ════════════════════════════════════════
  ['FEAR_GREED_INDEX', 'FearGreedIndex', '恐惧贪婪指数', 'L1_SENTIMENT', 'L2_MARKET_MOOD'],
  ['PUT_CALL_SKEW', 'PutCallSkew', '期权偏度', 'L1_SENTIMENT', 'L2_OPTIONS'],
  ['HIGH_LOW_RATIO', 'HighLowRatio', '新高新低比', 'L1_SENTIMENT', 'L2_MARKET_MOOD'],
  ['ADVANCE_DECLINE', 'AdvanceDecline', '涨跌比', 'L1_SENTIMENT', 'L2_MARKET_MOOD'],
  ['OPTION_PCR', 'OptionPCR', 'Put/Call比率', 'L1_SENTIMENT', 'L2_OPTIONS'],
  ['SOCIAL_SENTIMENT', 'SocialSentiment', '社交情绪', 'L1_SENTIMENT', 'L2_SOCIAL'],
  ['MEDIA_ATTENTION', 'MediaAttention', '媒体关注度', 'L1_SENTIMENT', 'L2_SOCIAL'],
  ['INSIDER_TRADING', 'InsiderTrading', '内部交易信号', 'L1_SENTIMENT', 'L2_FLOW'],
  ['SHORT_COVERING', 'ShortCovering', '逼空压力', 'L1_SENTIMENT', 'L2_FLOW'],
  ['NEWS_SENTIMENT', 'NewsSentiment', '新闻情绪', 'L1_SENTIMENT', 'L2_SOCIAL'],
  ['INSTITUTIONAL_FLOW', 'InstitutionalFlow', '机构资金流', 'L1_SENTIMENT', 'L2_FLOW'],
  // ════════════════════════════════════════ 5. Technical Indicators ════════════════════════════════════════
  ['MA_20_60', 'MA2060', '均线交叉', 'L1_TECHNICAL', 'L2_TREND'],
  ['EMA_12_26', 'EMA1226', 'MACD', 'L1_TECHNICAL', 'L2_TREND'],
  ['RSI_14', 'RSI14', '相对强弱', 'L1_TECHNICAL', 'L2_OSCILLATOR'],
  ['KDJ', 'KDJ', 'KDJ随机', 'L1_TECHNICAL', 'L2_OSCILLATOR'],
  ['BOLL', 'Bollinger', '布林带', 'L1_TECHNICAL', 'L2_VOLATILITY'],
  ['ATR_14', 'ATR14', '真实波幅', 'L1_TECHNICAL', 'L2_VOLATILITY'],
  ['ADX', 'ADX', '趋向指标', 'L1_TECHNICAL', 'L2_TREND'],
  ['OBV', 'OBV', '能量潮', 'L1_TECHNICAL', 'L2_VOLUME'],
  ['CMF', 'CMF', '资金流量', 'L1_TECHNICAL', 'L2_VOLUME'],
  ['ICHIMOKU', 'Ichimoku', '一目均衡', 'L1_TECHNICAL', 'L2_TREND'],
  ['VWAP', 'VWAP', '成交量加权均价', 'L1_TECHNICAL', 'L2_VOLUME'],
  // ════════════════════════════════════════ 6. Risk & Tail ════════════════════════════════════════
  ['VOL_60D', 'Volatility60D', '60日波动率', 'L1_RISK', 'L2_VOLATILITY'],
  ['LIQ', 'Liquidity', '流动性', 'L1_RISK', 'L2_LIQUIDITY'],
  ['MAX_DRAWDOWN', 'MaxDrawdown', '最大回撤', 'L1_RISK', 'L2_DOWNSIDE'],
  ['VAR_95', 'VaR95', '95%风险价值', 'L1_RISK', 'L2_DOWNSIDE'],
  ['CVAR_95', 'CVaR95', '条件风险价值', 'L1_RISK', 'L2_DOWNSIDE'],
  ['DOWNSIDE_DEVIATION', 'DownsideDeviation', '下行偏差', 'L1_RISK', 'L2_DOWNSIDE'],
  ['SORTINO_RATIO', 'SortinoRatio', '索提诺比率', 'L1_RISK', 'L2_RISK_ADJUSTED'],
  ['OMEGA_RATIO', 'OmegaRatio', 'Omega比率', 'L1_RISK', 'L2_RISK_ADJUSTED'],
  ['TAIL_DEPENDENCE', 'TailDependence', '尾部相关', 'L1_RISK', 'L2_DOWNSIDE'],
  ['CROWDING', 'Crowding', '拥挤度', 'L1_RISK', 'L2_STRUCTURAL'],
  ['MOM_CRASH', 'MomentumCrash', '动量崩盘预警', 'L1_RISK', 'L2_DOWNSIDE'],
  ['BETA_STABILITY', 'BetaStability', 'Beta稳定性', 'L1_RISK', 'L2_VOLATILITY'],
  ['SKEWNESS', 'Skewness', '偏度', 'L1_RISK', 'L2_VOLATILITY'],
  ['KURTOSIS', 'Kurtosis', '峰度', 'L1_RISK', 'L2_VOLATILITY'],
  ['ALPHA_DECAY', 'AlphaDecay', 'Alpha衰减监测', 'L1_RISK', 'L2_STRUCTURAL'],
  // ════════════════════════════════════════ 7. Macro Sensitivity ════════════════════════════════════════
  ['SECTOR_ROTATION', 'SectorRotation', '板块轮动', 'L1_MACRO', 'L2_CYCLE'],
  ['FX_EXPOSURE', 'FXExposure', '外汇敞口', 'L1_MACRO', 'L2_CURRENCY'],
  ['RATE_BETA', 'RateBeta', '利率敏感度', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['INFLATION_BETA', 'InflationBeta', '通胀敏感度', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['USD_BETA', 'USDBeta', '美元敏感度', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['OIL_BETA', 'OilBeta', '原油敏感度', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['CREDIT_SPREAD_BETA', 'CreditSpreadBeta', '信用利差敏感度', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['ECONOMIC_SURPRISE', 'EconomicSurprise', '经济意外指数', 'L1_MACRO', 'L2_CYCLE'],
  ['MARKET_REGIME', 'MarketRegime', '市场状态', 'L1_MACRO', 'L2_CYCLE'],
  ['VOLUME_REGIME', 'VolumeRegime', '量能状态', 'L1_MACRO', 'L2_CYCLE'],
  ['YIELD_CURVE_SLOPE', 'YieldCurveSlope', '收益率曲线斜率', 'L1_MACRO', 'L2_CYCLE'],
  ['REAL_RATE', 'RealRate', '实际利率', 'L1_MACRO', 'L2_SENSITIVITY'],
  ['PMI_INDEX', 'PMIIndex', 'PMI指数', 'L1_MACRO', 'L2_CYCLE'],
  ['VOLATILITY_REGIME', 'VolatilityRegime', '波动率体制', 'L1_MACRO', 'L2_CYCLE'],
  ['FACTOR_LEAD_LAG', 'FactorLeadLag', '因子领先滞后', 'L1_MACRO', 'L2_CYCLE'],
  // ════════════════════════════════════════ 8. Reversal & Seasonality ════════════════════════════════════════
  ['STR_5D', 'ShortTermReversal5D', '5日短期反转', 'L1_REVERSAL', 'L2_SHORT_TERM'],
  ['LTR_60M', 'LongTermReversal60M', '60月长期反转', 'L1_REVERSAL', 'L2_LONG_TERM'],
  ['SEASONAL_1M', 'Seasonal1M', '月度效应', 'L1_REVERSAL', 'L2_SEASONAL'],
  ['GAP_REVERSION', 'GapReversion', '缺口回补', 'L1_REVERSAL', 'L2_SHORT_TERM'],
  ['MEAN_REVERSION_SPEED', 'MeanReversionSpeed', '均值回归速度', 'L1_REVERSAL', 'L2_STATISTICAL'],
  // ════════════════════════════════════════ 9. US-Specific ════════════════════════════════════════
  ['US_VIX', 'VIX', '恐慌指数', 'L1_US', 'L2_VOLATILITY'],
  ['US_SHORT_RATIO', 'ShortRatio', '空头比率', 'L1_US', 'L2_SENTIMENT'],
  ['US_INST_HOLD', 'InstitutionalHolding', '机构持仓', 'L1_US', 'L2_FLOW'],
  ['US_BUYBACK', 'Buyback', '回购活动', 'L1_US', 'L2_CORPORATE'],
  ['US_EARN_SURPRISE', 'USEarningsSurprise', '财报超预期', 'L1_US', 'L2_EVENT'],
  ['US_INSIDER_BUY', 'InsiderBuy', '内部人买入', 'L1_US', 'L2_FLOW'],
  ['US_SHORT_SQUEEZE', 'ShortSqueeze', '逼空风险', 'L1_US', 'L2_SENTIMENT'],
  ['US_MEME_INDEX', 'MemeIndex', 'Meme股热度', 'L1_US', 'L2_SOCIAL'],
  ['US_MARGIN_DEBT', 'MarginDebt', '保证金债务', 'L1_US', 'L2_FLOW'],
  ['US_RESIDUAL_MOM', 'ResidualMomentum', '残差动量', 'L1_US', 'L2_STATS'],
  ['US_EP_RATIO', 'USEarningsPrice', '美股PE倒数', 'L1_US', 'L2_VALUE'],
  ['US_BP_RATIO', 'USBookPrice', '美股PB倒数', 'L1_US', 'L2_VALUE'],
  ['US_DPS_STABILITY', 'DPSStability', '分红稳定性', 'L1_US', 'L2_YIELD'],
  // ════════════════════════════════════════ 10. HK-Specific ════════════════════════════════════════
  ['HKEX_SOUTHBOUND', 'Southbound', '南向资金', 'L1_HK', 'L2_FLOW'],
  ['HKEX_CBCS_PREMIUM', 'CBCSPremium', 'AH溢价', 'L1_HK', 'L2_PRICING'],
  ['HKEX_WARRANT_IV', 'WarrantIV', '涡轮引伸波幅', 'L1_HK', 'L2_DERIVATIVES'],
  ['HKEX_DLHB', 'DLHB', '大轮候补', 'L1_HK', 'L2_FLOW'],
  ['HKEX_FUND_HOLD', 'FundHolding', '基金持仓', 'L1_HK', 'L2_FLOW'],
  ['HK_SOUTHBOUND_FLOW', 'SouthboundFlowDaily', '南向净流入', 'L1_HK', 'L2_FLOW'],
  ['HK_SOUTHBOUND_TOP10', 'SouthboundTop10', '南向TOP10集中', 'L1_HK', 'L2_FLOW'],
  ['HK_SOUTHBOUND_MOM', 'SouthboundMomentum', '南向动量', 'L1_HK', 'L2_FLOW'],
  ['HK_CONTROLLING_SH', 'ControllingShareholder', '大股东质押率', 'L1_HK', 'L2_RISK'],
  ['HK_DIV_CUT_RISK', 'DividendCutRisk', '减分红风险', 'L1_HK', 'L2_RISK'],
  ['HK_WARRANT_GEX', 'WarrantGEX', '涡轮Gamma暴露', 'L1_HK', 'L2_DERIVATIVES'],
  ['HK_CBBC_STREET', 'CBBCStreetRatio', '街货比', 'L1_HK', 'L2_DERIVATIVES'],
  ['HK_WARRANT_OI', 'WarrantOIChange', '涡轮持仓变化', 'L1_HK', 'L2_DERIVATIVES'],
  ['HK_SHORT_SELL', 'ShortSellRatio', '沽空比率', 'L1_HK', 'L2_SENTIMENT'],
  ['HK_ACC_RECEIVABLE', 'AccReceivable', '应收异常', 'L1_HK', 'L2_RISK'],
  ['HK_AH_PREMIUM', 'AHPremium', 'AH溢价率', 'L1_HK', 'L2_PRICING'],
  // ════════════════════════════════════════ 11. Crypto ════════════════════════════════════════
  ['CRYPTO_FUNDING', 'FundingRate', '资金费率', 'L1_CRYPTO', 'L2_DERIVATIVES'],
  ['CRYPTO_OI_DELTA', 'OpenInterestDelta', '持仓量变化', 'L1_CRYPTO', 'L2_DERIVATIVES'],
  ['CRYPTO_EXCHANGE_FLOW', 'ExchangeFlow', '交易所流量', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_ORDERBOOK_IMB', 'OrderbookImbalance', '订单簿失衡', 'L1_CRYPTO', 'L2_MICROSTRUCTURE'],
  ['CRYPTO_VOL_RATIO', 'VolumeRatio', '量比', 'L1_CRYPTO', 'L2_VOLUME'],
  ['CRYPTO_VOLUME_PROFILE', 'VolumeProfile', '量价分布', 'L1_CRYPTO', 'L2_VOLUME'],
  ['CRYPTO_BTC_CORR', 'BTCCorrelation', 'BTC相关性', 'L1_CRYPTO', 'L2_CORRELATION'],
  ['CRYPTO_NVT', 'NVTRatio', 'NVT估值', 'L1_CRYPTO', 'L2_VALUATION'],
  ['CRYPTO_ACTIVE_ADDR', 'ActiveAddresses', '活跃地址', 'L1_CRYPTO', 'L2_ONCHAIN'],
  ['CRYPTO_LIQUIDATIONS', 'Liquidations', '清算量', 'L1_CRYPTO', 'L2_DERIVATIVES'],
  ['CRYPTO_SOCIAL_SENTIMENT', 'SocialSentimentCrypto', '社交情绪', 'L1_CRYPTO', 'L2_SOCIAL'],
  ['CRYPTO_WHALE_ACCUM', 'WhaleAccumulation', '大户累积', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_WHALE_DISTRIB', 'WhaleDistribution', '大户出货', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_MVRV', 'MVRVRatio', 'MVRV比率', 'L1_CRYPTO', 'L2_VALUATION'],
  ['CRYPTO_FEAR_GREED', 'CryptoFearGreed', '加密恐惧贪婪', 'L1_CRYPTO', 'L2_SENTIMENT'],
  ['CRYPTO_MOM_7D', 'Momentum7D', '7日动量', 'L1_CRYPTO', 'L2_MOMENTUM'],
  ['CRYPTO_MOM_30D', 'Momentum30D', '30日动量', 'L1_CRYPTO', 'L2_MOMENTUM'],
  ['CRYPTO_MOM_90D', 'Momentum90D', '90日动量', 'L1_CRYPTO', 'L2_MOMENTUM'],
  ['CRYPTO_ALPHA_VS_BTC', 'AlphaVsBTC', '相对BTC Alpha', 'L1_CRYPTO', 'L2_PERFORMANCE'],
  ['CRYPTO_ALT_SEASON', 'AltSeasonIndex', 'Alt-Season指数', 'L1_CRYPTO', 'L2_SENTIMENT'],
  ['CRYPTO_NVT_SIGNAL', 'NVTSignal', 'NVT信号', 'L1_CRYPTO', 'L2_VALUATION'],
  ['CRYPTO_STAKING_YIELD', 'StakingYield', '质押收益率', 'L1_CRYPTO', 'L2_YIELD'],
  ['CRYPTO_FEE_REVENUE', 'FeeRevenue', '协议费用收入', 'L1_CRYPTO', 'L2_FUNDAMENTAL'],
  ['CRYPTO_TVL_GROWTH', 'TVLGrowth', 'TVL增长率', 'L1_CRYPTO', 'L2_FUNDAMENTAL'],
  ['CRYPTO_MAX_DRAWDOWN_30D', 'MaxDrawdown30D', '30日最大回撤', 'L1_CRYPTO', 'L2_RISK'],
  ['CRYPTO_PRICE_CORRECTION', 'PriceCorrection', '回调幅度', 'L1_CRYPTO', 'L2_RISK'],
  ['CRYPTO_LIQUIDATION_RISK', 'LiquidationRisk', '清算风险', 'L1_CRYPTO', 'L2_RISK'],
  ['CRYPTO_EXCHANGE_RESERVE', 'ExchangeReserve', '交易所余额', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_BRIDGE_FLOW', 'BridgeFlow', '跨链桥流量', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_ECOSYSTEM_CORR', 'EcosystemCorrelation', '生态联动', 'L1_CRYPTO', 'L2_CORRELATION'],
  ['CRYPTO_VC_UNLOCK', 'VCUnlock', 'VC解锁压力', 'L1_CRYPTO', 'L2_EVENT'],
  ['CRYPTO_DEVELOPER_ACTIVITY', 'DeveloperActivity', '开发者活跃度', 'L1_CRYPTO', 'L2_FUNDAMENTAL'],
  ['CRYPTO_SMART_MONEY', 'SmartMoney', '聪明钱流向', 'L1_CRYPTO', 'L2_FLOW'],
  ['CRYPTO_STABLECOIN_RATIO', 'StablecoinRatio', '稳定币占比', 'L1_CRYPTO', 'L2_SENTIMENT'],
  // ════════════════════════════════════════ 12. Cross-Asset & Carry ════════════════════════════════════════
  ['CARRY_EQUITY', 'EquityCarry', '股票利差', 'L1_CROSS_ASSET', 'L2_CARRY'],
  ['CARRY_CRYPTO', 'CryptoCarry', '加密资金费率利差', 'L1_CROSS_ASSET', 'L2_CARRY'],
  ['CARRY_CURRENCY', 'CurrencyCarry', '货币利差', 'L1_CROSS_ASSET', 'L2_CARRY'],
  ['BOND_CARRY', 'BondCarry', '债券利差', 'L1_CROSS_ASSET', 'L2_CARRY'],
  ['CURRENCY_MOMENTUM', 'CurrencyMomentum', '货币动量', 'L1_CROSS_ASSET', 'L2_MOMENTUM'],
  ['GOLD_MOMENTUM', 'GoldMomentum', '黄金动量', 'L1_CROSS_ASSET', 'L2_MOMENTUM'],
  ['COMMODITY_SPREAD', 'CommoditySpread', '商品期现结构', 'L1_CROSS_ASSET', 'L2_PRICING'],
  ['CORR_REGIME', 'CorrelationRegime', '相关性体制', 'L1_CROSS_ASSET', 'L2_CORRELATION'],
  ['CROSS_ASSET_CORR', 'CrossAssetCorrelation', '跨资产联动', 'L1_CROSS_ASSET', 'L2_CORRELATION'],
  ['COMMODITY_MOMENTUM', 'CommodityMomentum', '商品动量', 'L1_CROSS_ASSET', 'L2_MOMENTUM'],
  ['BOND_MOMENTUM', 'BondMomentum', '债券动量', 'L1_CROSS_ASSET', 'L2_MOMENTUM'],
  ['FX_CARRY', 'FXCarry', '外汇利差', 'L1_CROSS_ASSET', 'L2_CARRY'],
  // ════════════════════════════════════════ 13. Event-Driven ════════════════════════════════════════
  ['PRE_EARNINGS_DRIFT', 'PreEarningsDrift', '盈利前漂移', 'L1_EVENT', 'L2_EARNINGS'],
  ['POST_EARNINGS_DRIFT', 'PostEarningsDrift', '盈利后漂移', 'L1_EVENT', 'L2_EARNINGS'],
  ['DIVIDEND_CAPTURE', 'DividendCapture', '分红捕获', 'L1_EVENT', 'L2_CORPORATE'],
  ['INDEX_REBALANCE', 'IndexRebalance', '指数调入效应', 'L1_EVENT', 'L2_REBALANCE'],
  ['IPO_LOCKUP_EXPIRY', 'IPOLockupExpiry', '解禁事件', 'L1_EVENT', 'L2_CORPORATE'],
  ['BUYBACK_ANNOUNCE', 'BuybackAnnouncement', '回购公告效应', 'L1_EVENT', 'L2_CORPORATE'],
  ['DIV_ANNOUNCEMENT', 'DividendAnnouncement', '分红公告日', 'L1_EVENT', 'L2_CORPORATE'],
  ['EARN_ANNOUNCEMENT', 'EarningsAnnouncement', '财报发布日', 'L1_EVENT', 'L2_EARNINGS'],
  // ════════════════════════════════════════ 14. ESG & Sustainability ════════════════════════════════════════
  ['ESG_SCORE', 'ESGScore', 'ESG综合评分', 'L1_ESG', 'L2_OVERALL'],
  ['CARBON_INTENSITY', 'CarbonIntensity', '碳强度', 'L1_ESG', 'L2_ENVIRONMENT'],
  ['GOVERNANCE_SCORE', 'GovernanceScore', '治理评分', 'L1_ESG', 'L2_GOVERNANCE'],
  ['GREEN_REVENUE', 'GreenRevenue', '绿色收入占比', 'L1_ESG', 'L2_ENVIRONMENT'],
  ['SOCIAL_SCORE', 'SocialScore', '社会责任评分', 'L1_ESG', 'L2_SOCIAL'],
  ['ESG_MOMENTUM', 'ESGMomentum', 'ESG进步速度', 'L1_ESG', 'L2_OVERALL'],
  // ════════════════════════════════════════ 15. Legacy / Deprecated ════════════════════════════════════════
  ['SMB', 'SMB_Deprecated', 'SMB(已废弃)', 'L1_LEGACY', 'L2_DEPRECATED'],
  ['QUALITY', 'Quality_Deprecated', 'Quality(已废弃)', 'L1_LEGACY', 'L2_DEPRECATED'],
  // ═══════════ R185: 27 new green-factor IDs ═══════════
  ['ROA', 'ROA', '总资产回报率', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['GROSS_MARGIN', 'GrossMargin', '毛利率', 'L1_FUNDAMENTAL', 'L2_PROFIT_QUALITY'],
  ['DEBT_TO_EQUITY', 'DebtToEquity', '负债权益比', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  ['INSIDER_BUYING', 'InsiderBuying', '内部人买入信号', 'L1_SENTIMENT', 'L2_FLOW'],
  ['FUND_FLOW', 'FundFlow', '资金净流入', 'L1_SENTIMENT', 'L2_FLOW'],
  ['ETF_FLOW', 'ETFFlow', 'ETF资金流', 'L1_SENTIMENT', 'L2_FLOW'],
  ['DIVIDEND_CHANGE', 'DividendChange', '股息变化方向', 'L1_FUNDAMENTAL', 'L2_YIELD_QUALITY'],
  ['SECTOR_STRENGTH', 'SectorStrength', '行业强度', 'L1_MACRO', 'L2_CYCLE'],
  ['IV_RANK', 'IVRank', '隐含波动率排名', 'L1_SENTIMENT', 'L2_OPTIONS'],
  ['CURRENCY_EFFECT', 'CurrencyEffect', '汇率影响', 'L1_MACRO', 'L2_CURRENCY'],
  ['FREE_CASH_FLOW_YIELD', 'FreeCashFlowYield', '自由现金流收益率', 'L1_FUNDAMENTAL', 'L2_VALUE_DEEP'],
  ['EQUITY_MULTIPLIER', 'EquityMultiplier', '权益乘数', 'L1_FUNDAMENTAL', 'L2_RISK_STRUCTURE'],
  ['DISPOSITION_EFFECT', 'DispositionEffect', '处置效应', 'L1_SENTIMENT', 'L2_SOCIAL'],
  ['ANCHORING', 'Anchoring', '锚定效应', 'L1_SENTIMENT', 'L2_SOCIAL'],
  ['AH_PREMIUM_CHANGE', 'AHPremiumChange', 'AH溢价变化率', 'L1_HK', 'L2_PRICING'],
  ['HSI_CONSTITUENT', 'HSIConstituent', '恒指成分股权重', 'L1_HK', 'L2_FLOW'],
  ['HK_REIT_YIELD', 'HKREITYield', '港股REIT收益率', 'L1_HK', 'L2_YIELD'],
  ['US_EARNINGS_CALENDAR', 'USEarningsCalendar', '美股财报日历', 'L1_US', 'L2_EVENT'],
  ['US_SECTOR_ROTATION', 'USSectorRotation', '美股板块轮动', 'L1_US', 'L2_CORPORATE'],
  ['US_SMALL_CAP_MOMENTUM', 'USSmallCapMomentum', '小盘股动量', 'L1_US', 'L2_STATS'],
  ['US_DIVIDEND_ARISTOCRATS', 'USDividendAristocrats', '股息贵族', 'L1_US', 'L2_YIELD'],
  ['US_SP500_EQUAL_WEIGHT', 'USSP500EqualWeight', '标普500等权', 'L1_US', 'L2_VALUE'],
  ['CRYPTO_S2F', 'CryptoStockToFlow', 'S2F模型', 'L1_CRYPTO', 'L2_VALUATION'],
  ['CRYPTO_HASH_RATE', 'CryptoHashRate', '哈希率', 'L1_CRYPTO', 'L2_ONCHAIN'],
  ['XM_MKTCAP_EXPOSURE', 'CrossMarketCapExposure', '跨市场市值暴露', 'L1_CROSS_ASSET', 'L2_CORRELATION'],
  ['XM_LIQUIDITY', 'CrossLiquidity', '跨市场流动性', 'L1_CROSS_ASSET', 'L2_CORRELATION'],
  ['XM_DIVIDEND_ARAMA', 'CrossDividendArama', '跨市场股息比较', 'L1_CROSS_ASSET', 'L2_CARRY'],

  // ════════════════════════════════════════ Commodity Futures (R198) ════════════════════════════════════════
  // L1 Term Structure (7)
  ['CMD_ROLL_YIELD', 'RollYield', '换月成本(展期收益)', 'L1_COMMODITY', 'L2_TERM_STRUCTURE'],
  ['CMD_TERM_STRUCTURE', 'TermStructure', '期限结构斜率', 'L1_COMMODITY', 'L2_TERM_STRUCTURE'],
  ['CMD_BASIS', 'Basis', '基差(现货vs期货)', 'L1_COMMODITY', 'L2_TERM_STRUCTURE'],
  ['CMD_MOMENTUM_12M', 'CommodityMomentum12M', '12月商品动量', 'L1_COMMODITY', 'L2_MOMENTUM'],
  ['CMD_MOMENTUM_1M', 'CommodityMomentum1M', '1月商品反转', 'L1_COMMODITY', 'L2_MOMENTUM'],
  ['CMD_VOLATILITY', 'CommodityVolatility', '商品波动率', 'L1_COMMODITY', 'L2_VOLATILITY'],
  ['CMD_SKEWNESS', 'CommoditySkewness', '收益偏度', 'L1_COMMODITY', 'L2_VOLATILITY'],
  // L2 Inventory/Supply-Demand (5)
  ['CMD_EIA_CRUDE', 'EIACrudeInventory', 'EIA原油库存', 'L1_COMMODITY', 'L2_INVENTORY'],
  ['CMD_NATGAS_STORAGE', 'NatGasStorage', '天然气储气量', 'L1_COMMODITY', 'L2_INVENTORY'],
  ['CMD_LME_INVENTORY', 'LMEInventory', 'LME金属库存', 'L1_COMMODITY', 'L2_INVENTORY'],
  ['CMD_GOLD_ETF', 'GoldETFHoldings', '黄金ETF持仓', 'L1_COMMODITY', 'L2_FLOW'],
  ['CMD_BALANCE_SHEET', 'BalanceSheet', '供需平衡表', 'L1_COMMODITY', 'L2_FUNDAMENTAL'],
  // L6 Seasonality (2)
  ['CMD_SEASONALITY', 'CommoditySeasonality', '商品季节性', 'L1_COMMODITY', 'L2_SEASONAL'],
  ['CMD_GOLD_SUMMER', 'GoldSummerEffect', '黄金夏季效应', 'L1_COMMODITY', 'L2_SEASONAL'],

];

// ═══════════════════════════════════════════════════════════════════
// EXPORTS & UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ── STANDARD_FACTOR_IDS (backward compatibility) ──────────────────

/**
 * Legacy STANDARD_FACTOR_IDS object — auto-generated from FACTOR_SPEC.
 * Kept for backward compatibility with existing code that references
 * STANDARD_FACTOR_IDS.MOM_12M, STANDARD_FACTOR_IDS.SIZE, etc.
 */
export const STANDARD_FACTOR_IDS: Record<string, string> = {};
for (const [id] of FACTOR_SPEC) {
  STANDARD_FACTOR_IDS[id] = id;
}

/** Canonical factor IDs array (all 187) */
export const ALL_STANDARD_FACTOR_IDS: FactorId[] = FACTOR_SPEC.map(([id]) => id);

// ── Factor Level Lookup Tables ───────────────────────────────────

/** Map factor ID -> FactorLevel3Meta */
export const FACTOR_LEVEL3_MAP: Record<string, FactorLevel3Meta> = {};
for (const [id, nameEn, nameCn, level1, level2] of FACTOR_SPEC) {
  FACTOR_LEVEL3_MAP[id] = { id, nameEn, nameCn, level1, level2 };
}

/** Get all factor IDs by L1 category */
export function getFactorIdsByLevel1(level1: FactorLevel1): FactorId[] {
  return FACTOR_SPEC.filter(([, , , l1]) => l1 === level1).map(([id]) => id);
}

/** Get all factor IDs by L1 + L2 */
export function getFactorIdsByLevel2(level1: FactorLevel1, level2: FactorLevel2): FactorId[] {
  return FACTOR_SPEC.filter(([, , , l1, l2]) => l1 === level1 && l2 === level2).map(([id]) => id);
}

/** Get L1 category for a factor ID */
export function getFactorLevel1(id: string): FactorLevel1 | undefined {
  return FACTOR_LEVEL3_MAP[id]?.level1;
}

/** Get L2 sub-category for a factor ID */
export function getFactorLevel2(id: string): FactorLevel2 | undefined {
  return FACTOR_LEVEL3_MAP[id]?.level2;
}

/** Get full metadata for a factor ID */
export function getFactorMeta(id: string): FactorLevel3Meta | undefined {
  return FACTOR_LEVEL3_MAP[id];
}

/** Count factors per L1 category */
export function getFactorCountByLevel1(): Record<FactorLevel1, number> {
  const counts: Record<string, number> = {};
  for (const [, , , l1] of FACTOR_SPEC) {
    counts[l1] = (counts[l1] || 0) + 1;
  }
  return counts as Record<FactorLevel1, number>;
}

/** Count total canonical factors (excluding deprecated) */
export function getTotalFactorCount(): number {
  return FACTOR_SPEC.filter(([, , , l1]) => l1 !== 'L1_LEGACY').length;
}

/** Check if a factor ID is deprecated */
export function isDeprecatedFactorId(id: string): boolean {
  const meta = FACTOR_LEVEL3_MAP[id];
  return meta?.level1 === 'L1_LEGACY';
}

// ── Legacy ID Map ────────────────────────────────────────────────

/**
 * Maps legacy / alternative factor names to their canonical standard ID.
 * Sources: factor-risk-model.ts, factor-exposure.ts, old code.
 */
export const LEGACY_ID_MAP: Record<string, FactorId> = {
  // Risk-model legacy names
  MOM: 'MOM_12M',
  VOL: 'VOL_60D',
  SMB: 'SIZE',
  QUALITY: 'QUAL',
  // Exposure module legacy names (camelCase)
  market: 'MKT',
  smb: 'SIZE',
  hml: 'HML',
  rmw: 'RMW',
  cma: 'CMA',
  momentum: 'MOM_12M',
  lowVol: 'VOL_60D',
  quality: 'QUAL',
  // Common shorthand
  volatility: 'VOL_60D',
  value: 'HML',
  profitability: 'RMW',
  investment: 'CMA',
  // Very old / deprecated (pre-R158)
  MOMENTUM: 'MOM_12M',
  VOLATILITY: 'VOL_60D',
  LOW_VOL: 'VOL_60D',
  LOWVOL: 'VOL_60D',
  MARKET_CAP: 'SIZE',
  VALUE: 'HML',
  PROFITABILITY: 'RMW',
  INVESTMENT: 'CMA',
  DIVIDEND: 'YIELD',
  DIV_YIELD: 'YIELD',
  // R185: Green factor canonical alias mappings
  EARNINGS_YIELD: 'EP_RATIO',
  BOOK_TO_PRICE: 'HML',
  DIVIDEND_YIELD: 'YIELD',
  BETA: 'MKT',
  MAX_DRAWDOWN_1Y: 'MAX_DRAWDOWN',
  SOUTHBOUND_FLOW: 'HK_SOUTHBOUND_FLOW',
  CRYPTO_ACTIVE_ADDRESSES: 'CRYPTO_ACTIVE_ADDR',
  INSIDER_TRADING: 'INSIDER_BUYING',
  US_INSIDER_BUY: 'INSIDER_BUYING',
  INSTITUTIONAL_FLOW: 'FUND_FLOW',
  EARNINGS_SURPRISE_GREEN: 'EARNINGS_SURPRISE',
  SECTOR_ROTATION_US: 'US_SECTOR_ROTATION',
  FX_EXPOSURE_GREEN: 'CURRENCY_EFFECT',
  CASH_FLOW_YIELD: 'FREE_CASH_FLOW_YIELD',
  FREE_CASH_FLOW_GREEN: 'FREE_CASH_FLOW_YIELD',
  HK_SOUTHBOUND_GREEN: 'SOUTHBOUND_FLOW',

} as const;

// ── Factor Category Map (v1 backward compat) ─────────────────────

/** @deprecated Use FactorLevel1/FactorLevel2 instead */
export type FactorCategory =
  | 'momentum' | 'volatility' | 'value' | 'quality' | 'growth'
  | 'size' | 'yield' | 'sentiment' | 'macro' | 'technical'
  | 'hk_specific' | 'us_specific' | 'crypto' | 'market_meta';

/**
 * Maps L2 sub-categories to legacy v1 FactorCategory.
 */
const L2_TO_LEGACY_CATEGORY: Record<string, FactorCategory> = {
  L2_MARKET_RISK: 'market_meta',
  L2_SIZE: 'size',
  L2_VALUE: 'value',
  L2_MOMENTUM: 'momentum',
  L2_QUALITY: 'quality',
  L2_GROWTH: 'growth',
  L2_YIELD: 'yield',
  L2_PROFIT_QUALITY: 'quality',
  L2_YIELD_QUALITY: 'yield',
  L2_RISK_STRUCTURE: 'volatility',
  L2_EFFICIENCY: 'quality',
  L2_VALUE_DEEP: 'value',
  L2_HEALTH: 'quality',
  L2_RATING: 'sentiment',
  L2_FORECAST: 'sentiment',
  L2_MARKET_MOOD: 'sentiment',
  L2_OPTIONS: 'sentiment',
  L2_SOCIAL: 'sentiment',
  L2_FLOW: 'sentiment',
  L2_TREND: 'technical',
  L2_OSCILLATOR: 'technical',
  L2_VOLATILITY: 'volatility',
  L2_VOLUME: 'technical',
  L2_LIQUIDITY: 'volatility',
  L2_DOWNSIDE: 'volatility',
  L2_RISK_ADJUSTED: 'quality',
  L2_STRUCTURAL: 'volatility',
  L2_CYCLE: 'macro',
  L2_CURRENCY: 'macro',
  L2_SENSITIVITY: 'macro',
  L2_SHORT_TERM: 'momentum',
  L2_LONG_TERM: 'momentum',
  L2_SEASONAL: 'momentum',
  L2_STATISTICAL: 'momentum',
  L2_CORPORATE: 'us_specific',
  L2_EVENT: 'us_specific',
  L2_STATS: 'us_specific',
  L2_PRICING: 'hk_specific',
  L2_DERIVATIVES: 'hk_specific',
  L2_RISK: 'volatility',
  L2_MICROSTRUCTURE: 'crypto',
  L2_VALUATION: 'crypto',
  L2_ONCHAIN: 'crypto',
  L2_CORRELATION: 'crypto',
  L2_PERFORMANCE: 'crypto',
  L2_FUNDAMENTAL: 'crypto',
  L2_CARRY: 'macro',
  L2_EARNINGS: 'sentiment',
  L2_REBALANCE: 'sentiment',
  L2_OVERALL: 'sentiment',
  L2_ENVIRONMENT: 'sentiment',
  L2_GOVERNANCE: 'sentiment',
  L2_DEPRECATED: 'market_meta',
};

/** @deprecated Use getFactorLevel1/getFactorLevel2 instead */
export const FACTOR_CATEGORY_MAP: Record<FactorId, FactorCategory> = {};
for (const [id, , , , l2] of FACTOR_SPEC) {
  FACTOR_CATEGORY_MAP[id] = L2_TO_LEGACY_CATEGORY[l2] || 'market_meta';
}

// ── Utility Functions ────────────────────────────────────────────

/**
 * Resolve any factor ID (standard or legacy) to its canonical form.
 */
export function resolveFactorId(id: string): FactorId {
  const mapped = (LEGACY_ID_MAP as Record<string, string>)[id];
  if (mapped) return mapped;
  if (FACTOR_LEVEL3_MAP[id]) return id;
  return id; // safe fallback
}

/** Check if a factor ID is a canonical standard ID */
export function isStandardFactorId(id: string): boolean {
  return id in FACTOR_LEVEL3_MAP;
}

/** Resolve multiple factor IDs at once */
export function resolveFactorIds(ids: string[]): FactorId[] {
  return ids.map(resolveFactorId);
}

/** Get all canonical factor IDs excluding deprecated ones */
export function getCanonicalFactorIds(): FactorId[] {
  return FACTOR_SPEC
    .filter(([, , , l1]) => l1 !== 'L1_LEGACY')
    .map(([id]) => id);
}

/** @deprecated Use getFactorIdsByLevel1 instead */
export function getFactorIdsByCategory(category: FactorCategory): FactorId[] {
  return FACTOR_SPEC
    .filter(([, , , , l2]) => L2_TO_LEGACY_CATEGORY[l2] === category)
    .map(([id]) => id);
}

/** @deprecated Use getFactorLevel1 instead */
export function getFactorCategory(id: string): FactorCategory | undefined {
  const resolved = resolveFactorId(id);
  const meta = FACTOR_LEVEL3_MAP[resolved];
  if (!meta) return undefined;
  return L2_TO_LEGACY_CATEGORY[meta.level2];
}

