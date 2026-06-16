// ── QUANT MOO — Server Client IPC (R129 M-01) ─────────────────────────
// IPC handlers for server-client communication (desktop ↔ server).

import { ipcMain } from 'electron';
import { getServerClient, ServerStatus } from '../server-client';
import { getKey, storeKey, deleteKey } from '../utils/secure-key';

const SERVER_API_KEY_NAME = 'DAWN_WHALES_SERVER_API_KEY';

export function registerServerIPC(app: Electron.App): void {
  const client = getServerClient();

  // ── server:connect ──────────────────────────────────────────────────
  ipcMain.handle('server:connect', async (_event, serverUrl: string, apiKey: string) => {
    try {
      const status = await client.connect(serverUrl, apiKey);
      return { success: true, status };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── server:disconnect ───────────────────────────────────────────────
  ipcMain.handle('server:disconnect', async () => {
    client.disconnect();
    return { success: true };
  });

  // ── server:getStatus ────────────────────────────────────────────────
  ipcMain.handle('server:getStatus', async (): Promise<ServerStatus> => {
    return client.getStatus();
  });

  // ── server:testConnection ───────────────────────────────────────────
  ipcMain.handle('server:testConnection', async (_event, serverUrl: string, apiKey: string) => {
    return client.testConnection(serverUrl, apiKey);
  });

  // ── server:sendSignal ───────────────────────────────────────────────
  ipcMain.handle('server:sendSignal', async (_event, signal: unknown) => {
    return client.sendSignal(signal as any);
  });

  // ── server:saveApiKey ───────────────────────────────────────────────
  ipcMain.handle('server:saveApiKey', async (_event, key: string) => {
    const ok = storeKey(app, SERVER_API_KEY_NAME, key);
    return { success: ok };
  });

  // ── server:getApiKey ────────────────────────────────────────────────
  ipcMain.handle('server:getApiKey', async () => {
    try {
      const key = getKey(app, SERVER_API_KEY_NAME);
      // Don't send full key to renderer — just mask it
      if (key) return { hasKey: true, preview: maskKey(key) };
      return { hasKey: false, preview: '' };
    } catch {
      return { hasKey: false, preview: '' };
    }
  });

  // ── server:deleteApiKey ─────────────────────────────────────────────
  ipcMain.handle('server:deleteApiKey', async () => {
    deleteKey(app, SERVER_API_KEY_NAME);
    return { success: true };
  });

  // ── server:onStatusChange ───────────────────────────────────────────
  // WebContents-based push: register the sender webContents for status updates
  const statusSubscribers = new Set<Electron.WebContents>();

  ipcMain.on('server:subscribeStatus', (event) => {
    statusSubscribers.add(event.sender);
    event.sender.on('destroyed', () => statusSubscribers.delete(event.sender));
  });

  ipcMain.on('server:unsubscribeStatus', (event) => {
    statusSubscribers.delete(event.sender);
  });

  client.onStatusChange((status) => {
    for (const wc of statusSubscribers) {
      try { wc.send('server:statusUpdate', status); } catch (_e) { /* ignore */ }
    }
  });
}

/** Mask API key for display: sk-xxxx...xxxx */
function maskKey(key: string): string {
  if (key.length <= 12) return '*'.repeat(key.length);
  return key.slice(0, 4) + '*'.repeat(Math.min(key.length - 8, 16)) + key.slice(-4);
}
