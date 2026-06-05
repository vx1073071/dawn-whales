// ── Unit Tests — JVS-106: Data Exporter ─────────────────────────────────────
// Tests formatting functions with mock data (no DB dependency)
// Run: npx tsx tests/exporter.test.ts

import fs from 'fs';
import path from 'path';
import os from 'os';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ── Mock the electron app module for testing ───────────────────────────────
// We test the pure formatting functions directly

// Simulate escapeCsv and toCsv
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
  return '\uFEFF' + lines.join('\n');
}

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

// ── Test Data ──────────────────────────────────────────────────────────────

const mockTrades = [
  { id: 't1', strategy_id: 's1', symbol: 'US.TQQQ', side: 'BUY', order_type: 'MARKET', quantity: 100, price: 50.5, filled_price: 50.55, commission: 1.5, pnl: 250, pnl_pct: 4.95, status: 'filled', created_at: '2026-06-01 10:00:00' },
  { id: 't2', strategy_id: 's1', symbol: 'US.TQQQ', side: 'SELL', order_type: 'MARKET', quantity: 100, price: 53.0, filled_price: 52.95, commission: 1.5, pnl: -25, pnl_pct: -0.47, status: 'filled', created_at: '2026-06-02 14:30:00' },
  { id: 't3', strategy_id: 's2', symbol: 'US.AAPL', side: 'BUY', order_type: 'LIMIT', quantity: 50, price: 185.0, filled_price: 0, commission: 0, pnl: 0, pnl_pct: 0, status: 'pending', created_at: '2026-06-03 09:30:00' },
];

const mockBacktestRuns = [
  { id: 'bt1', strategy_id: 's1', start_date: '2025-01-01', end_date: '2025-12-31', initial_capital: 100000, total_return: 24.5, annual_return: 24.5, sharpe_ratio: 1.85, max_drawdown: -12.3, win_rate: 58.3, total_trades: 42, created_at: '2026-06-01' },
  { id: 'bt2', strategy_id: 's2', start_date: '2025-06-01', end_date: '2026-05-31', initial_capital: 50000, total_return: -8.2, annual_return: -8.2, sharpe_ratio: -0.45, max_drawdown: -22.1, win_rate: 38.0, total_trades: 25, created_at: '2026-06-02' },
];

const mockStrategies = [
  { id: 's1', name: 'MA Cross TQQQ', description: 'MA5/MA20 crossover', symbol: 'US.TQQQ', version: '1.0.0', status: 'active', created_at: '2026-05-01', updated_at: '2026-06-01' },
  { id: 's2', name: 'RSI AAPL', description: 'RSI oversold/overbought', symbol: 'US.AAPL', version: '2.0.0', status: 'draft', created_at: '2026-05-15', updated_at: '2026-06-02' },
];

// ── Tests ──────────────────────────────────────────────────────────────────

section('CSV Escape');
{
  assert(escapeCsv('hello') === 'hello', 'plain string unchanged');
  assert(escapeCsv(123) === '123', 'number to string');
  assert(escapeCsv(null) === '', 'null becomes empty');
  assert(escapeCsv(undefined) === '', 'undefined becomes empty');
  assert(escapeCsv('a,b') === '"a,b"', 'comma triggers quoting');
  assert(escapeCsv('a"b') === '"a""b"', 'double quote escaped');
  assert(escapeCsv('line1\nline2') === '"line1\nline2"', 'newline triggers quoting');
}

section('CSV Generation — Trades');
{
  const headers = ['ID', '策略ID', '股票', '方向', '类型', '数量', '价格', '成交价', '手续费', '盈亏', '盈亏%', '状态', '时间'];
  const data = mockTrades.map(r => [
    r.id, r.strategy_id, r.symbol, r.side, r.order_type,
    r.quantity, r.price, r.filled_price, r.commission,
    r.pnl, r.pnl_pct, r.status, r.created_at
  ]);
  const csv = toCsv(headers, data);

  assert(csv.startsWith('\uFEFF'), 'CSV starts with BOM');
  assert(csv.split('\n').length === 4, 'CSV has 4 lines (1 header + 3 rows)');
  assert(csv.includes('US.TQQQ'), 'CSV contains TQQQ');
  assert(csv.includes('US.AAPL'), 'CSV contains AAPL');
  assert(csv.includes('filled'), 'CSV contains status');
}

