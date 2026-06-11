import i18n from '../../../src/i18n';
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
    id: "MOMENTUM_ROTATION", name: "Momentum Rotation", nameCN: i18n.t('templateCompatibilityEngine.k1'),
    category: "trend", riskLevel: "medium",
    description: "Select top 20% stocks by 12M momentum, monthly rebalance; equal weight",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 50000, rebalanceFreq: "monthly",
    parameters: { lookback: "12M", topPct: 0.20, maxPositions: 30, stopLoss: -0.10 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k2'), i18n.t('templateCompatibilityEngine.k3'), i18n.t('templateCompatibilityEngine.k4')],
  },
  {
    id: "MEAN_REVERSION", name: "Mean Reversion", nameCN: i18n.t('templateCompatibilityEngine.k5'),
    category: "mean_reversion", riskLevel: "medium",
    description: "Buy when price deviates >2σ below 20d MA, sell when reverts to MA; pairs: select high-correlation pair, trade spread",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 30000, rebalanceFreq: "daily",
    parameters: { maPeriod: 20, entrySigma: 2.0, exitSigma: 0.0, maxHoldingDays: 10 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k6'), i18n.t('templateCompatibilityEngine.k7'), i18n.t('templateCompatibilityEngine.k8')],
  },
  {
    id: "BREAKOUT", name: "Breakout Trading", nameCN: i18n.t('templateCompatibilityEngine.k9'),
    category: "breakout", riskLevel: "high",
    description: "Entry on breakout above N-day high with volume confirmation; exit on break below trailing stop",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    minCapital: 50000, rebalanceFreq: "daily",
    parameters: { lookback: 20, volumeThreshold: 1.5, trailingStop: -0.05, riskPerTrade: 0.02 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k10'), i18n.t('templateCompatibilityEngine.k11'), i18n.t('templateCompatibilityEngine.k12')],
  },
  {
    id: "PAIRS_TRADE", name: "Pairs Trading", nameCN: i18n.t('templateCompatibilityEngine.k13'),
    category: "arbitrage", riskLevel: "medium",
    description: "Long undervalued stock + short overvalued stock in same sector; enter when spread >2σ, exit at MA",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    minCapital: 100000, rebalanceFreq: "daily",
    parameters: { correlationMin: 0.80, entrySigma: 2.0, exitSigma: 0.5, maxHoldingDays: 30 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k14'), i18n.t('templateCompatibilityEngine.k15'), i18n.t('templateCompatibilityEngine.k16')],
  },
  {
    id: "GRID_TRADING", name: "Grid Trading", nameCN: i18n.t('templateCompatibilityEngine.k17'),
    category: "mean_reversion", riskLevel: "low",
    description: "Set price grid with fixed interval; buy at each lower grid, sell at each higher grid",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { gridCount: 10, gridWidth: 0.03, basePrice: 0, maxPosition: 0.50 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k18'), i18n.t('templateCompatibilityEngine.k19'), i18n.t('templateCompatibilityEngine.k20')],
  },
  {
    id: "DCA", name: "DCA (Dollar Cost Average)", nameCN: i18n.t('templateCompatibilityEngine.k21'),
    category: "trend", riskLevel: "low",
    description: "Fixed amount periodic investment, ignore market timing; suitable for long-term ETF/blue chip",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 5000, rebalanceFreq: "monthly",
    parameters: { monthlyAmount: 10000, holdingBias: i18n.t('templateCompatibilityEngine.k22'), stopLoss: 0 }, // 0 = no stop
    riskWarnings: [i18n.t('templateCompatibilityEngine.k23'), i18n.t('templateCompatibilityEngine.k24'), i18n.t('templateCompatibilityEngine.k25')],
  },
  {
    id: "TURTLE", name: "Turtle Trading", nameCN: i18n.t('templateCompatibilityEngine.k26'),
    category: "trend", riskLevel: "high",
    description: "Original Turtle rules: 20d/55d breakout entry, 10d/20d exit, ATR-based position sizing, pyramid",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["future", "etf"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { sys1Entry: 20, sys2Entry: 55, sys1Exit: 10, sys2Exit: 20, atrPeriod: 20, riskPerUnit: 0.01 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k27'), i18n.t('templateCompatibilityEngine.k28'), i18n.t('templateCompatibilityEngine.k29')],
  },
  {
    id: "DUAL_MA", name: "Dual MA Crossover", nameCN: i18n.t('templateCompatibilityEngine.k30'),
    category: "trend", riskLevel: "medium",
    description: "Golden cross (short > long) → long, Dead cross (short < long) → flat/short",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf", "future"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { shortMA: 20, longMA: 60, filterADX: 25 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k31'), i18n.t('templateCompatibilityEngine.k32'), i18n.t('templateCompatibilityEngine.k33')],
  },
  {
    id: "BOLLINGER_BAND", name: "Bollinger Band Strategy", nameCN: i18n.t('templateCompatibilityEngine.k34'),
    category: "mean_reversion", riskLevel: "low",
    description: "%B < 0.1 buy (oversold near lower band), %B > 0.9 sell (overbought near upper band); wait for reversion",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "TSX", "BURSA"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 15000, rebalanceFreq: "daily",
    parameters: { bbPeriod: 20, bbSigma: 2, entryB: 0.10, exitB: 0.50 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k35'), i18n.t('templateCompatibilityEngine.k36'), i18n.t('templateCompatibilityEngine.k37')],
  },
  // ── Options (universal for HKEX+NYSE+NASDAQ) ──
  {
    id: "OPTION_STRADDLE", name: "Long Straddle", nameCN: i18n.t('templateCompatibilityEngine.k38'),
    category: "options", riskLevel: "high",
    description: "Buy ATM call + ATM put same strike/expiry; profit on large move either direction",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 5000, rebalanceFreq: "daily",
    parameters: { expiryDays: 30, ivThreshold: 0.30, positionSize: 1 }, // per contract
    riskWarnings: [i18n.t('templateCompatibilityEngine.k39'), i18n.t('templateCompatibilityEngine.k40'), i18n.t('templateCompatibilityEngine.k41')],
  },
  {
    id: "OPTION_STRANGLE", name: "Long Strangle", nameCN: i18n.t('templateCompatibilityEngine.k42'),
    category: "options", riskLevel: "high",
    description: "Buy OTM call + OTM put; cheaper than straddle, needs larger move",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 3000, rebalanceFreq: "daily",
    parameters: { expiryDays: 30, otmPct: 0.05, positionSize: 1 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k43'), i18n.t('templateCompatibilityEngine.k44'), i18n.t('templateCompatibilityEngine.k45')],
  },
  {
    id: "OPTION_BUTTERFLY", name: "Iron Butterfly", nameCN: i18n.t('templateCompatibilityEngine.k46'),
    category: "options", riskLevel: "medium",
    description: "Sell ATM straddle + buy OTM strangle; profit on low volatility range-bound",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ"],
    compatibleInstruments: ["option"],
    minCapital: 10000, rebalanceFreq: "daily",
    parameters: { expiryDays: 14, wingWidth: 0.05, positionSize: 1 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k47'), i18n.t('templateCompatibilityEngine.k48'), i18n.t('templateCompatibilityEngine.k49')],
  },

  // ═══ US-Specific ═══
  {
    id: "US_EARNINGS_EVENT", name: "Earnings Event Drive", nameCN: i18n.t('templateCompatibilityEngine.k50'),
    category: "event", riskLevel: "high",
    description: "Post-earnings-announcement drift (PEAD): buy positive surprise, short negative; hold 1-60 days",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["stock"],
    minCapital: 50000, rebalanceFreq: "daily",
    parameters: { surpriseMin: 0.05, holdDays: 30, maxPositions: 10 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k51'), i18n.t('templateCompatibilityEngine.k52'), i18n.t('templateCompatibilityEngine.k53')],
  },

  // ═══ HKEX-Specific ═══
  {
    id: "HKEX_CBCS_HEDGE", name: "CBBC Hedge", nameCN: i18n.t('templateCompatibilityEngine.k54'),
    category: "arbitrage", riskLevel: "extreme",
    description: "Long stock + short bull contract hedge; or short bear contract as directional speculation with stop",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["cbcs"],
    minCapital: 100000, rebalanceFreq: "daily",
    parameters: { hedgeRatio: 0.50, strikeDistance: 0.03, knockOutBuffer: 0.01 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k55'), i18n.t('templateCompatibilityEngine.k56'), i18n.t('templateCompatibilityEngine.k57'), i18n.t('templateCompatibilityEngine.k58')],
  },
  {
    id: "HKEX_WARRANT_ARB", name: "Warrant Arbitrage", nameCN: i18n.t('templateCompatibilityEngine.k59'),
    category: "arbitrage", riskLevel: "extreme",
    description: "Warrant IV vs stock HV spread > 10% → sell warrant + delta hedge with stock; re-hedge daily",
    compatibleMarkets: ["HKEX"],
    compatibleInstruments: ["warrant"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { ivMinSpread: 0.10, deltaHedgeFreq_hours: 4, maxHoldingDays: 5 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k60'), i18n.t('templateCompatibilityEngine.k61'), i18n.t('templateCompatibilityEngine.k62'), i18n.t('templateCompatibilityEngine.k63')],
  },

  // ═══ Global Macro ═══
  {
    id: "SECTOR_ROTATE", name: "Sector Rotation", nameCN: i18n.t('templateCompatibilityEngine.k64'),
    category: "macro", riskLevel: "medium",
    description: "Rotate to top-performing sectors based on business cycle phase; quarterly rebalance",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "TSE"],
    compatibleInstruments: ["stock", "etf"],
    minCapital: 100000, rebalanceFreq: "quarterly",
    parameters: { topSectors: 3, momentumWeight: 0.60, macroWeight: 0.40, rebalanceMonths: 3 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k65'), i18n.t('templateCompatibilityEngine.k66'), i18n.t('templateCompatibilityEngine.k67')],
  },
  {
    id: "MARKET_NEUTRAL", name: "Market Neutral", nameCN: i18n.t('templateCompatibilityEngine.k68'),
    category: "arbitrage", riskLevel: "medium",
    description: "Long top quintile + short bottom quintile by factor rank; beta-neutral to broad index",
    compatibleMarkets: ["NYSE", "NASDAQ", "HKEX"],
    compatibleInstruments: ["stock"],
    minCapital: 500000, rebalanceFreq: "monthly",
    parameters: { factorWeights: "MOM30+QUAL25+VALUE25+SIZE20", longPct: 0.20, shortPct: 0.20, betaNeutral: true },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k69'), i18n.t('templateCompatibilityEngine.k70'), i18n.t('templateCompatibilityEngine.k71'), i18n.t('templateCompatibilityEngine.k72')],
  },
  {
    id: "VOL_ARB", name: "Volatility Arbitrage", nameCN: i18n.t('templateCompatibilityEngine.k73'),
    category: "arbitrage", riskLevel: "high",
    description: "Exploit VIX futures term structure: contango → short VIX futures; backwardation → long; VIX ETP hedge",
    compatibleMarkets: ["NYSE", "NASDAQ"],
    compatibleInstruments: ["future", "option"],
    minCapital: 200000, rebalanceFreq: "daily",
    parameters: { contangoEntry: 0.05, backwardationEntry: -0.05, positionLimit: 0.30 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k74'), i18n.t('templateCompatibilityEngine.k75'), i18n.t('templateCompatibilityEngine.k76')],
  },
  {
    id: "FUTURES_CROSS_MARKET", name: "Futures Cross-Market Arb", nameCN: i18n.t('templateCompatibilityEngine.k77'),
    category: "arbitrage", riskLevel: "high",
    description: i18n.t('templateCompatibilityEngine.k78'),
    compatibleMarkets: ["HKEX", "SGX", "TSE", "NYSE", "NASDAQ"],
    compatibleInstruments: ["future"],
    minCapital: 500000, rebalanceFreq: "daily",
    parameters: { spreadEntrySigma: 2.5, spreadExitSigma: 0.5, maxHoldingDays: 10, contractRatio: "calc" },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k79'), i18n.t('templateCompatibilityEngine.k80'), i18n.t('templateCompatibilityEngine.k81'), i18n.t('templateCompatibilityEngine.k82')],
  },

  // ═══ Special (all markets) ═══
  {
    id: "DIVIDEND_CAPTURE", name: "Dividend Capture", nameCN: i18n.t('templateCompatibilityEngine.k83'),
    category: "event", riskLevel: "low",
    description: "Buy before ex-div date, sell after capture; filter for >3% dividend, recovery in <10d",
    compatibleMarkets: ["HKEX", "NYSE", "NASDAQ", "SGX", "ASX"],
    compatibleInstruments: ["stock"],
    minCapital: 20000, rebalanceFreq: "daily",
    parameters: { minYield: 0.03, holdDaysBefore: 3, holdDaysAfter: 5, maxDrawdown: 0.03 },
    riskWarnings: [i18n.t('templateCompatibilityEngine.k84'), i18n.t('templateCompatibilityEngine.k85'), i18n.t('templateCompatibilityEngine.k86')],
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
      return { templateId, market, instrument, compatible: false, reason: i18n.t('templateCompatibilityEngine.k87') };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketOk = tmpl.compatibleMarkets.includes(market as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instOk = tmpl.compatibleInstruments.includes(instrument as any);

    if (!marketOk) {
      return { templateId, market, instrument, compatible: false, reason: i18n.t('templateCompatibilityEngine.k88') };
    }
    if (!instOk) {
      return { templateId, market, instrument, compatible: false, reason: i18n.t('templateCompatibilityEngine.k89') };
    }

    return { templateId, market, instrument, compatible: true };
  }

  /** Get all compatible templates */
  getCompatibleTemplates(market: string, instrument: string): TemplateDefinition[] {
    return [...this.templates.values()].filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
