// ── DAWN WHALES IPC: snapshot ────────────────────────────────────────────
// Auto-split from main.ts — 12 handlers
//
// Registered channels:
//   snapshot:capture
//   snapshot:query
//   snapshot:get
//   snapshot:compare
//   snapshot:timeline
//   snapshot:latest
//   snapshot:cleanup
//   snapshot:export
//   snapshot:import
//   snapshot:stats
//   snapshot:delete
//   snapshot:clear

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { captureSnapshot, cleanupOldSnapshots, clearAllSnapshots, compareSnapshots, deleteSnapshot, exportSnapshots, getLatestSnapshot, getSnapshot, getSnapshotStats, getSnapshotTimeline, importSnapshots, querySnapshots } from './engine/snapshot-service';

/**
 * Register all snapshot IPC handlers
 *
 * @param snapshot - service reference
 */
export function registerSnapshotIPC(
  snapshot: any
) {

  // ── snapshot:capture ───────────────────────────────────────────────
  // ── JVS-39: Data Snapshot Service ──────────────────────────────────────
  ipcMain.handle('snapshot:capture', async (_e, type: string, category: string, data: any, metadata?: any) => {
    try {
      const snapshot = await captureSnapshot(type, category, data, metadata);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:query ───────────────────────────────────────────────
  ipcMain.handle('snapshot:query', async (_e, query: any) => {
    try {
      const snapshots = await querySnapshots(query);
      return { success: true, snapshots };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:get ───────────────────────────────────────────────
  ipcMain.handle('snapshot:get', async (_e, id: string) => {
    try {
      const snapshot = await getSnapshot(id);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:compare ───────────────────────────────────────────────
  ipcMain.handle('snapshot:compare', async (_e, id1: string, id2: string) => {
    try {
      const comparison = await compareSnapshots(id1, id2);
      return { success: true, comparison };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:timeline ───────────────────────────────────────────────
  ipcMain.handle('snapshot:timeline', async (_e, category: string, limit?: number) => {
    try {
      const timeline = await getSnapshotTimeline(category, limit);
      return { success: true, timeline };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:latest ───────────────────────────────────────────────
  ipcMain.handle('snapshot:latest', async (_e, category: string) => {
    try {
      const snapshot = await getLatestSnapshot(category);
      return { success: true, snapshot };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:cleanup ───────────────────────────────────────────────
  ipcMain.handle('snapshot:cleanup', async (_e, daysOld?: number) => {
    try {
      const deleted = await cleanupOldSnapshots(daysOld);
      return { success: true, deleted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:export ───────────────────────────────────────────────
  ipcMain.handle('snapshot:export', async (_e, query?: any) => {
    try {
      const json = await exportSnapshots(query);
      return { success: true, json };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:import ───────────────────────────────────────────────
  ipcMain.handle('snapshot:import', async (_e, jsonString: string) => {
    try {
      const imported = await importSnapshots(jsonString);
      return { success: true, imported };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:stats ───────────────────────────────────────────────
  ipcMain.handle('snapshot:stats', async () => {
    try {
      const stats = getSnapshotStats();
      return { success: true, stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:delete ───────────────────────────────────────────────
  ipcMain.handle('snapshot:delete', async (_e, id: string) => {
    try {
      const deleted = await deleteSnapshot(id);
      return { success: true, deleted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── snapshot:clear ───────────────────────────────────────────────
  ipcMain.handle('snapshot:clear', async () => {
    try {
      await clearAllSnapshots();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
