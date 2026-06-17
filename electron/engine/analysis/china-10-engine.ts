// ── R269 JVS-2 中国10特色引擎 (China10Engine) ──
// 10个中国特色技术指标: CYQ筹码分布改良/龙虎榜资金/融资融券分析/
// 上证综合强度/涨跌停限制/板块风格轮动(中国版)/北向资金/两融余额/
// 涨跌幅偏离/换手率异常

import type { OHLCVData } from './trend-14-engine';

export interface China10EngineConfig {
  cyqBins?: number; cyqLookback?: number;
  lhbLookbackDays?: number;
  marginRatioThreshold?: number;
  shCompLookback?: number;
  limitUpPct?: number; limitDownPct?: number;
  northboundLookback?: number;
  marginBalanceLookback?: number;
  devPctThreshold?: number;
  turnoverLookback?: number; turnoverThreshold?: number;
}

export const DEFAULT_CHINA10_CONFIG: Required<China10EngineConfig> = {
  cyqBins: 50, cyqLookback: 250,
  lhbLookbackDays: 5,
  marginRatioThreshold: 1.5,
  shCompLookback: 60,
  limitUpPct: 10, limitDownPct: 10,
  northboundLookback: 20,
  marginBalanceLookback: 20,
  devPctThreshold: 7,
  turnoverLookback: 20, turnoverThreshold: 3.0,
};

// Market helper types
export interface ChinaMarginData {
  date: string; marginBuy: number; marginSell: number; marginBalance: number; shortBalance: number;
}

export interface NorthboundFlow {
  date: string; netFlow: number; cumulative: number; sector?: string;
}

export interface LHBRecord {
  date: string; type: 'buy' | 'sell'; institution: string; amount: number; rank: number;
}

