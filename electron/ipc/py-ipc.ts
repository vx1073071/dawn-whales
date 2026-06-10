// ── DAWN WHALES IPC: py ────────────────────────────────────────────
// 3 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerPyIPC(
) {


  // ── Python Script Proxy Layer (JVS-20) ──────────────────────────────────
  ipcMain.handle('py:call-skill', async (_e, skillName: string, query: string, options?: unknown) => {
    try {
      const proxy = getPythonProxy();
      const result = await proxy.callSkill(skillName, query, options);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('py:list-skills', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, skills: proxy.listAvailableSkills() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('py:proxy-status', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, status: proxy.getStatus() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Push2 Proxy Service (JVS-27) ─────────────────────────────────────────

}
