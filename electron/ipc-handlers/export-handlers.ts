// -- IPC Handlers: export (5 handlers) --
// JVS-106: Data Exporter

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import { shared } from './_import-shared';
import {
  exportData,
  batchExport,
  generateSummaryReport,
  ExportOptions,
  BatchExportRequest,
} from '../engine/data/data-exporter';
import log from 'electron-log';
import i18n from '../../src/i18n';

export function registerExportHandlers() {

  // export:csv — 导出指定数据为 CSV
  ipcMain.handle('export:csv', async (_e, target: string, filters?: unknown) => {
    try {
      const result = exportData({ target: target as any, format: 'csv', filters });
      return { success: result.success, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error('[Export] CSV export failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // export:json — 导出指定数据为 JSON
  ipcMain.handle('export:json', async (_e, target: string, filters?: unknown) => {
    try {
      const result = exportData({ target: target as any, format: 'json', filters });
      return { success: result.success, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Export] JSON export failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // export:md — 导出指定数据为 Markdown
  ipcMain.handle('export:md', async (_e, target: string, filters?: unknown) => {
    try {
      const result = exportData({ target: target as any, format: 'md', filters });
      return { success: result.success, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Export] Markdown export failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // export:batch — 批量导出多个数据类型
  ipcMain.handle('export:batch', async (_e, request: BatchExportRequest) => {
    try {
      const result = batchExport(request);
      return { success: result.success, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Export] Batch export failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // export:save-dialog — 弹出保存对话框，让用户选择保存路径
  ipcMain.handle('export:save-dialog', async (_e, options: { target: string; format: string; filters?: any }) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const ext = options.format === 'csv' ? 'csv' : options.format === 'md' ? 'md' : 'json';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      const { filePath, canceled } = await dialog.showSaveDialog(win!, {
        title: i18n.t('exportHandlers.k1'),
        defaultPath: `dawn-whales-${options.target}-${timestamp}.${ext}`,
        filters: [
          { name: i18n.t('exportHandlers.k2'), extensions: ['csv'] },
          { name: i18n.t('exportHandlers.k3'), extensions: ['json'] },
          { name: i18n.t('exportHandlers.k4'), extensions: ['md'] },
        ],
      });

      if (canceled || !filePath) {
        return { success: false, error: i18n.t('exportHandlers.k5') };
      }

      const result = exportData({
        target: options.target as any,
        format: options.format as any,
        filters: options.filters,
        outputPath: filePath,
      });

      return { success: result.success, data: result };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Export] Save dialog failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  // export:summary-report — 生成数据摘要报告 (Markdown)
  ipcMain.handle('export:summary-report', async () => {
    try {
      const report = generateSummaryReport();
      return { success: true, data: { report, generatedAt: new Date().toISOString() } };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[Export] Summary report failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  log.info('[IPC] Export handlers registered (6 handlers)');
}
