// ── Data Snapshot Service (JVS-39) ────────────────────────────────────────
// Capture and store data snapshots for historical analysis and comparison
// Provides timeline view of market conditions and strategy performance

import type { 
  Strategy, 
  BacktestResult, 
  RiskMetrics 
} from '../../types';
import log from 'electron-log';
import { EngineError } from '../core/engine-error';


export interface DataSnapshot {
  id: string;
  timestamp: number;
  type: 'market' | 'strategy' | 'portfolio' | 'custom';
  category: string;
  data: unknown;
  metadata: SnapshotMetadata;
}

export interface SnapshotMetadata {
  source: string;
  parameters?: Record<string, any>;
  tags?: string[];
  description?: string;
  relatedSnapshots?: string[];
}

export interface SnapshotQuery {
  type?: string;
  category?: string;
  startTime?: number;
  endTime?: number;
  tags?: string[];
  limit?: number;
}

export interface SnapshotComparison {
  snapshot1: DataSnapshot;
  snapshot2: DataSnapshot;
  differences: Record<string, any>;
  timeDelta: number;
}

export class DataSnapshotService {
  private snapshots: Map<string, DataSnapshot> = new Map();
  private maxSnapshots = 10000;

  /**
   * Capture a new data snapshot
   */
  async captureSnapshot(
    type: string,
    category: string,
    data: unknown,
    metadata?: Partial<SnapshotMetadata>
  ): Promise<DataSnapshot> {
    const snapshot: DataSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: type as any,
      category,
      data,
      metadata: {
        source: metadata?.source || 'manual',
        parameters: metadata?.parameters || {},
        tags: metadata?.tags || [],
        description: metadata?.description || '',
        relatedSnapshots: metadata?.relatedSnapshots || [],
      },
    };

    this.snapshots.set(snapshot.id, snapshot);
    
    // Maintain max size
    if (this.snapshots.size > this.maxSnapshots) {
      const oldest = Array.from(this.snapshots.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.snapshots.delete(oldest[0]);
    }

    return snapshot;
  }

