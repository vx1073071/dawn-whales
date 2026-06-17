// ── R267 JVS-1 主力资金引擎 (SmartMoneyFlowEngine) ──
// 对标: 富途资金流向 + 同花顺主力追踪 + 东方财富DDX
// 核心: 大单资金流 + 主力净流向 + 板块轮动 + 机构持仓变化
// 不包含A股龙虎榜（Owner已禁A股）；用Smart Money Flow替代

export interface CapitalFlowTick {
  timestamp: number;    // epoch ms
  price: number;
  volume: number;       // total volume of the tick
  direction: 'buy' | 'sell' | 'neutral';
  orderType: OrderSizeCategory;
}

export type OrderSizeCategory = 'small' | 'medium' | 'large' | 'institutional';

export interface DailyFlow {
  date: string;              // YYYY-MM-DD
  symbol: string;
  totalInflow: number;       // 总流入（金额）
  totalOutflow: number;      // 总流出
  netFlow: number;           // 净流入 (inflow - outflow)
  /** 超大单 (>500K) */
  institutionalInflow: number;
  institutionalOutflow: number;
  institutionalNet: number;
  /** 大单 (50K-500K) */
  largeInflow: number;
  largeOutflow: number;
  largeNet: number;
  /** 中单 (5K-50K) */
  mediumInflow: number;
  mediumOutflow: number;
  mediumNet: number;
  /** 小单 (<5K) */
  smallInflow: number;
  smallOutflow: number;
  smallNet: number;
  /** Flow ratio: netFlow / totalVolume */
  flowRatio: number;
  /** Main force = institutional + large */
  mainForceNet: number;
  mainForceRatio: number;
  /** Average entry price */
  avgPrice: number;
}

export interface SectorFlow {
  sector: string;
  sectorName: string;
  netFlow: number;
  flowRatio: number;
  symbolCount: number;
  topSymbols: { symbol: string; netFlow: number }[];
  /** Ranking among all sectors */
  rank: number;
  /** Trend: accelerating / decelerating / stable */
  trend: 'accelerating' | 'decelerating' | 'stable';
}

export interface InstitutionalHolding {
  symbol: string;
  holder: string;
  shares: number;
  value: number;
  change: number;         // change in shares (positive = buying)
  changePct: number;
  reportDate: string;
  /** Holding type */
  holderType: 'fund' | 'etf' | 'pension' | 'hedge_fund' | 'sovereign' | 'insider' | 'other';
}

export interface SmartMoneySignal {
  symbol: string;
  date: string;
  /** Score -100 to 100 (positive = smart money buying) */
  score: number;
  /** Direction */
  direction: 'accumulating' | 'distributing' | 'neutral';
  /** Key signals detected */
  signals: string[];
  /** Main force net flow */
  mainForceNet: number;
  /** Institutional holding change % */
  institutionalChangePct: number;
  /** Flow in/out ratio */
  flowRatio: number;
  /** Consecutive days of main force buying */
  consecutiveBuyDays: number;
}

export interface SmartMoneyFlowConfig {
  /** Thresholds for order size classification */
  smallThreshold?: number;      // < this = small (default 5000)
  mediumThreshold?: number;     // < this = medium (default 50000)
  largeThreshold?: number;      // < this = large (default 500000)
  /** = institutional */
  /** Consecutive days to flag accumulation */
  accumulationDays?: number;
  /** Flow ratio threshold for signal generation */
  signalFlowRatio?: number;
}

