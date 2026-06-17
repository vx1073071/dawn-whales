/**
 * R277 auto#1: 14国全球市场统一桥接 (GlobalMarketBridge) v1.0
 * 
 * QUANT MOO — 统一桥接14国数据源到因子→信号→推送管线
 * 
 * 14市场:
 *   🇺🇸 US  — 美股(ETF流/13F/IV/Sentiment)
 *   🇭🇰 HK  — 港股(沽空/互联互通/衍生品/ADR)
 *   🇨🇳 CN  — A股(DDX/北向/龙虎榜/融资融券/板块资金)
 *   🇯🇵 JP  — 日股(信用買残/外国人売買/空売り比率)
 *   🇮🇳 IN  — 印度(FII/DII/F&O OI/PCR/IV/Delivery%)
 *   🇰🇷 KR  — 韩国(外国人/機関売買/プログラム/信用比率)
 *   🇹🇼 TW  — 台湾(三大法人/当沖/融資融券/外資匯出)
 *   🇪🇺 EU  — 欧洲(STOXX/DAX/CAC/国別スプレッド/ECB)
 *   🇧🇷 BR  — 巴西(外国人投資/金利先物/Bovespa/為替連動)
 *   🇸🇦 SA  — 沙特(Tadawul/外国人保有/OPEC連動)
 *   🇸🇬 SG  — 新加坡(STI/REIT/外国人フロー)
 *   🇦🇺 AU  — 澳大利亚(ASX/資源株/金利/RBA)
 *   🌏 GLOBAL — 全球指标(VWAP/EM/DM/板块轮动)
 *   🇲🇽 MX  — 墨西哥(BMV/為替/NAFTA連動)
 * 
 * 8大标准化指标:
 *   foreign_flow / margin_status / market_breadth / sector_flow
 *   volatility_index / credit_ratio / institutional_flow / turnover_alert
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type CountryCode = 'US' | 'HK' | 'CN' | 'JP' | 'IN' | 'KR' | 'TW' | 'EU' | 'BR' | 'SA' | 'SG' | 'AU' | 'GLOBAL' | 'MX';

export interface CountryMeta {
  code: CountryCode;
  name: string;
  nameCn: string;
  currency: string;
  timezone: string;
  mainIndex: string;
  mainIndexName: string;
  marketCap: number;      // USD 万亿
  tradingHours: string;
}

// 8 standardized indicators per country
export interface CountryIndicator {
  country: CountryCode;
  timestamp: number;
  foreignFlow: number;       // 外资净流向 (标准化 -100~+100)
  marginStatus: number;      // 杠杆状态 (0~100, >60=过热, <30=去杠杆)
  marketBreadth: number;     // 市场宽度 (0~100, 上涨/下跌比)
  sectorFlow: number;        // 板块资金 (标准化 -100~+100)
  volatilityIndex: number;   // 波动率指数
  creditRatio: number;       // 信用比率
  institutionalFlow: number; // 机构资金流向
  turnoverAlert: number;     // 换手率异常 (0~100)
  compositeScore: number;    // 综合评分 (-100~+100)
}

export interface CountrySignal {
  signalId: string;
  country: CountryCode;
  countryName: string;
  indicator: string;
  value: number;
  threshold: { low: number; high: number; critical: number };
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  timestamp: number;
}

export interface CrossCountryComparison {
  timestamp: number;
  rankings: Array<{ country: CountryCode; name: string; score: number }>;
  best: { country: CountryCode; name: string; score: number };
  worst: { country: CountryCode; name: string; score: number };
  average: number;
  median: number;
  stdDev: number;
  topFlows: Array<{ country: CountryCode; name: string; flow: number }>;
}

export interface GlobalHeatmap {
  timestamp: number;
  cells: Array<{
    country: CountryCode;
    name: string;
    indicators: Record<string, { value: number; color: 'red' | 'orange' | 'yellow' | 'green' | 'grey' }>;
    compositeScore: number;
  }>;
  globalRiskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  globalRiskScore: number; // 0-100
}

export interface GlobalBridgeStats {
  totalSnapshots: number;
  totalSignals: number;
  lastUpdate: number;
  snapshotCounts: Record<CountryCode, number>;
  signalCounts: Record<CountryCode, number>;
}

// ── Country Registry ───────────────────────────────────────────────────────

const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  US: { code:'US', name:'United States', nameCn:'美国', currency:'USD', timezone:'America/New_York', mainIndex:'SPX', mainIndexName:'S&P 500', marketCap:46.2, tradingHours:'09:30-16:00 EST' },
  HK: { code:'HK', name:'Hong Kong', nameCn:'香港', currency:'HKD', timezone:'Asia/Hong_Kong', mainIndex:'HSI', mainIndexName:'恒生指数', marketCap:5.1, tradingHours:'09:30-16:00 HKT' },
  CN: { code:'CN', name:'China A-Share', nameCn:'A股', currency:'CNY', timezone:'Asia/Shanghai', mainIndex:'000300', mainIndexName:'沪深300', marketCap:11.8, tradingHours:'09:30-15:00 CST' },
  JP: { code:'JP', name:'Japan', nameCn:'日本', currency:'JPY', timezone:'Asia/Tokyo', mainIndex:'NKY', mainIndexName:'日经225', marketCap:6.5, tradingHours:'09:00-15:00 JST' },
  IN: { code:'IN', name:'India', nameCn:'印度', currency:'INR', timezone:'Asia/Kolkata', mainIndex:'NIFTY', mainIndexName:'Nifty 50', marketCap:4.3, tradingHours:'09:15-15:30 IST' },
  KR: { code:'KR', name:'South Korea', nameCn:'韩国', currency:'KRW', timezone:'Asia/Seoul', mainIndex:'KOSPI', mainIndexName:'KOSPI', marketCap:2.0, tradingHours:'09:00-15:30 KST' },
  TW: { code:'TW', name:'Taiwan', nameCn:'台湾', currency:'TWD', timezone:'Asia/Taipei', mainIndex:'TWSE', mainIndexName:'TAIEX', marketCap:2.2, tradingHours:'09:00-13:30 TST' },
  EU: { code:'EU', name:'Eurozone', nameCn:'欧洲', currency:'EUR', timezone:'Europe/Paris', mainIndex:'SX5E', mainIndexName:'Euro STOXX 50', marketCap:8.9, tradingHours:'09:00-17:30 CET' },
  BR: { code:'BR', name:'Brazil', nameCn:'巴西', currency:'BRL', timezone:'America/Sao_Paulo', mainIndex:'IBOV', mainIndexName:'Bovespa', marketCap:0.9, tradingHours:'10:00-17:00 BRT' },
  SA: { code:'SA', name:'Saudi Arabia', nameCn:'沙特', currency:'SAR', timezone:'Asia/Riyadh', mainIndex:'TASI', mainIndexName:'Tadawul', marketCap:2.7, tradingHours:'10:00-15:00 AST' },
  SG: { code:'SG', name:'Singapore', nameCn:'新加坡', currency:'SGD', timezone:'Asia/Singapore', mainIndex:'STI', mainIndexName:'Straits Times', marketCap:0.6, tradingHours:'09:00-17:00 SGT' },
  AU: { code:'AU', name:'Australia', nameCn:'澳大利亚', currency:'AUD', timezone:'Australia/Sydney', mainIndex:'AS51', mainIndexName:'ASX 200', marketCap:1.8, tradingHours:'10:00-16:00 AEST' },
  GLOBAL: { code:'GLOBAL', name:'Global', nameCn:'全球', currency:'USD', timezone:'UTC', mainIndex:'ACWI', mainIndexName:'MSCI ACWI', marketCap:110, tradingHours:'24h' },
  MX: { code:'MX', name:'Mexico', nameCn:'墨西哥', currency:'MXN', timezone:'America/Mexico_City', mainIndex:'MEXBOL', mainIndexName:'IPC', marketCap:0.5, tradingHours:'08:30-15:00 CST' },
};

// ── GlobalMarketBridge ─────────────────────────────────────────────────────

export class GlobalMarketBridge {
  // Per-country indicator snapshots (latest only)
  private indicators: Map<CountryCode, CountryIndicator> = new Map();
  
  // Signal history
  private signals: CountrySignal[] = [];
  private signalHistory: CountrySignal[] = [];
  
  // Comparison cache
  private lastComparison: CrossCountryComparison | null = null;
  
  // Settings
  private watchlist: Set<CountryCode> = new Set();
  
  // Stats
  private stats: GlobalBridgeStats = {
    totalSnapshots: 0,
    totalSignals: 0,
    lastUpdate: 0,
    snapshotCounts: {} as Record<CountryCode, number>,
    signalCounts: {} as Record<CountryCode, number>,
  };
  
  // Live update handlers
  private indicatorHandlers: Array<(indicator: CountryIndicator) => void> = [];
  private signalHandlers: Array<(signal: CountrySignal) => void> = [];
  
  constructor() {
    // Initialize stat counters
    for (const code of Object.keys(COUNTRY_META) as CountryCode[]) {
      this.stats.snapshotCounts[code] = 0;
      this.stats.signalCounts[code] = 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Country Metadata
  // ═══════════════════════════════════════════════════════════════════════

  getCountryMeta(code: CountryCode): CountryMeta | null {
    return COUNTRY_META[code] ?? null;
  }

  getAllCountries(): CountryMeta[] {
    return Object.values(COUNTRY_META);
  }

  getCountriesByRegion(region: 'americas' | 'emea' | 'asia' | 'global'): CountryMeta[] {
    const map: Record<string, CountryCode[]> = {
      americas: ['US', 'BR', 'MX'],
      emea: ['EU', 'SA'],
      asia: ['HK', 'CN', 'JP', 'IN', 'KR', 'TW', 'SG', 'AU'],
      global: ['GLOBAL'],
    };
    return (map[region] ?? []).map(c => COUNTRY_META[c]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Indicator Ingestion
  // ═══════════════════════════════════════════════════════════════════════

  /** Ingest standardized indicator snapshot for a country */
  ingest(country: CountryCode, data: Omit<CountryIndicator, 'country' | 'compositeScore'>): void {
    const score = this._computeComposite(data);
    const indicator: CountryIndicator = { ...data, country, compositeScore: score };
    
    this.indicators.set(country, indicator);
    this.stats.totalSnapshots++;
    this.stats.snapshotCounts[country] = (this.stats.snapshotCounts[country] ?? 0) + 1;
    this.stats.lastUpdate = Date.now();
    
    // Detect signals
    this._detectSignals(indicator);
    
    // Notify handlers
    for (const handler of this.indicatorHandlers) {
      try { handler(indicator); } catch { /* non-fatal */ }
    }
  }

  /** Batch ingest indicators for multiple countries */
  ingestBatch(entries: Array<{ country: CountryCode; data: Omit<CountryIndicator, 'country' | 'compositeScore'> }>): void {
    for (const entry of entries) {
      this.ingest(entry.country, entry.data);
    }
  }

  /** Get latest indicator for a country */
  getIndicator(country: CountryCode): CountryIndicator | null {
    return this.indicators.get(country) ?? null;
  }

  /** Get all latest indicators */
  getAllIndicators(): CountryIndicator[] {
    return Array.from(this.indicators.values());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Cross-Country Analysis
  // ═══════════════════════════════════════════════════════════════════════

  /** Compare all countries — generate rankings */
  compareAll(): CrossCountryComparison {
    const entries = Array.from(this.indicators.values())
      .filter(ind => ind.compositeScore !== 0 || this.stats.snapshotCounts[ind.country] > 0);

    if (entries.length === 0) {
      return {
        timestamp: Date.now(),
        rankings: [],
        best: { country: 'GLOBAL' as CountryCode, name: 'N/A', score: 0 },
        worst: { country: 'GLOBAL' as CountryCode, name: 'N/A', score: 0 },
        average: 0, median: 0, stdDev: 0,
        topFlows: [],
      };
    }

    // Sort by composite score descending
    const sorted = entries
      .map(e => ({ country: e.country, name: COUNTRY_META[e.country]?.nameCn ?? e.country, score: e.compositeScore }))
      .sort((a, b) => b.score - a.score);

    const scores = sorted.map(s => s.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    const mid = Math.floor(scores.length / 2);
    const median = scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
    const variance = scores.reduce((a, s) => a + (s - avg) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const topFlows = entries
      .map(e => ({ country: e.country, name: COUNTRY_META[e.country]?.nameCn ?? e.country, flow: e.foreignFlow }))
      .sort((a, b) => b.flow - a.flow)
      .slice(0, 5);

    this.lastComparison = {
      timestamp: Date.now(),
      rankings: sorted,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      average: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      topFlows,
    };

    return this.lastComparison;
  }

  /** Compare specific two countries */
  comparePair(a: CountryCode, b: CountryCode): {
    a: CountryIndicator | null;
    b: CountryIndicator | null;
    diff: Partial<Record<keyof CountryIndicator, number>>;
    winner: CountryCode | 'tie';
  } | null {
    const indA = this.indicators.get(a);
    const indB = this.indicators.get(b);
    if (!indA || !indB) return null;

    const diff: Partial<Record<keyof CountryIndicator, number>> = {};
    const keys: Array<keyof CountryIndicator> = ['foreignFlow', 'marginStatus', 'marketBreadth', 'sectorFlow', 'volatilityIndex', 'creditRatio', 'institutionalFlow', 'turnoverAlert'];
    for (const key of keys) {
      diff[key] = Math.round(((indA[key] as number) - (indB[key] as number)) * 100) / 100;
    }

    const winner = indA.compositeScore > indB.compositeScore ? a : indB.compositeScore > indA.compositeScore ? b : 'tie';

    return { a: indA, b: indB, diff, winner };
  }

  /** Get last comparison result */
  getLastComparison(): CrossCountryComparison | null {
    return this.lastComparison;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Heatmap
  // ═══════════════════════════════════════════════════════════════════════

  /** Generate global market heatmap */
  generateHeatmap(): GlobalHeatmap {
    const cells = Array.from(this.indicators.values()).map(ind => {
      const indicatorColors: Record<string, { value: number; color: 'red' | 'orange' | 'yellow' | 'green' | 'grey' }> = {};
      
      const mapColor = (value: number, thresholds: { red: number; yellow: number }): 'red' | 'orange' | 'yellow' | 'green' | 'grey' => {
        if (value === 0) return 'grey';
        if (value < thresholds.red) return 'red';
        if (value < thresholds.yellow) return 'orange';
        if (value < 0) return 'yellow';
        return 'green';
      };

      indicatorColors.foreignFlow = { value: ind.foreignFlow, color: mapColor(ind.foreignFlow, { red: -50, yellow: -20 }) };
      indicatorColors.marginStatus = { value: ind.marginStatus, color: mapColor(ind.marginStatus, { red: 20, yellow: 40 }) };
      indicatorColors.marketBreadth = { value: ind.marketBreadth, color: mapColor(ind.marketBreadth, { red: 30, yellow: 50 }) };
      indicatorColors.sectorFlow = { value: ind.sectorFlow, color: mapColor(ind.sectorFlow, { red: -40, yellow: -10 }) };
      indicatorColors.volatilityIndex = { value: ind.volatilityIndex, color: mapColor(ind.volatilityIndex, { red: 30, yellow: 20 }) };
      indicatorColors.institutionalFlow = { value: ind.institutionalFlow, color: mapColor(ind.institutionalFlow, { red: -40, yellow: -10 }) };

      return {
        country: ind.country,
        name: COUNTRY_META[ind.country]?.nameCn ?? ind.country,
        indicators: indicatorColors,
        compositeScore: ind.compositeScore,
      };
    });

    // Global risk scoring
    const allScores = cells.map(c => c.compositeScore);
    const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const negCount = allScores.filter(s => s < -30).length;
    const posCount = allScores.filter(s => s > 30).length;
    
    let globalRiskLevel: GlobalHeatmap['globalRiskLevel'] = 'moderate';
    let globalRiskScore = 50;
    
    if (allScores.length === 0) {
      globalRiskLevel = 'moderate';
      globalRiskScore = 50;
    } else if (negCount > allScores.length * 0.5) {
      globalRiskLevel = 'extreme';
      globalRiskScore = 90;
    } else if (negCount > allScores.length * 0.3) {
      globalRiskLevel = 'high';
      globalRiskScore = 75;
    } else if (posCount > allScores.length * 0.5) {
      globalRiskLevel = 'low';
      globalRiskScore = 20;
    } else if (posCount > allScores.length * 0.3) {
      globalRiskLevel = 'moderate';
      globalRiskScore = 40;
    }

    return { timestamp: Date.now(), cells, globalRiskLevel, globalRiskScore };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signals
  // ═══════════════════════════════════════════════════════════════════════

  getSignals(country?: CountryCode, limit = 50): CountrySignal[] {
    let list = this.signals;
    if (country) list = list.filter(s => s.country === country);
    return list.slice(0, limit);
  }

  getLatestSignals(limit = 20): CountrySignal[] {
    return this.signals.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Watchlist
  // ═══════════════════════════════════════════════════════════════════════

  addToWatchlist(country: CountryCode): void { this.watchlist.add(country); }
  removeFromWatchlist(country: CountryCode): void { this.watchlist.delete(country); }
  getWatchlist(): CountryCode[] { return Array.from(this.watchlist); }

  /** Get indicators only for watchlisted countries */
  getWatchlistIndicators(): CountryIndicator[] {
    return Array.from(this.watchlist)
      .map(c => this.indicators.get(c))
      .filter((ind): ind is CountryIndicator => ind !== undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Stats
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): GlobalBridgeStats {
    return { ...this.stats, snapshotCounts: { ...this.stats.snapshotCounts }, signalCounts: { ...this.stats.signalCounts } };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Event Handlers
  // ═══════════════════════════════════════════════════════════════════════

  onIndicator(handler: (indicator: CountryIndicator) => void): () => void {
    this.indicatorHandlers.push(handler);
    return () => { const idx = this.indicatorHandlers.indexOf(handler); if (idx >= 0) this.indicatorHandlers.splice(idx, 1); };
  }

  onSignal(handler: (signal: CountrySignal) => void): () => void {
    this.signalHandlers.push(handler);
    return () => { const idx = this.signalHandlers.indexOf(handler); if (idx >= 0) this.signalHandlers.splice(idx, 1); };
  }

  /** Reset all state */
  reset(): void {
    this.indicators.clear();
    this.signals = [];
    this.signalHistory = [];
    this.lastComparison = null;
    this.watchlist.clear();
    for (const code of Object.keys(COUNTRY_META) as CountryCode[]) {
      this.stats.snapshotCounts[code] = 0;
      this.stats.signalCounts[code] = 0;
    }
    this.stats.totalSnapshots = 0;
    this.stats.totalSignals = 0;
    this.stats.lastUpdate = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Composite Score
  // ═══════════════════════════════════════════════════════════════════════

  private _computeComposite(data: Omit<CountryIndicator, 'country' | 'compositeScore'>): number {
    let score = 0;
    // Foreign flow: heavily weighted
    score += data.foreignFlow * 0.30;
    // Institutional flow
    score += data.institutionalFlow * 0.20;
    // Market breadth
    score += (data.marketBreadth - 50) * 0.15;
    // Sector flow
    score += (data.sectorFlow > 0 ? 1 : -1) * Math.min(20, Math.abs(data.sectorFlow) * 0.10);
    // Margin status (over 60 = warning, under 30 = deleveraging)
    score += (data.marginStatus > 60 ? -5 : data.marginStatus < 30 ? -10 : 5) * 0.10;
    // Volatility (inverse — high vol = negative)
    score += (data.volatilityIndex > 30 ? -10 : data.volatilityIndex > 20 ? -5 : 5) * 0.10;
    // Credit ratio
    score += (data.creditRatio > 50 ? 5 : -5) * 0.05;
    // Turnover alert (inverse — high turnover alert = speculative)
    score += (data.turnoverAlert > 50 ? -5 : 5) * 0.10;
    
    return Math.round(Math.max(-100, Math.min(100, score)));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Signal Detection
  // ═══════════════════════════════════════════════════════════════════════

  private _detectSignals(ind: CountryIndicator): void {
    const cname = COUNTRY_META[ind.country]?.nameCn ?? ind.country;

    // 1. Foreign flow extreme
    if (Math.abs(ind.foreignFlow) > 60) {
      this._emitSignal(ind, 'foreign_flow', ind.foreignFlow, { low: -30, high: 30, critical: 60 },
        Math.abs(ind.foreignFlow) > 80 ? 'critical' : 'warning',
        ind.foreignFlow > 0 ? 'bullish' : 'bearish',
        ind.foreignFlow > 0
          ? `Strong foreign inflow in ${cname}: ${ind.foreignFlow.toFixed(1)} — foreign capital rushing in`
          : `Strong foreign outflow from ${cname}: ${ind.foreignFlow.toFixed(1)} — foreign capital fleeing`,
        ind.foreignFlow > 0
          ? `${cname}外资大幅流入 ${ind.foreignFlow.toFixed(0)}，外资加速建仓`
          : `${cname}外资大幅流出 ${Math.abs(ind.foreignFlow).toFixed(0)}，外资撤离信号`,
      );
    }

    // 2. Margin extreme
    if (ind.marginStatus > 70) {
      this._emitSignal(ind, 'margin_overheat', ind.marginStatus, { low: 50, high: 65, critical: 75 },
        ind.marginStatus > 80 ? 'critical' : 'warning', 'bearish',
        `${cname} margin overheated at ${ind.marginStatus.toFixed(0)} — leverage risk elevated`,
        `${cname}融资过热 ${ind.marginStatus.toFixed(0)}%，杠杆风险攀升`,
      );
    } else if (ind.marginStatus < 20) {
      this._emitSignal(ind, 'margin_delever', ind.marginStatus, { low: 25, high: 40, critical: 15 },
        ind.marginStatus < 15 ? 'critical' : 'warning', 'bearish',
        `${cname} de-leveraging: margin ratio ${ind.marginStatus.toFixed(0)}% — forced selling risk`,
        `${cname}去杠杆中 ${ind.marginStatus.toFixed(0)}%，强制平仓风险`,
      );
    }

    // 3. Market breadth extreme
    if (ind.marketBreadth > 80) {
      this._emitSignal(ind, 'breadth_overbought', ind.marketBreadth, { low: 50, high: 70, critical: 85 },
        'warning', 'bullish',
        `${cname} broad rally: ${ind.marketBreadth.toFixed(0)}% stocks advancing — market overbought`,
        `${cname}全面上涨 ${ind.marketBreadth.toFixed(0)}%个股，市场超买`,
      );
    } else if (ind.marketBreadth < 20) {
      this._emitSignal(ind, 'breadth_oversold', ind.marketBreadth, { low: 30, high: 50, critical: 15 },
        ind.marketBreadth < 15 ? 'critical' : 'warning', 'bearish',
        `${cname} broad selloff: only ${ind.marketBreadth.toFixed(0)}% advancing — market capitulation`,
        `${cname}全线下跌 仅${ind.marketBreadth.toFixed(0)}%个股上涨，恐慌性抛售`,
      );
    }

    // 4. Volatility spike
    if (ind.volatilityIndex > 35) {
      this._emitSignal(ind, 'volatility_spike', ind.volatilityIndex, { low: 20, high: 28, critical: 35 },
        'critical', 'bearish',
        `${cname} volatility spiked to ${ind.volatilityIndex.toFixed(1)} — tail risk elevated`,
        `${cname}波动率飙升 ${ind.volatilityIndex.toFixed(1)}，尾部风险加剧`,
      );
    }

    // 5. Institutional flow divergence
    if (ind.institutionalFlow > 60 && ind.foreignFlow < -30) {
      this._emitSignal(ind, 'institutional_foreign_divergence', 0, { low: 0, high: 0, critical: 0 },
        'warning', 'neutral',
        `${cname}: institutional buying (${ind.institutionalFlow.toFixed(0)}) but foreign selling (${ind.foreignFlow.toFixed(0)}) — mixed signals`,
        `${cname}: 机构买入(${ind.institutionalFlow.toFixed(0)})vs外资卖出(${ind.foreignFlow.toFixed(0)})，信号分歧`,
      );
    }

    // 6. Turnover anomaly
    if (ind.turnoverAlert > 70) {
      this._emitSignal(ind, 'turnover_surge', ind.turnoverAlert, { low: 40, high: 60, critical: 75 },
        'warning', 'neutral',
        `${cname} abnormal turnover: ${ind.turnoverAlert.toFixed(0)} — unusual trading activity`,
        `${cname}换手率异常 ${ind.turnoverAlert.toFixed(0)}，交易活跃度异动`,
      );
    }
  }

  private _emitSignal(
    ind: CountryIndicator,
    indicatorName: string,
    value: number,
    threshold: { low: number; high: number; critical: number },
    severity: 'info' | 'warning' | 'critical',
    direction: 'bullish' | 'bearish' | 'neutral',
    message: string,
    messageCn: string,
  ): void {
    const signal: CountrySignal = {
      signalId: `global_${ind.country}_${indicatorName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      country: ind.country,
      countryName: COUNTRY_META[ind.country]?.nameCn ?? ind.country,
      indicator: indicatorName,
      value,
      threshold,
      severity,
      direction,
      message,
      messageCn,
      timestamp: Date.now(),
    };

    this.signals.unshift(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.signalHistory.push(signal);
    this.stats.totalSignals++;
    this.stats.signalCounts[ind.country] = (this.stats.signalCounts[ind.country] ?? 0) + 1;

    for (const handler of this.signalHandlers) {
      try { handler(signal); } catch { /* non-fatal */ }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _globalBridge: GlobalMarketBridge | null = null;

export function getGlobalBridge(): GlobalMarketBridge {
  if (!_globalBridge) _globalBridge = new GlobalMarketBridge();
  return _globalBridge;
}

export function resetGlobalBridge(): void {
  if (_globalBridge) _globalBridge.reset();
  _globalBridge = null;
}
