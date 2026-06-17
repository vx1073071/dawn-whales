/**
 * R259 P1-08: 卖空数据管线 (ShortSellingPipeline)
 * 
 * 港股卖空数据引擎 — 追踪卖空比例、异动、与价格关系
 * 
 * 功能:
 *   1. 港股每日卖空数据接入
 *   2. 卖空比例计算与排名
 *   3. 卖空异动检测 (突增 → 价格预警)
 *   4. 卖空拥挤度分析 (crowding risk)
 *   5. 卖空回补信号 (short squeeze detection)
 * 
 * 数据源: HKEX Short Selling Daily Report, 券商卖空数据
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ShortSellingRecord {
  symbol: string;
  name: string;
  nameCn: string;
  date: string;                  // YYYY-MM-DD
  shortVolume: number;           // shares sold short
  totalVolume: number;           // total market volume
  shortRatio: number;            // shortVolume / totalVolume (%)
  shortTurnover: number;         // HKD value
  previousShortRatio?: number;   // previous day's ratio
  changeFromPrev?: number;       // change in ratio points
}

export interface ShortSellingSignal {
  signalId: string;
  symbol: string;
  name: string;
  nameCn: string;
  date: string;
  shortRatio: number;
  signalType: ShortSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  descriptionCn: string;
  detectedAt: number;
}

export type ShortSignalType =
  | 'short_spike'        // 卖空突增
  | 'short_squeeze'      // 逼空风险
  | 'high_crowding'      // 拥挤度过高
  | 'declining_short'    // 卖空减少 → 可能反转
  | 'persistent_short';  // 持续卖空

export interface ShortSellingSummary {
  summaryId: string;
  date: string;
  totalRecords: number;
  avgShortRatio: number;
  topShorted: ShortSellingRecord[];      // top 10
  biggestIncrease: ShortSellingRecord[]; // top change
  signalsGenerated: number;
  generatedAt: number;
}

// ── Thresholds ─────────────────────────────────────────────────────────────

const SHORT_THRESHOLDS = {
  spike: { ratioChange: 5, minRatio: 10 },           // ratio jump >5pp AND ratio >10%
  squeeze: { ratio: 25, volumeSpike: 3 },            // ratio >25% AND vol >3x avg
  crowding: { ratio: 30 },                            // ratio >30%
  declining: { ratioChange: -5, fromRatio: 15 },      // ratio drop >5pp from >15%
  persistent: { ratio: 15, consecutiveDays: 3 },       // ratio >15% for 3+ days
};

// ═══════════════════════════════════════════════════════════════════════════
// ShortSellingPipeline
// ═══════════════════════════════════════════════════════════════════════════

export class ShortSellingPipeline {
  private records: Map<string, ShortSellingRecord[]> = new Map(); // symbol → history
  private signals: ShortSellingSignal[] = [];
  private summaries: ShortSellingSummary[] = [];
  private stats_ = { totalRecords: 0, totalSignals: 0, avgRatio: 0 };

  constructor() {}

  // ── Public API: Data Ingestion ──────────────────────────────────────────

  /**
   * Ingest a batch of short-selling records (e.g., daily HKEX report).
   */
  ingest(records: ShortSellingRecord[]): ShortSellingRecord[] {
    for (const rec of records) {
      const symbolRecords = this.records.get(rec.symbol) ?? [];
      symbolRecords.push(rec);
      this.records.set(rec.symbol, symbolRecords);
      this.stats_.totalRecords++;
    }

    // Update avg ratio
    if (records.length > 0) {
      const newAvg = records.reduce((s, r) => s + r.shortRatio, 0) / records.length;
      this.stats_.avgRatio = Math.round(
        (this.stats_.avgRatio * (this.stats_.totalRecords - records.length) + newAvg * records.length)
        / this.stats_.totalRecords * 100
      ) / 100;
    }

    // Detect signals from batch
    for (const rec of records) {
      const signals_ = this._detectSignals(rec);
      this.signals.push(...signals_);
      this.stats_.totalSignals += signals_.length;
    }

    return records;
  }

  /**
   * Generate a daily summary from today's records.
   */
  generateSummary(date: string): ShortSellingSummary {
    const todayRecords: ShortSellingRecord[] = [];
    this.records.forEach((symbolRecords) => {
      const today = symbolRecords.filter(r => r.date === date);
      todayRecords.push(...today);
    });

    const avgRatio = todayRecords.length > 0
      ? todayRecords.reduce((s, r) => s + r.shortRatio, 0) / todayRecords.length
      : 0;

    const sortedByRatio = [...todayRecords].sort((a, b) => b.shortRatio - a.shortRatio);
    const sortedByChange = [...todayRecords]
      .filter(r => r.changeFromPrev !== undefined)
      .sort((a, b) => Math.abs(b.changeFromPrev!) - Math.abs(a.changeFromPrev!));

    const todaySignals = this.signals.filter(s => s.date === date);

    const summary: ShortSellingSummary = {
      summaryId: `shsum:${date}`,
      date,
      totalRecords: todayRecords.length,
      avgShortRatio: Math.round(avgRatio * 100) / 100,
      topShorted: sortedByRatio.slice(0, 10),
      biggestIncrease: sortedByChange.slice(0, 10),
      signalsGenerated: todaySignals.length,
      generatedAt: Date.now(),
    };

    this.summaries.push(summary);
    if (this.summaries.length > 60) this.summaries.shift();

    return summary;
  }

  // ── Public API: Signal Detection ────────────────────────────────────────

  /**
   * Check for short squeeze conditions on a symbol.
   */
  checkShortSqueeze(symbol: string, currentPrice: number, avgPrice: number): {
    squeezeRisk: boolean;
    squeezeScore: number;
    description: string;
    descriptionCn: string;
  } {
    const symbolRecords = this.records.get(symbol) ?? [];
    if (symbolRecords.length === 0) {
      return { squeezeRisk: false, squeezeScore: 0, description: 'No data', descriptionCn: '无数据' };
    }

    const latest = symbolRecords[symbolRecords.length - 1];
    const priceChange = ((currentPrice - avgPrice) / avgPrice) * 100;

    // Short squeeze: high short ratio + price rising
    const squeezeScore = latest.shortRatio * (priceChange > 0 ? 1 : 0.3) / 100;

    const risk = squeezeScore > 0.2;
    const desc = risk
      ? `Short squeeze risk: ${latest.shortRatio.toFixed(1)}% short, price +${priceChange.toFixed(1)}%`
      : `No squeeze risk (score ${squeezeScore.toFixed(2)})`;
    const descCn = risk
      ? `逼空风险：卖空比例${latest.shortRatio.toFixed(1)}%，价格上涨${priceChange.toFixed(1)}%`
      : `无逼空风险 (评分${squeezeScore.toFixed(2)})`;

    return {
      squeezeRisk: risk,
      squeezeScore: Math.round(squeezeScore * 100) / 100,
      description: desc,
      descriptionCn: descCn,
    };
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get short selling history for a symbol */
  getHistory(symbol: string, limit = 30): ShortSellingRecord[] {
    const symbolRecords = this.records.get(symbol) ?? [];
    return symbolRecords.slice(-limit).reverse();
  }

  /** Get latest record for a symbol */
  getLatest(symbol: string): ShortSellingRecord | null {
    const records = this.records.get(symbol) ?? [];
    return records.length > 0 ? records[records.length - 1] : null;
  }

  /** Get all signals */
  getSignals(symbol?: string, type?: ShortSignalType, limit = 100): ShortSellingSignal[] {
    let results = this.signals;
    if (symbol) results = results.filter(s => s.symbol === symbol);
    if (type) results = results.filter(s => s.signalType === type);
    return results.slice(-limit).reverse();
  }

  /** Get top N most shorted stocks (latest date) */
  getMostShorted(limit = 20): ShortSellingRecord[] {
    const latest: ShortSellingRecord[] = [];
    this.records.forEach((records) => {
      if (records.length > 0) latest.push(records[records.length - 1]);
    });
    return latest.sort((a, b) => b.shortRatio - a.shortRatio).slice(0, limit);
  }

  /** Get summary for a date */
  getSummary(date: string): ShortSellingSummary | null {
    return this.summaries.find(s => s.date === date) ?? null;
  }

  /** Get all summaries */
  getSummaries(limit = 30): ShortSellingSummary[] {
    return this.summaries.slice(-limit).reverse();
  }

  /** Get all symbols tracked */
  getTrackedSymbols(): string[] {
    return Array.from(this.records.keys());
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.records.clear();
    this.signals = [];
    this.summaries = [];
    this.stats_ = { totalRecords: 0, totalSignals: 0, avgRatio: 0 };
  }

  // ── Private: Signal Detection ────────────────────────────────────────────

  private _detectSignals(rec: ShortSellingRecord): ShortSellingSignal[] {
    const signals: ShortSellingSignal[] = [];

    // Short spike: ratio jumped
    if (rec.changeFromPrev !== undefined && rec.changeFromPrev >= SHORT_THRESHOLDS.spike.ratioChange &&
        rec.shortRatio >= SHORT_THRESHOLDS.spike.minRatio) {
      signals.push(this._makeSignal(rec, 'short_spike', 'high',
        `Short ratio spiked ${rec.changeFromPrev.toFixed(1)}pp to ${rec.shortRatio.toFixed(1)}%`,
        `卖空比例跳升${rec.changeFromPrev.toFixed(1)}个百分点至${rec.shortRatio.toFixed(1)}%`));
    }

    // Crowding: very high short ratio
    if (rec.shortRatio >= SHORT_THRESHOLDS.crowding.ratio) {
      signals.push(this._makeSignal(rec, 'high_crowding', 'critical',
        `Extreme short crowding: ${rec.shortRatio.toFixed(1)}%`,
        `极端卖空拥挤：${rec.shortRatio.toFixed(1)}%`));
    } else if (rec.shortRatio >= SHORT_THRESHOLDS.crowding.ratio * 0.7) {
      signals.push(this._makeSignal(rec, 'high_crowding', 'high',
        `High short crowding: ${rec.shortRatio.toFixed(1)}%`,
        `卖空拥挤度偏高：${rec.shortRatio.toFixed(1)}%`));
    }

    // Declining: ratio dropping significantly
    if (rec.changeFromPrev !== undefined && rec.changeFromPrev <= SHORT_THRESHOLDS.declining.fromRatio &&
        rec.previousShortRatio && rec.previousShortRatio >= SHORT_THRESHOLDS.declining.fromRatio) {
      signals.push(this._makeSignal(rec, 'declining_short', 'medium',
        `Short ratio declining from ${rec.previousShortRatio.toFixed(1)}% to ${rec.shortRatio.toFixed(1)}% (potential reversal)`,
        `卖空比例从${rec.previousShortRatio.toFixed(1)}%降至${rec.shortRatio.toFixed(1)}%（潜在反转）`));
    }

    // Persistent: check consecutive days
    if (rec.shortRatio >= SHORT_THRESHOLDS.persistent.ratio) {
      const history = this.records.get(rec.symbol) ?? [];
      const recent = history.slice(-SHORT_THRESHOLDS.persistent.consecutiveDays);
      if (recent.length >= SHORT_THRESHOLDS.persistent.consecutiveDays &&
          recent.every(r => r.shortRatio >= SHORT_THRESHOLDS.persistent.ratio)) {
        signals.push(this._makeSignal(rec, 'persistent_short', 'high',
          `Persistent short >15% for ${recent.length} consecutive days`,
          `持续卖空>15%已${recent.length}个交易日`));
      }
    }

    return signals;
  }

  private _makeSignal(
    rec: ShortSellingRecord,
    type: ShortSignalType,
    severity: ShortSellingSignal['severity'],
    desc: string,
    descCn: string,
  ): ShortSellingSignal {
    return {
      signalId: `shsig:${rec.symbol}:${type}:${Date.now()}:${this._hash(rec.symbol + type).toString(36).slice(0, 6)}`,
      symbol: rec.symbol,
      name: rec.name,
      nameCn: rec.nameCn,
      date: rec.date,
      shortRatio: rec.shortRatio,
      signalType: type,
      severity,
      description: desc,
      descriptionCn: descCn,
      detectedAt: Date.now(),
    };
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const shortSellingPipeline = new ShortSellingPipeline();