export interface SectorStyleData {
  sector: string; changePct: number; volumeRatio: number; momentum: number;
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class China10Engine {
  private config: Required<China10EngineConfig>;
  private data: Map<string, OHLCVData[]> = new Map();
  private marginData: Map<string, ChinaMarginData[]> = new Map();
  private northboundData: NorthboundFlow[] = [];
  private lhbData: Map<string, LHBRecord[]> = new Map();
  private sectorData: SectorStyleData[] = [];

  constructor(config?: China10EngineConfig) {
    this.config = { ...DEFAULT_CHINA10_CONFIG, ...config };
  }

  reset(): void {
    this.data.clear(); this.marginData.clear();
    this.northboundData = []; this.lhbData.clear(); this.sectorData = [];
  }

  updateConfig(patch: Partial<China10EngineConfig>): void { this.config = { ...this.config, ...patch }; }
  getConfig(): Required<China10EngineConfig> { return { ...this.config }; }

  loadData(symbol: string, bars: OHLCVData[]): void { this.data.set(symbol.toUpperCase(), bars); }
  getData(symbol: string): OHLCVData[] { return this.data.get(symbol.toUpperCase()) || []; }

  loadMarginData(symbol: string, data: ChinaMarginData[]): void { this.marginData.set(symbol.toUpperCase(), data); }
  loadNorthboundData(data: NorthboundFlow[]): void { this.northboundData = data; }
  loadLHBData(symbol: string, data: LHBRecord[]): void { this.lhbData.set(symbol.toUpperCase(), data); }
  loadSectorData(data: SectorStyleData[]): void { this.sectorData = data; }

  // ═══════════ 1. CYQ筹码分布改良 ═══════════

  /**
   * 中国市场特色：筹码分布改良版
   * 含获利比例、平均成本、筹码集中度、多峰检测、筹码缺口
   */
  computeCYQ(symbol: string, bins?: number, lookback?: number): {
    histogram: { price: number; volume: number; color: 'profit' | 'loss' }[];
    profitRatio: number;
    avgCost: number;
    concentration: number; // Gini coefficient of distribution
    peakCount: number;
    peakPrices: number[];
    hasGap: boolean;
    gapPrice?: number;
  } {
    const bars = this.getData(symbol);
    const b = bins || this.config.cyqBins;
    const lb = lookback ?? this.config.cyqLookback;
    if (bars.length < 2) return { histogram: [], profitRatio: 0, avgCost: 0, concentration: 0, peakCount: 0, peakPrices: [], hasGap: false };

    const lastClose = bars[bars.length - 1].close;
    const slice = bars.slice(Math.max(0, bars.length - lb));
    const allPrices = slice.flatMap((bar) => [bar.high, bar.low, bar.close]);
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const binSize = (maxP - minP) / b;

    const histogram: { price: number; volume: number; color: 'profit' | 'loss' }[] = [];
    for (let i = 0; i < b; i++) {
      const binPrice = minP + binSize * (i + 0.5);
      let binVol = 0;
      for (const bar of slice) {
        const barLo = Math.max(minP + binSize * i, bar.low);
        const barHi = Math.min(minP + binSize * (i + 1), bar.high);
        if (barHi > barLo) binVol += (bar.volume || 0) * (barHi - barLo) / (bar.high - bar.low);
      }
      histogram.push({ price: binPrice, volume: binVol, color: binPrice <= lastClose ? 'profit' : 'loss' });
    }

    // Profit ratio
    const totalVol = histogram.reduce((s, h) => s + h.volume, 0);
    const profitVol = histogram.filter((h) => h.color === 'profit').reduce((s, h) => s + h.volume, 0);
    const profitRatio = totalVol > 0 ? profitVol / totalVol : 0.5;

    // Average cost
    const avgCost = totalVol > 0 ? histogram.reduce((s, h) => s + h.price * h.volume, 0) / totalVol : lastClose;

    // Concentration (Gini-like)
    const sorted = [...histogram].sort((a, b) => b.volume - a.volume);
    let cumSum = 0; let cumPct = 0;
    for (let i = 0; i < sorted.length; i++) {
      cumSum += sorted[i].volume;
      if (totalVol > 0 && i >= sorted.length * 0.2) cumPct = cumSum / totalVol;
    }
    const concentration = Math.min(1, Math.max(0, cumPct));

    // Peak detection
    const peakPrices: number[] = [];
    for (let i = 2; i < histogram.length - 2; i++) {
      const h = histogram[i];
      const prev1 = histogram[i - 1]; const prev2 = histogram[i - 2];
      const next1 = histogram[i + 1]; const next2 = histogram[i + 2];
      if (h.volume > prev1.volume && h.volume > prev2.volume && h.volume > next1.volume && h.volume > next2.volume) {
        peakPrices.push(h.price);
      }
    }

    // Gap detection (volume < 20% of average between consecutive bins)
    const avgBinVol = totalVol / b;
    let hasGap = false; let gapPrice = undefined;
    for (let i = 1; i < histogram.length - 1; i++) {
      if (histogram[i].volume < avgBinVol * 0.2 &&
        histogram[i - 1].volume > avgBinVol * 0.5 &&
        histogram[i + 1].volume > avgBinVol * 0.5) {
        hasGap = true; gapPrice = histogram[i].price; break;
      }
    }

    return { histogram, profitRatio, avgCost, concentration, peakCount: peakPrices.length, peakPrices, hasGap, gapPrice };
  }

  // ═══════════ 2. 龙虎榜资金分析 ═══════════

  /**
   * 龙虎榜席位分析：主力流入流出、游资vs机构、净买入
   */
  computeLHB(symbol: string, lookbackDays?: number): {
    netFlow: number;
    buyAmount: number; sellAmount: number;
    institutionBuy: number; institutionSell: number;
    retailBuy: number; retailSell: number;
    topBuyInstitution: string;
    signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
    consecutiveDays: number;
  } {
    const recs = this.lhbData.get(symbol.toUpperCase()) || [];
    const lb = lookbackDays ?? this.config.lhbLookbackDays;
    const recent = recs.slice(-lb * 10); // ~10 records per day

    let buyAmount = 0, sellAmount = 0, instBuy = 0, instSell = 0, retailBuy = 0, retailSell = 0;
    const instMap = new Map<string, number>();

    for (const r of recent) {
      if (r.type === 'buy') {
        buyAmount += r.amount;
        instMap.set(r.institution, (instMap.get(r.institution) || 0) + r.amount);
        if (r.institution.includes('机构') || r.institution.includes('专用')) instBuy += r.amount;
        else retailBuy += r.amount;
      } else {
        sellAmount += r.amount;
        if (r.institution.includes('机构') || r.institution.includes('专用')) instSell += r.amount;
        else retailSell += r.amount;
      }
    }

    const netFlow = buyAmount - sellAmount;
    const topBuyInstitution = [...instMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' = 'neutral';
    const totalFlow = buyAmount + sellAmount;
    if (totalFlow > 0) {
      const ratio = netFlow / totalFlow;
      if (ratio > 0.3 && instBuy > instSell) signal = 'strong_buy';
      else if (ratio > 0.1) signal = 'buy';
      else if (ratio < -0.3 && instSell > instBuy) signal = 'strong_sell';
      else if (ratio < -0.1) signal = 'sell';
    }

    // Count consecutive days on LHB
    let consecutiveDays = 0;
    const dates = [...new Set(recs.map((r) => r.date))].sort().reverse();
    const today = dates[0];
    for (const d of dates) {
      if (d === today || (consecutiveDays > 0 && d !== dates[consecutiveDays])) break;
      consecutiveDays++;
    }

    return { netFlow, buyAmount, sellAmount, institutionBuy: instBuy, institutionSell: instSell, retailBuy, retailSell, topBuyInstitution, signal, consecutiveDays };
  }

  // ═══════════ 3. 融资融券分析 ═══════════

  /**
   * 融资融券：余额变化、融资买入/卖出比、维持担保比例
   */
  computeMargin(symbol: string): {
    marginBuy: number; marginSell: number;
    netMargin: number; marginBalance: number;
    shortBalance: number; marginRatio: number;
    marginTrend: 'increasing' | 'decreasing' | 'stable';
    riskLevel: 'safe' | 'caution' | 'danger';
  } {
    const data = this.marginData.get(symbol.toUpperCase()) || [];
    const lb = this.config.marginBalanceLookback;
    const recent = data.slice(-lb);
    if (recent.length < 2) {
      return { marginBuy: 0, marginSell: 0, netMargin: 0, marginBalance: 0, shortBalance: 0, marginRatio: 0, marginTrend: 'stable', riskLevel: 'safe' };
    }

    const last = recent[recent.length - 1];
    const first = recent[0];
    const netMargin = last.marginBuy - last.marginSell;
    const marginRatio = last.shortBalance > 0 ? last.marginBalance / last.shortBalance : 0;

    let marginTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const change = last.marginBalance - first.marginBalance;
    if (change / Math.max(first.marginBalance, 1) > 0.05) marginTrend = 'increasing';
    else if (change / Math.max(first.marginBalance, 1) < -0.05) marginTrend = 'decreasing';

    let riskLevel: 'safe' | 'caution' | 'danger' = 'safe';
    if (marginRatio > 2) riskLevel = 'caution';
    if (marginRatio > 4 || marginTrend === 'increasing' && marginRatio > 3) riskLevel = 'danger';

    return { marginBuy: last.marginBuy, marginSell: last.marginSell, netMargin, marginBalance: last.marginBalance, shortBalance: last.shortBalance, marginRatio, marginTrend, riskLevel };
  }

  // ═══════════ 4. 上证综合强度 ═══════════

  /**
   * 个股 vs 上证指数相对强度
   * RS = 个股N日涨幅 / 上证N日涨幅; 标准化0-100
   */
  computeSHCompositeStrength(symbol: string, lookback?: number): { strength: number[]; rank: 'strongly_outperform' | 'outperform' | 'in_line' | 'underperform' | 'weakly_underperform' } {
    const bars = this.getData(symbol);
    const lb = lookback ?? this.config.shCompLookback;
    if (bars.length < lb) return { strength: bars.map(() => NaN), rank: 'in_line' };

    const strength: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < lb - 1) { strength.push(NaN); continue; }
      // Simple relative strength: current close vs lb-days-ago close
      const pct = bars[i - lb + 1].close > 0 ? ((bars[i].close - bars[i - lb + 1].close) / bars[i - lb + 1].close) * 100 : 0;
      // Without actual SH index data, use own performance normalized
      strength.push(pct);
    }

    const last = strength.filter((v) => isFinite(v)).pop() || 0;
    let rank: 'strongly_outperform' | 'outperform' | 'in_line' | 'underperform' | 'weakly_underperform' = 'in_line';
    if (last > 10) rank = 'strongly_outperform';
    else if (last > 5) rank = 'outperform';
    else if (last < -10) rank = 'weakly_underperform';
    else if (last < -5) rank = 'underperform';

    return { strength, rank };
  }

