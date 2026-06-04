// ── IPC Handlers — Risk Engine ──────────────────────────────────────────────
// risk:* 相关的 IPC handlers
// 从 main.ts 拆分出来，7个 handlers

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { validate, RiskUpdateConfigSchema, RiskUpdateVixSchema } from '../ipc-schemas';

export function registerRiskHandlers() {
  ipcMain.handle('risk:getConfig', async () => {
    return { success: true, config: shared.riskEngine?.getConfig() };
  });

  ipcMain.handle('risk:updateConfig', async (_e, config: any) => {
    const vErr = validate(RiskUpdateConfigSchema, { config });
    if (vErr) return vErr;
    shared.riskEngine?.updateConfig(config);
    return { success: true };
  });

  ipcMain.handle('risk:getAlerts', async () => {
    return { success: true, alerts: shared.riskEngine?.getAlerts() || [] };
  });

  // v2: Risk engine status snapshot (for risk dashboard UI)
  ipcMain.handle('risk:getStatusSnapshot', async () => {
    if (!shared.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, snapshot: shared.riskEngine.getStatusSnapshot() };
  });

  ipcMain.handle('risk:getKellyStats', async () => {
    if (!shared.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, kelly: shared.riskEngine.getKellyStats() };
  });

  ipcMain.handle('risk:getDrawdownState', async () => {
    if (!shared.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    return { success: true, drawdown: shared.riskEngine.getDrawdownState() };
  });

  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    const vErr = validate(RiskUpdateVixSchema, { vix });
    if (vErr) return vErr;
    if (!shared.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
    shared.riskEngine.updateVix(vix);
    return { success: true };
  });
}