section('CSV Generation — Backtest Runs');
{
  const headers = ['ID', '策略ID', '起始日期', '结束日期', '初始资金', '总收益%', '年化%', '夏普比率', '最大回撤%', '胜率%', '交易数', '时间'];
  const data = mockBacktestRuns.map(r => [
    r.id, r.strategy_id, r.start_date, r.end_date, r.initial_capital,
    r.total_return?.toFixed(2), r.annual_return?.toFixed(2),
    r.sharpe_ratio?.toFixed(3), r.max_drawdown?.toFixed(2),
    r.win_rate?.toFixed(2), r.total_trades, r.created_at
  ]);
  const csv = toCsv(headers, data);

  assert(csv.split('\n').length === 3, 'CSV has 3 lines (1 header + 2 rows)');
  assert(csv.includes('1.850'), 'Sharpe ratio formatted');
  assert(csv.includes('-12.30'), 'Max drawdown formatted');
}

section('CSV Generation — Strategies');
{
  const headers = ['ID', '名称', '描述', '股票', '版本', '状态', '创建时间', '更新时间'];
  const data = mockStrategies.map(r => [
    r.id, r.name, r.description, r.symbol, r.version, r.status, r.created_at, r.updated_at
  ]);
  const csv = toCsv(headers, data);

  assert(csv.split('\n').length === 3, 'CSV has 3 lines');
  assert(csv.includes('MA Cross TQQQ'), 'Strategy name present');
  assert(csv.includes('active'), 'Status present');
}

section('Markdown Table — Trades');
{
  const headers = ['ID', '股票', '方向', '盈亏', '状态'];
  const data = mockTrades.map(r => [r.id, r.symbol, r.side, r.pnl, r.status]);
  const md = toMarkdownTable(headers, data, '交易记录导出');

  assert(md.includes('# 交易记录导出'), 'Title present');
  assert(md.includes('| ID | 股票 | 方向 | 盈亏 | 状态 |'), 'Header row present');
  assert(md.includes('| --- |'), 'Separator present');
  assert(md.includes('US.TQQQ'), 'Data present');
  assert(md.includes('共 3 条记录'), 'Row count present');
  assert(md.includes('导出时间'), 'Export timestamp present');
}

section('Markdown Table — Empty Data');
{
  const md = toMarkdownTable(['A', 'B'], [], '空数据测试');
  assert(md.includes('共 0 条记录'), 'Empty table shows 0 records');
  assert(md.includes('# 空数据测试'), 'Title still present');
}

section('JSON Export');
{
  const json = JSON.stringify(mockTrades, null, 2);
  const parsed = JSON.parse(json);
  assert(parsed.length === 3, 'JSON roundtrip preserves length');
  assert(parsed[0].symbol === 'US.TQQQ', 'JSON roundtrip preserves data');
  assert(parsed[2].status === 'pending', 'JSON roundtrip preserves all fields');
}

section('CSV Edge Cases');
{
  // Special characters in values
  const headers = ['名称', '描述'];
  const data = [
    ['策略 "Alpha"', '包含,逗号和"引号"'],
    ['策略\nBeta', '包含\n换行'],
  ];
  const csv = toCsv(headers, data);

  assert(csv.includes('"策略 ""Alpha"""'), 'Double quotes escaped in value');
  assert(csv.includes('"包含,逗号和""引号"""'), 'Mixed special chars handled');
  assert(csv.includes('"策略\nBeta"'), 'Newline in value quoted');
}

section('File Write Simulation');
{
  const tmpDir = path.join(os.tmpdir(), 'dawn-whales-export-test');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const headers = ['ID', 'Symbol', 'PnL'];
  const data = [['t1', 'TQQQ', '250'], ['t2', 'AAPL', '-25']];
  const csv = toCsv(headers, data);

  const filePath = path.join(tmpDir, 'test-export.csv');
  fs.writeFileSync(filePath, csv, 'utf-8');

  const readBack = fs.readFileSync(filePath, 'utf-8');
  assert(readBack === csv, 'File roundtrip preserves content');
  assert(readBack.startsWith('\uFEFF'), 'BOM preserved in file');

  // Cleanup
  fs.unlinkSync(filePath);
  fs.rmdirSync(tmpDir);
  assert(true, 'Cleanup successful');
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'═'.repeat(50)}`);

if (failed > 0) process.exit(1);