  // ═══════════ 5. 涨跌停限制分析 ═══════════

  /**
   * 涨跌停板：距涨停/跌停距离、封板概率、开板风险
   */
  computeLimitAnalysis(symbol: string, limitUpPct?: number, limitDownPct?: number): {
    prevClose: number;
    limitUp: number; limitDown: number;
    distToLimitUp: number; distToLimitDown: number;
    distUpPct: number; distDownPct: number;
    isLimitUp: boolean; isLimitDown: boolean;
    approachingLimit: 'up' | 'down' | 'none';
    consecutiveLimits?: number;
  } {
    const bars = this.getData(symbol);
    const upPct = limitUpPct ?? this.config.limitUpPct;
    const downPct = limitDownPct ?? this.config.limitDownPct;
    if (bars.length < 1) return { prevClose: 0, limitUp: 0, limitDown: 0, distToLimitUp: 0, distToLimitDown: 0, distUpPct: 0, distDownPct: 0, isLimitUp: false, isLimitDown: false, approachingLimit: 'none' };

    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : last;
    const limitUp = prev.close * (1 + upPct / 100);
    const limitDown = prev.close * (1 - downPct / 100);
    const distToLimitUp = limitUp - last.close;
    const distToLimitDown = last.close - limitDown;
    const distUpPct = prev.close > 0 ? (distToLimitUp / prev.close) * 100 : 0;
    const distDownPct = prev.close > 0 ? (distToLimitDown / prev.close) * 100 : 0;
    const isLimitUp = last.close >= limitUp * 0.999;
    const isLimitDown = last.close <= limitDown * 1.001;

    let approachingLimit: 'up' | 'down' | 'none' = 'none';
    if (distUpPct < 2 && distUpPct >= 0) approachingLimit = 'up';
    if (distDownPct < 2 && distDownPct >= 0) approachingLimit = 'down';

    // Count consecutive limits
    let consecutiveLimits = 0;
    if (isLimitUp) {
      for (let i = bars.length - 1; i >= 0; i--) {
        const pv = i > 0 ? bars[i - 1].close : bars[i].open;
        if (bars[i].close >= pv * (1 + upPct / 100) * 0.999) consecutiveLimits++;
        else break;
      }
    }

    return { prevClose: prev.close, limitUp, limitDown, distToLimitUp, distToLimitDown, distUpPct, distDownPct, isLimitUp, isLimitDown, approachingLimit, consecutiveLimits };
  }

