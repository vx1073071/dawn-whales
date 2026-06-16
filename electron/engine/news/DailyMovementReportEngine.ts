/**
 * P2-19 DailyMovementReportEngine — Daily Market Movement Report Engine
 * R251 — P2 Deepening
 * JVS / 引擎虾
 *
 * Generates structured daily movement reports across multiple markets.
 * Covers top gainers/losers, volume anomalies, volatility spikes, fund flow
 * patterns. Supports template-based report generation, push notifications,
 * and JSON/CSV export. Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type MovementCategory =
  | 'top_gainers'
  | 'top_losers'
  | 'volume_surge'
  | 'volume_drop'
  | 'volatility_spike'
  | 'fund_inflow'
  | 'fund_outflow'
  | 'gap_up'
  | 'gap_down'
  | 'new_high'
  | 'new_low'
  | 'turnover_surge';

export type MarketGroup = 'US' | 'HK' | 'CRYPTO' | 'FUTURES' | 'OPTIONS';

export type ReportFormat = 'json' | 'csv' | 'markdown' | 'text';

export interface MovementEntry {
  symbol: string;
  market: MarketGroup;
  category: MovementCategory;
  value: number; // percentage or ratio
  rank: number; // 1-N within category
  metricDetail: string; // e.g. "+12.5% change"
  volumeRatio?: number; // vs 20-day avg
  timestamp: number;
  note?: string;
}

export interface MovementSummary {
  category: MovementCategory;
  market: MarketGroup;
  entryCount: number;
  topEntry: MovementEntry | null;
  avgValue: number;
  maxValue: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface DailyMovementReport {
  id: string;
  date: string; // YYYY-MM-DD
  generatedAt: number;
  markets: MarketGroup[];
  entries: MovementEntry[];
  summaries: MovementSummary[];
  headline: string;
  highlights: string[];
  alertCount: number;
  template: string;
}

export interface ReportTemplate {
  name: string;
  categories: MovementCategory[];
  markets: MarketGroup[];
  topN: number; // entries per category
  includeCharts: boolean;
  includeAnalysis: boolean;
  pushEnabled: boolean;
  format: ReportFormat;
}

export interface MovementAlert {
  id: string;
  symbol: string;
  category: MovementCategory;
  threshold: number;
  currentValue: number;
  triggeredAt: number;
  message: string;
  acknowledged: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Default Template
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATE: ReportTemplate = {
  name: 'daily_standard',
  categories: ['top_gainers', 'top_losers', 'volume_surge', 'volatility_spike'],
  markets: ['US', 'HK', 'CRYPTO'],
  topN: 5,
  includeCharts: true,
  includeAnalysis: true,
  pushEnabled: false,
  format: 'markdown',
};

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class DailyMovementReportEngine {
  private static instance: DailyMovementReportEngine;

  private entries: MovementEntry[] = [];
  private templates: Map<string, ReportTemplate> = new Map();
  private reports: DailyMovementReport[] = [];
  private alerts: MovementAlert[] = [];
  private idCounter = 0;
  private alertIdCounter = 0;

  private constructor() {
    this.templates.set('daily_standard', { ...DEFAULT_TEMPLATE });
  }

  static getInstance(): DailyMovementReportEngine {
    if (!DailyMovementReportEngine.instance) {
      DailyMovementReportEngine.instance = new DailyMovementReportEngine();
    }
    return DailyMovementReportEngine.instance;
  }

  reset(): void {
    this.entries = [];
    this.templates.clear();
    this.templates.set('daily_standard', { ...DEFAULT_TEMPLATE });
    this.reports = [];
    this.alerts = [];
    this.idCounter = 0;
    this.alertIdCounter = 0;
  }

  private nextId(): string { return `dmre-${++this.idCounter}`; }
  private nextAlertId(): string { return `dmra-${++this.alertIdCounter}`; }

  // ═══════════════════════════════════════════════════════════════
  // Entry Ingestion
  // ═══════════════════════════════════════════════════════════════

  ingestMovement(params: {
    symbol: string;
    market: MarketGroup;
    category: MovementCategory;
    value: number;
    metricDetail: string;
    volumeRatio?: number;
    timestamp?: number;
    note?: string;
  }): MovementEntry {
    const entry: MovementEntry = {
      symbol: params.symbol.toUpperCase(),
      market: params.market,
      category: params.category,
      value: Math.round(params.value * 100) / 100,
      rank: 0,
      metricDetail: params.metricDetail,
      volumeRatio: params.volumeRatio ? Math.round(params.volumeRatio * 100) / 100 : undefined,
      timestamp: params.timestamp || Date.now(),
      note: params.note,
    };
    this.entries.push(entry);
    return entry;
  }

  ingestBatch(movements: Array<{
    symbol: string; market: MarketGroup; category: MovementCategory;
    value: number; metricDetail: string; volumeRatio?: number; note?: string;
  }>): MovementEntry[] {
    return movements.map(m => this.ingestMovement(m));
  }

  // ═══════════════════════════════════════════════════════════════
  // Template Management
  // ═══════════════════════════════════════════════════════════════

  registerTemplate(template: ReportTemplate): void {
    this.templates.set(template.name, { ...template });
    log.info(`[MovementReport] Template registered: ${template.name}`);
  }

  getTemplate(name: string): ReportTemplate | undefined {
    return this.templates.get(name);
  }

  listTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  // ═══════════════════════════════════════════════════════════════
  // Report Generation (Main Entry)
  // ═══════════════════════════════════════════════════════════════

  generateReport(dateStr?: string, templateName?: string): DailyMovementReport {
    const now = Date.now();
    const date = dateStr || new Date(now).toISOString().slice(0, 10);
    const template = templateName
      ? this.templates.get(templateName) || DEFAULT_TEMPLATE
      : DEFAULT_TEMPLATE;

    // Filter entries for today (or specified date)
    const dateStart = new Date(date + 'T00:00:00.000Z').getTime();
    const dateEnd = new Date(date + 'T23:59:59.999Z').getTime();

    let relevantEntries = this.entries.filter(
      e => e.timestamp >= dateStart && e.timestamp <= dateEnd,
    );

    // Filter by template markets
    relevantEntries = relevantEntries.filter(
      e => template.markets.includes(e.market),
    );

    // Filter by template categories
    relevantEntries = relevantEntries.filter(
      e => template.categories.includes(e.category),
    );

    // Sort by absolute value and rank
    relevantEntries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // Take topN per category per market
    const topEntries: MovementEntry[] = [];
    for (const market of template.markets) {
      for (const category of template.categories) {
        const subgroup = relevantEntries
          .filter(e => e.market === market && e.category === category)
          .slice(0, template.topN);
        for (let i = 0; i < subgroup.length; i++) {
          subgroup[i].rank = i + 1;
          topEntries.push(subgroup[i]);
        }
      }
    }

    // Generate summaries
    const summaries = this.generateSummaries(relevantEntries, template);

    // Generate headline and highlights
    const headline = this.generateHeadline(topEntries, date);
    const highlights = this.generateHighlights(topEntries, summaries);

    // Check alerts
    const triggeredAlerts = this.checkAlerts(topEntries);

    const report: DailyMovementReport = {
      id: this.nextId(),
      date,
      generatedAt: now,
      markets: template.markets,
      entries: topEntries,
      summaries,
      headline,
      highlights,
      alertCount: triggeredAlerts.length,
      template: template.name,
    };

    this.reports.push(report);
    log.info(`[MovementReport] Generated ${date}: ${topEntries.length} entries, ${triggeredAlerts.length} alerts`);
    return report;
  }

  // ═══════════════════════════════════════════════════════════════
  // Summaries
  // ═══════════════════════════════════════════════════════════════

  private generateSummaries(entries: MovementEntry[], template: ReportTemplate): MovementSummary[] {
    const summaries: MovementSummary[] = [];

    for (const market of template.markets) {
      for (const category of template.categories) {
        const group = entries.filter(e => e.market === market && e.category === category);
        if (group.length === 0) continue;

        const values = group.map(e => e.value);
        const absValues = values.map(Math.abs);
        const avgVal = values.reduce((s, v) => s + v, 0) / values.length;
        const maxVal = absValues.length > 0 ? Math.max(...absValues) : 0;

        let direction: 'up' | 'down' | 'neutral' = 'neutral';
        const upCount = values.filter(v => v > 0).length;
        const downCount = values.filter(v => v < 0).length;
        if (upCount > downCount * 1.5) direction = 'up';
        else if (downCount > upCount * 1.5) direction = 'down';

        summaries.push({
          category,
          market,
          entryCount: group.length,
          topEntry: group.length > 0 ? group[0] : null,
          avgValue: Math.round(avgVal * 100) / 100,
          maxValue: Math.round(maxVal * 100) / 100,
          direction,
        });
      }
    }

    return summaries;
  }

  private generateHeadline(entries: MovementEntry[], date: string): string {
    if (entries.length === 0) return `Market Movement Report — ${date}: No significant movements detected.`;

    const top = entries.slice(0, 3);
    const symbols = top.map(e => e.symbol).join(', ');
    const biggest = entries.reduce((a, b) => Math.abs(a.value) > Math.abs(b.value) ? a : b);
    const direction = biggest.value > 0 ? 'surge' : 'plunge';

    return `Market Movement Report — ${date}: ${symbols} lead with ${biggest.symbol} ${direction} ${Math.abs(biggest.value).toFixed(1)}%`;
  }

  private generateHighlights(entries: MovementEntry[], summaries: MovementSummary[]): string[] {
    const highlights: string[] = [];

    if (entries.length > 0) {
      const top = entries.slice(0, 5);
      for (const e of top) {
        highlights.push(`${e.symbol} (#${e.rank} ${e.category.replace(/_/g, ' ')}): ${e.metricDetail}`);
      }
    }

    // Add volume anomaly summary
    const volumeAnomalies = summaries.filter(s =>
      s.category === 'volume_surge' || s.category === 'volume_drop',
    );
    if (volumeAnomalies.length > 0) {
      const total = volumeAnomalies.reduce((s, m) => s + m.entryCount, 0);
      highlights.push(`Volume anomalies: ${total} symbols across ${volumeAnomalies.length} markets`);
    }

    // Add volatility summary
    const volSpikes = summaries.filter(s => s.category === 'volatility_spike');
    if (volSpikes.length > 0) {
      highlights.push(`Volatility spikes detected in ${volSpikes.map(s => s.market).join(', ')}`);
    }

    return highlights;
  }

  // ═══════════════════════════════════════════════════════════════
  // Alerts
  // ═══════════════════════════════════════════════════════════════

  setAlertThreshold(category: MovementCategory, threshold: number): void {
    // Threshold is stored per-category for use in checkAlerts
    // We'll store in a simple internal map
    (this as any)._alertThresholds = (this as any)._alertThresholds || {};
    (this as any)._alertThresholds[category] = threshold;
  }

  private checkAlerts(entries: MovementEntry[]): MovementAlert[] {
    const thresholds = (this as any)._alertThresholds || {};
    const newAlerts: MovementAlert[] = [];
    const now = Date.now();

    for (const entry of entries) {
      const threshold = thresholds[entry.category];
      if (threshold !== undefined && Math.abs(entry.value) >= threshold) {
        const alert: MovementAlert = {
          id: this.nextAlertId(),
          symbol: entry.symbol,
          category: entry.category,
          threshold,
          currentValue: entry.value,
          triggeredAt: now,
          message: `${entry.symbol} triggered ${entry.category}: ${entry.metricDetail} (threshold: ${threshold}%)`,
          acknowledged: false,
        };
        this.alerts.push(alert);
        newAlerts.push(alert);
      }
    }

    return newAlerts;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getUnacknowledgedAlerts(): MovementAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  exportReport(report: DailyMovementReport, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.toCsv(report);
      case 'markdown':
        return this.toMarkdown(report);
      case 'text':
        return this.toText(report);
      default:
        return this.toText(report);
    }
  }

  private toCsv(report: DailyMovementReport): string {
    const header = 'symbol,market,category,value,rank,metric_detail,volume_ratio,timestamp';
    const rows = report.entries.map(e =>
      `${e.symbol},${e.market},${e.category},${e.value},${e.rank},"${e.metricDetail}",${e.volumeRatio || ''},${e.timestamp}`,
    );
    return [header, ...rows].join('\n');
  }

  private toMarkdown(report: DailyMovementReport): string {
    let md = `# ${report.headline}\n\n`;
    md += `**Generated:** ${new Date(report.generatedAt).toISOString()}\n`;
    md += `**Markets:** ${report.markets.join(', ')}\n`;
    md += `**Alerts:** ${report.alertCount}\n\n`;

    md += `## Highlights\n\n`;
    for (const h of report.highlights) {
      md += `- ${h}\n`;
    }

    md += `\n## Top Movements\n\n`;
    const top10 = report.entries.slice(0, 10);
    md += `| Symbol | Market | Category | Change | Rank | Note |\n`;
    md += `|--------|--------|----------|--------|------|------|\n`;
    for (const e of top10) {
      md += `| ${e.symbol} | ${e.market} | ${e.category} | ${e.metricDetail} | #${e.rank} | ${e.note || ''} |\n`;
    }

    return md;
  }

  private toText(report: DailyMovementReport): string {
    let text = `${report.headline}\n`;
    text += `${'='.repeat(report.headline.length)}\n\n`;
    text += `Generated: ${new Date(report.generatedAt).toISOString()}\n`;
    text += `Markets: ${report.markets.join(', ')} | Alerts: ${report.alertCount}\n\n`;

    text += `HIGHLIGHTS:\n`;
    for (const h of report.highlights) {
      text += `  • ${h}\n`;
    }

    text += `\nTOP MOVEMENTS:\n`;
    for (const e of report.entries.slice(0, 10)) {
      text += `  #${e.rank} ${e.symbol} (${e.market}) ${e.category}: ${e.metricDetail}\n`;
    }

    return text;
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getLatestReport(): DailyMovementReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  getReportHistory(limit?: number): DailyMovementReport[] {
    return this.reports.slice(-(limit || 10));
  }

  getEntriesByCategory(category: MovementCategory, limit?: number): MovementEntry[] {
    const filtered = this.entries.filter(e => e.category === category);
    filtered.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return limit ? filtered.slice(0, limit) : filtered;
  }

  getEntriesByMarket(market: MarketGroup, limit?: number): MovementEntry[] {
    const filtered = this.entries.filter(e => e.market === market);
    filtered.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return limit ? filtered.slice(0, limit) : filtered;
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  purgeOldEntries(olderThanMs: number = 86400000 * 7): number {
    const cutoff = Date.now() - olderThanMs;
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.timestamp >= cutoff);
    const purged = before - this.entries.length;
    if (purged > 0) log.info(`[MovementReport] Purged ${purged} old entries`);
    return purged;
  }
}
