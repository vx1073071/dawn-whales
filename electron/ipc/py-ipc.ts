// ── DAWN WHALES IPC: py ────────────────────────────────────────────
// Auto-split from main.ts — 3 handlers
//
// Registered channels:
//   py:call-skill
//   py:list-skills
//   py:proxy-status

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { getPythonProxy } from './data/python-proxy';

/**
 * Register all py IPC handlers
 *
 */
export function registerPyIPC(
  
) {

  // ── py:call-skill ───────────────────────────────────────────────
  // ── Python Script Proxy Layer (JVS-20) ──────────────────────────────────
  ipcMain.handle('py:call-skill', async (_e, skillName: string, query: string, options?: any) => {
    try {
      const proxy = getPythonProxy();
      const result = await proxy.callSkill(skillName, query, options);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── py:list-skills ───────────────────────────────────────────────
  ipcMain.handle('py:list-skills', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, skills: proxy.listAvailableSkills() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── py:proxy-status ───────────────────────────────────────────────
  ipcMain.handle('py:proxy-status', async () => {
    try {
      const proxy = getPythonProxy();
      return { success: true, status: proxy.getStatus() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

}
