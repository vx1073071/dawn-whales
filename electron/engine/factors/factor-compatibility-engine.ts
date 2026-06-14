import i18n from '../../../src/i18n';
// ── J-72-01 R72 AUTHORITATIVE: Factor Compatibility Matrix ────────────────
// 30+ Factors × 7 Markets, stock screen auto-filters incompatible factors

export type Market = "HKEX" | "NYSE" | "NASDAQ" | "SGX" | "TSE" | "ASX" | "TSX" | "BURSA" | "CRYPTO";
export type InstrumentType = "stock" | "etf" | "reit" | "adr" | "cbcs" | "warrant" | "future" | "option" | "crypto_spot" | "crypto_perp";

export interface FactorDefinition {
  id: string;
  name: string;
  nameCN: string;
  category: "trend" | "momentum" | "volatility" | "value" | "quality" | "growth" | "size" | "yield" | "sentiment" | "macro";
  description: string;
  compatibleMarkets: Market[];
  compatibleInstruments: InstrumentType[];
  calculation: string; // formula description
  typicalIC: number; // historical avg |IC|
  decayHalfLife: number; // days
  usage: string; // recommended usage
}

export interface FactorCompatibilityResult {
  factorId: string;
  market: Market;
  instrument: InstrumentType;
  compatible: boolean;
  reason?: string;
}

// ── Factor Library (30+) ──────────────────────────────────────────────────

