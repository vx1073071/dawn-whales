/**
 * R260 P2-06: 行业轮动数据管线 (SectorRotationPipeline)
 * 
 * 行业轮动分析引擎 — 追踪行业板块轮动模式
 * 
 * 功能:
 *   1. 多行业板块表现追踪 (11大行业)
 *   2. 轮动信号检测 (板块切换/资金流向)
 *   3. 轮动热力图数据生成
 *   4. 领先/滞后行业识别
 *   5. 轮动策略建议
 * 
 * 上游: eastmoney-fetcher, yahoo-engine-bridge, investing-rss-fetcher
 * 下游: sector rotation UI, strategy signals
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type SectorCode =
  | 'technology' | 'finance' | 'healthcare' | 'energy'
  | 'consumer' | 'industrial' | 'materials' | 'utilities'
  | 'real_estate' | 'communication' | 'consumer_defensive';

export interface SectorSnapshot {
  sectorCode: SectorCode;
  sectorName: string;
  sectorNameCn: string;
  changePercent: number;
  changePercent5d: number;
  changePercent20d: number;
  volumeRatio: number;
  marketCap: number;
  relativeStrength: number;   // vs broad market
  rank1d: number;
  rank5d: number;
  rank20d: number;
  timestamp: number;
}

export interface RotationSignal {
  signalId: string;
  type: 'sector_switch' | 'leading_change' | 'money_flow' | 'breadth_divergence';
  fromSector?: SectorCode;
  toSector: SectorCode;
  fromSectorNameCn?: string;
  toSectorNameCn: string;
  strength: number;           // 0-1
  confidence: number;         // 0-1
  description: string;
  descriptionCn: string;
  detectedAt: number;
}

export interface HeatmapCell {
  sectorCode: SectorCode;
  sectorNameCn: string;
  period: '1d' | '5d' | '20d' | 'MTD' | 'QTD' | 'YTD';
  changePercent: number;
  volumeRatio: number;
  relativeStrength: number;
}

export interface RotationReport {
  reportId: string;
  date: string;
  currentLeaders: SectorCode[];
  currentLaggards: SectorCode[];
  rotationSignals: RotationSignal[];
  heatmap: HeatmapCell[];
  summaryEn: string;
  summaryCn: string;
  generatedAt: number;
}

// ── Sector definitions ─────────────────────────────────────────────────────

const SECTORS: Array<{ code: SectorCode; name: string; nameCn: string }> = [
  { code: 'technology', name: 'Technology', nameCn: '科技' },
  { code: 'finance', name: 'Finance', nameCn: '金融' },
  { code: 'healthcare', name: 'Healthcare', nameCn: '医疗健康' },
  { code: 'energy', name: 'Energy', nameCn: '能源' },
  { code: 'consumer', name: 'Consumer Cyclical', nameCn: '可选消费' },
  { code: 'industrial', name: 'Industrial', nameCn: '工业' },
  { code: 'materials', name: 'Materials', nameCn: '原材料' },
  { code: 'utilities', name: 'Utilities', nameCn: '公用事业' },
  { code: 'real_estate', name: 'Real Estate', nameCn: '房地产' },
  { code: 'communication', name: 'Communication', nameCn: '通讯服务' },
  { code: 'consumer_defensive', name: 'Consumer Defensive', nameCn: '必需消费' },
];

// ── Rotation patterns ──────────────────────────────────────────────────────

const ROTATION_PATTERNS: Array<{
  name: string;
  nameCn: string;
  sequence: SectorCode[];
  description: string;
  descriptionCn: string;
}> = [
  {
    name: 'Early Cycle',
    nameCn: '早期周期',
    sequence: ['technology', 'consumer', 'industrial'],
    description: 'Tech and consumer lead as economy recovers',
    descriptionCn: '经济复苏期科技和消费领先',
  },
  {
    name: 'Mid Cycle',
    nameCn: '中期周期',
    sequence: ['industrial', 'materials', 'energy'],
    description: 'Industrials and materials strengthen',
    descriptionCn: '工业和原材料走强',
  },
  {
    name: 'Late Cycle',
    nameCn: '后期周期',
    sequence: ['energy', 'materials', 'consumer_defensive'],
    description: 'Energy and defensives take over',
    descriptionCn: '能源和防御性板块接棒',
  },
  {
    name: 'Recession',
    nameCn: '衰退期',
    sequence: ['utilities', 'healthcare', 'consumer_defensive'],
    description: 'Defensive sectors outperform',
    descriptionCn: '防御性板块跑赢',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SectorRotationPipeline
// ═══════════════════════════════════════════════════════════════════════════

export class SectorRotationPipeline {
  private snapshots: Map<PeriodKey, SectorSnapshot[]> = new Map();
  private signals: RotationSignal[] = [];
  private reports: RotationReport[] = [];
  private stats_ = { totalSnapshots: 0, totalSignals: 0 };

  // ── Public API: Data Ingestion ──────────────────────────────────────────

  /**
   * Push a sector snapshot for a specific period (1d, 5d, 20d).
   */
  pushSnapshot(period: PeriodKey, sectors: Array<{
    sectorCode: SectorCode;
    changePercent: number;
    volumeRatio: number;
    marketCap: number;
  }>): SectorSnapshot[] {
    const results: SectorSnapshot[] = [];

    // Compute relative strength vs global market
    const avgChange = sectors.reduce((s, sec) => s + sec.changePercent, 0) / sectors.length;

    // Rank
    const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);

    for (const sec of sectors) {
      const sectorDef = SECTORS.find(s => s.code === sec.sectorCode);
      const rank = sorted.findIndex(s => s.sectorCode === sec.sectorCode) + 1;

      const snapshot: SectorSnapshot = {
        sectorCode: sec.sectorCode,
        sectorName: sectorDef?.name ?? sec.sectorCode,
        sectorNameCn: sectorDef?.nameCn ?? sec.sectorCode,
        changePercent: sec.changePercent,
        changePercent5d: period === '5d' ? sec.changePercent : 0,
        changePercent20d: period === '20d' ? sec.changePercent : 0,
        volumeRatio: sec.volumeRatio,
        marketCap: sec.marketCap,
        relativeStrength: Math.round((sec.changePercent - avgChange) * 100) / 100,
        rank1d: rank,
        rank5d: rank,
        rank20d: rank,
        timestamp: Date.now(),
      };

      results.push(snapshot);
    }

    const existing = this.snapshots.get(period) ?? [];
    existing.push(...results);
    this.snapshots.set(period, existing);
    this.stats_.totalSnapshots += results.length;

    // Detect rotation signals
    this._detectRotation(period);

    return results;
  }

  // ── Public API: Rotation Detection ──────────────────────────────────────

  /**
   * Detect rotation signals by comparing period snapshots.
   */
  detectRotation(): RotationSignal[] {
    const allSignals: RotationSignal[] = [];

    const daySnaps = this.snapshots.get('1d');
    const weekSnaps = this.snapshots.get('5d');

    if (!daySnaps || daySnaps.length === 0) return [];

    // Get latest 1d snapshots
    const latestDay = daySnaps.slice(-11); // latest 11 sectors

    // Leading change detection: sector jumped >3 spots in rank
    if (weekSnaps && weekSnaps.length >= 11) {
      const latestWeek = weekSnaps.slice(-11);
      for (const daySec of latestDay) {
        const weekSec = latestWeek.find(s => s.sectorCode === daySec.sectorCode);
        if (weekSec) {
          const rankChange = weekSec.rank1d - daySec.rank1d;
          if (rankChange >= 3 && daySec.changePercent > 0) {
            allSignals.push(this._makeSignal(
              'leading_change', daySec.sectorCode, daySec.sectorNameCn,
              Math.min(1, rankChange / 5), 0.7,
              `${daySec.sectorName} jumped ${rankChange} spots in 1d vs 5d rank`,
              `${daySec.sectorNameCn}板块排名${rankChange >= 0 ? '上升' : '下降'}${Math.abs(rankChange)}位`,
            ));
          }
        }
      }
    }

    // Sector switch: top sector changed vs previous snapshot
    if (daySnaps.length >= 22) {
      const prev = daySnaps.slice(-22, -11);
      const curr = daySnaps.slice(-11);
      const prevLeader = prev.sort((a, b) => a.rank1d - b.rank1d)[0];
      const currLeader = curr.sort((a, b) => a.rank1d - b.rank1d)[0];

      if (prevLeader && currLeader && prevLeader.sectorCode !== currLeader.sectorCode) {
        allSignals.push(this._makeSignal(
          'sector_switch', currLeader.sectorCode, currLeader.sectorNameCn,
          0.8, 0.75, undefined, prevLeader.sectorCode, prevLeader.sectorNameCn,
          `${prevLeader.sectorName} → ${currLeader.sectorName} as leader`,
          `领涨板块从${prevLeader.sectorNameCn}切换至${currLeader.sectorNameCn}`,
        ));
      }
    }

    // Money flow: volume spike in top sectors
    for (const sec of latestDay) {
      if (sec.volumeRatio > 3 && sec.changePercent > 0) {
        allSignals.push(this._makeSignal(
          'money_flow', sec.sectorCode, sec.sectorNameCn,
          0.6, 0.65,
          `Heavy volume inflow: ${sec.sectorName} (VR ${sec.volumeRatio.toFixed(1)}x)`,
          `资金大幅流入${sec.sectorNameCn}板块（量比${sec.volumeRatio.toFixed(1)}倍）`,
        ));
      }
    }

    // Breadth divergence: top sector strong but other sectors weak
    const leaders = latestDay.filter(s => s.changePercent > 0);
    const laggards = latestDay.filter(s => s.changePercent < -1);
    if (leaders.length <= 3 && laggards.length >= 7) {
      // Narrow leadership → divergence
      for (const leader of leaders) {
        allSignals.push(this._makeSignal(
          'breadth_divergence', leader.sectorCode, leader.sectorNameCn,
          0.5, 0.55,
          `Narrow leadership: only ${leaders.length}/11 sectors positive`,
          `板块分化：仅${leaders.length}/11个板块上涨，${leader.sectorNameCn}独领`,
        ));
        break; // one signal per detection
      }
    }

    this.signals.push(...allSignals);
    this.stats_.totalSignals += allSignals.length;

    return allSignals;
  }

  // ── Public API: Heatmap ─────────────────────────────────────────────────

  /**
   * Generate heatmap data across all periods.
   */
  generateHeatmap(): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    const periods: PeriodKey[] = ['1d', '5d', '20d'];

    for (const period of periods) {
      const snaps = this.snapshots.get(period);
      if (!snaps) continue;

      const latest = snaps.slice(-11);
      for (const s of latest) {
        cells.push({
          sectorCode: s.sectorCode,
          sectorNameCn: s.sectorNameCn,
          period,
          changePercent: s.changePercent,
          volumeRatio: s.volumeRatio,
          relativeStrength: s.relativeStrength,
        });
      }
    }

    return cells;
  }

  // ── Public API: Reports ─────────────────────────────────────────────────

  /**
   * Generate a rotation report.
   */
  generateReport(date: string): RotationReport {
    const daySnaps = this.snapshots.get('1d')?.slice(-11) ?? [];
    const sorted = [...daySnaps].sort((a, b) => b.changePercent - a.changePercent);

    const leaders = sorted.slice(0, 3).map(s => s.sectorCode);
    const laggards = sorted.slice(-3).reverse().map(s => s.sectorCode);

    const allSignals = this.signals.slice(-20);
    const heatmap = this.generateHeatmap();

    // Match rotation pattern
    const matchedPattern = ROTATION_PATTERNS.find(p =>
      p.sequence.some(sec => leaders.includes(sec))
    );

    const summaryEn = matchedPattern
      ? `Rotation: ${matchedPattern.name} phase — ${matchedPattern.description}. Leaders: ${leaders.map(l => SECTORS.find(s => s.code === l)?.name).join(', ')}`
      : `Sector rotation active. Leaders: ${leaders.map(l => SECTORS.find(s => s.code === l)?.name).join(', ')}`;
    const summaryCn = matchedPattern
      ? `轮动：${matchedPattern.nameCn}阶段 — ${matchedPattern.descriptionCn}。领涨：${leaders.map(l => SECTORS.find(s => s.code === l)?.nameCn).join('、')}`
      : `板块轮动进行中。领涨：${leaders.map(l => SECTORS.find(s => s.code === l)?.nameCn).join('、')}`;

    const report: RotationReport = {
      reportId: `rotrep:${date}`,
      date,
      currentLeaders: leaders,
      currentLaggards: laggards,
      rotationSignals: allSignals,
      heatmap,
      summaryEn,
      summaryCn,
      generatedAt: Date.now(),
    };

    this.reports.push(report);
    if (this.reports.length > 90) this.reports.shift();

    return report;
  }

  // ── Public API: Strategy Suggestions ────────────────────────────────────

  /**
   * Get sector rotation strategy suggestions.
   */
  getStrategySuggestions(): Array<{
    sector: SectorCode;
    sectorCn: string;
    action: 'overweight' | 'neutral' | 'underweight';
    reason: string;
    reasonCn: string;
  }> {
    const daySnaps = this.snapshots.get('1d')?.slice(-11) ?? [];
    const suggestions: Array<{
      sector: SectorCode; sectorCn: string; action: 'overweight' | 'neutral' | 'underweight';
      reason: string; reasonCn: string;
    }> = [];

    for (const snap of daySnaps) {
      let action: 'overweight' | 'neutral' | 'underweight' = 'neutral';
      let reason = '';
      let reasonCn = '';

      if (snap.changePercent > 2 && snap.volumeRatio > 1.5) {
        action = 'overweight';
        reason = `Strong momentum + volume (${snap.changePercent.toFixed(1)}%, VR ${snap.volumeRatio.toFixed(1)})`;
        reasonCn = `强势突破+放量（${snap.changePercent.toFixed(1)}%，量比${snap.volumeRatio.toFixed(1)}）`;
      } else if (snap.changePercent < -2) {
        action = 'underweight';
        reason = `Weak sector (${snap.changePercent.toFixed(1)}%)`;
        reasonCn = `弱势板块（${snap.changePercent.toFixed(1)}%）`;
      } else {
        reason = 'Neutral momentum';
        reasonCn = '中性表现';
      }

      suggestions.push({
        sector: snap.sectorCode,
        sectorCn: snap.sectorNameCn,
        action,
        reason,
        reasonCn,
      });
    }

    return suggestions;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get latest snapshots for a period */
  getSnapshots(period: PeriodKey): SectorSnapshot[] {
    return (this.snapshots.get(period) ?? []).slice(-11);
  }

  /** Get snapshot for a specific sector */
  getSectorSnapshot(sector: SectorCode, period: PeriodKey): SectorSnapshot | null {
    const snaps = this.snapshots.get(period);
    if (!snaps) return null;
    const sectorSnaps = snaps.filter(s => s.sectorCode === sector);
    return sectorSnaps.length > 0 ? sectorSnaps[sectorSnaps.length - 1] : null;
  }

  /** Get signals */
  getSignals(type?: RotationSignal['type'], limit = 50): RotationSignal[] {
    let results = this.signals;
    if (type) results = results.filter(s => s.type === type);
    return results.slice(-limit).reverse();
  }

  /** Get report for date */
  getReport(date: string): RotationReport | null {
    return this.reports.find(r => r.date === date) ?? null;
  }

  /** Get all reports */
  getReports(limit = 30): RotationReport[] {
    return this.reports.slice(-limit).reverse();
  }

  /** Get rotation patterns */
  getRotationPatterns() {
    return ROTATION_PATTERNS;
  }

  /** Get sector definitions */
  getSectors() { return SECTORS; }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.snapshots.clear();
    this.signals = [];
    this.reports = [];
    this.stats_ = { totalSnapshots: 0, totalSignals: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _detectRotation(period: PeriodKey): void {
    if (period === '1d') {
      this.detectRotation();
    }
  }

  private _makeSignal(
    type: RotationSignal['type'],
    toSector: SectorCode,
    toSectorNameCn: string,
    strength: number,
    confidence: number,
    desc: string,
    descCn: string,
    fromSector?: SectorCode,
    fromSectorNameCn?: string,
    fromDesc?: string,
    fromDescCn?: string,
  ): RotationSignal {
    return {
      signalId: `rotsig:${type}:${toSector}:${Date.now()}:${this._hash(type + toSector).toString(36).slice(0, 6)}`,
      type,
      fromSector,
      toSector,
      fromSectorNameCn,
      toSectorNameCn,
      strength: Math.round(strength * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      description: fromDesc ?? desc,
      descriptionCn: fromDescCn ?? descCn,
      detectedAt: Date.now(),
    };
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

type PeriodKey = '1d' | '5d' | '20d' | 'MTD' | 'QTD' | 'YTD';

export const sectorRotationPipeline = new SectorRotationPipeline();