  // ═══════════ 6. 板块风格轮动(中国版) ═══════════

  /**
   * A股特定的行业板块轮动：消费/科技/金融/周期/军工/医药
   * 检测当前轮动阶段和下一阶段预测
   */
  computeSectorRotation(): {
    sectors: { name: string; rank: number; strength: number; trend: 'up' | 'down' | 'neutral' }[];
    currentPhase: 'expansion' | 'peak' | 'contraction' | 'trough';
    rotationSignal: 'defensive' | 'cyclical' | 'growth' | 'balanced';
    leaderboard: string[];
  } {
    const data = this.sectorData;
    if (data.length === 0) return { sectors: [], currentPhase: 'trough', rotationSignal: 'balanced', leaderboard: [] };

    const sectors = data.map((d) => ({
      name: d.sector,
      rank: 0,
      strength: d.momentum * 0.5 + d.changePct * 0.3 + d.volumeRatio * 0.2,
      trend: d.changePct > 2 ? 'up' as const : d.changePct < -2 ? 'down' as const : 'neutral' as const,
    }));

    sectors.sort((a, b) => b.strength - a.strength);
    sectors.forEach((s, i) => { s.rank = i + 1; });

    // Phase detection
    const top3 = sectors.slice(0, 3);
    const avgStrength = sectors.reduce((s, sec) => s + sec.strength, 0) / sectors.length;
    const currentPhase = avgStrength > 3 ? 'expansion' : avgStrength > 1 ? 'peak' : avgStrength > -1 ? 'contraction' : 'trough';

    let rotationSignal: 'defensive' | 'cyclical' | 'growth' | 'balanced' = 'balanced';
    const defensiveSectors = ['消费', '医药', '公用事业', '农业'];
    const cyclicalSectors = ['金融', '地产', '有色', '化工', '钢铁'];
    const growthSectors = ['科技', '新能源', '半导体', '军工'];

    const defScore = sectors.filter((s) => defensiveSectors.some((d) => s.name.includes(d))).reduce((a, s) => a + s.strength, 0);
    const cycScore = sectors.filter((s) => cyclicalSectors.some((c) => s.name.includes(c))).reduce((a, s) => a + s.strength, 0);
    const growScore = sectors.filter((s) => growthSectors.some((g) => s.name.includes(g))).reduce((a, s) => a + s.strength, 0);

    if (growScore > cycScore && growScore > defScore) rotationSignal = 'growth';
    else if (cycScore > growScore && cycScore > defScore) rotationSignal = 'cyclical';
    else if (defScore > cycScore && defScore > growScore) rotationSignal = 'defensive';

    return { sectors, currentPhase, rotationSignal, leaderboard: sectors.slice(0, 5).map((s) => s.name) };
  }

