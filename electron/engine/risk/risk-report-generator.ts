// ── Q48: Risk Report Generator ────────────────────────────────────────────────
// Multi-format risk report (HTML/PDF-ready/Markdown)
// Client/investor-facing + Internal ops format
// Branding + Charts placeholder + Full P&L attribution

import log from 'electron-log';
import i18n from '../../../src/i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RiskReportConfig {
  format: 'HTML' | 'PDF' | 'MARKDOWN';
  audience: 'CLIENT' | 'INTERNAL' | 'REGULATORY';
  language: 'ZH' | 'EN';
  includeCharts: boolean;
  includeIndividualPositions: boolean;
  includeGreeks: boolean;
  includeStressTests: boolean;
  branding: {
    firmName?: string;
    logoUrl?: string;
    primaryColor?: string;
    contactEmail?: string;
  };
}

export interface RiskReportData {
  // Header
  reportDate: string;
  portfolioId: string;
  portfolioName: string;
  generatedAt: string;
  period: string;

  // Performance
  totalValue: number;
  totalPnL: number;
  totalPnLPct: number;
  dayPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;

  // Risk metrics
  portfolioVaR: number;
  portfolioCVaR: number;
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  beta: number;
  leverage: number;

  // Exposure
  exposureByAsset: Record<string, number>;
  exposureBySector: Record<string, number>;
  exposureByRegion: Record<string, number>;
  largestPosition: string;
  largestPositionPct: number;
  netExposure: number;
  grossExposure: number;

  // Greeks
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    netDelta: number;
    directionalBias: string;
  };

  // Stress tests
  stressResults?: Array<{
    scenario: string;
    severity: string;
    shockLoss: number;
  }>;

  // Positions
  positions?: Array<{
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    weight: number;
  }>;

  // Recommendations
  riskAlerts: Array<{ severity: string; message: string }>;
  recommendations: string[];
}

// ── Report Generator ─────────────────────────────────────────────────────

export class RiskReportGenerator {
  constructor() {
    log.info('[RiskReportGenerator] Initialized');
  }

  // ── Generate Report ─────────────────────────────────────────────────

  generate(data: RiskReportData, config: RiskReportConfig): string {
    log.info(`[RiskReport] Generating ${config.format} report for ${data.portfolioId}`);

    switch (config.format) {
      case 'HTML': return this.generateHTML(data, config);
      case 'MARKDOWN': return this.generateMarkdown(data, config);
      case 'PDF':
      default:
        // PDF is generated from HTML via browser print
        return this.generateHTML(data, config);
    }
  }

  // ── HTML Report ────────────────────────────────────────────────────

