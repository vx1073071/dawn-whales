// ── IPC Handlers — App ──────────────────────────────────────────────────────
// app:* 相关的 IPC handlers
// 从 main.ts 拆分出来，7个 handlers

import { ipcMain, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { shared, validate } from './_import-shared';
import log from 'electron-log';
import { z } from 'zod';

// External URL security whitelist
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function registerAppHandlers() {
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    name: 'DAWN WHALES',
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
  }));

  ipcMain.handle('app:getMemoryUsage', () => ({
    mainProcess: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    total: Math.round(process.memoryUsage().rss / 1024 / 1024),
  }));

  ipcMain.handle('app:emergencyStop', async () => {
    try {
      log.warn('[App] Emergency stop triggered');
      // Stop all live strategies
      const strategies = shared.strategyEngine?.getAllStrategies() || [];
      for (const s of strategies) {
        if (s.liveRunning) {
          shared.strategyEngine?.stopLive(s.id);
        }
      }
      // Notify renderer
      if (shared.mainWindow && !shared.mainWindow.isDestroyed()) {
        shared.mainWindow.webContents.send('notification', {
          type: 'error',
          title: '紧急停止',
          message: '所有策略已停止',
        });
      }
      return { success: true };
    } catch (err: any) {
      log.error('[App] Emergency stop failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── External URL Security ────────────────────────────────────────────
  ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
    const vErr = validate(z.object({ rawUrl: z.string().url() }), { rawUrl });
    if (vErr) return vErr;
    try {
      const url = new URL(rawUrl);
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        log.warn('[Security] Blocked openExternal:', rawUrl);
        return { success: false, error: 'Protocol not allowed' };
      }
      await shell.openExternal(rawUrl);
      return { success: true };
    } catch {
      return { success: false, error: 'Invalid URL' };
    }
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);

  // ── Auto-updater ──────────────────────────────────────────────────
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version || null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:downloadUpdate', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.quitAndInstall();
  });
}
