/**
 * JVS-49: Enhanced Data Versioning with Snapshots and Rollback
 * Test Suite - Comprehensive tests for data versioning functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataVersioningManager, benchmarkVersioning } from '../electron/engine/data-versioning-enhanced';
import { existsSync, unlinkSync } from 'node:fs';

describe('JVS-49: Enhanced Data Versioning', () => {
  let manager: DataVersioningManager | null = null;
  const testDbPath = 'test-versioning.db';

  beforeEach(() => {
    try {
      manager = new DataVersioningManager(testDbPath, {
        maxVersions: 10,
        autoSnapshot: false,
        snapshotInterval: 60000,
      });
    } catch (error) {
      console.error('Failed to create DataVersioningManager:', error);
      throw error;
    }
  });

  afterEach(() => {
    if (manager) {
      manager.close();
      manager = null;
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Version Creation', () => {
    it('should create a new version with data', () => {
      const data = { quotes: [{ code: 'AAPL', price: 150 }] };
      const version = manager.createVersion(data);

      expect(version.version).toBe(1);
      expect(version.timestamp).toBeGreaterThan(0);
      expect(version.dataHash).toHaveLength(64); // SHA-256 hash
      expect(version.dataSize).toBeGreaterThan(0);
    });

    it('should auto-increment version numbers', () => {
      const v1 = manager.createVersion({ v: 1 });
      const v2 = manager.createVersion({ v: 2 });
      const v3 = manager.createVersion({ v: 3 });

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it('should enforce max versions limit', () => {
      // Create 15 versions (max is 10)
      for (let i = 0; i < 15; i++) {
        manager.createVersion({ v: i });
      }

      const versions = manager.getAllVersions();
      expect(versions.length).toBe(10);
      expect(versions[0].version).toBe(15); // Latest
      expect(versions[9].version).toBe(6); // Oldest kept
    });
  });

  describe('Version Retrieval', () => {
    it('should retrieve a specific version', () => {
      const data = { quotes: [{ code: 'AAPL', price: 150 }] };
      manager.createVersion(data);

      const snapshot = manager.getVersion(1);
      expect(snapshot).not.toBeNull();
      expect(snapshot?.version).toBe(1);
      expect(snapshot?.data).toEqual(data);
    });

    it('should return null for non-existent version', () => {
      const snapshot = manager.getVersion(999);
      expect(snapshot).toBeNull();
    });

    it('should retrieve the latest version', () => {
      manager.createVersion({ v: 1 });
      manager.createVersion({ v: 2 });
      manager.createVersion({ v: 3 });

      const latest = manager.getLatestVersion();
      expect(latest?.version).toBe(3);
      expect(latest?.data).toEqual({ v: 3 });
    });

    it('should list all versions', () => {
      manager.createVersion({ v: 1 });
      manager.createVersion({ v: 2 });
      manager.createVersion({ v: 3 });

      const versions = manager.getAllVersions();
      expect(versions.length).toBe(3);
      expect(versions[0].version).toBe(3); // Latest first
      expect(versions[2].version).toBe(1);
    });
  });

  describe('Rollback', () => {
    it('should rollback to a specific version', () => {
      manager.createVersion({ v: 1, data: 'old' });
      manager.createVersion({ v: 2, data: 'new' });

      const result = manager.rollbackToVersion(1);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ v: 1, data: 'old' });

      // Verify new version was created
      const latest = manager.getLatestVersion();
      expect(latest?.version).toBe(3);
      expect(latest?.data).toEqual({ v: 1, data: 'old' });
    });

    it('should fail rollback for non-existent version', () => {
      const result = manager.rollbackToVersion(999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Version Diff', () => {
    it('should compute diff between two versions', () => {
      manager.createVersion({ a: 1, b: 2, c: 3 });
      manager.createVersion({ a: 1, b: 3, d: 4 });

      const diff = manager.computeDiff(1, 2);
      expect(diff).not.toBeNull();
      expect(diff?.changes.added).toHaveProperty('d');
      expect(diff?.changes.modified).toHaveProperty('b');
      expect(diff?.changes.removed).toContain('c');
    });

    it('should return null for non-existent versions', () => {
      const diff = manager.computeDiff(1, 2);
      expect(diff).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should compute versioning statistics', () => {
      manager.createVersion({ v: 1, data: 'a'.repeat(100) });
      manager.createVersion({ v: 2, data: 'b'.repeat(200) });
      manager.createVersion({ v: 3, data: 'c'.repeat(300) });

      const stats = manager.getStats();
      expect(stats.totalVersions).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestVersion).toBe(1);
      expect(stats.latestVersion).toBe(3);
      expect(stats.avgVersionSize).toBeGreaterThan(0);
    });
  });

  describe('Benchmark', () => {
    it('should benchmark versioning operations', () => {
      const benchmark = benchmarkVersioning(100);

      expect(benchmark.createVersionTime).toBeGreaterThan(0);
      expect(benchmark.getVersionTime).toBeGreaterThan(0);
      expect(benchmark.rollbackTime).toBeGreaterThan(0);
      expect(benchmark.diffTime).toBeGreaterThan(0);

      console.log('Benchmark Results:');
      console.log(`  createVersion: ${benchmark.createVersionTime.toFixed(3)}ms`);
      console.log(`  getVersion: ${benchmark.getVersionTime.toFixed(3)}ms`);
      console.log(`  rollback: ${benchmark.rollbackTime.toFixed(3)}ms`);
      console.log(`  diff: ${benchmark.diffTime.toFixed(3)}ms`);
    });
  });
});
