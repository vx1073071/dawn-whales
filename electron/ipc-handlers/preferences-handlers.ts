// -- IPC Handlers: preferences (10 handlers) --
// JVS-108: User Preferences

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { PreferencesManager } from '../engine/user-preferences';
import log from 'electron-log';

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

  // prefs:get-all — 获取全部偏好设置
  ipcMain.handle('prefs:get-all', async () => {
    return { success: true, data: p.getAll() };
  });

  // prefs:get-section — 获取某个分类的设置
  ipcMain.handle('prefs:get-section', async (_e, section: string) => {
    const data = p.getSection(section as any);
    return { success: true, data };
  });

  // prefs:get — 获取单个设置项
  ipcMain.handle('prefs:get', async (_e, section: string, key: string) => {
    const value = p.get(section as any, key);
    return { success: true, data: { section, key, value } };
  });

  // prefs:set — 设置单个项
  ipcMain.handle('prefs:set', async (_e, section: string, key: string, value: any) => {
    const ok = p.set(section as any, key, value);
    return { success: ok };
  });

  // prefs:set-section — 批量设置某个分类
  ipcMain.handle('prefs:set-section', async (_e, section: string, data: any) => {
    const ok = p.setSection(section as any, data);
    return { success: ok };
  });

  // prefs:reset — 重置为默认值
  ipcMain.handle('prefs:reset', async (_e, section?: string) => {
    const ok = p.reset(section as any);
    return { success: ok, data: p.getAll() };
  });

  // prefs:export — 导出配置文件
  ipcMain.handle('prefs:export', async (_e, filePath?: string) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!filePath && win) {
        const { filePath: chosen, canceled } = await dialog.showSaveDialog(win, {
          title: '导出配置',
          defaultPath: `dawn-whales-prefs-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !chosen) return { success: false, error: '用户取消' };
        filePath = chosen;
      }
      const outPath = p.exportToFile(filePath);
      return { success: true, data: { filePath: outPath } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // prefs:import — 导入配置文件
  ipcMain.handle('prefs:import', async (_e, filePath?: string) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!filePath && win) {
        const { filePaths, canceled } = await dialog.showOpenDialog(win, {
          title: '导入配置',
          filters: [{ name: 'JSON', extensions: ['json'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths.length) return { success: false, error: '用户取消' };
        filePath = filePaths[0];
      }
      if (!filePath) return { success: false, error: 'No file specified' };
      const result = p.importFromFile(filePath);
      return { success: result.success, data: result.success ? p.getAll() : undefined, error: result.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // prefs:custom-set — 设置自定义数据
  ipcMain.handle('prefs:custom-set', async (_e, key: string, value: any) => {
    p.setCustom(key, value);
    return { success: true };
  });

  // prefs:custom-get — 获取自定义数据
  ipcMain.handle('prefs:custom-get', async (_e, key: string) => {
    const value = p.getCustom(key);
    return { success: true, data: { key, value } };
  });

  log.info('[IPC] Preferences handlers registered (10 handlers)');
}
