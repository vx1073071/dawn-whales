// ── R275 JVS-1 🇯🇵🇮🇳🇧🇷 13指标引擎 (JP_IN_BR_13Engine) ──
// JP: 6指标 (日银短观/信托/输出入/PER/Topix方向性/PB)
// IN: 4指标 (GST/IIP/外汇储备/CPI)
// BR: 3指标 (Selic/PMI/外资证券流)

// ═══════ 🇯🇵 日本 6指标 ═══════

export interface JPTankanIndicator {
  date: string;
  largeMfgIndex: number; // 大企业制造业判断DI (-50 to 50)
  largeNonMfgIndex: number; // 大企业非制造业DI
  smallMfgIndex: number; // 中小企业制造业
  smallNonMfgIndex: number;
  outlookMfg: number; // 前景预测
  outlookNonMfg: number;
  allIndustryIndex: number; // 全产业加权
  signal: 'expansion' | 'contraction' | 'flat';
}

export interface JPTrustIndicator {
  date: string;
  trustBankNetBuy: number; // 信托银行净买入, JPY 亿
  foreignNetBuy: number; // 外国人净买入
  individualNetBuy: number; // 个人净买入
  businessCorpNetBuy: number; // 事业法人净买入
  trustSentiment: 'buying' | 'selling' | 'neutral';
  consecutiveTrustBuy: number;
  consecutiveForeignBuy: number;
}

export interface JPExportIndicator {
  date: string;
  exportValue: number; // JPY 兆
  importValue: number;
  tradeBalance: number;
  exportYoY: number; // % change YoY
  importYoY: number;
  exportByRegion: { region: string; value: number; yoy: number; share: number }[];
  keyExports: { item: string; value: number; yoy: number }[];
  yenSensitivity: number; // how much export changes per 1% JPY move
}

export interface JPPERIndicator {
  date: string;
  nikkeiPER: number; // Nikkei 225 trailing PER
  nikkeiForwardPER: number;
  topixPER: number; // TOPIX PER
  jasdaqPER: number;
  historicalPER: { p10: number; p25: number; p50: number; p75: number; p90: number };
  perZScore: number; // where current PER is in historical distribution
  signal: 'overvalued' | 'fair' | 'undervalued';
}

export interface JPTopixDirectionIndicator {
  date: string;
  topixValue: number; topixChange: number;
  sectorBreadth: number; // % sectors advancing
  netAdvances: number; // advancing minus declining
  volumeRatio: number; // vs 25d avg
  marginBuyBalance: number; // 信用买入残
  marginSellBalance: number; // 信用売り残
  marginRatio: number; // buy/sell ratio
}

export interface JPPBIndicator {
  date: string;
  nikkeiPB: number; // Price/Book
  topixPB: number;
  mothersPB: number; // TSE Mothers PB
  historicalPB: { p10: number; p25: number; p50: number; p75: number; p90: number };
  pbZScore: number;
  signal: 'deep_value' | 'value' | 'fair' | 'expensive';
  stocksBelowBook: number; // number of stocks trading below book
  stocksBelowBookPercent: number;
}

// ═══════ 🇮🇳 印度 4指标 ═══════

export interface INGSTIndicator {
  date: string;
  gstCollection: number; // ₹ lakh crore (1 lakh crore = 1 trillion)
  gstYoY: number; // % growth YoY
  ewayBills: number; // e-way bill generation (crore)
  gstBuoyancy: number; // GST growth / nominal GDP growth
  signal: 'accelerating' | 'stable' | 'decelerating';
  fiscalHealth: 'strong' | 'moderate' | 'weak';
}

export interface INIIPIndicator {
  date: string;
  iip: number; // Index of Industrial Production (2011-12=100)
  iipYoY: number;
  manufacturing: number; mining: number; electricity: number;
  coreSectorYoY: number; // 8 core industries
  useBased: { basic: number; capital: number; intermediate: number; infra: number; consumerDurable: number; consumerNonDurable: number };
  signal: 'expansion' | 'moderation' | 'contraction';
}

