/**
 * R95 J-01: engine/data 覆盖率 — DataWarehouse
 * 覆盖: data-warehouse.ts (1241行)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataWarehouse,
  getDataWarehouse,
  resetDataWarehouse,
  type ColumnDef,
} from '../../../../electron/engine/data/data-warehouse';

function cols(...names: [string, ColumnDef['type']][]): ColumnDef[] {
  return names.map(([name, type]) => ({
    name,
    type,
    nullable: true,
    indexed: name === 'id' || name === 'symbol',
  }));
}

describe('DataWarehouse', () => {
  let dw: DataWarehouse;

  beforeEach(() => {
    dw = new DataWarehouse();
  });

  // ── Table Management ─────────────────────────────────────────────────

  describe('createTable / dropTable', () => {
    it('should create a table', () => {
      dw.createTable('trades', cols(['id', 'string'], ['price', 'number']));
      expect(dw.hasTable('trades')).toBe(true);
    });

    it('should skip duplicate table creation', () => {
      dw.createTable('t1', cols(['id', 'string']));
      dw.createTable('t1', cols(['id', 'string'])); // no-op
      expect(dw.hasTable('t1')).toBe(true);
    });

    it('should drop a table', () => {
      dw.createTable('t1', cols(['id', 'string']));
      dw.dropTable('t1');
      expect(dw.hasTable('t1')).toBe(false);
    });

    it('should warn on dropping non-existent table', () => {
      dw.dropTable('nonexistent'); // no throw
    });
  });

  // ── Insert / Upsert / Delete ─────────────────────────────────────────

  describe('insert', () => {
    it('should insert rows', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      dw.insert('t', [{ id: 'a', val: 1 }, { id: 'b', val: 2 }]);
      expect(dw.getRowCount('t')).toBe(2);
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.insert('nope', [{ id: 'a' }])).toThrow();
    });

    it('should handle empty insert', () => {
      dw.createTable('t', cols(['id', 'string']));
      dw.insert('t', []);
      expect(dw.getRowCount('t')).toBe(0);
    });

    it('should coerce types on insert', () => {
      dw.createTable('t', cols(['val', 'number'], ['flag', 'boolean'], ['ts', 'datetime']));
      dw.insert('t', [{ val: '42', flag: 'true', ts: '2024-01-01' }]);
      const rows = dw.query({ table: 't' }).rows as any[];
      expect(rows[0].val).toBe(42);
      expect(rows[0].flag).toBe(true);
      expect(typeof rows[0].ts).toBe('string');
    });

    it('should handle null for nullable columns', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', [{ val: null }]);
      const rows = dw.query({ table: 't' }).rows as any[];
      expect(rows[0].val).toBeNull();
    });

    it('should handle json column type', () => {
      dw.createTable('t', [{ name: 'data', type: 'json', nullable: true, indexed: false }]);
      dw.insert('t', [{ data: '{"key":"value"}' }]);
      const rows = dw.query({ table: 't' }).rows as any[];
      expect(rows[0].data).toEqual({ key: 'value' });
    });
  });

  describe('upsert', () => {
    it('should insert new and update existing', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      dw.insert('t', [{ id: 'a', val: 1 }]);
      dw.upsert('t', [{ id: 'a', val: 10 }, { id: 'b', val: 20 }], 'id');
      expect(dw.getRowCount('t')).toBe(2);
      const rows = dw.query({ table: 't', orderBy: { column: 'id' } }).rows as any[];
      expect(rows[0].val).toBe(10);
      expect(rows[1].val).toBe(20);
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.upsert('nope', [{ id: 'a' }], 'id')).toThrow();
    });

    it('should throw for missing key column', () => {
      dw.createTable('t', cols(['id', 'string']));
      expect(() => dw.upsert('t', [{ id: 'a' }], 'nonexistent')).toThrow();
    });
  });

  describe('delete', () => {
    it('should delete rows matching where', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      dw.insert('t', [{ id: 'a', val: 1 }, { id: 'b', val: 2 }, { id: 'a', val: 3 }]);
      const deleted = dw.delete('t', { id: 'a' });
      expect(deleted).toBe(2);
      expect(dw.getRowCount('t')).toBe(1);
    });

    it('should return 0 for no matches', () => {
      dw.createTable('t', cols(['id', 'string']));
      dw.insert('t', [{ id: 'a' }]);
      expect(dw.delete('t', { id: 'z' })).toBe(0);
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.delete('nope', {})).toThrow();
    });
  });

  // ── Query ─────────────────────────────────────────────────────────────

  describe('query', () => {
    beforeEach(() => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number'], ['cat', 'string']));
      dw.insert('t', [
        { id: 'a', val: 10, cat: 'x' },
        { id: 'b', val: 20, cat: 'y' },
        { id: 'c', val: 30, cat: 'x' },
        { id: 'd', val: 40, cat: 'y' },
      ]);
    });

    it('should query all rows', () => {
      const r = dw.query({ table: 't' });
      expect(r.rows.length).toBe(4);
      expect(r.cached).toBe(false);
    });

    it('should filter with where', () => {
      const r = dw.query({ table: 't', where: { cat: 'x' } });
      expect(r.rows.length).toBe(2);
    });

    it('should filter with operator $gt', () => {
      const r = dw.query({ table: 't', where: { val: { $gt: 20 } } });
      expect(r.rows.length).toBe(2);
    });

    it('should filter with operator $gte', () => {
      const r = dw.query({ table: 't', where: { val: { $gte: 20 } } });
      expect(r.rows.length).toBe(3);
    });

    it('should filter with operator $lt', () => {
      const r = dw.query({ table: 't', where: { val: { $lt: 30 } } });
      expect(r.rows.length).toBe(2);
    });

    it('should filter with operator $ne', () => {
      const r = dw.query({ table: 't', where: { val: { $ne: 10 } } });
      expect(r.rows.length).toBe(3);
    });

    it('should filter with operator $in', () => {
      const r = dw.query({ table: 't', where: { cat: { $in: ['x'] } } });
      expect(r.rows.length).toBe(2);
    });

    it('should filter with operator $like', () => {
      const r = dw.query({ table: 't', where: { id: { $like: 'a%' } } });
      expect(r.rows.length).toBe(1);
    });

    it('should sort ascending', () => {
      const r = dw.query({ table: 't', orderBy: { column: 'val' } });
      expect((r.rows[0] as any).val).toBe(10);
    });

    it('should sort descending', () => {
      const r = dw.query({ table: 't', orderBy: { column: 'val', desc: true } });
      expect((r.rows[0] as any).val).toBe(40);
    });

    it('should apply limit', () => {
      const r = dw.query({ table: 't', limit: 2 });
      expect(r.rows.length).toBe(2);
    });

    it('should apply offset', () => {
      const r = dw.query({ table: 't', offset: 2 });
      expect(r.rows.length).toBe(2);
    });

    it('should project columns', () => {
      const r = dw.query({ table: 't', columns: ['id', 'val'] });
      expect(Object.keys(r.rows[0])).toEqual(['id', 'val']);
    });

    it('should cache results', () => {
      dw.query({ table: 't', where: { cat: 'x' } });
      const r2 = dw.query({ table: 't', where: { cat: 'x' } });
      expect(r2.cached).toBe(true);
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.query({ table: 'nope' })).toThrow();
    });

    it('should filter with timeRange', () => {
      dw.createTable('ts', cols(['ts', 'datetime'], ['val', 'number']));
      dw.insert('ts', [
        { ts: '2024-01-01T00:00:00Z', val: 1 },
        { ts: '2024-06-01T00:00:00Z', val: 2 },
        { ts: '2024-12-01T00:00:00Z', val: 3 },
      ]);
      const r = dw.query({
        table: 'ts',
        timeRange: { column: 'ts', start: '2024-03-01', end: '2024-09-01' },
      });
      expect(r.rows.length).toBe(1);
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────

  describe('getColumnStats / getAllColumnStats', () => {
    it('should return column statistics', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', [{ val: 10 }, { val: 20 }, { val: 30 }]);
      const stats = dw.getColumnStats('t', 'val');
      expect(stats).toBeDefined();
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
      expect(stats!.avg).toBe(20);
    });

    it('should return null for non-numeric column', () => {
      dw.createTable('t', cols(['name', 'string']));
      dw.insert('t', [{ name: 'a' }]);
      expect(dw.getColumnStats('t', 'name')).toBeNull();
    });

    it('should return null for empty table', () => {
      dw.createTable('t', cols(['val', 'number']));
      expect(dw.getColumnStats('t', 'val')).toBeNull();
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.getColumnStats('nope', 'val')).toThrow();
    });

    it('should return all numeric column stats', () => {
      dw.createTable('t', cols(['a', 'number'], ['b', 'number'], ['c', 'string']));
      dw.insert('t', [{ a: 1, b: 10, c: 'x' }]);
      const stats = dw.getAllColumnStats('t');
      expect(stats.length).toBe(2);
    });
  });

  // ── getTableInfo / getStats ───────────────────────────────────────────

  describe('getTableInfo / getStats', () => {
    it('should return table info', () => {
      dw.createTable('t1', cols(['id', 'string']));
      dw.insert('t1', [{ id: 'a' }]);
      const info = dw.getTableInfo();
      expect(info.length).toBe(1);
      expect(info[0].name).toBe('t1');
      expect(info[0].rowCount).toBe(1);
    });

    it('should return global stats', () => {
      dw.createTable('t1', cols(['id', 'string']));
      dw.createTable('t2', cols(['val', 'number']));
      dw.insert('t1', [{ id: 'a' }]);
      dw.insert('t2', [{ val: 1 }, { val: 2 }]);
      const stats = dw.getStats();
      expect(stats.totalTables).toBe(2);
      expect(stats.totalRows).toBe(3);
    });
  });

  // ── Partitioning ──────────────────────────────────────────────────────

  describe('partitioning', () => {
    it('should set and get partition config', () => {
      dw.createTable('t', cols(['ts', 'datetime'], ['val', 'number']));
      dw.setPartitionConfig({
        table: 't',
        partitionBy: 'month',
        timeColumn: 'ts',
        retentionDays: 90,
      });
      const cfg = dw.getPartitionConfig('t');
      expect(cfg).toBeDefined();
      expect(cfg!.partitionBy).toBe('month');
    });

    it('should get partition keys', () => {
      dw.createTable('t', cols(['ts', 'datetime'], ['val', 'number']));
      dw.setPartitionConfig({ table: 't', partitionBy: 'month', timeColumn: 'ts', retentionDays: 365 });
      dw.insert('t', [
        { ts: '2024-01-15', val: 1 },
        { ts: '2024-02-15', val: 2 },
        { ts: '2024-01-20', val: 3 },
      ]);
      const keys = dw.getPartitionKeys('t');
      expect(keys).toContain('2024-01');
      expect(keys).toContain('2024-02');
    });

    it('should return empty for no partition', () => {
      dw.createTable('t', cols(['val', 'number']));
      expect(dw.getPartitionKeys('t')).toEqual([]);
    });
  });

  // ── Compact ───────────────────────────────────────────────────────────

  describe('compact', () => {
    it('should remove expired rows', () => {
      dw.createTable('t', cols(['ts', 'datetime'], ['val', 'number']));
      dw.setPartitionConfig({ table: 't', partitionBy: 'day', timeColumn: 'ts', retentionDays: 1 });
      dw.insert('t', [
        { ts: '2020-01-01', val: 1 },
        { ts: new Date().toISOString(), val: 2 },
      ]);
      const result = dw.compact();
      expect(result.removedRows).toBe(1);
      expect(dw.getRowCount('t')).toBe(1);
    });

    it('should keep rows without time data', () => {
      dw.createTable('t', cols(['ts', 'datetime'], ['val', 'number']));
      dw.setPartitionConfig({ table: 't', partitionBy: 'day', timeColumn: 'ts', retentionDays: 1 });
      dw.insert('t', [{ val: 1 }, { ts: new Date().toISOString(), val: 2 }]);
      const result = dw.compact();
      expect(result.removedRows).toBe(0);
      expect(dw.getRowCount('t')).toBe(2);
    });
  });

  // ── Export / Import ───────────────────────────────────────────────────

  describe('exportTable / importTable', () => {
    it('should export as JSON', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      dw.insert('t', [{ id: 'a', val: 1 }]);
      const json = dw.exportTable('t', 'json');
      const parsed = JSON.parse(json);
      expect(parsed[0].id).toBe('a');
    });

    it('should export as CSV', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      dw.insert('t', [{ id: 'a', val: 1 }]);
      const csv = dw.exportTable('t', 'csv');
      expect(csv).toContain('id,val');
      expect(csv).toContain('a,1');
    });

    it('should import from JSON', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      const json = JSON.stringify([{ id: 'x', val: 99 }]);
      const count = dw.importTable('t', json, 'json');
      expect(count).toBe(1);
      expect(dw.getRowCount('t')).toBe(1);
    });

    it('should import from CSV', () => {
      dw.createTable('t', cols(['id', 'string'], ['val', 'number']));
      const csv = 'id,val\nx,99\ny,88';
      const count = dw.importTable('t', csv, 'csv');
      expect(count).toBe(2);
    });

    it('should throw for non-existent table on export', () => {
      expect(() => dw.exportTable('nope', 'json')).toThrow();
    });

    it('should throw for non-array JSON import', () => {
      dw.createTable('t', cols(['id', 'string']));
      expect(() => dw.importTable('t', '{}', 'json')).toThrow();
    });

    it('should throw for too-short CSV import', () => {
      dw.createTable('t', cols(['id', 'string']));
      expect(() => dw.importTable('t', 'id', 'csv')).toThrow();
    });
  });

  // ── Index Management ──────────────────────────────────────────────────

  describe('addIndex / removeIndex', () => {
    it('should add an index', () => {
      dw.createTable('t', [{ name: 'id', type: 'string', nullable: true, indexed: false }]);
      dw.insert('t', [{ id: 'a' }, { id: 'b' }]);
      dw.addIndex('t', 'id');
      // Index should speed up queries
      const r = dw.query({ table: 't', where: { id: 'a' } });
      expect(r.rows.length).toBe(1);
    });

    it('should skip duplicate index', () => {
      dw.createTable('t', [{ name: 'id', type: 'string', nullable: true, indexed: true }]);
      dw.addIndex('t', 'id'); // already exists
    });

    it('should remove an index', () => {
      dw.createTable('t', [{ name: 'id', type: 'string', nullable: true, indexed: true }]);
      dw.removeIndex('t', 'id');
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.addIndex('nope', 'id')).toThrow();
    });

    it('should throw for non-existent column', () => {
      dw.createTable('t', cols(['id', 'string']));
      expect(() => dw.addIndex('t', 'nope')).toThrow();
    });
  });

  // ── Utility ───────────────────────────────────────────────────────────

  describe('sample / snapshot / restore', () => {
    it('should sample rows', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', Array.from({ length: 20 }, (_, i) => ({ val: i })));
      const sample = dw.sample('t', 5);
      expect(sample.length).toBe(5);
    });

    it('should return all rows if count >= total', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', [{ val: 1 }, { val: 2 }]);
      expect(dw.sample('t', 10).length).toBe(2);
    });

    it('should snapshot and restore', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', [{ val: 1 }, { val: 2 }]);
      const snap = dw.snapshot();
      dw.delete('t', {});
      expect(dw.getRowCount('t')).toBe(0);
      dw.restore(snap);
      expect(dw.getRowCount('t')).toBe(2);
    });

    it('should skip non-existent table in restore', () => {
      const snap = new Map([['nope', [{ id: 'a' }]]]);
      dw.restore(snap); // no throw
    });
  });

  // ── Cache ─────────────────────────────────────────────────────────────

  describe('cache', () => {
    it('should clear cache', () => {
      dw.createTable('t', cols(['val', 'number']));
      dw.insert('t', [{ val: 1 }]);
      dw.query({ table: 't' });
      dw.clearCache();
      const stats = dw.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  // ── getColumns / getRowCount ──────────────────────────────────────────

  describe('getColumns / getRowCount', () => {
    it('should return columns', () => {
      dw.createTable('t', cols(['a', 'string'], ['b', 'number']));
      const c = dw.getColumns('t');
      expect(c.length).toBe(2);
    });

    it('should return row count', () => {
      dw.createTable('t', cols(['id', 'string']));
      dw.insert('t', [{ id: '1' }, { id: '2' }]);
      expect(dw.getRowCount('t')).toBe(2);
    });

    it('should throw for non-existent table', () => {
      expect(() => dw.getColumns('nope')).toThrow();
      expect(() => dw.getRowCount('nope')).toThrow();
    });
  });

  // ── Singleton ─────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('should return same instance', () => {
      resetDataWarehouse();
      const a = getDataWarehouse();
      const b = getDataWarehouse();
      expect(a).toBe(b);
    });

    it('should reset singleton', () => {
      resetDataWarehouse();
      const a = getDataWarehouse();
      resetDataWarehouse();
      const b = getDataWarehouse();
      expect(a).not.toBe(b);
    });
  });

  // ── Where with null/undefined ─────────────────────────────────────────

  describe('where with null matching', () => {
    it('should match null values', () => {
      dw.createTable('t', cols(['val', 'string']));
      dw.insert('t', [{ val: null }, { val: 'hello' }]);
      const r = dw.query({ table: 't', where: { val: null } });
      expect(r.rows.length).toBe(1);
    });
  });
});
