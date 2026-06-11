// ── Data Version Control Service (JVS-40) ──────────────────────────────────
// Track and manage data changes with version history, diff, and rollback
// Supports: version tracking, change detection, rollback, audit trail

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSnapshotService, type DataSnapshot } from '../analysis/snapshot-service';
import log from 'electron-log';
import { EngineError } from './engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface DataVersion {
  versionId: string;
  entityId: string;
  entityType: string;
  version: number;
  data: unknown;
  previousVersion: number | null;
  changeType: 'create' | 'update' | 'delete';
  changeSummary: string;
  timestamp: number;
  userId?: string;
  tags?: string[];
}

export interface VersionDiff {
  versionId: string;
  previousVersionId: string | null;
  added: Record<string, any>;
  modified: Record<string, { old: unknown; new: any }>;
  removed: string[];
}

export interface VersionQuery {
  entityId?: string;
  entityType?: string;
  startTime?: number;
  endTime?: number;
  minVersion?: number;
  maxVersion?: number;
  limit?: number;
}

export interface RollbackResult {
  success: boolean;
  entityId: string;
  fromVersion: number;
  toVersion: number;
  changesReverted: number;
  newVersionId: string;
}

export interface VersionStats {
  totalVersions: number;
  byEntityType: Record<string, number>;
  byChangeType: Record<string, number>;
  averageVersionsPerEntity: number;
  oldestVersion: number | null;
  newestVersion: number | null;
}

// ── Version Control Service ────────────────────────────────────────────────

export class DataVersionControlService {
  private versions: Map<string, DataVersion> = new Map();
  private entityVersions: Map<string, string[]> = new Map(); // entityId -> versionIds[]
  private maxVersionsPerEntity = 100;

  /**
   * Track a new version of an entity
   */
  async trackVersion(
    entityId: string,
    entityType: string,
    data: unknown,
    changeType: 'create' | 'update' | 'delete' = 'update',
    changeSummary?: string,
    userId?: string,
    tags?: string[]
  ): Promise<DataVersion> {
    // Get current versions for this entity
    if (!this.entityVersions.has(entityId)) {
      this.entityVersions.set(entityId, []);
    }
    const entityVersionIds = this.entityVersions.get(entityId)!;
    
    // Determine version number
    const previousVersion = entityVersionIds.length > 0 
      ? this.versions.get(entityVersionIds[entityVersionIds.length - 1])
      : null;
    const version = previousVersion ? previousVersion.version + 1 : 1;

    // Create version record
    const versionId = this.generateVersionId(entityId, version);
    const versionRecord: DataVersion = {
      versionId,
      entityId,
      entityType,
      version,
      data,
      previousVersion: previousVersion ? previousVersion.version : null,
      changeType,
      changeSummary: changeSummary || `${changeType} at ${new Date().toISOString()}`,
      timestamp: Date.now(),
      userId,
      tags: tags || [],
    };

    // Store version
    this.versions.set(versionId, versionRecord);
    entityVersionIds.push(versionId);

    // Maintain max versions per entity
    if (entityVersionIds.length > this.maxVersionsPerEntity) {
      const oldest = entityVersionIds.shift()!;
      this.versions.delete(oldest);
    }

    return versionRecord;
  }

  /**
   * Get all versions for an entity
   */
  async getEntityVersions(entityId: string, limit?: number): Promise<DataVersion[]> {
    const versionIds = this.entityVersions.get(entityId) || [];
    const versions = versionIds
      .map(id => this.versions.get(id))
      .filter((v): v is DataVersion => v !== undefined)
      .sort((a, b) => b.version - a.version);

    return limit ? versions.slice(0, limit) : versions;
  }

  /**
   * Get specific version
   */
  async getVersion(versionId: string): Promise<DataVersion | null> {
    return this.versions.get(versionId) || null;
  }

  /**
   * Get latest version for an entity
   */
  async getLatestVersion(entityId: string): Promise<DataVersion | null> {
    const versions = await this.getEntityVersions(entityId, 1);
    return versions[0] || null;
  }

