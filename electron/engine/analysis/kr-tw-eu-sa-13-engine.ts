// ── R275 JVS-2 🇰🇷🇹🇼🇪🇺🇸🇦 13指标引擎 (KR_TW_EU_SA_13Engine) ──
// KR: 3指标 (半导体出口/外国债券持有/消费者信心)
// TW: 3指标 (外销订单/电子零组件/M1B)
// EU: 4指标 (PMI/ZEW/通胀预期/银行信贷)
// SA: 3指标 (油价/外汇储备/PMI)

// ═══════ 🇰🇷 韩国 3指标 ═══════

export interface KRSemiExportIndicator {
  date: string;
  semiExportValue: number; // USD bn
  semiExportYoY: number;
  memoryChip: number; // DRAM+NAND
  systemChip: number;
  semiShareOfTotal: number; // % of total exports
  byDestination: { dest: string; value: number; yoy: number }[];
  drameXchange: number; // DDR5 16Gb spot price
  nandPrice: number;
  semiLeadingIndicator: 'upswing_started' | 'semiconductor_super_cycle' | 'peaking' | 'downturn' | 'bottoming';
  forecastNextQuarter: number; // YoY %
}

export interface KRForeignBondIndicator {
  date: string;
  foreignBondHoldings: number; // KRW trillion
  foreignBondNet: number; // change
  foreignShare: number; // % of total outstanding
  ktb3yYield: number; ktb10yYield: number;
  carryTradeMetric: number; // spread vs US 3y (bp)
  foreignEquityHoldings: number; // KRW trillion
  signal: 'bond_inflow' | 'bond_outflow' | 'equity_rotation' | 'stay';
}

export interface KRConsumerIndicator {
  date: string;
  ccsIndex: number; // Consumer Composite Sentiment (100=neutral)
  ccsChange: number;
  currentLiving: number; futureLiving: number;
  currentEconomy: number; futureEconomy: number;
  spendingPlan: number;
  housingPriceExpectation: number;
  inflationExpectation: number;
  signal: 'optimistic' | 'neutral' | 'pessimistic';
}

// ═══════ 🇹🇼 台湾 3指标 ═══════

export interface TWExportOrderIndicator {
  date: string;
  exportOrders: number; // USD bn
  exportOrdersYoY: number;
  electronicsOrders: number;
  infoCommOrders: number;
  opticalPrecision: number;
  byRegion: { region: string; value: number; yoy: number }[];
  leadingMonthPMI: number; // 2-month lead on actual exports
  signal: 'strong_growth' | 'moderate' | 'contraction';
}

export interface TWElectronicsIndicator {
  date: string;
  electronicComponentOutput: number; // TWD bn index
  semiconductorOutput: number;
  foundryUtilization: number; // % — TSMC capacity utilization proxy
  panelOutput: number;
  pcbOutput: number;
  electronicExportShare: number; // % of total exports
  globalElectronicsDemandIndex: number; // MLCC/Korean exports/US PMI composite
}

export interface TWM1BIndicator {
  date: string;
  m1bSupply: number; // TWD trillion
  m1bYoY: number;
  m2Supply: number;
  m2YoY: number;
  m1bM2Gap: number; // M1B-M2 growth gap → "golden cross" indicator
  goldenCross: boolean; // M1B growth > M2 growth → bullish signal
  speedOfMoney: number; // GDP / M2
  totalDeposits: number;
  timeDeposits: number;
  signal: 'golden_cross' | 'death_cross' | 'narrowing';
}

// ═══════ 🇪🇺 欧盟 4指标 ═══════

export interface EUPMIIndicator {
  date: string;
  compositePMI: number; mfgPMI: number; servicesPMI: number;
  byCountry: { country: string; composite: number; mfg: number; services: number }[];
  mfgOutput: number; mfgNewOrders: number;
  servicesNewBusiness: number;
  employmentComposite: number;
  inputPrices: number; outputPrices: number;
  signal: 'expansion_broad' | 'expansion_uneven' | 'stagnation' | 'contraction';
  recessionProbability: number; // 0-100% based on PMI level
}

export interface EUZEWIndicator {
  date: string;
  zewIndex: number; // ZEW Economic Sentiment (Germany, 0=neutral)
  zewCurrentSituation: number;
  zewExpectations: number;
  zewEurozone: number;
  zewChange: number;
  sixMonthOutlook: 'strongly_positive' | 'positive' | 'neutral' | 'negative' | 'strongly_negative';
  surveyPeriod: string;
}

