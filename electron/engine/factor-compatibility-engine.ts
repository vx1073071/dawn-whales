// ── J-72-01 R72 AUTHORITATIVE: Factor Compatibility Matrix ────────────────
// 30+ Factors × 7 Markets, stock screen auto-filters incompatible factors

export type Market = "HKEX" | "NYSE" | "NASDAQ" | "SGX" | "TSE" | "ASX" | "TSX" | "BURSA";
export type InstrumentType = "stock" | "etf" | "reit" | "adr" | "cbcs" | "warrant" | "future" | "option";

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
    id: "MOM_12M", name: "Momentum 12M", nameCN: "12月动量",
    category: "momentum",
    description: "12-month total return excluding most recent month",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "(Price_t - Price_{t-12}) / Price_{t-12}, skip t-1 month",
    typicalIC: 0.045, decayHalfLife: 60, usage: "长线趋势选股, 配合波动率过滤",
  },
  {
    id: "MOM_1M", name: "Momentum 1M", nameCN: "1月动量",
    category: "momentum",
    description: "1-month total return, short-term reversal aware",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "(Price_t - Price_{t-21}) / Price_{t-21}",
    typicalIC: 0.032, decayHalfLife: 15, usage: "短线轮动, 需与反转因子对冲",
  },
  {
    id: "LIQ", name: "Liquidity", nameCN: "流动性",
    category: "volatility",
    description: "Average daily turnover / market cap ratio",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "AvgDailyTurnover(20d) / MarketCap",
    typicalIC: -0.038, decayHalfLife: 45, usage: "流动性溢价, 低流动性→高预期收益",
  },
  {
    id: "VOL_60D", name: "Volatility 60D", nameCN: "60日波动率",
    category: "volatility",
    description: "60-day daily return standard deviation (annualized)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "StdDev(daily_returns, 60) * sqrt(252)",
    typicalIC: -0.042, decayHalfLife: 30, usage: "低波因子, 防御性配置",
  },
  {
    id: "GROWTH", name: "Growth", nameCN: "成长性",
    category: "growth",
    description: "YoY revenue/earnings growth composite",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "Z(RevGrowth) + Z(EarnGrowth), 3Y CAGR",
    typicalIC: 0.028, decayHalfLife: 90, usage: "成长股筛选, 配合估值因子避免追高",
  },
  {
    id: "QUAL", name: "Quality", nameCN: "质量",
    category: "quality",
    description: "ROE + Debt/Equity + Accruals composite",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "Z(ROE) + Z(-Debt/Equity) + Z(-Accruals)",
    typicalIC: 0.035, decayHalfLife: 120, usage: "核心持仓, 长期配置基准",
  },
  {
    id: "SIZE", name: "Size (SMB)", nameCN: "规模因子",
    category: "size",
    description: "Market cap log, Fama-French SMB proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "ln(MarketCap), long bottom 30% / short top 30%",
    typicalIC: -0.025, decayHalfLife: 180, usage: "小盘溢价, 长期配置+流动性过滤",
  },
  {
    id: "YIELD", name: "Dividend Yield", nameCN: "股息率",
    category: "yield",
    description: "Trailing 12M dividend / current price",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "reit"],
    calculation: "TTM_Dividend / Price",
    typicalIC: 0.018, decayHalfLife: 180, usage: "收入型策略, 高股息+低波组合",
  },
  {
    id: "HML", name: "Value (HML)", nameCN: "价值因子",
    category: "value",
    description: "Book-to-Price ratio, Fama-French HML proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "BookValue / MarketCap, top 30% / bottom 30% long-short",
    typicalIC: 0.038, decayHalfLife: 150, usage: "价值股筛选, 与MOM负相关可对冲",
  },
  {
    id: "RMW", name: "Profitability (RMW)", nameCN: "盈利因子",
    category: "quality",
    description: "Operating profitability, Fama-French RMW proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "(Revenue - COGS - SG&A) / BookEquity",
    typicalIC: 0.030, decayHalfLife: 120, usage: "高盈利质量, 稳健型配置",
  },
  {
    id: "CMA", name: "Investment (CMA)", nameCN: "投资因子",
    category: "quality",
    description: "Conservative minus aggressive investment, FF5 CMA proxy",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "ΔTotalAssets / TotalAssets, low investment = conservative premium",
    typicalIC: -0.022, decayHalfLife: 150, usage: "低投资偏好, 与RMW同向",
  },
  // ── Technical (universal) ──
  {
    id: "MA_20_60", name: "MA Crossover 20/60", nameCN: "均线交叉20/60",
    category: "trend",
    description: "Golden cross / dead cross of MA20 over MA60",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "1 if MA20 > MA60 else -1, smoothed 3d",
    typicalIC: 0.025, decayHalfLife: 20, usage: "趋势跟踪基础信号",
  },
  {
    id: "EMA_12_26", name: "EMA Crossover MACD", nameCN: "MACD信号",
    category: "trend",
    description: "MACD histogram: (EMA12-EMA26) - EMA9",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "MACD_line = EMA(12)-EMA(26); Signal = EMA(9); Hist = MACD - Signal",
    typicalIC: 0.020, decayHalfLife: 15, usage: "短线趋势信号",
  },
  {
    id: "RSI_14", name: "RSI 14", nameCN: "RSI 14日",
    category: "momentum",
    description: "14-day Relative Strength Index, contrarian at extremes",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "100 - 100/(1+AvgGain14/AvgLoss14); overweight RSI<30, underweight RSI>70",
    typicalIC: -0.028, decayHalfLife: 10, usage: "超卖反弹信号, 需趋势确认",
  },
  {
    id: "KDJ", name: "KDJ Stochastic", nameCN: "KDJ随机指标",
    category: "momentum",
    description: "Fast stochastic oscillator, overbought/oversold",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "K=100*(C-L14)/(H14-L14); D=SMA(K,3); J=3K-2D",
    typicalIC: -0.015, decayHalfLife: 8, usage: "震荡市反转信号, 不适合趋势市",
  },
  {
    id: "BOLL", name: "Bollinger Bands %B", nameCN: "布林带%B",
    category: "volatility",
    description: "Price position within Bollinger Bands (20,2)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "%B = (Price - Lower) / (Upper - Lower); Upper/Lower = MA20 +/- 2*StdDev20",
    typicalIC: -0.022, decayHalfLife: 12, usage: "均值回归边界信号",
  },
  {
    id: "ATR_14", name: "ATR 14", nameCN: "ATR波动率",
    category: "volatility",
    description: "Average True Range, position sizing reference",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future", "option"],
    calculation: "EMA(TR, 14) where TR = max(H-L, |H-Cprev|, |L-Cprev|)",
    typicalIC: -0.018, decayHalfLife: 14, usage: "止损位设置/仓位计算",
  },
  {
    id: "ADX", name: "ADX 14", nameCN: "趋势强度",
    category: "trend",
    description: "Average Directional Index, trend strength (not direction)",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "ADX = 100 * EMA(|+DI - -DI|/(+DI + -DI), 14); ADX>25=trending",
    typicalIC: 0.015, decayHalfLife: 18, usage: "趋势过滤器, 配合趋势指标使用",
  },
  {
    id: "OBV", name: "OBV", nameCN: "能量潮",
    category: "sentiment",
    description: "On-Balance Volume, cumulative volume flow",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "OBV_t = OBV_{t-1} + Volume_t * sign(Close_t - Close_{t-1})",
    typicalIC: 0.012, decayHalfLife: 25, usage: "量价背离确认信号",
  },
  {
    id: "CMF", name: "CMF", nameCN: "资金流量指标",
    category: "sentiment",
    description: "Chaikin Money Flow, 21-day MF period",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "Sum(Volume * ((Close-Low)-(High-Close))/(High-Low), 21) / Sum(Volume, 21)",
    typicalIC: 0.016, decayHalfLife: 20, usage: "资金流向判断, CMF>0=资金流入",
  },
  {
    id: "ICHIMOKU", name: "Ichimoku Cloud", nameCN: "一目均衡",
    category: "trend",
    description: "Ichimoku Kinko Hyo: Tenkan/Kijun/Senkou Span A/B + Chikou",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    calculation: "Tenkan=(H9+L9)/2; Kijun=(H26+L26)/2; SenkouA=(T+K)/2 ahead 26; SenkouB=(H52+L52)/2 ahead 26",
    typicalIC: 0.019, decayHalfLife: 30, usage: "趋势+支撑阻力综合判断",
  },

  // ═══ HKEX-Specific ═══
  {
    id: "HKEX_NORTHBOUND", name: "Northbound Flow", nameCN: "北向资金",
    category: "sentiment",
    description: "Daily northbound net flow (connect), foreign capital to A-shares via HKEX",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Daily Shanghai+Shenzhen Connect net buy (CNY), Z-score 20d",
    typicalIC: 0.055, decayHalfLife: 5, usage: "港股专用, 北向净流入与港股正相关",
  },
  {
    id: "HKEX_SOUTHBOUND", name: "Southbound Flow", nameCN: "南向资金",
    category: "sentiment",
    description: "Southbound connect net flow, mainland capital to HK",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Daily HKEX Connect net buy (HKD), Z-score 20d",
    typicalIC: 0.048, decayHalfLife: 5, usage: "港股专用, 南向资金推动H股",
  },
  {
    id: "HKEX_CBCS_PREMIUM", name: "CBBC Premium", nameCN: "牛熊证溢价率",
    category: "value",
    description: "Callable Bull/Bear Contract premium to intrinsic value",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["cbcs", "warrant"],
    calculation: "(CBBC_Price - Max(0, Strike - Spot)) / Spot for bear, similar for bull",
    typicalIC: 0.030, decayHalfLife: 3, usage: "牛熊证套利, 溢价<2%=进场",
  },
  {
    id: "HKEX_WARRANT_IV", name: "Warrant IV", nameCN: "涡轮隐含波",
    category: "volatility",
    description: "Warrant implied volatility vs historical 30d volatility spread",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["warrant"],
    calculation: "IV(warrant, BSM) - HV(stock, 30d); positive = warrant expensive",
    typicalIC: -0.035, decayHalfLife: 5, usage: "涡轮波动率交易, IV高卖低买",
  },
  {
    id: "HKEX_DLHB", name: "Dragon Tiger List", nameCN: "龙虎榜净买",
    category: "sentiment",
    description: "Top broker seats net buy on Dragon & Tiger Board",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Sum(top5_buy_seats) - Sum(top5_sell_seats), Z-score 5d",
    typicalIC: 0.040, decayHalfLife: 3, usage: "短线资金流向, 需注意游资一日游",
  },
  {
    id: "HKEX_FUND_HOLD", name: "Fund Holding", nameCN: "基金持仓集中度",
    category: "quality",
    description: "Top 10 fund holdings weight overlap",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["stock"],
    calculation: "Count of top10 funds holding this stock, Z-score sector",
    typicalIC: 0.025, decayHalfLife: 60, usage: "机构共识, 高集中=高确定性",
  },

  // ═══ US-Specific ═══
  {
    id: "US_VIX", name: "VIX Level", nameCN: "VIX恐慌指数",
    category: "macro",
    description: "CBOE VIX level, market fear gauge",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock", "etf", "option"],
    calculation: "VIX > 30 = high fear (buy), VIX < 15 = complacency (hedge)",
    typicalIC: -0.050, decayHalfLife: 7, usage: "美股市场情绪, VIX高点买入信号",
  },
  {
    id: "US_SHORT_RATIO", name: "Short Interest", nameCN: "做空比率",
    category: "sentiment",
    description: "Days to cover (short interest / avg daily volume)",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "ShortInterest / AvgDailyVol(20d); >5 days = potential squeeze",
    typicalIC: 0.033, decayHalfLife: 15, usage: "轧空信号, 高空头比率+低浮筹=挤压",
  },
  {
    id: "US_INST_HOLD", name: "Institutional Holding", nameCN: "机构持仓变化",
    category: "sentiment",
    description: "13F quarterly change in institutional holdings",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "QoQ change in total institutional shares / total outstanding",
    typicalIC: 0.032, decayHalfLife: 90, usage: "跟随聪明钱, 增持>5%=强烈看多",
  },
  {
    id: "US_BUYBACK", name: "Buyback Yield", nameCN: "回购收益率",
    category: "yield",
    description: "Net buyback / market cap, US-specific yield factor",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    calculation: "(ShareBuyback - ShareIssuance) / MarketCap TTM",
    typicalIC: 0.028, decayHalfLife: 90, usage: "回购回报, 配合股息率=总股东回报",
  },

  // ═══ Global (multi-market specialized) ═══
  {
    id: "OPTION_PCR", name: "Put/Call Ratio", nameCN: "期权PCR",
    category: "sentiment",
    description: "Open interest put/call ratio, sentiment indicator",
    compatibleMarkets: ["NYSE", "NASDAQ", "HKEX"],
    compatibleInstruments: ["option"],
    calculation: "TotalPutOI / TotalCallOI; >1.0 bearish, <0.7 bullish (contrarian)",
    typicalIC: -0.042, decayHalfLife: 5, usage: "期权市场情绪, 极端值=反转信号",
  },
  {
    id: "SECTOR_ROTATION", name: "Sector Rotation", nameCN: "行业轮动",
    category: "macro",
    description: "12-month sector momentum ranking, rotate to top 3",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "TSE"],
    compatibleInstruments: ["stock", "etf"],
    calculation: "Sector_Return(3M/6M/12M) weighted rank, select top 3 of 11 GICS sectors",
    typicalIC: 0.040, decayHalfLife: 90, usage: "行业轮动策略, 季度调仓",
  },
  {
    id: "FX_EXPOSURE", name: "FX Exposure", nameCN: "汇率风险暴露",
    category: "macro",
    description: "Revenue exposure to non-domestic currency",
    compatibleMarkets: ["SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock"],
    calculation: "%Revenue_nonLocalCurrency * (LocalCurrency/USD change 1M)",
    typicalIC: 0.015, decayHalfLife: 30, usage: "非美市场必备, 对冲汇率风险",
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
      return { factorId, market, instrument, compatible: false, reason: `因子 ${factorId} 不存在` };
    }

    const marketOk = factor.compatibleMarkets.includes(market);
    const instOk = factor.compatibleInstruments.includes(instrument);

    if (!marketOk && !instOk) {
      return { factorId, market, instrument, compatible: false, reason: `因子 ${factor.nameCN} 不支持${market}市场及${instrument}品种` };
    }
    if (!marketOk) {
      return { factorId, market, instrument, compatible: false, reason: `因子 ${factor.nameCN} 仅适用: ${factor.compatibleMarkets.join(", ")}` };
    }
    if (!instOk) {
      return { factorId, market, instrument, compatible: false, reason: `因子 ${factor.nameCN} 仅适用品种: ${factor.compatibleInstruments.join(", ")}` };
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
    const markets: Market[] = ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"];
    const result = new Map<Market, { totalFactors: number; universalFactors: number; marketSpecific: number }>();

    const universalSet = new Set(
      [...this.factors.values()]
        .filter((f) => f.compatibleMarkets.length >= 7)
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
