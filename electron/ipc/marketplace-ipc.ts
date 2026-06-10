// ── DAWN WHALES IPC: marketplace ────────────────────────────────────────────
// 10 handlers

import { ipcMain, BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { validate } from '../ipc-schemas';

export function registerMarketplaceIPC(
  db: any,
  marketplaceService: any
) {


  // ── Marketplace ───────────────────────────────────────────────────

  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
    const vErr = validate(MarketplaceRateSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.rateStrategy(strategyId, rating);
      const stats = db?.getStrategyRating(strategyId);
      return { success: true, ...stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('marketplace:getRating', async (_e, strategyId: string) => {
    const rating = db?.getStrategyRating(strategyId);
    const myRating = db?.getMyRating(strategyId);
    return { success: true, ...rating, myRating };
  });



  ipcMain.handle('marketplace:comment', async (_e, strategyId: string, content: string, parentId?: number) => {
    const vErr = validate(MarketplaceCommentSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.addComment(strategyId, content, parentId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('marketplace:getComments', async (_e, strategyId: string) => {
    const comments = db?.getComments(strategyId) || [];
    return { success: true, comments };
  });



  ipcMain.handle('marketplace:savePerformance', async (_e, data: any) => {
    const vErr = validate(MarketplaceSavePerformanceSchema, { data });
    if (vErr) return vErr;
    try {
      db?.saveStrategyPerformance(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('marketplace:getPerformance', async (_e, strategyId: string) => {
    const perf = db?.getStrategyPerformance(strategyId) || [];
    return { success: true, performance: perf };
  });



  ipcMain.handle('marketplace:list', async (_e, sortBy?: string, limit?: number) => {
    const strategies = db?.getMarketplaceStrategies(sortBy || 'rating', limit || 50) || [];
    return { success: true, strategies };
  });

  // ── Correlation Matrix (Q2: QClaw) ──────────────────────────────────


  // ── Marketplace: Score & Verify (JVS) ─────────────────────────────────
  ipcMain.handle('marketplace:score', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const score = marketplaceService.calculateStrategyScore(strategyId);
      return { success: true, score };
    } catch (err) {
      log.error('[Marketplace] Score calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('marketplace:verify', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const verification = marketplaceService.verifyPerformance(strategyId);
      return { success: true, verification };
    } catch (err) {
      log.error('[Marketplace] Verification failed:', err.message);
      return { success: false, error: err.message };
    }
  });



  ipcMain.handle('marketplace:updateAllScores', async () => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const result = marketplaceService.updateAllScores();
      return { success: true, ...result };
    } catch (err) {
      log.error('[Marketplace] Batch update failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Data Provider (multi-source integration) ───────────────────────────

}
