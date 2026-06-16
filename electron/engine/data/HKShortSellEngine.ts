/**
 * HKShortSellEngine — R259 QUANT MOO P1-08
 *
 * 港股卖空数据引擎。追踪香港交易所每日卖空数据，
 * 提供个股/行业/市场三层卖空分析。
 *
 * Feature set:
 *   - 个股卖空: 卖空股数/金额/占比/变化趋势
 *   - 行业卖空: 按行业聚合卖空数据
 *   - 市场卖空: 全市场卖空比率+历史百分位
 *   - 卖空异动: 卖空比率突增/锐减预警
 *   - 多日趋势: 5日/10日/20日均线
 *   - 卖空轧空风险评估
 *   - Signal: 极度看空→做多信号转换 (Contrarian)
 *
 * Architecture:
 *   - Singleton with reset()
 *   - Daily tick ingestion + rolling aggregation
 *   - Squeeze detection (high short interest → potential short squeeze)
 *
 * @author JVS
 * @round R259
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export interface ShortSellRecord {
  symbol: string;
  date: string;          // YYYY-MM-DD
  shortVolume: number;   // 卖空股数
  shortAmount: number;   // 卖空金额
  totalVolume: number;   // 总成交量
  shortRatio: number;    // 卖空占比 (0-1)
  sector: string;
  market: 'HK';
}

export interface ShortSellSummary {
  symbol: string;
  latestRatio: number;
  avgRatio5d: number;
  avgRatio10d: number;
  avgRatio20d: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentile: number;   // historical percentile 0-100
  totalRecords: number;
  currentAmount: number;
  totalAmount5d: number;
}

export interface ShortSellAlert {
  id: string;
  symbol: string;
  type: 'ratio_spike' | 'ratio_drop' | 'squeeze_risk' | 'extreme_high' | 'extreme_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentRatio: number;
  avgRatio20d: number;
  deviation: number;    // how many std from mean
  message: string;
  timestamp: number;
}

export interface SectorShortSell {
  sector: string;
  totalVolume: number;
  totalShortVolume: number;
  totalShortAmount: number;
  aggregateRatio: number;
  stockCount: number;
  topShorted: string[];
}

export interface MarketShortSell {
  date: string;
  totalShortAmount: number;
  totalMarketAmount: number;
  marketShortRatio: number;
  percentile: number;
  stockCount: number;
  topSectors: SectorShortSell[];
}

export interface SqueezeAssessment {
  symbol: string;
  shortRatio: number;
  shortAmount: number;
  avgVolume5d: number;
  daysToCover: number;   // short volume / avg daily volume
  squeezeScore: number;  // 0-100, higher = more squeeze potential
  risk: 'low' | 'elevated' | 'high' | 'extreme';
  catalyst?: string;
}

// ─── Engine ──────────────────────────────────────────────

export class HKShortSellEngine extends EventEmitter {
  private static instance: HKShortSellEngine;

  private records: Map<string, ShortSellRecord> = new Map(); // key = date:symbol
  private alerts: ShortSellAlert[] = [];
  private alertIdCounter = 0;

  constructor() { super(); }

  static getInstance(): HKShortSellEngine {
    if (!HKShortSellEngine.instance) {
      HKShortSellEngine.instance = new HKShortSellEngine();
    }
    return HKShortSellEngine.instance;
  }

  reset(): void {
    this.records.clear();
    this.alerts = [];
    this.alertIdCounter = 0;
    this.removeAllListeners();
  }

  // ─── Ingestion ─────────────────────────────────────────

  ingest(record: ShortSellRecord): void {
    const key = `${record.date}:${record.symbol}`;
    this.records.set(key, record);
    this.emit('record_ingested', record);

    // Check for alerts
    const summary = this.getSymbolSummary(record.symbol);
    if (summary) this.checkAlerts(summary);
  }

  ingestBatch(records: ShortSellRecord[]): void {
    for (const r of records) this.ingest(r);
    this.emit('batch_ingested', records.length);
  }

  // ─── Symbol Summary ────────────────────────────────────

  getSymbolSummary(symbol: string): ShortSellSummary | null {
    const symbolRecords = [...this.records.values()].filter(r => r.symbol === symbol);
    if (symbolRecords.length === 0) return null;

    const sorted = symbolRecords.sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const last5 = sorted.slice(0, 5);
    const last10 = sorted.slice(0, 10);
    const last20 = sorted.slice(0, 20);

    const avg5 = last5.reduce((s, r) => s + r.shortRatio, 0) / last5.length;
    const avg10 = last10.length > 0 ? last10.reduce((s, r) => s + r.shortRatio, 0) / last10.length : avg5;
    const avg20 = last20.length > 0 ? last20.reduce((s, r) => s + r.shortRatio, 0) / last20.length : avg10;

    const trend = this.classifyTrend(latest.shortRatio, avg5, avg10);

    return {
      symbol,
      latestRatio: latest.shortRatio,
      avgRatio5d: avg5,
      avgRatio10d: avg10,
      avgRatio20d: avg20,
      trend,
      percentile: this.calcPercentile(latest.shortRatio, symbolRecords.map(r => r.shortRatio)),
      totalRecords: symbolRecords.length,
      currentAmount: latest.shortAmount,
      totalAmount5d: last5.reduce((s, r) => s + r.shortAmount, 0),
    };
  }

  // ─── Trend ─────────────────────────────────────────────

  private classifyTrend(latest: number, avg5: number, avg10: number): ShortSellSummary['trend'] {
    if (latest > avg5 && avg5 > avg10) return 'increasing';
    if (latest < avg5 && avg5 < avg10) return 'decreasing';
    return 'stable';
  }

  private calcPercentile(value: number, history: number[]): number {
    const sorted = [...history].sort();
    const idx = sorted.findIndex(v => v >= value);
    return idx >= 0 ? Math.round(idx / sorted.length * 100) : 100;
  }

  // ─── Alerts ────────────────────────────────────────────

  private checkAlerts(summary: ShortSellSummary): void {
    const ratio = summary.latestRatio;
    const avg20 = summary.avgRatio20d;

    // Ratio spike (>3x 20d average)
    if (avg20 > 0 && ratio > avg20 * 3) {
      this.raiseAlert(summary.symbol, 'ratio_spike', ratio, avg20, ratio / avg20, '高');
    }

    // Ratio sharp drop (<0.3x 20d average, short covering)
    if (avg20 > 0 && ratio < avg20 * 0.3 && avg20 > 0.05) {
      this.raiseAlert(summary.symbol, 'ratio_drop', ratio, avg20, avg20 / ratio, '中');
    }

    // Extreme high (>80th percentile)
    if (summary.percentile >= 95 && ratio > 0.3) {
      this.raiseAlert(summary.symbol, 'extreme_high', ratio, avg20, ratio / avg20, '极高');
    }

    // Squeeze assessment
    const squeezeScore = this.calcSqueezeScore(summary);
    if (squeezeScore > 70) {
      this.raiseAlert(summary.symbol, 'squeeze_risk', ratio, avg20, squeezeScore, '高');
    }
  }

  private raiseAlert(symbol: string, type: ShortSellAlert['type'], currentRatio: number, avgRatio: number, deviation: number, severityLabel: string): void {
    const severity: ShortSellAlert['severity'] =
      type === 'squeeze_risk' ? 'critical' :
      type === 'ratio_spike' || type === 'extreme_high' ? 'high' : 'medium';

    const alert: ShortSellAlert = {
      id: `ssa_${++this.alertIdCounter}`,
      symbol, type, severity, currentRatio, avgRatio20d: avgRatio, deviation,
      message: this.formatAlertMessage(symbol, type, currentRatio, avgRatio, severityLabel),
      timestamp: Date.now(),
    };
    this.alerts.push(alert);
    this.emit('short_sell_alert', alert);
  }

  private formatAlertMessage(symbol: string, type: ShortSellAlert['type'], ratio: number, avg20: number, label: string): string {
    const pct = (ratio * 100).toFixed(1);
    switch (type) {
      case 'ratio_spike': return `${symbol} 卖空比例急升至 ${pct}% (20日均: ${(avg20 * 100).toFixed(1)}%)，空头大幅增加`;
      case 'ratio_drop': return `${symbol} 卖空比例骤降至 ${pct}%，可能出现空头回补`;
      case 'squeeze_risk': return `${symbol} 卖空集中度${label} (${pct}%)，存在轧空风险`;
      case 'extreme_high': return `${symbol} 卖空比例处于历史${label}位 (${pct}%)`;
      case 'extreme_low': return `${symbol} 卖空比例极低 (${pct}%)，空头撤出`;
    }
  }

  // ─── Squeeze Detection ─────────────────────────────────

  calcSqueezeScore(summary: ShortSellSummary): number {
    let score = 0;
    // High short ratio
    if (summary.latestRatio > 0.3) score += 30;
    else if (summary.latestRatio > 0.2) score += 20;
    else if (summary.latestRatio > 0.1) score += 10;

    // Increasing trend
    if (summary.trend === 'increasing') score += 25;

    // High percentile
    if (summary.percentile > 90) score += 25;
    else if (summary.percentile > 80) score += 15;
    else if (summary.percentile > 70) score += 10;

    // Large amount
    if (summary.currentAmount > 100000000) score += 20;
    else if (summary.currentAmount > 50000000) score += 10;

    return Math.min(100, score);
  }

  assessSqueeze(symbol: string): SqueezeAssessment | null {
    const summary = this.getSymbolSummary(symbol);
    if (!summary) return null;

    const squeezeScore = this.calcSqueezeScore(summary);
    const records = [...this.records.values()].filter(r => r.symbol === symbol);
    const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
    const last5 = sorted.slice(0, 5);
    const avgVol = last5.length > 0 ? last5.reduce((s, r) => s + r.totalVolume, 0) / last5.length : 1;
    const daysToCover = avgVol > 0 ? summary.currentAmount / avgVol : 0;

    const risk: SqueezeAssessment['risk'] =
      squeezeScore >= 80 ? 'extreme' :
      squeezeScore >= 60 ? 'high' :
      squeezeScore >= 35 ? 'elevated' : 'low';

    return {
      symbol,
      shortRatio: summary.latestRatio,
      shortAmount: summary.currentAmount,
      avgVolume5d: Math.round(avgVol),
      daysToCover: Math.round(daysToCover * 100) / 100,
      squeezeScore,
      risk,
    };
  }

  getTopSqueezeCandidates(limit = 10): SqueezeAssessment[] {
    const seen = new Set<string>();
    const candidates: SqueezeAssessment[] = [];
    for (const [, record] of this.records) {
      if (seen.has(record.symbol)) continue;
      seen.add(record.symbol);
      const sq = this.assessSqueeze(record.symbol);
      if (sq && sq.squeezeScore > 30) candidates.push(sq);
    }
    return candidates.sort((a, b) => b.squeezeScore - a.squeezeScore).slice(0, limit);
  }

  // ─── Sector Aggregation ────────────────────────────────

  getSectorShortSell(date: string): SectorShortSell[] {
    const dayRecords = [...this.records.values()].filter(r => r.date === date);
    const sectors = new Map<string, ShortSellRecord[]>();

    for (const r of dayRecords) {
      const list = sectors.get(r.sector) ?? [];
      list.push(r);
      sectors.set(r.sector, list);
    }

    const results: SectorShortSell[] = [];
    for (const [sector, records] of sectors) {
      const totalVol = records.reduce((s, r) => s + r.totalVolume, 0);
      const totalShortVol = records.reduce((s, r) => s + r.shortVolume, 0);
      const totalShortAmt = records.reduce((s, r) => s + r.shortAmount, 0);
      results.push({
        sector,
        totalVolume: totalVol,
        totalShortVolume: totalShortVol,
        totalShortAmount: totalShortAmt,
        aggregateRatio: totalVol > 0 ? totalShortVol / totalVol : 0,
        stockCount: records.length,
        topShorted: records.sort((a, b) => b.shortRatio - a.shortRatio).slice(0, 5).map(r => r.symbol),
      });
    }

    return results.sort((a, b) => b.aggregateRatio - a.aggregateRatio);
  }

  // ─── Market-level ──────────────────────────────────────

  getMarketShortSell(date: string): MarketShortSell | null {
    const dayRecords = [...this.records.values()].filter(r => r.date === date);
    if (dayRecords.length === 0) return null;

    const totalShortAmount = dayRecords.reduce((s, r) => s + r.shortAmount, 0);
    const allShortRatios = dayRecords.map(r => r.shortRatio);
    const marketRatio = totalShortAmount / dayRecords.reduce((s, r) => s + r.totalVolume * r.shortAmount / r.shortVolume, 1);

    return {
      date,
      totalShortAmount,
      totalMarketAmount: dayRecords.reduce((s, r) => s + r.shortAmount / r.shortRatio, 0),
      marketShortRatio: marketRatio,
      percentile: this.calcPercentile(marketRatio, allShortRatios),
      stockCount: dayRecords.length,
      topSectors: this.getSectorShortSell(date).slice(0, 5),
    };
  }

  // ─── Queries ───────────────────────────────────────────

  getRecords(symbol?: string, limit = 50): ShortSellRecord[] {
    let list = symbol
      ? [...this.records.values()].filter(r => r.symbol === symbol)
      : [...this.records.values()];
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  getAlerts(symbol?: string, limit = 20): ShortSellAlert[] {
    let list = symbol ? this.alerts.filter(a => a.symbol === symbol) : this.alerts;
    return list.slice(-limit);
  }

  getRecordCount(): number { return this.records.size; }

  // ─── Mock ──────────────────────────────────────────────

  createMockData(): void {
    const symbols = [
      { sym: '0700.HK', sector: 'Technology' },
      { sym: '9988.HK', sector: 'Technology' },
      { sym: '0005.HK', sector: 'Finance' },
      { sym: '0388.HK', sector: 'Finance' },
      { sym: '0941.HK', sector: 'Telecom' },
      { sym: '1810.HK', sector: 'Consumer' },
    ];

    const dates = [];
    const now = new Date();
    for (let i = 19; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    for (const { sym, sector } of symbols) {
      for (const date of dates) {
        const totalVol = Math.round(10000000 + Math.random() * 40000000);
        const shortRatio = 0.05 + Math.random() * 0.25;
        this.ingest({
          symbol: sym, date,
          shortVolume: Math.round(totalVol * shortRatio),
          shortAmount: Math.round(totalVol * shortRatio * (50 + Math.random() * 100)),
          totalVolume: totalVol,
          shortRatio,
          sector,
          market: 'HK',
        });
      }
    }
  }
}
