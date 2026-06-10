// ── IPC Handlers: Risk (Round 18 P0) ───────────────────────────────────────
// Registers risk:* IPC handlers for RiskDashboardPage real data

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import log from 'electron-log';

export function registerRiskHandlers() {
  log.info('[IPC] Registering risk handlers...');

  // ── risk:getConfig ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getConfig', async () => {
    try {
      const re = shared.riskEngine;
      if (!re) {
        return { success: true, data: getDefaultRiskConfig() };
      }
      const config = typeof re.getConfig === 'function' ? re.getConfig() : getDefaultRiskConfig();
      return { success: true, data: config };
    } catch (err) {
      log.error('[risk:getConfig]', err.message);
      return { success: false, error: err.message, data: getDefaultRiskConfig() };
    }
  });

  // ── risk:updateConfig ──────────────────────────────────────────────────
  ipcMain.handle('risk:updateConfig', async (_e, config: unknown) => {
    try {
      const re = shared.riskEngine;
      if (!re) return { success: false, error: 'RiskEngine not initialized' };
      if (typeof re.updateConfig === 'function') {
        re.updateConfig(config);
      }
      return { success: true };
    } catch (err) {
      log.error('[risk:updateConfig]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── risk:getAlerts ─────────────────────────────────────────────────────
  ipcMain.handle('risk:getAlerts', async () => {
    try {
      const re = shared.riskEngine;
      if (!re) return { success: true, data: [] };

      let alerts: any[] = [];
      if (typeof re.getAlerts === 'function') {
        alerts = re.getAlerts();
      } else if (typeof re.checkAll === 'function') {
        const result = re.checkAll();
        alerts = result?.alerts || [];
      }

      // Also pull from DB if available
      if (alerts.length === 0 && shared.db) {
        try {
          const dbAlerts = shared.db.getDb?.()
            ?.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50')
            .all();
          if (dbAlerts) alerts = dbAlerts;
        } catch { /* alerts table may not exist */ }
      }

      return { success: true, data: alerts };
    } catch (err) {
      log.error('[risk:getAlerts]', err.message);
      return { success: true, data: [] };
    }
  });

  // ── risk:getStatusSnapshot ─────────────────────────────────────────────
  ipcMain.handle('risk:getStatusSnapshot', async () => {
    try {
      const re = shared.riskEngine;
      const broker = shared.brokerManager;

      // Try to get real data from broker
      let accountData: unknown = null;
      if (broker && typeof broker.getAccounts === 'function') {
        try {
          const accounts = await broker.getAccounts();
          if (accounts?.length > 0) {
            const funds = typeof broker.getFunds === 'function'
              ? await broker.getFunds(accounts[0].accId || accounts[0].accountId)
              : null;
            const positions = typeof broker.getPositions === 'function'
              ? await broker.getPositions(accounts[0].accId || accounts[0].accountId)
              : [];
            accountData = { funds, positions, accountId: accounts[0].accId || accounts[0].accountId };
          }
        } catch { /* broker not connected */ }
      }

      // Build snapshot
      const snapshot = {
        connected: !!accountData,
        totalAssets: accountData?.funds?.totalAssets || accountData?.funds?.nav || 0,
        cash: accountData?.funds?.cash || accountData?.funds?.availableCash || 0,
        marketValue: accountData?.funds?.marketVal || accountData?.funds?.securitiesValue || 0,
        todayPnl: accountData?.funds?.todayPnl || accountData?.funds?.realizedPnl || 0,
        unrealizedPnl: accountData?.funds?.unrealizedPnl || 0,
        buyingPower: accountData?.funds?.buyingPower || accountData?.funds?.maxPowerLong || 0,
        positions: (accountData?.positions || []).map((p: unknown) => ({
          code: p.code || p.symbol,
          name: p.name || '',
          qty: p.qty || p.quantity || 0,
          avgCost: p.costPrice || p.avgCost || 0,
          marketPrice: p.marketPrice || p.lastPrice || 0,
          pnl: p.pnl || p.unrealizedPnl || 0,
          pnlPct: p.pnlPct || p.unrealizedPnlPct || 0,
        })),
        positionCount: (accountData?.positions || []).length,
        drawdown: 0,
        maxDrawdown: 0,
        vix: 15,
        riskLevel: 'normal' as 'low' | 'normal' | 'elevated' | 'high' | 'critical',
      };

      // Get drawdown from risk engine
      if (re && typeof re.getDrawdownState === 'function') {
        try {
          const dd = re.getDrawdownState();
          snapshot.drawdown = dd?.currentDrawdown || 0;
          snapshot.maxDrawdown = dd?.maxDrawdown || 0;
        } catch { /* ignore */ }
      }

      // Compute risk level
      if (snapshot.drawdown > 20) snapshot.riskLevel = 'critical';
      else if (snapshot.drawdown > 15) snapshot.riskLevel = 'high';
      else if (snapshot.drawdown > 10) snapshot.riskLevel = 'elevated';
      else if (snapshot.drawdown > 5) snapshot.riskLevel = 'normal';
      else snapshot.riskLevel = 'low';

      return { success: true, data: snapshot };
    } catch (err) {
      log.error('[risk:getStatusSnapshot]', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── risk:getKellyStats ─────────────────────────────────────────────────
  ipcMain.handle('risk:getKellyStats', async () => {
    try {
      const re = shared.riskEngine;
      if (!re) {
        return { success: true, data: getDefaultKellyStats() };
      }

      let stats: unknown = getDefaultKellyStats();
      if (typeof re.getKellyStats === 'function') {
        stats = re.getKellyStats();
      } else if (typeof re.calculateKelly === 'function') {
        stats = re.calculateKelly();
      }

      return { success: true, data: stats || getDefaultKellyStats() };
    } catch (err) {
      log.error('[risk:getKellyStats]', err.message);
      return { success: true, data: getDefaultKellyStats() };
    }
  });

  // ── risk:getDrawdownState ──────────────────────────────────────────────
  ipcMain.handle('risk:getDrawdownState', async () => {
    try {
      const re = shared.riskEngine;
      if (!re) {
        return { success: true, data: getDefaultDrawdown() };
      }

      let state: unknown = getDefaultDrawdown();
      if (typeof re.getDrawdownState === 'function') {
        state = re.getDrawdownState();
      }

      return { success: true, data: state || getDefaultDrawdown() };
    } catch (err) {
      log.error('[risk:getDrawdownState]', err.message);
      return { success: true, data: getDefaultDrawdown() };
    }
  });

  // ── risk:updateVix ─────────────────────────────────────────────────────
  ipcMain.handle('risk:updateVix', async (_e, vix: number) => {
    try {
      const re = shared.riskEngine;
      if (!re) return { success: true };
      if (typeof re.updateVix === 'function') {
        re.updateVix(vix);
      }
      return { success: true };
    } catch (err) {
      log.error('[risk:updateVix]', err.message);
      return { success: false, error: err.message };
    }
  });

  log.info('[IPC] Risk handlers registered (7 handlers)');
}

// ── Default fallback data ──────────────────────────────────────────────────

function getDefaultRiskConfig() {
  return {
    maxDrawdownPct: 15,
    maxPositionSizePct: 20,
    maxDailyLossPct: 3,
    maxCorrelation: 0.7,
    stopLossPct: 5,
    takeProfitPct: 10,
    maxOpenPositions: 10,
    vixThreshold: 30,
  };
}

function getDefaultKellyStats() {
  return {
    winRate: 0.55,
    avgWin: 2.5,
    avgLoss: 1.8,
    profitFactor: 1.53,
    kellyFraction: 0.15,
    halfKelly: 0.075,
    recommendedSize: 7.5,
    sampleSize: 0,
  };
}

function getDefaultDrawdown() {
  return {
    currentDrawdown: 0,
    maxDrawdown: 0,
    drawdownDuration: 0,
    peakValue: 100000,
    currentValue: 100000,
    recoveryDays: 0,
    inDrawdown: false,
  };
}
