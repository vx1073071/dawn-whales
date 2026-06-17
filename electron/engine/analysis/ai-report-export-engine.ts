// ── R285 JVS-3 AIReportExportEngine ────────────────────
// AI报告导出引擎：7种报告类型 → 生成/导出/定时
// 定价：2 USDT/次 (v17.6 盈利模型)
// 导出格式：PDF/HTML/JSON

import { EngineError } from '../../../electron/engine/core/engine-error';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type ReportType =
  | 'technical'     // 技术面分析
  | 'fundamental'   // 基本面分析
  | 'backtest'      // 回测报告
  | 'alert'         // 异动告警
  | 'comparison'    // 多资产对比
  | 'weekly'        // 周度报告
  | 'monthly';      // 月度报告

export type ExportFormat = 'pdf' | 'html' | 'json';

export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface ReportRequest {
  reportId: string;
  type: ReportType;
  userId: string;
  symbol?: string;
  symbols?: string[];
  strategyId?: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeIndicators: boolean;
  includeFactors: boolean;
  exportFormat: ExportFormat;
  language: 'zh-CN' | 'en';
  createdAt: number;
  completedAt?: number;
  status: ReportStatus;
  price: number; // USDT
}

export interface ReportSection {
  title: string;
  titleCn: string;
  content: string;
  chartRefs?: string[];
  tableData?: Record<string, unknown>[];
  aiAnalysis?: string;
}

export interface GeneratedReport {
  reportId: string;
  type: ReportType;
  userId: string;
  generatedAt: number;
  sections: ReportSection[];
  summary: string;
  disclaimer: string;
  metadata: {
    symbols: string[];
    dataFreshness: number; // timestamp of newest data
    generationTimeMs: number;
    model: string;
  };
}

export interface ScheduledReport {
  scheduleId: string;
  userId: string;
  type: ReportType;
  symbol: string;
  recurrency: 'daily' | 'weekly' | 'monthly';
  hour: number; // 0-23 UTC
  exportFormat: ExportFormat;
  includeCharts: boolean;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  nextRun?: number;
}

