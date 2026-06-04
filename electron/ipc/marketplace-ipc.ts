// ── DAWN WHALES IPC: marketplace ────────────────────────────────────────────
// Auto-split from main.ts — 10 handlers
//
// Registered channels:
//   marketplace:rate
//   marketplace:getRating
//   marketplace:comment
//   marketplace:getComments
//   marketplace:savePerformance
//   marketplace:getPerformance
//   marketplace:list
//   marketplace:score
//   marketplace:verify
//   marketplace:updateAllScores

import { ipcMain, BrowserWindow } from 'electron';

// Auto-imported dependencies:
import { MarketplaceService } from './data/marketplace-service';

/**
 * Register all marketplace IPC handlers
 *
 * @param db - service reference
 * @param marketplaceService - service reference
 */
export function registerMarketplaceIPC(
  db: any,
  marketplaceService: any
) {

  // ── marketplace:rate ───────────────────────────────────────────────
  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
    const vErr = validate(MarketplaceRateSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.rateStrategy(strategyId, rating);
      const stats = db?.getStrategyRating(strategyId);
      return { success: true, ...stats };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── marketplace:getRating ───────────────────────────────────────────────
  ipcMain.handle('marketplace:getRating', async (_e, strategyId: string) => {
    const rating = db?.getStrategyRating(strategyId);
    const myRating = db?.getMyRating(strategyId);
    return { success: true, ...rating, myRating };
  });

  // ── marketplace:comment ───────────────────────────────────────────────
  ipcMain.handle('marketplace:comment', async (_e, strategyId: string, content: string, parentId?: number) => {
    const vErr = validate(MarketplaceCommentSchema, { strategyId });
    if (vErr) return vErr;
    try {
      db?.addComment(strategyId, content, parentId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── marketplace:getComments ───────────────────────────────────────────────
  ipcMain.handle('marketplace:getComments', async (_e, strategyId: string) => {
    const comments = db?.getComments(strategyId) || [];
    return { success: true, comments };
  });

  // ── marketplace:savePerformance ───────────────────────────────────────────────
  ipcMain.handle('marketplace:savePerformance', async (_e, data: any) => {
    const vErr = validate(MarketplaceSavePerformanceSchema, { data });
    if (vErr) return vErr;
    try {
      db?.saveStrategyPerformance(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── marketplace:getPerformance ───────────────────────────────────────────────
  ipcMain.handle('marketplace:getPerformance', async (_e, strategyId: string) => {
    const perf = db?.getStrategyPerformance(strategyId) || [];
    return { success: true, performance: perf };
  });

  // ── marketplace:list ───────────────────────────────────────────────
  ipcMain.handle('marketplace:list', async (_e, sortBy?: string, limit?: number) => {
    const strategies = db?.getMarketplaceStrategies(sortBy || 'rating', limit || 50) || [];
    return { success: true, strategies };
  });

  // ── marketplace:score ───────────────────────────────────────────────
  // ── Marketplace: Score & Verify (JVS) ─────────────────────────────────
  ipcMain.handle('marketplace:score', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const score = marketplaceService.calculateStrategyScore(strategyId);
      return { success: true, score };
    } catch (err: any) {
      log.error('[Marketplace] Score calculation failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── marketplace:verify ───────────────────────────────────────────────
  ipcMain.handle('marketplace:verify', async (_e, strategyId: string) => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const verification = marketplaceService.verifyPerformance(strategyId);
      return { success: true, verification };
    } catch (err: any) {
      log.error('[Marketplace] Verification failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ── marketplace:updateAllScores ───────────────────────────────────────────────
  ipcMain.handle('marketplace:updateAllScores', async () => {
    if (!marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
    try {
      const result = marketplaceService.updateAllScores();
      return { success: true, ...result };
    } catch (err: any) {
      log.error('[Marketplace] Batch update failed:', err.message);
      return { success: false, error: err.message };
    }
  });

}