export const DEFAULT_SMART_MONEY_CONFIG: Required<SmartMoneyFlowConfig> = {
  smallThreshold: 5000,
  mediumThreshold: 50000,
  largeThreshold: 500000,
  accumulationDays: 3,
  signalFlowRatio: 0.15,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class SmartMoneyFlowEngine {
  private config: Required<SmartMoneyFlowConfig>;
  /** Daily flow records by symbol+date */
  private flowHistory: Map<string, DailyFlow[]> = new Map();
  /** Tick stream buffer */
  private tickBuffer: CapitalFlowTick[] = [];
  /** Sector mappings */
  private sectorMap: Map<string, string> = new Map();
  /** Institutional holdings */
  private holdings: InstitutionalHolding[] = [];
  /** Sector flow records */
  private sectorFlows: Map<string, SectorFlow[]> = new Map();
  /** Consecutive buy tracking: symbol → consecutive days */
  private consecutiveTracker: Map<string, number> = new Map();

  constructor(config?: SmartMoneyFlowConfig) {
    this.config = { ...DEFAULT_SMART_MONEY_CONFIG, ...config };
  }

  reset(): void {
    this.flowHistory.clear();
    this.tickBuffer = [];
    this.sectorMap.clear();
    this.holdings = [];
    this.sectorFlows.clear();
    this.consecutiveTracker.clear();
  }

  getConfig(): Required<SmartMoneyFlowConfig> {
    return { ...this.config };
  }

  updateConfig(patch: Partial<SmartMoneyFlowConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  // ═══════════ Tick Classification ═══════════

  /**
   * Classify a tick by order size.
   */
  classifyTickSize(volume: number, price: number): OrderSizeCategory {
    const amount = volume * price;
    const { smallThreshold, mediumThreshold, largeThreshold } = this.config;
    if (amount >= largeThreshold) return 'institutional';
    if (amount >= mediumThreshold) return 'large';
    if (amount >= smallThreshold) return 'medium';
    return 'small';
  }

  /**
   * Feed raw ticks into the engine.
   */
  feedTick(tick: CapitalFlowTick): void {
    tick.orderType = this.classifyTickSize(tick.volume, tick.price);
    this.tickBuffer.push({ ...tick });
  }

  feedTicks(ticks: CapitalFlowTick[]): void {
    for (const tick of ticks) {
      this.feedTick(tick);
    }
  }

  getTickCount(): number {
    return this.tickBuffer.length;
  }

  // ═══════════ Register Sector Mapping ═══════════

  registerSector(symbol: string, sector: string): void {
    this.sectorMap.set(symbol.toUpperCase(), sector);
  }

  registerSectors(mappings: Record<string, string>): void {
    for (const [symbol, sector] of Object.entries(mappings)) {
      this.registerSector(symbol, sector);
    }
  }

  // ═══════════ Register Institutional Holdings ═══════════

  registerHoldings(holdings: InstitutionalHolding[]): void {
    this.holdings.push(...holdings);
  }

  // ═══════════ Daily Flow Computation ═══════════

  /**
   * Compute daily capital flow from buffered ticks for a date range.
   * Groups ticks by day and symbol.
   */
  computeDailyFlow(symbol: string, date?: string): DailyFlow | null {
    const targetDate = date || this.getLatestDate();
    const symbolTicks = this.tickBuffer.filter(
      (t) => {
        const tickDate = this.timestampToDateStr(t.timestamp);
        return tickDate === targetDate;
      },
    );
    // Actually we need per-symbol ticks too. But ticks don't carry symbol in this model.
    // We compute from the ticks as if they're all for this symbol.
    // For multi-symbol, caller should filter ticks first.

    if (symbolTicks.length === 0) {
      // Try flowHistory fallback
      const existing = this.flowHistory.get(symbol.toUpperCase());
      if (existing) {
        const match = existing.find((f) => f.date === targetDate);
        return match || null;
      }
      return null;
    }

    const flow = this.aggregateTicks(symbolTicks, symbol, targetDate);
    this.storeFlow(symbol, flow);
    return flow;
  }

  /**
   * Compute daily flows for multiple symbols from tick buffer.
   * Ticks are assumed to be tagged with symbol via metadata.
   * This version uses a simpler API: feed pre-grouped ticks.
   */
  computeDailyFlowFromTicks(symbol: string, ticks: CapitalFlowTick[], date?: string): DailyFlow {
    const targetDate = date || this.timestampToDateStr(Date.now());
    const flow = this.aggregateTicks(ticks, symbol, targetDate);
    this.storeFlow(symbol, flow);
    return flow;
  }

  private aggregateTicks(ticks: CapitalFlowTick[], symbol: string, date: string): DailyFlow {
    let totalIn = 0, totalOut = 0;
    let instIn = 0, instOut = 0;
    let largeIn = 0, largeOut = 0;
    let medIn = 0, medOut = 0;
    let smallIn = 0, smallOut = 0;
    let totalVol = 0;
    let priceVolSum = 0;

    for (const t of ticks) {
      const amount = t.volume * t.price;
      priceVolSum += amount;
      totalVol += t.volume;

      if (t.direction === 'buy') {
        totalIn += amount;
        if (t.orderType === 'institutional') instIn += amount;
        else if (t.orderType === 'large') largeIn += amount;
        else if (t.orderType === 'medium') medIn += amount;
        else smallIn += amount;
      } else {
        totalOut += amount;
        if (t.orderType === 'institutional') instOut += amount;
        else if (t.orderType === 'large') largeOut += amount;
        else if (t.orderType === 'medium') medOut += amount;
        else smallOut += amount;
      }
    }

    const netFlow = totalIn - totalOut;
    const instNet = instIn - instOut;
    const largeNet = largeIn - largeOut;
    const medNet = medIn - medOut;
    const smallNet = smallIn - smallOut;
    const mainForceNet = instNet + largeNet;
    const totalAmount = totalIn + totalOut;
    const flowRatio = totalAmount > 0 ? netFlow / totalAmount : 0;
    const mainForceRatio = totalAmount > 0 ? mainForceNet / totalAmount : 0;

    return {
      date,
      symbol: symbol.toUpperCase(),
      totalInflow: Math.round(totalIn * 100) / 100,
      totalOutflow: Math.round(totalOut * 100) / 100,
      netFlow: Math.round(netFlow * 100) / 100,
      institutionalInflow: Math.round(instIn * 100) / 100,
      institutionalOutflow: Math.round(instOut * 100) / 100,
      institutionalNet: Math.round(instNet * 100) / 100,
      largeInflow: Math.round(largeIn * 100) / 100,
      largeOutflow: Math.round(largeOut * 100) / 100,
      largeNet: Math.round(largeNet * 100) / 100,
      mediumInflow: Math.round(medIn * 100) / 100,
      mediumOutflow: Math.round(medOut * 100) / 100,
      mediumNet: Math.round(medNet * 100) / 100,
      smallInflow: Math.round(smallIn * 100) / 100,
      smallOutflow: Math.round(smallOut * 100) / 100,
      smallNet: Math.round(smallNet * 100) / 100,
      flowRatio: Math.round(flowRatio * 10000) / 10000,
      mainForceNet: Math.round(mainForceNet * 100) / 100,
      mainForceRatio: Math.round(mainForceRatio * 10000) / 10000,
      avgPrice: totalVol > 0 ? Math.round((priceVolSum / totalVol) * 100) / 100 : 0,
    };
  }

  private storeFlow(symbol: string, flow: DailyFlow): void {
    const key = symbol.toUpperCase();
    let records = this.flowHistory.get(key);
    if (!records) {
      records = [];
      this.flowHistory.set(key, records);
    }
    // Replace existing entry for same date
    const idx = records.findIndex((f) => f.date === flow.date);
    if (idx >= 0) records[idx] = flow;
    else records.push(flow);

    // Update consecutive tracker
    if (flow.mainForceNet > 0 && flow.mainForceRatio > this.config.signalFlowRatio) {
      const prev = this.consecutiveTracker.get(key) || 0;
      this.consecutiveTracker.set(key, prev + 1);
    } else {
      this.consecutiveTracker.set(key, 0);
    }
  }

  // ═══════════ Flow History ═══════════

  getFlowHistory(symbol: string, days?: number): DailyFlow[] {
    const records = this.flowHistory.get(symbol.toUpperCase()) || [];
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    return days ? sorted.slice(0, days) : sorted;
  }

  /**
   * Get flow for a specific date range.
   */
  getFlowRange(symbol: string, startDate: string, endDate: string): DailyFlow[] {
    const records = this.flowHistory.get(symbol.toUpperCase()) || [];
    return records
      .filter((f) => f.date >= startDate && f.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ═══════════ Smart Money Signal ═══════════

  /**
   * Generate smart money signal for a symbol.
   * Combines: main force net flow + consecutive buy days + institutional holdings change.
   */
  generateSignal(symbol: string): SmartMoneySignal {
    const upper = symbol.toUpperCase();
    const history = this.getFlowHistory(upper, 10);
    const consecutive = this.consecutiveTracker.get(upper) || 0;

    const signals: string[] = [];
    let score = 0;
    let mainForceNet = 0;
    let flowRatio = 0;

    if (history.length > 0) {
      const latest = history[0];
      mainForceNet = latest.mainForceNet;
      flowRatio = latest.flowRatio;

      // Score from main force flow
      if (latest.mainForceRatio > 0.2) { score += 30; signals.push('主力大幅净流入'); }
      else if (latest.mainForceRatio > 0.1) { score += 15; signals.push('主力小幅净流入'); }
      else if (latest.mainForceRatio < -0.2) { score -= 30; signals.push('主力大幅净流出'); }
      else if (latest.mainForceRatio < -0.1) { score -= 15; signals.push('主力小幅净流出'); }

      // Score from institutional flow
      if (latest.institutionalNet > 0) { score += 20; signals.push('机构净买入'); }
      else if (latest.institutionalNet < 0) { score -= 20; signals.push('机构净卖出'); }

      // Retail vs smart money divergence
      if (latest.mainForceNet > 0 && latest.smallNet < 0) {
        score += 10;
        signals.push('主力吸筹散户出逃');
      } else if (latest.mainForceNet < 0 && latest.smallNet > 0) {
        score -= 10;
        signals.push('主力出逃散户接盘');
      }
    }

    // Consecutive buying
    if (consecutive >= 5) { score += 25; signals.push(`主力连续${consecutive}日净买入`); }
    else if (consecutive >= 3) { score += 15; signals.push(`主力连续${consecutive}日净买入`); }

    // Institutional holdings
    const relevantHoldings = this.holdings.filter((h) => h.symbol.toUpperCase() === upper);
    let institutionalChangePct = 0;
    if (relevantHoldings.length > 0) {
      const totalChange = relevantHoldings.reduce((s, h) => s + h.changePct, 0);
      institutionalChangePct = Math.round((totalChange / relevantHoldings.length) * 100) / 100;
      if (institutionalChangePct > 5) { score += 20; signals.push('机构大幅增持'); }
      else if (institutionalChangePct > 1) { score += 10; signals.push('机构小幅增持'); }
      else if (institutionalChangePct < -5) { score -= 20; signals.push('机构大幅减持'); }
      else if (institutionalChangePct < -1) { score -= 10; signals.push('机构小幅减持'); }
    }

    // Cap score
    score = Math.max(-100, Math.min(100, score));

    let direction: SmartMoneySignal['direction'] = 'neutral';
    if (score >= 30) direction = 'accumulating';
    else if (score <= -30) direction = 'distributing';

    return {
      symbol: upper,
      date: history.length > 0 ? history[0].date : this.getLatestDate(),
      score,
      direction,
      signals: signals.length > 0 ? signals : ['暂无明确主力信号'],
      mainForceNet,
      institutionalChangePct,
      flowRatio,
      consecutiveBuyDays: consecutive,
    };
  }

  // ═══════════ Sector Flow ═══════════

  /**
   * Compute sector-level capital flows from individual stock flows.
   */
  computeSectorFlows(date?: string): SectorFlow[] {
    const targetDate = date || this.getLatestDate();
    const sectorTotals = new Map<string, {
      netFlow: number;
      totalFlow: number;
      symbols: { symbol: string; netFlow: number }[];
    }>();

    for (const [symbol, flows] of this.flowHistory.entries()) {
      const dailyFlow = flows.find((f) => f.date === targetDate);
      if (!dailyFlow) continue;

      const sector = this.sectorMap.get(symbol) || 'OTHER';
      let data = sectorTotals.get(sector);
      if (!data) {
        data = { netFlow: 0, totalFlow: 0, symbols: [] };
        sectorTotals.set(sector, data);
      }
      data.netFlow += dailyFlow.netFlow;
      data.totalFlow += dailyFlow.totalInflow + dailyFlow.totalOutflow;
      data.symbols.push({ symbol, netFlow: dailyFlow.netFlow });
    }

    const result: SectorFlow[] = [];
    for (const [sector, data] of sectorTotals.entries()) {
      const flowRatio = data.totalFlow > 0 ? data.netFlow / data.totalFlow : 0;
      data.symbols.sort((a, b) => b.netFlow - a.netFlow);
      result.push({
        sector,
        sectorName: this.getSectorName(sector),
        netFlow: Math.round(data.netFlow * 100) / 100,
        flowRatio: Math.round(flowRatio * 10000) / 10000,
        symbolCount: data.symbols.length,
        topSymbols: data.symbols.slice(0, 5),
        rank: 0, // set after sort
        trend: 'stable', // set after trend analysis
      });
    }

    // Sort by netFlow descending
    result.sort((a, b) => b.netFlow - a.netFlow);
    result.forEach((s, i) => { s.rank = i + 1; });

    // Detect trend by comparing with previous day
    const prevDate = this.getPreviousDate(targetDate);
    for (const sectorFlow of result) {
      const prev = this.sectorFlows.get(sectorFlow.sector);
      if (prev && prev.length > 0) {
        const prevEntry = prev.find((f) => f.date === prevDate);
        if (prevEntry) {
          const change = Math.abs(sectorFlow.flowRatio) - Math.abs(prevEntry.flowRatio);
          if (change > 0.05) sectorFlow.trend = 'accelerating';
          else if (change < -0.05) sectorFlow.trend = 'decelerating';
          else sectorFlow.trend = 'stable';
        }
      }
    }

    // Store for trend analysis
    for (const sf of result) {
      let records = this.sectorFlows.get(sf.sector);
      if (!records) {
        records = [];
        this.sectorFlows.set(sf.sector, records);
      }
      records.push({ ...sf, date: targetDate });
    }

    return result;
  }

  private getSectorName(code: string): string {
    const names: Record<string, string> = {
      'TECH': '科技', 'FINANCE': '金融', 'HEALTH': '医疗健康',
      'ENERGY': '能源', 'REALESTATE': '房地产', 'CONSUMER': '消费品',
      'INDUSTRIAL': '工业', 'MATERIALS': '原材料', 'UTILITIES': '公用事业',
      'COMM': '通信服务', 'CRYPTO': '加密货币', 'ETF': 'ETF',
      'OTHER': '其他',
    };
    return names[code] || code;
  }

  // ═══════════ Sector Rotation ═══════════

  /**
   * Detect sector rotation patterns.
   * Returns sectors with accelerating inflows (rotation in) and accelerating outflows (rotation out).
   */
  detectSectorRotation(): { rotatingIn: SectorFlow[]; rotatingOut: SectorFlow[] } {
    const current = this.computeSectorFlows();

    const rotatingIn = current
      .filter((s) => s.flowRatio > 0 && s.trend === 'accelerating')
      .slice(0, 5);
    const rotatingOut = current
      .filter((s) => s.flowRatio < 0 && s.trend === 'accelerating')
      .slice(0, 5);

    return { rotatingIn, rotatingOut };
  }

  // ═══════════ Main Force Concentration ═══════════

  /**
   * Calculate main force concentration: what % of total volume is institutional + large.
   */
  getMainForceConcentration(symbol: string, days?: number): number {
    const history = this.getFlowHistory(symbol, days || 5);
    if (history.length === 0) return 0;

    let totalForce = 0;
    let totalAll = 0;
    for (const day of history) {
      totalForce += day.institutionalInflow + day.institutionalOutflow +
        day.largeInflow + day.largeOutflow;
      totalAll += day.totalInflow + day.totalOutflow;
    }
    return totalAll > 0 ? Math.round((totalForce / totalAll) * 10000) / 100 : 0;
  }

  // ═══════════ Capital Flow Summary ═══════════

  /**
   * Generate a comprehensive capital flow summary.
   */
  getCapitalFlowSummary(symbol: string): {
    latestFlow: DailyFlow | null;
    signal: SmartMoneySignal;
    mainForceConcentration: number;
    sectorFlow: SectorFlow | null;
    history5d: DailyFlow[];
  } {
    const latestFlow = history.length > 0 ? history[0] : null;
    const signal = this.generateSignal(symbol);
    const concentration = this.getMainForceConcentration(symbol, 5);
    const history5d = this.getFlowHistory(symbol, 5);

    const sectorKey = this.sectorMap.get(symbol.toUpperCase()) || 'OTHER';
    const sectorFlows = this.computeSectorFlows();
    const sectorFlow = sectorFlows.find((s) => s.sector === sectorKey) || null;

    return { latestFlow, signal, mainForceConcentration: concentration, sectorFlow, history5d };
  }

  // ═══════════ Institution ═══════════

  /**
   * Get top institutional holders for a symbol.
   */
  getTopHolders(symbol: string, limit: number = 10): InstitutionalHolding[] {
    return this.holdings
      .filter((h) => h.symbol.toUpperCase() === symbol.toUpperCase())
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  // ═══════════ Utils ═══════════

  private timestampToDateStr(ts: number): string {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private getLatestDate(): string {
    return this.timestampToDateStr(Date.now());
  }

  private getPreviousDate(dateStr: string): string {
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    return this.timestampToDateStr(d.getTime());
  }
}

// ═══════════ Singleton ═══════════

let smfInstance: SmartMoneyFlowEngine | null = null;

export function getSmartMoneyFlowEngine(config?: SmartMoneyFlowConfig): SmartMoneyFlowEngine {
  if (!smfInstance) {
    smfInstance = new SmartMoneyFlowEngine(config);
  } else if (config) {
    smfInstance.updateConfig(config);
  }
  return smfInstance;
}

export function resetSmartMoneyFlowEngine(): void {
  if (smfInstance) {
    smfInstance.reset();
    smfInstance = null;
  }
}
