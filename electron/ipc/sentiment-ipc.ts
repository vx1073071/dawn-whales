// ── DAWN WHALES IPC: sentiment ────────────────────────────────────────────
// Auto-split from main.ts — 8 handlers
//
// Registered channels:
//   sentiment:attribution
//   sentiment:stream-start
//   sentiment:stream-stop
//   sentiment:stream-status
//   sentiment:stream-history
//   sentiment:stream-alerts
//   sentiment:stream-clear-alerts
//   sentiment:dashboard

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { getRealtimeSentimentStream } from './engine/sentiment-stream';
import { getSentimentDashboard } from './engine/sentiment-dashboard';

/**
 * Register all sentiment IPC handlers
 *
 * @param mainWindow - service reference
 */
export function registerSentimentIPC(
  mainWindow: any
) {

  // ── sentiment:attribution ───────────────────────────────────────────────
  ipcMain.handle('sentiment:attribution', async (_e, params: any) => {
    try {
      const result = sentimentAttrEngine.attributeSentiment(params);
      return { success: true, result };
    } catch (err: any) {
      log.error('[SentimentAttr] Error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-start ───────────────────────────────────────────────
  // ── Realtime Sentiment Stream (JVS-33) ─────────────────────────────────
  ipcMain.handle('sentiment:stream-start', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.start();

      // Forward ticks to renderer
      stream.on('tick', (tick) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-tick', tick);
        }
      });

      // Forward alerts to renderer
      stream.on('alert', (alert) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sentiment:stream-alert', alert);
        }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-stop ───────────────────────────────────────────────
  ipcMain.handle('sentiment:stream-stop', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-status ───────────────────────────────────────────────
  ipcMain.handle('sentiment:stream-status', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const current = stream.getCurrentSentiment();
      return { success: true, current };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-history ───────────────────────────────────────────────
  ipcMain.handle('sentiment:stream-history', async (_e, limit?: number) => {
    try {
      const stream = getRealtimeSentimentStream();
      const history = stream.getHistory();
      const limited = limit ? history.slice(-limit) : history;
      return { success: true, history: limited };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-alerts ───────────────────────────────────────────────
  ipcMain.handle('sentiment:stream-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      const alerts = stream.getAlerts();
      return { success: true, alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:stream-clear-alerts ───────────────────────────────────────────────
  ipcMain.handle('sentiment:stream-clear-alerts', async () => {
    try {
      const stream = getRealtimeSentimentStream();
      stream.clearAlerts();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── sentiment:dashboard ───────────────────────────────────────────────
  // ── Sentiment Dashboard API (JVS-36) ──────────────────────────────────
  ipcMain.handle('sentiment:dashboard', async () => {
    try {
      const dashboard = getSentimentDashboard();
      return { success: true, dashboard };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
