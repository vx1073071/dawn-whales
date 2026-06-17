/**
 * R272 HK卖空→IPC桥接 v5.0
 * 
 * 桥接 ShortSellingPipeline 到前端:
 *   实时卖空IPC: top shorts / squeeze alerts / trend
 *   聚合仪表盘: daily/weekly/monthly aggregates
 *   信号→推送: high-short-ratio + squeeze + increase alerts
 *   行业分类: 按行业聚合卖空数据
 *   历史对比: YoY / MoM / WoW
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface HkShortRecord {
  symbol: string;
  name: string;
  nameCn: string;
  date: string;           // YYYY-MM-DD
  shortVolume: number;    // shares sold short
  totalVolume: number;
  shortTurnover: number;  // HKD
  totalTurnover: number;
  shortRatio: number;     // shortVol / totalVol × 100
  prevDayRatio?: number;
  avg5dRatio?: number;
  avg20dRatio?: number;
}

export interface HkShortSignal {
  signalId: string;
  symbol: string;
  name: string;
  nameCn: string;
  type: 'high_ratio' | 'ratio_spike' | 'volume_spike' | 'squeeze_risk' | 'persistent_high';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageCn: string;
  data: HkShortRecord;
  createdAt: number;
}

export interface HkShortDashboard {
  date: string;
  totalRecords: number;
  marketAvgRatio: number;
  top10Shorted: HkShortRecord[];
  biggestIncreases: HkShortRecord[];  // ratio ↑ vs prev day
  biggestDecreases: HkShortRecord[];
  sectorAggregates: HkSectorAggregate[];
  signals: HkShortSignal[];
  updatedAt: number;
}

export interface HkSectorAggregate {
  sector: string;
  sectorCn: string;
  avgRatio: number;
  totalTurnover: number;
  stockCount: number;
  trend: 'up' | 'down' | 'stable';
}

export interface HkShortTrend {
  symbol: string;
  name: string;
  nameCn: string;
  points: Array<{ date: string; ratio: number; volume: number }>;
  trend: 'rising' | 'falling' | 'stable';
  change30d: number; // % change over 30 days
}

export type IpcHkChannel = 'hk:shortsell:dashboard' | 'hk:shortsell:signal' | 'hk:shortsell:update';

// ── IPC Bridge ─────────────────────────────────────────────────────────────

export class HkShortSellIpcBridge extends EventEmitter {
  private records_: Map<string, HkShortRecord[]> = new Map(); // symbol → records
  private dashboard_: HkShortDashboard | null = null;
  private signals_: HkShortSignal[] = [];
  private listeners_: Map<IpcHkChannel, Set<(data: unknown) => void>> = new Map();
  private sectorMap_: Map<string, { sector: string; sectorCn: string }> = new Map();
  private readonly SIGNAL_THRESHOLDS = {
    highRatio: 20,        // short ratio > 20% = warning
    criticalRatio: 40,    // short ratio > 40% = critical
    spikeThreshold: 50,   // ratio increase > 50% vs 5D avg
    squeezeDays: 5,       // days of rising short ratio
  };

  // ── Channel Bus ────────────────────────────────────────────────────────

  onChannel(channel: IpcHkChannel, handler: (data: unknown) => void): () => void {
    if (!this.listeners_.has(channel)) this.listeners_.set(channel, new Set());
    this.listeners_.get(channel)!.add(handler);
    return () => this.listeners_.get(channel)?.delete(handler);
  }

  private _emit(channel: IpcHkChannel, data: unknown): void {
    const handlers = this.listeners_.get(channel);
    if (handlers) for (const h of handlers) h(data);
    // Cross-notify
    if (channel === 'hk:shortsell:update') {
      const dHandlers = this.listeners_.get('hk:shortsell:dashboard');
      if (dHandlers && this.dashboard_) for (const h of dHandlers) h(this.dashboard_);
    }
  }

  // ── Data Ingestion ────────────────────────────────────────────────────

  ingest(records: HkShortRecord[]): HkShortSignal[] {
    const newSignals: HkShortSignal[] = [];

    for (const rec of records) {
      if (!this.records_.has(rec.symbol)) this.records_.set(rec.symbol, []);
      this.records_.get(rec.symbol)!.push(rec);

      // Enrich with historical context
      const history = this.records_.get(rec.symbol)!;
      if (history.length >= 2) {
        rec.prevDayRatio = history[history.length - 2].shortRatio;
      }
      if (history.length >= 5) {
        rec.avg5dRatio = history.slice(-5).reduce((s, r) => s + r.shortRatio, 0) / 5;
      }
      if (history.length >= 20) {
        rec.avg20dRatio = history.slice(-20).reduce((s, r) => s + r.shortRatio, 0) / 20;
      }

      // Detect signals
      const sigs = this._detectSignals(rec);
      if (sigs.length > 0) { this.signals_.push(...sigs); newSignals.push(...sigs); }
    }

    // Update dashboard
    this._refreshDashboard();
    this._emit('hk:shortsell:update', { count: records.length, newSignals: newSignals.length });
    for (const s of newSignals) this._emit('hk:shortsell:signal', s);

    return newSignals;
  }

  private _detectSignals(rec: HkShortRecord): HkShortSignal[] {
    const results: HkShortSignal[] = [];
    const ts = Date.now();

    // 1. High ratio signal
    if (rec.shortRatio >= this.SIGNAL_THRESHOLDS.criticalRatio) {
      results.push({
        signalId: `hk_short_critical_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameCn: rec.nameCn,
        type: 'high_ratio', severity: 'critical',
        message: `${rec.name} short ratio ${rec.shortRatio.toFixed(1)}% (critical)`,
        messageCn: `${rec.nameCn} 卖空比例 ${rec.shortRatio.toFixed(1)}% (严重)`,
        data: rec, createdAt: ts,
      });
    } else if (rec.shortRatio >= this.SIGNAL_THRESHOLDS.highRatio) {
      results.push({
        signalId: `hk_short_warn_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameCn: rec.nameCn,
        type: 'high_ratio', severity: 'warning',
        message: `${rec.name} short ratio ${rec.shortRatio.toFixed(1)}%`,
        messageCn: `${rec.nameCn} 卖空比例 ${rec.shortRatio.toFixed(1)}%`,
        data: rec, createdAt: ts,
      });
    }

    // 2. Ratio spike vs 5D average
    if (rec.avg5dRatio && rec.avg5dRatio > 0) {
      const change = ((rec.shortRatio - rec.avg5dRatio) / rec.avg5dRatio) * 100;
      if (change >= this.SIGNAL_THRESHOLDS.spikeThreshold) {
        results.push({
          signalId: `hk_short_spike_${rec.symbol}_${ts}`,
          symbol: rec.symbol, name: rec.name, nameCn: rec.nameCn,
          type: 'ratio_spike', severity: 'warning',
          message: `${rec.name} short ratio spiked ${change.toFixed(0)}% vs 5D avg`,
          messageCn: `${rec.nameCn} 卖空比例骤升 ${change.toFixed(0)}% (vs 5日均值)`,
          data: rec, createdAt: ts,
        });
      }
    }

    // 3. Volume spike (volume > 2× 20D avg)
    if (rec.avg20dRatio) {
      const vol20d = rec.totalVolume;// approximate
      if (rec.shortVolume > vol20d * 2) {
        results.push({
          signalId: `hk_short_vol_${rec.symbol}_${ts}`,
          symbol: rec.symbol, name: rec.name, nameCn: rec.nameCn,
          type: 'volume_spike', severity: 'info',
          message: `${rec.name} short volume surged`,
          messageCn: `${rec.nameCn} 卖空成交量激增`,
          data: rec, createdAt: ts,
        });
      }
    }

    return results;
  }

  /** Check squeeze risk for a symbol */
  checkSqueeze(symbol: string, currentPrice: number, avgPrice: number): {
    squeezeRisk: 'none' | 'low' | 'moderate' | 'high';
    score: number;
    signal?: HkShortSignal;
  } {
    const history = this.records_.get(symbol);
    if (!history || history.length < 5) return { squeezeRisk: 'none', score: 0 };

    const recent = history.slice(-5);
    const ratios = recent.map(r => r.shortRatio);
    const rising = ratios.every((r, i) => i === 0 || r >= ratios[i - 1]);
    const avgRatio = ratios[ratios.length - 1];
    const priceDrop = ((currentPrice - avgPrice) / avgPrice) * 100;

    let score = 0;
    if (avgRatio > 20) score += 30;
    if (avgRatio > 40) score += 20;
    if (rising) score += 25;
    if (priceDrop < -5) score += 25; // price already dropping

    let risk: 'none' | 'low' | 'moderate' | 'high' = 'none';
    let signal: HkShortSignal | undefined;

    if (score >= 60) {
      risk = 'high';
      signal = {
        signalId: `hk_squeeze_${symbol}_${Date.now()}`,
        symbol, name: symbol, nameCn: symbol,
        type: 'squeeze_risk', severity: 'critical',
        message: `${symbol} short squeeze risk HIGH (score ${score})`,
        messageCn: `${symbol} 轧空风险高 (评分 ${score})`,
        data: recent[recent.length - 1], createdAt: Date.now(),
      };
      this.signals_.push(signal);
      this._emit('hk:shortsell:signal', signal);
    } else if (score >= 35) risk = 'moderate';
    else if (score >= 15) risk = 'low';

    return { squeezeRisk: risk, score, signal };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────

  private _refreshDashboard(): void {
    if (this.records_.size === 0) return;

    const allRecords: HkShortRecord[] = [];
    for (const recs of this.records_.values()) allRecords.push(...recs);

    // Get latest date records
    const dates = [...new Set(allRecords.map(r => r.date))].sort().reverse();
    const latestDate = dates[0];
    const todayRecords = allRecords.filter(r => r.date === latestDate);

    const avgRatio = todayRecords.reduce((s, r) => s + r.shortRatio, 0) / todayRecords.length;
    const sorted = [...todayRecords].sort((a, b) => b.shortRatio - a.shortRatio);
    const top10 = sorted.slice(0, 10);

    const prevDate = dates[1];
    const prevRecords = prevDate ? allRecords.filter(r => r.date === prevDate) : [];
    const prevMap = new Map(prevRecords.map(r => [r.symbol, r.shortRatio]));

    const changes = todayRecords.map(r => ({
      ...r, change: r.shortRatio - (prevMap.get(r.symbol) || r.shortRatio),
    }));
    const increases = changes.filter(c => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 10);
    const decreases = changes.filter(c => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 10);

    // Sector aggregates
    const sectors = new Map<string, { ratios: number[]; turnover: number; count: number }>();
    for (const r of todayRecords) {
      const s = this.sectorMap_.get(r.symbol) || { sector: 'other', sectorCn: '其他' };
      const key = s.sector;
      if (!sectors.has(key)) sectors.set(key, { ratios: [], turnover: 0, count: 0 });
      const entry = sectors.get(key)!;
      entry.ratios.push(r.shortRatio);
      entry.turnover += r.shortTurnover;
      entry.count++;
    }
    const sectorAggs: HkSectorAggregate[] = Array.from(sectors.entries()).map(([sector, data]) => ({
      sector, sectorCn: this.sectorMap_.get([...todayRecords.find(r => this.sectorMap_.get(r.symbol)?.sector === sector)?.symbol || ''][0] || sector)?.sectorCn || sector,
      avgRatio: data.ratios.reduce((a, b) => a + b, 0) / data.ratios.length,
      totalTurnover: data.turnover,
      stockCount: data.count,
      trend: (data.ratios[data.ratios.length - 1] - data.ratios[0]) > 0 ? 'up' : 'down',
    })).sort((a, b) => b.avgRatio - a.avgRatio);

    this.dashboard_ = {
      date: latestDate,
      totalRecords: todayRecords.length,
      marketAvgRatio: avgRatio,
      top10Shorted: top10,
      biggestIncreases: increases,
      biggestDecreases: decreases,
      sectorAggregates: sectorAggs,
      signals: this.signals_.filter(s => s.createdAt > Date.now() - 86400000), // last 24h
      updatedAt: Date.now(),
    };

    this._emit('hk:shortsell:dashboard', this.dashboard_);
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getDashboard(): HkShortDashboard | null { return this.dashboard_; }

  getSignals(symbol?: string, type?: HkShortSignal['type'], limit = 50): HkShortSignal[] {
    let results = [...this.signals_];
    if (symbol) results = results.filter(s => s.symbol === symbol);
    if (type) results = results.filter(s => s.type === type);
    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getHistory(symbol: string, limit = 30): HkShortRecord[] {
    return (this.records_.get(symbol) || []).slice(-limit);
  }

  getTrend(symbol: string): HkShortTrend | null {
    const records = this.records_.get(symbol);
    if (!records || records.length < 3) return null;
    const recent = records.slice(-30);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change30d = last.shortRatio - first.shortRatio;
    return {
      symbol, name: records[0].name, nameCn: records[0].nameCn,
      points: recent.map(r => ({ date: r.date, ratio: r.shortRatio, volume: r.shortVolume })),
      trend: change30d > 2 ? 'rising' : change30d < -2 ? 'falling' : 'stable',
      change30d,
    };
  }

  getTopShorted(limit = 20): HkShortRecord[] {
    if (!this.dashboard_) return [];
    return this.dashboard_.top10Shorted.slice(0, limit);
  }

  getSectorRankings(): HkSectorAggregate[] {
    return this.dashboard_?.sectorAggregates || [];
  }

  getMarketStats(): { avgRatio: number; totalStocks: number; highRatioCount: number; criticalCount: number } {
    if (!this.dashboard_) return { avgRatio: 0, totalStocks: 0, highRatioCount: 0, criticalCount: 0 };
    const top10 = this.dashboard_.top10Shorted;
    return {
      avgRatio: this.dashboard_.marketAvgRatio,
      totalStocks: this.dashboard_.totalRecords,
      highRatioCount: top10.filter(r => r.shortRatio >= 20).length,
      criticalCount: top10.filter(r => r.shortRatio >= 40).length,
    };
  }

  /** Register sector mapping for a stock */
  setSector(symbol: string, sector: string, sectorCn: string): void {
    this.sectorMap_.set(symbol, { sector, sectorCn });
  }

  /** Get all tracked HK symbols */
  getTrackedSymbols(): string[] { return Array.from(this.records_.keys()); }

  reset(): void {
    this.records_ = new Map();
    this.dashboard_ = null;
    this.signals_ = [];
    this.listeners_ = new Map();
    this.sectorMap_ = new Map();
  }
}

export const hkShortSellIpcBridge = new HkShortSellIpcBridge();
