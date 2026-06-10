// ── DAWN WHALES IPC: monte-carlo ───────────────────────────────────────────
// R18: MonteCarlo simulation IPC — connects MonteCarloPage to JVS-100 engine

import { ipcMain } from 'electron';
import log from 'electron-log';
import { MonteCarloSimulator, SimConfig } from '../engine/backtest/monte-carlo-simulator';

const simulator = new MonteCarloSimulator();

export function registerMonteCarloIPC() {
  ipcMain.handle('monte-carlo:simulate', async (_e, config: SimConfig) => {
    try {
      const result = simulator.simulate(config);
      return { success: true, result };
    } catch (err) {
      log.error('[MonteCarloIPC]', err);
      return { success: false, error: err.message };
    }
  });
}
