// ── DAWN WHALES IPC: cache ────────────────────────────────────────────
// Auto-split from main.ts — 11 handlers
//
// Registered channels:
//   cache:explore
//   cache:entry-detail
//   cache:keys-paginated
//   cache:get
//   cache:set
//   cache:has
//   cache:delete
//   cache:clear
//   cache:stats
//   cache:reset-stats
//   cache:keys

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { exploreCache, getCacheEntryDetail, getCacheKeys } from './engine/cache-explorer';
import { getSmartCacheManager } from './engine/smart-cache';

/**
 * Register all cache IPC handlers
 *
 */
export function registerCacheIPC(
  
) {

  // ── cache:explore ───────────────────────────────────────────────
  // ── Cache Explorer API (JVS-35) ───────────────────────────────────────
  ipcMain.handle('cache:explore', async () => {
    try {
      const result = exploreCache();
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:entry-detail ───────────────────────────────────────────────
  ipcMain.handle('cache:entry-detail', async (_e, namespace: string, key: string) => {
    try {
      const detail = getCacheEntryDetail(namespace, key);
      return { success: true, detail };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:keys-paginated ───────────────────────────────────────────────
  ipcMain.handle('cache:keys-paginated', async (_e, namespace: string, limit?: number, offset?: number) => {
    try {
      const result = getCacheKeys(namespace, limit || 100, offset || 0);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:get ───────────────────────────────────────────────
  // ── Smart Cache Manager (JVS-32) ──────────────────────────────────────
  ipcMain.handle('cache:get', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      const value = cache.get(key);
      return { success: true, value, hit: value !== undefined };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:set ───────────────────────────────────────────────
  ipcMain.handle('cache:set', async (_e, namespace: string, key: string, value: any, ttl?: number) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      cache.set(key, value, ttl);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:has ───────────────────────────────────────────────
  ipcMain.handle('cache:has', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, exists: cache.has(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:delete ───────────────────────────────────────────────
  ipcMain.handle('cache:delete', async (_e, namespace: string, key: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, deleted: cache.delete(key) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:clear ───────────────────────────────────────────────
  ipcMain.handle('cache:clear', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        manager.clearNamespace(namespace);
      } else {
        manager.clearAll();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:stats ───────────────────────────────────────────────
  ipcMain.handle('cache:stats', async (_e, namespace?: string) => {
    try {
      const manager = getSmartCacheManager();
      if (namespace) {
        const cache = manager.getCache(namespace);
        return { success: true, stats: cache.getStats() };
      } else {
        return { success: true, stats: manager.getAllStats() };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:reset-stats ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── cache:keys ───────────────────────────────────────────────
  ipcMain.handle('cache:keys', async (_e, namespace: string) => {
    try {
      const manager = getSmartCacheManager();
      const cache = manager.getCache(namespace);
      return { success: true, keys: cache.keys() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
