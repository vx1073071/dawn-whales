import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
﻿// T65: Database Schema Migration Engine
export type MigrationDirection = 'up' | 'down';

export interface Migration {
  version: number;
  name: string;
  up: string; // SQL
  down?: string; // rollback SQL
}

interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
}

export class MigrationEngine {
  private migrations: Migration[] = [];
  private appliedCallback: (() => Promise<MigrationRecord[]>) | null = null;
  private executeCallback: ((sql: string) => Promise<void>) | null = null;
  private recordCallback: ((record: MigrationRecord) => Promise<void>) | null = null;
  private removeCallback: ((version: number) => Promise<void>) | null = null;

  register(migration: Migration): void {
    if (this.migrations.find(m => m.version === migration.version)) {
      throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_CORRUPT, `Duplicate migration version: ${migration.version}`);
    }
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  registerMany(migrations: Migration[]): void {
    for (const m of migrations) this.register(m);
  }

  onApplied(fn: () => Promise<MigrationRecord[]>): void { this.appliedCallback = fn; }
  onExecute(fn: (sql: string) => Promise<void>): void { this.executeCallback = fn; }
  onRecord(fn: (record: MigrationRecord) => Promise<void>): void { this.recordCallback = fn; }
  onRemove(fn: (version: number) => Promise<void>): void { this.removeCallback = fn; }

  async migrate(direction: MigrationDirection = 'up', targetVersion?: number): Promise<MigrationRecord[]> {
    const records = await this._getApplied();
    const applied = records.map(r => r.version);

    if (direction === 'up') {
      return this._migrateUp(applied, targetVersion);
    } else {
      return this._migrateDown(applied, targetVersion);
    }
  }

  private async _migrateUp(applied: number[], targetVersion?: number): Promise<MigrationRecord[]> {
    const pending = this.migrations.filter(m => !applied.includes(m.version));
    if (targetVersion !== undefined) {
      const filtered = pending.filter(m => m.version <= targetVersion);
      if (filtered.length === 0) return [];
    }

    for (const m of pending) {
      if (targetVersion !== undefined && m.version > targetVersion) break;
      await this._execute(m.up);
      const record: MigrationRecord = {
        version: m.version,
        name: m.name,
        appliedAt: new Date().toISOString(),
      };
      await this._record(record);
      applied.push(m.version);
    }

    return this._getApplied();
  }

  private async _migrateDown(applied: number[], targetVersion?: number): Promise<MigrationRecord[]> {
    const toRollback = this.migrations
      .filter(m => applied.includes(m.version))
      .reverse();

    for (const m of toRollback) {
      if (targetVersion !== undefined && m.version <= targetVersion) break;
      if (!m.down) continue; // skip if no rollback
      await this._execute(m.down);
      await this._remove(m.version);
    }

    return this._getApplied();
  }

  async status(): Promise<{ applied: number[]; pending: number[] }> {
    const records = await this._getApplied();
    const applied = records.map(r => r.version);
    const pending = this.migrations.filter(m => !applied.includes(m.version)).map(m => m.version);
    return { applied, pending };
  }

  checkConflicts(): { version: number; name: string }[] {
    const seen = new Set<number>();
    const conflicts: { version: number; name: string }[] = [];
    for (const m of this.migrations) {
      if (seen.has(m.version)) conflicts.push({ version: m.version, name: m.name });
      seen.add(m.version);
    }
    return conflicts;
  }

  private async _getApplied(): Promise<MigrationRecord[]> {
    if (!this.appliedCallback) throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_CORRUPT, 'onApplied callback not set');
    return this.appliedCallback();
  }

  private async _execute(sql: string): Promise<void> {
    if (!this.executeCallback) throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_CORRUPT, 'onExecute callback not set');
    await this.executeCallback(sql);
  }

  private async _record(record: MigrationRecord): Promise<void> {
    if (!this.recordCallback) throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_CORRUPT, 'onRecord callback not set');
    await this.recordCallback(record);
  }

  private async _remove(version: number): Promise<void> {
    if (!this.removeCallback) throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_CORRUPT, 'onRemove callback not set');
    await this.removeCallback(version);
  }
}