  /**
   * Compare two versions
   */
  async diffVersions(versionId1: string, versionId2: string): Promise<VersionDiff | null> {
    const v1 = this.versions.get(versionId1);
    const v2 = this.versions.get(versionId2);

    if (!v1 || !v2) return null;

    const diff = this.calculateDiff(v1.data, v2.data);

    return {
      versionId: versionId2,
      previousVersionId: versionId1,
      ...diff,
    };
  }

  /**
   * Rollback to a specific version
   */
  async rollback(entityId: string, targetVersion: number): Promise<RollbackResult> {
    const versions = await this.getEntityVersions(entityId);
    const targetVersionRecord = versions.find(v => v.version === targetVersion);

    if (!targetVersionRecord) {
      return {
        success: false,
        entityId,
        fromVersion: 0,
        toVersion: targetVersion,
        changesReverted: 0,
        newVersionId: '',
      };
    }

    // Get current version
    const currentVersion = await this.getLatestVersion(entityId);
    const fromVersion = currentVersion ? currentVersion.version : 0;

    // Create new version with rolled-back data
    const newVersion = await this.trackVersion(
      entityId,
      targetVersionRecord.entityType,
      targetVersionRecord.data,
      'update',
      `Rollback from v${fromVersion} to v${targetVersion}`,
      undefined,
      ['rollback']
    );

    const changesReverted = Math.abs(fromVersion - targetVersion);

    return {
      success: true,
      entityId,
      fromVersion,
      toVersion: targetVersion,
      changesReverted,
      newVersionId: newVersion.versionId,
    };
  }

  /**
   * Query versions with filters
   */
  async queryVersions(query: VersionQuery): Promise<DataVersion[]> {
    let results = Array.from(this.versions.values());

    if (query.entityId) {
      results = results.filter(v => v.entityId === query.entityId);
    }

    if (query.entityType) {
      results = results.filter(v => v.entityType === query.entityType);
    }

    if (query.startTime) {
      results = results.filter(v => v.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter(v => v.timestamp <= query.endTime!);
    }

    if (query.minVersion !== undefined) {
      results = results.filter(v => v.version >= query.minVersion!);
    }

    if (query.maxVersion !== undefined) {
      results = results.filter(v => v.version <= query.maxVersion!);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    return query.limit ? results.slice(0, query.limit) : results;
  }

  /**
   * Get version statistics
   */
  getStats(): VersionStats {
    const versions = Array.from(this.versions.values());
    
    const byEntityType: Record<string, number> = {};
    const byChangeType: Record<string, number> = {};

    for (const v of versions) {
      byEntityType[v.entityType] = (byEntityType[v.entityType] || 0) + 1;
      byChangeType[v.changeType] = (byChangeType[v.changeType] || 0) + 1;
    }

    const timestamps = versions.map(v => v.timestamp);
    const oldestVersion = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestVersion = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalVersions: versions.length,
      byEntityType,
      byChangeType,
      averageVersionsPerEntity: this.entityVersions.size > 0 
        ? versions.length / this.entityVersions.size 
        : 0,
      oldestVersion,
      newestVersion,
    };
  }

  /**
   * Delete version by ID
   */
  async deleteVersion(versionId: string): Promise<boolean> {
    const version = this.versions.get(versionId);
    if (!version) return false;

    const entityVersionIds = this.entityVersions.get(version.entityId);
    if (entityVersionIds) {
      const index = entityVersionIds.indexOf(versionId);
      if (index !== -1) {
        entityVersionIds.splice(index, 1);
      }
      if (entityVersionIds.length === 0) {
        this.entityVersions.delete(version.entityId);
      }
    }

    this.versions.delete(versionId);
    return true;
  }

  /**
   * Clear all versions
   */
  async clearAll(): Promise<void> {
    this.versions.clear();
    this.entityVersions.clear();
  }

  /**
   * Export versions to JSON
   */
  async exportVersions(query?: VersionQuery): Promise<string> {
    const versions = query 
      ? await this.queryVersions(query)
      : Array.from(this.versions.values());

    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalVersions: versions.length,
      versions,
    }, null, 2);
  }

  /**
   * Import versions from JSON
   */
  async importVersions(jsonString: string): Promise<number> {
    try {
      const data = JSON.parse(jsonString);
      let imported = 0;

      for (const version of data.versions) {
        this.versions.set(version.versionId, version);
        
        if (!this.entityVersions.has(version.entityId)) {
          this.entityVersions.set(version.entityId, []);
        }
        this.entityVersions.get(version.entityId)!.push(version.versionId);
        
        imported++;
      }

      return imported;
    } catch (error) {
      log.error('Failed to import versions:', error);
      return 0;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private generateVersionId(entityId: string, version: number): string {
    return `v_${entityId}_${version}_${Date.now()}`;
  }

  private calculateDiff(data1: unknown, data2: unknown): {
    added: Record<string, any>;
    modified: Record<string, { old: unknown; new: any }>;
    removed: string[];
  } {
    const added: Record<string, any> = {};
    const modified: Record<string, { old: unknown; new: any }> = {};
    const removed: string[] = [];

    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);

    for (const key of allKeys) {
      const val1 = data1[key];
      const val2 = data2[key];

      if (val1 === undefined && val2 !== undefined) {
        added[key] = val2;
      } else if (val1 !== undefined && val2 === undefined) {
        removed.push(key);
      } else if (val1 !== val2) {
        modified[key] = { old: val1, new: val2 };
      }
    }

    return { added, modified, removed };
  }
}

