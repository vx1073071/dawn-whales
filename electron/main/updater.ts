// ── DAWN WHALES — Auto-Updater (R92 J-02 Enhanced) ─────────────────────────
// Full electron-updater integration with:
//   - Download progress tracking
//   - Version comparison & changelog
//   - Incremental/differential updates (via electron-updater's built-in delta)
//   - IPC bridge for renderer UI
//   - Update state machine: idle → checking → available → downloading → ready → installing
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  downloadProgress: number;      // 0–100
  downloadSpeed: number;         // bytes/sec
  releaseNotes: string | null;
  error: string | null;
  lastChecked: number | null;    // timestamp
  canInstall: boolean;
}

// ── State ──────────────────────────────────────────────────────────────────

let currentState: UpdateState = 'idle';
let latestVersion: string | null = null;
let releaseNotes: string | null = null;
let downloadProgress = 0;
let downloadSpeed = 0;
let errorMsg: string | null = null;
let lastChecked: number | null = null;
let updateInfo: UpdateInfo | null = null;

function getStatus(): UpdateStatus {
  return {
    state: currentState,
    currentVersion: autoUpdater.currentVersion?.version ?? '0.0.0',
    latestVersion,
    downloadProgress,
    downloadSpeed,
    releaseNotes,
    error: errorMsg,
    lastChecked,
    canInstall: currentState === 'downloaded',
  };
}

function notifyRenderer(mainWindowRef: { current: BrowserWindow | null }): void {
  const status = getStatus();
  mainWindowRef.current?.webContents.send('update:status', status);
}

// ── Auto-Updater Setup ─────────────────────────────────────────────────────

export function setupAutoUpdater(
  isDev: boolean,
  mainWindowRef: { current: BrowserWindow | null },
): void {
  // Configure updater
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Enable differential/ incremental downloads when available
  // electron-updater handles this automatically via blockmap files
  autoUpdater.allowDowngrade = false;

  // ── Event Handlers ────────────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    currentState = 'checking';
    errorMsg = null;
    log.info('[Updater] Checking for updates...');
    notifyRenderer(mainWindowRef);
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    currentState = 'available';
    latestVersion = info.version;
    updateInfo = info;
    releaseNotes = typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map(r => r.note || '').join('\n')
        : null;
    lastChecked = Date.now();
    log.info('[Updater] Update available:', info.version);
    notifyRenderer(mainWindowRef);
  });

  autoUpdater.on('update-not-available', () => {
    currentState = 'not-available';
    latestVersion = null;
    lastChecked = Date.now();
    log.info('[Updater] Already on latest version');
    notifyRenderer(mainWindowRef);
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    currentState = 'downloading';
    downloadProgress = Math.round(progress.percent);
    downloadSpeed = progress.bytesPerSecond;
    notifyRenderer(mainWindowRef);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    currentState = 'downloaded';
    downloadProgress = 100;
    latestVersion = info.version;
    log.info('[Updater] Update downloaded:', info.version, '— ready to install');
    notifyRenderer(mainWindowRef);
  });

  autoUpdater.on('error', (err: Error) => {
    currentState = 'error';
    errorMsg = err.message;
    log.warn('[Updater] Error:', err.message);
    notifyRenderer(mainWindowRef);
  });

  // ── IPC Handlers ──────────────────────────────────────────────────────────

  ipcMain.handle('update:get-status', () => getStatus());

  ipcMain.handle('update:check', async () => {
    if (isDev) {
      return { success: false, reason: 'dev-mode', message: 'Auto-update disabled in development mode' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateAvailable: !!result?.updateInfo };
    } catch (err) {
      return { success: false, reason: 'check-failed', message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('update:download', async () => {
    if (isDev) return { success: false, reason: 'dev-mode' };
    if (currentState !== 'available') {
      return { success: false, reason: 'no-update', message: 'No update available to download' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, reason: 'download-failed', message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('update:install', async () => {
    if (currentState !== 'downloaded') {
      return { success: false, reason: 'not-ready', message: 'Update not downloaded yet' };
    }
    // Quit and install
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  });

  ipcMain.handle('update:dismiss', async () => {
    currentState = 'idle';
    downloadProgress = 0;
    errorMsg = null;
    notifyRenderer(mainWindowRef);
    return { success: true };
  });

  // ── Scheduled Checks ──────────────────────────────────────────────────────

  if (!isDev) {
    // First check: 10s after launch
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: unknown) => {
        log.warn('[Updater] Scheduled check failed:', err instanceof Error ? err.message : String(err));
      });
    }, 10_000);

    // Recurring: every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((err: unknown) => {
        log.warn('[Updater] Scheduled check failed:', err instanceof Error ? err.message : String(err));
      });
    }, 4 * 60 * 60 * 1000);
  }

  log.info('[Updater] Auto-updater configured (dev=%s, channel=%s)', isDev, autoUpdater.channel || 'latest');
}