export interface ReportExportResult {
  success: boolean;
  reportId: string;
  format: ExportFormat;
  filePath: string;
  sizeBytes: number;
  price: number;
  generatedAt: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════
// Report templates (content structure for each type)
// ═══════════════════════════════════════════════════════

const REPORT_TEMPLATES: Record<ReportType, { sections: Array<{ key: string; title: string; titleCn: string }>; estimatedMs: number }> = {
  technical: {
    sections: [
      { key: 'overview', title: 'Technical Overview', titleCn: '技术概览' },
      { key: 'candlestick', title: 'Candlestick Patterns', titleCn: 'K线形态' },
      { key: 'indicators', title: 'Technical Indicators', titleCn: '技术指标' },
      { key: 'drawing', title: 'Drawing Analysis', titleCn: '画线分析' },
      { key: 'support_resistance', title: 'Support & Resistance', titleCn: '支撑阻力' },
      { key: 'volume_profile', title: 'Volume Profile', titleCn: '成交量分布' },
      { key: 'signals', title: 'Signal Summary', titleCn: '信号汇总' },
    ],
    estimatedMs: 3000,
  },
  fundamental: {
    sections: [
      { key: 'overview', title: 'Company Overview', titleCn: '公司概览' },
      { key: 'financials', title: 'Financial Statements', titleCn: '财务报表' },
      { key: 'valuation', title: 'Valuation Metrics', titleCn: '估值指标' },
      { key: 'growth', title: 'Growth Analysis', titleCn: '成长分析' },
      { key: 'competition', title: 'Competitive Position', titleCn: '竞争地位' },
      { key: 'risk', title: 'Risk Assessment', titleCn: '风险评估' },
    ],
    estimatedMs: 5000,
  },
  backtest: {
    sections: [
      { key: 'summary', title: 'Backtest Summary', titleCn: '回测概要' },
      { key: 'returns', title: 'Returns Analysis', titleCn: '收益分析' },
      { key: 'risk_metrics', title: 'Risk Metrics', titleCn: '风险指标' },
      { key: 'drawdown', title: 'Drawdown Analysis', titleCn: '回撤分析' },
      { key: 'positions', title: 'Position History', titleCn: '持仓历史' },
      { key: 'benchmark', title: 'Benchmark Comparison', titleCn: '基准对比' },
      { key: 'factor_attribution', title: 'Factor Attribution', titleCn: '因子归因' },
      { key: 'optimization', title: 'Optimization Suggestions', titleCn: '优化建议' },
    ],
    estimatedMs: 8000,
  },
  alert: {
    sections: [
      { key: 'event', title: 'Alert Event', titleCn: '异动事件' },
      { key: 'context', title: 'Market Context', titleCn: '市场背景' },
      { key: 'impact', title: 'Impact Analysis', titleCn: '影响分析' },
      { key: 'related', title: 'Related Assets', titleCn: '相关资产' },
    ],
    estimatedMs: 1500,
  },
  comparison: {
    sections: [
      { key: 'overview', title: 'Comparison Overview', titleCn: '对比总览' },
      { key: 'returns', title: 'Returns Comparison', titleCn: '收益对比' },
      { key: 'risk', title: 'Risk Comparison', titleCn: '风险对比' },
      { key: 'factors', title: 'Factor Exposure', titleCn: '因子暴露' },
      { key: 'correlation', title: 'Correlation Matrix', titleCn: '相关性矩阵' },
      { key: 'recommendation', title: 'Recommendation', titleCn: '推荐结论' },
    ],
    estimatedMs: 6000,
  },
  weekly: {
    sections: [
      { key: 'market_summary', title: 'Market Summary', titleCn: '市场总结' },
      { key: 'biggest_movers', title: 'Biggest Movers', titleCn: '最大涨幅' },
      { key: 'sector_rotation', title: 'Sector Rotation', titleCn: '板块轮动' },
      { key: 'macro_events', title: 'Macro Events', titleCn: '宏观事件' },
      { key: 'outlook', title: 'Next Week Outlook', titleCn: '下周展望' },
    ],
    estimatedMs: 4000,
  },
  monthly: {
    sections: [
      { key: 'executive_summary', title: 'Executive Summary', titleCn: '执行摘要' },
      { key: 'market_review', title: 'Market Review', titleCn: '市场回顾' },
      { key: 'strategy_performance', title: 'Strategy Performance', titleCn: '策略表现' },
      { key: 'factor_analysis', title: 'Factor Analysis', titleCn: '因子分析' },
      { key: 'risk_report', title: 'Risk Report', titleCn: '风险报告' },
      { key: 'allocation', title: 'Asset Allocation', titleCn: '资产配置' },
      { key: 'crypto_section', title: 'Crypto Section', titleCn: '加密市场' },
      { key: 'trades_review', title: 'Trade Review', titleCn: '交易回顾' },
      { key: 'fees_summary', title: 'Fees Summary', titleCn: '费用汇总' },
      { key: 'ai_recommendations', title: 'AI Recommendations', titleCn: 'AI建议' },
      { key: 'next_month_plan', title: 'Next Month Plan', titleCn: '下月计划' },
    ],
    estimatedMs: 10000,
  },
};

// ═══════════════════════════════════════════════════════
// Pricing
// ═══════════════════════════════════════════════════════

const REPORT_PRICE_USDT = 2; // v17.6: AI报告导出 2 USDT/次

// ═══════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════

export class AIReportExportEngine {
  private reports: Map<string, ReportRequest> = new Map();
  private generatedReports: Map<string, GeneratedReport> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();

  reset(): void {
    this.reports.clear();
    this.generatedReports.clear();
    this.scheduledReports.clear();
  }

  // ═══════════════════════════════════════════════
  // Report Creation
  // ═══════════════════════════════════════════════

