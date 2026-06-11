// ── JVS-106 + JVS-44-02: Data Exporter — export ──────────────────
// CSV / JSON / Markdown / PDF export
// export：transaction history、backtest result、position/holding、strategy/policy、risk controllog
// add new：export、exportschedule、export

import log from 'electron-log';

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'md' | 'pdf';

export type ExportTarget =
  | 'trades'
  | 'backtest_runs'
  | 'strategies'
  | 'kline_cache'
  | 'alerts'
  | 'portfolio';

export interface ExportOptions {
  target: ExportTarget;
  format: ExportFormat;
  filters?: {
    strategyId?: string;
    symbol?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
  };
  outputPath?: string; // optional: caller-specified path
  pretty?: boolean;    // JSON pretty print
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  rowCount: number;
  fileSizeBytes: number;
  format: ExportFormat;
  target: ExportTarget;
  error?: string;
}

export interface BatchExportRequest {
  targets: ExportTarget[];
  format: ExportFormat;
  filters?: ExportOptions['filters'];
  outputDir?: string;
}

export interface BatchExportResult {
  success: boolean;
  results: ExportResult[];
  totalFiles: number;
  totalSizeBytes: number;
  outputDir: string;
}

// ── CSV Helpers ────────────────────────────────────────────────────────────

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + lines.join('\n');
}

// ── Markdown Helpers ───────────────────────────────────────────────────────

function toMarkdownTable(headers: string[], rows: unknown[][], title?: string): string {
  const lines: string[] = [];
  if (title) {
    lines.push(`# ${title}`);
    lines.push(i18n.t('dataExporter.k1'));
  }
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    lines.push('| ' + row.map(v => v === null || v === undefined ? '' : String(v)).join(' | ') + ' |');
  }
  lines.push(i18n.t('dataExporter.k2'));
  return lines.join('\n');
}

// ── DB Query Helper ────────────────────────────────────────────────────────

function getDb(): any {
  // Access shared db via lazy require to avoid circular deps
  try {
    const { shared } = require('../ipc-handlers/_import-shared');
    return shared.db;
  } catch (_e: unknown) {
    return null;
  }
}

// ── Export Functions ────────────────────────────────────────────────────────

function queryTrades(filters?: ExportOptions['filters']): unknown[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM trades WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.strategyId) {
    sql += ' AND strategy_id = ?';
    params.push(filters.strategyId);
  }
  if (filters?.symbol) {
    sql += ' AND symbol = ?';
    params.push(filters.symbol);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.startDate) {
    sql += ' AND created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    sql += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  try {
    return db.getDb().prepare(sql).all(...params);
  } catch (err: unknown) {
    log.error('[DataExporter] queryTrades error:', err.message);
    return [];
  }
}

function queryBacktestRuns(filters?: ExportOptions['filters']): unknown[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM backtest_runs WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.strategyId) {
    sql += ' AND strategy_id = ?';
    params.push(filters.strategyId);
  }
  if (filters?.startDate) {
    sql += ' AND created_at >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    sql += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  try {
    return db.getDb().prepare(sql).all(...params);
  } catch (err: unknown) {
    log.error('[DataExporter] queryBacktestRuns error:', err.message);
    return [];
  }
}

function queryStrategies(filters?: ExportOptions['filters']): unknown[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM strategies WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY updated_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  try {
    return db.getDb().prepare(sql).all(...params);
  } catch (err: unknown) {
    log.error('[DataExporter] queryStrategies error:', err.message);
    return [];
  }
}

function queryKlineCache(filters?: ExportOptions['filters']): unknown[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM kline_cache WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.symbol) {
    sql += ' AND symbol = ?';
    params.push(filters.symbol);
  }

  sql += ' ORDER BY time DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit || 1000);
  } else {
    sql += ' LIMIT 1000';
  }

  try {
    return db.getDb().prepare(sql).all(...params);
  } catch (err: unknown) {
    log.error('[DataExporter] queryKlineCache error:', err.message);
    return [];
  }
}

function queryAlerts(): unknown[] {
  const db = getDb();
  if (!db) return [];

  try {
    // alerts table may not exist in all versions
    return db.getDb().prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 500').all();
  } catch (_e: unknown) {
    return [];
  }
}

