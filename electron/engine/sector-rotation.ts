// ── Sector Rotation Monitor — Track Capital Flow Rotation ──────────────────
// JVS-6: Identifies sectors with consecutive capital inflows/outflows
// Uses JVS-1 heatmap data + time series to detect rotation patterns

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectorSnapshot {
  code: string;
  name: string;
  changePct: number;
  volume: number;
  risingCount: number;
  fallingCount: number;
  timestamp: number;
}

export interface SectorTimeSeries {
  code: string;
  name: string;
  snapshots: SectorSnapshot[];
  trend: SectorTrend;
}

export interface SectorTrend {
  direction: 'hot' | 'warming' | 'cooling' | 'cold';
  consecutiveUpDays: number;
  consecutiveDownDays: number;
  avgChangePct: number;       // Average change over tracked period
  totalVolumeChange: number;  // Volume trend
  momentumScore: number;      // 0-100 composite momentum
}

export interface RotationSignal {
  type: 'sector_heating' | 'sector_cooling' | 'rotation_detected' | 'leader_change';
  fromSectors: string[];      // Sectors losing momentum
  toSectors: string[];        // Sectors gaining momentum
  confidence: number;         // 0-1
  description: string;
  timestamp: number;
}

export interface RotationReport {
  success: boolean;
  hotSectors: SectorTimeSeries[];     // Top gaining momentum
  coldSectors: SectorTimeSeries[];    // Top losing momentum
  signals: RotationSignal[];
  leaderBoard: SectorLeader[];
  summary: string;
  timestamp: number;
}

export interface SectorLeader {
  code: string;
  name: string;
  rank: number;
  momentumScore: number;
  changePct: number;
  daysInTop: number;
}

// ── Configuration ──────────────────────────────────────────────────────────

const MAX_HISTORY = 20;          // Keep last 20 snapshots per sector
const SNAPSHOT_TTL = 4 * 60 * 60 * 1000; // 4 hours between snapshots
const HOT_THRESHOLD = 70;        // Momentum score >= 70 = hot
const COLD_THRESHOLD = 30;       // Momentum score <= 30 = cold

// ── Sector Rotation Monitor ────────────────────────────────────────────────

export class SectorRotationMonitor {
  private history = new Map<string, SectorSnapshot[]>();
  private db: any = null;

  constructor() {
    log.info('[SectorRotation] Initialized');
  }

  initialize(db: any): void {
    this.db = db;
    this.createTables();
    this.loadHistory();
  }