export interface EUInflationExpectIndicator {
  date: string;
  cpiHeadline: number; cpiCore: number;
  ecbTarget: number; // 2%
  fiveYear5ySwap: number; // 5y5y inflation swap (key ECB metric)
  marketImpliedInf: number; // 1y, 3y, 5y swap rates
  breakevenInf: { oneY: number; threeY: number; fiveY: number };
  ecbNextAction: 'hike' | 'hold' | 'cut';
  nextMeetingProbabilities: { hike: number; hold: number; cut: number };
}

export interface EUBankLendingIndicator {
  date: string;
  bankLendingTightening: number; // net % banks tightening standards
  corporateLendingGrowth: number; // YoY %
  householdLendingGrowth: number;
  mortgageLendingGrowth: number;
  nplRatio: number; // Non-Performing Loan ratio
  tier1CapitalRatio: number;
  creditImpulse: number; // change of flow of credit / GDP
  signal: 'credit_expansion' | 'credit_normal' | 'credit_crunch';
}

// ═══════ 🇸🇦 沙特 3指标 ═══════

export interface SAOilIndicator {
  date: string;
  brentPrice: number;
  opecPlusQuota: number; // mb/d for Saudi
  saProduction: number; // mb/d actual
  complianceRate: number; // % of quota
  oilRevenue: number; // SAR bn, monthly
  fiscalBreakeven: number; // oil price needed to balance budget
  surplusRatio: number; // actual oil price / breakeven - 1
  signal: 'fiscal_surplus' | 'fiscal_balanced' | 'fiscal_deficit';
}

export interface SAForexIndicator {
  date: string;
  forexReserves: number; // USD bn
  sdrComponent: number;
  goldComponent: number;
  importCover: number; // months
  sarPegHealth: number; // 0-100: pressure on SAR/USD 3.75 peg
  forwardPoints: number; // USD/SAR 12m forward points
}