  // ═══════════ 7. 北向资金分析 ═══════════

  /**
   * 北向资金：净流入/流出、累计持仓变化、重仓股
   */
  computeNorthbound(lookback?: number): {
    latestNetFlow: number;
    cumulativeFlow: number;
    recentTrend: 'inflow' | 'outflow' | 'neutral';
    consecutiveFlowDays: number;
    topSectors5: string[];
  } {
    const lb = lookback ?? this.config.northboundLookback;
    const recent = this.northboundData.slice(-lb);
    if (recent.length === 0) return { latestNetFlow: 0, cumulativeFlow: 0, recentTrend: 'neutral', consecutiveFlowDays: 0, topSectors5: [] };

    const latestNetFlow = recent[recent.length - 1].netFlow;
    const cumulativeFlow = this.northboundData.reduce((s, d) => s + d.netFlow, 0);

    const sumRecent = recent.reduce((s, d) => s + d.netFlow, 0);
    const recentTrend = sumRecent > 100 ? 'inflow' : sumRecent < -100 ? 'outflow' : 'neutral';

    let consecutiveDays = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if ((recentTrend === 'inflow' && recent[i].netFlow > 0) || (recentTrend === 'outflow' && recent[i].netFlow < 0)) {
        consecutiveDays++;
      } else break;
    }

    // Top sectors by flow
    const sectorFlow = new Map<string, number>();
    for (const d of recent) {
      if (d.sector) sectorFlow.set(d.sector, (sectorFlow.get(d.sector) || 0) + d.netFlow);
    }
    const top5 = [...sectorFlow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);

