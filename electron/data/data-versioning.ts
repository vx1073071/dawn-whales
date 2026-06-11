// ── Data Versioning System ─────────────────────────────────────────────────
// JVS-59: data version - updateversion，

import { Database } from 'better-sqlite3';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';


export interface DataVersion {
  version_id: string;          // UUID
  table_name: string;
  version_number: number;      // version
  created_at: number;          // Unix timestamp (ms)
  data_hash: string;          // hash
  row_count: number;
  metadata?: Record<string, any>;
}

export interface VersionDiff {
  added: any[];
  updated: any[];
  deleted: any[];
  total_changes: number;
}

export interface RollbackResult {
  success: boolean;
  rolled_back_to: string;      // version_id
  rows_restored: number;
  timestamp: number;
}

export class DataVersioningSystem {
  private db: Database;
  private dataDir: string;

  constructor(db: Database, dataDir: string) {
    this.db = db;
    this.dataDir = dataDir;
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS data_versions (
        version_id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        data_hash TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        metadata TEXT,
        UNIQUE(table_name, version_number)
      );

      CREATE INDEX IF NOT EXISTS idx_versions_table 
      ON data_versions(table_name, created_at DESC);
    `);
  }

  /**
 * data version
   */
  createVersion(tableName: string, metadata?: Record<string, any>): string {
    const versionId = this.generateVersionId();
    const versionNumber = this.getNextVersionNumber(tableName);
    
 // current
    const rows = this.db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    
    if (rows.length === 0) {
      throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_UNAVAILABLE, `Table ${tableName} is empty or does not exist`);
    }

 // hash
    const dataHash = this.calculateHash(rows);

 // save
    const snapshotFile = join(this.dataDir, 'versions', `${tableName}_${versionId}.json`);
    mkdirSync(join(this.dataDir, 'versions'), { recursive: true });
    writeFileSync(snapshotFile, JSON.stringify(rows, null, 2));

 // versioninfo
    this.db.prepare(`
      INSERT INTO data_versions 
      (version_id, table_name, version_number, created_at, data_hash, row_count, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      versionId,
      tableName,
      versionNumber,
      Date.now(),
      dataHash,
      rows.length,
      metadata ? JSON.stringify(metadata) : null
    );

    return versionId;
  }

  /**
 * version
   */
  getVersions(tableName: string, limit: number = 50): DataVersion[] {
    const rows = this.db.prepare(`
      SELECT * FROM data_versions 
      WHERE table_name = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(tableName, limit) as any[];

    return rows.map(row => ({
      version_id: row.version_id,
      table_name: row.table_name,
      version_number: row.version_number,
      created_at: row.created_at,
      data_hash: row.data_hash,
      row_count: row.row_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
 * version
   */
  getVersion(versionId: string): DataVersion | null {
    const row = this.db.prepare(`
      SELECT * FROM data_versions WHERE version_id = ?
    `).get(versionId) as any;

    if (!row) return null;

    return {
      version_id: row.version_id,
      table_name: row.table_name,
      version_number: row.version_number,
      created_at: row.created_at,
      data_hash: row.data_hash,
      row_count: row.row_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
 * version
   */
  rollback(versionId: string): RollbackResult {
    const version = this.getVersion(versionId);
    if (!version) {
      return {
        success: false,
        rolled_back_to: versionId,
        rows_restored: 0,
        timestamp: Date.now(),
      };
    }

 // current version
    this.createVersion(version.table_name, { 
      rollback_reason: `Rollback to ${versionId}`,
      previous_version: versionId 
    });

 //
    const snapshotFile = join(this.dataDir, 'versions', `${version.table_name}_${versionId}.json`);
    if (!existsSync(snapshotFile)) {
      return {
        success: false,
        rolled_back_to: versionId,
        rows_restored: 0,
        timestamp: Date.now(),
      };
    }

    const data = JSON.parse(readFileSync(snapshotFile, 'utf-8'));

 // clearrestore
    this.db.prepare(`DELETE FROM ${version.table_name}`).run();

    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const insertSQL = `INSERT INTO ${version.table_name} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      const insertStmt = this.db.prepare(insertSQL);
      const insertMany = this.db.transaction((rows: any[]) => {
        for (const row of rows) {
          const values = columns.map(col => row[col]);
          insertStmt.run(...values);
        }
      });

      insertMany(data);
    }

    return {
      success: true,
      rolled_back_to: versionId,
      rows_restored: data.length,
      timestamp: Date.now(),
    };
  }

