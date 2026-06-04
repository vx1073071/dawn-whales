import { describe, it, expect, vi } from 'vitest';
import { MigrationEngine } from '../electron/workers/migration-engine';

describe('MigrationEngine', () => {
  it('should apply pending migrations', async () => {
    const engine = new MigrationEngine();
    engine.register({ version: 1, name: 'create_users', up: 'CREATE TABLE users' });
    engine.register({ version: 2, name: 'add_email', up: 'ALTER TABLE users ADD email' });

    const records: any[] = [];
    const executed: string[] = [];

    engine.onApplied(async () => records);
    engine.onExecute(async (sql) => { executed.push(sql); });
    engine.onRecord(async (r) => { records.push(r); });
    engine.onRemove(async () => {});

    await engine.migrate('up');
    expect(executed).toHaveLength(2);
    expect(records).toHaveLength(2);
    expect(records.map((r: any) => r.version)).toEqual([1, 2]);
  });

  it('should skip already applied', async () => {
    const engine = new MigrationEngine();
    engine.register({ version: 1, name: 'v1', up: 'SQL1' });
    engine.register({ version: 2, name: 'v2', up: 'SQL2' });

    engine.onApplied(async () => [{ version: 1, name: 'v1', appliedAt: '' }]);
    const executed: string[] = [];
    engine.onExecute(async (sql) => { executed.push(sql); });
    engine.onRecord(async () => {});
    engine.onRemove(async () => {});

    await engine.migrate('up');
    expect(executed).toEqual(['SQL2']); // only v2
  });

  it('should rollback', async () => {
    const engine = new MigrationEngine();
    engine.register({ version: 1, name: 'v1', up: 'UP1', down: 'DOWN1' });
    engine.register({ version: 2, name: 'v2', up: 'UP2', down: 'DOWN2' });

    engine.onApplied(async () => [
      { version: 1, name: 'v1', appliedAt: '' },
      { version: 2, name: 'v2', appliedAt: '' },
    ]);
    const executed: string[] = [];
    engine.onExecute(async (sql) => { executed.push(sql); });
    engine.onRecord(async () => {});
    engine.onRemove(async () => {});

    await engine.migrate('down', 0);
    expect(executed).toEqual(['DOWN2', 'DOWN1']);
  });
});
