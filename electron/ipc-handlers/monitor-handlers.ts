// -- IPC Handlers: monitor (10 handlers) --
// JVS-107: Smart Monitor

import { ipcMain, BrowserWindow } from 'electron';
import { shared } from './shared-imports';
import { SmartMonitor, AlertQuery, AlertRule } from '../engine/core/smart-monitor';
import log from 'electron-log';

// Singleton monitor instance
let monitor: SmartMonitor | null = null;

function getMonitor(): SmartMonitor {
  if (!monitor) {
    monitor = new SmartMonitor();
    log.info('[SmartMonitor] Instance created');
  }
  return monitor;
}

export function getMonitorInstance(): SmartMonitor {
  return getMonitor();
}

export function registerMonitorHandlers() {
  const m = getMonitor();

  // Forward alert events to renderer
  m.on('alert', (alert) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('monitor:alert-push', alert);
    }
  });

 // monitor:get-active
  ipcMain.handle('monitor:get-active', async () => {
    return { success: true, data: m.getActive() };
  });

 // monitor:get-critical
  ipcMain.handle('monitor:get-critical', async () => {
    return { success: true, data: m.getCritical() };
  });

 // monitor:query — query
  ipcMain.handle('monitor:query', async (_e, query: AlertQuery) => {
    return { success: true, data: m.query(query) };
  });

 // monitor:stats
  ipcMain.handle('monitor:stats', async () => {
    return { success: true, data: m.getStats() };
  });

 // monitor:acknowledge — confirm
  ipcMain.handle('monitor:acknowledge', async (_e, alertId: string) => {
    const result = m.acknowledge(alertId);
    return { success: !!result, data: result };
  });

 // monitor:acknowledge-all — confirm
  ipcMain.handle('monitor:acknowledge-all', async (_e, level?: string) => {
    const count = m.acknowledgeAll(level as any);
    return { success: true, data: { acknowledged: count } };
  });

 // monitor:resolve
  ipcMain.handle('monitor:resolve', async (_e, alertId: string) => {
    const result = m.resolve(alertId);
    return { success: !!result, data: result };
  });

 // monitor:suppress
  ipcMain.handle('monitor:suppress', async (_e, alertId: string) => {
    const result = m.suppress(alertId);
    return { success: !!result, data: result };
  });

 // monitor:get-rules — rule
  ipcMain.handle('monitor:get-rules', async () => {
    return { success: true, data: m.getRules() };
  });

 // monitor:update-rule — updaterule
  ipcMain.handle('monitor:update-rule', async (_e, ruleId: string, updates: Partial<AlertRule>) => {
    const result = m.updateRule(ruleId, updates);
    return { success: !!result, data: result };
  });

  log.info('[IPC] Monitor handlers registered (10 handlers)');
}
