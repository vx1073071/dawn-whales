// ── IPC Handlers — Greeks ───────────────────────────────────────────────────
// greeks:* 相关的 IPC handlers
// 从 main.ts 拆分出来，2个 handlers

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import log from 'electron-log';
import { validate, GreeksCalculateSchema, GreeksPortfolioSchema } from '../ipc-schemas';

const execAsync = promisify(exec);

export function registerGreeksHandlers() {
  // ── Greeks Calculation (WP5: Python subprocess) ─────────────────────
  ipcMain.handle('greeks:calculate', async (_e, params: {
    spot: number; strike: number; vol: number; days: number;
    rate?: number; type: 'CALL' | 'PUT'; qty?: number;
  }) => {
    const vErr = validate(GreeksCalculateSchema, { params });
    if (vErr) return vErr;
    try {
      const scriptPath = path.join(
        process.resourcesPath, '..', '..', '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      // Fallback for dev mode
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'calc_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      const actualScript = fs.existsSync(scriptPath) ? scriptPath : devPath;
      if (!fs.existsSync(actualScript)) {
        return { success: false, error: 'option-greeks script not found' };
      }

      const cmd = `"${pythonExe}" "${actualScript}" --spot ${params.spot} --strike ${params.strike} --vol ${params.vol} --days ${params.days} --type ${params.type} --rate ${params.rate || 0.05} --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 5000 });
      const result = JSON.parse(stdout);
      return { success: true, greeks: result };
    } catch (err: any) {
      log.error('[Greeks] Calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('greeks:portfolio', async (_e, positions: any[]) => {
    const vErr = validate(GreeksPortfolioSchema, { positions });
    if (vErr) return vErr;
    try {
      const devPath = path.join(
        require('os').homedir(), '.workbuddy', 'skills', 'option-greeks', 'scripts', 'portfolio_greeks.py'
      );
      const pythonExe = path.join(
        require('os').homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'
      );

      const fs = require('fs');
      if (!fs.existsSync(devPath)) {
        return { success: false, error: 'portfolio_greeks script not found' };
      }

      const positionsJson = JSON.stringify(positions).replace(/"/g, '\\"');
      const cmd = `"${pythonExe}" "${devPath}" --positions "${positionsJson}" --json`;
      const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 10000 });
      const result = JSON.parse(stdout);
      return { success: true, portfolio: result };
    } catch (err: any) {
      log.error('[Greeks] Portfolio calc failed:', err.message);
      return { success: false, error: err.message };
    }
  });
}