  /**
 * version
   */
  compareVersions(versionId1: string, versionId2: string): VersionDiff | null {
    const version1 = this.getVersion(versionId1);
    const version2 = this.getVersion(versionId2);

    if (!version1 || !version2) {
      return null;
    }

 // version
    const file1 = join(this.dataDir, 'versions', `${version1.table_name}_${versionId1}.json`);
    const file2 = join(this.dataDir, 'versions', `${version2.table_name}_${versionId2}.json`);

    if (!existsSync(file1) || !existsSync(file2)) {
      return null;
    }

    const data1 = JSON.parse(readFileSync(file1, 'utf-8'));
    const data2 = JSON.parse(readFileSync(file2, 'utf-8'));

 //
    const primaryKey = Object.keys(data1[0] || {})[0];
    if (!primaryKey) {
      return {
        added: [],
        updated: [],
        deleted: [],
        total_changes: 0,
      };
    }

    const map1 = new Map(data1.map(row => [row[primaryKey], row]));
    const map2 = new Map(data2.map(row => [row[primaryKey], row]));

    const added: any[] = [];
    const updated: any[] = [];
    const deleted: any[] = [];

 // add newupdate
    for (const [key, row] of map2.entries()) {
      const oldRow = map1.get(key);
      if (!oldRow) {
        added.push(row);
      } else if (JSON.stringify(oldRow) !== JSON.stringify(row)) {
        updated.push({ old: oldRow, new: row });
      }
    }

 // delete
    for (const key of map1.keys()) {
      if (!map2.has(key)) {
        deleted.push(map1.get(key));
      }
    }

    return {
      added,
      updated,
      deleted,
      total_changes: added.length + updated.length + deleted.length,
    };
  }

  /**
 * deleteversion（ N version）
   */
  cleanupOldVersions(tableName: string, keepCount: number = 10): number {
    const versions = this.getVersions(tableName);
    if (versions.length <= keepCount) {
      return 0;
    }

    const toDelete = versions.slice(keepCount);
    let deletedCount = 0;

    const deleteStmt = this.db.prepare(`
      DELETE FROM data_versions WHERE version_id = ?
    `);

    const deleteMany = this.db.transaction((versionIds: string[]) => {
      for (const versionId of versionIds) {
        deleteStmt.run(versionId);
 // delete
        const snapshotFile = join(this.dataDir, 'versions', `${tableName}_${versionId}.json`);
        if (existsSync(snapshotFile)) {
          try {
            const fs = require('fs');
            fs.unlinkSync(snapshotFile);
          } catch (err) {
 // deleteerror
          }
        }
        deletedCount++;
      }
    });

    deleteMany(toDelete.map(v => v.version_id));
    return deletedCount;
  }

  private getNextVersionNumber(tableName: string): number {
    const row = this.db.prepare(`
      SELECT MAX(version_number) as max_version 
      FROM data_versions 
      WHERE table_name = ?
    `).get(tableName) as any;

    return (row?.max_version || 0) + 1;
  }

  private generateVersionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `v_${timestamp}_${random}`;
  }

  private calculateHash(data: unknown[]): string {
    const dataStr = JSON.stringify(data);
    return createHash('sha256').update(dataStr).digest('hex');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let versioningSystemInstance: DataVersioningSystem | null = null;

export function getDataVersioningSystem(db: Database, dataDir: string): DataVersioningSystem {
  if (!versioningSystemInstance) {
    versioningSystemInstance = new DataVersioningSystem(db, dataDir);
  }
  return versioningSystemInstance;
}
