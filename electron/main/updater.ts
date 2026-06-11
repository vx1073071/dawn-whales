// ── DAWN WHALES — Auto-Updater Setup ───────────────────────────────────────
import { BrowserWindow } from 'electron';

import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import i18n from '../../src/i18n';

/**
 * Configure and start the auto-updater.
 * Only active in production (non-dev) builds.
 * Checks for updates 10s after call, then every 4 hours.
 */
export function setupAutoUpdater(
  isDev: boolean,
  mainWindowRef: { current: BrowserWindow | null },
): void {
  if (isDev) return;

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] New version available:', info.version);
    mainWindowRef.current?.webContents.send('notification', {
      type: 'info',
      message: `新版本 ${info.version} 可用，请在设置中更新`,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    log.info('[Updater] Update downloaded, ready to install');
    mainWindowRef.current?.webContents.send('notification', {
      type: 'success',
      message: i18n.t('Updater.k0'),
    });
  });

  autoUpdater.on('error', (err) => {
    log.warn('[Updater] Error:', err.message);
  });

  // Check for updates 10s after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdates().catch((_: unknown) => {}), 10000);
  setInterval(() => autoUpdater.checkForUpdates().catch((_: unknown) => {}), 4 * 60 * 60 * 1000);
}
