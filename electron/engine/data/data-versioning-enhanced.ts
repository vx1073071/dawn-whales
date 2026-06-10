// ── JVS-49: Enhanced Data Versioning with Snapshots and Rollback ────────────
// Production-ready data versioning with snapshot/rollback capabilities
// Features: version tracking, diff computation, rollback to any version
// Requirements: >=500 lines, >=5 tests, benchmark, design doc

import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DataVersion {
  version: number;
  timestamp: number;
  dataHash: string;
  dataSize: number;
  metadata?: Record<string, any>;
}

export interface DataSnapshot {
  version: number;
  timestamp: number;
  data: unknown;
  metadata?: Record<string, any>;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  changes: {
    added: Record<string, any>;
    modified: Record<string, { old: unknown; new: any }>;
    removed: string[];
  };
}

export interface VersioningConfig {
  maxVersions: number;        // Max versions to keep (default: 100)
  autoSnapshot: boolean;      // Auto-snapshot on changes
  snapshotInterval: number;   // Auto-snapshot interval (ms)
}

// ── Data Versioning Manager ────────────────────────────────────────────────

export class DataVersioningManager {
  private db: Database;
  private config: Required<VersioningConfig>;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private lastSnapshotTime: number = 0;

  constructor(
    dbPath: string,
    config?: Partial<VersioningConfig>
  ) {
    this.db = new Database(dbPath);
    this.config = {
      maxVersions: config?.maxVersions ?? 100,
      autoSnapshot: config?.autoSnapshot ?? true,
      snapshotInterval: config?.snapshotInterval ?? 60000,
    };
    this.initDB();
  }

  private initDB(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        timestamp INTEGER NOT NULL,
        data_hash TEXT NOT NULL,
        data_size INTEGER NOT NULL,
        metadata TEXT,
        data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_version ON data_versions(version);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON data_versions(timestamp);
    `);
  }

  // ── Version Management ───────────────────────────────────────────────────

  /**
   * Create a new version with current data
   */
  createVersion(data: unknown, metadata?: Record<string, any>): DataVersion {
    const version = this.getNextVersion();
    const timestamp = Date.now();
    const dataHash = this.computeHash(data);
    const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');

    const stmt = this.db.prepare(`
      INSERT INTO data_versions (version, timestamp, data_hash, data_size, metadata, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      version,
      timestamp,
      dataHash,
      dataSize,
      metadata ? JSON.stringify(metadata) : null,
      JSON.stringify(data)
    );

    // Enforce max versions
    this.enforceMaxVersions();

    return {
      version,
      timestamp,
      dataHash,
      dataSize,
      metadata,
    };
  }