  private generateHTML(data: RiskReportData, config: RiskReportConfig): string {
    const brand = config.branding;
    const primary = brand.primaryColor ?? '#1a56db';
    const firm = brand.firmName ?? 'DAWN WHALES';
    const lang = config.language;

    const sign = (n: number, unit = '') => {
      const s = n >= 0 ? '+' : '';
      return `${s}${unit}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit}`;
    };

    const pnlClass = data.totalPnL >= 0 ? 'positive' : 'negative';
    const dayClass = data.dayPnL >= 0 ? 'positive' : 'negative';
    const varClass = data.portfolioVaR > data.totalValue * 0.05 ? 'warning' : '';

    const positions = data.positions?.slice(0, config.includeIndividualPositions ? 50 : 5) ?? [];
    const alerts = data.riskAlerts ?? [];

    const zh = (en: string, zhStr: string) => lang === 'ZH' ? zhStr : en;

    return `<!DOCTYPE html>
<html lang="${lang === 'ZH' ? 'zh-CN' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${zh('Risk Report', i18n.t('riskReportGenerator.k1'))} — ${data.portfolioName} — ${data.reportDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: #f8f9fa; font-size: 13px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid ${primary}; padding-bottom: 16px; }
  .firm { font-size: 22px; font-weight: 700; color: ${primary}; }
  .report-title { font-size: 20px; font-weight: 600; margin-top: 4px; }
  .report-meta { text-align: right; font-size: 12px; color: #666; line-height: 1.8; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .card { background: white; border-radius: 10px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .card-title { font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .metric { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
  .metric:last-child { border-bottom: none; }
  .metric-label { color: #555; font-size: 12px; }
  .metric-value { font-weight: 600; font-size: 14px; font-variant-numeric: tabular-nums; }
  .positive { color: #059669; }
  .negative { color: #dc2626; }
  .warning { color: #d97706; }
  .alert { padding: 10px 14px; border-radius: 6px; margin-bottom: 8px; font-size: 12px; }
  .alert-CRITICAL { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .alert-WARNING { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .alert-INFO { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  tr:hover td { background: #f8fafc; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 15px; font-weight: 700; color: ${primary}; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid ${primary}; }
  .bar-chart { display: flex; flex-direction: column; gap: 8px; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-label { width: 80px; font-size: 11px; color: #666; text-align: right; }
  .bar-track { flex: 1; height: 18px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; background: ${primary}; border-radius: 4px; transition: width 0.3s; }
  .bar-value { width: 50px; font-size: 11px; color: #666; text-align: right; }
  .greeks-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .greek-box { text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; }
  .greek-label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .greek-value { font-size: 18px; font-weight: 700; }
  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .disclaimer { font-size: 10px; color: #aaa; margin-top: 8px; line-height: 1.5; }
  @media print { body { background: white; } .card { box-shadow: none; border: 1px solid #e5e7eb; } }
</style>
</head>
<body>
<div class="container">

<!-- Header -->
<div class="header">
  <div>
    <div class="firm">${firm}</div>
    <div class="report-title">${zh('Portfolio Risk Report', i18n.t('riskReportGenerator.k2'))}</div>
  </div>
  <div class="report-meta">
    <div><strong>${data.portfolioName}</strong> (${data.portfolioId})</div>
    <div>${zh('Report Date', i18n.t('riskReportGenerator.k3'))}: ${data.reportDate}</div>
    <div>${zh('Generated', i18n.t('riskReportGenerator.k4'))}: ${data.generatedAt}</div>
    <div>${zh('Period', i18n.t('riskReportGenerator.k5'))}: ${data.period}</div>
  </div>
</div>

<!-- Key Metrics -->
<div class="grid">
  <div class="card">
    <div class="card-title">${zh('Portfolio Value', i18n.t('riskReportGenerator.k6'))}</div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k7')metric-value">HK$${(data.totalValue / 10000).toFixed(1)}${i18n.t('RiskReportGenerator.k0')}
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k8')metric-value ${dayClass}">${sign(data.dayPnL, 'HK$')} (${(data.dayPnL / data.totalValue * 100).toFixed(2)}%)</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k9')metric-value ${pnlClass}">${sign(data.totalPnL, 'HK$')} (${sign(data.totalPnLPct)}%)</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k10')metric-value">${sign(data.unrealizedPnL, 'HK$')}</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k11')metric-value">${sign(data.realizedPnL, 'HK$')}</span></div>
  </div>
  <div class="card">
    <div class="card-title">${zh('Risk Metrics', i18n.t('riskReportGenerator.k12'))}</div>
    <div class="metric"><span class="metric-label">VaR (95%)</span><span class="metric-value ${varClass}">HK$${(data.portfolioVaR / 10000).toFixed(1)}${i18n.t('RiskReportGenerator.k1')}
    <div class="metric"><span class="metric-label">CVaR (95%)</span><span class="metric-value">HK$${(data.portfolioCVaR / 10000).toFixed(1)}${i18n.t('RiskReportGenerator.k2')}
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k13')metric-value">${(data.volatility * 100).toFixed(2)}%</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k14')metric-value negative">${(data.maxDrawdown).toFixed(2)}%</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k15')metric-value">${data.sharpeRatio.toFixed(2)}</span></div>
    <div class="metric"><span class="metric-label">Beta</span><span class="metric-value">${data.beta.toFixed(2)}</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k16')metric-value">${data.leverage.toFixed(2)}x</span></div>
  </div>
  <div class="card">
    <div class="card-title">${zh('Exposure Summary', i18n.t('riskReportGenerator.k17'))}</div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k18')metric-value">${data.largestPosition} (${data.largestPositionPct.toFixed(1)}%)</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k19')metric-value">${(data.netExposure * 100).toFixed(1)}%</span></div>
    <div class="metric"><span class="metric-labeli18n.t('riskReportGenerator.k20')metric-value">${(data.grossExposure * 100).toFixed(1)}%</span></div>
  </div>
</div>

<!-- Risk Alerts -->
${alerts.length > 0 ? `
<div class="section">
  <div class="section-title">⚠️ ${zh('Risk Alerts', i18n.t('riskReportGenerator.k21'))}</div>
  ${alerts.map(a => `<div class="alert alert-${a.severity}">${a.severity === 'CRITICAL' ? '🚨' : a.severity === 'WARNING' ? '⚠️' : 'ℹ️'} ${a.message}</div>`).join('\n  ')}
</div>` : ''}

<!-- Greeks -->
${config.includeGreeks && data.greeks ? `
<div class="section">
  <div class="section-title">${zh('Options Greeks', i18n.t('riskReportGenerator.k22'))}</div>
  <div class="greeks-grid">
    <div class="greek-box"><div class="greek-label">Delta (Δ)</div><div class="greek-value">${data.greeks.delta.toFixed(1)}</div></div>
    <div class="greek-box"><div class="greek-label">Gamma (Γ)</div><div class="greek-value">${data.greeks.gamma.toFixed(2)}</div></div>
    <div class="greek-box"><div class="greek-label">Theta (Θ)</div><div class="greek-value ${data.greeks.theta >= 0 ? 'positive' : 'negative'}">${sign(data.greeks.theta)}/day</div></div>
    <div class="greek-box"><div class="greek-label">Vega (ν)</div><div class="greek-value">${data.greeks.vega.toFixed(1)}</div></div>
    <div class="greek-box"><div class="greek-label">Net Delta</div><div class="greek-value">${data.greeks.netDelta.toFixed(1)}</div></div>
  </div>
  <div style="margin-top:8px;font-size:12px;color:#666;">Directional Bias: <strong>${data.greeks.directionalBias}</strong></div>
</div>` : ''}

<!-- Exposure Breakdown -->
<div class="section">
  <div class="section-title">${zh('Asset Exposure', i18n.t('riskReportGenerator.k23'))}</div>
  <div class="bar-chart">
    ${Object.entries(data.exposureByAsset).sort((a,b) => b[1]-a[1]).slice(0,8).map(([sym, pct]) => `
    <div class="bar-row">
      <span class="bar-label">${sym}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, pct)}%"></div></div>
      <span class="bar-value">${pct.toFixed(1)}%</span>
    </div>`).join('')}
  </div>
</div>

<!-- Positions -->
${config.includeIndividualPositions && positions.length > 0 ? `
<div class="section">
  <div class="section-title">${zh('Positions Detail', i18n.t('riskReportGenerator.k24'))}</div>
  <table>
    <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Market Value</th><th>P&L</th><th>Weight</th></tr></thead>
    <tbody>
      ${positions.map(p => {
        const pnlClass2 = p.unrealizedPnL >= 0 ? 'positive' : 'negative';
        return `<tr>
          <td><strong>${p.symbol}</strong></td>
          <td>${p.quantity.toLocaleString()}</td>
          <td>$${p.avgCost.toFixed(2)}</td>
          <td>$${p.currentPrice.toFixed(2)}</td>
          <td>HK$${(p.marketValue/10000).toFixed(1)}万</td>
          <td class="${pnlClass2}">${sign(p.unrealizedPnL, 'HK$')}</td>
          <td>${p.weight.toFixed(2)}%</td>
        </tr>`;
      }).join('\n    ')}
    </tbody>
  </table>