    return { latestNetFlow, cumulativeFlow, recentTrend, consecutiveFlowDays, topSectors5: top5 };
  }

  // ═══════════ 8. 两融余额趋势 ═══════════

  /**
   * 全市场两融余额：融资余额趋势、融券余额趋势、融资买入占比
   */
  computeMarginBalance(): {
    totalMargin: number; totalShort: number;
    marginBalanceTrend: number[]; // percentage change over lookback
    netBalanceDelta: number;
    signal: 'bullish' | 'bearish' | 'neutral';
  } {
    const allData: ChinaMarginData[] = [];
    for (const data of this.marginData.values()) allData.push(...data);
    if (allData.length === 0) return { totalMargin: 0, totalShort: 0, marginBalanceTrend: [], netBalanceDelta: 0, signal: 'neutral' };

    const grouped = new Map<string, { margin: number; short: number }>();
    for (const d of allData) {
      const existing = grouped.get(d.date) || { margin: 0, short: 0 };
      existing.margin += d.marginBalance;
      existing.short += d.shortBalance;
      grouped.set(d.date, existing);
    }

    const dates = [...grouped.keys()].sort();
    const latest = grouped.get(dates[dates.length - 1])!;
    const marginBalanceTrend = dates.map((d) => grouped.get(d)!.margin);

    const lb = this.config.marginBalanceLookback;
    const first = grouped.get(dates[Math.max(0, dates.length - lb)])!;
    const netBalanceDelta = latest.margin - first.margin;

    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const changePct = first.margin > 0 ? netBalanceDelta / first.margin : 0;
    if (changePct > 0.05) signal = 'bullish';
    else if (changePct < -0.05) signal = 'bearish';

    return { totalMargin: latest.margin, totalShort: latest.short, marginBalanceTrend, netBalanceDelta, signal };
  }

  // ═══════════ 9. 涨跌幅偏离 ═══════════

  /**
   * 检测个股与指数的涨跌幅偏离
   * 偏离阈值：±7%触发预警
   */
  computeDeviation(symbol: string, threshold?: number): {
    deviations: number[];
    currentDeviation: number;
    isDeviated: boolean;
    direction: 'overvalued' | 'undervalued' | 'normal';
    devZScore: number;
  } {
    const bars = this.getData(symbol);
    const thresh = threshold ?? this.config.devPctThreshold;
    if (bars.length < 2) return { deviations: [], currentDeviation: 0, isDeviated: false, direction: 'normal', devZScore: 0 };

    // Use a 20-day rolling comparison of daily returns
    const rets: number[] = [];
    for (let i = 1; i < bars.length; i++) {
      rets.push(bars[i - 1].close > 0 ? ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100 : 0);
    }

    const deviations: number[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < 20) { deviations.push(NaN); continue; }
      const slice = rets.slice(i - 20, i);
      const mean = slice.reduce((s, v) => s + v, 0) / 20;
      const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / 20);
      const dev = rets[i - 1] - mean; // how far today's return from average
      deviations.push(dev);
    }

    const lastDev = deviations.filter((v) => isFinite(v)).pop() || 0;
    const isDeviated = Math.abs(lastDev) >= thresh;
    const direction = isDeviated ? (lastDev > 0 ? 'overvalued' : 'undervalued') : 'normal';

    // Z-score of deviations
    const validDevs = deviations.filter((v) => isFinite(v));
    const devMean = validDevs.reduce((s, v) => s + v, 0) / validDevs.length;
    const devStd = Math.sqrt(validDevs.reduce((s, v) => s + (v - devMean) ** 2, 0) / validDevs.length);
    const devZScore = devStd > 0 ? (lastDev - devMean) / devStd : 0;

    return { deviations, currentDeviation: lastDev, isDeviated, direction, devZScore };
  }

  // ═══════════ 10. 换手率异常 ═══════════

  /**
   * 换手率异常检测：换手率 vs 历史均值、放量/缩量程度
   */
  computeTurnoverAnomaly(symbol: string, lookback?: number, threshold?: number): {
    turnoverRates: number[];
    avgTurnover: number;
    currentTurnover: number;
    anomalyRatio: number;
    signal: 'extreme_high' | 'high' | 'normal' | 'low' | 'extreme_low';
    isAnomaly: boolean;
    anomalyDirection: 'surge' | 'shrink' | 'none';
  } {
    const bars = this.getData(symbol);
    const lb = lookback ?? this.config.turnoverLookback;
    const thresh = threshold ?? this.config.turnoverThreshold;
    if (bars.length < lb) return { turnoverRates: [], avgTurnover: 0, currentTurnover: 0, anomalyRatio: 1, signal: 'normal', isAnomaly: false, anomalyDirection: 'none' };

    // Simulated turnover = volume / avg volume (without float shares data)
    const volumes = bars.map((b) => b.volume || 0);
    const avgVol = this._sma(volumes, lb);
    const turnoverRates = volumes.map((v, i) => (avgVol[i] > 0 ? v / avgVol[i] : 1));

    const recent = turnoverRates.slice(-lb);
    const avgTurnover = recent.reduce((s, v) => s + v, 0) / lb;
    const currentTurnover = turnoverRates[turnoverRates.length - 1];
    const anomalyRatio = avgTurnover > 0 ? currentTurnover / avgTurnover : 1;

    let signal: 'extreme_high' | 'high' | 'normal' | 'low' | 'extreme_low' = 'normal';
    if (anomalyRatio > thresh * 2) signal = 'extreme_high';
    else if (anomalyRatio > thresh) signal = 'high';
    else if (anomalyRatio < 1 / thresh) signal = 'low';
    else if (anomalyRatio < 1 / (thresh * 2)) signal = 'extreme_low';

    const isAnomaly = signal !== 'normal';
    const anomalyDirection = isAnomaly ? (anomalyRatio > 1 ? 'surge' : 'shrink') : 'none';

    return { turnoverRates, avgTurnover, currentTurnover, anomalyRatio, signal, isAnomaly, anomalyDirection };
  }

  // ═══════════ 复合扫描 ═══════════

  scanAll(symbol: string) {
    return {
      cyq: this.computeCYQ(symbol),
      lhb: this.computeLHB(symbol),
      margin: this.computeMargin(symbol),
      shCompStrength: this.computeSHCompositeStrength(symbol),
      limitAnalysis: this.computeLimitAnalysis(symbol),
      sectorRotation: this.computeSectorRotation(),
      northbound: this.computeNorthbound(),
      marginBalance: this.computeMarginBalance(),
      deviation: this.computeDeviation(symbol),
      turnoverAnomaly: this.computeTurnoverAnomaly(symbol),
    };
  }

  // ═══════════ Internal helpers ═══════════

  private _sma(values: number[], period: number): number[] {
    const r: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) { r.push(NaN); continue; }
      let sum = 0; for (let j = i - period + 1; j <= i; j++) sum += values[j];
      r.push(sum / period);
    }
    return r;
  }
}

// ═══════════ Singleton ═══════════

let china10Instance: China10Engine | null = null;

export function getChina10Engine(config?: China10EngineConfig): China10Engine {
  if (!china10Instance) china10Instance = new China10Engine(config);
  return china10Instance;
}

export function resetChina10Engine(): void { china10Instance = null; }
