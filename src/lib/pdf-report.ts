// ── DAWN WHALES — PDF Report Generator (print-to-PDF) ──────────────────────

interface ReportData {
  title: string;
  subtitle?: string;
  sections: {
    heading: string;
    type: 'table' | 'metrics' | 'text' | 'chart';
    data: unknown;
  }[];
  footer?: string;
}

interface MetricItem {
  label: string;
  value: string;
  color?: string;
}

export function generatePDFReport(report: ReportData): void {
  const now = new Date().toLocaleString('zh-CN');
  const html = buildReportHTML(report, now);

  // Open print window
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  // Auto-trigger print dialog after content loads
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };
}

function buildReportHTML(report: ReportData, timestamp: string): string {
  const sectionsHTML = report.sections.map((section) => {
    switch (section.type) {
      case 'metrics':
        return buildMetricsHTML(section.heading, section.data as MetricItem[]);
      case 'table':
        return buildTableHTML(section.heading, section.data);
      case 'text':
        return `<h3>${section.heading}</h3><p>${section.data}</p>`;
      default:
        return '';
    }
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${report.title}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #c9a96e; padding-bottom: 15px; }
    .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 4px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .header .timestamp { color: #999; font-size: 10px; margin-top: 8px; }
    .brand { color: #c9a96e; font-size: 10px; letter-spacing: 2px; }
    h3 { font-size: 14px; color: #1a1a2e; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .metric { background: #f8f9fa; border-radius: 8px; padding: 12px; text-align: center; }
    .metric .label { font-size: 10px; color: #666; margin-bottom: 4px; }
    .metric .value { font-size: 18px; font-weight: bold; }
    .green { color: #16a34a; }
    .red { color: #dc2626; }
    .gold { color: #c9a96e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #f8f9fa; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; color: #999; font-size: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">DAWN WHALES · 道鲸</div>
    <h1>${report.title}</h1>
    ${report.subtitle ? `<div class="subtitle">${report.subtitle}</div>` : ''}
    <div class="timestamp">生成时间: ${timestamp}</div>
  </div>

  ${sectionsHTML}

  <div class="footer">
    ${report.footer || '本报告由道鲸·AI量化系统自动生成，仅供参考，不构成投资建议。'}
    <br/>DAWN WHALES v0.4.0 · ${timestamp}
  </div>
</body>
</html>`;
}

function buildMetricsHTML(heading: string, metrics: MetricItem[]): string {
  const items = metrics.map((m) => {
    const colorClass = m.color || '';
    return `<div class="metric">
      <div class="label">${m.label}</div>
      <div class="value ${colorClass}">${m.value}</div>
    </div>`;
  }).join('\n');
  return `<h3>${heading}</h3><div class="metrics">${items}</div>`;
}

function buildTableHTML(heading: string, data: { headers: string[]; rows: (string | number)[][] }): string {
  const headerRow = data.headers.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = data.rows.map((row) =>
    `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
  ).join('\n');
  return `<h3>${heading}</h3>
    <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

// ── Helper: Convert backtest result to report format ──────────────────────

export function backtestToReport(result: unknown): ReportData {
  const isProfit = (result as any).totalReturn >= 0;
  return {
    title: `回测报告: ${(result as any).strategyName || '策略'}`,
    subtitle: `${(result as any).targetCode} · ${(result as any).startDate} ~ ${(result as any).endDate}`,
    sections: [
      {
        heading: '绩效摘要',
        type: 'metrics',
        data: [
          { label: '总收益', value: `${((result as any).totalReturn * 100).toFixed(2)}%`, color: isProfit ? 'green' : 'red' },
          { label: '年化收益', value: `${((result as any).annualizedReturn * 100).toFixed(2)}%`, color: isProfit ? 'green' : 'red' },
          { label: '最大回撤', value: `${((result as any).maxDrawdown * 100).toFixed(2)}%`, color: 'red' },
          { label: '夏普比率', value: (result as any).sharpeRatio.toFixed(2), color: (result as any).sharpeRatio >= 1 ? 'green' : '' },
          { label: '胜率', value: `${((result as any).winRate * 100).toFixed(1)}%` },
          { label: '盈亏比', value: (result as any).profitLossRatio.toFixed(2) },
          { label: '总交易', value: `${(result as any).totalTrades}` },
          { label: '最终资金', value: `$${(result as any).finalCapital.toFixed(0)}` },
        ],
      },
      {
        heading: '交易明细',
        type: 'table',
        data: {
          headers: ['入场日期', '方向', '入场价', '出场日期', '出场价', '盈亏', '盈亏%', '持有天数'],
          rows: ((result as any).trades || []).map((t: Record<string, unknown>) => [
            t.entryDate, t.side, t.entryPrice.toFixed(2), t.exitDate, t.exitPrice.toFixed(2),
            `${t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}`,
            `${(t.pnlPercent * 100).toFixed(2)}%`,
            t.holdingDays,
          ]),
        },
      },
    ],
  };
}
