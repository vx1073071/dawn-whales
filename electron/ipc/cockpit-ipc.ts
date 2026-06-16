/**
 * QUANT MOO — R253 ML#1: Cockpit IPC handlers
 *
 * Provides IPC bridge for the TodayCockpit dashboard:
 *   - cockpit:getState — returns full aggregated cockpit state
 *   - cockpit:getWatchlist — returns user watchlist with live prices
 *   - cockpit:subscribe — WebSocket subscription for live updates
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { getCockpitAggregator, CockpitState } from '../../server/services/CockpitAggregator';

export function registerCockpitIPC(getWin: () => BrowserWindow | null) {
  // ── cockpit:getState ──────────────────────────────────────────────────
  ipcMain.handle('cockpit:getState', async (): Promise<{ success: boolean; state?: CockpitState; error?: string }> => {
    try {
      const aggregator = getCockpitAggregator();
      const state = await aggregator.getFullState();
      return { success: true, state };
    } catch (err: any) {
      log.error('[cockpit:getState]', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  // ── cockpit:getWatchlist ────────────────────────────────────────────
  ipcMain.handle('cockpit:getWatchlist', async () => {
    try {
      const aggregator = getCockpitAggregator();
      const state = await aggregator.getFullState();
      return { success: true, watchlist: state.watchlist };
    } catch (err: any) {
      log.error('[cockpit:getWatchlist]', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  // ── cockpit:subscribe — push updates via WebContents ──────────────────
  // Stores active subscription state; actual push happens from main process
  let subscribed = false;
  let pushInterval: ReturnType<typeof setInterval> | null = null;

  ipcMain.handle('cockpit:subscribe', async (_event, params?: { intervalMs?: number }) => {
    try {
      const win = getWin();
      if (!win) return { success: false, error: 'No window available' };

      subscribed = true;
      const interval = params?.intervalMs || 30000; // default 30s

      // Clear existing interval
      if (pushInterval) clearInterval(pushInterval);

      // Set up periodic push
      pushInterval = setInterval(async () => {
        if (!subscribed || win.isDestroyed()) {
          if (pushInterval) clearInterval(pushInterval);
          return;
        }
        try {
          const aggregator = getCockpitAggregator();
          const state = await aggregator.getFullState();
          win.webContents.send('cockpit:update', state);
        } catch (err: any) {
          log.error('[cockpit:subscribe push]', err);
        }
      }, interval);

      // Send initial state immediately
      const aggregator = getCockpitAggregator();
      const state = await aggregator.getFullState();
      win.webContents.send('cockpit:update', state);

      return { success: true, subscribed: true, interval };
    } catch (err: any) {
      log.error('[cockpit:subscribe]', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  // ── cockpit:unsubscribe ────────────────────────────────────────────────
  ipcMain.handle('cockpit:unsubscribe', async () => {
    subscribed = false;
    if (pushInterval) {
      clearInterval(pushInterval);
      pushInterval = null;
    }
    return { success: true };
  });
}
