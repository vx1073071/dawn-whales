// ── JVS-106: Data Exporter — 高级数据导出引擎 ──────────────────────────────
// 支持 CSV / JSON / Markdown 报告导出
// 导出对象：交易记录、回测结果、持仓、策略列表、风控日志

import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ── Types ──────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'md';

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

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers: string[], rows: any[][]): string {
  const lines: string[] = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  // BOM for Excel UTF-8 compatibility
  return '\uFEFF' + lines.join('\n');
}

// ── Markdown Helpers ───────────────────────────────────────────────────────

function toMarkdownTable(headers: string[], rows: any[][], title?: string): string {
  const lines: string[] = [];
  if (title) {
    lines.push(`# ${title}`);
    lines.push(`\n> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`);
  }
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    lines.push('| ' + row.map(v => v === null || v === undefined ? '' : String(v)).join(' | ') + ' |');
  }
  lines.push(`\n---\n*共 ${rows.length} 条记录*`);
  return lines.join('\n');
}

// ── DB Query Helper ────────────────────────────────────────────────────────

function getDb(): any {
  // Access shared db via lazy require to avoid circular deps
  try {
    const { shared } = require('../ipc-handlers/_import-shared');
    return shared.db;
  } catch {
    return null;
  }
}

// ── Export Functions ────────────────────────────────────────────────────────

function queryTrades(filters?: ExportOptions['filters']): any[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM trades WHERE 1=1';
  const params: any[] = [];

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
  } catch (err: any) {
    log.error('[DataExporter] queryTrades error:', err.message);
    return [];
  }
}

function queryBacktestRuns(filters?: ExportOptions['filters']): any[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM backtest_runs WHERE 1=1';
  const params: any[] = [];

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
  } catch (err: any) {
    log.error('[DataExporter] queryBacktestRuns error:', err.message);
    return [];
  }
}

function queryStrategies(filters?: ExportOptions['filters']): any[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM strategies WHERE 1=1';
  const params: any[] = [];

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
  } catch (err: any) {
    log.error('[DataExporter] queryStrategies error:', err.message);
    return [];
  }
}

function queryKlineCache(filters?: ExportOptions['filters']): any[] {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM kline_cache WHERE 1=1';
  const params: any[] = [];

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
  } catch (err: any) {
    log.error('[DataExporter] queryKlineCache error:', err.message);
    return [];
  }
}

function queryAlerts(): any[] {
  const db = getDb();
  if (!db) return [];

  try {
    // alerts table may not exist in all versions
    return db.getDb().prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 500').all();
  } catch {
    return [];
  }
}

function queryPortfolio(): any[] {
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
  } catch (err: any) {
    log.error('[DataExporter] queryPortfolio error:', err.message);
    return [];
  }
}

// ── Format Renderers ───────────────────────────────────────────────────────