  private createTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sector_rotation_history (
        code TEXT NOT NULL,
        name TEXT,
        change_pct REAL,
        volume REAL,
        rising_count INTEGER,
        falling_count INTEGER,
        recorded_at INTEGER NOT NULL,
        PRIMARY KEY (code, recorded_at)
      );
      CREATE INDEX IF NOT EXISTS idx_sector_rot_code ON sector_rotation_history(code);
      CREATE INDEX IF NOT EXISTS idx_sector_rot_time ON sector_rotation_history(recorded_at DESC);
    `);
  }

  private loadHistory(): void {
    if (!this.db) return;
    try {
      const rows = this.db.prepare(
        'SELECT * FROM sector_rotation_history WHERE recorded_at > ? ORDER BY recorded_at ASC'
      ).all(Date.now() - 7 * 24 * 60 * 60 * 1000) as any[];

      for (const r of rows) {
        const key = r.code;
        if (!this.history.has(key)) this.history.set(key, []);
        this.history.get(key)!.push({
          code: r.code,
          name: r.name || '',
          changePct: r.change_pct ?? 0,
          volume: r.volume ?? 0,
          risingCount: r.rising_count ?? 0,
          fallingCount: r.falling_count ?? 0,
          timestamp: r.recorded_at,
        });
      }

      // Trim history
      for (const [key, snaps] of this.history) {
        if (snaps.length > MAX_HISTORY) {
          this.history.set(key, snaps.slice(-MAX_HISTORY));
        }
      }

      log.info(`[SectorRotation] Loaded ${this.history.size} sectors from history`);
    } catch (err: any) {
      log.warn('[SectorRotation] Failed to load history:', err.message);
    }
  }

  /**
   * Record a new snapshot of sector data
   * Called periodically (e.g., every 30min during trading hours)
   */
  recordSnapshot(sectors: SectorSnapshot[], force = false): void {
    const now = Date.now();

    // Check if we should record (enforce TTL between snapshots)
    if (!force) {
      const lastSnapshot = this.getLastSnapshotTime();
      if (lastSnapshot && now - lastSnapshot < SNAPSHOT_TTL) {
        return; // Too soon
      }
    }

    for (const sector of sectors) {
      if (!this.history.has(sector.code)) {
        this.history.set(sector.code, []);
      }
      const snaps = this.history.get(sector.code)!;
      snaps.push({ ...sector, timestamp: now });

      // Trim
      if (snaps.length > MAX_HISTORY) {
        snaps.shift();
      }
    }

    // Save to SQLite
    this.saveSnapshotToDB(sectors, now);
    log.info(`[SectorRotation] Recorded ${sectors.length} sectors at ${new Date(now).toISOString()}`);
  }

  private saveSnapshotToDB(sectors: SectorSnapshot[], timestamp: number): void {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sector_rotation_history
      (code, name, change_pct, volume, rising_count, falling_count, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((items: SectorSnapshot[]) => {
      for (const s of items) {
        stmt.run(s.code, s.name, s.changePct, s.volume, s.risingCount, s.fallingCount, timestamp);
      }
    });

    tx(sectors);
  }

  private getLastSnapshotTime(): number | null {
    let latest = 0;
    for (const snaps of this.history.values()) {
      if (snaps.length > 0) {
        const t = snaps[snaps.length - 1].timestamp;
        if (t > latest) latest = t;
      }
    }
    return latest || null;
  }

  /**
   * Analyze rotation and generate report
   */
  analyze(): RotationReport {
    const timeSeriesList: SectorTimeSeries[] = [];

    for (const [code, snaps] of this.history) {
      if (snaps.length < 2) continue; // Need at least 2 data points

      const trend = this.computeTrend(snaps);
      timeSeriesList.push({
        code,
        name: snaps[snaps.length - 1].name,
        snapshots: snaps,
        trend,
      });
    }

    // Sort by momentum score
    timeSeriesList.sort((a, b) => b.trend.momentumScore - a.trend.momentumScore);

    const hotSectors = timeSeriesList.filter(t => t.trend.momentumScore >= HOT_THRESHOLD).slice(0, 10);
    const coldSectors = timeSeriesList.filter(t => t.trend.momentumScore <= COLD_THRESHOLD).slice(0, 10);

    // Detect rotation signals
    const signals = this.detectRotation(timeSeriesList);

    // Leader board
    const leaderBoard = timeSeriesList.slice(0, 10).map((ts, i) => ({
      code: ts.code,
      name: ts.name,
      rank: i + 1,
      momentumScore: ts.trend.momentumScore,
      changePct: ts.snapshots[ts.snapshots.length - 1].changePct,
      daysInTop: ts.snapshots.length,
    }));

    const summary = this.generateSummary(hotSectors, coldSectors, signals);

    return {
      success: timeSeriesList.length > 0,
      hotSectors,
      coldSectors,
      signals,
      leaderBoard,
      summary,
      timestamp: Date.now(),
    };
  }

  private computeTrend(snaps: SectorSnapshot[]): SectorTrend {
    const changes = snaps.map(s => s.changePct);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;

    // Consecutive up/down days
    let consecutiveUp = 0;
    let consecutiveDown = 0;
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i] > 0 && consecutiveDown === 0) consecutiveUp++;
      else if (changes[i] < 0 && consecutiveUp === 0) consecutiveDown++;
      else break;
    }

    // Volume trend (compare recent vs older)
    const mid = Math.floor(snaps.length / 2);
    const oldVol = snaps.slice(0, mid).reduce((s, v) => s + v.volume, 0) / Math.max(mid, 1);
    const newVol = snaps.slice(mid).reduce((s, v) => s + v.volume, 0) / Math.max(snaps.length - mid, 1);
    const totalVolumeChange = oldVol > 0 ? ((newVol - oldVol) / oldVol) * 100 : 0;

    // Market breadth trend
    const breadthScores = snaps.map(s => {
      const total = s.risingCount + s.fallingCount;
      return total > 0 ? s.risingCount / total : 0.5;
    });
    const avgBreadth = breadthScores.reduce((a, b) => a + b, 0) / breadthScores.length;

    // Momentum score (0-100)
    // Components: avgChange (40%), breadth (30%), volume trend (20%), consecutive (10%)
    const changeScore = Math.max(0, Math.min(100, 50 + avgChange * 10));
    const breadthScore = avgBreadth * 100;
    const volumeScore = Math.max(0, Math.min(100, 50 + totalVolumeChange));
    const consecutiveScore = consecutiveUp > 0
      ? Math.min(100, 50 + consecutiveUp * 15)
      : consecutiveDown > 0
        ? Math.max(0, 50 - consecutiveDown * 15)
        : 50;

    const momentumScore = Math.round(
      changeScore * 0.4 + breadthScore * 0.3 + volumeScore * 0.2 + consecutiveScore * 0.1
    );

    let direction: SectorTrend['direction'];
    if (momentumScore >= HOT_THRESHOLD) direction = 'hot';
    else if (momentumScore >= 50) direction = 'warming';
    else if (momentumScore >= COLD_THRESHOLD) direction = 'cooling';
    else direction = 'cold';

    return {
      direction,
      consecutiveUpDays: consecutiveUp,
      consecutiveDownDays: consecutiveDown,
      avgChangePct: Math.round(avgChange * 100) / 100,
      totalVolumeChange: Math.round(totalVolumeChange * 100) / 100,
      momentumScore: Math.max(0, Math.min(100, momentumScore)),
    };
  }

  private detectRotation(series: SectorTimeSeries[]): RotationSignal[] {
    const signals: RotationSignal[] = [];

    if (series.length < 5) return signals;

    // Compare top vs bottom momentum changes
    const top5 = series.slice(0, 5);
    const bottom5 = series.slice(-5);

    // Detect heating sectors (recent snapshots showing improvement)
    const heating = top5.filter(s => {
      const recent = s.snapshots.slice(-3);
      const older = s.snapshots.slice(-6, -3);
      if (recent.length === 0 || older.length === 0) return false;
      const recentAvg = recent.reduce((sum, v) => sum + v.changePct, 0) / recent.length;
      const olderAvg = older.reduce((sum, v) => sum + v.changePct, 0) / older.length;
      return recentAvg > olderAvg + 0.5; // Improving by >0.5%
    });

    // Detect cooling sectors
    const cooling = bottom5.filter(s => {
      const recent = s.snapshots.slice(-3);
      const older = s.snapshots.slice(-6, -3);
      if (recent.length === 0 || older.length === 0) return false;
      const recentAvg = recent.reduce((sum, v) => sum + v.changePct, 0) / recent.length;
      const olderAvg = older.reduce((sum, v) => sum + v.changePct, 0) / older.length;
      return recentAvg < olderAvg - 0.5; // Declining by >0.5%
    });

    if (heating.length > 0 && cooling.length > 0) {
      signals.push({
        type: 'rotation_detected',
        fromSectors: cooling.map(s => s.name),
        toSectors: heating.map(s => s.name),
        confidence: Math.min(1, (heating.length + cooling.length) / 6),
        description: `Rotation: capital flowing from [${cooling.map(s => s.name).join(', ')}] to [${heating.map(s => s.name).join(', ')}]`,
        timestamp: Date.now(),
      });
    }

    // Hot sector signals
    if (heating.length >= 3) {
      signals.push({
        type: 'sector_heating',
        fromSectors: [],
        toSectors: heating.map(s => s.name),
        confidence: Math.min(1, heating.length / 5),
        description: `Multiple sectors heating up: ${heating.map(s => s.name).join(', ')}`,
        timestamp: Date.now(),
      });
    }

    // Cold sector signals
    if (cooling.length >= 3) {
      signals.push({
        type: 'sector_cooling',
        fromSectors: cooling.map(s => s.name),
        toSectors: [],
        confidence: Math.min(1, cooling.length / 5),
        description: `Multiple sectors cooling down: ${cooling.map(s => s.name).join(', ')}`,
        timestamp: Date.now(),
      });
    }

    return signals;
  }

  private generateSummary(
    hot: SectorTimeSeries[],
    cold: SectorTimeSeries[],
    signals: RotationSignal[]
  ): string {
    if (hot.length === 0 && cold.length === 0) {
      return 'Insufficient data for sector rotation analysis';
    }

    const parts: string[] = [];

    if (hot.length > 0) {
      parts.push(`Hot sectors: ${hot.slice(0, 3).map(s => `${s.name}(${s.trend.momentumScore})`).join(', ')}`);
    }

    if (cold.length > 0) {
      parts.push(`Cold sectors: ${cold.slice(0, 3).map(s => `${s.name}(${s.trend.momentumScore})`).join(', ')}`);
    }

    const rotations = signals.filter(s => s.type === 'rotation_detected');
    if (rotations.length > 0) {
      parts.push(`Rotation detected: ${rotations[0].description}`);
    }

    return parts.join('. ') || 'No significant sector rotation detected';
  }

  /**
   * Clear old history
   */
  clearOldHistory(): void {
    if (!this.db) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    this.db.prepare('DELETE FROM sector_rotation_history WHERE recorded_at < ?').run(cutoff);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let rotationMonitorInstance: SectorRotationMonitor | null = null;

export function getSectorRotationMonitor(): SectorRotationMonitor {
  if (!rotationMonitorInstance) {
    rotationMonitorInstance = new SectorRotationMonitor();
  }
  return rotationMonitorInstance;
}