  createReport(params: {
    type: ReportType;
    userId: string;
    symbol?: string;
    symbols?: string[];
    strategyId?: string;
    startDate?: string;
    endDate?: string;
    includeCharts?: boolean;
    includeIndicators?: boolean;
    includeFactors?: boolean;
    exportFormat?: ExportFormat;
    language?: 'zh-CN' | 'en';
  }): ReportRequest {
    const reportId = `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const request: ReportRequest = {
      reportId,
      type: params.type,
      userId: params.userId,
      symbol: params.symbol,
      symbols: params.symbols,
      strategyId: params.strategyId,
      startDate: params.startDate,
      endDate: params.endDate,
      includeCharts: params.includeCharts ?? true,
      includeIndicators: params.includeIndicators ?? true,
      includeFactors: params.includeFactors ?? false,
      exportFormat: params.exportFormat ?? 'pdf',
      language: params.language ?? 'zh-CN',
      createdAt: Date.now(),
      status: 'pending',
      price: REPORT_PRICE_USDT,
    };

    this.reports.set(reportId, request);
    return request;
  }

  // ═══════════════════════════════════════════════
  // Report Generation
  // ═══════════════════════════════════════════════

  generate(reportId: string): GeneratedReport {
    const request = this.reports.get(reportId);
    if (!request) throw new EngineError(`Report ${reportId} not found`);

    const startTime = Date.now();

    // Update status
    const updated: ReportRequest = { ...request, status: 'generating' };
    this.reports.set(reportId, updated);

    // Build sections from template
    const template = REPORT_TEMPLATES[request.type];
    const sections: ReportSection[] = template.sections.map((sec) => ({
      title: sec.title,
      titleCn: sec.titleCn,
      content: this.generateSectionContent(request, sec.key),
      chartRefs: request.includeCharts ? [`${request.symbol ?? 'default'}_${sec.key}`] : undefined,
      tableData: [],
      aiAnalysis: `AI analysis for ${sec.titleCn} based on ${request.symbol ?? 'multi-asset'} data.`,
    }));

    const generationTimeMs = Date.now() - startTime;

    const report: GeneratedReport = {
      reportId,
      type: request.type,
      userId: request.userId,
      generatedAt: Date.now(),
      sections,
      summary: this.generateSummary(request, sections.length),
      disclaimer: request.language === 'zh-CN'
        ? '本报告由 Dawn Whales AI 自动生成，仅供参考，不构成投资建议。历史表现不代表未来收益。'
        : 'This report is auto-generated by Dawn Whales AI. For reference only; not investment advice. Past performance does not guarantee future results.',
      metadata: {
        symbols: request.symbols ?? (request.symbol ? [request.symbol] : []),
        dataFreshness: Date.now(),
        generationTimeMs,
        model: 'Dawn-Whales-AI-Report-v1',
      },
    };

    this.generatedReports.set(reportId, report);

    // Mark as completed
    const completed: ReportRequest = { ...updated, status: 'completed', completedAt: Date.now() };
    this.reports.set(reportId, completed);

    return report;
  }

  private generateSectionContent(request: ReportRequest, sectionKey: string): string {
    const lang = request.language;
    const symbol = request.symbol ?? 'N/A';
    const baseContent: Record<string, Record<string, string>> = {
      overview: {
        en: `Overview analysis for ${symbol}. Key metrics, trend indicators, and market positioning summary.`,
        'zh-CN': `${symbol} 概览分析。核心指标、趋势判断、市场定位总结。`,
      },
      summary: {
        en: `Executive summary of ${request.type} report for ${symbol}.`,
        'zh-CN': `${request.type} 报告执行摘要 — ${symbol}。`,
      },
      signals: {
        en: `Signal summary: buy/sell signals generated from ${request.includeIndicators ? 'indicators' : ''}${request.includeIndicators && request.includeFactors ? ' and ' : ''}${request.includeFactors ? 'factor models' : ''}.`,
        'zh-CN': `信号汇总：${request.includeIndicators ? '指标' : ''}${request.includeIndicators && request.includeFactors ? '和' : ''}${request.includeFactors ? '因子模型' : ''}生成的买卖信号。`,
      },
      outlook: {
        en: `Forward-looking analysis: expected trends, key levels to watch, and risk scenarios for the coming period.`,
        'zh-CN': `前瞻分析：预期趋势、关注的关键水平、风险情景。`,
      },
      recommendation: {
        en: `AI recommendation based on ${request.type} analysis. Confidence level and suggested position sizing.`,
        'zh-CN': `基于${request.type}分析的AI建议。置信度和建议仓位。`,
      },
    };

    return baseContent[sectionKey]?.[lang] ??
           `Content for section '${sectionKey}' of ${request.type} report.`;
  }

  private generateSummary(request: ReportRequest, sectionCount: number): string {
    const lang = request.language;
    const symbol = request.symbol ?? 'portfolio';
    if (lang === 'zh-CN') {
      return `本${this.getReportTypeName(request.type, 'zh-CN')}报告覆盖${symbol}，包含${sectionCount}个分析板块。` +
             `生成时间: ${new Date().toISOString().slice(0, 10)}。数据来源: 实时行情 + AI模型分析。`;
    }
    return `${this.getReportTypeName(request.type, 'en')} report for ${symbol}, ${sectionCount} sections. ` +
           `Generated: ${new Date().toISOString().slice(0, 10)}. Source: real-time quotes + AI analysis.`;
  }

  // ═══════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════

  export(reportId: string, format?: ExportFormat): ReportExportResult {
    const request = this.reports.get(reportId);
    const report = this.generatedReports.get(reportId);

    if (!request) return this.exportError(reportId, 'Report not found');
    if (request.status !== 'completed') return this.exportError(reportId, 'Report not yet generated');

    const exportFormat = format ?? request.exportFormat;
    const basePath = `reports/${request.userId}/${request.type}`;
    const ext = exportFormat === 'html' ? 'html' : exportFormat === 'json' ? 'json' : 'pdf';
    const filePath = `${basePath}/${reportId}.${ext}`;

    // In production: actual file generation
    // Here: metadata only — file generation is done by renderer process
    const sizeEstimate = this.estimateReportSize(request.type, exportFormat);

    return {
      success: true,
      reportId,
      format: exportFormat,
      filePath,
      sizeBytes: sizeEstimate,
      price: request.price,
      generatedAt: Date.now(),
    };
  }

  private exportError(reportId: string, error: string): ReportExportResult {
    return {
      success: false,
      reportId,
      format: 'pdf',
      filePath: '',
      sizeBytes: 0,
      price: 0,
      generatedAt: Date.now(),
      error,
    };
  }

  private estimateReportSize(type: ReportType, format: ExportFormat): number {
    const sectionCount = REPORT_TEMPLATES[type].sections.length;
    const basePerSection = { pdf: 8000, html: 5000, json: 12000 };
    return sectionCount * (basePerSection[format] ?? 8000);
  }

  // ═══════════════════════════════════════════════
  // Scheduling
  // ═══════════════════════════════════════════════

  scheduleReport(params: {
    userId: string;
    type: ReportType;
    symbol: string;
    recurrency: 'daily' | 'weekly' | 'monthly';
    hour: number;
    exportFormat?: ExportFormat;
    includeCharts?: boolean;
  }): ScheduledReport {
    const scheduleId = `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    const nextRun = this.calculateNextRun(params.recurrency, params.hour);

    const schedule: ScheduledReport = {
      scheduleId,
      userId: params.userId,
      type: params.type,
      symbol: params.symbol,
      recurrency: params.recurrency,
      hour: params.hour,
      exportFormat: params.exportFormat ?? 'pdf',
      includeCharts: params.includeCharts ?? true,
      enabled: true,
      createdAt: now,
      nextRun,
    };

    this.scheduledReports.set(scheduleId, schedule);
    return schedule;
  }