function renderTrades(rows: any[], format: ExportFormat): string {
  const headers = ['ID', '策略ID', '股票', '方向', '类型', '数量', '价格', '成交价', '手续费', '盈亏', '盈亏%', '状态', '时间'];
  const data = rows.map(r => [
    r.id, r.strategy_id, r.symbol, r.side, r.order_type,
    r.quantity, r.price, r.filled_price, r.commission,
    r.pnl, r.pnl_pct, r.status, r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, '交易记录导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderBacktestRuns(rows: any[], format: ExportFormat): string {
  const headers = ['ID', '策略ID', '起始日期', '结束日期', '初始资金', '总收益%', '年化%', '夏普比率', '最大回撤%', '胜率%', '交易数', '时间'];
  const data = rows.map(r => [
    r.id, r.strategy_id, r.start_date, r.end_date, r.initial_capital,
    r.total_return?.toFixed(2), r.annual_return?.toFixed(2),
    r.sharpe_ratio?.toFixed(3), r.max_drawdown?.toFixed(2),
    r.win_rate?.toFixed(2), r.total_trades, r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, '回测结果导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderStrategies(rows: any[], format: ExportFormat): string {
  const headers = ['ID', '名称', '描述', '股票', '版本', '状态', '创建时间', '更新时间'];
  const data = rows.map(r => [
    r.id, r.name, r.description, r.symbol, r.version, r.status, r.created_at, r.updated_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, '策略列表导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderKlineCache(rows: any[], format: ExportFormat): string {
  const headers = ['股票', '周期', '时间', '开', '高', '低', '收', '成交量'];
  const data = rows.map(r => [
    r.symbol, r.interval, r.time, r.open, r.high, r.low, r.close, r.volume
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, 'K线缓存导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderAlerts(rows: any[], format: ExportFormat): string {
  const headers = ['ID', '级别', '类型', '消息', '状态', '时间'];
  const data = rows.map(r => [
    r.id, r.level, r.type, r.message, r.status || 'unread', r.created_at
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, '告警记录导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

function renderPortfolio(rows: any[], format: ExportFormat): string {
  const headers = ['股票', '方向', '持仓数量', '均价', '总盈亏', '总手续费', '交易次数', '首次交易', '最近交易'];
  const data = rows.map(r => [
    r.symbol, r.side, r.total_qty, r.avg_price,
    r.total_pnl?.toFixed(2), r.total_commission?.toFixed(2),
    r.trade_count, r.first_trade, r.last_trade
  ]);

  switch (format) {
    case 'csv': return toCsv(headers, data);
    case 'md': return toMarkdownTable(headers, data, '持仓汇总导出');
    case 'json': return JSON.stringify(rows, null, 2);
  }
}

// ── Main Export Function ───────────────────────────────────────────────────

export function exportData(options: ExportOptions): ExportResult {
  const { target, format, filters } = options;

  log.info(`[DataExporter] Exporting ${target} as ${format}`);

  // 1. Query data
  let rows: any[];
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
  } catch (err: any) {
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
  if (!db) return '# 数据摘要报告\n\n数据库未初始化。';

  const strategyCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM strategies').get()?.c || 0; } catch { return 0; }
  })();
  const backtestCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM backtest_runs').get()?.c || 0; } catch { return 0; }
  })();
  const tradeCount = (() => {
    try { return db.getDb().prepare('SELECT COUNT(*) as c FROM trades').get()?.c || 0; } catch { return 0; }
  })();
  const filledTrades = (() => {
    try { return db.getDb().prepare("SELECT COUNT(*) as c FROM trades WHERE status IN ('filled','executed')").get()?.c || 0; } catch { return 0; }
  })();
  const totalPnl = (() => {
    try { return db.getDb().prepare("SELECT ROUND(SUM(pnl), 2) as s FROM trades WHERE status IN ('filled','executed')").get()?.s || 0; } catch { return 0; }
  })();
  const totalCommission = (() => {
    try { return db.getDb().prepare("SELECT ROUND(SUM(commission), 2) as s FROM trades WHERE status IN ('filled','executed')").get()?.s || 0; } catch { return 0; }
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
    } catch { return []; }
  })();

  const now = new Date().toLocaleString('zh-CN');

  return `# 🐋 Dawn Whales 数据摘要报告

> 生成时间: ${now}

## 📊 概览

| 指标 | 数值 |
|------|------|
| 策略总数 | ${strategyCount} |
| 回测次数 | ${backtestCount} |
| 交易总数 | ${tradeCount} |
| 已成交 | ${filledTrades} |
| 总盈亏 | ¥${totalPnl} |
| 总手续费 | ¥${totalCommission} |

## 🏆 Top 策略 (按盈亏排序)

| 策略 | 交易数 | 总盈亏 |
|------|--------|--------|
${topStrategies.map((s: any) => `| ${s.name} | ${s.trades} | ¥${s.total_pnl} |`).join('\n')}

---
*Dawn Whales Data Exporter v1.0*
`;
}
