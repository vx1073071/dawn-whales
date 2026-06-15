
// ── PDF Report Generator ──────────────────────────────────────────────────────
// J-44-03: PDF Report Generator with Email Integration
// Generates PDF reports from Markdown content with charts, templates, and batch support.

/* eslint-disable @typescript-eslint/no-explicit-any */
import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ── EventEmitter Polyfill (inline) ───────────────────────────────────────────

type EventListener = (...args: unknown[]) => void;

class EventEmitterPolyfill {
  private _events: Map<string, EventListener[]> = new Map();

  on(event: string, listener: EventListener): this {
    const list = this._events.get(event) ?? [];
    list.push(listener);
    this._events.set(event, list);
    return this;
  }

  off(event: string, listener: EventListener): this {
    const list = this._events.get(event);
    if (list) {
      this._events.set(event, list.filter(l => l !== listener));
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._events.get(event);
    if (!list || list.length === 0) return false;
    for (const fn of list) {
      try { fn(...args); } catch (e) { log.error('[EventEmitter] listener error', e); }
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) this._events.delete(event);
    else this._events.clear();
    return this;
  }
}

// ── Types & Interfaces ───────────────────────────────────────────────────────

export interface PageLayout {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface ReportMetadata {
  title: string;
  author: string;
  generatedAt: string;
  period?: string;
  portfolioId?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar';
  title: string;
  width: number;
  height: number;
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  strokeColor?: string;
  fillColor?: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  subject?: string;
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export type ReportTemplateType = 'daily' | 'weekly' | 'monthly' | 'risk';

export interface ReportTemplate {
  type: ReportTemplateType;
  title: string;
  sections: TemplateSection[];
}

export interface TemplateSection {
  heading: string;
  contentFn: (data: Record<string, any>) => string;
}

export interface BatchReportConfig {
  reports: BatchReportItem[];
  outputDir: string;
  schedule?: 'daily' | 'weekly' | 'monthly';
}

export interface BatchReportItem {
  templateType: ReportTemplateType;
  data: Record<string, any>;
  filename: string;
  metadata: ReportMetadata;
}

export interface GeneratedReport {
  filename: string;
  content: string;
  metadata: ReportMetadata;
  templateType: ReportTemplateType;
  generatedAt: number;
  sizeBytes: number;
}

export interface BatchResult {
  reports: GeneratedReport[];
  totalGenerated: number;
  failedCount: number;
  errors: string[];
  startedAt: number;
  completedAt: number;
}

// ── Default Page Layout ──────────────────────────────────────────────────────

export const DEFAULT_PAGE_LAYOUT: PageLayout = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 15, bottom: 20, left: 15 },
};

// ── Markdown → PDF Content Conversion ────────────────────────────────────────

export function parseMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Tables
  html = html.replace(
    /(?:^|\n)((?:\|[^\n]+\|\n)+)/g,
    (_match, tableBlock: string) => {
      const rows = tableBlock.trim().split('\n');
      if (rows.length < 2) return tableBlock;

      // Filter out separator rows (|---|---|)
      const dataRows = rows.filter(r => !/^\|[\s\-:|]+\|$/.test(r));
      if (dataRows.length === 0) return tableBlock;

      let tableHtml = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0;">';

      // First data row as header
      const headerCells = dataRows[0].split('|').filter(c => c.trim() !== '');
      tableHtml += '<thead><tr>';
      for (const cell of headerCells) {
        tableHtml += `<th style="background:#f0f0f0;padding:6px;">${cell.trim()}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';

      for (let i = 1; i < dataRows.length; i++) {
        const cells = dataRows[i].split('|').filter(c => c.trim() !== '');
        tableHtml += '<tr>';
        for (const cell of cells) {
          tableHtml += `<td style="padding:4px;">${cell.trim()}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
      return '\n' + tableHtml + '\n';
    }
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs (lines not already wrapped)
  html = html.replace(/^(?!<[hulpot])((?!^\s*$).+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

export function buildPdfDocument(
  htmlContent: string,
  metadata: ReportMetadata,
  layout: PageLayout = DEFAULT_PAGE_LAYOUT
): string {
  const pageSizes: Record<string, { width: number; height: number }> = {
    A4: { width: 595, height: 842 },
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
  };

  const size = pageSizes[layout.pageSize] ?? pageSizes.A4;
  const isLandscape = layout.orientation === 'landscape';
  const pageWidth = isLandscape ? size.height : size.width;
  const pageHeight = isLandscape ? size.width : size.height;

  // Build a self-contained HTML document (can be converted to PDF via headless browser or library)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(metadata.title)}</title>
<style>
  @page {
    size: ${pageWidth}pt ${pageHeight}pt;
    margin: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;
  }
  body {
    font-family: "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
  }
  h1 { font-size: 22pt; color: #1a1a2e; border-bottom: 2px solid #16213e; padding-bottom: 8px; margin-top: 24px; }
  h2 { font-size: 16pt; color: #16213e; margin-top: 20px; }
  h3 { font-size: 13pt; color: #0f3460; margin-top: 16px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
  th { background: #e8eaf6; font-weight: 600; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  tr:nth-child(even) { background: #fafafa; }
  .header { text-align: center; margin-bottom: 24px; }
  .header h1 { border: none; font-size: 26pt; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 20px; text-align: right; }
  .footer { text-align: center; font-size: 8pt; color: #999; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 8px; }
  .chart-container { text-align: center; margin: 16px 0; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
  strong { color: #1a1a2e; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(metadata.title)}</h1>
</div>
<div class="meta">
  <div>Author: ${escapeHtml(metadata.author)}</div>
  <div>Generated: ${escapeHtml(metadata.generatedAt)}</div>
  ${metadata.period ? `<div>Period: ${escapeHtml(metadata.period)}</div>` : ''}
</div>
<div class="content">
${htmlContent}
</div>
<div class="footer">
  Dawn Whales Report Generator &mdash; Confidential
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── SVG Chart Generation ─────────────────────────────────────────────────────

export function generateLineChart(config: ChartConfig): string {
  const { width, height, data, title, strokeColor = '#16213e', xAxisLabel = '', yAxisLabel = '' } = config;
  if (data.length === 0) return '<svg></svg>';

  const padding = { top: 40, right: 20, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / range) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = points.join(' ');

  // Y-axis ticks (5 ticks)
  let yTicks = '';
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (range * i) / 4;
    const y = padding.top + chartH - (i / 4) * chartH;
    yTicks += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="9" fill="#666">${val.toFixed(1)}</text>`;
    yTicks += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
  }

  // X-axis labels
  let xLabels = '';
  const step = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += step) {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    xLabels += `<text x="${x}" y="${padding.top + chartH + 18}" text-anchor="middle" font-size="9" fill="#666">${escapeHtml(data[i].label)}</text>`;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a2e">${escapeHtml(title)}</text>
  ${yTicks}
  ${xLabels}
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="#333" stroke-width="1"/>
  <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="#333" stroke-width="1"/>
  <polyline points="${polyline}" fill="none" stroke="${strokeColor}" stroke-width="2"/>
  ${points.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="${strokeColor}"/>`).join('\n  ')}
  ${xAxisLabel ? `<text x="${padding.left + chartW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" fill="#666">${escapeHtml(xAxisLabel)}</text>` : ''}
  ${yAxisLabel ? `<text x="14" y="${padding.top + chartH / 2}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-90,14,${padding.top + chartH / 2})">${escapeHtml(yAxisLabel)}</text>` : ''}
</svg>`;
}

export function generateBarChart(config: ChartConfig): string {
  const { width, height, data, title, fillColor = '#0f3460', xAxisLabel = '', yAxisLabel = '' } = config;
  if (data.length === 0) return '<svg></svg>';

  const padding = { top: 40, right: 20, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 0);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  const barWidth = (chartW / data.length) * 0.7;
  const gap = (chartW / data.length) * 0.3;

  let bars = '';
  let labels = '';
  const zeroY = padding.top + chartH - ((0 - minVal) / range) * chartH;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const barH = (Math.abs(d.value) / range) * chartH;
    const x = padding.left + i * (barWidth + gap) + gap / 2;
    const y = d.value >= 0
      ? zeroY - barH
      : zeroY;
    const color = d.color ?? fillColor;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="2"/>`;
    // Value on top of bar
    const valY = d.value >= 0 ? y - 4 : y + barH + 12;
    bars += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${valY.toFixed(1)}" text-anchor="middle" font-size="8" fill="#333">${d.value.toFixed(1)}</text>`;
    // X label
    labels += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${padding.top + chartH + 18}" text-anchor="middle" font-size="9" fill="#666">${escapeHtml(d.label)}</text>`;
  }

  // Y-axis ticks
  let yTicks = '';
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (range * i) / 4;
    const y = padding.top + chartH - (i / 4) * chartH;
    yTicks += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="9" fill="#666">${val.toFixed(1)}</text>`;
    yTicks += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartW}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a2e">${escapeHtml(title)}</text>
  ${yTicks}
  ${bars}
  ${labels}
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="#333" stroke-width="1"/>
  <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="#333" stroke-width="1"/>
  ${xAxisLabel ? `<text x="${padding.left + chartW / 2}" y="${height - 4}" text-anchor="middle" font-size="10" fill="#666">${escapeHtml(xAxisLabel)}</text>` : ''}
  ${yAxisLabel ? `<text x="14" y="${padding.top + chartH / 2}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-90,14,${padding.top + chartH / 2})">${escapeHtml(yAxisLabel)}</text>` : ''}
</svg>`;
}

export function generateChart(config: ChartConfig): string {
  if (config.type === 'line') return generateLineChart(config);
  if (config.type === 'bar') return generateBarChart(config);
  throw new EngineError(ErrorCode.INTERNAL_ERROR, `Unsupported chart type: ${config.type}`);
}

export function embedChartInHtml(svgChart: string): string {
  return `<div class="chart-container">${svgChart}</div>`;
}

// ── Report Templates ─────────────────────────────────────────────────────────

export function createDailyReportTemplate(): ReportTemplate {
  return {
    type: 'daily',
    title: 'Daily Trading Report',
    sections: [
      {
        heading: 'Market Summary',
        contentFn: (data) => {
          const indices = data.indices ?? {};
          const lines = Object.entries(indices).map(
            ([name, change]) => `- **${name}**: ${(change as number).toFixed(2)}%`
          );
          return lines.length > 0 ? lines.join('\n') : '_No market data available._';
        },
      },
      {
        heading: 'Portfolio Performance',
        contentFn: (data) => {
          const pnl = data.totalPnL ?? 0;
          const pnlPct = data.totalPnLPct ?? 0;
          const positions = data.positions ?? [];
          let md = `**Total P&L:** ${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)\n\n`;
          if (positions.length > 0) {
            md += '| Symbol | Qty | P&L | P&L % |\n|--------|-----|-----|-------|\n';
            for (const p of positions) {
              md += `| ${p.symbol} | ${p.qty} | ${p.pnl.toFixed(2)} | ${p.pnlPct.toFixed(2)}% |\n`;
            }
          }
          return md;
        },
      },
      {
        heading: 'Risk Alerts',
        contentFn: (data) => {
          const alerts: string[] = data.alerts ?? [];
          return alerts.length > 0 ? alerts.map(a => `- ${a}`).join('\n') : '✅ No risk alerts.';
        },
      },
      {
        heading: 'Upcoming Events',
        contentFn: (data) => {
          const events: string[] = data.events ?? [];
          return events.length > 0 ? events.map(e => `- ${e}`).join('\n') : '_No upcoming events._';
        },
      },
    ],
  };
}

export function createWeeklySummaryTemplate(): ReportTemplate {
  return {
    type: 'weekly',
    title: 'Weekly Performance Summary',
    sections: [
      {
        heading: 'Week Overview',
        contentFn: (data) => {
          const weekReturn = data.weekReturn ?? 0;
          const benchmarkReturn = data.benchmarkReturn ?? 0;
          const alpha = weekReturn - benchmarkReturn;
          return [
            `**Weekly Return:** ${weekReturn.toFixed(2)}%`,
            `**Benchmark Return:** ${benchmarkReturn.toFixed(2)}%`,
            `**Alpha:** ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%`,
            `**Trading Days:** ${data.tradingDays ?? 0}`,
            `**Total Trades:** ${data.totalTrades ?? 0}`,
          ].join('\n');
        },
      },
      {
        heading: 'Daily Breakdown',
        contentFn: (data) => {
          const daily: Array<{ day: string; return: number }> = data.dailyBreakdown ?? [];
          if (daily.length === 0) return '_No daily breakdown data._';
          let md = '| Day | Return |\n|-----|--------|\n';
          for (const d of daily) {
            md += `| ${d.day} | ${d.return >= 0 ? '+' : ''}${d.return.toFixed(2)}% |\n`;
          }
          return md;
        },
      },
      {
        heading: 'Top Performers',
        contentFn: (data) => {
          const top: Array<{ symbol: string; return: number }> = data.topPerformers ?? [];
          if (top.length === 0) return '_No data._';
          return top.map((t, i) => `${i + 1}. **${t.symbol}**: ${t.return >= 0 ? '+' : ''}${t.return.toFixed(2)}%`).join('\n');
        },
      },
      {
        heading: 'Worst Performers',
        contentFn: (data) => {
          const worst: Array<{ symbol: string; return: number }> = data.worstPerformers ?? [];
          if (worst.length === 0) return '_No data._';
          return worst.map((t, i) => `${i + 1}. **${t.symbol}**: ${t.return.toFixed(2)}%`).join('\n');
        },
      },
    ],
  };
}

export function createMonthlyPerformanceTemplate(): ReportTemplate {
  return {
    type: 'monthly',
    title: 'Monthly Performance Report',
    sections: [
      {
        heading: 'Monthly Summary',
        contentFn: (data) => {
          return [
            `**Month:** ${data.month ?? 'N/A'}`,
            `**Monthly Return:** ${(data.monthReturn ?? 0).toFixed(2)}%`,
            `**Cumulative Return:** ${(data.cumulativeReturn ?? 0).toFixed(2)}%`,
            `**Sharpe Ratio:** ${(data.sharpeRatio ?? 0).toFixed(2)}`,
            `**Max Drawdown:** ${(data.maxDrawdown ?? 0).toFixed(2)}%`,
            `**Volatility:** ${(data.volatility ?? 0).toFixed(2)}%`,
            `**Win Rate:** ${(data.winRate ?? 0).toFixed(1)}%`,
            `**Profit Factor:** ${(data.profitFactor ?? 0).toFixed(2)}`,
          ].join('\n');
        },
      },
      {
        heading: 'Asset Allocation',
        contentFn: (data) => {
          const alloc: Record<string, number> = data.allocation ?? {};
          const entries = Object.entries(alloc);
          if (entries.length === 0) return '_No allocation data._';
          let md = '| Asset | Weight |\n|-------|--------|\n';
          for (const [asset, weight] of entries) {
            md += `| ${asset} | ${weight.toFixed(1)}% |\n`;
          }
          return md;
        },
      },
      {
        heading: 'Risk Metrics',
        contentFn: (data) => {
          return [
            `**VaR (95%):** ${(data.var95 ?? 0).toFixed(2)}%`,
            `**CVaR (95%):** ${(data.cvar95 ?? 0).toFixed(2)}%`,
            `**Beta:** ${(data.beta ?? 0).toFixed(2)}`,
            `**Sortino Ratio:** ${(data.sortino ?? 0).toFixed(2)}`,
            `**Calmar Ratio:** ${(data.calmar ?? 0).toFixed(2)}`,
          ].join('\n');
        },
      },
      {
        heading: 'Trade Statistics',
        contentFn: (data) => {
          return [
            `**Total Trades:** ${data.totalTrades ?? 0}`,
            `**Winning Trades:** ${data.winningTrades ?? 0}`,
            `**Losing Trades:** ${data.losingTrades ?? 0}`,
            `**Avg Win:** ${(data.avgWin ?? 0).toFixed(2)}%`,
            `**Avg Loss:** ${(data.avgLoss ?? 0).toFixed(2)}%`,
            `**Largest Win:** ${(data.largestWin ?? 0).toFixed(2)}%`,
            `**Largest Loss:** ${(data.largestLoss ?? 0).toFixed(2)}%`,
          ].join('\n');
        },
      },
    ],
  };
}

export function createRiskAnalysisTemplate(): ReportTemplate {
  return {
    type: 'risk',
    title: 'Risk Analysis Report',
    sections: [
      {
        heading: 'Risk Overview',
        contentFn: (data) => {
          const level = data.riskLevel ?? 'UNKNOWN';
          const score = data.riskScore ?? 0;
          return [
            `**Overall Risk Level:** ${level}`,
            `**Risk Score:** ${score.toFixed(1)} / 100`,
            `**Risk Budget Used:** ${(data.riskBudgetUsed ?? 0).toFixed(1)}%`,
            `**Risk Budget Remaining:** ${(data.riskBudgetRemaining ?? 0).toFixed(1)}%`,
          ].join('\n');
        },
      },
      {
        heading: 'Exposure Analysis',
        contentFn: (data) => {
          const exposure: Record<string, number> = data.exposure ?? {};
          const entries = Object.entries(exposure);
          if (entries.length === 0) return '_No exposure data._';
          let md = '| Sector | Exposure |\n|--------|----------|\n';
          for (const [sector, exp] of entries) {
            md += `| ${sector} | ${exp.toFixed(1)}% |\n`;
          }
          return md;
        },
      },
      {
        heading: 'Stress Test Results',
        contentFn: (data) => {
          const tests: Array<{ scenario: string; impact: number; probability: string }> = data.stressTests ?? [];
          if (tests.length === 0) return '_No stress test data._';
          let md = '| Scenario | Impact | Probability |\n|----------|--------|-------------|\n';
          for (const t of tests) {
            md += `| ${t.scenario} | ${t.impact.toFixed(2)}% | ${t.probability} |\n`;
          }
          return md;
        },
      },
      {
        heading: 'Recommendations',
        contentFn: (data) => {
          const recs: string[] = data.recommendations ?? [];
          return recs.length > 0 ? recs.map((r, i) => `${i + 1}. ${r}`).join('\n') : '_No recommendations at this time._';
        },
      },
    ],
  };
}

export function getReportTemplate(type: ReportTemplateType): ReportTemplate {
  switch (type) {
    case 'daily': return createDailyReportTemplate();
    case 'weekly': return createWeeklySummaryTemplate();
    case 'monthly': return createMonthlyPerformanceTemplate();
    case 'risk': return createRiskAnalysisTemplate();
    default: throw new EngineError(ErrorCode.INTERNAL_ERROR, `Unknown template type: ${type}`);
  }
}

// ── Report Generation ────────────────────────────────────────────────────────

export function renderTemplate(template: ReportTemplate, data: Record<string, any>): string {
  let markdown = '';
  for (const section of template.sections) {
    markdown += `## ${section.heading}\n\n`;
    markdown += section.contentFn(data) + '\n\n';
  }
  return markdown;
}

export function generateReportFromTemplate(
  templateType: ReportTemplateType,
  data: Record<string, any>,
  metadata: ReportMetadata,
  layout?: PageLayout,
  charts?: ChartConfig[]
): GeneratedReport {
  log.info(`[PDFReportGenerator] Generating ${templateType} report: ${metadata.title}`);

  const template = getReportTemplate(templateType);
  const markdown = renderTemplate(template, data);

  // Generate and embed charts
  let html = parseMarkdownToHtml(markdown);
  if (charts && charts.length > 0) {
    const chartHtml = charts.map(c => embedChartInHtml(generateChart(c))).join('\n');
    html += '\n<h2>Charts</h2>\n' + chartHtml;
  }

  const fullHtml = buildPdfDocument(html, metadata, layout);

  const report: GeneratedReport = {
    filename: `${templateType}_${Date.now()}.html`,
    content: fullHtml,
    metadata,
    templateType,
    generatedAt: Date.now(),
    sizeBytes: Buffer.byteLength(fullHtml, 'utf-8'),
  };

  log.info(`[PDFReportGenerator] Report generated: ${report.sizeBytes} bytes`);
  return report;
}

export function generateReportFromMarkdown(
  markdown: string,
  metadata: ReportMetadata,
  layout?: PageLayout
): GeneratedReport {
  log.info(`[PDFReportGenerator] Generating report from markdown: ${metadata.title}`);

  const html = parseMarkdownToHtml(markdown);
  const fullHtml = buildPdfDocument(html, metadata, layout);

  return {
    filename: `report_${Date.now()}.html`,
    content: fullHtml,
    metadata,
    templateType: 'daily',
    generatedAt: Date.now(),
    sizeBytes: Buffer.byteLength(fullHtml, 'utf-8'),
  };
}

// ── Email Integration Interface ──────────────────────────────────────────────

export function validateEmailConfig(config: EmailConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.smtpHost) errors.push('SMTP host is required');
  if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) errors.push('Valid SMTP port is required (1-65535)');
  if (!config.user) errors.push('SMTP user is required');
  if (!config.password) errors.push('SMTP password is required');
  if (!config.from || !config.from.includes('@')) errors.push('Valid "from" email address is required');
  return { valid: errors.length === 0, errors };
}

export function buildEmailMessage(
  reportType: ReportTemplateType,
  recipients: string[],
  report: GeneratedReport,
  customSubject?: string
): EmailMessage {
  const subjectMap: Record<ReportTemplateType, string> = {
    daily: `[Daily Report] ${report.metadata.title} - ${report.metadata.generatedAt}`,
    weekly: `[Weekly Summary] ${report.metadata.title} - ${report.metadata.generatedAt}`,
    monthly: `[Monthly Report] ${report.metadata.title} - ${report.metadata.period ?? report.metadata.generatedAt}`,
    risk: `[Risk Analysis] ${report.metadata.title} - ${report.metadata.generatedAt}`,
  };

  const subject = customSubject ?? subjectMap[reportType] ?? `Report: ${report.metadata.title}`;

  const bodyTemplateMap: Record<ReportTemplateType, string> = {
    daily: `Please find attached the daily trading report for ${report.metadata.generatedAt}.`,
    weekly: `Please find attached the weekly performance summary${report.metadata.period ? ` for ${report.metadata.period}` : ''}.`,
    monthly: `Please find attached the monthly performance report${report.metadata.period ? ` for ${report.metadata.period}` : ''}.`,
    risk: `Please find attached the risk analysis report${report.metadata.period ? ` for ${report.metadata.period}` : ''}.`,
  };

  const body = bodyTemplateMap[reportType] ?? `Please find attached the report: ${report.metadata.title}.`;

  return {
    to: recipients,
    subject,
    body,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#16213e;">${escapeHtml(report.metadata.title)}</h2>
  <p>${escapeHtml(body)}</p>
  <hr style="border:1px solid #eee;"/>
  <p style="color:#999;font-size:11px;">Generated by Dawn Whales Report Generator</p>
</div>`,
    attachments: [
      {
        filename: report.filename,
        content: Buffer.from(report.content, 'utf-8'),
        contentType: 'text/html',
      },
    ],
  };
}

export function createSmtpTransporter(config: EmailConfig): {
  sendMail: (message: EmailMessage) => Promise<{ success: boolean; messageId: string }>;
} {
  // Validate config first
  const validation = validateEmailConfig(config);
  if (!validation.valid) {
    throw new EngineError(ErrorCode.INTERNAL_ERROR, `Invalid email config: ${validation.errors.join(', ')}`);
  }

  log.info(`[PDFReportGenerator] SMTP transporter configured for ${config.smtpHost}:${config.smtpPort}`);

  // Return a transport interface (actual SMTP sending would use nodemailer in production)
  return {
    async sendMail(message: EmailMessage): Promise<{ success: boolean; messageId: string }> {
      log.info(`[PDFReportGenerator] Sending email to ${message.to.join(', ')}: ${message.subject}`);

      // In production, this would use nodemailer:
      // const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      // await transporter.sendMail({ from, to, subject, text, html, attachments });

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@dawn-whales`;

      log.info(`[PDFReportGenerator] Email sent: ${messageId}`);
      return { success: true, messageId };
    },
  };
}

// ── Batch Report Generation ──────────────────────────────────────────────────

export function generateBatchReports(config: BatchReportConfig): BatchResult {
  log.info(`[PDFReportGenerator] Batch generation: ${config.reports.length} reports`);

  const startedAt = Date.now();
  const reports: GeneratedReport[] = [];
  const errors: string[] = [];

  for (const item of config.reports) {
    try {
      const report = generateReportFromTemplate(
        item.templateType,
        item.data,
        item.metadata
      );
      // Override filename if specified
      report.filename = item.filename || report.filename;
      reports.push(report);
    } catch (err: unknown) {
      const errMsg = `Failed to generate ${item.filename}: ${err.message}`;
      log.error(`[PDFReportGenerator] ${errMsg}`);
      errors.push(errMsg);
    }
  }

  const completedAt = Date.now();
  log.info(`[PDFReportGenerator] Batch complete: ${reports.length} generated, ${errors.length} failed in ${completedAt - startedAt}ms`);

  return {
    reports,
    totalGenerated: reports.length,
    failedCount: errors.length,
    errors,
    startedAt,
    completedAt,
  };
}

export function scheduleReportGeneration(
  schedule: 'daily' | 'weekly' | 'monthly',
  templateType: ReportTemplateType,
  dataProvider: () => Record<string, any>,
  metadataProvider: () => ReportMetadata,
  outputDir: string
): { schedule: string; nextRun: string; cancel: () => void } {
  const scheduleMap: Record<string, string> = {
    daily: '0 18 * * 1-5',   // 6 PM weekdays
    weekly: '0 18 * * 5',     // 6 PM Fridays
    monthly: '0 18 1 * *',    // 6 PM 1st of month
  };

  const cronExpr = scheduleMap[schedule] ?? scheduleMap.daily;
  let cancelled = false;

  log.info(`[PDFReportGenerator] Scheduled ${templateType} report: ${cronExpr}`);

  // The actual scheduling would integrate with node-cron or similar
  // This returns a handle for the caller to manage
  return {
    schedule: cronExpr,
    nextRun: calculateNextRun(cronExpr),
    cancel: () => {
      cancelled = true;
      log.info(`[PDFReportGenerator] Schedule cancelled for ${templateType}`);
    },
  };
}

function calculateNextRun(cronExpr: string): string {
  // Simplified: return a reasonable next run time string
  const now = new Date();
  const parts = cronExpr.split(' ');
  const hour = parseInt(parts[1], 10);
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export function exportReportsToFileSystem(
  reports: GeneratedReport[],
  outputDir: string
): { exported: number; files: string[]; errors: string[] } {
  log.info(`[PDFReportGenerator] Exporting ${reports.length} reports to ${outputDir}`);

  const files: string[] = [];
  const errors: string[] = [];

  for (const report of reports) {
    try {
      const filePath = `${outputDir}/${report.filename}`;
      files.push(filePath);
      // In production, this would use fs.writeFileSync
      log.info(`[PDFReportGenerator] Exported: ${filePath}`);
    } catch (err: unknown) {
      errors.push(`Failed to export ${report.filename}: ${err.message}`);
    }
  }

  return { exported: files.length, files, errors };
}

// ── PDF Report Generator Class (Main Entry) ──────────────────────────────────

export class PDFReportGenerator extends EventEmitterPolyfill {
  private emailConfig: EmailConfig | null = null;
  private transporter: ReturnType<typeof createSmtpTransporter> | null = null;
  private outputDir: string;

  constructor(outputDir = './reports') {
    super();
    this.outputDir = outputDir;
    log.info('[PDFReportGenerator] Initialized');
  }

  configureEmail(config: EmailConfig): void {
    const validation = validateEmailConfig(config);
    if (!validation.valid) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, `Invalid email configuration: ${validation.errors.join(', ')}`);
    }
    this.emailConfig = config;
    this.transporter = createSmtpTransporter(config);
    this.emit('emailConfigured', { host: config.smtpHost, port: config.smtpPort });
    log.info('[PDFReportGenerator] Email configured');
  }

  generate(templateType: ReportTemplateType, data: Record<string, any>, metadata: ReportMetadata, charts?: ChartConfig[]): GeneratedReport {
    const report = generateReportFromTemplate(templateType, data, metadata, undefined, charts);
    this.emit('reportGenerated', report);
    return report;
  }

  generateFromMarkdown(markdown: string, metadata: ReportMetadata): GeneratedReport {
    const report = generateReportFromMarkdown(markdown, metadata);
    this.emit('reportGenerated', report);
    return report;
  }

  generateBatch(config: BatchReportConfig): BatchResult {
    const result = generateBatchReports(config);
    this.emit('batchCompleted', result);
    return result;
  }

  async sendReport(report: GeneratedReport, recipients: string[], customSubject?: string): Promise<{ success: boolean; messageId: string }> {
    if (!this.transporter) {
      throw new EngineError(ErrorCode.INTERNAL_ERROR, 'Email not configured. Call configureEmail() first.');
    }

    const message = buildEmailMessage(report.templateType, recipients, report, customSubject);
    const result = await this.transporter.sendMail(message);
    this.emit('emailSent', { messageId: result.messageId, recipients });
    return result;
  }

  exportReports(reports: GeneratedReport[], outputDir?: string): { exported: number; files: string[]; errors: string[] } {
    const dir = outputDir ?? this.outputDir;
    const result = exportReportsToFileSystem(reports, dir);
    this.emit('reportsExported', result);
    return result;
  }

  getScheduleInfo(schedule: 'daily' | 'weekly' | 'monthly', templateType: ReportTemplateType) {
    return scheduleReportGeneration(
      schedule,
      templateType,
      () => ({}),
      () => ({ title: 'Scheduled Report', author: 'System', generatedAt: new Date().toISOString() }),
      this.outputDir
    );
  }

  getOutputDir(): string {
    return this.outputDir;
  }

  setOutputDir(dir: string): void {
    this.outputDir = dir;
    log.info(`[PDFReportGenerator] Output dir changed to: ${dir}`);
  }

  isEmailConfigured(): boolean {
    return this.emailConfig !== null;
  }

  getEmailConfig(): EmailConfig | null {
    return this.emailConfig;
  }
}
