// -- IPC Handlers: risk (7 handlers) --

import { ipcMain } from 'electron';
import { shared } from './_import-shared';

export function registerRiskHandlers() {

  ipcMain.handle('risk:getConfig', async () => {
      return { success: true, config: shared.riskEngine?.getConfig() };
    });


  ipcMain.handle('risk:updateConfig', async (_e, config: any) => {
      shared.riskEngine?.updateConfig(config);
      return { success: true };
    });


  ipcMain.handle('risk:getAlerts', async () => {
      return { success: true, alerts: shared.riskEngine?.getAlerts() || [] };
    });


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
      if (!shared.riskEngine) return { success: false, error: 'RiskEngine not initialized' };
      shared.riskEngine.updateVix(vix);
      return { success: true };
    });

}