</div>` : ''}

<!-- Stress Tests -->
${config.includeStressTests && data.stressResults && data.stressResults.length > 0 ? `
<div class="section">
  <div class="section-title">${zh('Stress Test Results', i18n.t('riskReportGenerator.k25'))}</div>
  <table>
    <thead><tr><th>Scenario</th><th>Severity</th><th>P&L Impact</th></tr></thead>
    <tbody>
      ${data.stressResults.map(s => {
        const sevClass = s.severity === 'CRISIS' ? 'negative' : s.severity === 'SEVERE' ? 'warning' : '';
        return `<tr>
          <td>${s.scenario}</td>
          <td><span class="${sevClass}">${s.severity}</span></td>
          <td class="${s.shockLoss < 0 ? 'negative' : 'positive'}">${sign(s.shockLoss, 'HK$')}</td>
        </tr>`;
      }).join('\n    ')}
    </tbody>
  </table>
</div>` : ''}

<!-- Recommendations -->
${data.recommendations.length > 0 ? `
<div class="section">
  <div class="section-title">${zh('Recommendations', i18n.t('riskReportGenerator.k26'))}</div>
  ${data.recommendations.map(r => `<div style="padding:6px 0;font-size:13px;">• ${r}</div>`).join('\n')}
</div>` : ''}

<!-- Footer -->
<div class="footer">
  ${zh('Generated by DAWN WHALES Risk Engine', i18n.t('riskReportGenerator.k27'))} · ${new Date().toISOString()}
  <div class="disclaimer">
    ${zh('This report is for informational purposes only and does not constitute investment advice. Past performance is not indicative of future results.', i18n.t('riskReportGenerator.k28'))}
  </div>
</div>

</div>
</body>
</html>`;
  }

  // ── Markdown Report ─────────────────────────────────────────────────

  private generateMarkdown(data: RiskReportData, config: RiskReportConfig): string {
    const lang = config.language;
    const zh = (en: string, zhStr: string) => lang === 'ZH' ? zhStr : en;
    const sign = (n: number) => n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);

    const lines = [
      `# ${zh('Portfolio Risk Report', i18n.t('riskReportGenerator.k29'))}`,
      `**${data.portfolioName}** (${data.portfolioId})  ·  ${data.reportDate}`,
      '',
      `## ${zh('Performance', i18n.t('riskReportGenerator.k30'))}`,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| ${zh('Total Value', i18n.t('riskReportGenerator.k31'))} | HK$${(data.totalValue/10000).toFixed(1)}万 |`,
      `| ${zh('Day P&L', i18n.t('riskReportGenerator.k32'))} | ${sign(data.dayPnL)} (${sign(data.dayPnL/data.totalValue*100)}%) |`,
      `| ${zh('Total P&L', i18n.t('riskReportGenerator.k33'))} | ${sign(data.totalPnL)} (${sign(data.totalPnLPct)}%) |`,
      `| ${zh('Unrealized', i18n.t('riskReportGenerator.k34'))} | ${sign(data.unrealizedPnL)} |`,
      `| ${zh('Realized', i18n.t('riskReportGenerator.k35'))} | ${sign(data.realizedPnL)} |`,
      '',
      `## ${zh('Risk Metrics', i18n.t('riskReportGenerator.k36'))}`,
      `| Metric | Value |`,
      `|--------|-------|`,
      i18n.t('riskReportGenerator.k37'),
      i18n.t('riskReportGenerator.k38'),
      `| ${zh('Volatility', i18n.t('riskReportGenerator.k39'))} | ${(data.volatility*100).toFixed(2)}% |`,
      `| ${zh('Max Drawdown', i18n.t('riskReportGenerator.k40'))} | ${data.maxDrawdown.toFixed(2)}% |`,
      `| ${zh('Sharpe Ratio', i18n.t('riskReportGenerator.k41'))} | ${data.sharpeRatio.toFixed(2)} |`,
      `| Beta | ${data.beta.toFixed(2)} |`,
      `| ${zh('Leverage', i18n.t('riskReportGenerator.k42'))} | ${data.leverage.toFixed(2)}x |`,
      '',
      `## ${zh('Exposure', i18n.t('riskReportGenerator.k43'))}`,
      ...Object.entries(data.exposureByAsset)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 10)
        .map(([sym, pct]) => `- **${sym}**: ${pct.toFixed(1)}%`),
      '',
      `## ${zh('Risk Alerts', i18n.t('riskReportGenerator.k44'))}`,
      ...(data.riskAlerts ?? []).map(a => `- **${a.severity}**: ${a.message}`),
      '',
      `## ${zh('Recommendations', i18n.t('riskReportGenerator.k45'))}`,
      ...data.recommendations.map(r => `- ${r}`),
      '',
      `---`,
      `*${zh('Generated by DAWN WHALES Risk Engine', i18n.t('riskReportGenerator.k46'))} · ${new Date().toISOString()}*`,
    ];

    return lines.join('\n');
  }

  // ── Save to File ───────────────────────────────────────────────────

  async saveReport(html: string, filename: string): Promise<string> {
    // In Electron context, would use fs
    log.info(`[RiskReport] Would save ${filename} (${html.length} bytes)`);
    return filename;
  }
}

export default RiskReportGenerator;