  /**
   * Get a specific version
   */
  getVersion(version: number): DataSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT version, timestamp, data, metadata
      FROM data_versions
      WHERE version = ?
    `);

    const row = stmt.get(version) as any;
    if (!row) return null;

    return {
      version: row.version,
      timestamp: row.timestamp,
      data: JSON.parse(row.data),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Get the latest version
   */
  getLatestVersion(): DataSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT version, timestamp, data, metadata
      FROM data_versions
      ORDER BY version DESC
      LIMIT 1
    `);

    const row = stmt.get() as any;
    if (!row) return null;

    return {
      version: row.version,
      timestamp: row.timestamp,
      data: JSON.parse(row.data),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Get all versions
   */
  getAllVersions(): DataVersion[] {
    const stmt = this.db.prepare(`
      SELECT version, timestamp, data_hash, data_size, metadata
      FROM data_versions
      ORDER BY version DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      version: row.version,
      timestamp: row.timestamp,
      dataHash: row.data_hash,
      dataSize: row.data_size,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Rollback to a specific version
   */
  rollbackToVersion(version: number): { success: boolean; data?: unknown; error?: string } {
    const snapshot = this.getVersion(version);
    if (!snapshot) {
      return { success: false, error: `Version ${version} not found` };
    }

    // Create a new version with the rollback data
    this.createVersion(snapshot.data, {
      rollbackFrom: version,
      rolledBackAt: Date.now(),
    });

    return { success: true, data: snapshot.data };
  }

  /**
   * Compute diff between two versions
   */
  computeDiff(fromVersion: number, toVersion: number): VersionDiff | null {
    const fromSnapshot = this.getVersion(fromVersion);
    const toSnapshot = this.getVersion(toVersion);

    if (!fromSnapshot || !toSnapshot) {
      return null;
    }

    const fromData = fromSnapshot.data;
    const toData = toSnapshot.data;

    const diff: VersionDiff['changes'] = {
      added: {},
      modified: {},
      removed: [],
    };

    // Find added and modified keys
    for (const key of Object.keys(toData)) {
      if (!(key in fromData)) {
        diff.added[key] = toData[key];
      } else if (JSON.stringify(fromData[key]) !== JSON.stringify(toData[key])) {
        diff.modified[key] = {
          old: fromData[key],
          new: toData[key],
        };
      }
    }

    // Find removed keys
    for (const key of Object.keys(fromData)) {
      if (!(key in toData)) {
        diff.removed.push(key);
      }
    }

    return {
      fromVersion,
      toVersion,
      changes: diff,
    };
  }

  /**
   * Delete a specific version
   */
  deleteVersion(version: number): boolean {
    const stmt = this.db.prepare('DELETE FROM data_versions WHERE version = ?');
    const result = stmt.run(version);
    return result.changes > 0;
  }

  /**
   * Clear all versions
   */
  clearAllVersions(): number {
    const stmt = this.db.prepare('DELETE FROM data_versions');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalVersions: number;
    totalSize: number;
    oldestVersion: number | null;
    latestVersion: number | null;
    avgVersionSize: number;
  } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(data_size) as total_size,
        MIN(version) as oldest,
        MAX(version) as latest,
        AVG(data_size) as avg_size
      FROM data_versions
    `);

    const row = stmt.get() as any;
    return {
      totalVersions: row.count,
      totalSize: row.total_size || 0,
      oldestVersion: row.oldest,
      latestVersion: row.latest,
      avgVersionSize: row.avg_size || 0,
    };
  }

  // ── Helper Methods ───────────────────────────────────────────────────────

  private getNextVersion(): number {
    const stmt = this.db.prepare('SELECT MAX(version) as max_version FROM data_versions');
    const row = stmt.get() as any;
    return (row.max_version || 0) + 1;
  }

  private enforceMaxVersions(): void {
    const stmt = this.db.prepare(`
      DELETE FROM data_versions
      WHERE version NOT IN (
        SELECT version FROM data_versions
        ORDER BY version DESC
        LIMIT ?
      )
    `);
    stmt.run(this.config.maxVersions);
  }

  private computeHash(data: unknown): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Get all data (for persistence)
   */
  getAllData(): any {
    const latest = this.getLatestVersion();
    return latest ? latest.data : null;
  }

  /**
   * Set data with versioning
   */
  setData(data: unknown, metadata?: Record<string, any>): DataVersion {
    return this.createVersion(data, metadata);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }
    this.db.close();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let versioningManager: DataVersioningManager | null = null;

export function getDataVersioningManager(): DataVersioningManager {
  if (!versioningManager) {
    const dbPath = join(process.cwd(), 'data', 'data-versioning.db');
    versioningManager = new DataVersioningManager(dbPath);
  }
  return versioningManager;
}

// ── Benchmark ──────────────────────────────────────────────────────────────

export function benchmarkVersioning(iterations: number = 1000): {
  createVersionTime: number;
  getVersionTime: number;
  rollbackTime: number;
  diffTime: number;
} {
  const manager = getDataVersioningManager();

  // Create test data
  const testData = {
    quotes: Array.from({ length: 100 }, (_, i) => ({
      code: `STOCK${i}`,
      price: 100 + Math.random() * 100,
      volume: Math.floor(Math.random() * 1000000),
    })),
  };

  // Benchmark createVersion
  const createStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    manager.createVersion({ ...testData, iteration: i });
  }
  const createVersionTime = (Date.now() - createStart) / iterations;

  // Benchmark getVersion
  const versions = manager.getAllVersions();
  const getVersionStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    manager.getVersion(versions[i % versions.length].version);
  }
  const getVersionTime = (Date.now() - getVersionStart) / iterations;

  // Benchmark rollback
  const rollbackStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    manager.rollbackToVersion(versions[i % versions.length].version);
  }
  const rollbackTime = (Date.now() - rollbackStart) / iterations;

  // Benchmark diff
  const diffStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    manager.computeDiff(
      versions[i % versions.length].version,
      versions[(i + 1) % versions.length].version
    );
  }
  const diffTime = (Date.now() - diffStart) / iterations;

  return {
    createVersionTime,
    getVersionTime,
    rollbackTime,
    diffTime,
  };
}
