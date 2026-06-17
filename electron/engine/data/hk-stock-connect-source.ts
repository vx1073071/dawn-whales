/**
 * R272 港股通数据源 v5.0
 * 
 * 沪港通 / 深港通 双向资金流数据:
 *   北向: 外资→A股 (沪股通 + 深股通)
 *   南向: 内资→港股 (港股通沪 + 港股通深)
 *   每日额度追踪 (520亿/420亿)
 *   Top持仓变动 (北向top10 + 南向top10)
 *   历史净流入/流出曲线
 *   行业偏好分析
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockConnectFlow {
  direction: 'northbound' | 'southbound';  // 北向/南向
  subChannel: 'shanghai' | 'shenzhen';       // 沪/深
  date: string;
  buyAmount: number;   // HKD (south) / RMB (north)
  sellAmount: number;
  netFlow: number;     // buy - sell (positive = inflow)
  quotaTotal: number;  // daily quota
  quotaUsed: number;   // quota used
  quotaPercent: number;
  timestamp: number;
}

export interface StockConnectDaily {
  date: string;
  northboundNet: number;   // total northbound net (RMB)
  southboundNet: number;   // total southbound net (HKD)
  northboundBuy: number;
  northboundSell: number;
  southboundBuy: number;
  southboundSell: number;
  shNorthbound: StockConnectFlow;
  szNorthbound: StockConnectFlow;
  shSouthbound: StockConnectFlow;
  szSouthbound: StockConnectFlow;
}

export interface ConnectTopStock {
  symbol: string;
  name: string;
  nameCn: string;
  direction: 'northbound' | 'southbound';
  rank: number;
  netBuy: number;          // net buy amount
  buyAmount: number;
  sellAmount: number;
  holdingMarketValue?: number;
  holdingPercent?: number;
  changePercent?: number;   // change vs prev day
}

export interface ConnectSummary {
  date: string;
  northboundCumulative: number;   // total historical net inflow (RMB bn)
  southboundCumulative: number;   // total historical net inflow (HKD bn)
  northboundToday: StockConnectFlow;
  southboundToday: StockConnectFlow;
  northboundTop10: ConnectTopStock[];
  southboundTop10: ConnectTopStock[];
  northboundTrend: 'inflow' | 'outflow' | 'balanced';
  southboundTrend: 'inflow' | 'outflow' | 'balanced';
  northbound5dNet: number;   // last 5 days net
  southbound5dNet: number;
  northbound20dNet: number;
  southbound20dNet: number;
  updatedAt: number;
}

export interface ConnectHistoryPoint {
  date: string;
  northboundNet: number;
  southboundNet: number;
  northboundCumulative: number;
  southboundCumulative: number;
}

export interface SectorFlowAggregate {
  sector: string;
  sectorCn: string;
  direction: 'northbound' | 'southbound';
  netFlow: number;
  avgFlow: number;
  stockCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ── Data Source ────────────────────────────────────────────────────────────

export class HkStockConnectSource extends EventEmitter {
  private dailyRecords_: StockConnectDaily[] = [];
  private topStocks_: Map<string, ConnectTopStock[]> = new Map(); // date → top stocks
  private sectorPrefs_: SectorFlowAggregate[] = [];
  private cumulativeNorthbound_ = 0;
  private cumulativeSouthbound_ = 0;
  private readonly QUOTAS = {
    northbound: 52000000000,  // 520亿 RMB
    southboundShanghai: 42000000000, // 420亿 HKD
    southboundShenzhen: 42000000000,
  };

  // ── Data Ingestion ────────────────────────────────────────────────────

  /** Ingest daily northbound/southbound flow data */
  ingestDailyFlow(data: {
    date: string;
    northbound: { shBuy: number; shSell: number; szBuy: number; szSell: number };
    southbound: { shBuy: number; shSell: number; szBuy: number; szSell: number };
  }): StockConnectDaily {
    const nShFlow: StockConnectFlow = {
      direction: 'northbound', subChannel: 'shanghai',
      date: data.date,
      buyAmount: data.northbound.shBuy, sellAmount: data.northbound.shSell,
      netFlow: data.northbound.shBuy - data.northbound.shSell,
      quotaTotal: this.QUOTAS.northbound,
      quotaUsed: data.northbound.shBuy + data.northbound.shSell,
      quotaPercent: ((data.northbound.shBuy + data.northbound.shSell) / this.QUOTAS.northbound) * 100,
      timestamp: Date.now(),
    };
    const nSzFlow: StockConnectFlow = {
      direction: 'northbound', subChannel: 'shenzhen',
      date: data.date,
      buyAmount: data.northbound.szBuy, sellAmount: data.northbound.szSell,
      netFlow: data.northbound.szBuy - data.northbound.szSell,
      quotaTotal: this.QUOTAS.northbound,
      quotaUsed: data.northbound.szBuy + data.northbound.szSell,
      quotaPercent: ((data.northbound.szBuy + data.northbound.szSell) / this.QUOTAS.northbound) * 100,
      timestamp: Date.now(),
    };
    const sShFlow: StockConnectFlow = {
      direction: 'southbound', subChannel: 'shanghai',
      date: data.date,
      buyAmount: data.southbound.shBuy, sellAmount: data.southbound.shSell,
      netFlow: data.southbound.shBuy - data.southbound.shSell,
      quotaTotal: this.QUOTAS.southboundShanghai,
      quotaUsed: data.southbound.shBuy + data.southbound.shSell,
      quotaPercent: ((data.southbound.shBuy + data.southbound.shSell) / this.QUOTAS.southboundShanghai) * 100,
      timestamp: Date.now(),
    };
    const sSzFlow: StockConnectFlow = {
      direction: 'southbound', subChannel: 'shenzhen',
      date: data.date,
      buyAmount: data.southbound.szBuy, sellAmount: data.southbound.szSell,
      netFlow: data.southbound.szBuy - data.southbound.szSell,
      quotaTotal: this.QUOTAS.southboundShenzhen,
      quotaUsed: data.southbound.szBuy + data.southbound.szSell,
      quotaPercent: ((data.southbound.szBuy + data.southbound.szSell) / this.QUOTAS.southboundShenzhen) * 100,
      timestamp: Date.now(),
    };

    const daily: StockConnectDaily = {
      date: data.date,
      northboundNet: nShFlow.netFlow + nSzFlow.netFlow,
      southboundNet: sShFlow.netFlow + sSzFlow.netFlow,
      northboundBuy: data.northbound.shBuy + data.northbound.szBuy,
      northboundSell: data.northbound.shSell + data.northbound.szSell,
      southboundBuy: data.southbound.shBuy + data.southbound.szBuy,
      southboundSell: data.southbound.shSell + data.southbound.szSell,
      shNorthbound: nShFlow, szNorthbound: nSzFlow,
      shSouthbound: sShFlow, szSouthbound: sSzFlow,
    };

    // Update cumulative
    this.cumulativeNorthbound_ += daily.northboundNet;
    this.cumulativeSouthbound_ += daily.southboundNet;

    this.dailyRecords_.push(daily);
    this.emit('flow_update', daily);
    return daily;
  }

  /** Ingest top stock holdings/flow */
  ingestTopStocks(date: string, stocks: ConnectTopStock[]): void {
    this.topStocks_.set(date, stocks);
    this.emit('top_stocks_update', { date, stocks });
  }

  /** Set sector preferences (derived from top stocks data) */
  setSectorPreferences(aggregates: SectorFlowAggregate[]): void {
    this.sectorPrefs_ = aggregates;
  }

  // ── Queries ───────────────────────────────────────────────────────────

  /** Get today's summary */
  getTodaySummary(): ConnectSummary | null {
    if (this.dailyRecords_.length === 0) return null;
    const today = this.dailyRecords_[this.dailyRecords_.length - 1];
    const last5d = this.dailyRecords_.slice(-5);
    const last20d = this.dailyRecords_.slice(-20);
    const nbTop10 = this.topStocks_.get(today.date)?.filter(s => s.direction === 'northbound') || [];
    const sbTop10 = this.topStocks_.get(today.date)?.filter(s => s.direction === 'southbound') || [];

    // Determine trends
    const nb5dNet = last5d.reduce((s, r) => s + r.northboundNet, 0);
    const sb5dNet = last5d.reduce((s, r) => s + r.southboundNet, 0);

    return {
      date: today.date,
      northboundCumulative: this.cumulativeNorthbound_ / 1e8,   // in 亿 RMB
      southboundCumulative: this.cumulativeSouthbound_ / 1e8,   // in 亿 HKD
      northboundToday: today.shNorthbound.netFlow >= today.szNorthbound.netFlow ? today.shNorthbound : today.szNorthbound,
      southboundToday: today.shSouthbound.netFlow >= today.szSouthbound.netFlow ? today.shSouthbound : today.szSouthbound,
      northboundTop10: nbTop10.sort((a, b) => b.netBuy - a.netBuy).slice(0, 10),
      southboundTop10: sbTop10.sort((a, b) => b.netBuy - a.netBuy).slice(0, 10),
      northboundTrend: today.northboundNet > 50000000 ? 'inflow' : today.northboundNet < -50000000 ? 'outflow' : 'balanced',
      southboundTrend: today.southboundNet > 50000000 ? 'inflow' : today.southboundNet < -50000000 ? 'outflow' : 'balanced',
      northbound5dNet: nb5dNet / 1e8,
      southbound5dNet: sb5dNet / 1e8,
      northbound20dNet: last20d.reduce((s, r) => s + r.northboundNet, 0) / 1e8,
      southbound20dNet: last20d.reduce((s, r) => s + r.southboundNet, 0) / 1e8,
      updatedAt: Date.now(),
    };
  }

  /** Get historical flow data */
  getHistory(limit = 90): ConnectHistoryPoint[] {
    return this.dailyRecords_.slice(-limit).map(r => ({
      date: r.date,
      northboundNet: r.northboundNet / 1e8,   // 亿
      southboundNet: r.southboundNet / 1e8,
      northboundCumulative: 0,  // cumulative computed progressively
      southboundCumulative: 0,
    }));
  }

  /** Get top stocks for a specific date */
  getTopStocks(date?: string, direction?: 'northbound' | 'southbound'): ConnectTopStock[] {
    const key = date || (this.dailyRecords_.length > 0 ? this.dailyRecords_[this.dailyRecords_.length - 1].date : '');
    let stocks = this.topStocks_.get(key) || [];
    if (direction) stocks = stocks.filter(s => s.direction === direction);
    return stocks.sort((a, b) => b.netBuy - a.netBuy);
  }

  /** Get cumulative totals */
  getCumulative(): { northbound: number; southbound: number } {
    return {
      northbound: this.cumulativeNorthbound_ / 1e8,   // 亿 RMB
      southbound: this.cumulativeSouthbound_ / 1e8,    // 亿 HKD
    };
  }

  /** Get flow trends for last N days */
  getTrend(days = 30): {
    northbound: Array<{ date: string; net: number }>;
    southbound: Array<{ date: string; net: number }>;
    northboundNetFlow: number;
    southboundNetFlow: number;
  } {
    const slice = this.dailyRecords_.slice(-days);
    return {
      northbound: slice.map(r => ({ date: r.date, net: r.northboundNet / 1e8 })),
      southbound: slice.map(r => ({ date: r.date, net: r.southboundNet / 1e8 })),
      northboundNetFlow: slice.reduce((s, r) => s + r.northboundNet, 0) / 1e8,
      southboundNetFlow: slice.reduce((s, r) => s + r.southboundNet, 0) / 1e8,
    };
  }

  /** Get sector preferences (which sectors foreigners are buying) */
  getSectorPreferences(direction?: 'northbound' | 'southbound'): SectorFlowAggregate[] {
    let results = this.sectorPrefs_;
    if (direction) results = results.filter(s => s.direction === direction);
    return results.sort((a, b) => b.netFlow - a.netFlow);
  }

  /** Analyze correlation between northbound and southbound */
  analyzeCorrelation(days = 30): { correlation: number; interpretation: string; interpretationCn: string } {
    const slice = this.dailyRecords_.slice(-days);
    if (slice.length < 2) return { correlation: 0, interpretation: 'insufficient data', interpretationCn: '数据不足' };

    const nb = slice.map(r => r.northboundNet);
    const sb = slice.map(r => r.southboundNet);
    const corr = this._pearsonCorrelation(nb, sb);

    let interpretation: string;
    let interpretationCn: string;
    if (corr > 0.5) { interpretation = 'Both directions move together (risk-on/off)'; interpretationCn = '北向南向同向 (risk-on/off)'; }
    else if (corr < -0.5) { interpretation = 'Divergent: capital rotation between A and HK'; interpretationCn = '背离: A股港股资金轮动'; }
    else { interpretation = 'Weak correlation: independent flows'; interpretationCn = '弱相关: 独立资金流'; }

    return { correlation: Math.round(corr * 1000) / 1000, interpretation, interpretationCn };
  }

  private _pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    const num = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
    const denX = Math.sqrt(x.reduce((s, xi) => s + (xi - meanX) ** 2, 0));
    const denY = Math.sqrt(y.reduce((s, yi) => s + (yi - meanY) ** 2, 0));
    return denX === 0 || denY === 0 ? 0 : num / (denX * denY);
  }

  /** Check if quota is approaching limit */
  getQuotaStatus(): {
    northbound: { used: number; total: number; percent: number; warning: boolean };
    southbound: { used: number; total: number; percent: number; warning: boolean };
  } {
    const today = this.dailyRecords_.length > 0 ? this.dailyRecords_[this.dailyRecords_.length - 1] : null;
    const nbUsed = today ? today.northboundBuy + today.northboundSell : 0;
    const sbUsed = today ? today.southboundBuy + today.southboundSell : 0;
    return {
      northbound: { used: nbUsed, total: this.QUOTAS.northbound, percent: (nbUsed / this.QUOTAS.northbound) * 100, warning: nbUsed > this.QUOTAS.northbound * 0.9 },
      southbound: { used: sbUsed, total: this.QUOTAS.southboundShanghai, percent: (sbUsed / this.QUOTAS.southboundShanghai) * 100, warning: sbUsed > this.QUOTAS.southboundShanghai * 0.9 },
    };
  }

  reset(): void {
    this.dailyRecords_ = [];
    this.topStocks_ = new Map();
    this.sectorPrefs_ = [];
    this.cumulativeNorthbound_ = 0;
    this.cumulativeSouthbound_ = 0;
  }
}

export const hkStockConnectSource = new HkStockConnectSource();
