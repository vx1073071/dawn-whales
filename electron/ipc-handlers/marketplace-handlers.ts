// -- IPC Handlers: marketplace (10 handlers) --

import { ipcMain } from 'electron';
import { shared } from './_import-shared';
import { validate, MarketplaceRateSchema, MarketplaceCommentSchema, MarketplaceSavePerformanceSchema } from '../ipc-schemas';
import log from 'electron-log';

export function registerMarketplaceHandlers() {

  ipcMain.handle('marketplace:rate', async (_e, strategyId: string, rating: number) => {
      const vErr = validate(MarketplaceRateSchema, { strategyId });
      if (vErr) return vErr;
      try {
        shared.db?.rateStrategy(strategyId, rating);
        const stats = shared.db?.getStrategyRating(strategyId);
        return { success: true, ...stats };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('marketplace:getRating', async (_e, strategyId: string) => {
      const rating = shared.db?.getStrategyRating(strategyId);
      const myRating = shared.db?.getMyRating(strategyId);
      return { success: true, ...rating, myRating };
    });


  ipcMain.handle('marketplace:comment', async (_e, strategyId: string, content: string, parentId?: number) => {
      const vErr = validate(MarketplaceCommentSchema, { strategyId });
      if (vErr) return vErr;
      try {
        shared.db?.addComment(strategyId, content, parentId);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('marketplace:getComments', async (_e, strategyId: string) => {
      const comments = shared.db?.getComments(strategyId) || [];
      return { success: true, comments };
    });


  ipcMain.handle('marketplace:savePerformance', async (_e, data: any) => {
      const vErr = validate(MarketplaceSavePerformanceSchema, { data });
      if (vErr) return vErr;
      try {
        shared.db?.saveStrategyPerformance(data);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('marketplace:getPerformance', async (_e, strategyId: string) => {
      const perf = shared.db?.getStrategyPerformance(strategyId) || [];
      return { success: true, performance: perf };
    });


  ipcMain.handle('marketplace:list', async (_e, sortBy?: string, limit?: number) => {
      const strategies = shared.db?.getMarketplaceStrategies(sortBy || 'rating', limit || 50) || [];
      return { success: true, strategies };
    });


  ipcMain.handle('marketplace:score', async (_e, strategyId: string) => {
      if (!shared.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
      try {
        const score = shared.marketplaceService.calculateStrategyScore(strategyId);
        return { success: true, score };
      } catch (err: any) {
        log.error('[Marketplace] Score calculation failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('marketplace:verify', async (_e, strategyId: string) => {
      if (!shared.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
      try {
        const verification = shared.marketplaceService.verifyPerformance(strategyId);
        return { success: true, verification };
      } catch (err: any) {
        log.error('[Marketplace] Verification failed:', err.message);
        return { success: false, error: err.message };
      }
    });


  ipcMain.handle('marketplace:updateAllScores', async () => {
      if (!shared.marketplaceService) return { success: false, error: 'MarketplaceService not initialized' };
      try {
        const result = shared.marketplaceService.updateAllScores();
        return { success: true, ...result };
      } catch (err: any) {
        log.error('[Marketplace] Batch update failed:', err.message);
        return { success: false, error: err.message };
      }
    });

}
