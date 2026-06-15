// ── R226 auto#1 1.3a: Factor Signal IPC Bridge ──────────────────────────
// Bridges factor-signal-pipeline (Electron main) → Renderer (UI)
// Completes data link 4: engine → UI
//
// Connects: FactorSignalPipeline (engine/EventEmitter) → IPC → Renderer
// Protocol: ipcMain.emit('factor:signal', ...) → ipcRenderer.on('factor:signal', ...)

import { ipcMain, BrowserWindow } from 'electron';
import { getSignalPipeline, type FactorSignal } from '../factors/factor-signal-pipeline';

// ── IPC Channel Registry ─────────────────────────────────────────────────

export const FACTOR_SIGNAL_IPC_CHANNELS = {
  SIGNAL_EMIT: 'factor:signal',
  SIGNAL_BATCH: 'factor:signal-batch',
  SIGNAL_REQUEST: 'factor:signal-request',
  PIPELINE_STATUS: 'factor:pipeline-status',
} as const;

// ── Bridge ───────────────────────────────────────────────────────────────

let _bridgeInitialized = false;

export function initializeFactorSignalBridge(): void {
  if (_bridgeInitialized) return;

  const pipeline = getSignalPipeline();
  if (!pipeline) {
    console.warn('[R226] FactorSignalBridge: pipeline not available, skipping bridge init');
    return;
  }

  // Bridge signal events to all renderer windows
  pipeline.on('signal', (signal: FactorSignal) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(FACTOR_SIGNAL_IPC_CHANNELS.SIGNAL_EMIT, signal);
      }
    });
  });

  pipeline.on('signal:batch', (signals: FactorSignal[]) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(FACTOR_SIGNAL_IPC_CHANNELS.SIGNAL_BATCH, signals);
      }
    });
  });

  // IPC handler: renderer can request latest signals
  ipcMain.handle(FACTOR_SIGNAL_IPC_CHANNELS.SIGNAL_REQUEST, async (_event, factorId?: string) => {
    return pipeline.getRecentSignals(factorId);
  });

  // IPC handler: pipeline status
  ipcMain.handle(FACTOR_SIGNAL_IPC_CHANNELS.PIPELINE_STATUS, async () => {
    return pipeline.getStatus();
  });

  _bridgeInitialized = true;
  console.log('[R226] FactorSignalBridge: initialized — factor→UI data link #4 ONLINE');
}

export function isFactorSignalBridgeReady(): boolean {
  return _bridgeInitialized;
}
