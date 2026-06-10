// ── DAWN WHALES IPC: cache ────────────────────────────────────────────
// 11 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerCacheIPC(
) {


  // ── Cache Explorer API (JVS-35) ───────────────────────────────────────
  ipcMain.handle('cache:explore', async () => {
    try {
      const result = exploreCache();
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:entry-detail', async (_e, namespace: string, key: string) => {
    try {
      const detail = getCacheEntryDetail(namespace, key);
      return { success: true, detail };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:keys-paginated', async (_e, namespace: string, limit?: number, offset?: number) => {
    try {
      const result = getCacheKeys(namespace, limit || 100, offset || 0);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Sentiment Dashboard API (JVS-36) ──────────────────────────────────


  // ── Smart Cache Manager (JVS-32) ──────────────────────────────────────
  ipcMain.handle('cache:get', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      const value = cache.get(key);
      return { success: true, value, hit: value !== undefined };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:set', async (_e, namespace: string, key: string, value: any, ttl?: number) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      cache.set(key, value, ttl);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:has', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, exists: cache.has(key) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:delete', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, deleted: cache.delete(key) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:clear', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        manager.clearNamespace(namespace);
      } else {
        manager.clearAll();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        return { success: true, stats: cache.getStats() };
      } else {
        return { success: true, stats: manager.getAllStats() };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:reset-stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        cache.resetStats();
      } else {
        manager.resetAllStats();
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('cache:keys', async (_e, namespace: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, keys: cache.keys() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Dragon Tiger Stream (JVS-22 PM) ─────────────────────────────────────

}