  private calculateNextRun(recurrency: string, hour: number): number {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(hour, 0, 0, 0);

    if (next.getTime() <= now.getTime()) {
      switch (recurrency) {
        case 'daily': next.setUTCDate(next.getUTCDate() + 1); break;
        case 'weekly': next.setUTCDate(next.getUTCDate() + 7); break;
        case 'monthly': next.setUTCMonth(next.getUTCMonth() + 1); break;
      }
    }

    return next.getTime();
  }

  getScheduledReport(scheduleId: string): ScheduledReport | undefined {
    return this.scheduledReports.get(scheduleId);
  }

  getUserSchedules(userId: string): ScheduledReport[] {
    return Array.from(this.scheduledReports.values())
      .filter((s) => s.userId === userId);
  }

  disableSchedule(scheduleId: string): ScheduledReport {
    const schedule = this.scheduledReports.get(scheduleId);
    if (!schedule) throw new EngineError(`Schedule ${scheduleId} not found`);
    const updated = { ...schedule, enabled: false, nextRun: undefined };
    this.scheduledReports.set(scheduleId, updated);
    return updated;
  }

  // ═══════════════════════════════════════════════
  // Queries
  // ═══════════════════════════════════════════════

  getReport(reportId: string): ReportRequest | undefined {
    return this.reports.get(reportId);
  }