export interface INForexIndicator {
  date: string;
  forexReserves: number; // USD billion
  forexChange: number; // weekly change, USD bn
  importCover: number; // months of imports covered
  shortTermDebtRatio: number; // % of reserves
  fcaComponent: number; // Foreign Currency Assets
  goldComponent: number; SDRComponent: number;
  adequacyScore: number; // 0-100 composite
  signal: 'strong_buffer' | 'adequate' | 'tight' | 'critical';
}

export interface INCPIIndicator {
  date: string;
  cpiHeadline: number; // YoY %
  cpiCore: number; // excluding food/fuel
  foodInflation: number; fuelInflation: number;
  urbanCPI: number; ruralCPI: number;
  rbiTargetBand: { lower: number; upper: number; target: number };
  withinBand: boolean;
  rbiExpectedAction: 'hike' | 'hold' | 'cut' | 'uncertain';
  realRate: number; // repo rate - CPI = real interest rate
}

// ═══════ 🇧🇷 巴西 3指标 ═══════

export interface BRSelicIndicator {
  date: string;
  selicRate: number; // % per year
  selicChange: number; // bp change
  copomDecision: 'hike_100' | 'hike_50' | 'hike_25' | 'hold' | 'cut_25' | 'cut_50' | 'cut_100';
  marketExpectation: number; // Focus survey median
  nextMeetingDate: string;
  forwardGuidance: string;
  realRate: number; // Selic - IPCA12m
  neutralRate: number; // estimated neutral
  policyStance: 'tight' | 'neutral' | 'loose';
}

export interface BRPMIIndicator {
  date: string;
  mfgPMI: number; servicesPMI: number; compositePMI: number;
  mfgOutput: number; mfgNewOrders: number; mfgEmployment: number;
  servicesActivity: number; servicesNewBusiness: number;
  signal: 'expansion' | 'contraction' | 'neutral';
}

