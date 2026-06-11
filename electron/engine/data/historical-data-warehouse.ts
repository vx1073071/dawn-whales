// ── Historical Data Warehouse (JVS-58) ─────────────────────────────────────
// - memory）→ （SQLite）→ （compress）

import Database from 'better-sqlite3';
import { EngineError } from '../core/engine-error';
import { createGzip, createGunzip } from 'zlib';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface HistoricalDataPoint {
  symbol: string;
  timestamp: number;      // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}

export interface DataTier {
  type: 'hot' | 'warm' | 'cold';
  location: string;       // Path or memory
  ttl: number;            // TTL in ms
  maxAge?: number;        // Max age before archiving
}

export interface HistoricalQuery {
  symbol: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  interval?: '1min' | '5min' | '15min' | '30min' | '1hour' | '1day';
}

export interface DataArchive {
  symbol: string;
  startTime: number;
  endTime: number;
  dataPoints: number;
  filePath: string;
  compressed: boolean;
  sizeBytes: number;
  createdAt: number;
}

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  hotDataTTL: 5 * 60 * 1000,        // 5 minutes
  warmDataTTL: 7 * 24 * 60 * 60 * 1000,  // 7 days
  coldDataRetention: 365 * 24 * 60 * 60 * 1000,  // 365 days
  maxHotDataPoints: 10000,
  maxWarmDataPoints: 100000,
  archiveDir: join(process.cwd(), 'data', 'archives'),
  dbPath: join(process.cwd(), 'data', 'historical.db'),
};

// ── Historical Data Warehouse ──────────────────────────────────────────────

