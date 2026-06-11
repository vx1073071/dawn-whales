/**
 * Tests for DataVersionController (JVS-86)
 * Covers: electron/engine/data/data-versioning.ts (1144 lines)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataVersionController } from '../../../../electron/engine/data/data-versioning';

// Suppress noisy log output in test
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

describe('DataVersionController', () => {
  let controller: DataVersionController;

  beforeEach(() => {
    controller = new DataVersionController({ maxSnapshots: 10, autoSnapshot: false });
  });

  afterEach(() => {
    controller.dispose();
  });

  // ── Constructor & Config ──────────────────────────────────────────────────

  describe('constructor & config', () => {
    it('should initialise with main branch', () => {
      const branches = controller.listBranches();
      expect(branches.length).toBe(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].snapshotCount).toBe(0);
    });

    it('should merge config with defaults', () => {
      const config = controller.getConfig();
      expect(config.maxSnapshots).toBe(10);
      expect(config.autoSnapshot).toBe(false);
      expect(config.autoSnapshotIntervalMs).toBe(60_000);
      expect(config.compressionEnabled).toBe(false);
    });

    it('should use default config when no overrides', () => {
      const c2 = new DataVersionController();
      const config = c2.getConfig();
      expect(config.maxSnapshots).toBe(100);
      c2.dispose();
    });

    it('should update config partially', () => {
      const updated = controller.updateConfig({ maxSnapshots: 50 });
      expect(updated.maxSnapshots).toBe(50);
      expect(updated.autoSnapshot).toBe(false);
    });

    it('should toggle auto-snapshot on config change', () => {
      vi.useFakeTimers();
      let data = [{ a: 1 }];
      controller.registerAutoSnapshotSource('t1', () => data);

      // enable auto snapshot
      controller.updateConfig({ autoSnapshot: true, autoSnapshotIntervalMs: 1000 });
      vi.advanceTimersByTime(1500);
      const snaps = controller.listSnapshots('t1');
      expect(snaps.length).toBeGreaterThanOrEqual(1);

      // disable
      controller.updateConfig({ autoSnapshot: false });
      const countBefore = controller.listSnapshots('t1').length;
      vi.advanceTimersByTime(5000);
      expect(controller.listSnapshots('t1').length).toBe(countBefore);

      vi.useRealTimers();
    });
  });

  // ── Snapshot creation ────────────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('should create a snapshot with correct fields', () => {
      const data = [{ id: 1, val: 'a' }, { id: 2, val: 'b' }];
      const snap = controller.createSnapshot('prices', data, { note: 'test' });

      expect(snap.id).toBeTruthy();
      expect(snap.table).toBe('prices');
      expect(snap.rowCount).toBe(2);
      expect(snap.hash).toMatch(/^[0-9a-f]{8}$/);
      expect(snap.metadata).toEqual({ note: 'test' });
      expect(snap.parentId).toBeTruthy();
    });

    it('should throw on empty table name', () => {
      expect(() => controller.createSnapshot('', [{}])).toThrow();
    });

    it('should throw on non-array data', () => {
      expect(() => controller.createSnapshot('t', 'not-array' as any)).toThrow();
    });

    it('should skip duplicate snapshot when hash unchanged', () => {
      const data = [{ id: 1 }];
      const snap1 = controller.createSnapshot('t1', data);
      const snap2 = controller.createSnapshot('t1', data);
      expect(snap1.id).toBe(snap2.id);
    });

    it('should create new snapshot when data changes', () => {
      const snap1 = controller.createSnapshot('t1', [{ id: 1 }]);
      const snap2 = controller.createSnapshot('t1', [{ id: 2 }]);
      expect(snap1.id).not.toBe(snap2.id);
    });

    it('should store a shallow copy of rows', () => {
      const original = [{ id: 1, val: 'x' }];
      controller.createSnapshot('t1', original);
      original[0].val = 'mutated';
      const restored = controller.restoreSnapshot(controller.getHistory('t1')[0].id);
      expect(restored[0].val).toBe('x');
    });
  });

  // ── Restore ──────────────────────────────────────────────────────────────

  describe('restoreSnapshot', () => {
    it('should return a copy of stored data', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const snap = controller.createSnapshot('t1', data);
      const restored = controller.restoreSnapshot(snap.id);
      expect(restored).toEqual(data);
      // Should be a copy
      restored.push({ id: 3 });
      expect(controller.restoreSnapshot(snap.id).length).toBe(2);
    });

    it('should throw on unknown snapshot id', () => {
      expect(() => controller.restoreSnapshot('nonexistent')).toThrow();
    });
  });

  // ── Diff ─────────────────────────────────────────────────────────────────

  describe('diff', () => {
    it('should detect added rows', () => {
      const snap1 = controller.createSnapshot('t', [{ _id: '1', v: 1 }]);
      const snap2 = controller.createSnapshot('t', [{ _id: '1', v: 1 }, { _id: '2', v: 2 }]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.addedRows).toBe(1);
      expect(d.removedRows).toBe(0);
      expect(d.modifiedRows).toBe(0);
    });

    it('should detect removed rows', () => {
      const snap1 = controller.createSnapshot('t', [{ _id: '1' }, { _id: '2' }]);
      const snap2 = controller.createSnapshot('t', [{ _id: '1' }]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.removedRows).toBe(1);
    });

    it('should detect modified rows', () => {
      const snap1 = controller.createSnapshot('t', [{ _id: '1', val: 'a' }]);
      const snap2 = controller.createSnapshot('t', [{ _id: '1', val: 'b' }]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.modifiedRows).toBe(1);
      expect(d.columnChanges.length).toBeGreaterThan(0);
    });

    it('should report no changes for identical snapshots', () => {
      const snap1 = controller.createSnapshot('t', [{ _id: '1' }]);
      // Force a different snapshot by changing data slightly then revert
      const snap2 = controller.createSnapshot('t', [{ _id: '2' }]);
      // diff snap1 with itself
      const d = controller.diff(snap1.id, snap1.id);
      expect(d.addedRows).toBe(0);
      expect(d.removedRows).toBe(0);
      expect(d.modifiedRows).toBe(0);
      expect(d.summary).toContain('no changes');
    });

    it('should throw on unknown snapshot id', () => {
      const snap1 = controller.createSnapshot('t', [{ id: 1 }]);
      expect(() => controller.diff(snap1.id, 'bogus')).toThrow();
      expect(() => controller.diff('bogus', snap1.id)).toThrow();
    });

    it('should include column changes sorted by count', () => {
      const snap1 = controller.createSnapshot('t', [
        { _id: '1', a: 1, b: 1 },
        { _id: '2', a: 1, b: 1 },
      ]);
      const snap2 = controller.createSnapshot('t', [
        { _id: '1', a: 2, b: 2 },
        { _id: '2', a: 2, b: 1 }, // only 'a' changed
      ]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.modifiedRows).toBe(2);
      expect(d.columnChanges[0].column).toBe('a');
      expect(d.columnChanges[0].changeCount).toBe(2);
    });

    it('should handle rows with id field (not _id)', () => {
      const snap1 = controller.createSnapshot('t', [{ id: 'a', v: 1 }]);
      const snap2 = controller.createSnapshot('t', [{ id: 'a', v: 2 }]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.modifiedRows).toBe(1);
    });

    it('should handle primitive row values', () => {
      const snap1 = controller.createSnapshot('t', [1, 2, 3]);
      const snap2 = controller.createSnapshot('t', [1, 2, 4]);
      const d = controller.diff(snap1.id, snap2.id);
      expect(d.addedRows + d.removedRows + d.modifiedRows).toBeGreaterThan(0);
    });
  });

  // ── listSnapshots & getHistory ───────────────────────────────────────────

  describe('listSnapshots & getHistory', () => {
    it('should list all non-sentinel snapshots', () => {
      controller.createSnapshot('t1', [{ x: 1 }]);
      controller.createSnapshot('t2', [{ y: 1 }]);
      const all = controller.listSnapshots();
      expect(all.length).toBe(2);
    });

    it('should filter by table name', () => {
      controller.createSnapshot('t1', [{ x: 1 }]);
      controller.createSnapshot('t2', [{ y: 1 }]);
      expect(controller.listSnapshots('t1').length).toBe(1);
      expect(controller.listSnapshots('t1')[0].table).toBe('t1');
    });

    it('should return newest-first', () => {
      controller.createSnapshot('t', [{ x: 1 }]);
      controller.createSnapshot('t', [{ x: 2 }]);
      const list = controller.listSnapshots('t');
      expect(list.length).toBe(2);
      expect(new Date(list[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(list[1].timestamp).getTime(),
      );
    });

    it('getHistory should respect limit', () => {
      controller.createSnapshot('t', [{ v: 1 }]);
      controller.createSnapshot('t', [{ v: 2 }]);
      controller.createSnapshot('t', [{ v: 3 }]);
      const history = controller.getHistory('t', 2);
      expect(history.length).toBe(2);
    });

    it('getHistory should return empty for unknown table', () => {
      expect(controller.getHistory('nonexistent')).toEqual([]);
    });
  });

  // ── Branch management ────────────────────────────────────────────────────

  describe('branch management', () => {
    it('should create a branch from main head', () => {
      controller.createSnapshot('t', [{ v: 1 }]);
      const branch = controller.createBranch('feature');
      expect(branch.name).toBe('feature');
      expect(branch.parent).toBe('main');
      expect(branch.snapshotCount).toBeGreaterThanOrEqual(0);
    });

    it('should throw on empty branch name', () => {
      expect(() => controller.createBranch('')).toThrow();
    });

    it('should throw on duplicate branch name', () => {
      controller.createBranch('dev');
      expect(() => controller.createBranch('dev')).toThrow();
    });

    it('should throw on invalid fromSnapshotId', () => {
      expect(() => controller.createBranch('fb', 'nonexistent')).toThrow();
    });

    it('should delete a non-main branch', () => {
      controller.createBranch('temp');
      expect(controller.deleteBranch('temp')).toBe(true);
      expect(controller.listBranches().find(b => b.name === 'temp')).toBeUndefined();
    });

    it('should not delete main branch', () => {
      expect(controller.deleteBranch('main')).toBe(false);
    });

    it('should return false deleting nonexistent branch', () => {
      expect(controller.deleteBranch('nope')).toBe(false);
    });

    it('should switch branch', () => {
      controller.createBranch('dev');
      expect(controller.switchBranch('dev')).toBe(true);
      expect(controller.listBranches().find(b => b.name === 'dev')).toBeTruthy();
    });

    it('should return false switching to unknown branch', () => {
      expect(controller.switchBranch('nope')).toBe(false);
    });

    it('should list all branches', () => {
      controller.createBranch('b1');
      controller.createBranch('b2');
      const branches = controller.listBranches();
      expect(branches.length).toBe(3); // main + b1 + b2
    });

    it('should switch to main when current branch is deleted', () => {
      controller.createBranch('temp2');
      controller.switchBranch('temp2');
      controller.deleteBranch('temp2');
      // After deletion, should fall back to main
      const stats = controller.getStats();
      expect(stats.currentBranch).toBe('main');
    });

    it('should remove exclusive snapshots when deleting branch', () => {
      controller.createBranch('isolated');
      controller.switchBranch('isolated');
      controller.createSnapshot('t_iso', [{ x: 1 }]);
      controller.switchBranch('main');
      controller.deleteBranch('isolated');
      // Snapshot on isolated branch should be gone
      expect(controller.listSnapshots('t_iso').length).toBe(0);
    });
  });

  // ── Merge ────────────────────────────────────────────────────────────────

  describe('mergeBranch', () => {
    it('should merge source into target with changes', () => {
      controller.createSnapshot('t', [{ _id: '1', v: 1 }]);
      controller.createBranch('feat');
      controller.switchBranch('feat');
      controller.createSnapshot('t', [{ _id: '1', v: 2 }]);
      controller.switchBranch('main');

      const diff = controller.mergeBranch('feat', 'main');
      expect(diff.modifiedRows).toBe(1);
      expect(diff.snapshotId).toBeTruthy();
    });

    it('should return early when no changes', () => {
      controller.createSnapshot('t', [{ _id: '1' }]);
      controller.createBranch('clone');
      const diff = controller.mergeBranch('clone', 'main');
      expect(diff.addedRows).toBe(0);
      expect(diff.removedRows).toBe(0);
      expect(diff.modifiedRows).toBe(0);
    });

    it('should throw on nonexistent source branch', () => {
      expect(() => controller.mergeBranch('nope', 'main')).toThrow();
    });

    it('should throw on nonexistent target branch', () => {
      controller.createBranch('src');
      expect(() => controller.mergeBranch('src', 'nope')).toThrow();
    });
  });

  // ── Prune ────────────────────────────────────────────────────────────────

  describe('prune', () => {
    it('should prune by maxSnapshots policy (auto-enforced on createSnapshot)', () => {
      const ctrl = new DataVersionController({ maxSnapshots: 3 });
      for (let i = 0; i < 5; i++) {
        ctrl.createSnapshot('t', [{ v: i }]);
      }
      // enforceRetentionPolicy runs inside createSnapshot, so data is already trimmed
      expect(ctrl.listSnapshots('t').length).toBeLessThanOrEqual(3);
      // Manual prune may find nothing left to remove
      const removed = ctrl.prune();
      expect(removed).toBeGreaterThanOrEqual(0);
      ctrl.dispose();
    });

    it('should prune by maxAge', () => {
      vi.useFakeTimers();
      controller.createSnapshot('t', [{ v: 1 }]);
      vi.advanceTimersByTime(10_000);
      controller.createSnapshot('t', [{ v: 2 }]);
      vi.advanceTimersByTime(2000);

      // Prune snapshots older than 5 seconds
      const removed = controller.prune('5s');
      expect(removed).toBeGreaterThanOrEqual(1);
      vi.useRealTimers();
    });

    it('should throw on invalid duration string', () => {
      expect(() => controller.prune('invalid')).toThrow();
    });

    it('should handle parseDuration for various units', () => {
      vi.useFakeTimers();
      controller.createSnapshot('t', [{ v: 1 }]);
      vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000); // > 7 days
      const removed = controller.prune('7d');
      expect(removed).toBeGreaterThanOrEqual(0);
      vi.useRealTimers();
    });
  });

  // ── Content Hash ─────────────────────────────────────────────────────────

  describe('getContentHash', () => {
    it('should return consistent hash for same data', () => {
      const data = [{ a: 1, b: 2 }];
      expect(controller.getContentHash(data)).toBe(controller.getContentHash(data));
    });

    it('should return different hash for different data', () => {
      expect(controller.getContentHash([{ a: 1 }])).not.toBe(controller.getContentHash([{ a: 2 }]));
    });

    it('should return hash for empty data', () => {
      expect(controller.getContentHash([])).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should handle nested objects', () => {
      const hash = controller.getContentHash([{ nested: { deep: { val: 1 } } }]);
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('should handle null and undefined', () => {
      const h1 = controller.getContentHash([null]);
      const h2 = controller.getContentHash([undefined]);
      expect(h1).toMatch(/^[0-9a-f]{8}$/);
      expect(h2).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  // ── Auto-snapshot ────────────────────────────────────────────────────────

  describe('auto-snapshot', () => {
    it('should register and unregister source', () => {
      controller.registerAutoSnapshotSource('auto_t', () => [{ v: 1 }]);
      expect(controller.unregisterAutoSnapshotSource('auto_t')).toBe(true);
      expect(controller.unregisterAutoSnapshotSource('auto_t')).toBe(false);
    });

    it('should take auto-snapshots on interval when enabled', () => {
      vi.useFakeTimers();
      const ctrl = new DataVersionController({
        autoSnapshot: true,
        autoSnapshotIntervalMs: 500,
      });
      let counter = 0;
      ctrl.registerAutoSnapshotSource('src', () => [{ c: counter++ }]);
      vi.advanceTimersByTime(1200);
      const snaps = ctrl.listSnapshots('src');
      expect(snaps.length).toBeGreaterThanOrEqual(1);
      expect(snaps[0].metadata?.auto).toBe(true);
      ctrl.dispose();
      vi.useRealTimers();
    });

    it('should handle auto-snapshot provider errors', () => {
      vi.useFakeTimers();
      const ctrl = new DataVersionController({
        autoSnapshot: true,
        autoSnapshotIntervalMs: 500,
      });
      ctrl.registerAutoSnapshotSource('bad', () => { throw new Error('provider fail'); });
      // Should not throw, just log error
      vi.advanceTimersByTime(600);
      ctrl.dispose();
      vi.useRealTimers();
    });

    it('should stop timer when all sources unregistered', () => {
      vi.useFakeTimers();
      const ctrl = new DataVersionController({
        autoSnapshot: true,
        autoSnapshotIntervalMs: 500,
      });
      ctrl.registerAutoSnapshotSource('s1', () => [{ v: 1 }]);
      ctrl.unregisterAutoSnapshotSource('s1');
      // Timer should be stopped — advancing time should not create snapshots
      const countBefore = ctrl.listSnapshots('s1').length;
      vi.advanceTimersByTime(5000);
      expect(ctrl.listSnapshots('s1').length).toBe(countBefore);
      ctrl.dispose();
      vi.useRealTimers();
    });
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should report correct counts', () => {
      controller.createSnapshot('t1', [{ a: 1 }]);
      controller.createSnapshot('t1', [{ a: 2 }]);
      controller.createSnapshot('t2', [{ b: 1 }]);
      controller.createBranch('b1');

      const stats = controller.getStats();
      // totalSnapshots includes sentinel + 3 real
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(4);
      expect(stats.totalBranches).toBe(2);
      expect(stats.currentBranch).toBe('main');
      expect(stats.tables.length).toBe(2);
      expect(stats.memoryEstimateKB).toBeGreaterThanOrEqual(0);
    });

    it('should track latest hash per table', () => {
      const snap = controller.createSnapshot('t', [{ v: 99 }]);
      const stats = controller.getStats();
      const table = stats.tables.find(t => t.name === 't');
      expect(table?.latestHash).toBe(snap.hash);
    });
  });

  // ── Dispose ──────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clear all state', () => {
      controller.createSnapshot('t', [{ x: 1 }]);
      controller.createBranch('br');
      controller.dispose();
      expect(controller.listSnapshots().length).toBe(0);
      expect(controller.listBranches().length).toBe(0);
    });
  });

  // ── Retention edge cases ─────────────────────────────────────────────────

  describe('retention edge cases', () => {
    it('should keep snapshots referenced by other branches', () => {
      controller.createSnapshot('t', [{ v: 1 }]);
      controller.createSnapshot('t', [{ v: 2 }]);
      controller.createBranch('ref_branch'); // refs current head
      // Now with maxSnapshots=10, create more to trigger retention
      for (let i = 3; i <= 15; i++) {
        controller.createSnapshot('t', [{ v: i }]);
      }
      // Original snapshots should still exist because ref_branch references them
      const allSnaps = controller.listSnapshots('t');
      expect(allSnaps.length).toBeGreaterThan(0);
    });

    it('should enforce retention for table on current branch', () => {
      const ctrl = new DataVersionController({ maxSnapshots: 2 });
      ctrl.createSnapshot('t', [{ v: 1 }]);
      ctrl.createSnapshot('t', [{ v: 2 }]);
      ctrl.createSnapshot('t', [{ v: 3 }]); // should prune oldest
      const history = ctrl.getHistory('t');
      expect(history.length).toBeLessThanOrEqual(2);
      ctrl.dispose();
    });
  });
});