export interface SAPMIIndicator {
  date: string;
  pmi: number; newOrders: number; output: number; employment: number;
  nonOilPMI: number; // Non-oil private sector
  nonOilOutput: number;
  supplyDeliveries: number;
  purchasePrices: number;
  futureOutputExpectation: number;
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class KR_TW_EU_SA_13Engine {
  // KR
  private semi: KRSemiExportIndicator[] = [];
  private krBond: KRForeignBondIndicator[] = [];
  private consumer: KRConsumerIndicator[] = [];
  // TW
  private exportOrder: TWExportOrderIndicator[] = [];
  private electronics: TWElectronicsIndicator[] = [];
  private m1b: TWM1BIndicator[] = [];
  // EU
  private euPmi: EUPMIIndicator[] = [];
  private zew: EUZEWIndicator[] = [];
  private euInf: EUInflationExpectIndicator[] = [];
  private bankLend: EUBankLendingIndicator[] = [];
  // SA
  private oil: SAOilIndicator[] = [];
  private saForex: SAForexIndicator[] = [];
  private saPmi: SAPMIIndicator[] = [];

  reset(): void {
    this.semi = []; this.krBond = []; this.consumer = [];
    this.exportOrder = []; this.electronics = []; this.m1b = [];
    this.euPmi = []; this.zew = []; this.euInf = []; this.bankLend = [];
    this.oil = []; this.saForex = []; this.saPmi = [];
  }

  // ═══════ KR-1 半导体出口 ═══════
  loadSemi(d: KRSemiExportIndicator[]): number { this.semi.push(...d); return d.length; }
  getLatestSemi(): KRSemiExportIndicator | null { return this.semi[this.semi.length - 1] || null; }
  analyzeSemi(): { export: number; yoy: number; cycle: string; memoryShare: number } {
    const s = this.getLatestSemi(); if (!s) return { export: 0, yoy: 0, cycle: 'N/A', memoryShare: 0 };
    return { export: s.semiExportValue, yoy: s.semiExportYoY, cycle: s.semiLeadingIndicator, memoryShare: s.semiShareOfTotal };
  }

  // ═══════ KR-2 外国债券持有 ═══════
  loadKRBond(d: KRForeignBondIndicator[]): number { this.krBond.push(...d); return d.length; }
  getLatestKRBond(): KRForeignBondIndicator | null { return this.krBond[this.krBond.length - 1] || null; }
  analyzeKRBond(): { holdings: number; carry: number; signal: string; equityVsBond: string } {
    const b = this.getLatestKRBond(); if (!b) return { holdings: 0, carry: 0, signal: 'N/A', equityVsBond: 'N/A' };
    return { holdings: b.foreignBondHoldings, carry: b.carryTradeMetric, signal: b.signal, equityVsBond: b.foreignBondNet > 0 ? 'BOND_INFLOW' : 'EQUITY_PREFERRED' };
  }

  // ═══════ KR-3 消费者信心 ═══════
  loadConsumer(d: KRConsumerIndicator[]): number { this.consumer.push(...d); return d.length; }
  getLatestConsumer(): KRConsumerIndicator | null { return this.consumer[this.consumer.length - 1] || null; }
  analyzeConsumer(): { ccs: number; inflation: number; signal: string } {
    const c = this.getLatestConsumer(); if (!c) return { ccs: 0, inflation: 0, signal: 'N/A' };
    return { ccs: c.ccsIndex, inflation: c.inflationExpectation, signal: c.signal };
  }

  // ═══════ TW-1 外销订单 ═══════
  loadExportOrder(d: TWExportOrderIndicator[]): number { this.exportOrder.push(...d); return d.length; }
  getLatestExportOrder(): TWExportOrderIndicator | null { return this.exportOrder[this.exportOrder.length - 1] || null; }
  analyzeExportOrder(): { orders: number; yoy: number; signal: string; leadingPMI: number } {
    const e = this.getLatestExportOrder(); if (!e) return { orders: 0, yoy: 0, signal: 'N/A', leadingPMI: 0 };
    return { orders: e.exportOrders, yoy: e.exportOrdersYoY, signal: e.signal, leadingPMI: e.leadingMonthPMI };
  }

  // ═══════ TW-2 电子零组件 ═══════
  loadElectronics(d: TWElectronicsIndicator[]): number { this.electronics.push(...d); return d.length; }
  getLatestElectronics(): TWElectronicsIndicator | null { return this.electronics[this.electronics.length - 1] || null; }
  analyzeElectronics(): { output: number; foundryUtil: number; share: number; globalDemand: number } {
    const e = this.getLatestElectronics(); if (!e) return { output: 0, foundryUtil: 0, share: 0, globalDemand: 0 };
    return { output: e.electronicComponentOutput, foundryUtil: e.foundryUtilization, share: e.electronicExportShare, globalDemand: e.globalElectronicsDemandIndex };
  }

  // ═══════ TW-3 M1B ═══════
  loadM1B(d: TWM1BIndicator[]): number { this.m1b.push(...d); return d.length; }
  getLatestM1B(): TWM1BIndicator | null { return this.m1b[this.m1b.length - 1] || null; }
  analyzeM1B(): { m1bYoY: number; m2YoY: number; goldenCross: boolean; signal: string } {
    const m = this.getLatestM1B(); if (!m) return { m1bYoY: 0, m2YoY: 0, goldenCross: false, signal: 'N/A' };
    return { m1bYoY: m.m1bYoY, m2YoY: m.m2YoY, goldenCross: m.goldenCross, signal: m.signal };
  }

  // ═══════ EU-1 PMI ═══════
  loadEUPMI(d: EUPMIIndicator[]): number { this.euPmi.push(...d); return d.length; }
  getLatestEUPMI(): EUPMIIndicator | null { return this.euPmi[this.euPmi.length - 1] || null; }
  analyzeEUPMI(): { composite: number; signal: string; recessionProb: number; best: string; worst: string } {
    const p = this.getLatestEUPMI(); if (!p) return { composite: 0, signal: 'N/A', recessionProb: 0, best: '-', worst: '-' };
    const sorted = [...p.byCountry].sort((a, b) => b.composite - a.composite);
    return { composite: p.compositePMI, signal: p.signal, recessionProb: p.recessionProbability, best: sorted[0]?.country || '-', worst: sorted[sorted.length - 1]?.country || '-' };
  }

  // ═══════ EU-2 ZEW ═══════
  loadZEW(d: EUZEWIndicator[]): number { this.zew.push(...d); return d.length; }
  getLatestZEW(): EUZEWIndicator | null { return this.zew[this.zew.length - 1] || null; }
  analyzeZEW(): { index: number; outlook: string; current: number; expectations: number } {
    const z = this.getLatestZEW(); if (!z) return { index: 0, outlook: 'N/A', current: 0, expectations: 0 };
    return { index: z.zewIndex, outlook: z.sixMonthOutlook, current: z.zewCurrentSituation, expectations: z.zewExpectations };
  }

  // ═══════ EU-3 通胀预期 ═══════
  loadEUInf(d: EUInflationExpectIndicator[]): number { this.euInf.push(...d); return d.length; }
  getLatestEUInf(): EUInflationExpectIndicator | null { return this.euInf[this.euInf.length - 1] || null; }
  analyzeEUInf(): { headline: number; core: number; fiveY5Y: number; ecbAction: string } {
    const i = this.getLatestEUInf(); if (!i) return { headline: 0, core: 0, fiveY5Y: 0, ecbAction: 'N/A' };
    return { headline: i.cpiHeadline, core: i.cpiCore, fiveY5Y: i.fiveYear5ySwap, ecbAction: i.ecbNextAction };
  }

  // ═══════ EU-4 银行信贷 ═══════
  loadBankLend(d: EUBankLendingIndicator[]): number { this.bankLend.push(...d); return d.length; }
  getLatestBankLend(): EUBankLendingIndicator | null { return this.bankLend[this.bankLend.length - 1] || null; }
  analyzeBankLend(): { signal: string; corporate: number; npl: number; tier1: number; creditImpulse: number } {
    const b = this.getLatestBankLend(); if (!b) return { signal: 'N/A', corporate: 0, npl: 0, tier1: 0, creditImpulse: 0 };
    return { signal: b.signal, corporate: b.corporateLendingGrowth, npl: b.nplRatio, tier1: b.tier1CapitalRatio, creditImpulse: b.creditImpulse };
  }

  // ═══════ SA-1 油价 ═══════
  loadOil(d: SAOilIndicator[]): number { this.oil.push(...d); return d.length; }
  getLatestOil(): SAOilIndicator | null { return this.oil[this.oil.length - 1] || null; }
  analyzeOil(): { brent: number; production: number; surplus: number; signal: string } {
    const o = this.getLatestOil(); if (!o) return { brent: 0, production: 0, surplus: 0, signal: 'N/A' };
    return { brent: o.brentPrice, production: o.saProduction, surplus: o.surplusRatio, signal: o.signal };
  }

  // ═══════ SA-2 外汇储备 ═══════
  loadSAForex(d: SAForexIndicator[]): number { this.saForex.push(...d); return d.length; }
  getLatestSAForex(): SAForexIndicator | null { return this.saForex[this.saForex.length - 1] || null; }
  analyzeSAForex(): { reserves: number; pegHealth: number; importCover: number; pegPressure: string } {
    const f = this.getLatestSAForex(); if (!f) return { reserves: 0, pegHealth: 0, importCover: 0, pegPressure: 'N/A' };
    return { reserves: f.forexReserves, pegHealth: f.sarPegHealth, importCover: f.importCover, pegPressure: f.sarPegHealth > 80 ? 'SAFE' : f.sarPegHealth > 50 ? 'MODERATE' : 'SPECULATIVE_PRESSURE' };
  }

  // ═══════ SA-3 PMI ═══════
  loadSAPMI(d: SAPMIIndicator[]): number { this.saPmi.push(...d); return d.length; }
  getLatestSAPMI(): SAPMIIndicator | null { return this.saPmi[this.saPmi.length - 1] || null; }
  analyzeSAPMI(): { pmi: number; nonOil: number; employment: number; future: number } {
    const p = this.getLatestSAPMI(); if (!p) return { pmi: 0, nonOil: 0, employment: 0, future: 0 };
    return { pmi: p.pmi, nonOil: p.nonOilPMI, employment: p.employment, future: p.futureOutputExpectation };
  }

  // ═══════ Dashboard ═══════

  getKR_Dashboard(): { semi: string; bond: string; consumer: string } {
    return { semi: this.analyzeSemi().cycle, bond: this.analyzeKRBond().signal, consumer: this.analyzeConsumer().signal };
  }
  getTW_Dashboard(): { export: string; electronics: number; m1b: boolean } {
    return { export: this.analyzeExportOrder().signal, electronics: this.analyzeElectronics().foundryUtil, m1b: this.analyzeM1B().goldenCross };
  }
  getEU_Dashboard(): { pmi: string; zew: string; inf: string; credit: string } {
    return { pmi: this.analyzeEUPMI().signal, zew: this.analyzeZEW().outlook, inf: this.analyzeEUInf().ecbAction, credit: this.analyzeBankLend().signal };
  }
  getSA_Dashboard(): { oil: string; peg: string; pmi: number } {
    return { oil: this.analyzeOil().signal, peg: this.analyzeSAForex().pegPressure, pmi: this.analyzeSAPMI().pmi };
  }

  // ═══════ Seed ═══════

  seed(): void {
undefined' ? `  /**
   * 🚫 [R284 MockDataGuard] Production mode → seed() skipped.
   * Replace mock data with real API sources before enabling production.
   * Real sources: KR=KOSTAT/BOK, TW=MOEA, EU=Eurostat/ECB, SA=SAMA/OPEC
   */
  if (getMockDataGuard().isProduction()) {
    console.warn('[R284] seed() skipped in production mode. Use load methods with real data.');
    return;
  }
    for (let d = 30; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      // KR
      this.semi.push({ date, semiExportValue: 10 + Math.random() * 3, semiExportYoY: 20 + Math.random() * 30, memoryChip: 6 + Math.random() * 2, systemChip: 3 + Math.random() * 1, semiShareOfTotal: 20 + Math.random() * 5, byDestination: [{ dest: 'China', value: 2.5, yoy: 10 + Math.random() * 15 }, { dest: 'US', value: 1.5, yoy: 5 + Math.random() * 20 }], drameXchange: 2 + Math.random() * 0.5, nandPrice: 4 + Math.random(), semiLeadingIndicator: 'upswing_started', forecastNextQuarter: 20 + Math.random() * 20 });
      this.krBond.push({ date, foreignBondHoldings: 250 + Math.random() * 20, foreignBondNet: -1 + Math.random() * 3, foreignShare: 30 + Math.random() * 5, ktb3yYield: 3.2 + Math.random() * 0.5, ktb10yYield: 3.6 + Math.random() * 0.4, carryTradeMetric: 120 + Math.random() * 40, foreignEquityHoldings: 700 + Math.random() * 50, signal: Math.random() > 0.5 ? 'bond_inflow' : 'stay' });
      this.consumer.push({ date, ccsIndex: 98 + Math.random() * 8, ccsChange: (Math.random() - 0.5) * 4, currentLiving: 90 + Math.random() * 10, futureLiving: 95 + Math.random() * 10, currentEconomy: 70 + Math.random() * 15, futureEconomy: 80 + Math.random() * 15, spendingPlan: 100 + Math.random() * 10, housingPriceExpectation: 110 + Math.random() * 15, inflationExpectation: 3 + Math.random() * 1, signal: Math.random() > 0.5 ? 'neutral' : 'optimistic' });
      // TW
      this.exportOrder.push({ date, exportOrders: 45 + Math.random() * 8, exportOrdersYoY: 5 + Math.random() * 15, electronicsOrders: 30 + Math.random() * 5, infoCommOrders: 12 + Math.random() * 3, opticalPrecision: 2 + Math.random() * 1, byRegion: [{ region: 'US', value: 18, yoy: 10 + Math.random() * 10 }, { region: 'China', value: 15, yoy: 3 + Math.random() * 10 }], leadingMonthPMI: 55 + Math.random() * 5, signal: 'strong_growth' });
      this.electronics.push({ date, electronicComponentOutput: 350 + Math.random() * 50, semiconductorOutput: 200 + Math.random() * 40, foundryUtilization: 75 + Math.random() * 15, panelOutput: 30 + Math.random() * 10, pcbOutput: 20 + Math.random() * 5, electronicExportShare: 38 + Math.random() * 5, globalElectronicsDemandIndex: 55 + Math.random() * 10 });
      this.m1b.push({ date, m1bSupply: 28 + Math.random() * 2, m1bYoY: 3 + Math.random() * 5, m2Supply: 60 + Math.random() * 3, m2YoY: 5 + Math.random() * 4, m1bM2Gap: -1 + Math.random() * 3, goldenCross: Math.random() > 0.4, speedOfMoney: 1.5 + Math.random() * 0.2, totalDeposits: 55 + Math.random() * 5, timeDeposits: 30 + Math.random() * 5, signal: Math.random() > 0.5 ? 'golden_cross' : 'narrowing' });
      // EU
      this.euPmi.push({ date, compositePMI: 48 + Math.random() * 4, mfgPMI: 46 + Math.random() * 4, servicesPMI: 49 + Math.random() * 4, byCountry: [{ country: 'Germany', composite: 46 + Math.random() * 4, mfg: 44 + Math.random() * 4, services: 48 + Math.random() * 4 }, { country: 'France', composite: 49 + Math.random() * 4, mfg: 47 + Math.random() * 4, services: 50 + Math.random() * 4 }, { country: 'Spain', composite: 53 + Math.random() * 4, mfg: 50 + Math.random() * 4, services: 54 + Math.random() * 4 }], mfgOutput: 45 + Math.random() * 5, mfgNewOrders: 44 + Math.random() * 5, servicesNewBusiness: 48 + Math.random() * 5, employmentComposite: 49 + Math.random() * 3, inputPrices: 55 + Math.random() * 5, outputPrices: 51 + Math.random() * 4, signal: 'expansion_uneven', recessionProbability: 25 + Math.random() * 20 });
      this.zew.push({ date, zewIndex: -10 + Math.random() * 30, zewCurrentSituation: -50 + Math.random() * 20, zewExpectations: 10 + Math.random() * 30, zewEurozone: -5 + Math.random() * 25, zewChange: (Math.random() - 0.5) * 10, sixMonthOutlook: Math.random() > 0.5 ? 'positive' : 'neutral', surveyPeriod: 'monthly' });
      this.euInf.push({ date, cpiHeadline: 2.2 + Math.random() * 0.8, cpiCore: 2.5 + Math.random() * 0.5, ecbTarget: 2, fiveYear5ySwap: 2.1 + Math.random() * 0.3, marketImpliedInf: 2 + Math.random() * 0.5, breakevenInf: { oneY: 1.8 + Math.random() * 0.5, threeY: 2 + Math.random() * 0.4, fiveY: 2.1 + Math.random() * 0.3 }, ecbNextAction: 'cut', nextMeetingProbabilities: { hike: 5, hold: 15, cut: 80 } });
      this.bankLend.push({ date, bankLendingTightening: 5 + Math.random() * 20, corporateLendingGrowth: 1 + Math.random() * 2, householdLendingGrowth: 0.5 + Math.random() * 1.5, mortgageLendingGrowth: 2 + Math.random() * 2, nplRatio: 2 + Math.random() * 1, tier1CapitalRatio: 15 + Math.random() * 2, creditImpulse: 0.5 + (Math.random() - 0.5) * 2, signal: 'credit_normal' });
      // SA
      this.oil.push({ date, brentPrice: 70 + Math.random() * 10, opecPlusQuota: 10 + Math.random() * 1.5, saProduction: 9 + Math.random() * 2, complianceRate: 90 + Math.random() * 10, oilRevenue: 80 + Math.random() * 20, fiscalBreakeven: 75 + Math.random() * 5, surplusRatio: (Math.random() - 0.3) * 10, signal: Math.random() > 0.5 ? 'fiscal_balanced' : 'fiscal_surplus' });
      this.saForex.push({ date, forexReserves: 450 + Math.random() * 30, sdrComponent: 10 + Math.random() * 3, goldComponent: 3 + Math.random() * 1, importCover: 15 + Math.random() * 5, sarPegHealth: 80 + Math.random() * 20, forwardPoints: -20 + Math.random() * 20 });
      this.saPmi.push({ date, pmi: 56 + Math.random() * 5, newOrders: 58 + Math.random() * 6, output: 57 + Math.random() * 5, employment: 51 + Math.random() * 4, nonOilPMI: 55 + Math.random() * 5, nonOilOutput: 56 + Math.random() * 5, supplyDeliveries: 51 + Math.random() * 3, purchasePrices: 53 + Math.random() * 5, futureOutputExpectation: 65 + Math.random() * 10 });
    }
  }
}

// ═══════ Singleton ═══════

let ktesInstance: KR_TW_EU_SA_13Engine | null = null;
export function getKR_TW_EU_SA_13Engine(): KR_TW_EU_SA_13Engine {
  if (!ktesInstance) ktesInstance = new KR_TW_EU_SA_13Engine();
  return ktesInstance;
}
export function resetKR_TW_EU_SA_13Engine(): void { ktesInstance = null; }