export interface BRForeignFlowIndicator {
  date: string;
  foreignEquityFlow: number; // BRL bil, net B3 flow
  foreignFixedIncomeFlow: number;
  totalForeignFlow: number;
  foreignShareB3: number; // % of B3 volume
  flowQuarterly: number;
  signal: 'strong_inflow' | 'inflow' | 'neutral' | 'outflow' | 'capital_flight';
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class JP_IN_BR_13Engine {
  // JP
  private tankan: JPTankanIndicator[] = [];
  private trust: JPTrustIndicator[] = [];
  private jpExport: JPExportIndicator[] = [];
  private per: JPPERIndicator[] = [];
  private topixDir: JPTopixDirectionIndicator[] = [];
  private pb: JPPBIndicator[] = [];
  // IN
  private gst: INGSTIndicator[] = [];
  private iip: INIIPIndicator[] = [];
  private forex: INForexIndicator[] = [];
  private cpi: INCPIIndicator[] = [];
  // BR
  private selic: BRSelicIndicator[] = [];
  private pmi: BRPMIIndicator[] = [];
  private brFlow: BRForeignFlowIndicator[] = [];

  reset(): void {
    this.tankan = []; this.trust = []; this.jpExport = []; this.per = [];
    this.topixDir = []; this.pb = []; this.gst = []; this.iip = [];
    this.forex = []; this.cpi = []; this.selic = []; this.pmi = []; this.brFlow = [];
  }

  // ═══════ JP-1 日银短观 ═══════
  loadTankan(d: JPTankanIndicator[]): number { this.tankan.push(...d); return d.length; }
  getLatestTankan(): JPTankanIndicator | null { return this.tankan[this.tankan.length - 1] || null; }
  analyzeTankan(): { allIndustry: number; signal: string; direction: string; outlookVsCurrent: number } {
    const t = this.getLatestTankan(); if (!t) return { allIndustry: 0, signal: 'flat', direction: 'N/A', outlookVsCurrent: 0 };
    return { allIndustry: t.allIndustryIndex, signal: t.signal, direction: t.allIndustryIndex > 0 ? 'EXPANDING' : 'CONTRACTING', outlookVsCurrent: t.outlookMfg - t.largeMfgIndex };
  }

  // ═══════ JP-2 投资信托 ═══════
  loadTrust(d: JPTrustIndicator[]): number { this.trust.push(...d); return d.length; }
  getLatestTrust(): JPTrustIndicator | null { return this.trust[this.trust.length - 1] || null; }
  analyzeTrust(): { trustNet: number; foreignNet: number; netFlow: number; signal: string } {
    const t = this.getLatestTrust(); if (!t) return { trustNet: 0, foreignNet: 0, netFlow: 0, signal: 'N/A' };
    const netFlow = t.trustBankNetBuy + t.foreignNetBuy;
    return { trustNet: t.trustBankNetBuy, foreignNet: t.foreignNetBuy, netFlow, signal: netFlow > 6000 ? 'STRONG_BUY' : netFlow > 1000 ? 'BUYING' : netFlow < -6000 ? 'STRONG_SELL' : netFlow < -1000 ? 'SELLING' : 'NEUTRAL' };
  }

  // ═══════ JP-3 输出入 ═══════
  loadJPExport(d: JPExportIndicator[]): number { this.jpExport.push(...d); return d.length; }
  getLatestJPExport(): JPExportIndicator | null { return this.jpExport[this.jpExport.length - 1] || null; }
  analyzeTradeBalance(): { balance: number; exportYoY: number; importYoY: number; yenImpact: string; keyExportItem: string } {
    const e = this.getLatestJPExport(); if (!e) return { balance: 0, exportYoY: 0, importYoY: 0, yenImpact: 'N/A', keyExportItem: '-' };
    return { balance: e.tradeBalance, exportYoY: e.exportYoY, importYoY: e.importYoY, yenImpact: e.yenSensitivity > 1 ? 'HIGH_SENSITIVITY' : 'MODERATE', keyExportItem: e.keyExports[0]?.item || '-' };
  }

  // ═══════ JP-4 PER ═══════
  loadPER(d: JPPERIndicator[]): number { this.per.push(...d); return d.length; }
  getLatestPER(): JPPERIndicator | null { return this.per[this.per.length - 1] || null; }
  analyzePER(): { nikkeiPER: number; zScore: number; signal: string; vsMedian: number } {
    const p = this.getLatestPER(); if (!p) return { nikkeiPER: 0, zScore: 0, signal: 'fair', vsMedian: 0 };
    return { nikkeiPER: p.nikkeiPER, zScore: Number(p.perZScore.toFixed(2)), signal: p.signal, vsMedian: Number((p.nikkeiPER - p.historicalPER.p50).toFixed(1)) };
  }

  // ═══════ JP-5 Topix方向 ═══════
  loadTopixDir(d: JPTopixDirectionIndicator[]): number { this.topixDir.push(...d); return d.length; }
  getLatestTopixDir(): JPTopixDirectionIndicator | null { return this.topixDir[this.topixDir.length - 1] || null; }
  analyzeMarginBuySell(): { marginRatio: number; buyBalance: number; sellBalance: number; signal: string } {
    const t = this.getLatestTopixDir(); if (!t) return { marginRatio: 1, buyBalance: 0, sellBalance: 0, signal: 'N/A' };
    return { marginRatio: t.marginRatio, buyBalance: t.marginBuyBalance, sellBalance: t.marginSellBalance, signal: t.marginRatio > 3 ? 'OVER_BOUGHT_MARGIN' : t.marginRatio < 1.5 ? 'OVER_SOLD_MARGIN' : 'NORMAL' };
  }

  // ═══════ JP-6 PB ═══════
  loadPB(d: JPPBIndicator[]): number { this.pb.push(...d); return d.length; }
  getLatestPB(): JPPBIndicator | null { return this.pb[this.pb.length - 1] || null; }
  analyzePB(): { topixPB: number; zScore: number; signal: string; belowBook: number } {
    const p = this.getLatestPB(); if (!p) return { topixPB: 0, zScore: 0, signal: 'fair', belowBook: 0 };
    return { topixPB: p.topixPB, zScore: Number(p.pbZScore.toFixed(2)), signal: p.signal, belowBook: p.stocksBelowBookPercent };
  }

  // ═══════ IN-1 GST ═══════
  loadGST(d: INGSTIndicator[]): number { this.gst.push(...d); return d.length; }
  getLatestGST(): INGSTIndicator | null { return this.gst[this.gst.length - 1] || null; }
  analyzeGST(): { collection: number; yoy: number; buoyancy: number; fiscalHealth: string } {
    const g = this.getLatestGST(); if (!g) return { collection: 0, yoy: 0, buoyancy: 0, fiscalHealth: 'N/A' };
    return { collection: g.gstCollection, yoy: g.gstYoY, buoyancy: g.gstBuoyancy, fiscalHealth: g.fiscalHealth };
  }

  // ═══════ IN-2 IIP ═══════
  loadIIP(d: INIIPIndicator[]): number { this.iip.push(...d); return d.length; }
  getLatestIIP(): INIIPIndicator | null { return this.iip[this.iip.length - 1] || null; }
  analyzeIIP(): { iip: number; yoy: number; coreYoY: number; signal: string } {
    const i = this.getLatestIIP(); if (!i) return { iip: 0, yoy: 0, coreYoY: 0, signal: 'N/A' };
    return { iip: i.iip, yoy: i.iipYoY, coreYoY: i.coreSectorYoY, signal: i.signal };
  }

  // ═══════ IN-3 外汇储备 ═══════
  loadForex(d: INForexIndicator[]): number { this.forex.push(...d); return d.length; }
  getLatestForex(): INForexIndicator | null { return this.forex[this.forex.length - 1] || null; }
  analyzeForex(): { reserves: number; importCover: number; adequacy: number; signal: string } {
    const f = this.getLatestForex(); if (!f) return { reserves: 0, importCover: 0, adequacy: 0, signal: 'N/A' };
    return { reserves: f.forexReserves, importCover: f.importCover, adequacy: f.adequacyScore, signal: f.signal };
  }

  // ═══════ IN-4 CPI ═══════
  loadCPI(d: INCPIIndicator[]): number { this.cpi.push(...d); return d.length; }
  getLatestCPI(): INCPIIndicator | null { return this.cpi[this.cpi.length - 1] || null; }
  analyzeCPI(): { headline: number; core: number; withinBand: boolean; rbiAction: string } {
    const c = this.getLatestCPI(); if (!c) return { headline: 0, core: 0, withinBand: false, rbiAction: 'N/A' };
    return { headline: c.cpiHeadline, core: c.cpiCore, withinBand: c.withinBand, rbiAction: c.rbiExpectedAction };
  }

  // ═══════ BR-1 Selic ═══════
  loadSelic(d: BRSelicIndicator[]): number { this.selic.push(...d); return d.length; }
  getLatestSelic(): BRSelicIndicator | null { return this.selic[this.selic.length - 1] || null; }
  analyzeSelic(): { rate: number; realRate: number; policyStance: string; decision: string } {
    const s = this.getLatestSelic(); if (!s) return { rate: 0, realRate: 0, policyStance: 'N/A', decision: 'N/A' };
    return { rate: s.selicRate, realRate: s.realRate, policyStance: s.policyStance, decision: s.copomDecision };
  }

  // ═══════ BR-2 PMI ═══════
  loadPMI(d: BRPMIIndicator[]): number { this.pmi.push(...d); return d.length; }
  getLatestPMI(): BRPMIIndicator | null { return this.pmi[this.pmi.length - 1] || null; }
  analyzePMI(): { composite: number; mfg: number; services: number; signal: string } {
    const p = this.getLatestPMI(); if (!p) return { composite: 0, mfg: 0, services: 0, signal: 'N/A' };
    return { composite: p.compositePMI, mfg: p.mfgPMI, services: p.servicesPMI, signal: p.signal };
  }

  // ═══════ BR-3 外资证券流 ═══════
  loadBRFlow(d: BRForeignFlowIndicator[]): number { this.brFlow.push(...d); return d.length; }
  getLatestBRFlow(): BRForeignFlowIndicator | null { return this.brFlow[this.brFlow.length - 1] || null; }
  analyzeBRFlow(): { totalFlow: number; equityFlow: number; fiFlow: number; signal: string } {
    const f = this.getLatestBRFlow(); if (!f) return { totalFlow: 0, equityFlow: 0, fiFlow: 0, signal: 'N/A' };
    return { totalFlow: f.totalForeignFlow, equityFlow: f.foreignEquityFlow, fiFlow: f.foreignFixedIncomeFlow, signal: f.signal };
  }

  // ═══════ 跨面板 ═══════

  getJP_Dashboard(): { tankan: number; trust: string; trade: number; per: string; margin: string; pb: string } {
    return { tankan: this.analyzeTankan().allIndustry, trust: this.analyzeTrust().signal, trade: this.analyzeTradeBalance().balance, per: this.analyzePER().signal, margin: this.analyzeMarginBuySell().signal, pb: this.analyzePB().signal };
  }

  getIN_Dashboard(): { gst: string; iip: string; forex: string; cpi: string } {
    return { gst: this.analyzeGST().fiscalHealth, iip: this.analyzeIIP().signal, forex: this.analyzeForex().signal, cpi: this.analyzeCPI().rbiAction };
  }

  getBR_Dashboard(): { selic: string; pmi: string; flow: string } {
    return { selic: this.analyzeSelic().policyStance, pmi: this.analyzePMI().signal, flow: this.analyzeBRFlow().signal };
  }

  // ═══════ Seed ═══════

  seed(): void {
    for (let d = 30; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      // JP
      this.tankan.push({ date, largeMfgIndex: 5 + (Math.random() - 0.5) * 10, largeNonMfgIndex: 18 + (Math.random() - 0.5) * 8, smallMfgIndex: -5 + (Math.random() - 0.5) * 15, smallNonMfgIndex: 5 + (Math.random() - 0.5) * 10, outlookMfg: 3 + (Math.random() - 0.5) * 10, outlookNonMfg: 15 + (Math.random() - 0.5) * 8, allIndustryIndex: 8 + (Math.random() - 0.5) * 8, signal: Math.random() > 0.5 ? 'expansion' : 'flat' });
      this.trust.push({ date, trustBankNetBuy: 2000 + (Math.random() - 0.5) * 6000, foreignNetBuy: 1000 + (Math.random() - 0.5) * 5000, individualNetBuy: -500 + (Math.random() - 0.5) * 2000, businessCorpNetBuy: 300 + (Math.random() - 0.5) * 1500, trustSentiment: Math.random() > 0.4 ? 'buying' : 'neutral', consecutiveTrustBuy: 3 + Math.floor(Math.random() * 10), consecutiveForeignBuy: 5 + Math.floor(Math.random() * 8) });
      this.jpExport.push({ date, exportValue: 8 + Math.random() * 2, importValue: 9 + Math.random() * 2, tradeBalance: -1 + (Math.random() - 0.5) * 3, exportYoY: 2 + (Math.random() - 0.5) * 8, importYoY: -3 + (Math.random() - 0.5) * 10, yenSensitivity: 1.2, keyExports: [{ item: '半導体', value: 1.5, yoy: 5 + Math.random() * 10 }, { item: '自動車', value: 1.3, yoy: 2 + Math.random() * 8 }], exportByRegion: [{ region: 'US', value: 1.8, yoy: 3, share: 22 }, { region: 'China', value: 1.5, yoy: -2, share: 19 }, { region: 'EU', value: 0.9, yoy: 1, share: 11 }] });
      this.per.push({ date, nikkeiPER: 14 + Math.random() * 4, nikkeiForwardPER: 13 + Math.random() * 3, topixPER: 12 + Math.random() * 3, jasdaqPER: 18 + Math.random() * 5, historicalPER: { p10: 10, p25: 12, p50: 14, p75: 16, p90: 18 }, perZScore: (Math.random() - 0.5) * 2, signal: Math.random() > 0.6 ? 'fair' : Math.random() > 0.3 ? 'undervalued' : 'overvalued' });
      this.topixDir.push({ date, topixValue: 2700 + Math.random() * 200, topixChange: (Math.random() - 0.5) * 2, sectorBreadth: 40 + Math.random() * 40, netAdvances: -50 + Math.random() * 100, volumeRatio: 0.8 + Math.random() * 0.6, marginBuyBalance: 50000 + Math.random() * 10000, marginSellBalance: 20000 + Math.random() * 10000, marginRatio: 1.5 + Math.random() * 3 });
      this.pb.push({ date, nikkeiPB: 1.2 + Math.random() * 0.4, topixPB: 1.1 + Math.random() * 0.3, mothersPB: 2.5 + Math.random() * 1, historicalPB: { p10: 0.8, p25: 1.0, p50: 1.2, p75: 1.4, p90: 1.6 }, pbZScore: (Math.random() - 0.5) * 2, signal: 'fair', stocksBelowBook: 300 + Math.floor(Math.random() * 200), stocksBelowBookPercent: 8 + Math.random() * 10 });
      // IN
      this.gst.push({ date, gstCollection: 1.6 + Math.random() * 0.3, gstYoY: 8 + Math.random() * 6, ewayBills: 100 + Math.random() * 20, gstBuoyancy: 1.0 + Math.random() * 0.4, signal: Math.random() > 0.5 ? 'stable' : 'accelerating', fiscalHealth: Math.random() > 0.7 ? 'strong' : 'moderate' });
      this.iip.push({ date, iip: 135 + Math.random() * 10, iipYoY: 3 + Math.random() * 6, manufacturing: 138 + Math.random() * 12, mining: 110 + Math.random() * 15, electricity: 175 + Math.random() * 20, coreSectorYoY: 4 + Math.random() * 5, signal: Math.random() > 0.4 ? 'expansion' : 'moderation', useBased: { basic: 3, capital: 2, intermediate: 4, infra: 5, consumerDurable: 6, consumerNonDurable: 3 } });
      this.forex.push({ date, forexReserves: 620 + Math.random() * 20, forexChange: -2 + Math.random() * 4, importCover: 10 + Math.random() * 2, shortTermDebtRatio: 18 + Math.random() * 3, fcaComponent: 540 + Math.random() * 10, goldComponent: 45 + Math.random() * 5, SDRComponent: 18 + Math.random() * 2, adequacyScore: 75 + Math.random() * 15, signal: 'adequate' });
      this.cpi.push({ date, cpiHeadline: 4.5 + Math.random() * 2, cpiCore: 3.5 + Math.random() * 2, foodInflation: 5 + Math.random() * 4, fuelInflation: -2 + Math.random() * 5, urbanCPI: 4.2 + Math.random() * 2, ruralCPI: 5 + Math.random() * 2.5, rbiTargetBand: { lower: 2, upper: 6, target: 4 }, withinBand: Math.random() > 0.2, rbiExpectedAction: Math.random() > 0.7 ? 'hold' : Math.random() > 0.5 ? 'cut' : 'hike', realRate: 1.5 + Math.random() });
      // BR
      this.selic.push({ date, selicRate: 10.5 + Math.random() * 2, selicChange: Math.random() > 0.9 ? -0.5 : 0, copomDecision: 'hold', marketExpectation: 10 + Math.random() * 1.5, nextMeetingDate: '2026-07-16', forwardGuidance: 'data-dependent', realRate: 6 + Math.random() * 1, neutralRate: 4.5, policyStance: 'tight' });
      this.pmi.push({ date, mfgPMI: 50 + Math.random() * 5, servicesPMI: 51 + Math.random() * 4, compositePMI: 50.5 + Math.random() * 4, mfgOutput: 51 + Math.random() * 5, mfgNewOrders: 50 + Math.random() * 6, mfgEmployment: 49 + Math.random() * 4, servicesActivity: 52 + Math.random() * 5, servicesNewBusiness: 50 + Math.random() * 6, signal: 'expansion' });
      this.brFlow.push({ date, foreignEquityFlow: -1 + (Math.random() - 0.5) * 5, foreignFixedIncomeFlow: 2 + (Math.random() - 0.5) * 4, totalForeignFlow: 1 + (Math.random() - 0.5) * 6, foreignShareB3: 45 + Math.random() * 10, flowQuarterly: -2 + (Math.random() - 0.5) * 15, signal: 'neutral' });
    }
  }
}

// ═══════ Singleton ═══════

let jibInstance: JP_IN_BR_13Engine | null = null;
export function getJP_IN_BR_13Engine(): JP_IN_BR_13Engine {
  if (!jibInstance) jibInstance = new JP_IN_BR_13Engine();
  return jibInstance;
}
export function resetJP_IN_BR_13Engine(): void { jibInstance = null; }
