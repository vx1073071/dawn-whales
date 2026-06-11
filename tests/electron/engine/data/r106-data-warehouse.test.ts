/**
 * tests/electron/engine/data/r106-data-warehouse.test.ts
 * R106 S-17p2: DataWarehouse unit tests (~10 tests)
 *
 * Covers:
 * - Table creation with column definitions
 * - Insert with rows array
 * - Drop table
 * - Row count
 * - Sample
 * - Import/export (JSON)
 * - Snapshot/Restore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataWarehouse } from '../../../../electron/engine/data/data-warehouse';

describe('DataWarehouse', () => {
  let dw: DataWarehouse;

  beforeEach(() => {
    dw = new DataWarehouse();
  });

  // ── Table creation ──

  it('should create a table with column definitions', () => {
    dw.createTable('trades', [
      { name: 'id', type: 'string', nullable: false, indexed: true },
      { name: 'amount', type: 'number', nullable: false, indexed: false },
      { name: 'price', type: 'number', nullable: false, indexed: false },
    ]);

    expect(dw.hasTable('trades')).toBe(true);
  });

  it('should handle duplicate table creation (overwrites silently)', () => {
    dw.createTable('dup', [
      { name: 'x', type: 'number', nullable: true, indexed: false },
    ]);
    // Creating same table again should not throw (overwrite behavior)
    expect(() =>
      dw.createTable('dup', [
        { name: 'y', type: 'string', nullable: true, indexed: false },
      ])
    ).not.toThrow();
    expect(dw.hasTable('dup')).toBe(true);
  });

  // ── Insert (accepts rows[]) ──

  it('should insert rows and count correctly', () => {
    dw.createTable('trades', [
      { name: 'symbol', type: 'string', nullable: false, indexed: true },
      { name: 'qty', type: 'number', nullable: false, indexed: false },
      { name: 'price', type: 'number', nullable: false, indexed: false },
    ]);

    dw.insert('trades', [{ symbol: '00700', qty: 100, price: 380.5 }]);
    expect(dw.getRowCount('trades')).toBe(1);
  });

  it('should insert multiple rows at once', () => {
    dw.createTable('orders', [
      { name: 'id', type: 'string', nullable: false, indexed: true },
      { name: 'amount', type: 'number', nullable: false, indexed: false },
    ]);

    dw.insert('orders', [
      { id: 'o1', amount: 100 },
      { id: 'o2', amount: 200 },
      { id: 'o3', amount: 300 },
    ]);

    expect(dw.getRowCount('orders')).toBe(3);
  });

  // ── Upsert ──

  it('should upsert rows by key column', () => {
    dw.createTable('items', [
      { name: 'id', type: 'string', nullable: false, indexed: true },
      { name: 'value', type: 'number', nullable: false, indexed: false },
    ]);

    dw.insert('items', [{ id: 'a', value: 10 }]);
    dw.upsert('items', [{ id: 'a', value: 99 }], 'id');

    expect(dw.getRowCount('items')).toBe(1);
    const sample = dw.sample('items', 1);
    expect(sample[0].value).toBe(99);
  });

  // ── Table metadata ──

  it('should return table metadata with row count', () => {
    dw.createTable('meta', [
      { name: 'col1', type: 'string', nullable: false, indexed: true },
      { name: 'col2', type: 'number', nullable: true, indexed: false },
    ]);

    dw.insert('meta', [
      { col1: 'a', col2: 1 },
      { col1: 'b', col2: 2 },
    ]);

    const tables = dw.getTableInfo();
    const metaTable = tables.find((t) => t.name === 'meta');
    expect(metaTable).toBeDefined();
    expect(metaTable?.rowCount).toBe(2);
    expect(metaTable?.columns).toHaveLength(2);
  });

  // ── Drop table ──

  it('should drop a table', () => {
    dw.createTable('tmp', [
      { name: 'x', type: 'number', nullable: true, indexed: false },
    ]);
    dw.insert('tmp', [{ x: 1 }]);
    dw.dropTable('tmp');
    expect(dw.hasTable('tmp')).toBe(false);
  });

  // ── Import/export ──

  it('should export and import tables in JSON format', () => {
    dw.createTable('export_test', [
      { name: 'name', type: 'string', nullable: false, indexed: false },
      { name: 'age', type: 'number', nullable: false, indexed: false },
    ]);

    dw.insert('export_test', [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);

    const json = dw.exportTable('export_test', 'json');
    expect(json).toBeTruthy();

    // Import into new table
    dw.createTable('import_test', [
      { name: 'name', type: 'string', nullable: false, indexed: false },
      { name: 'age', type: 'number', nullable: false, indexed: false },
    ]);
    const count = dw.importTable('import_test', json, 'json');
    expect(count).toBe(2);
    expect(dw.getRowCount('import_test')).toBe(2);
  });

  // ── Snapshot / Restore ──

  it('should snapshot state and restore with same warehouse', () => {
    dw.createTable('snap', [
      { name: 'x', type: 'number', nullable: true, indexed: false },
    ]);
    dw.insert('snap', [{ x: 42 }, { x: 99 }]);

    const snapshot = dw.snapshot();
    expect(snapshot).toBeInstanceOf(Map);
    expect(snapshot.size).toBeGreaterThan(0);

    // Restore into same warehouse (clears existing, reloads snapshot)
    dw.restore(snapshot);
    expect(dw.hasTable('snap')).toBe(true);
    expect(dw.getRowCount('snap')).toBe(2);
  });

  // ── Index operations ──

  it('should add and remove indexes', () => {
    dw.createTable('idx_test', [
      { name: 'col_a', type: 'string', nullable: false, indexed: false },
      { name: 'col_b', type: 'number', nullable: false, indexed: false },
    ]);

    dw.addIndex('idx_test', 'col_a');
    dw.addIndex('idx_test', 'col_b');

    const tableInfoAfter = dw.getTableInfo().find((t) => t.name === 'idx_test');
    expect(tableInfoAfter?.indexes).toContain('col_a');
    expect(tableInfoAfter?.indexes).toContain('col_b');

    dw.removeIndex('idx_test', 'col_a');
    const tableInfoAfter2 = dw.getTableInfo().find((t) => t.name === 'idx_test');
    expect(tableInfoAfter2?.indexes).not.toContain('col_a');
  });
});