  getGeneratedReport(reportId: string): GeneratedReport | undefined {
    return this.generatedReports.get(reportId);
  }

  getUserReports(userId: string): ReportRequest[] {
    return Array.from(this.reports.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getReportTemplate(type: ReportType): { sections: Array<{ key: string; title: string; titleCn: string }>; estimatedMs: number } {
    return REPORT_TEMPLATES[type];
  }

  getAvailableReportTypes(): ReportType[] {
    return Object.keys(REPORT_TEMPLATES) as ReportType[];
  }

  getReportPrice(): number {
    return REPORT_PRICE_USDT;
  }

  // ═══════════════════════════════════════════════
  // Report type display names
  // ═══════════════════════════════════════════════

  getReportTypeName(type: ReportType, lang: 'zh-CN' | 'en'): string {
    const names: Record<ReportType, { en: string; 'zh-CN': string }> = {
      technical: { en: 'Technical Analysis', 'zh-CN': '技术面分析' },
      fundamental: { en: 'Fundamental Analysis', 'zh-CN': '基本面分析' },
      backtest: { en: 'Backtest', 'zh-CN': '回测' },
      alert: { en: 'Alert', 'zh-CN': '异动告警' },
      comparison: { en: 'Comparison', 'zh-CN': '多资产对比' },
      weekly: { en: 'Weekly', 'zh-CN': '周度' },
      monthly: { en: 'Monthly', 'zh-CN': '月度' },
    };
    return names[type][lang];
  }

  // ═══════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════

  getStats(): {
    totalReports: number;
    completedReports: number;
    pendingReports: number;
    totalRevenue: number;
    activeSchedules: number;
    avgGenerationMs: number;
  } {
    const reports = Array.from(this.reports.values());
    const completed = reports.filter((r) => r.status === 'completed');
    const generated = Array.from(this.generatedReports.values());
    const avgMs = generated.length > 0
      ? generated.reduce((s, r) => s + r.metadata.generationTimeMs, 0) / generated.length
      : 0;

    return {
      totalReports: reports.length,
      completedReports: completed.length,
      pendingReports: reports.filter((r) => r.status === 'pending').length,
      totalRevenue: completed.length * REPORT_PRICE_USDT,
      activeSchedules: Array.from(this.scheduledReports.values()).filter((s) => s.enabled).length,
      avgGenerationMs: Math.round(avgMs),
    };
  }
}

// ═══════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════

let instance: AIReportExportEngine | null = null;

export function getAIReportExport(): AIReportExportEngine {
  if (!instance) instance = new AIReportExportEngine();
  return instance;
}

export function resetAIReportExport(): void {
  instance?.reset();
  instance = null;
}
