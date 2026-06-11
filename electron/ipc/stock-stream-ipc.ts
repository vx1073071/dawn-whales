/**
 * Stock Stream IPC — OpenD Real-time Market Data
 *
 * Registers Electron IPC handlers for stock-stream channels.
 * Channels: stock-stream:connect, stock-stream:disconnect,
 * stock-stream:get-quotes, stock-stream:status
 */

import { ipcMain, BrowserWindow } from 'electron';

import log from 'electron-log';
import { EngineError } from './engine/core/engine-error';


let connected = false;

export function registerStockStreamIPC(): void {
  log.info('[stock-stream-ipc] Registering IPC handlers');

  // ---- stock-stream:connect ----
  ipcMain.handle('stock-stream:connect', async (_event, config?: { url?: string; codes?: string[] }) => {
    try {
      log.info(`[stock-stream-ipc] connect: url=${config?.url}, codes=${config?.codes?.length ?? 0}`);
      connected = true;
      return { success: true, connected };
    } catch (err: any) {
      log.error('[stock-stream-ipc] connect error:', err);
      return { success: false, error: err.message };
    }
  });

  // ---- stock-stream:disconnect ----
  ipcMain.handle('stock-stream:disconnect', async () => {
    try {
      connected = false;
      return { success: true };
    } catch (err: any) {
      log.error('[stock-stream-ipc] disconnect error:', err);
      return { success: false, error: err.message };
    }
  });

  // ---- stock-stream:get-quotes ----
  ipcMain.handle('stock-stream:get-quotes', async (_event, codes: string[]) => {
    try {
      log.info(`[stock-stream-ipc] get-quotes: codes=${codes?.length ?? 0}`);
      // Return empty array as stub — real implementation depends on OpenD or push service
      return [];
    } catch (err: any) {
      log.error('[stock-stream-ipc] get-quotes error:', err);
      return [];
    }
  });

  // ---- stock-stream:status ----
  ipcMain.handle('stock-stream:status', async () => {
    return {
      connected,
      mode: 'websocket' as const,
      lastUpdate: Date.now(),
    };
  });
}