export class HistoricalDataWarehouse {
  private hotCache = new Map<string, HistoricalDataPoint[]>();
  private warmDB: Database.Database | null = null;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initDatabase();
    this.initArchiveDir();
  }

  private initDatabase(): void {
    try {
      this.warmDB = new Database(this.config.dbPath);
      this.warmDB.pragma('journal_mode = WAL');
      this.warmDB.pragma('synchronous = NORMAL');

      // Create historical data table
      this.warmDB.exec(`
        CREATE TABLE IF NOT EXISTS historical_data (
          symbol TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          open REAL NOT NULL,
          high REAL NOT NULL,
          low REAL NOT NULL,
          close REAL NOT NULL,
          volume REAL NOT NULL,
          turnover REAL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (symbol, timestamp)
        );
        CREATE INDEX IF NOT EXISTS idx_historical_symbol ON historical_data(symbol);
        CREATE INDEX IF NOT EXISTS idx_historical_timestamp ON historical_data(timestamp);
        CREATE INDEX IF NOT EXISTS idx_historical_composite ON historical_data(symbol, timestamp);
      `);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      void EngineError; // structured error domain: DATA
      log.error('[HistoricalDataWarehouse] Failed to init database:', err);
    }
  }

  private initArchiveDir(): void {
    if (!existsSync(this.config.archiveDir)) {
      mkdirSync(this.config.archiveDir, { recursive: true });
    }
  }

  /**
   * Add historical data point
   */
  addDataPoint(point: HistoricalDataPoint): void {
    const { symbol } = point;

    // Add to hot cache
    if (!this.hotCache.has(symbol)) {
      this.hotCache.set(symbol, []);
    }

    const cache = this.hotCache.get(symbol)!;
    cache.push(point);

    // Trim hot cache if too large
    if (cache.length > this.config.maxHotDataPoints) {
      const removed = cache.splice(0, cache.length - this.config.maxHotDataPoints);
      this.archiveToWarm(removed);
    }

    // Also save to warm DB immediately
    this.saveToWarmDB(point);
  }

  /**
   * Add multiple data points (batch)
   */
  addBatch(points: HistoricalDataPoint[]): void {
    const bySymbol = new Map<string, HistoricalDataPoint[]>();

    for (const point of points) {
      if (!bySymbol.has(point.symbol)) {
        bySymbol.set(point.symbol, []);
      }
      bySymbol.get(point.symbol)!.push(point);
    }

    for (const [symbol, symbolPoints] of bySymbol) {
      // Add to hot cache
      if (!this.hotCache.has(symbol)) {
        this.hotCache.set(symbol, []);
      }

      const cache = this.hotCache.get(symbol)!;
      cache.push(...symbolPoints);

      // Trim if too large
      if (cache.length > this.config.maxHotDataPoints) {
        const removed = cache.splice(0, cache.length - this.config.maxHotDataPoints);
        this.archiveToWarm(removed);
      }

      // Save to warm DB
      this.saveBatchToWarmDB(symbolPoints);
    }
  }

  /**
   * Query historical data
   */
  async query(query: HistoricalQuery): Promise<HistoricalDataPoint[]> {
    const { symbol, startTime, endTime, limit, interval } = query;

    // Try hot cache first
    const hotData = this.hotCache.get(symbol) || [];
    let results = hotData.filter(p => {
      if (startTime && p.timestamp < startTime) return false;
      if (endTime && p.timestamp > endTime) return false;
      return true;
    });

    // Query warm DB if needed
    if (results.length < (limit || 1000) && this.warmDB) {
      const warmData = this.queryWarmDB(symbol, startTime, endTime, limit);
      results = [...warmData, ...results];
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp - b.timestamp);

    // Apply limit
    if (limit && results.length > limit) {
      results = results.slice(0, limit);
    }

    // Aggregate by interval if requested
    if (interval) {
      results = this.aggregateByInterval(results, interval);
    }

    return results;
  }

  /**
   * Archive old data to warm storage
   */
  private archiveToWarm(points: HistoricalDataPoint[]): void {
    if (!this.warmDB || points.length === 0) return;

    this.saveBatchToWarmDB(points);
  }

  /**
   * Save single point to warm DB
   */
  private saveToWarmDB(point: HistoricalDataPoint): void {
    if (!this.warmDB) return;

    try {
      const stmt = this.warmDB.prepare(`
        INSERT OR REPLACE INTO historical_data 
        (symbol, timestamp, open, high, low, close, volume, turnover, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        point.symbol,
        point.timestamp,
        point.open,
        point.high,
        point.low,
        point.close,
        point.volume,
        point.turnover || null,
        Date.now()
      );
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalDataWarehouse] Failed to save to warm DB:', err);
    }
  }

  /**
   * Save batch to warm DB
   */
  private saveBatchToWarmDB(points: HistoricalDataPoint[]): void {
    if (!this.warmDB || points.length === 0) return;

    try {
      const stmt = this.warmDB.prepare(`
        INSERT OR REPLACE INTO historical_data 
        (symbol, timestamp, open, high, low, close, volume, turnover, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = this.warmDB.transaction((batch: HistoricalDataPoint[]) => {
        for (const point of batch) {
          stmt.run(
            point.symbol,
            point.timestamp,
            point.open,
            point.high,
            point.low,
            point.close,
            point.volume,
            point.turnover || null,
            Date.now()
          );
        }
      });

      tx(points);
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalDataWarehouse] Failed to save batch to warm DB:', err);
    }
  }

  /**
   * Query warm DB
   */
  private queryWarmDB(symbol: string, startTime?: number, endTime?: number, limit?: number): HistoricalDataPoint[] {
    if (!this.warmDB) return [];

    try {
      let sql = `
        SELECT * FROM historical_data 
        WHERE symbol = ?
      `;
      const params: unknown[] = [symbol];

      if (startTime) {
        sql += ' AND timestamp >= ?';
        params.push(startTime);
      }

      if (endTime) {
        sql += ' AND timestamp <= ?';
        params.push(endTime);
      }

      sql += ' ORDER BY timestamp ASC';

      if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const stmt = this.warmDB.prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = stmt.all(...params) as any[];

      return rows.map(row => ({
        symbol: row.symbol,
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        turnover: row.turnover,
      }));
    } catch (err) {
    // [EngineError:DATA] — structured error tracking
      log.error('[HistoricalDataWarehouse] Failed to query warm DB:', err);
      return [];
    }
  }

  /**
   * Aggregate data by interval
   */
  private aggregateByInterval(points: HistoricalDataPoint[], interval: string): HistoricalDataPoint[] {
    if (points.length === 0) return [];

    const intervalMs = this.getIntervalMs(interval);
    const buckets = new Map<number, HistoricalDataPoint[]>();

    for (const point of points) {
      const bucketTime = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(point);
    }

    const aggregated: HistoricalDataPoint[] = [];
    for (const [timestamp, bucketPoints] of buckets) {
      const opens = bucketPoints.map(p => p.open);
      const highs = bucketPoints.map(p => p.high);
      const lows = bucketPoints.map(p => p.low);
      const closes = bucketPoints.map(p => p.close);
      const volumes = bucketPoints.map(p => p.volume);

      aggregated.push({
        symbol: bucketPoints[0].symbol,
        timestamp,
        open: opens[0],
        high: Math.max(...highs),
        low: Math.min(...lows),
        close: closes[closes.length - 1],
        volume: volumes.reduce((sum, v) => sum + v, 0),
      });
    }

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  private getIntervalMs(interval: string): number {
    const intervals: Record<string, number> = {
      '1min': 60 * 1000,
      '5min': 5 * 60 * 1000,
      '15min': 15 * 60 * 1000,
      '30min': 30 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '1day': 24 * 60 * 60 * 1000,
    };
    return intervals[interval] || 60 * 1000;
  }

  /**
   * Get statistics
   */
  getStats(): {
    hotDataPoints: number;
    warmDataPoints: number;
    symbols: number;
    oldestHotData: number | null;
    oldestWarmData: number | null;
  } {
    let hotDataPoints = 0;
    let oldestHotData: number | null = null;

    for (const cache of this.hotCache.values()) {
      hotDataPoints += cache.length;
      if (cache.length > 0) {
        const oldest = Math.min(...cache.map(p => p.timestamp));
        if (!oldestHotData || oldest < oldestHotData) {
          oldestHotData = oldest;
        }
      }
    }

    let warmDataPoints = 0;
    let oldestWarmData: number | null = null;

    if (this.warmDB) {
      try {
        const countStmt = this.warmDB.prepare('SELECT COUNT(*) as count FROM historical_data');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = countStmt.get() as any;
        warmDataPoints = result.count;

        const oldestStmt = this.warmDB.prepare('SELECT MIN(timestamp) as oldest FROM historical_data');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldestResult = oldestStmt.get() as any;
        oldestWarmData = oldestResult.oldest;
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[HistoricalDataWarehouse] Failed to get stats:', err);
      }
    }

    return {
      hotDataPoints,
      warmDataPoints,
      symbols: this.hotCache.size,
      oldestHotData,
      oldestWarmData,
    };
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const cutoff = now - this.config.coldDataRetention;

    // Cleanup warm DB
    if (this.warmDB) {
      try {
        const stmt = this.warmDB.prepare('DELETE FROM historical_data WHERE timestamp < ?');
        const result = stmt.run(cutoff);
        log.info(`[HistoricalDataWarehouse] Cleaned ${result.changes} old records from warm DB`);
      } catch (err) {
    // [EngineError:DATA] — structured error tracking
        log.error('[HistoricalDataWarehouse] Failed to cleanup warm DB:', err);
      }
    }

    // Cleanup archives
    await this.cleanupArchives(cutoff);
  }

  /**
   * Cleanup old archive files
   */
  private async cleanupArchives(cutoff: number): Promise<void> {
    if (!existsSync(this.config.archiveDir)) return;

    const files = readdirSync(this.config.archiveDir);
    let deleted = 0;

    for (const file of files) {
      const filePath = join(this.config.archiveDir, file);
      const stat = statSync(filePath);

      if (stat.mtimeMs < cutoff) {
        try {
          const fs = require('fs');
          fs.unlinkSync(filePath);
          deleted++;
        } catch (err) {
    // [EngineError:DATA] — structured error tracking
          log.error(`[HistoricalDataWarehouse] Failed to delete archive ${file}:`, err);
        }
      }
    }

    if (deleted > 0) {
      log.info(`[HistoricalDataWarehouse] Deleted ${deleted} old archive files`);
    }
  }

  /**
   * Close database connections
   */
  close(): void {
    if (this.warmDB) {
      this.warmDB.close();
      this.warmDB = null;
    }
    this.hotCache.clear();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let warehouseInstance: HistoricalDataWarehouse | null = null;

export function getHistoricalDataWarehouse(): HistoricalDataWarehouse {
  if (!warehouseInstance) {
    warehouseInstance = new HistoricalDataWarehouse();
  }
  return warehouseInstance;
}
