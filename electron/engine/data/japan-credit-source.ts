/**
 * R272 日本信用/保证金数据源 v5.0
 * 
 * JPX-style margin trading data:
 *   信用买残/卖残 (margin buy/sell balance)
 *   融资买入/融券卖出
 *   卖空比率 (short selling ratio)
 *   信用倍率 (margin ratio: buy/sell balance)
 *   制度信用 vs 一般信用
 *   行业信用动向
 *   IPO初値 vs 公募価格 (IPO first-day vs public offering)
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JapanCreditRecord {
  symbol: string;              // e.g. '7203' (Toyota)
  name: string;
  nameEn: string;
  date: string;                // YYYY-MM-DD
  market: 'TSE1' | 'TSE2' | 'Mothers' | 'JASDAQ';
  marginBuyBalance: number;    // 信用買残 (outstanding long margin)
  marginSellBalance: number;   // 信用売残 (outstanding short margin)
  marginBuyNew: number;        // 新規買 (new margin buys)
  marginSellNew: number;       // 新規売 (new margin sells)
  marginBuyRepay: number;      // 買返済 (buy repayments)
  marginSellRepay: number;     // 売返済 (sell repayments)
  marginRatio: number;         // buyBalance / sellBalance (倍率)
  shortRatio: number;          // sellBalance / (buyBalance + sellBalance) × 100
  regularCredit: {             // 制度信用 (standardized margin)
    buyBalance: number;
    sellBalance: number;
  };
  generalCredit: {             // 一般信用 (negotiable margin)
    buyBalance: number;
    sellBalance: number;
  };
}

export interface JapanCreditSignal {
  signalId: string;
  symbol: string;
  name: string;
  nameEn: string;
  type: 'high_short' | 'margin_spike' | 'margin_ratio_reversal' | 'crowded_long' | 'crowded_short' | 'ipo_alert';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageCn: string;
  data: JapanCreditRecord;
  createdAt: number;
}

export interface JapanCreditSummary {
  date: string;
  totalStocks: number;
  avgMarginRatio: number;        // market average buy/sell ratio
  medianMarginRatio: number;
  highShortCount: number;         // sellRatio > 30%
  crowdedLongCount: number;       // marginRatio > 100
  crowdedShortCount: number;      // marginRatio < 0.1
  topMarginBuy: JapanCreditRecord[];
  topMarginSell: JapanCreditRecord[];
  topShortRatio: JapanCreditRecord[];
  biggestIncrease: JapanCreditRecord[];  // margin buy increased
  signals: JapanCreditSignal[];
  sectorAggregates: JapanSectorCredit[];
  updatedAt: number;
}

export interface JapanSectorCredit {
  sector: string;
  sectorEn: string;
  avgMarginRatio: number;
  avgShortRatio: number;
  totalMarginBuy: number;
  totalMarginSell: number;
  stockCount: number;
}

export interface JapanCreditTrend {
  symbol: string;
  name: string;
  nameEn: string;
  points: Array<{ date: string; marginRatio: number; shortRatio: number; buyBalance: number; sellBalance: number }>;
  trend: 'expanding' | 'contracting' | 'stable';
}

// ── Default sector mapping ─────────────────────────────────────────────────

const JP_SECTOR_MAP: Record<string, { sector: string; sectorEn: string }> = {
  '7203': { sector: '自動車', sectorEn: 'Automotive' },       // Toyota
  '6758': { sector: '電機', sectorEn: 'Electronics' },         // Sony
  '9984': { sector: '通信', sectorEn: 'Telecom' },             // SoftBank
  '8306': { sector: '銀行', sectorEn: 'Banking' },             // MUFG
  '9432': { sector: '通信', sectorEn: 'Telecom' },             // NTT
  '7974': { sector: 'ゲーム', sectorEn: 'Gaming' },            // Nintendo
  '6861': { sector: '電機', sectorEn: 'Electronics' },         // Keyence
  '8035': { sector: '電機', sectorEn: 'Electronics' },         // Tokyo Electron
  '6098': { sector: 'サービス', sectorEn: 'Services' },        // Recruit
  '4063': { sector: '化学', sectorEn: 'Chemicals' },           // Shin-Etsu
};

// ── Data Source ────────────────────────────────────────────────────────────

export class JapanCreditSource extends EventEmitter {
  private records_: Map<string, JapanCreditRecord[]> = new Map();
  private signals_: JapanCreditSignal[] = [];
  private summary_: JapanCreditSummary | null = null;

  // Signal thresholds
  private readonly THRESHOLDS = {
    highShortRatio: 30,         // short ratio > 30% = warning
    criticalShortRatio: 50,     // short ratio > 50% = critical
    crowdedLongRatio: 100,      // margin ratio > 100 = extremely crowded long
    crowdedShortRatio: 0.1,     // margin ratio < 0.1 = extremely crowded short
    spikePercent: 100,          // new margin buy > 2× avg
    reversalPercent: 50,        // ratio reversal > 50% from 5D avg
  };

  // ── Data Ingestion ────────────────────────────────────────────────────

  /** Ingest a batch of Japan credit records */
  ingest(records: JapanCreditRecord[]): JapanCreditSignal[] {
    const newSignals: JapanCreditSignal[] = [];

    for (const rec of records) {
      if (!this.records_.has(rec.symbol)) this.records_.set(rec.symbol, []);
      this.records_.get(rec.symbol)!.push(rec);

      // Detect signals
      const sigs = this._detectSignals(rec);
      if (sigs.length > 0) {
        this.signals_.push(...sigs);
        newSignals.push(...sigs);
      }
    }

    this._refreshSummary();
    this.emit('credit_update', { count: records.length, newSignals: newSignals.length });

    if (newSignals.length > 0) {
      this.emit('credit_signals', newSignals);
    }

    return newSignals;
  }

  private _detectSignals(rec: JapanCreditRecord): JapanCreditSignal[] {
    const results: JapanCreditSignal[] = [];
    const ts = Date.now();

    // 1. High short ratio
    if (rec.shortRatio >= this.THRESHOLDS.criticalShortRatio) {
      results.push({
        signalId: `jp_critical_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
        type: 'high_short', severity: 'critical',
        message: `${rec.name} short ratio ${rec.shortRatio.toFixed(1)}% CRITICAL`,
        messageCn: `${rec.name} 卖空比率 ${rec.shortRatio.toFixed(1)}% 严重警告`,
        data: rec, createdAt: ts,
      });
    } else if (rec.shortRatio >= this.THRESHOLDS.highShortRatio) {
      results.push({
        signalId: `jp_warn_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
        type: 'high_short', severity: 'warning',
        message: `${rec.name} short ratio ${rec.shortRatio.toFixed(1)}%`,
        messageCn: `${rec.name} 卖空比率 ${rec.shortRatio.toFixed(1)}%`,
        data: rec, createdAt: ts,
      });
    }

    // 2. Crowded long (extreme margin buy)
    if (rec.marginRatio >= this.THRESHOLDS.crowdedLongRatio) {
      results.push({
        signalId: `jp_crowded_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
        type: 'crowded_long', severity: 'warning',
        message: `${rec.name} margin ratio ${rec.marginRatio.toFixed(1)}x - crowded long`,
        messageCn: `${rec.name} 信用倍率 ${rec.marginRatio.toFixed(1)}倍 - 做多拥挤`,
        data: rec, createdAt: ts,
      });
    }

    // 3. Crowded short (extreme margin sell)
    if (rec.marginRatio <= this.THRESHOLDS.crowdedShortRatio && rec.marginRatio > 0) {
      results.push({
        signalId: `jp_crowded_short_${rec.symbol}_${ts}`,
        symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
        type: 'crowded_short', severity: 'warning',
        message: `${rec.name} margin ratio ${rec.marginRatio.toFixed(2)}x - crowded short`,
        messageCn: `${rec.name} 信用倍率 ${rec.marginRatio.toFixed(2)}倍 - 做空拥挤`,
        data: rec, createdAt: ts,
      });
    }

    // 4. Margin spike (new margin buy/sell surge)
    const history = this.records_.get(rec.symbol);
    if (history && history.length >= 6) {
      const prev5 = history.slice(-6, -1);
      const avgNewBuy = prev5.reduce((s, r) => s + r.marginBuyNew, 0) / 5;
      const avgNewSell = prev5.reduce((s, r) => s + r.marginSellNew, 0) / 5;

      if (avgNewBuy > 0 && rec.marginBuyNew > avgNewBuy * (1 + this.THRESHOLDS.spikePercent / 100)) {
        results.push({
          signalId: `jp_spike_buy_${rec.symbol}_${ts}`,
          symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
          type: 'margin_spike', severity: 'info',
          message: `${rec.name} margin buying surged ${((rec.marginBuyNew / avgNewBuy - 1) * 100).toFixed(0)}% vs 5D avg`,
          messageCn: `${rec.name} 融资买入激增 vs 5日均值`,
          data: rec, createdAt: ts,
        });
      }

      if (avgNewSell > 0 && rec.marginSellNew > avgNewSell * (1 + this.THRESHOLDS.spikePercent / 100)) {
        results.push({
          signalId: `jp_spike_sell_${rec.symbol}_${ts}`,
          symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
          type: 'margin_spike', severity: 'info',
          message: `${rec.name} margin selling surged`,
          messageCn: `${rec.name} 融券卖出激增`,
          data: rec, createdAt: ts,
        });
      }
    }

    // 5. Ratio reversal
    if (history && history.length >= 6) {
      const prev5AvgRatio = history.slice(-6, -1).reduce((s, r) => s + r.marginRatio, 0) / 5;
      if (prev5AvgRatio > 0) {
        const change = Math.abs(rec.marginRatio - prev5AvgRatio) / prev5AvgRatio * 100;
        if (change >= this.THRESHOLDS.reversalPercent) {
          results.push({
            signalId: `jp_reversal_${rec.symbol}_${ts}`,
            symbol: rec.symbol, name: rec.name, nameEn: rec.nameEn,
            type: 'margin_ratio_reversal', severity: 'warning',
            message: `${rec.name} margin ratio reversal ${change.toFixed(0)}% from 5D avg`,
            messageCn: `${rec.name} 信用倍率急变 vs 5日均值`,
            data: rec, createdAt: ts,
          });
        }
      }
    }

    return results;
  }

  // ── Summary ───────────────────────────────────────────────────────────

  private _refreshSummary(): void {
    if (this.records_.size === 0) return;

    const all: JapanCreditRecord[] = [];
    for (const recs of this.records_.values()) all.push(...recs);

    const dates = [...new Set(all.map(r => r.date))].sort().reverse();
    const latestDate = dates[0];
    const today = all.filter(r => r.date === latestDate);

    const ratios = today.map(r => r.marginRatio).sort((a, b) => a - b);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const medianRatio = ratios[Math.floor(ratios.length / 2)];

    const topBuy = [...today].sort((a, b) => b.marginBuyBalance - a.marginBuyBalance).slice(0, 10);
    const topSell = [...today].sort((a, b) => b.marginSellBalance - a.marginSellBalance).slice(0, 10);
    const topShort = [...today].sort((a, b) => b.shortRatio - a.shortRatio).slice(0, 10);

    // Sector aggregates
    const sectors = new Map<string, { ratios: number[]; shortRatios: number[]; buy: number; sell: number; count: number }>();
    for (const r of today) {
      const map = JP_SECTOR_MAP[r.symbol] || { sector: 'その他', sectorEn: 'Other' };
      const key = map.sector;
      if (!sectors.has(key)) sectors.set(key, { ratios: [], shortRatios: [], buy: 0, sell: 0, count: 0 });
      const e = sectors.get(key)!;
      e.ratios.push(r.marginRatio); e.shortRatios.push(r.shortRatio);
      e.buy += r.marginBuyBalance; e.sell += r.marginSellBalance; e.count++;
    }
    const sectorAggs: JapanSectorCredit[] = Array.from(sectors.entries()).map(([sector, data]) => ({
      sector,
      sectorEn: JP_SECTOR_MAP[Object.keys(JP_SECTOR_MAP).find(k => JP_SECTOR_MAP[k].sector === sector) || '']?.sectorEn || 'Other',
      avgMarginRatio: data.ratios.reduce((a, b) => a + b, 0) / data.ratios.length,
      avgShortRatio: data.shortRatios.reduce((a, b) => a + b, 0) / data.shortRatios.length,
      totalMarginBuy: data.buy,
      totalMarginSell: data.sell,
      stockCount: data.count,
    })).sort((a, b) => b.avgShortRatio - a.avgShortRatio);

    this.summary_ = {
      date: latestDate,
      totalStocks: today.length,
      avgMarginRatio: avgRatio,
      medianMarginRatio: medianRatio,
      highShortCount: today.filter(r => r.shortRatio >= 30).length,
      crowdedLongCount: today.filter(r => r.marginRatio >= 100).length,
      crowdedShortCount: today.filter(r => r.marginRatio <= 0.1).length,
      topMarginBuy: topBuy,
      topMarginSell: topSell,
      topShortRatio: topShort,
      biggestIncrease: [],
      signals: this.signals_.filter(s => s.createdAt > Date.now() - 86400000),
      sectorAggregates: sectorAggs,
      updatedAt: Date.now(),
    };
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getSummary(): JapanCreditSummary | null { return this.summary_; }

  getHistory(symbol: string, limit = 60): JapanCreditRecord[] {
    return (this.records_.get(symbol) || []).slice(-limit);
  }

  getSignals(symbol?: string, type?: JapanCreditSignal['type'], limit = 50): JapanCreditSignal[] {
    let results = [...this.signals_];
    if (symbol) results = results.filter(s => s.symbol === symbol);
    if (type) results = results.filter(s => s.type === type);
    return results.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getTrend(symbol: string): JapanCreditTrend | null {
    const records = this.records_.get(symbol);
    if (!records || records.length < 3) return null;
    const recent = records.slice(-30);
    const first = recent[0];
    const last = recent[recent.length - 1];
    return {
      symbol, name: records[0].name, nameEn: records[0].nameEn,
      points: recent.map(r => ({ date: r.date, marginRatio: r.marginRatio, shortRatio: r.shortRatio, buyBalance: r.marginBuyBalance, sellBalance: r.marginSellBalance })),
      trend: last.marginRatio > first.marginRatio * 1.1 ? 'expanding' : last.marginRatio < first.marginRatio * 0.9 ? 'contracting' : 'stable',
    };
  }

  getMarketStats(): {
    avgMarginRatio: number;
    avgShortRatio: number;
    totalStocks: number;
    highShortWarnings: number;
    crowdedLongWarnings: number;
  } {
    if (!this.summary_) return { avgMarginRatio: 0, avgShortRatio: 0, totalStocks: 0, highShortWarnings: 0, crowdedLongWarnings: 0 };
    return {
      avgMarginRatio: this.summary_.avgMarginRatio,
      avgShortRatio: this.summary_.sectorAggregates.reduce((s, a) => s + a.avgShortRatio, 0) / this.summary_.sectorAggregates.length,
      totalStocks: this.summary_.totalStocks,
      highShortWarnings: this.summary_.highShortCount,
      crowdedLongWarnings: this.summary_.crowdedLongCount,
    };
  }

  getSectorRankings(): JapanSectorCredit[] {
    return this.summary_?.sectorAggregates || [];
  }

  getTopShortRatio(limit = 20): JapanCreditRecord[] {
    return this.summary_?.topShortRatio.slice(0, limit) || [];
  }

  getTopMarginBuy(limit = 20): JapanCreditRecord[] {
    return this.summary_?.topMarginBuy.slice(0, limit) || [];
  }

  getTrackedSymbols(): string[] {
    return Array.from(this.records_.keys());
  }

  /** Bulk ingest with callback for progress */
  bulkIngest(records: JapanCreditRecord[], onProgress?: (pct: number) => void): JapanCreditSignal[] {
    const allSignals: JapanCreditSignal[] = [];
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const sigs = this.ingest(batch);
      allSignals.push(...sigs);
      if (onProgress) onProgress(Math.min(100, ((i + batchSize) / records.length) * 100));
    }
    return allSignals;
  }

  reset(): void {
    this.records_ = new Map();
    this.signals_ = [];
    this.summary_ = null;
  }
}

export const japanCreditSource = new JapanCreditSource();
