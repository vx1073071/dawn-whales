// ── QUANT MOO IPC: system ────────────────────────────────────────────
// 1 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';
import { EngineError } from './engine/core/engine-error';


export function registerSystemIPC(
) {


  // ── Q19: OpenD Health Check ─────────────────────────────────
  ipcMain.handle('system:opend-health', async (_e, raw: unknown) => {
    try {
      const { runOpenDHealthCheck, pingOpenD } = require('./engine/opend-health-check');
      const req = raw as { action?: string; host?: string; port?: number };
      if (req?.action === 'ping') {
        const result = await pingOpenD(req.host ?? '127.0.0.1', req.port ?? 11111);
        return { success: true, ...result };
      }
      const result = await runOpenDHealthCheck(req as any);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Q18: Strategy Templates ─────────────────────────────────

}
