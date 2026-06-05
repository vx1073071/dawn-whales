// -- IPC Handlers: monitor (10 handlers) --
// JVS-107: Smart Monitor

import { ipcMain, BrowserWindow } from 'electron';
import { shared } from './_import-shared';
import { SmartMonitor, AlertQuery, AlertRule } from '../engine/smart-monitor';
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

  // monitor:get-active — 获取所有活跃告警
  ipcMain.handle('monitor:get-active', async () => {
    return { success: true, data: m.getActive() };
  });

  // monitor:get-critical — 获取活跃的高级别告警
  ipcMain.handle('monitor:get-critical', async () => {
    return { success: true, data: m.getCritical() };
  });

  // monitor:query — 查询告警历史
  ipcMain.handle('monitor:query', async (_e, query: AlertQuery) => {
    return { success: true, data: m.query(query) };
  });

  // monitor:stats — 获取告警统计
  ipcMain.handle('monitor:stats', async () => {
    return { success: true, data: m.getStats() };
  });

  // monitor:acknowledge — 确认单个告警
  ipcMain.handle('monitor:acknowledge', async (_e, alertId: string) => {
    const result = m.acknowledge(alertId);
    return { success: !!result, data: result };
  });

  // monitor:acknowledge-all — 批量确认告警
  ipcMain.handle('monitor:acknowledge-all', async (_e, level?: string) => {
    const count = m.acknowledgeAll(level as any);
    return { success: true, data: { acknowledged: count } };
  });

  // monitor:resolve — 解决告警
  ipcMain.handle('monitor:resolve', async (_e, alertId: string) => {
    const result = m.resolve(alertId);
    return { success: !!result, data: result };
  });

  // monitor:suppress — 抑制告警
  ipcMain.handle('monitor:suppress', async (_e, alertId: string) => {
    const result = m.suppress(alertId);
    return { success: !!result, data: result };
  });

  // monitor:get-rules — 获取告警规则
  ipcMain.handle('monitor:get-rules', async () => {
    return { success: true, data: m.getRules() };
  });

  // monitor:update-rule — 更新告警规则
  ipcMain.handle('monitor:update-rule', async (_e, ruleId: string, updates: Partial<AlertRule>) => {
    const result = m.updateRule(ruleId, updates);
    return { success: !!result, data: result };
  });

  log.info('[IPC] Monitor handlers registered (10 handlers)');
}