  /**
   * Query snapshots with filters
   */
  async querySnapshots(query: SnapshotQuery): Promise<DataSnapshot[]> {
    let results = Array.from(this.snapshots.values());

    // Filter by type
    if (query.type) {
      results = results.filter(s => s.type === query.type);
    }

    // Filter by category
    if (query.category) {
      results = results.filter(s => s.category === query.category);
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter(s => s.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(s => s.timestamp <= query.endTime!);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => 
        s.metadata.tags?.some(tag => query.tags!.includes(tag))
      );
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(id: string): Promise<DataSnapshot | null> {
    return this.snapshots.get(id) || null;
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(id1: string, id2: string): Promise<SnapshotComparison | null> {
    const snapshot1 = this.snapshots.get(id1);
    const snapshot2 = this.snapshots.get(id2);

    if (!snapshot1 || !snapshot2) {
      return null;
    }

    const differences = this.calculateDifferences(snapshot1.data, snapshot2.data);
    const timeDelta = Math.abs(snapshot2.timestamp - snapshot1.timestamp);

    return {
      snapshot1,
      snapshot2,
      differences,
      timeDelta,
    };
  }

  /**
   * Get timeline of snapshots for a category
   */
  async getTimeline(category: string, limit = 50): Promise<DataSnapshot[]> {
    return this.querySnapshots({ category, limit });
  }

  /**
   * Get latest snapshot for a category
   */
  async getLatestSnapshot(category: string): Promise<DataSnapshot | null> {
    const results = await this.querySnapshots({ category, limit: 1 });
    return results[0] || null;
  }

  /**
   * Delete old snapshots (older than specified days)
   */
  async cleanupOldSnapshots(daysOld: number = 30): Promise<number> {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deleted = 0;

    for (const [id, snapshot] of this.snapshots.entries()) {
      if (snapshot.timestamp < cutoff) {
        this.snapshots.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Export snapshots to JSON
   */
  async exportSnapshots(query?: SnapshotQuery): Promise<string> {
    const snapshots = query 
      ? await this.querySnapshots(query)
      : Array.from(this.snapshots.values());

    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalSnapshots: snapshots.length,
      snapshots,
    }, null, 2);
  }

  /**
   * Import snapshots from JSON
   */
  async importSnapshots(jsonString: string): Promise<number> {
    try {
      const data = JSON.parse(jsonString);
      let imported = 0;

      for (const snapshot of data.snapshots) {
        this.snapshots.set(snapshot.id, snapshot);
        imported++;
      }

      return imported;
    } catch (error) {
      log.error('Failed to import snapshots:', error);
      return 0;
    }
  }

  /**
   * Get statistics about stored snapshots
   */
  getStats(): {
    totalSnapshots: number;
    oldestSnapshot: number | null;
    newestSnapshot: number | null;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const snapshots = Array.from(this.snapshots.values());
    
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const snapshot of snapshots) {
      byType[snapshot.type] = (byType[snapshot.type] || 0) + 1;
      byCategory[snapshot.category] = (byCategory[snapshot.category] || 0) + 1;
    }

    const timestamps = snapshots.map(s => s.timestamp);
    const oldestSnapshot = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestSnapshot = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot,
      newestSnapshot,
      byType,
      byCategory,
    };
  }

  /**
   * Delete snapshot by ID
   */
  async deleteSnapshot(id: string): Promise<boolean> {
    return this.snapshots.delete(id);
  }

  /**
   * Clear all snapshots
   */
  async clearAll(): Promise<void> {
    this.snapshots.clear();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private generateId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateDifferences(data1: unknown, data2: unknown): Record<string, any> {
    const diffs: Record<string, any> = {};

    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);

    for (const key of allKeys) {
      const val1 = data1[key];
      const val2 = data2[key];

      if (typeof val1 === 'number' && typeof val2 === 'number') {
        diffs[key] = {
          value1: val1,
          value2: val2,
          diff: val2 - val1,
          percentChange: val1 !== 0 ? ((val2 - val1) / val1 * 100) : 0,
        };
      } else if (typeof val1 === 'object' && typeof val2 === 'object') {
        diffs[key] = this.calculateDifferences(val1, val2);
      } else {
        diffs[key] = {
          value1: val1,
          value2: val2,
          changed: val1 !== val2,
        };
      }
    }

    return diffs;
  }
}

// ── Singleton instance ─────────────────────────────────────────────────────

let snapshotService: DataSnapshotService | null = null;

export function getSnapshotService(): DataSnapshotService {
  if (!snapshotService) {
    snapshotService = new DataSnapshotService();
  }
  return snapshotService;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

export async function captureSnapshot(
  type: string,
  category: string,
  data: unknown,
  metadata?: Partial<SnapshotMetadata>
): Promise<DataSnapshot> {
  const service = getSnapshotService();
  return service.captureSnapshot(type, category, data, metadata);
}

export async function querySnapshots(query: SnapshotQuery): Promise<DataSnapshot[]> {
  const service = getSnapshotService();
  return service.querySnapshots(query);
}

export async function getSnapshot(id: string): Promise<DataSnapshot | null> {
  const service = getSnapshotService();
  return service.getSnapshot(id);
}

export async function compareSnapshots(id1: string, id2: string): Promise<SnapshotComparison | null> {
  const service = getSnapshotService();
  return service.compareSnapshots(id1, id2);
}

export async function getSnapshotTimeline(category: string, limit?: number): Promise<DataSnapshot[]> {
  const service = getSnapshotService();
  return service.getTimeline(category, limit);
}

export async function getLatestSnapshot(category: string): Promise<DataSnapshot | null> {
  const service = getSnapshotService();
  return service.getLatestSnapshot(category);
}

export async function cleanupOldSnapshots(daysOld?: number): Promise<number> {
  const service = getSnapshotService();
  return service.cleanupOldSnapshots(daysOld);
}

export async function exportSnapshots(query?: SnapshotQuery): Promise<string> {
  const service = getSnapshotService();
  return service.exportSnapshots(query);
}

export async function importSnapshots(jsonString: string): Promise<number> {
  const service = getSnapshotService();
  return service.importSnapshots(jsonString);
}

export function getSnapshotStats() {
  const service = getSnapshotService();
  return service.getStats();
}

export async function deleteSnapshot(id: string): Promise<boolean> {
  const service = getSnapshotService();
  return service.deleteSnapshot(id);
}

export async function clearAllSnapshots(): Promise<void> {
  const service = getSnapshotService();
  return service.clearAll();
}