const FACTOR_LIBRARY: FactorDefinition[] = [
  // ═══ Universal (7-market) ═══
  {
    id: "MOM_12M", name: "Momentum 12M", nameCN: i18n.t('factorCompatibilityEngine.k1'),
    category: "momentum",
    description: "12-month total return excluding most recent month",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "(Price_t - Price_{t-12}) / Price_{t-12}, skip t-1 month",
    typicalIC: 0.045, decayHalfLife: 60, usage: i18n.t('factorCompatibilityEngine.k2'),
  },
  {
    id: "MOM_1M", name: "Momentum 1M", nameCN: i18n.t('factorCompatibilityEngine.k3'),
    category: "momentum",
    description: "1-month total return, short-term reversal aware",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "(Price_t - Price_{t-21}) / Price_{t-21}",
    typicalIC: 0.032, decayHalfLife: 15, usage: i18n.t('factorCompatibilityEngine.k4'),
  },
  {
    id: "LIQ", name: "Liquidity", nameCN: i18n.t('factorCompatibilityEngine.k5'),
    category: "volatility",
    description: "Average daily turnover / market cap ratio",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "AvgDailyTurnover(20d) / MarketCap",
    typicalIC: -0.038, decayHalfLife: 45, usage: i18n.t('factorCompatibilityEngine.k6'),
  },
  {
    id: "VOL_60D", name: "Volatility 60D", nameCN: i18n.t('factorCompatibilityEngine.k7'),
    category: "volatility",
    description: "60-day daily return standard deviation (annualized)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "StdDev(daily_returns, 60) * sqrt(365)",
    typicalIC: -0.042, decayHalfLife: 30, usage: i18n.t('factorCompatibilityEngine.k8'),
  },
  {
    id: "GROWTH", name: "Growth", nameCN: i18n.t('factorCompatibilityEngine.k9'),
    category: "growth",
    description: "YoY revenue/earnings growth composite",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "Z(RevGrowth) + Z(EarnGrowth), 3Y CAGR",
    typicalIC: 0.028, decayHalfLife: 90, usage: i18n.t('factorCompatibilityEngine.k10'),
  },
  {
    id: "QUAL", name: "Quality", nameCN: i18n.t('factorCompatibilityEngine.k11'),
    category: "quality",
    description: "ROE + Debt/Equity + Accruals composite",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "Z(ROE) + Z(-Debt/Equity) + Z(-Accruals)",
    typicalIC: 0.035, decayHalfLife: 120, usage: i18n.t('factorCompatibilityEngine.k12'),
  },
  {
    id: "SIZE", name: "Size (SMB)", nameCN: i18n.t('factorCompatibilityEngine.k13'),
    category: "size",
    description: "Market cap log, Fama-French SMB proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "ln(MarketCap), long bottom 30% / short top 30%",
    typicalIC: -0.025, decayHalfLife: 180, usage: i18n.t('factorCompatibilityEngine.k14'),
  },
  {
    id: "YIELD", name: "Dividend Yield", nameCN: i18n.t('factorCompatibilityEngine.k15'),
    category: "yield",
    description: "Trailing 12M dividend / current price",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "reit"],
    calculation: "TTM_Dividend / Price",
    typicalIC: 0.018, decayHalfLife: 180, usage: i18n.t('factorCompatibilityEngine.k16'),
  },
  {
    id: "HML", name: "Value (HML)", nameCN: i18n.t('factorCompatibilityEngine.k17'),
    category: "value",
    description: "Book-to-Price ratio, Fama-French HML proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "BookValue / MarketCap, top 30% / bottom 30% long-short",
    typicalIC: 0.038, decayHalfLife: 150, usage: i18n.t('factorCompatibilityEngine.k18'),
  },
  {
    id: "RMW", name: "Profitability (RMW)", nameCN: i18n.t('factorCompatibilityEngine.k19'),
    category: "quality",
    description: "Operating profitability, Fama-French RMW proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "(Revenue - COGS - SG&A) / BookEquity",
    typicalIC: 0.030, decayHalfLife: 120, usage: i18n.t('factorCompatibilityEngine.k20'),
  },
  {
    id: "CMA", name: "Investment (CMA)", nameCN: i18n.t('factorCompatibilityEngine.k21'),
    category: "quality",
    description: "Conservative minus aggressive investment, FF5 CMA proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "ΔTotalAssets / TotalAssets, low investment = conservative premium",
    typicalIC: -0.022, decayHalfLife: 150, usage: i18n.t('factorCompatibilityEngine.k22'),
  },
  // ── Technical (universal, incl. CRYPTO) ──
  {
    id: "MA_20_60", name: "MA Crossover 20/60", nameCN: i18n.t('factorCompatibilityEngine.k23'),
    category: "trend",
    description: "Golden cross / dead cross of MA20 over MA60",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "1 if MA20 > MA60 else -1, smoothed 3d",
    typicalIC: 0.025, decayHalfLife: 20, usage: i18n.t('factorCompatibilityEngine.k24'),
  },
  {
    id: "EMA_12_26", name: "EMA Crossover MACD", nameCN: i18n.t('factorCompatibilityEngine.k25'),
    category: "trend",
    description: "MACD histogram: (EMA12-EMA26) - EMA9",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "MACD_line = EMA(12)-EMA(26); Signal = EMA(9); Hist = MACD - Signal",
    typicalIC: 0.020, decayHalfLife: 15, usage: i18n.t('factorCompatibilityEngine.k26'),
  },
  {
    id: "RSI_14", name: "RSI 14", nameCN: i18n.t('factorCompatibilityEngine.k27'),
    category: "momentum",
    description: "14-day Relative Strength Index, contrarian at extremes",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "100 - 100/(1+AvgGain14/AvgLoss14); overweight RSI<30, underweight RSI>70",
    typicalIC: -0.028, decayHalfLife: 10, usage: i18n.t('factorCompatibilityEngine.k28'),
  },
  {
    id: "KDJ", name: "KDJ Stochastic", nameCN: i18n.t('factorCompatibilityEngine.k29'),
    category: "momentum",
    description: "Fast stochastic oscillator, overbought/oversold",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "K=100*(C-L14)/(H14-L14); D=SMA(K,3); J=3K-2D",
    typicalIC: -0.015, decayHalfLife: 8, usage: i18n.t('factorCompatibilityEngine.k30'),
  },
  {
    id: "BOLL", name: "Bollinger Bands %B", nameCN: i18n.t('factorCompatibilityEngine.k31'),
    category: "volatility",
    description: "Price position within Bollinger Bands (20,2)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "%B = (Price - Lower) / (Upper - Lower); Upper/Lower = MA20 +/- 2*StdDev20",
    typicalIC: -0.022, decayHalfLife: 12, usage: i18n.t('factorCompatibilityEngine.k32'),
  },
  {
    id: "ATR_14", name: "ATR 14", nameCN: i18n.t('factorCompatibilityEngine.k33'),
    category: "volatility",
    description: "Average True Range, position sizing reference",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "option", "crypto_spot", "crypto_perp"],
    calculation: "EMA(TR, 14) where TR = max(H-L, |H-Cprev|, |L-Cprev|)",
    typicalIC: -0.018, decayHalfLife: 14, usage: i18n.t('factorCompatibilityEngine.k34'),
  },
  {
    id: "ADX", name: "ADX 14", nameCN: i18n.t('factorCompatibilityEngine.k35'),
    category: "trend",
    description: "Average Directional Index, trend strength (not direction)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "ADX = 100 * EMA(|+DI - -DI|/(+DI + -DI), 14); ADX>25=trending",
    typicalIC: 0.015, decayHalfLife: 18, usage: i18n.t('factorCompatibilityEngine.k36'),
  },
  {
    id: "OBV", name: "OBV", nameCN: i18n.t('factorCompatibilityEngine.k37'),
    category: "sentiment",
    description: "On-Balance Volume, cumulative volume flow",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "OBV_t = OBV_{t-1} + Volume_t * sign(Close_t - Close_{t-1})",
    typicalIC: 0.012, decayHalfLife: 25, usage: i18n.t('factorCompatibilityEngine.k38'),
  },
  {
    id: "CMF", name: "CMF", nameCN: i18n.t('factorCompatibilityEngine.k39'),
    category: "sentiment",
    description: "Chaikin Money Flow, 21-day MF period",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "crypto_spot", "crypto_perp"],
    calculation: "Sum(Volume * ((Close-Low)-(High-Close))/(High-Low), 21) / Sum(Volume, 21)",
    typicalIC: 0.016, decayHalfLife: 20, usage: i18n.t('factorCompatibilityEngine.k40'),
  },
  {
    id: "ICHIMOKU", name: "Ichimoku Cloud", nameCN: i18n.t('factorCompatibilityEngine.k41'),
    category: "trend",
    description: "Ichimoku Kinko Hyo: Tenkan/Kijun/Senkou Span A/B + Chikou",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"],
    compatibleInstruments: ["stock", "etf", "future", "crypto_spot", "crypto_perp"],
    calculation: "Tenkan=(H9+L9)/2; Kijun=(H26+L26)/2; SenkouA=(T+K)/2 ahead 26; SenkouB=(H52+L52)/2 ahead 26",
    typicalIC: 0.019, decayHalfLife: 30, usage: i18n.t('factorCompatibilityEngine.k42'),
  },

  // ═══ HKEX-Specific ═══
  {
    id: "HKEX_SOUTHBOUND", name: "Southbound Flow", nameCN: i18n.t('factorCompatibilityEngine.k43'),
    category: "sentiment",
    description: "Daily southbound net flow via Stock Connect, mainland capital to HK stocks",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Daily HK Connect net buy (HKD), Z-score 20d",
    typicalIC: 0.055, decayHalfLife: 5, usage: i18n.t('factorCompatibilityEngine.k44'),
  },
  {
    id: "HKEX_SOUTHBOUND", name: "Southbound Flow", nameCN: i18n.t('factorCompatibilityEngine.k45'),
    category: "sentiment",
    description: "Southbound connect net flow, mainland capital to HK",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Daily HKEX Connect net buy (HKD), Z-score 20d",
    typicalIC: 0.048, decayHalfLife: 5, usage: i18n.t('factorCompatibilityEngine.k46'),
  },
  {
    id: "HKEX_CBCS_PREMIUM", name: "CBBC Premium", nameCN: i18n.t('factorCompatibilityEngine.k47'),
    category: "value",
    description: "Callable Bull/Bear Contract premium to intrinsic value",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["cbcs", "warrant"],
    calculation: "(CBBC_Price - Max(0, Strike - Spot)) / Spot for bear, similar for bull",
    typicalIC: 0.030, decayHalfLife: 3, usage: i18n.t('factorCompatibilityEngine.k48'),
  },
  {
    id: "HKEX_WARRANT_IV", name: "Warrant IV", nameCN: i18n.t('factorCompatibilityEngine.k49'),
    category: "volatility",
    description: "Warrant implied volatility vs historical 30d volatility spread",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["warrant"],
    calculation: "IV(warrant, BSM) - HV(stock, 30d); positive = warrant expensive",
    typicalIC: -0.035, decayHalfLife: 5, usage: i18n.t('factorCompatibilityEngine.k50'),
  },
  {
    id: "HKEX_DLHB", name: "Dragon Tiger List", nameCN: i18n.t('factorCompatibilityEngine.k51'),
    category: "sentiment",
    description: "Top broker seats net buy on Dragon & Tiger Board",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Sum(top5_buy_seats) - Sum(top5_sell_seats), Z-score 5d",
    typicalIC: 0.040, decayHalfLife: 3, usage: i18n.t('factorCompatibilityEngine.k52'),
  },
  {
    id: "HKEX_FUND_HOLD", name: "Fund Holding", nameCN: i18n.t('factorCompatibilityEngine.k53'),
    category: "quality",
    description: "Top 10 fund holdings weight overlap",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Count of top10 funds holding this stock, Z-score sector",
    typicalIC: 0.025, decayHalfLife: 60, usage: i18n.t('factorCompatibilityEngine.k54'),
  },

  // ═══ US-Specific ═══
  {
    id: "US_VIX", name: "VIX Level", nameCN: i18n.t('factorCompatibilityEngine.k55'),
    category: "macro",
    description: "CBOE VIX level, market fear gauge",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock", "etf", "option"],
    calculation: "VIX > 30 = high fear (buy), VIX < 15 = complacency (hedge)",
    typicalIC: -0.050, decayHalfLife: 7, usage: i18n.t('factorCompatibilityEngine.k56'),
  },
  {
    id: "US_SHORT_RATIO", name: "Short Interest", nameCN: i18n.t('factorCompatibilityEngine.k57'),
    category: "sentiment",
    description: "Days to cover (short interest / avg daily volume)",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "ShortInterest / AvgDailyVol(20d); >5 days = potential squeeze",
    typicalIC: 0.033, decayHalfLife: 15, usage: i18n.t('factorCompatibilityEngine.k58'),
  },
  {
    id: "US_INST_HOLD", name: "Institutional Holding", nameCN: i18n.t('factorCompatibilityEngine.k59'),
    category: "sentiment",
    description: "13F quarterly change in institutional holdings",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "QoQ change in total institutional shares / total outstanding",
    typicalIC: 0.032, decayHalfLife: 90, usage: i18n.t('factorCompatibilityEngine.k60'),
  },
  {
    id: "US_BUYBACK", name: "Buyback Yield", nameCN: i18n.t('factorCompatibilityEngine.k61'),
    category: "yield",
    description: "Net buyback / market cap, US-specific yield factor",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "(ShareBuyback - ShareIssuance) / MarketCap TTM",
    typicalIC: 0.028, decayHalfLife: 90, usage: i18n.t('factorCompatibilityEngine.k62'),
  },

  // ═══ Global (multi-market specialized) ═══
  {
    id: "OPTION_PCR", name: "Put/Call Ratio", nameCN: i18n.t('factorCompatibilityEngine.k63'),
    category: "sentiment",
    description: "Open interest put/call ratio, sentiment indicator",
    compatibleMarkets: ["NYSE", "NASDAQ", "HKEX"],
    compatibleInstruments: ["option"],
    calculation: "TotalPutOI / TotalCallOI; >1.0 bearish, <0.7 bullish (contrarian)",
    typicalIC: -0.042, decayHalfLife: 5, usage: i18n.t('factorCompatibilityEngine.k64'),
  },
  {
    id: "SECTOR_ROTATION", name: "Sector Rotation", nameCN: i18n.t('factorCompatibilityEngine.k65'),
    category: "macro",
    description: "12-month sector momentum ranking, rotate to top 3",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "TSE"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "Sector_Return(3M/6M/12M) weighted rank, select top 3 of 11 GICS sectors",
    typicalIC: 0.040, decayHalfLife: 90, usage: i18n.t('factorCompatibilityEngine.k66'),
  },
  {
    id: "FX_EXPOSURE", name: "FX Exposure", nameCN: i18n.t('factorCompatibilityEngine.k67'),
    category: "macro",
    description: "Revenue exposure to non-domestic currency",
    compatibleMarkets: ["SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "%Revenue_nonLocalCurrency * (LocalCurrency/USD change 1M)",
    typicalIC: 0.015, decayHalfLife: 30, usage: i18n.t('factorCompatibilityEngine.k68'),
  },

  // ═══ CRYPTO-Specific (10 factors) ═══
  {
    id: "CRYPTO_FUNDING", name: "Funding Rate", nameCN: i18n.t('factorCompatibilityEngine.k69'),
    category: "sentiment",
    description: "Perpetual futures funding rate, extreme positive = overcrowded longs (bearish), extreme negative = overcrowded shorts (bullish)",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_perp"],
    calculation: "FundingRate(8h) annualized; >0.1% bullish-crowded (contrarian sell), <-0.05% bearish-crowded (contrarian buy)",
    typicalIC: -0.055, decayHalfLife: 1, usage: i18n.t('factorCompatibilityEngine.k70'),
  },
  {
    id: "CRYPTO_OI_DELTA", name: "Open Interest Change", nameCN: i18n.t('factorCompatibilityEngine.k71'),
    category: "sentiment",
    description: "24h change in aggregate open interest, rising OI confirms trend, OI divergence signals reversal",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_perp"],
    calculation: "(OI_t - OI_{t-24h}) / OI_{t-24h}; price+OI both up = trend strength, price up+OI down = weakening",
    typicalIC: 0.038, decayHalfLife: 1, usage: i18n.t('factorCompatibilityEngine.k72'),
  },
  {
    id: "CRYPTO_EXCHANGE_FLOW", name: "Exchange Netflow", nameCN: i18n.t('factorCompatibilityEngine.k73'),
    category: "sentiment",
    description: "Net BTC/ETH flowing into/out of exchanges (on-chain), inflow = selling pressure, outflow = accumulation",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "Z-score(NetExchangeInflow_24h / CirculatingSupply), 7d rolling",
    typicalIC: -0.048, decayHalfLife: 2, usage: i18n.t('factorCompatibilityEngine.k74'),
  },
  {
    id: "CRYPTO_ORDERBOOK_IMB", name: "Order Book Imbalance", nameCN: i18n.t('factorCompatibilityEngine.k75'),
    category: "volatility",
    description: "Bid/Ask depth ratio within 2% of mid-price, imbalance predicts short-term price direction",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "Sum(BidDepth_2pct) / (Sum(BidDepth_2pct) + Sum(AskDepth_2pct)); >0.55 bullish, <0.45 bearish",
    typicalIC: 0.032, decayHalfLife: 0.5, usage: i18n.t('factorCompatibilityEngine.k76'),
  },
  {
    id: "CRYPTO_VOL_RATIO", name: "Volatility Ratio", nameCN: i18n.t('factorCompatibilityEngine.k77'),
    category: "volatility",
    description: "Short-term (7d) to long-term (30d) volatility ratio, >1.5 signals regime shift / breakout",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "HV(7d) / HV(30d); >1.5 = vol expansion (trend-follow), <0.7 = vol compression (mean-revert)",
    typicalIC: 0.025, decayHalfLife: 3, usage: i18n.t('factorCompatibilityEngine.k78'),
  },
  {
    id: "CRYPTO_VOLUME_PROFILE", name: "Volume Profile POC", nameCN: i18n.t('factorCompatibilityEngine.k79'),
    category: "trend",
    description: "Price relative to Point of Control (highest volume node), break above POC = bullish, below = bearish",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "(Price - POC_30d) / POC_30d; value_zone = POC +/- 0.5*ValueArea",
    typicalIC: 0.022, decayHalfLife: 7, usage: i18n.t('factorCompatibilityEngine.k80'),
  },
  {
    id: "CRYPTO_BTC_CORR", name: "BTC Correlation", nameCN: i18n.t('factorCompatibilityEngine.k81'),
    category: "macro",
    description: "30-day rolling correlation to BTC, high correlation = beta play, low correlation = idiosyncratic alpha potential",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "PearsonCorr(returns_30d, BTC_returns_30d); >0.85 = BTC proxy, <0.3 = independent move",
    typicalIC: 0.018, decayHalfLife: 15, usage: i18n.t('factorCompatibilityEngine.k82'),
  },
  {
    id: "CRYPTO_NVT", name: "NVT Ratio", nameCN: i18n.t('factorCompatibilityEngine.k83'),
    category: "value",
    description: "Network Value to Transactions ratio — crypto's P/E equivalent, high NVT = overvalued relative to usage",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot"],
    calculation: "MarketCap / DailyOnChainVolume(USD); Z-score 90d, >2.0 overvalued, <-1.5 undervalued",
    typicalIC: -0.040, decayHalfLife: 30, usage: i18n.t('factorCompatibilityEngine.k84'),
  },
  {
    id: "CRYPTO_ACTIVE_ADDR", name: "Active Addresses", nameCN: i18n.t('factorCompatibilityEngine.k85'),
    category: "growth",
    description: "30-day change in daily active addresses, rising = network adoption growth, falling = declining usage",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_spot", "crypto_perp"],
    calculation: "Z-score((ActiveAddr_30dMA - ActiveAddr_90dMA) / ActiveAddr_90dMA)",
    typicalIC: 0.035, decayHalfLife: 45, usage: i18n.t('factorCompatibilityEngine.k86'),
  },
  {
    id: "CRYPTO_LIQUIDATIONS", name: "Liquidation Heat", nameCN: i18n.t('factorCompatibilityEngine.k87'),
    category: "volatility",
    description: "Total liquidation volume (long+short) in last 4h, extreme liquidations = cascade risk + potential bounce",
    compatibleMarkets: ["CRYPTO"],
    compatibleInstruments: ["crypto_perp"],
    calculation: "Z-score(TotalLiq_4h / OpenInterest); >2.0 = liquidation cascade, high vol, potential mean-reversion bounce",
    typicalIC: -0.030, decayHalfLife: 1, usage: i18n.t('factorCompatibilityEngine.k88'),
  },
];

