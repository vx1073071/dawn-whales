// ── DAWN WHALES IPC: system ────────────────────────────────────────────
// Auto-split from main.ts — 1 handlers
//
// Registered channels:
//   system:opend-health

import { ipcMain, BrowserWindow } from 'electron';

/**
 * Register all system IPC handlers
 *
 */
export function registerSystemIPC(
  
) {

  // ── system:opend-health ───────────────────────────────────────────────
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