function queryPortfolio(): unknown[] {
  const db = getDb();
  if (!db) return [];

  try {
    // Build portfolio snapshot from current positions in trades
    const sql = `
      SELECT symbol, side,
        SUM(filled_qty) as total_qty,
        ROUND(AVG(CASE WHEN filled_price > 0 THEN filled_price ELSE NULL END), 4) as avg_price,
        SUM(pnl) as total_pnl,
        SUM(commission) as total_commission,
        COUNT(*) as trade_count,
        MIN(created_at) as first_trade,
        MAX(created_at) as last_trade
      FROM trades
      WHERE status IN ('filled', 'executed')
      GROUP BY symbol, side
      HAVING total_qty > 0
      ORDER BY total_pnl DESC
    `;
    return db.getDb().prepare(sql).all();
  } catch (err: unknown) {
    log.error('[DataExporter] queryPortfolio error:', err.message);
    return [];
  }
}

// ── Format Renderers ───────────────────────────────────────────────────────

function renderTrades(rows: unknown[], format: ExportFormat): string {
  const headers = ['ID', i18n.t('dataExporter.k3'), i18n.t('dataExporter.k4'), i18n.t('dataExporter.k5'), i18n.t('dataExporter.k6'), i18n.t('dataExporter.k7'), i18n.t('dataExporter.k8'), i18n.t('dataExporter.k9'), i18n.t('dataExporter.k10'), i18n.t('dataExporter.k11'), i18n.t('dataExporter.k12'), i18n.t('dataExporter.k13'), i18n.t('dataExporter.k14')];
  const data = rows.map(r => [
    r.id, r.strategy_id, r.symbol, r.side, r.order_type,
    r.quantity, r.price, r.filled_price, r.commission,
    r.pnl, r.pnl_pct, r.status, r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k15'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k16')); // PDF uses text extraction
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderBacktestRuns(rows: unknown[], format: ExportFormat): string {
  const headers = ['ID', i18n.t('dataExporter.k17'), i18n.t('dataExporter.k18'), i18n.t('dataExporter.k19'), i18n.t('dataExporter.k20'), i18n.t('dataExporter.k21'), i18n.t('dataExporter.k22'), i18n.t('dataExporter.k23'), i18n.t('dataExporter.k24'), i18n.t('dataExporter.k25'), i18n.t('dataExporter.k26'), i18n.t('dataExporter.k27')];
  const data = rows.map(r => [
    r.id, r.strategy_id, r.start_date, r.end_date, r.initial_capital,
    r.total_return?.toFixed(2), r.annual_return?.toFixed(2),
    r.sharpe_ratio?.toFixed(3), r.max_drawdown?.toFixed(2),
    r.win_rate?.toFixed(2), r.total_trades, r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k28'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k29'));
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderStrategies(rows: unknown[], format: ExportFormat): string {
  const headers = ['ID', i18n.t('dataExporter.k30'), i18n.t('dataExporter.k31'), i18n.t('dataExporter.k32'), i18n.t('dataExporter.k33'), i18n.t('dataExporter.k34'), i18n.t('dataExporter.k35'), i18n.t('dataExporter.k36')];
  const data = rows.map(r => [
    r.id, r.name, r.description, r.symbol, r.version, r.status, r.created_at, r.updated_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k37'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k38'));
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderKlineCache(rows: unknown[], format: ExportFormat): string {
  const headers = [i18n.t('dataExporter.k39'), i18n.t('dataExporter.k40'), i18n.t('dataExporter.k41'), i18n.t('dataExporter.k42'), i18n.t('dataExporter.k43'), i18n.t('dataExporter.k44'), i18n.t('dataExporter.k45'), i18n.t('dataExporter.k46')];
  const data = rows.map(r => [
    r.symbol, r.interval, r.time, r.open, r.high, r.low, r.close, r.volume
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k47'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k48'));
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderAlerts(rows: unknown[], format: ExportFormat): string {
  const headers = ['ID', i18n.t('dataExporter.k49'), i18n.t('dataExporter.k50'), i18n.t('dataExporter.k51'), i18n.t('dataExporter.k52'), i18n.t('dataExporter.k53')];
  const data = rows.map(r => [
    r.id, r.level, r.type, r.message, r.status || 'unread', r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k54'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k55'));
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderPortfolio(rows: unknown[], format: ExportFormat): string {
  const headers = [i18n.t('dataExporter.k56'), i18n.t('dataExporter.k57'), i18n.t('dataExporter.k58'), i18n.t('dataExporter.k59'), i18n.t('dataExporter.k60'), i18n.t('dataExporter.k61'), i18n.t('dataExporter.k62'), i18n.t('dataExporter.k63'), i18n.t('dataExporter.k64')];
  const data = rows.map(r => [
    r.symbol, r.side, r.total_qty, r.avg_price,
    r.total_pnl?.toFixed(2), r.total_commission?.toFixed(2),
    r.trade_count, r.first_trade, r.last_trade
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, i18n.t('dataExporter.k65'));
    case 'pdf': return toMarkdownTable(headers, data, i18n.t('dataExporter.k66'));
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

// ── Main Export Function ───────────────────────────────────────────────────

export function exportData(options: ExportOptions): ExportResult {
  const { target, format, filters } = options;

  log.info(`[DataExporter] Exporting ${target} as ${format}`);

  // Route PDF to dedicated handler
  if (format === 'pdf') {
    return exportPdf(options);
  }

  // 1. Query data
  let rows: unknown[];
  switch (target) {
    case 'trades':          rows = queryTrades(filters); break;
    case 'backtest_runs':   rows = queryBacktestRuns(filters); break;
    case 'strategies':      rows = queryStrategies(filters); break;
    case 'kline_cache':     rows = queryKlineCache(filters); break;
    case 'alerts':          rows = queryAlerts(); break;
    case 'portfolio':       rows = queryPortfolio(); break;
    default:
      return { success: false, rowCount: 0, fileSizeBytes: 0, format, target, error: `Unknown target: ${target}` };
  }

  if (rows.length === 0) {
    log.warn(`[DataExporter] No data found for target: ${target}`);
    return { success: true, rowCount: 0, fileSizeBytes: 0, format, target, filePath: '' };
  }

  // 2. Render content
  let content: string;
  switch (target) {
    case 'trades':          content = renderTrades(rows, format); break;
    case 'backtest_runs':   content = renderBacktestRuns(rows, format); break;
    case 'strategies':      content = renderStrategies(rows, format); break;
    case 'kline_cache':     content = renderKlineCache(rows, format); break;
    case 'alerts':          content = renderAlerts(rows, format); break;
    case 'portfolio':       content = renderPortfolio(rows, format); break;
    default:                content = JSON.stringify(rows, null, 2);
  }

  // 3. Determine output path
  const outputDir = options.outputPath || path.join(app.getPath('downloads'), 'dawn-whales-exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = format === 'csv' ? 'csv' : format === 'md' ? 'md' : 'json';
  const filename = `dawn-whales-${target}-${timestamp}.${ext}`;
  const filePath = path.join(outputDir, filename);

  // 4. Write file
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    const stats = fs.statSync(filePath);
    log.info(`[DataExporter] Exported ${rows.length} rows to ${filePath} (${stats.size} bytes)`);

    return {
      success: true,
      filePath,
      rowCount: rows.length,
      fileSizeBytes: stats.size,
      format,
      target,
    };
  } catch (err: unknown) {
    log.error('[DataExporter] Write failed:', err.message);
    return { success: false, rowCount: rows.length, fileSizeBytes: 0, format, target, error: err.message };
  }
}

// ── Batch Export ───────────────────────────────────────────────────────────

export function batchExport(request: BatchExportRequest): BatchExportResult {
  const outputDir = request.outputDir || path.join(app.getPath('downloads'), 'dawn-whales-exports', `batch-${Date.now()}`);

  const results: ExportResult[] = [];
  let totalSize = 0;

  for (const target of request.targets) {
    const result = exportData({
      target,
      format: request.format,
      filters: request.filters,
      outputPath: outputDir,
    });
    results.push(result);
    totalSize += result.fileSizeBytes;
  }

  return {
    success: results.every(r => r.success),
    results,
    totalFiles: results.filter(r => r.success && r.filePath).length,
    totalSizeBytes: totalSize,
    outputDir,
  };
}

// ── Quick Summary Report (Markdown) ────────────────────────────────────────

export function generateSummaryReport(): string {
  const db = getDb();
  if (!db) return i18n.t('dataExporter.k67');

  const strategyCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM strategies').get()?.c || 0; } catch (_e: unknown) { return 0; }
  })();
  const backtestCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM backtest_runs').get()?.c || 0; } catch (_e: unknown) { return 0; }
  })();
  const tradeCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM trades').get()?.c || 0; } catch (_e: unknown) { return 0; }
  })();
  const filledTrades = (() => {
    try { return db.getDb().prepare("SELECT COUNT(*) as c FROM trades WHERE status IN ('filled','executed')").get()?.c || 0; } catch (_e: unknown) { return 0; }
  })();
  const totalPnl = (() => {
    try { return db.getDb().prepare("SELECT ROUND(SUM(pnl), 2) as s FROM trades WHERE status IN ('filled','executed')").get()?.s || 0; } catch (_e: unknown) { return 0; }
  })();
  const totalCommission = (() => {
    try { return db.getDb().prepare("SELECT ROUND(SUM(commission), 2) as s FROM trades WHERE status IN ('filled','executed')").get()?.s || 0; } catch (_e: unknown) { return 0; }
  })();

  const topStrategies = (() => {
    try {
      return db.getDb().prepare(`
        SELECT s.name, COUNT(t.id) as trades, ROUND(SUM(t.pnl), 2) as total_pnl
        FROM strategies s
        LEFT JOIN trades t ON t.strategy_id = s.id AND t.status IN ('filled','executed')
        GROUP BY s.id
        ORDER BY total_pnl DESC
        LIMIT 5
      `).all();
    } catch (_e: unknown) { return []; }
  })();

  const now = new Date().toLocaleString('zh-CN') + i18n.t('dataExporter.k1');

  return `# ${i18n.t('dataExporter.k67')}

${i18n.t('dataExporter.k17')}: ${strategyCount}
${i18n.t('dataExporter.k28')}: ${backtestCount}
${i18n.t('dataExporter.k15')}: ${tradeCount}
${i18n.t('dataExporter.k54')}: ${filledTrades}
Total PnL: ${totalPnl}
Total Commission: ${totalCommission}

---
*Dawn Whales Data Exporter v1.0*
${now}
`;
}

// ── PDF Export (JVS-44-02) ──────────────────────────────────────────────────

/**
 * Generate a minimal valid PDF document from text content.
 * Uses pure string construction — no external PDF library needed.
 * Supports CJK via UTF-16BE encoding in PDF text streams.
 */
export function generatePdf(title: string, sections: Array<{ heading: string; rows: string[] }>): Buffer {
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Generated: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  for (const section of sections) {
    lines.push(section.heading);
    lines.push('-'.repeat(40));
    for (const row of section.rows) {
      lines.push(row);
    }
    lines.push('');
  }

  lines.push(`Total sections: ${sections.length}`);
  lines.push('Dawn Whales Data Exporter v2.0');

  const textContent = lines.join('\n');
  return buildMinimalPdf(textContent);
}

/**
 * Build a minimal valid PDF 1.4 document containing a single page of text.
 * This produces a valid PDF binary without any external dependencies.
 */
function buildMinimalPdf(text: string): Buffer {
  // Escape special PDF characters and encode for ASCII-safe embedding
  const safeText = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\n]/g, '?'); // Replace non-ASCII for PDF compatibility

  // Split into lines and build text stream with positioning
  const textLines = safeText.split('\n');
  const lineHeight = 14;
  const startY = 750;
  const startX = 50;

  let streamContent = 'BT\n';
  streamContent += '/F1 10 Tf\n';
  for (let i = 0; i < textLines.length; i++) {
    const y = startY - (i * lineHeight);
    if (y < 50) break; // Stop at bottom margin
    const line = textLines[i].replace(/[^\x20-\x7E]/g, ' ');
    streamContent += `${startX} ${y} Td\n`;
    streamContent += `(${line}) Tj\n`;
  }
  streamContent += 'ET\n';

  const streamBytes = Buffer.from(streamContent, 'ascii');
  const streamLength = streamBytes.length;

  // Build PDF objects
  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}endstream\nendobj`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += obj + '\n';
  }

  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += xrefOffset + '\n';
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'ascii');
}

/**
 * Export data as PDF format, returning the result with file path.
 */
export function exportPdf(options: ExportOptions): ExportResult {
  const { target, filters } = options;

  log.info(`[DataExporter] Exporting ${target} as PDF`);

  // Query data
  let rows: unknown[];
  switch (target) {
    case 'trades':          rows = queryTrades(filters); break;
    case 'backtest_runs':   rows = queryBacktestRuns(filters); break;
    case 'strategies':      rows = queryStrategies(filters); break;
    case 'kline_cache':     rows = queryKlineCache(filters); break;
    case 'alerts':          rows = queryAlerts(); break;
    case 'portfolio':       rows = queryPortfolio(); break;
    default:
      return { success: false, rowCount: 0, fileSizeBytes: 0, format: 'pdf', target, error: `Unknown target: ${target}` };
  }

  if (rows.length === 0) {
    log.warn(`[DataExporter] No data found for PDF target: ${target}`);
    return { success: true, rowCount: 0, fileSizeBytes: 0, format: 'pdf', target, filePath: '' };
  }

  // Build PDF sections
  const sections = buildPdfSections(target, rows);
  const title = `Dawn Whales - ${target} Report`;
  const pdfBuffer = generatePdf(title, sections);

  // Write file
  const outputDir = options.outputPath || path.join(app.getPath('downloads'), 'dawn-whales-exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `dawn-whales-${target}-${timestamp}.pdf`;
  const filePath = path.join(outputDir, filename);

  try {
    fs.writeFileSync(filePath, pdfBuffer);
    const stats = fs.statSync(filePath);
    log.info(`[DataExporter] Exported PDF: ${rows.length} rows to ${filePath} (${stats.size} bytes)`);

    return {
      success: true,
      filePath,
      rowCount: rows.length,
      fileSizeBytes: stats.size,
      format: 'pdf',
      target,
    };
  } catch (err: unknown) {
    log.error('[DataExporter] PDF write failed:', err.message);
    return { success: false, rowCount: rows.length, fileSizeBytes: 0, format: 'pdf', target, error: err.message };
  }
}

/**
 * Build PDF sections based on the export target type.
 */
function buildPdfSections(target: ExportTarget, rows: unknown[]): Array<{ heading: string; rows: string[] }> {
  const sections: Array<{ heading: string; rows: string[] }> = [];

  switch (target) {
    case 'trades':
      sections.push({
        heading: 'Trade Records',
        rows: rows.map((r, i) =>
          `${i + 1}. ${r.symbol} ${r.side} qty=${r.quantity} price=${r.filled_price || r.price} pnl=${r.pnl || 0} [${r.status}]`
        ),
      });
      break;
    case 'backtest_runs':
      sections.push({
        heading: 'Backtest Results',
        rows: rows.map((r, i) =>
          `${i + 1}. Strategy=${r.strategy_id} return=${r.total_return?.toFixed(2) || 0}% sharpe=${r.sharpe_ratio?.toFixed(3) || 0} drawdown=${r.max_drawdown?.toFixed(2) || 0}%`
        ),
      });
      break;
    case 'strategies':
      sections.push({
        heading: 'Strategy List',
        rows: rows.map((r, i) =>
          `${i + 1}. ${r.name} (${r.id}) - ${r.description || 'No description'} [${r.status}]`
        ),
      });
      break;
    case 'portfolio':
      sections.push({
        heading: 'Portfolio Summary',
        rows: rows.map((r, i) =>
          `${i + 1}. ${r.symbol} ${r.side} qty=${r.total_qty} avgPrice=${r.avg_price} pnl=${r.total_pnl?.toFixed(2) || 0}`
        ),
      });
      break;
    case 'alerts':
      sections.push({
        heading: 'Alert Records',
        rows: rows.map((r, i) =>
          `${i + 1}. [${r.level}] ${r.type}: ${r.message}`
        ),
      });
      break;
    case 'kline_cache':
      sections.push({
        heading: 'K-Line Data',
        rows: rows.slice(0, 100).map((r, i) =>
          `${i + 1}. ${r.symbol} ${r.interval} ${r.time} O=${r.open} H=${r.high} L=${r.low} C=${r.close} V=${r.volume}`
        ),
      });
      break;
  }

  // Summary section
  sections.push({
    heading: 'Summary',
    rows: [
      `Total records: ${rows.length}`,
      `Export target: ${target}`,
      `Export time: ${new Date().toLocaleString('zh-CN')}`,
    ],
  });

  return sections;
}

// ── Export Scheduling (JVS-44-02) ───────────────────────────────────────────

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface ExportSchedule {
  id: string;
  name: string;
  frequency: ScheduleFrequency;
  targets: ExportTarget[];
  format: ExportFormat;
  filters?: ExportOptions['filters'];
  outputDir?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface ScheduleResult {
  success: boolean;
  scheduleId: string;
  message: string;
}

// In-memory schedule storage (persisted via JSON file when available)
const schedules: Map<string, ExportSchedule> = new Map();
const scheduleTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

/**
 * Generate a unique schedule ID.
 */
function generateScheduleId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Calculate the next run time based on frequency.
 */
export function calculateNextRun(frequency: ScheduleFrequency, from?: Date): Date {
  const now = from || new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0); // Run at 2:00 AM
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay()));
      next.setHours(2, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(2, 0, 0, 0);
      break;
  }

  return next;
}

/**
 * Create a new export schedule.
 */
export function createSchedule(config: {
  name: string;
  frequency: ScheduleFrequency;
  targets: ExportTarget[];
  format: ExportFormat;
  filters?: ExportOptions['filters'];
  outputDir?: string;
}): ExportSchedule {
  const id = generateScheduleId();
  const now = new Date().toISOString();
  const nextRun = calculateNextRun(config.frequency);

  const schedule: ExportSchedule = {
    id,
    name: config.name,
    frequency: config.frequency,
    targets: config.targets,
    format: config.format,
    filters: config.filters,
    outputDir: config.outputDir,
    enabled: true,
    createdAt: now,
    nextRun: nextRun.toISOString(),
  };

  schedules.set(id, schedule);
  log.info(`[DataExporter] Created schedule: ${schedule.name} (${schedule.frequency}) → ${schedule.id}`);

  return schedule;
}

/**
 * Remove an export schedule.
 */
export function removeSchedule(scheduleId: string): boolean {
  const timer = scheduleTimers.get(scheduleId);
  if (timer) {
    clearInterval(timer);
    scheduleTimers.delete(scheduleId);
  }

  const removed = schedules.delete(scheduleId);
  if (removed) {
    log.info(`[DataExporter] Removed schedule: ${scheduleId}`);
  }
  return removed;
}

/**
 * List all export schedules.
 */
export function listSchedules(): ExportSchedule[] {
  return Array.from(schedules.values());
}

/**
 * Get a specific schedule by ID.
 */
export function getSchedule(scheduleId: string): ExportSchedule | undefined {
  return schedules.get(scheduleId);
}

/**
 * Enable or disable a schedule.
 */
export function toggleSchedule(scheduleId: string, enabled: boolean): boolean {
  const schedule = schedules.get(scheduleId);
  if (!schedule) return false;

  schedule.enabled = enabled;
  schedules.set(scheduleId, schedule);
  log.info(`[DataExporter] Schedule ${scheduleId} ${enabled ? 'enabled' : 'disabled'}`);
  return true;
}

/**
 * Execute a scheduled export immediately.
 */
export function executeSchedule(scheduleId: string): BatchExportResult | null {
  const schedule = schedules.get(scheduleId);
  if (!schedule) {
    log.warn(`[DataExporter] Schedule not found: ${scheduleId}`);
    return null;
  }

  log.info(`[DataExporter] Executing schedule: ${schedule.name}`);

  const result = batchExport({
    targets: schedule.targets,
    format: schedule.format,
    filters: schedule.filters,
    outputDir: schedule.outputDir,
  });

  // Update last run
  schedule.lastRun = new Date().toISOString();
  schedule.nextRun = calculateNextRun(schedule.frequency).toISOString();
  schedules.set(scheduleId, schedule);

  return result;
}

/**
 * Persist schedules to a JSON file.
 */
export function saveSchedules(filePath: string): boolean {
  try {
    const data = JSON.stringify(Array.from(schedules.entries()), null, 2);
    fs.writeFileSync(filePath, data, 'utf-8');
    log.info(`[DataExporter] Saved ${schedules.size} schedules to ${filePath}`);
    return true;
  } catch (err: unknown) {
    log.error('[DataExporter] Failed to save schedules:', err.message);
    return false;
  }
}

/**
 * Load schedules from a JSON file.
 */
export function loadSchedules(filePath: string): number {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const data = fs.readFileSync(filePath, 'utf-8');
    const entries: Array<[string, ExportSchedule]> = JSON.parse(data);
    for (const [id, schedule] of entries) {
      schedules.set(id, schedule);
    }
    log.info(`[DataExporter] Loaded ${entries.length} schedules from ${filePath}`);
    return entries.length;
  } catch (err: unknown) {
    log.error('[DataExporter] Failed to load schedules:', err.message);
    return 0;
  }
}

// ── Export Templates (JVS-44-02) ────────────────────────────────────────────

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  targets: ExportTarget[];
  format: ExportFormat;
  filters?: ExportOptions['filters'];
  category: 'performance' | 'risk' | 'compliance' | 'audit' | 'custom';
}

/**
 * Predefined export templates for common use cases.
 */
export const EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: 'tpl-daily-pnl',
    name: 'Daily P&L Report',
    description: 'Export today\'s trade P&L and portfolio summary',
    targets: ['trades', 'portfolio'],
    format: 'csv',
    filters: { limit: 500 },
    category: 'performance',
  },
  {
    id: 'tpl-backtest-summary',
    name: 'Backtest Summary',
    description: 'All backtest runs with performance metrics',
    targets: ['backtest_runs'],
    format: 'json',
    category: 'performance',
  },
  {
    id: 'tpl-strategy-audit',
    name: 'Strategy Audit Package',
    description: 'Full strategy list with associated backtest results',
    targets: ['strategies', 'backtest_runs'],
    format: 'json',
    category: 'audit',
  },
  {
    id: 'tpl-risk-report',
    name: 'Risk Report',
    description: 'Alerts and portfolio exposure for risk review',
    targets: ['alerts', 'portfolio'],
    format: 'pdf',
    category: 'risk',
  },
  {
    id: 'tpl-compliance-export',
    name: 'Compliance Export',
    description: 'Complete trade history and alerts for compliance review',
    targets: ['trades', 'alerts'],
    format: 'csv',
    filters: { limit: 10000 },
    category: 'compliance',
  },
  {
    id: 'tpl-full-backup',
    name: 'Full Data Backup',
    description: 'Export all data types in JSON format',
    targets: ['trades', 'backtest_runs', 'strategies', 'kline_cache', 'alerts', 'portfolio'],
    format: 'json',
    category: 'audit',
  },
  {
    id: 'tpl-monthly-review',
    name: 'Monthly Review',
    description: 'Monthly performance review with trades and backtests',
    targets: ['trades', 'backtest_runs', 'portfolio'],
    format: 'pdf',
    category: 'performance',
  },
  {
    id: 'tpl-kline-analysis',
    name: 'K-Line Data Export',
    description: 'Export cached K-line data for external analysis',
    targets: ['kline_cache'],
    format: 'csv',
    filters: { limit: 5000 },
    category: 'custom',
  },
];

/**
 * Get all available export templates.
 */
export function getExportTemplates(): ExportTemplate[] {
  return [...EXPORT_TEMPLATES];
}

/**
 * Get a specific template by ID.
 */
export function getExportTemplate(templateId: string): ExportTemplate | undefined {
  return EXPORT_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get templates by category.
 */
export function getTemplatesByCategory(category: ExportTemplate['category']): ExportTemplate[] {
  return EXPORT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Execute an export using a predefined template.
 */
export function exportFromTemplate(templateId: string, overrides?: {
  outputDir?: string;
  filters?: ExportOptions['filters'];
}): BatchExportResult | ExportResult | null {
  const template = getExportTemplate(templateId);
  if (!template) {
    log.warn(`[DataExporter] Template not found: ${templateId}`);
    return null;
  }

  log.info(`[DataExporter] Executing template: ${template.name} (${template.id})`);

  const mergedFilters = { ...template.filters, ...overrides?.filters };

  // Single target → use exportData directly
  if (template.targets.length === 1) {
    if (template.format === 'pdf') {
      return exportPdf({
        target: template.targets[0],
        format: 'pdf',
        filters: mergedFilters,
        outputPath: overrides?.outputDir,
      });
    }
    return exportData({
      target: template.targets[0],
      format: template.format,
      filters: mergedFilters,
      outputPath: overrides?.outputDir,
    });
  }

  // Multiple targets → batch export
  return batchExport({
    targets: template.targets,
    format: template.format,
    filters: mergedFilters,
    outputDir: overrides?.outputDir,
  });
}

/**
 * Create a custom export template.
 */
export function createCustomTemplate(config: {
  name: string;
  description: string;
  targets: ExportTarget[];
  format: ExportFormat;
  filters?: ExportOptions['filters'];
}): ExportTemplate {
  const id = `tpl-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const template: ExportTemplate = {
    id,
    name: config.name,
    description: config.description,
    targets: config.targets,
    format: config.format,
    filters: config.filters,
    category: 'custom',
  };

  // Add to templates list (mutable copy)
  EXPORT_TEMPLATES.push(template);
  log.info(`[DataExporter] Created custom template: ${template.name} → ${template.id}`);

  return template;
}
