// DAWN WHALES R119 QTE-40 — Indicator Worker IPC Bridge
// 将 indicator-engine-worker 的 computeIndicators 暴露为 IPC handler

import { ipcMain } from 'electron';
import { computeIndicators } from '../workers/indicator-engine-worker';
import type { IndicatorWorkerRequest, IndicatorWorkerResponse } from '../workers/indicator-engine-worker';

export function registerIndicatorWorkerIPC(): void {
  ipcMain.handle('indicator:compute', async (_event, req: IndicatorWorkerRequest): Promise<IndicatorWorkerResponse> => {
    return new Promise((resolve) => {
      setImmediate(() => {
        try {
          const result = computeIndicators(req);
          resolve(result);
        } catch (err: any) {
          resolve({
            taskId: req.taskId,
            results: [],
            barCount: req.bars.length,
            elapsedMs: 0,
            error: err.message ?? 'Indicator computation failed',
          });
        }
      });
    });
  });
}