// ── Factor Compatibility Matrix Engine ────────────────────────────────────

export class FactorCompatibilityEngine {
  private factors: Map<string, FactorDefinition> = new Map();

  constructor() {
    for (const f of FACTOR_LIBRARY) {
      this.factors.set(f.id, f);
    }
  }

  /** Check if a factor is compatible with a given market + instrument combo */
  checkCompatibility(factorId: string, market: Market, instrument: InstrumentType): FactorCompatibilityResult {
    const factor = this.factors.get(factorId);
    if (!factor) {
      return { factorId, market, instrument, compatible: false, reason: i18n.t('factorCompatibilityEngine.k69') };
    }

    const marketOk = factor.compatibleMarkets.includes(market);
    const instOk = factor.compatibleInstruments.includes(instrument);

    if (!marketOk && !instOk) {
      return { factorId, market, instrument, compatible: false, reason: i18n.t('factorCompatibilityEngine.k70') };
    }
    if (!marketOk) {
      return { factorId, market, instrument, compatible: false, reason: i18n.t('factorCompatibilityEngine.k71') };
    }
    if (!instOk) {
      return { factorId, market, instrument, compatible: false, reason: i18n.t('factorCompatibilityEngine.k72') };
    }

    return { factorId, market, instrument, compatible: true };
  }

