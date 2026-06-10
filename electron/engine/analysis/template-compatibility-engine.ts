// ── J-72-02 R72 AUTHORITATIVE: Template Compatibility Matrix ──────────────
// 20+ Strategy Templates × 7 Markets × Multi-instrument

export type TemplateCategory = "trend" | "mean_reversion" | "breakout" | "arbitrage" | "options" | "event" | "macro";
export type TemplateRiskLevel = "low" | "medium" | "high" | "extreme";

export interface TemplateDefinition {
  id: string;
  name: string;
  nameCN: string;
  category: TemplateCategory;
  riskLevel: TemplateRiskLevel;
  description: string;
  compatibleMarkets: import("./factor-compatibility-engine").Market[];
  compatibleInstruments: import("./factor-compatibility-engine").InstrumentType[];
  minCapital: number; // HKD equivalent
  rebalanceFreq: string; // "daily"|"weekly"|"monthly"|"quarterly"
  parameters: Record<string, string | number>; // default params
  riskWarnings: string[];
}

export interface TemplateCompatibilityResult {
  templateId: string;
  market: string;
  instrument: string;
  compatible: boolean;
  reason?: string;
}

// ── Template Library (20+) ────────────────────────────────────────────────

const TEMPLATE_LIBRARY: TemplateDefinition[] = [
  // ═══ Universal (multi-market) ═══
  {
    id: "MOMENTUM_ROTATION", name: "Momentum Rotation", nameCN: "动量轮动",
    category: "trend", riskLevel: "medium",
    description: "Select top 20% stocks by 12M momentum, monthly rebalance; equal weight",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 50000, rebalanceFreq: "monthly",
    parameters: { lookback: "12M", topPct: 0.20, maxPositions: 30, stopLoss: -0.10 },
    riskWarnings: ["动量崩溃风险(Momentum Crash)", "熊市反转时可能大幅回撤", "需配合波动率目标控制仓位"],
  },
  {
    id: "MEAN_REVERSION", name: "Mean Reversion", nameCN: "均值回归",
    category: "mean_reversion", riskLevel: "medium",
    description: "Buy when price deviates >2σ below 20d MA, sell when reverts to MA; pairs: select high-correlation pair, trade spread",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 30000, rebalanceFreq: "daily",
    parameters: { maPeriod: 20, entrySigma: 2.0, exitSigma: 0.0, maxHoldingDays: 10 },
    riskWarnings: ["趋势市假突破风险", "流动性不足可能滑点大", "日内缺口可能导致止损失效"],
  },
  {
    id: "BREAKOUT", name: "Breakout Trading", nameCN: "突破交易",
    category: "breakout", riskLevel: "high",
    description: "Entry on breakout above N-day high with volume confirmation; exit on break below trailing stop",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    minCapital: 50000, rebalanceFreq: "daily",
    parameters: { lookback: 20, volumeThreshold: 1.5, trailingStop: -0.05, riskPerTrade: 0.02 },
    riskWarnings: ["假突破频繁", "需成交量确认", "高波动环境止损可能频繁触发"],
  },
  {
    id: "PAIRS_TRADE", name: "Pairs Trading", nameCN: "配对交易",
    category: "arbitrage", riskLevel: "medium",
    description: "Long undervalued stock + short overvalued stock in same sector; enter when spread >2σ, exit at MA",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    minCapital: 100000, rebalanceFreq: "daily",
    parameters: { correlationMin: 0.80, entrySigma: 2.0, exitSigma: 0.5, maxHoldingDays: 30 },
    riskWarnings: ["配对相关性可能破裂", "需做空机制(美股),港股不可做空正股", "单腿风险"],
  },
  {
    id: "GRID_TRADING", name: "Grid Trading", nameCN: "网格交易",
    category: "mean_reversion", riskLevel: "low",
    description: "Set price grid with fixed interval; buy at each lower grid, sell at each higher grid",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { gridCount: 10, gridWidth: 0.03, basePrice: 0, maxPosition: 0.50 },
    riskWarnings: ["单边趋势市可能满仓或空仓", "需及时调整网格中心", "震荡市最佳,趋势市最差"],
  },
  {
    id: "DCA", name: "DCA (Dollar Cost Average)", nameCN: "定投策略",
    category: "trend", riskLevel: "low",
    description: "Fixed amount periodic investment, ignore market timing; suitable for long-term ETF/blue chip",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 5000, rebalanceFreq: "monthly",
    parameters: { monthlyAmount: 10000, holdingBias: "ETF优先", stopLoss: 0 }, // 0 = no stop
    riskWarnings: ["不做止损", "需长期持有(>3年)", "单一标的风险需分散"],
  },
  {
    id: "TURTLE", name: "Turtle Trading", nameCN: "海龟交易法",
    category: "trend", riskLevel: "high",
    description: "Original Turtle rules: 20d/55d breakout entry, 10d/20d exit, ATR-based position sizing, pyramid",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["future", "etf"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { sys1Entry: 20, sys2Entry: 55, sys1Exit: 10, sys2Exit: 20, atrPeriod: 20, riskPerUnit: 0.01 },
    riskWarnings: ["大幅回撤是常态(>30%)", "需严格纪律+大资金", "震荡市-连续止损"],
  },
  {
    id: "DUAL_MA", name: "Dual MA Crossover", nameCN: "双均线交叉",
    category: "trend", riskLevel: "medium",
    description: "Golden cross (short > long) → long, Dead cross (short < long) → flat/short",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { shortMA: 20, longMA: 60, filterADX: 25 },
    riskWarnings: ["震荡市频繁假信号(锯齿)", "回撤集中在均线纠缠期", "需ADX过滤"],
  },
  {
    id: "BOLLINGER_BAND", name: "Bollinger Band Strategy", nameCN: "布林带策略",
    category: "mean_reversion", riskLevel: "low",
    description: "%B < 0.1 buy (oversold near lower band), %B > 0.9 sell (overbought near upper band); wait for reversion",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 15000, rebalanceFreq: "daily",
    parameters: { bbPeriod: 20, bbSigma: 2, entryB: 0.10, exitB: 0.50 },
    riskWarnings: ["趋势市布林带开口, 价格沿下轨继续跌", "不适合单边市", "需市场环境判断"],
  },
  // ── Options (universal for HKEX+NYSE+NASDAQ) ──
  {
    id: "OPTION_STRADDLE", name: "Long Straddle", nameCN: "跨式策略",
    category: "options", riskLevel: "high",
    description: "Buy ATM call + ATM put same strike/expiry; profit on large move either direction",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 5000, rebalanceFreq: "daily",
    parameters: { expiryDays: 30, ivThreshold: 0.30, positionSize: 1 }, // per contract
    riskWarnings: ["时间衰减(Theta)", "跨式成本高(需较大波动)", "财报前后IV crush风险"],
  },
  {
    id: "OPTION_STRANGLE", name: "Long Strangle", nameCN: "宽跨式策略",
    category: "options", riskLevel: "high",
    description: "Buy OTM call + OTM put; cheaper than straddle, needs larger move",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 3000, rebalanceFreq: "daily",
    parameters: { expiryDays: 30, otmPct: 0.05, positionSize: 1 },
    riskWarnings: ["需要比跨式更大的波动才能盈利", "Theta消耗更快(OTM)", "流动性不如ATM"],
  },
  {
    id: "OPTION_BUTTERFLY", name: "Iron Butterfly", nameCN: "蝶式策略",
    category: "options", riskLevel: "medium",
    description: "Sell ATM straddle + buy OTM strangle; profit on low volatility range-bound",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 10000, rebalanceFreq: "daily",
    parameters: { expiryDays: 14, wingWidth: 0.05, positionSize: 1 },
    riskWarnings: ["最大亏损固定但较大", "需精准预判震荡区间", "IV变化影响大"],
  },

  // ═══ US-Specific ═══
  {
    id: "US_EARNINGS_EVENT", name: "Earnings Event Drive", nameCN: "财报事件驱动",
    category: "event", riskLevel: "high",
    description: "Post-earnings-announcement drift (PEAD): buy positive surprise, short negative; hold 1-60 days",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    minCapital: 50000, rebalanceFreq: "daily",
    parameters: { surpriseMin: 0.05, holdDays: 30, maxPositions: 10 },
    riskWarnings: ["盈利惊喜已price-in", "财报后跳空不可控", "需快速执行(避免滑点)"],
  },

  // ═══ HKEX-Specific ═══
  {
    id: "HKEX_CBCS_HEDGE", name: "CBBC Hedge", nameCN: "牛熊证对冲",
    category: "arbitrage", riskLevel: "extreme",
    description: "Long stock + short bull contract hedge; or short bear contract as directional speculation with stop",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["cbcs"],
    minCapital: 100000, rebalanceFreq: "daily",
    parameters: { hedgeRatio: 0.50, strikeDistance: 0.03, knockOutBuffer: 0.01 },
    riskWarnings: ["牛熊证有收回风险", "距收回价<1%时极易被强平", "溢价+时间损耗", "不适合新手"],
  },
  {
    id: "HKEX_WARRANT_ARB", name: "Warrant Arbitrage", nameCN: "涡轮套利",
    category: "arbitrage", riskLevel: "extreme",
    description: "Warrant IV vs stock HV spread > 10% → sell warrant + delta hedge with stock; re-hedge daily",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["warrant"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { ivMinSpread: 0.10, deltaHedgeFreq_hours: 4, maxHoldingDays: 5 },
    riskWarnings: ["需持续Delta对冲(计算密集)", "涡轮流动性差(买卖价差大)", "发行人可调整条款", "专业级, 不推荐散户"],
  },

  // ═══ Global Macro ═══
  {
    id: "SECTOR_ROTATE", name: "Sector Rotation", nameCN: "行业轮动策略",
    category: "macro", riskLevel: "medium",
    description: "Rotate to top-performing sectors based on business cycle phase; quarterly rebalance",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "TSE"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 100000, rebalanceFreq: "quarterly",
    parameters: { topSectors: 3, momentumWeight: 0.60, macroWeight: 0.40, rebalanceMonths: 3 },
    riskWarnings: ["行业轮动速度可能快于季度调仓", "需宏观数据辅助(PMI/利率)", "集中度风险"],
  },
  {
    id: "MARKET_NEUTRAL", name: "Market Neutral", nameCN: "市场中性",
    category: "arbitrage", riskLevel: "medium",
    description: "Long top quintile + short bottom quintile by factor rank; beta-neutral to broad index",
    compatibleMarkets: ["NYSE", "NASDAQ", "HKEX"],
    compatibleInstruments: ["stock"],
    minCapital: 500000, rebalanceFreq: "monthly",
    parameters: { factorWeights: "MOM30+QUAL25+VALUE25+SIZE20", longPct: 0.20, shortPct: 0.20, betaNeutral: true },
    riskWarnings: ["需做空能力(HKEX有限)", "因子拥挤→IC decay", "融资成本", "高换手率导致高交易成本"],
  },
  {
    id: "VOL_ARB", name: "Volatility Arbitrage", nameCN: "波动率套利",
    category: "arbitrage", riskLevel: "high",
    description: "Exploit VIX futures term structure: contango → short VIX futures; backwardation → long; VIX ETP hedge",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["future", "option"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { contangoEntry: 0.05, backwardationEntry: -0.05, positionLimit: 0.30 },
    riskWarnings: ["VIX spike(黑天鹅)导致巨额亏损", "volatility ETN/ETF有 decay", "专业级衍生品"],
  },
  {
    id: "FUTURES_CROSS_MARKET", name: "Futures Cross-Market Arb", nameCN: "期货跨市场套利",
    category: "arbitrage", riskLevel: "high",
    description: "N225指数 vs N225期货基差套利 / SGX A50 vs HKEX恒指期货基差 / ES vs NQ spread ratio",
    compatibleMarkets: ["HKEX", "SGX", "TSE", "NYSE", "NASDAQ"],
    compatibleInstruments: ["future"],
    minCapital: 500000, rebalanceFreq: "daily",
    parameters: { spreadEntrySigma: 2.5, spreadExitSigma: 0.5, maxHoldingDays: 10, contractRatio: "calc" },
    riskWarnings: ["跨市场时差+假期日历风险", "外汇波动(JPY/SGD/HKD)", "基差可能继续走阔", "需多账户+大资金"],
  },

  // ═══ Special (all markets) ═══
  {
    id: "DIVIDEND_CAPTURE", name: "Dividend Capture", nameCN: "股息捕捉",
    category: "event", riskLevel: "low",
    description: "Buy before ex-div date, sell after capture; filter for >3% dividend, recovery in <10d",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "ASX"],
    compatibleInstruments: ["stock"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { minYield: 0.03, holdDaysBefore: 3, holdDaysAfter: 5, maxDrawdown: 0.03 },
    riskWarnings: ["除息后股价不一定回补", "税收:美股30%预扣税,港股无税", "套利空间小需批量操作"],
  },
];

// ── Template Compatibility Engine ─────────────────────────────────────────

export class TemplateCompatibilityEngine {
  private templates: Map<string, TemplateDefinition> = new Map();

  constructor() {
    for (const t of TEMPLATE_LIBRARY) {
      this.templates.set(t.id, t);
    }
  }

  /** Check template compatibility */
  checkCompatibility(
    templateId: string,
    market: string,
    instrument: string,
  ): TemplateCompatibilityResult {
    const tmpl = this.templates.get(templateId);
    if (!tmpl) {
      return { templateId, market, instrument, compatible: false, reason: `模板 ${templateId} 不存在` };
    }

    const marketOk = tmpl.compatibleMarkets.includes(market as any);
    const instOk = tmpl.compatibleInstruments.includes(instrument as any);

    if (!marketOk) {
      return { templateId, market, instrument, compatible: false, reason: `${tmpl.nameCN} 仅适用: ${tmpl.compatibleMarkets.join(", ")}` };
    }
    if (!instOk) {
      return { templateId, market, instrument, compatible: false, reason: `${tmpl.nameCN} 仅适用品种: ${tmpl.compatibleInstruments.join(", ")}` };
    }

    return { templateId, market, instrument, compatible: true };
  }

  /** Get all compatible templates */
  getCompatibleTemplates(market: string, instrument: string): TemplateDefinition[] {
    return [...this.templates.values()].filter(
      (t) => t.compatibleMarkets.includes(market as any) && t.compatibleInstruments.includes(instrument as any),
    );
  }

  /** Filter template IDs */
  filterCompatible(templateIds: string[], market: string, instrument: string): {
    compatible: string[];
    incompatible: TemplateCompatibilityResult[];
  } {
    const compatible: string[] = [];
    const incompatible: TemplateCompatibilityResult[] = [];
    for (const id of templateIds) {
      const r = this.checkCompatibility(id, market, instrument);
      if (r.compatible) compatible.push(id);
      else incompatible.push(r);
    }
    return { compatible, incompatible };
  }

  /** Get all templates */
  getAllTemplates(): TemplateDefinition[] {
    return [...this.templates.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getTemplate(id: string): TemplateDefinition | undefined {
    return this.templates.get(id);
  }

  /** Group by category */
  getTemplatesByCategory(): Record<string, TemplateDefinition[]> {
    const grouped: Record<string, TemplateDefinition[]> = {};
    for (const t of this.templates.values()) {
      (grouped[t.category] ??= []).push(t);
    }
    return grouped;
  }

  /** Suggest templates for user preferences */
  suggestTemplates(
    market: string,
    instrument: string,
    riskPref: "low" | "medium" | "high" | "extreme",
    capital: number,
    maxTemplates: number = 5,
  ): TemplateDefinition[] {
    const compatible = this.getCompatibleTemplates(market, instrument);
    const riskOrder: TemplateRiskLevel[] = ["low", "medium", "high", "extreme"];
    const maxRiskIdx = riskOrder.indexOf(riskPref);

    return compatible
      .filter((t) => {
        const tRiskIdx = riskOrder.indexOf(t.riskLevel);
        return tRiskIdx <= maxRiskIdx && capital >= t.minCapital;
      })
      .sort((a, b) => {
        // Prefer: matches risk pref > lower min capital
        const aMatch = a.riskLevel === riskPref ? 1 : 0;
        const bMatch = b.riskLevel === riskPref ? 1 : 0;
        return bMatch - aMatch || a.minCapital - b.minCapital;
      })
      .slice(0, maxTemplates);
  }

  reset(): void {
    this.templates.clear();
    for (const t of TEMPLATE_LIBRARY) this.templates.set(t.id, t);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createTemplateCompatibilityEngine(): TemplateCompatibilityEngine {
  return new TemplateCompatibilityEngine();
}
