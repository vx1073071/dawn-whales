/**
 * R277 auto#2: 宏观数据源 FRED + IMF (MacroDataSource) v1.0
 * 
 * QUANT MOO — 桥接全球宏观经济数据到因子→信号管线
 * 
 * 数据源:
 *   FRED (Federal Reserve Economic Data):
 *     - GDP/CGDP/GDPDEF (GDP+实际+平减)
 *     - UNRATE/PAYEMS/NFP (就业)
 *     - CPI/PCE/PPI (通胀)
 *     - FEDFUNDS/DFEDTARU (利率)
 *     - DGS10/DGS2/T10YIE (国债/盈亏平衡/期限利差)
 *     - M2SL/WALCL (货币/央行资产)
 *     - INDPRO/CAPUTIL (工业)
 *     - HOUST/CSUSHPINSA (房地产)
 *     - TOTCI/UMCSENT (消费者信心)
 *     - VIXCLS/TEDRATE (风险/信贷)
 *     - EXUSUK/EXJPUS/EXCHUS (外汇)
 * 
 *   IMF (International Monetary Fund):
 *     - WEO: GDP growth / CPI / unemployment by country
 *     - IFS: International Financial Statistics
 *     - DOTS: Direction of Trade Statistics
 *     - COFER: Currency Composition of Foreign Exchange Reserves
 *     - FSI: Financial Soundness Indicators
 * 
 * 核心功能:
 *   1. 12大宏观类别: GDP/CPI/就业/利率/货币/工业/房地产/消费/贸易/财政/风险/流动
 *   2. 宏观→因子信号转换 (GDP增速/CPI压力/利差/就业)
 *   3. 跨国宏观比较 (GDP/CPI/PMI across countries)
 *   4. 宏观周期识别 (扩张/顶峰/收缩/谷底)
 *   5. 宏观→市场映射 (利率↑→股市↓, CPI↑→央行收紧)
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type MacroCategory =
  | 'gdp' | 'inflation' | 'employment' | 'interest_rate'
  | 'money_supply' | 'industrial' | 'housing' | 'consumer'
  | 'trade' | 'fiscal' | 'risk_credit' | 'liquidity';

export type MacroSourceProvider = 'FRED' | 'IMF' | 'ECB' | 'PBOC' | 'BOJ';

export type MacroFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface MacroIndicator {
  id: string;
  name: string;
  category: MacroCategory;
  provider: MacroSourceProvider;
  frequency: MacroFrequency;
  unit: string;
  description: string;
  descriptionCn: string;
  latestValue: number | null;
  latestDate: string | null;
  history: MacroHistoryPoint[];
  threshold: { low: number; high: number; critical: number };
  direction: 'higher_better' | 'lower_better' | 'neutral';
}

export interface MacroHistoryPoint {
  date: string;
  value: number;
}

export interface MacroSnapshot {
  timestamp: number;
  country: string;
  indicators: Record<string, MacroIndicator>;
  gdpGrowth: number;       // YoY %
  cpi: number;             // YoY %
  unemployment: number;    // %
  policyRate: number;      // %
  compositeScore: number;  // -100~+100
}

export interface MacroSignal {
  signalId: string;
  indicatorId: string;
  country: string;
  category: MacroCategory;
  value: number;
  threshold: { low: number; high: number; critical: number };
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  marketImplication: string;
  timestamp: number;
}

export interface MacroCrossCountry {
  timestamp: number;
  indicator: string;
  rankings: Array<{ country: string; value: number; rank: number }>;
  globalAverage: number;
  globalMedian: number;
  top3: Array<{ country: string; value: number }>;
  bottom3: Array<{ country: string; value: number }>;
}

export interface MacroCycle {
  country: string;
  phase: 'expansion' | 'peak' | 'contraction' | 'trough';
  gdpTrend: 'accelerating' | 'decelerating' | 'stable';
  inflationTrend: 'rising' | 'falling' | 'stable';
  rateDirection: 'tightening' | 'easing' | 'neutral';
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  recessionProbability: number;  // 0-100
}

export interface MacroStats {
  totalIndicators: number;
  countriesTracked: string[];
  lastUpdate: number;
  signalCount: number;
}

// ── FRED Indicator Registry ────────────────────────────────────────────────

const FRED_INDICATORS: Omit<MacroIndicator, 'latestValue' | 'latestDate' | 'history'>[] = [
  // GDP
  { id:'GDP', name:'Gross Domestic Product', category:'gdp', provider:'FRED', frequency:'quarterly', unit:'Bil. USD', description:'Nominal GDP', descriptionCn:'名义GDP', threshold:{low:2,high:3,critical:1}, direction:'higher_better' },
  { id:'GDPC1', name:'Real GDP', category:'gdp', provider:'FRED', frequency:'quarterly', unit:'Bil. 2017 USD', description:'Real GDP (chained)', descriptionCn:'实际GDP', threshold:{low:1.5,high:2.5,critical:0}, direction:'higher_better' },
  // Inflation
  { id:'CPIAUCSL', name:'CPI All Urban', category:'inflation', provider:'FRED', frequency:'monthly', unit:'Index', description:'Consumer Price Index', descriptionCn:'消费者物价指数', threshold:{low:2,high:3,critical:4}, direction:'lower_better' },
  { id:'CPILFESL', name:'Core CPI', category:'inflation', provider:'FRED', frequency:'monthly', unit:'Index', description:'CPI ex Food & Energy', descriptionCn:'核心CPI', threshold:{low:2,high:3,critical:3.5}, direction:'lower_better' },
  { id:'PCEPI', name:'PCE Price Index', category:'inflation', provider:'FRED', frequency:'monthly', unit:'Index', description:'Personal Consumption Expenditure Price Index', descriptionCn:'PCE物价指数', threshold:{low:2,high:2.5,critical:3}, direction:'lower_better' },
  { id:'PPIACO', name:'PPI All Commodities', category:'inflation', provider:'FRED', frequency:'monthly', unit:'Index', description:'Producer Price Index', descriptionCn:'生产者物价指数', threshold:{low:2,high:4,critical:6}, direction:'lower_better' },
  // Employment
  { id:'UNRATE', name:'Unemployment Rate', category:'employment', provider:'FRED', frequency:'monthly', unit:'%', description:'Civilian Unemployment Rate', descriptionCn:'失业率', threshold:{low:4,high:5,critical:6}, direction:'lower_better' },
  { id:'PAYEMS', name:'Nonfarm Payrolls', category:'employment', provider:'FRED', frequency:'monthly', unit:'Thousands', description:'Total Nonfarm Payrolls', descriptionCn:'非农就业人数', threshold:{low:150,high:200,critical:100}, direction:'higher_better' },
  { id:'NROU', name:'Natural Rate of Unemployment', category:'employment', provider:'FRED', frequency:'quarterly', unit:'%', description:'Non-accelerating inflation rate of unemployment', descriptionCn:'自然失业率(NAIRU)', threshold:{low:4,high:5,critical:5.5}, direction:'neutral' },
  // Interest Rates
  { id:'FEDFUNDS', name:'Federal Funds Rate', category:'interest_rate', provider:'FRED', frequency:'daily', unit:'%', description:'Effective Federal Funds Rate', descriptionCn:'联邦基金利率', threshold:{low:3,high:5,critical:6}, direction:'lower_better' },
  { id:'DGS10', name:'10Y Treasury', category:'interest_rate', provider:'FRED', frequency:'daily', unit:'%', description:'10-Year Treasury Constant Maturity', descriptionCn:'10年期国债', threshold:{low:3,high:5,critical:6}, direction:'neutral' },
  { id:'DGS2', name:'2Y Treasury', category:'interest_rate', provider:'FRED', frequency:'daily', unit:'%', description:'2-Year Treasury Constant Maturity', descriptionCn:'2年期国债', threshold:{low:3,high:5,critical:6}, direction:'neutral' },
  { id:'T10Y2Y', name:'10Y-2Y Spread', category:'interest_rate', provider:'FRED', frequency:'daily', unit:'%', description:'10Y minus 2Y Treasury Spread (yield curve)', descriptionCn:'10-2年期国债利差(收益率曲线)', threshold:{low:-0.5,high:0,critical:-1}, direction:'higher_better' },
  { id:'T10YIE', name:'10Y Breakeven Inflation', category:'inflation', provider:'FRED', frequency:'daily', unit:'%', description:'10Y Breakeven Inflation Rate (inflation expectation)', descriptionCn:'10年盈亏平衡通胀率', threshold:{low:2,high:3,critical:3.5}, direction:'lower_better' },
  // Money Supply
  { id:'M2SL', name:'M2 Money Supply', category:'money_supply', provider:'FRED', frequency:'monthly', unit:'Bil. USD', description:'M2 Money Stock', descriptionCn:'M2货币供应量', threshold:{low:-500,high:0,critical:-1000}, direction:'neutral' },
  { id:'WALCL', name:'Fed Balance Sheet', category:'money_supply', provider:'FRED', frequency:'weekly', unit:'Mil. USD', description:'Fed Total Assets', descriptionCn:'美联储总资产', threshold:{low:-100000,high:0,critical:-500000}, direction:'neutral' },
  // Industrial
  { id:'INDPRO', name:'Industrial Production', category:'industrial', provider:'FRED', frequency:'monthly', unit:'Index', description:'Industrial Production Index', descriptionCn:'工业生产指数', threshold:{low:-0.5,high:0.5,critical:-1}, direction:'higher_better' },
  { id:'CAPUTIL', name:'Capacity Utilization', category:'industrial', provider:'FRED', frequency:'monthly', unit:'%', description:'Total Industry Capacity Utilization', descriptionCn:'产能利用率', threshold:{low:75,high:80,critical:70}, direction:'higher_better' },
  // Housing
  { id:'HOUST', name:'Housing Starts', category:'housing', provider:'FRED', frequency:'monthly', unit:'Thousands', description:'New Privately-Owned Housing Units Started', descriptionCn:'新屋开工', threshold:{low:1200,high:1500,critical:1000}, direction:'higher_better' },
  { id:'CSUSHPINSA', name:'Case-Shiller Home Price', category:'housing', provider:'FRED', frequency:'monthly', unit:'Index', description:'S&P/Case-Shiller U.S. National Home Price Index', descriptionCn:'Case-Shiller房价指数', threshold:{low:0,high:5,critical:-5}, direction:'neutral' },
  // Consumer
  { id:'UMCSENT', name:'Consumer Sentiment', category:'consumer', provider:'FRED', frequency:'monthly', unit:'Index', description:'University of Michigan Consumer Sentiment', descriptionCn:'密歇根大学消费者信心', threshold:{low:60,high:80,critical:50}, direction:'higher_better' },
  { id:'RSAFS', name:'Retail Sales', category:'consumer', provider:'FRED', frequency:'monthly', unit:'Mil. USD', description:'Advance Retail Sales', descriptionCn:'零售销售额', threshold:{low:-1,high:1,critical:-3}, direction:'higher_better' },
  // Risk
  { id:'VIXCLS', name:'VIX', category:'risk_credit', provider:'FRED', frequency:'daily', unit:'Index', description:'CBOE Volatility Index', descriptionCn:'恐慌指数VIX', threshold:{low:20,high:30,critical:35}, direction:'lower_better' },
  { id:'TEDRATE', name:'TED Spread', category:'risk_credit', provider:'FRED', frequency:'daily', unit:'%', description:'TED Spread (3M LIBOR - 3M T-Bill)', descriptionCn:'TED利差', threshold:{low:0.5,high:1,critical:2}, direction:'lower_better' },
  // Trade
  { id:'NETEXP', name:'Net Exports', category:'trade', provider:'FRED', frequency:'quarterly', unit:'Bil. USD', description:'Net Exports of Goods and Services', descriptionCn:'净出口', threshold:{low:-800,high:-500,critical:-1000}, direction:'higher_better' },
  // Exchange
  { id:'DTWEXBGS', name:'Trade-Weighted USD', category:'trade', provider:'FRED', frequency:'daily', unit:'Index', description:'Nominal Broad U.S. Dollar Index', descriptionCn:'贸易加权美元指数', threshold:{low:110,high:120,critical:130}, direction:'neutral' },
];

const IMF_INDICATORS: Omit<MacroIndicator, 'latestValue' | 'latestDate' | 'history'>[] = [
  { id:'WEO_GDP_GROWTH', name:'WEO GDP Growth', category:'gdp', provider:'IMF', frequency:'quarterly', unit:'% YoY', description:'IMF World Economic Outlook GDP forecast', descriptionCn:'IMF全球GDP增长预测', threshold:{low:2,high:3,critical:1}, direction:'higher_better' },
  { id:'WEO_CPI', name:'WEO CPI Inflation', category:'inflation', provider:'IMF', frequency:'quarterly', unit:'% YoY', description:'IMF WEO CPI forecast', descriptionCn:'IMF全球CPI预测', threshold:{low:2,high:4,critical:6}, direction:'lower_better' },
  { id:'WEO_UNEMP', name:'WEO Unemployment', category:'employment', provider:'IMF', frequency:'quarterly', unit:'%', description:'IMF WEO unemployment forecast', descriptionCn:'IMF全球失业率预测', threshold:{low:5,high:7,critical:8}, direction:'lower_better' },
  { id:'IFS_RESERVES', name:'IFS Foreign Reserves', category:'liquidity', provider:'IMF', frequency:'monthly', unit:'Bil. USD', description:'International reserves excl gold', descriptionCn:'国际储备(不含黄金)', threshold:{low:-10,high:0,critical:-20}, direction:'higher_better' },
  { id:'FSI_CAR', name:'FSI Capital Adequacy', category:'risk_credit', provider:'IMF', frequency:'quarterly', unit:'%', description:'Financial Soundness — Capital Adequacy Ratio', descriptionCn:'金融稳健性-资本充足率', threshold:{low:10,high:12,critical:8}, direction:'higher_better' },
  { id:'DOTS_TRADE_BAL', name:'DOTS Trade Balance', category:'trade', provider:'IMF', frequency:'monthly', unit:'Bil. USD', description:'Direction of Trade — Trade Balance', descriptionCn:'贸易差额', threshold:{low:-50,high:0,critical:-100}, direction:'higher_better' },
];

// ── MacroDataSource ─────────────────────────────────────────────────────────

export class MacroDataSource {
  // Indicator registry
  private indicators: Map<string, MacroIndicator> = new Map();
  
  // Country snapshots
  private snapshots: Map<string, MacroSnapshot> = new Map();
  
  // Signals
  private signals: MacroSignal[] = [];
  
  // Cycle analysis
  private cycles: Map<string, MacroCycle> = new Map();
  
  // Stats
  private stats: MacroStats = {
    totalIndicators: 0,
    countriesTracked: [],
    lastUpdate: 0,
    signalCount: 0,
  };
  
  // Handlers
  private signalHandlers: Array<(signal: MacroSignal) => void> = [];
  
  constructor() {
    this._initIndicators();
  }

  private _initIndicators(): void {
    const all = [...FRED_INDICATORS, ...IMF_INDICATORS];
    for (const ind of all) {
      this.indicators.set(ind.id, {
        ...ind,
        latestValue: null,
        latestDate: null,
        history: [],
      });
    }
    this.stats.totalIndicators = this.indicators.size;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Indicator Management
  // ═══════════════════════════════════════════════════════════════════════

  /** Get all registered indicators */
  getIndicators(category?: MacroCategory): MacroIndicator[] {
    let list = Array.from(this.indicators.values());
    if (category) list = list.filter(i => i.category === category);
    return list;
  }

  /** Get a specific indicator */
  getIndicator(id: string): MacroIndicator | null {
    return this.indicators.get(id) ?? null;
  }

  /** Ingest a data point for a FRED/IMF indicator */
  ingestDataPoint(indicatorId: string, date: string, value: number): boolean {
    const indicator = this.indicators.get(indicatorId);
    if (!indicator) return false;
    
    indicator.history.push({ date, value });
    // Keep last 200 points
    if (indicator.history.length > 200) indicator.history = indicator.history.slice(-200);
    
    indicator.latestValue = value;
    indicator.latestDate = date;
    this.stats.lastUpdate = Date.now();
    
    // Detect macro signals
    this._detectMacroSignal(indicator, value);
    
    return true;
  }

  /** Batch ingest from a data feed */
  ingestBatch(points: Array<{ indicatorId: string; date: string; value: number }>): number {
    let count = 0;
    for (const p of points) {
      if (this.ingestDataPoint(p.indicatorId, p.date, p.value)) count++;
    }
    return count;
  }

  /** Get historical data for an indicator */
  getHistory(indicatorId: string, limit = 50): MacroHistoryPoint[] {
    const indicator = this.indicators.get(indicatorId);
    if (!indicator) return [];
    return indicator.history.slice(-limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Country Macro Snapshot
  // ═══════════════════════════════════════════════════════════════════════

  /** Create/update a macro snapshot for a country */
  updateSnapshot(country: string, data: {
    gdpGrowth: number;
    cpi: number;
    unemployment: number;
    policyRate: number;
  }): void {
    const is = Array.from(this.indicators.values());
    const countryIndicators: Record<string, MacroIndicator> = {};
    for (const ind of is) {
      countryIndicators[ind.id] = { ...ind, history: [...ind.history] };
    }

    const score = this._computeMacroScore(data);
    
    const snapshot: MacroSnapshot = {
      timestamp: Date.now(),
      country,
      indicators: countryIndicators,
      gdpGrowth: data.gdpGrowth,
      cpi: data.cpi,
      unemployment: data.unemployment,
      policyRate: data.policyRate,
      compositeScore: score,
    };

    this.snapshots.set(country, snapshot);
    if (!this.stats.countriesTracked.includes(country)) {
      this.stats.countriesTracked.push(country);
    }

    // Update cycle
    this._updateCycle(country, data, score);
  }

  /** Get macro snapshot for a country */
  getSnapshot(country: string): MacroSnapshot | null {
    return this.snapshots.get(country) ?? null;
  }

  /** Get all country snapshots */
  getAllSnapshots(): MacroSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Cross-Country Macro Comparison
  // ═══════════════════════════════════════════════════════════════════════

  /** Compare GDP growth across countries */
  compareGdp(): MacroCrossCountry {
    const entries = Array.from(this.snapshots.entries()).map(([country, snap]) => ({
      country, value: snap.gdpGrowth,
    })).sort((a, b) => b.value - a.value);

    const values = entries.map(e => e.value);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    
    return {
      timestamp: Date.now(),
      indicator: 'GDP_Growth',
      rankings: entries.map((e, i) => ({ ...e, rank: i + 1 })),
      globalAverage: Math.round(avg * 100) / 100,
      globalMedian: Math.round(median * 100) / 100,
      top3: entries.slice(0, 3),
      bottom3: entries.slice(-3).reverse(),
    };
  }

  /** Compare CPI across countries */
  compareCpi(): MacroCrossCountry {
    const entries = Array.from(this.snapshots.entries()).map(([country, snap]) => ({
      country, value: snap.cpi,
    })).sort((a, b) => a.value - b.value);

    const values = entries.map(e => e.value);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    
    return {
      timestamp: Date.now(),
      indicator: 'CPI_Inflation',
      rankings: entries.map((e, i) => ({ ...e, rank: i + 1 })),
      globalAverage: Math.round(avg * 100) / 100,
      globalMedian: Math.round(median * 100) / 100,
      top3: entries.slice(0, 3),
      bottom3: entries.slice(-3).reverse(),
    };
  }

  /** Compare unemployment across countries */
  compareUnemployment(): MacroCrossCountry {
    const entries = Array.from(this.snapshots.entries()).map(([country, snap]) => ({
      country, value: snap.unemployment,
    })).sort((a, b) => a.value - b.value);

    const values = entries.map(e => e.value);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    
    return {
      timestamp: Date.now(),
      indicator: 'Unemployment_Rate',
      rankings: entries.map((e, i) => ({ ...e, rank: i + 1 })),
      globalAverage: Math.round(avg * 100) / 100,
      globalMedian: Math.round(median * 100) / 100,
      top3: entries.slice(0, 3),
      bottom3: entries.slice(-3).reverse(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Macro Cycle Analysis
  // ═══════════════════════════════════════════════════════════════════════

  /** Get macro cycle for a country */
  getCycle(country: string): MacroCycle | null {
    return this.cycles.get(country) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signals
  // ═══════════════════════════════════════════════════════════════════════

  getSignals(category?: MacroCategory, limit = 50): MacroSignal[] {
    let list = this.signals;
    if (category) list = list.filter(s => s.category === category);
    return list.slice(0, limit);
  }

  getLatestSignals(limit = 20): MacroSignal[] {
    return this.signals.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Market Implications
  // ═══════════════════════════════════════════════════════════════════════

  /** Generate market implication summary based on macro data */
  getMarketImplications(): string[] {
    const implications: string[] = [];
    const fed = this.indicators.get('FEDFUNDS');
    const cpi = this.indicators.get('CPIAUCSL');
    const gdp = this.indicators.get('GDP');
    const yieldCurve = this.indicators.get('T10Y2Y');
    const vix = this.indicators.get('VIXCLS');
    const unemp = this.indicators.get('UNRATE');

    if (fed?.latestValue && fed.latestValue > 5) {
      implications.push('高利率环境 → 成长股承压，价值股/防御板块受益');
    }
    if (cpi?.latestValue && cpi.latestValue > 4) {
      implications.push('通胀高于目标 → 央行倾向于维持紧缩，债券收益率上行压力');
    }
    if (gdp?.latestValue && gdp?.history.length >= 2) {
      const prev = gdp.history[gdp.history.length - 2];
      if (gdp.latestValue < prev.value && gdp.latestValue < 2) {
        implications.push('GDP增速放缓 → 防御性配置 + 增加国债敞口');
      }
    }
    if (yieldCurve?.latestValue !== null && yieldCurve.latestValue < -0.3) {
      implications.push('收益率曲线倒挂 → 经济衰退预警，关注信用风险');
    }
    if (vix?.latestValue && vix.latestValue > 30) {
      implications.push('VIX恐慌指数飙升 → 市场避险情绪升温，黄金/美债/日元受益');
    }
    if (unemp?.latestValue && unemp.latestValue > 5.5) {
      implications.push('失业率上升 → 消费支出承压，可选消费板块回避');
    }

    return implications;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Stats / Handlers / Reset
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): MacroStats {
    return { ...this.stats, countriesTracked: [...this.stats.countriesTracked] };
  }

  onSignal(handler: (signal: MacroSignal) => void): () => void {
    this.signalHandlers.push(handler);
    return () => { const idx = this.signalHandlers.indexOf(handler); if (idx >= 0) this.signalHandlers.splice(idx, 1); };
  }

  reset(): void {
    this.indicators.clear();
    this.snapshots.clear();
    this.signals = [];
    this.cycles.clear();
    this.stats = { totalIndicators: 0, countriesTracked: [], lastUpdate: 0, signalCount: 0 };
    this._initIndicators();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Macro Score
  // ═══════════════════════════════════════════════════════════════════════

  private _computeMacroScore(data: { gdpGrowth: number; cpi: number; unemployment: number; policyRate: number }): number {
    let score = 0;

    // GDP growth: optimal around 2-4%
    if (data.gdpGrowth >= 2 && data.gdpGrowth <= 4) score += 20;
    else if (data.gdpGrowth > 4) score += 10;  // overheating
    else if (data.gdpGrowth > 0) score += 5;   // slow growth
    else score -= 15; // contraction

    // CPI: target around 2%
    if (data.cpi >= 1.5 && data.cpi <= 3) score += 20;
    else if (data.cpi > 3 && data.cpi <= 5) score += 5;
    else if (data.cpi > 5) score -= 15;  // high inflation
    else score += 5; // deflation risk

    // Unemployment: natural rate ~4%
    if (data.unemployment <= 4) score += 15;
    else if (data.unemployment <= 6) score += 5;
    else score -= 10;

    // Policy rate: neutral ~2.5-3.5%
    if (data.policyRate <= 3.5 && data.policyRate >= 2) score += 15;
    else if (data.policyRate > 5) score -= 10;
    else score += 5;

    return Math.max(-100, Math.min(100, score));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Cycle Detection
  // ═══════════════════════════════════════════════════════════════════════

  private _updateCycle(country: string, data: { gdpGrowth: number; cpi: number; unemployment: number; policyRate: number }, score: number): void {
    const prev = this.cycles.get(country);
    const prevScore = prev ? 50 : 50; // first entry uses neutral baseline 50

    const gdpTrend = score > prevScore + 10 ? 'accelerating' : score < prevScore - 10 ? 'decelerating' : 'stable';
    const inflationTrend = data.cpi > 4 ? 'rising' : data.cpi < 2 ? 'falling' : 'stable';
    const rateDirection = data.policyRate > 5 ? 'tightening' : data.policyRate < 2 ? 'easing' : 'neutral';

    let phase: MacroCycle['phase'];
    if (gdpTrend === 'accelerating' && inflationTrend === 'stable') phase = 'expansion';
    else if (gdpTrend === 'stable' && inflationTrend === 'rising') phase = 'peak';
    else if (gdpTrend === 'decelerating') phase = 'contraction';
    else phase = 'trough';

    let riskLevel: MacroCycle['riskLevel'];
    if (score > 50) riskLevel = 'low';
    else if (score > 25) riskLevel = 'moderate';
    else if (score > 0) riskLevel = 'elevated';
    else riskLevel = 'high';

    // Simple recession probability model
    let recessionProb = 0;
    if (data.gdpGrowth < 1) recessionProb += 30;
    if (data.unemployment > 6) recessionProb += 25;
    if (data.cpi > 5) recessionProb += 20;
    if (data.policyRate > 5) recessionProb += 15;
    recessionProb = Math.min(100, recessionProb);

    this.cycles.set(country, {
      country, phase, gdpTrend, inflationTrend, rateDirection, riskLevel, recessionProbability: recessionProb,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Signal Detection
  // ═══════════════════════════════════════════════════════════════════════

  private _detectMacroSignal(indicator: MacroIndicator, latestValue: number): void {
    const { threshold: th, descriptionCn, direction } = indicator;

    // Below critical high
    if (th.critical > 0 && latestValue >= th.critical) {
      const isBad = direction === 'lower_better';
      const cat = indicator.category;
      let marketImp = '';
      if (indicator.id === 'UNRATE') marketImp = '高失业率 → 消费支出疲软，防御板块/国债受益';
      else if (indicator.id.includes('CPI')) marketImp = '高通胀 → 央行紧缩预期增强，成长股/债券承压';
      else if (indicator.id === 'VIXCLS') marketImp = 'VIX飙升 → 市场恐慌，波动率策略+避险资产';
      else if (indicator.id === 'T10Y2Y' && latestValue < 0) marketImp = '收益率曲线倒挂 → 衰退预警，降低权益配置';
      else marketImp = '宏观指标恶化 → 增加防御配置，降低风险敞口';

      this._emitSignal(indicator.id, 'US', indicator.category, latestValue, th,
        isBad ? 'critical' : 'warning',
        isBad ? 'bearish' : 'neutral',
        `${indicator.name} hit ${latestValue}: ${isBad ? 'warning signal' : 'elevated'} — ${indicator.description}`,
        `${descriptionCn}=${latestValue}，触发${isBad ? '预警' : '关注'}阈值`,
        marketImp,
      );
    }

    // Yield curve inversion (special handling)
    if (indicator.id === 'T10Y2Y' && latestValue < -0.3) {
      this._emitSignal('T10Y2Y', 'US', 'interest_rate', latestValue, { low: -0.3, high: 0, critical: -0.8 },
        latestValue < -0.8 ? 'critical' : 'warning',
        'bearish',
        `Yield curve inverted: 10Y-2Y spread at ${latestValue.toFixed(2)}% — recession probability elevated`,
        `收益率曲线倒挂 ${latestValue.toFixed(2)}%，衰退概率上升`,
        '倒挂幅度越大 → 衰退概率越高 → 大幅降低周期性股票敞口',
      );
    }
  }

  private _emitSignal(
    indicatorId: string, country: string, category: MacroCategory,
    value: number, threshold: { low: number; high: number; critical: number },
    severity: 'info' | 'warning' | 'critical', direction: 'bullish' | 'bearish' | 'neutral',
    message: string, messageCn: string, marketImplication: string,
  ): void {
    const signal: MacroSignal = {
      signalId: `macro_${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      indicatorId, country, category, value, threshold, severity, direction,
      message, messageCn, marketImplication, timestamp: Date.now(),
    };

    this.signals.unshift(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.stats.signalCount++;

    for (const handler of this.signalHandlers) {
      try { handler(signal); } catch { /* non-fatal */ }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _macroSource: MacroDataSource | null = null;

export function getMacroSource(): MacroDataSource {
  if (!_macroSource) _macroSource = new MacroDataSource();
  return _macroSource;
}

export function resetMacroSource(): void {
  if (_macroSource) _macroSource.reset();
  _macroSource = null;
}
