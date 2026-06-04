// ── DAWN WHALES IPC: app ────────────────────────────────────────────
// 10 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerAppIPC(
  mainWindow: any,
  strategyEngine: any
) {


  // ── App ─────────────────────────────────────────────────────────────
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



  ipcMain.handle('app:exportPdf', async (_e, filename: string) => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: 'Window not available' };
      }
      const { dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');

      const defaultPath = path.join(require('os').homedir(), 'Downloads', filename);
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { success: false, error: 'User cancelled' };

      const data = await mainWindow.webContents.printToPDF({
        marginsType: 1,
        pageSize: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      fs.writeFileSync(filePath, data);
      return { success: true, path: filePath };
    } catch (err: any) {
      log.error('[App] PDF export failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('app:emergencyStop', async () => {
    try {
      log.warn('[App] Emergency stop triggered');
      // Stop all live strategies
      const strategies = strategyEngine?.getAllStrategies() || [];
      for (const s of strategies) {
        if (s.liveRunning) {
          strategyEngine?.stopLive(s.id);
        }
      }
      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification', {
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
  const ALLOWED_PROTOCOLS = ['http:', 'https:'];

  ipcMain.handle('app:openExternal', async (_e, rawUrl: string) => {
    const vErr = validate(Z.object({ rawUrl: z.string().url() }), { rawUrl });
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

  // ── Greeks Calculation (P0-fixed: pure JS Black-Scholes, no Python subprocess) ─

}