  /** Get all compatible factors for a market+instrument combo */
  getCompatibleFactors(market: Market, instrument: InstrumentType): FactorDefinition[] {
    const result: FactorDefinition[] = [];
    for (const [, f] of this.factors) {
      if (f.compatibleMarkets.includes(market) && f.compatibleInstruments.includes(instrument)) {
        result.push(f);
      }
    }
    return result;
  }

  /** Filter a factor list by market+instrument, removing incompatible */
  filterCompatible(
    factorIds: string[],
    market: Market,
    instrument: InstrumentType,
  ): { compatible: string[]; incompatible: FactorCompatibilityResult[] } {
    const compatible: string[] = [];
    const incompatible: FactorCompatibilityResult[] = [];
    for (const id of factorIds) {
      const result = this.checkCompatibility(id, market, instrument);
      if (result.compatible) {
        compatible.push(id);
      } else {
        incompatible.push(result);
      }
    }
    return { compatible, incompatible };
  }

  /** Get all factors for a specific market */
  getMarketFactors(market: Market): FactorDefinition[] {
    const result: FactorDefinition[] = [];
    for (const [, f] of this.factors) {
      if (f.compatibleMarkets.includes(market)) {
        result.push(f);
      }
    }
    return result.sort((a, b) => a.category.localeCompare(b.category));
  }

