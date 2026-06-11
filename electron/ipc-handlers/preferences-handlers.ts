// -- IPC Handlers: preferences (10 handlers) --
// JVS-108: User Preferences

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { PreferencesManager } from '../engine/analysis/user-preferences';
import log from 'electron-log';
import i18n from '../i18n/main-i18n';

let prefsManager: PreferencesManager | null = null;

function getPrefs(): PreferencesManager {
  if (!prefsManager) {
    prefsManager = new PreferencesManager();
    prefsManager.initialize();
    log.info('[Preferences] Manager initialized');
  }
  return prefsManager;
}

export function getPrefsManager(): PreferencesManager {
  return getPrefs();
}

export function registerPreferencesHandlers() {
  const p = getPrefs();

 // prefs:get-all — settings
  ipcMain.handle('prefs:get-all', async () => {
    return { success: true, data: p.getAll() };
  });

 // prefs:get-section — settings
  ipcMain.handle('prefs:get-section', async (_e, section: string) => {
    const data = p.getSection(section as any);
    return { success: true, data };
  });

 // prefs:get — settings
  ipcMain.handle('prefs:get', async (_e, section: string, key: string) => {
    const value = p.get(section as any, key);
    return { success: true, data: { section, key, value } };
  });

 // prefs:set — settings
  ipcMain.handle('prefs:set', async (_e, section: string, key: string, value: unknown) => {
    const ok = p.set(section as any, key, value);
    return { success: ok };
  });

 // prefs:set-section — settings
  ipcMain.handle('prefs:set-section', async (_e, section: string, data: unknown) => {
    const ok = p.setSection(section as any, data);
    return { success: ok };
  });

 // prefs:reset — resetdefault
  ipcMain.handle('prefs:reset', async (_e, section?: string) => {
    const ok = p.reset(section as any);
    return { success: ok, data: p.getAll() };
  });

 // prefs:export — exportconfig
  ipcMain.handle('prefs:export', async (_e, filePath?: string) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!filePath && win) {
        const { filePath: chosen, canceled } = await dialog.showSaveDialog(win, {
          title: i18n.t('preferencesHandlers.k1'),
          defaultPath: `dawn-whales-prefs-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !chosen) return { success: false, error: i18n.t('preferencesHandlers.k2') };
        filePath = chosen;
      }
      const outPath = p.exportToFile(filePath);
      return { success: true, data: { filePath: outPath } };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      return { success: false, error: err.message };
    }
  });

 // prefs:import — importconfig
  ipcMain.handle('prefs:import', async (_e, filePath?: string) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!filePath && win) {
        const { filePaths, canceled } = await dialog.showOpenDialog(win, {
          title: i18n.t('preferencesHandlers.k3'),
          filters: [{ name: 'JSON', extensions: ['json'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) return { success: false, error: i18n.t('preferencesHandlers.k4') };
        filePath = filePaths[0];
      }
      if (!filePath) return { success: false, error: 'No file specified' };
      const result = p.importFromFile(filePath);
      return { success: result.success, data: result.success ? p.getAll() : undefined, error: result.error };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      return { success: false, error: err.message };
    }
  });

 // prefs:custom-set — settings
  ipcMain.handle('prefs:custom-set', async (_e, key: string, value: unknown) => {
    p.setCustom(key, value);
    return { success: true };
  });

 // prefs:custom-get
  ipcMain.handle('prefs:custom-get', async (_e, key: string) => {
    const value = p.getCustom(key);
    return { success: true, data: { key, value } };
  });

  log.info('[IPC] Preferences handlers registered (10 handlers)');
}
