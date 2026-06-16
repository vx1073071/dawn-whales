/**
 * CapitalFlowEngine — R257 QUANT MOO P1-3
 *
 * 资金流向分析引擎。追踪主力资金、游资、散户的三日流向，
 * 支持龙虎榜数据聚合、北上/南下资金、行业资金轮动。
 *
 * Feature set:
 *   - 三类资金: 主力(>1000万) / 游资(10万-1000万) / 散户(<10万)
 *   - 三日流向: Day1 / Day2 / Day3 净流入/净流出
 *   - 龙虎榜: 上榜个股+买卖席位+净买额
 *   - 行业轮动: 板块资金流入/流出排行
 *   - 北上南下: 沪深港通资金
 *   - 资金强度评分 (0-100)
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Streaming data ingestion
 *   - Aggregated 3-day rolling window
 *   - Mock data injection
 *
 * @author JVS
 * @round R257
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type FlowCategory = 'major' | 'hot_money' | 'retail';

export type FlowDirection = 'inflow' | 'outflow';

export type MarketConnect = 'north' | 'south'; // 北上(沪港通北上), 南下(港股通南下)

export interface CapitalTick {
  symbol: string;
  category: FlowCategory;
  amount: number;        // in currency unit
  direction: FlowDirection;
  price: number;
  volume: number;
  timestamp: number;
  market: string;
  sector?: string;
}

export interface DailyFlow {
  date: string;          // YYYY-MM-DD
  symbol: string;
  majorInflow: number;
  majorOutflow: number;
  hotMoneyInflow: number;
  hotMoneyOutflow: number;
  retailInflow: number;
  retailOutflow: number;
  netFlow: number;       // total net
  majorNet: number;
  hotMoneyNet: number;
  retailNet: number;
}

export interface ThreeDayFlow {
  symbol: string;
  day1: DailyFlow;
  day2: DailyFlow;
  day3: DailyFlow;
  threeDayNet: number;
  trend: 'accelerating_inflow' | 'decelerating_inflow' | 'accelerating_outflow' | 'decelerating_outflow' | 'turning_inflow' | 'turning_outflow' | 'stable';
  strengthScore: number; // 0-100
}

export interface DragonTigerEntry {
  symbol: string;
  date: string;
  rank: number;
  buySeats: Array<{ broker: string; amount: number }>;
  sellSeats: Array<{ broker: string; amount: number }>;
  netBuy: number;
  reason: string;       // 涨跌幅偏离值/换手率/连续三日等
  changePct: number;
}

export interface SectorFlow {
  sector: string;
  netFlow: number;
  topSymbols: string[];
  rank: number;
}

export interface MarketConnectFlow {
  type: MarketConnect;
  date: string;
  netFlow: number;
  buyAmount: number;
  sellAmount: number;
  topSymbols: string[];
  quotaRemaining: number;
  quotaTotal: number;
}

export interface CapitalFlowReport {
  generatedAt: number;
  topInflow: ThreeDayFlow[];
  topOutflow: ThreeDayFlow[];
  dragonTiger: DragonTigerEntry[];
  sectorFlows: SectorFlow[];
  connectFlows: MarketConnectFlow[];
  marketBreadth: { inflowStocks: number; outflowStocks: number; neutralStocks: number };
}

// ─── Engine ──────────────────────────────────────────────

export class CapitalFlowEngine extends EventEmitter {
  private static instance: CapitalFlowEngine;

  private dailyFlows: Map<string, DailyFlow> = new Map(); // key = date:symbol
  private ticks: CapitalTick[] = [];
  private dragonTigerEntries: DragonTigerEntry[] = [];
  private sectorFlows: SectorFlow[] = [];
  private connectFlows: MarketConnectFlow[] = [];
  private idCounter = 0;

  constructor() { super(); }

  static getInstance(): CapitalFlowEngine {
    if (!CapitalFlowEngine.instance) {
      CapitalFlowEngine.instance = new CapitalFlowEngine();
    }
    return CapitalFlowEngine.instance;
  }

  reset(): void {
    this.dailyFlows.clear();
    this.ticks = [];
    this.dragonTigerEntries = [];
    this.sectorFlows = [];
    this.connectFlows = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Tick Ingestion ────────────────────────────────────

  ingest(tick: CapitalTick): void {
    this.ticks.push(tick);
    const date = toDateStr(tick.timestamp);
    const key = `${date}:${tick.symbol}`;
    let flow = this.dailyFlows.get(key);

    if (!flow) {
      flow = {
        date, symbol: tick.symbol,
        majorInflow: 0, majorOutflow: 0,
        hotMoneyInflow: 0, hotMoneyOutflow: 0,
        retailInflow: 0, retailOutflow: 0,
        netFlow: 0, majorNet: 0, hotMoneyNet: 0, retailNet: 0,
      };
      this.dailyFlows.set(key, flow);
    }

    const isInflow = tick.direction === 'inflow';
    switch (tick.category) {
      case 'major':
        if (isInflow) flow.majorInflow += tick.amount;
        else flow.majorOutflow += tick.amount;
        break;
      case 'hot_money':
        if (isInflow) flow.hotMoneyInflow += tick.amount;
        else flow.hotMoneyOutflow += tick.amount;
        break;
      case 'retail':
        if (isInflow) flow.retailInflow += tick.amount;
        else flow.retailOutflow += tick.amount;
        break;
    }

    flow.majorNet = flow.majorInflow - flow.majorOutflow;
    flow.hotMoneyNet = flow.hotMoneyInflow - flow.hotMoneyOutflow;
    flow.retailNet = flow.retailInflow - flow.retailOutflow;
    flow.netFlow = flow.majorNet + flow.hotMoneyNet + flow.retailNet;

    this.emit('tick', tick);
  }

  ingestBatch(ticks: CapitalTick[]): void {
    for (const t of ticks) this.ingest(t);
    this.emit('batch_done', ticks.length);
  }

  // ─── 3-Day Flow ────────────────────────────────────────

  getThreeDayFlow(symbol: string, endDate: Date = new Date()): ThreeDayFlow | null {
    const dates = getLast3Dates(endDate);
    const flows: DailyFlow[] = [];

    for (const d of dates) {
      const flow = this.dailyFlows.get(`${d}:${symbol}`);
      if (!flow) return null;
      flows.push(flow);
    }

    const [d1, d2, d3] = flows;
    const threeDayNet = d1.netFlow + d2.netFlow + d3.netFlow;
    const trend = this.calcTrend(d1, d2, d3);
    const strengthScore = this.calcStrength(d1, d2, d3);

    return { symbol, day1: d1, day2: d2, day3: d3, threeDayNet, trend, strengthScore };
  }

  getTopInflow(limit = 10): ThreeDayFlow[] {
    const all: ThreeDayFlow[] = [];
    const seen = new Set<string>();
    for (const [key] of this.dailyFlows) {
      const symbol = key.split(':')[1];
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      const flow = this.getThreeDayFlow(symbol);
      if (flow) all.push(flow);
    }
    return all.sort((a, b) => b.threeDayNet - a.threeDayNet).slice(0, limit);
  }

  getTopOutflow(limit = 10): ThreeDayFlow[] {
    const all: ThreeDayFlow[] = [];
    const seen = new Set<string>();
    for (const [key] of this.dailyFlows) {
      const symbol = key.split(':')[1];
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      const flow = this.getThreeDayFlow(symbol);
      if (flow && flow.threeDayNet < 0) all.push(flow);
    }
    return all.sort((a, b) => a.threeDayNet - b.threeDayNet).slice(0, limit);
  }

  private calcTrend(d1: DailyFlow, d2: DailyFlow, d3: DailyFlow): ThreeDayFlow['trend'] {
    const nets = [d1.netFlow, d2.netFlow, d3.netFlow];
    if (nets[0] > 0 && nets[1] > 0 && nets[2] > 0) {
      if (nets[2] > nets[1] && nets[1] > nets[0]) return 'accelerating_inflow';
      if (nets[2] < nets[1] && nets[1] < nets[0]) return 'decelerating_inflow';
      return 'stable';
    }
    if (nets[0] < 0 && nets[1] < 0 && nets[2] < 0) {
      if (nets[2] < nets[1] && nets[1] < nets[0]) return 'accelerating_outflow';
      if (nets[2] > nets[1] && nets[1] > nets[0]) return 'decelerating_outflow';
      return 'stable';
    }
    if (nets[0] < 0 && nets[1] < 0 && nets[2] > 0) return 'turning_inflow';
    if (nets[0] > 0 && nets[1] > 0 && nets[2] < 0) return 'turning_outflow';
    return 'stable';
  }

  private calcStrength(d1: DailyFlow, d2: DailyFlow, d3: DailyFlow): number {
    const totalVol = [d1, d2, d3].reduce((s, d) =>
      s + d.majorInflow + d.majorOutflow + d.hotMoneyInflow + d.hotMoneyOutflow + d.retailInflow + d.retailOutflow, 0);
    if (totalVol === 0) return 0;
    const majorShare = (d1.majorNet + d2.majorNet + d3.majorNet) / totalVol;
    const netShare = (d1.netFlow + d2.netFlow + d3.netFlow) / totalVol;
    const score = Math.abs(netShare * 50 + majorShare * 30);
    return Math.min(100, Math.round(Math.max(0, score * 100)));
  }

  // ─── Dragon Tiger ──────────────────────────────────────

  addDragonTiger(entry: DragonTigerEntry): void {
    this.dragonTigerEntries.push(entry);
    this.emit('dragon_tiger', entry);
  }

  getDragonTiger(date?: string): DragonTigerEntry[] {
    if (!date) return this.dragonTigerEntries;
    return this.dragonTigerEntries.filter(e => e.date === date);
  }

  getTopDragonTiger(limit = 10): DragonTigerEntry[] {
    return [...this.dragonTigerEntries]
      .sort((a, b) => b.netBuy - a.netBuy)
      .slice(0, limit);
  }

  // ─── Sector Flow ───────────────────────────────────────

  setSectorFlows(flows: SectorFlow[]): void {
    this.sectorFlows = flows.sort((a, b) => b.netFlow - a.netFlow);
  }

  getSectorFlows(): SectorFlow[] { return this.sectorFlows; }
  getTopSectorInflow(limit = 5): SectorFlow[] { return this.sectorFlows.filter(s => s.netFlow > 0).slice(0, limit); }
  getTopSectorOutflow(limit = 5): SectorFlow[] { return this.sectorFlows.filter(s => s.netFlow < 0).reverse().slice(0, limit); }

  // ─── Market Connect ────────────────────────────────────

  setConnectFlows(flows: MarketConnectFlow[]): void {
    this.connectFlows = flows;
  }

  getConnectFlows(): MarketConnectFlow[] { return this.connectFlows; }

  // ─── Report ────────────────────────────────────────────

  generateReport(): CapitalFlowReport {
    return {
      generatedAt: Date.now(),
      topInflow: this.getTopInflow(10),
      topOutflow: this.getTopOutflow(10),
      dragonTiger: this.getTopDragonTiger(10),
      sectorFlows: this.getSectorFlows(),
      connectFlows: this.getConnectFlows(),
      marketBreadth: this.calcBreadth(),
    };
  }

  private calcBreadth(): { inflowStocks: number; outflowStocks: number; neutralStocks: number } {
    const seen = new Map<string, number>();
    for (const [, flow] of this.dailyFlows) {
      const curr = seen.get(flow.symbol) ?? 0;
      seen.set(flow.symbol, curr + flow.netFlow);
    }
    let inflow = 0, outflow = 0, neutral = 0;
    for (const [, net] of seen) {
      if (net > 1000000) inflow++;
      else if (net < -1000000) outflow++;
      else neutral++;
    }
    return { inflowStocks: inflow, outflowStocks: outflow, neutralStocks: neutral };
  }

  // ─── Queries ───────────────────────────────────────────

  getDailyFlow(symbol: string, date: string): DailyFlow | undefined {
    return this.dailyFlows.get(`${date}:${symbol}`);
  }

  getTickCount(): number { return this.ticks.length; }

  // ─── Mock ──────────────────────────────────────────────

  createMockData(): void {
    const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'META'];
    const today = new Date();
    const dates = [getDateStr(today, -2), getDateStr(today, -1), getDateStr(today, 0)];

    for (const symbol of symbols) {
      for (const date of dates) {
        const isInflow = Math.random() > 0.3;
        const majorAmt = Math.round(Math.random() * 50000000);
        const hmAmt = Math.round(Math.random() * 20000000);
        const retailAmt = Math.round(Math.random() * 10000000);

        this.ingest({ symbol, category: 'major', amount: majorAmt, direction: isInflow ? 'inflow' : 'outflow', price: 100 + Math.random() * 400, volume: 1000000, timestamp: new Date(date).getTime(), market: 'US' });
        this.ingest({ symbol, category: 'hot_money', amount: hmAmt, direction: isInflow ? 'inflow' : 'outflow', price: 100 + Math.random() * 400, volume: 500000, timestamp: new Date(date).getTime(), market: 'US' });
        this.ingest({ symbol, category: 'retail', amount: retailAmt, direction: Math.random() > 0.4 ? 'inflow' : 'outflow', price: 100 + Math.random() * 400, volume: 200000, timestamp: new Date(date).getTime(), market: 'US' });
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────

function toDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateStr(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return toDateStr(d.getTime());
}

function getLast3Dates(end: Date): string[] {
  return [getDateStr(end, -2), getDateStr(end, -1), getDateStr(end, 0)];
}