  /** Get all factors */
  getAllFactors(): FactorDefinition[] {
    return [...this.factors.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Get factor by ID */
  getFactor(id: string): FactorDefinition | undefined {
    return this.factors.get(id);
  }

  /** Group factors by category */
  getFactorsByCategory(): Record<string, FactorDefinition[]> {
    const grouped: Record<string, FactorDefinition[]> = {};
    for (const [, f] of this.factors) {
      (grouped[f.category] ??= []).push(f);
    }
    return grouped;
  }

  /** Compute market coverage stats */
  getMarketCoverage(): Map<Market, { totalFactors: number; universalFactors: number; marketSpecific: number }> {
    const markets: Market[] = ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA", "CRYPTO"];
    const result = new Map<Market, { totalFactors: number; universalFactors: number; marketSpecific: number }>();

    const universalSet = new Set(
      [...this.factors.values()]
        .filter((f) => f.compatibleMarkets.length >= 8)
        .map((f) => f.id),
    );

    for (const m of markets) {
      const marketFactors = this.getMarketFactors(m);
      const specific = marketFactors.filter((f) => !universalSet.has(f.id));
      result.set(m, {
        totalFactors: marketFactors.length,
        universalFactors: marketFactors.length - specific.length,
        marketSpecific: specific.length,
      });
    }
    return result;
  }

  /** Auto-suggest top N factors for a stock screen */
  suggestFactors(
    market: Market,
    instrument: InstrumentType,
    strategyType: "momentum" | "value" | "growth" | "balanced" | "defensive",
    topN: number = 5,
  ): FactorDefinition[] {
    const compatible = this.getCompatibleFactors(market, instrument);

    // Score by: category relevance to strategy + |IC| magnitude
    const strategyWeights: Record<string, number> = {
      momentum:   { momentum: 5, trend: 4, sentiment: 2, volatility: 1 },
      value:      { value: 5, quality: 4, yield: 3, size: 2 },
      growth:     { growth: 5, momentum: 3, sentiment: 2, quality: 1 },
      balanced:   { quality: 3, value: 3, momentum: 2, growth: 2, yield: 2, size: 1 },
      defensive:  { volatility: 5, yield: 4, quality: 3, value: 2 },
    };

    const weights = strategyWeights[strategyType] ?? strategyWeights.balanced;

    const scored = compatible.map((f) => ({
      factor: f,
      score: (weights[f.category] ?? 1) * 0.5 + Math.abs(f.typicalIC) * 10 * 0.5,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map((s) => s.factor);
  }

  // Reset for testing
  reset(): void {
    this.factors.clear();
    for (const f of FACTOR_LIBRARY) {
      this.factors.set(f.id, f);
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createFactorCompatibilityEngine(): FactorCompatibilityEngine {
  return new FactorCompatibilityEngine();
}

let compatEngineInstance: FactorCompatibilityEngine | null = null;

export function getFactorCompatibilityEngine(): FactorCompatibilityEngine {
  if (!compatEngineInstance) {
    compatEngineInstance = new FactorCompatibilityEngine();
  }
  return compatEngineInstance;
}