// ── Singleton instance ─────────────────────────────────────────────────────

let versionControlService: DataVersionControlService | null = null;

export function getVersionControlService(): DataVersionControlService {
  if (!versionControlService) {
    versionControlService = new DataVersionControlService();
  }
  return versionControlService;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

export async function trackVersion(
  entityId: string,
  entityType: string,
  data: unknown,
  changeType?: 'create' | 'update' | 'delete',
  changeSummary?: string,
  userId?: string,
  tags?: string[]
): Promise<DataVersion> {
  const service = getVersionControlService();
  return service.trackVersion(entityId, entityType, data, changeType, changeSummary, userId, tags);
}

export async function getEntityVersions(entityId: string, limit?: number): Promise<DataVersion[]> {
  const service = getVersionControlService();
  return service.getEntityVersions(entityId, limit);
}

export async function getVersion(versionId: string): Promise<DataVersion | null> {
  const service = getVersionControlService();
  return service.getVersion(versionId);
}

export async function getLatestVersion(entityId: string): Promise<DataVersion | null> {
  const service = getVersionControlService();
  return service.getLatestVersion(entityId);
}

export async function diffVersions(versionId1: string, versionId2: string): Promise<VersionDiff | null> {
  const service = getVersionControlService();
  return service.diffVersions(versionId1, versionId2);
}

export async function rollback(entityId: string, targetVersion: number): Promise<RollbackResult> {
  const service = getVersionControlService();
  return service.rollback(entityId, targetVersion);
}

export async function queryVersions(query: VersionQuery): Promise<DataVersion[]> {
  const service = getVersionControlService();
  return service.queryVersions(query);
}

export function getVersionStats() {
  const service = getVersionControlService();
  return service.getStats();
}

export async function deleteVersion(versionId: string): Promise<boolean> {
  const service = getVersionControlService();
  return service.deleteVersion(versionId);
}

export async function clearAllVersions(): Promise<void> {
  const service = getVersionControlService();
  return service.clearAll();
}

export async function exportVersions(query?: VersionQuery): Promise<string> {
  const service = getVersionControlService();
  return service.exportVersions(query);
}

export async function importVersions(jsonString: string): Promise<number> {
  const service = getVersionControlService();
  return service.importVersions(jsonString);
}
