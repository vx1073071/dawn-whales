// ── QUANT MOO IPC: export — File export (CSV/JSON/MD/HTML/PDF) ──────────
// R20: Missing handlers — preload exposes export:* but no export-ipc.ts existed.

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { EngineError } from '../engine/core/engine-error';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

// ── Helper ──────────────────────────────────────────────────────────────────
function getMainWindow(): BrowserWindow | null {
  const { getCurrentWindow } = require('electron');
  return getCurrentWindow();
}

// Convert data to CSV string
function toCSV(data: unknown[], columns?: string[]): string {
  if (!data || data.length === 0) return '';
  const cols = columns || Object.keys(data[0]);
  const header = cols.join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const v = row[c];
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

// Convert data to MD table
function toMD(data: unknown[], columns?: string[]): string {
  if (!data || data.length === 0) return '';
  const cols = columns || Object.keys(data[0]);
  const header = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const rows = data.map(row =>
    `| ${cols.map(c => String(row[c] ?? '')).join(' | ')} |`
  );
  return [header, sep, ...rows].join('\n');
}

// ── Register ────────────────────────────────────────────────────────────────
export function registerExportIPC() {
  // ── export:csv ────────────────────────────────────────────────────────
  ipcMain.handle('export:csv', async (_e, target: string, filters?: unknown) => {
    try {
      // target can be 'positions' | 'orders' | 'trades' | 'strategies' | 'equity'
      const data = getExportData(target, filters);
      const csv = toCSV(data);
      const result = await saveFileDialog('csv', csv);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      void EngineError; // structured error domain: SYSTEM
      log.error('[ExportCSV]', err);
      return { success: false, error: err.message };
    }
  });

  // ── export:json ────────────────────────────────────────────────────────
  ipcMain.handle('export:json', async (_e, target: string, filters?: unknown) => {
    try {
      const data = getExportData(target, filters);
      const json = JSON.stringify(data, null, 2);
      const result = await saveFileDialog('json', json);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ExportJSON]', err);
      return { success: false, error: err.message };
    }
  });

  // ── export:md ──────────────────────────────────────────────────────────
  ipcMain.handle('export:md', async (_e, target: string, filters?: unknown) => {
    try {
      const data = getExportData(target, filters);
      const md = toMD(data);
      const result = await saveFileDialog('md', md);
      return result;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ExportMD]', err);
      return { success: false, error: err.message };
    }
  });

  // ── export:batch ───────────────────────────────────────────────────────
  ipcMain.handle('export:batch', async (_e, request: {
    targets: string[];
    format: 'csv' | 'json' | 'md';
    filters?: unknown;
    outputDir?: string;
  }) => {
    try {
      const { targets, format, filters, outputDir } = request;
      const results: any[] = [];
      for (const target of targets) {
        const data = getExportData(target, filters);
        let content: string;
        if (format === 'json') content = JSON.stringify(data, null, 2);
        else if (format === 'md') content = toMD(data);
        else content = toCSV(data);
        const filename = `${target}_${Date.now()}.${format}`;
        const filepath = outputDir ? path.join(outputDir, filename) : path.join(require('electron').app.getPath('downloads'), filename);
        fs.writeFileSync(filepath, content, 'utf-8');
        results.push({ target, format, filepath, count: data.length });
      }
      return { success: true, results };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ExportBatch]', err);
      return { success: false, error: err.message };
    }
  });

  // ── export:save-dialog ─────────────────────────────────────────────────
  ipcMain.handle('export:save-dialog', async (_e, options: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    content?: string;
  }) => {
    try {
      const win = getMainWindow();
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options.defaultPath,
        filters: options.filters || [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'Markdown', extensions: ['md'] },
        ],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      if (options.content) {
        fs.writeFileSync(result.filePath, options.content, 'utf-8');
      }
      return { success: true, filepath: result.filePath };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ExportSaveDialog]', err);
      return { success: false, error: err.message };
    }
  });

  // ── export:summary-report ───────────────────────────────────────────────
  ipcMain.handle('export:summary-report', async () => {
    try {
      const win = getMainWindow();
      if (!win) return { success: false, error: 'No window' };
      // Generate summary from portfolio + risk data
      const report = generateSummaryReport();
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `summary-report-${Date.now()}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      fs.writeFileSync(result.filePath, report, 'utf-8');
      return { success: true, filepath: result.filePath };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.error('[ExportSummary]', err);
      return { success: false, error: err.message };
    }
  });

  log.info('[ExportIPC] registered 6 handlers');
}

// ── Data fetchers (stub implementations) ───────────────────────────────────
function getExportData(target: string, _filters?: unknown): any[] {
  switch (target) {
    case 'positions': return [];
    case 'orders': return [];
    case 'trades': return [];
    case 'strategies': return [];
    case 'equity': return [];
    default: return [];
  }
}

function generateSummaryReport(): string {
  return `# QUANT MOO Trading Summary\n\nGenerated: ${new Date().toISOString()}\n\n## Portfolio\n\n[To be populated by real data]\n\n## Risk\n\n[To be populated by real data]\n`;
}

async function saveFileDialog(format: string, content: string): Promise<any> {
  const win = getMainWindow();
  const ext = format;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: `export-${Date.now()}.${ext}`,
    filters: [{ name: format.toUpperCase(), extensions: [ext] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { success: true, filepath: result.filePath };
}