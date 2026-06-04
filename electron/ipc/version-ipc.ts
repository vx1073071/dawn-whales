// ── DAWN WHALES IPC: version ────────────────────────────────────────────
// 12 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerVersionIPC(
) {


  // ── JVS-40: Version Control Service ──────────────────────────────────────
  ipcMain.handle('version:track', async (_e, entityId: string, entityType: string, data: any, changeType?: string, changeSummary?: string, userId?: string, tags?: string[]) => {
    try {
      const version = await trackVersion(entityId, entityType, data, changeType as any, changeSummary, userId, tags);
      return { success: true, version };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:get-entity-versions', async (_e, entityId: string, limit?: number) => {
    try {
      const versions = await getEntityVersions(entityId, limit);
      return { success: true, versions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:get', async (_e, versionId: string) => {
    try {
      const version = await getVersion(versionId);
      return { success: true, version };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:get-latest', async (_e, entityId: string) => {
    try {
      const version = await getLatestVersion(entityId);
      return { success: true, version };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:diff', async (_e, versionId1: string, versionId2: string) => {
    try {
      const diff = await diffVersions(versionId1, versionId2);
      return { success: true, diff };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:rollback', async (_e, entityId: string, targetVersion: number) => {
    try {
      const result = await rollback(entityId, targetVersion);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:query', async (_e, query: any) => {
    try {
      const versions = await queryVersions(query);
      return { success: true, versions };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:stats', async () => {
    try {
      const stats = getVersionStats();
      return { success: true, stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:delete', async (_e, versionId: string) => {
    try {
      const deleted = await deleteVersion(versionId);
      return { success: true, deleted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:clear', async () => {
    try {
      await clearAllVersions();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:export', async (_e, query?: any) => {
    try {
      const json = await exportVersions(query);
      return { success: true, json };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('version:import', async (_e, jsonString: string) => {
    try {
      const imported = await importVersions(jsonString);
      return { success: true, imported };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Q17: Paper Trader ──────────────────────


}
