/**
 * DAWN WHALES R128 J01 — SQLite IPC Bridge
 * 
 * Moves all better-sqlite3 operations to the main process,
 * enabling sandbox:true in the renderer.
 * 
 * IPC channels: db:query, db:exec, db:get, db:all, db:run
 */

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

// ═══════════ Database Lifecycle ═══════════════════════════

function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'dawn-whales.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// ═══════════ IPC Handlers ═══════════════════════════

export function registerSqliteIPC() {
  // db:all — SELECT returning multiple rows
  ipcMain.handle('db:all', async (_event, sql: string, params?: unknown[]) => {
    try {
      const d = getDb();
      const rows = d.prepare(sql).all(...(params ?? []));
      return { success: true, data: rows };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // db:get — SELECT returning single row
  ipcMain.handle('db:get', async (_event, sql: string, params?: unknown[]) => {
    try {
      const d = getDb();
      const row = d.prepare(sql).get(...(params ?? []));
      return { success: true, data: row };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // db:run — INSERT/UPDATE/DELETE, returns changes
  ipcMain.handle('db:run', async (_event, sql: string, params?: unknown[]) => {
    try {
      const d = getDb();
      const result = d.prepare(sql).run(...(params ?? []));
      return { success: true, data: { changes: result.changes, lastInsertRowid: result.lastInsertRowid } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // db:exec — multi-statement execution
  ipcMain.handle('db:exec', async (_event, sql: string) => {
    try {
      const d = getDb();
      d.exec(sql);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // db:query — generic query returning typed result
  ipcMain.handle('db:query', async (_event, opts: { sql: string; type: 'all' | 'get' | 'run'; params?: unknown[] }) => {
    try {
      const d = getDb();
      const stmt = d.prepare(opts.sql);
      let data: unknown;
      if (opts.type === 'all') {
        data = stmt.all(...(opts.params ?? []));
      } else if (opts.type === 'get') {
        data = stmt.get(...(opts.params ?? []));
      } else {
        data = stmt.run(...(opts.params ?? []));
      }
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Close DB on app quit
  app.on('will-quit', closeDatabase);
}
