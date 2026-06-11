import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  PDFReportGenerator,
  parseMarkdownToHtml,
  buildPdfDocument,
  generateLineChart,
  generateBarChart,
  generateChart,
  embedChartInHtml,
  createDailyReportTemplate,
  createWeeklySummaryTemplate,
  createMonthlyPerformanceTemplate,
  createRiskAnalysisTemplate,
  getReportTemplate,
  renderTemplate,
  generateReportFromTemplate,
  generateReportFromMarkdown,
  validateEmailConfig,
  buildEmailMessage,
  createSmtpTransporter,
  generateBatchReports,
  scheduleReportGeneration,
  exportReportsToFileSystem,
  DEFAULT_PAGE_LAYOUT,
  type EmailConfig,
  type ChartConfig,
  type ReportMetadata,
  type BatchReportConfig,
  type GeneratedReport,
} from '../electron/engine/analysis/pdf-report-generator';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMetadata(overrides: Partial<ReportMetadata> = {}): ReportMetadata {
  return {
    title: 'Test Report',
    author: 'Test Author',
    generatedAt: '2026-06-07T10:00:00Z',
    ...overrides,
  };
}

function makeEmailConfig(overrides: Partial<EmailConfig> = {}): EmailConfig {
  return {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    secure: false,
    user: 'user@example.com',
    password: 'secret',
    from: 'noreply@example.com',
    ...overrides,
  };
}

function makeLineChart(): ChartConfig {
  return {
    type: 'line',
    title: 'Portfolio Value',
    width: 600,
    height: 300,
    data: [
      { label: 'Jan', value: 100 },
      { label: 'Feb', value: 105 },
      { label: 'Mar', value: 102 },
      { label: 'Apr', value: 110 },
      { label: 'May', value: 115 },
    ],
    xAxisLabel: 'Month',
    yAxisLabel: 'Value',
  };
}

function makeBarChart(): ChartConfig {
  return {
    type: 'bar',
    title: 'Monthly Returns',
    width: 500,
    height: 250,
    data: [
      { label: 'Jan', value: 2.5, color: '#4caf50' },
      { label: 'Feb', value: -1.3, color: '#f44336' },
      { label: 'Mar', value: 3.1, color: '#4caf50' },
      { label: 'Apr', value: 0.8, color: '#4caf50' },
    ],
  };
}

function makeReport(): GeneratedReport {
  return {
    filename: 'test_report.html',
    content: '<html><body>Test</body></html>',
    metadata: makeMetadata(),
    templateType: 'daily',
    generatedAt: Date.now(),
    sizeBytes: 100,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('PDF Report Generator', () => {
  // 1. Markdown to HTML conversion
  describe('parseMarkdownToHtml', () => {
    it('should convert headers correctly', () => {
      const html = parseMarkdownToHtml('# Title\n## Subtitle\n### Sub3');
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<h2>Subtitle</h2>');
      expect(html).toContain('<h3>Sub3</h3>');
    });

    it('should convert bold and italic', () => {
      const html = parseMarkdownToHtml('**bold** and *italic*');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });

    it('should convert tables', () => {
      const md = '| Name | Value |\n|------|-------|\n| A | 100 |\n| B | 200 |';
      const html = parseMarkdownToHtml(md);
      expect(html).toContain('<table');
      expect(html).toContain('<th');
      expect(html).toContain('Name');
      expect(html).toContain('100');
    });

    it('should convert unordered lists', () => {
      const html = parseMarkdownToHtml('- item 1\n- item 2\n- item 3');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>item 1</li>');
      expect(html).toContain('<li>item 2</li>');
    });
  });

  // 2. PDF document builder
  describe('buildPdfDocument', () => {
    it('should build a valid HTML document with metadata', () => {
      const meta = makeMetadata({ title: 'My Report', author: 'Alice' });
      const doc = buildPdfDocument('<p>Hello</p>', meta);
      expect(doc).toContain('<!DOCTYPE html>');
      expect(doc).toContain('My Report');
      expect(doc).toContain('Alice');
      expect(doc).toContain('<p>Hello</p>');
      expect(doc).toContain('Dawn Whales Report Generator');
    });

    it('should apply custom page layout', () => {
      const meta = makeMetadata();
      const layout = {
        pageSize: 'Letter' as const,
        orientation: 'landscape' as const,
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
      };
      const doc = buildPdfDocument('<p>Test</p>', meta, layout);
      expect(doc).toContain('792pt');  // Letter landscape width
      expect(doc).toContain('612pt');  // Letter landscape height
    });

    it('should include period in meta when provided', () => {
      const meta = makeMetadata({ period: '2026-06' });
      const doc = buildPdfDocument('<p>x</p>', meta);
      expect(doc).toContain('Period: 2026-06');
    });
  });

  // 3. Chart generation
  describe('Chart Generation', () => {
    it('should generate a line chart SVG', () => {
      const svg = generateLineChart(makeLineChart());
      expect(svg).toContain('<svg');
      expect(svg).toContain('Portfolio Value');
      expect(svg).toContain('<polyline');
      expect(svg).toContain('<circle');
      expect(svg).toContain('Month');
      expect(svg).toContain('Value');
    });

    it('should generate a bar chart SVG', () => {
      const svg = generateBarChart(makeBarChart());
      expect(svg).toContain('<svg');
      expect(svg).toContain('Monthly Returns');
      expect(svg).toContain('<rect');
    });

    it('should handle empty data for charts', () => {
      const lineSvg = generateLineChart({ ...makeLineChart(), data: [] });
      expect(lineSvg).toBe('<svg></svg>');

      const barSvg = generateBarChart({ ...makeBarChart(), data: [] });
      expect(barSvg).toBe('<svg></svg>');
    });

    it('should route chart type correctly via generateChart', () => {
      const line = generateChart(makeLineChart());
      expect(line).toContain('<polyline');

      const bar = generateChart(makeBarChart());
      expect(bar).toContain('<rect');
    });

    it('should throw for unsupported chart type', () => {
      expect(() => generateChart({ ...makeLineChart(), type: 'pie' as any })).toThrow('Unsupported chart type');
    });

    it('should embed chart in HTML container', () => {
      const svg = '<svg>test</svg>';
      const html = embedChartInHtml(svg);
      expect(html).toContain('chart-container');
      expect(html).toContain('<svg>test</svg>');
    });
  });

  // 4. Report Templates
  describe('Report Templates', () => {
    it('should render daily report template', () => {
      const template = createDailyReportTemplate();
      expect(template.type).toBe('daily');
      expect(template.sections.length).toBeGreaterThanOrEqual(3);

      const data = {
        indices: { 'S&P 500': 0.5, 'NASDAQ': 1.2 },
        totalPnL: 1500,
        totalPnLPct: 1.5,
        positions: [
          { symbol: 'AAPL', qty: 100, pnl: 500, pnlPct: 2.1 },
          { symbol: 'GOOGL', qty: 50, pnl: 1000, pnlPct: 3.5 },
        ],
        alerts: ['AAPL approaching stop-loss', 'High sector concentration'],
        events: ['FOMC meeting tomorrow'],
      };

      const md = renderTemplate(template, data);
      expect(md).toContain('Market Summary');
      expect(md).toContain('S&P 500');
      expect(md).toContain('AAPL');
      expect(md).toContain('1500.00');
      expect(md).toContain('FOMC meeting tomorrow');
    });

    it('should render weekly summary template', () => {
      const template = createWeeklySummaryTemplate();
      expect(template.type).toBe('weekly');

      const data = {
        weekReturn: 2.5,
        benchmarkReturn: 1.8,
        tradingDays: 5,
        totalTrades: 12,
        dailyBreakdown: [
          { day: 'Mon', return: 0.5 },
          { day: 'Tue', return: -0.3 },
          { day: 'Wed', return: 1.2 },
          { day: 'Thu', return: 0.8 },
          { day: 'Fri', return: 0.3 },
        ],
        topPerformers: [
          { symbol: 'AAPL', return: 5.2 },
          { symbol: 'MSFT', return: 3.1 },
        ],
        worstPerformers: [
          { symbol: 'TSLA', return: -4.5 },
        ],
      };

      const md = renderTemplate(template, data);
      expect(md).toContain('Week Overview');
      expect(md).toContain('2.50%');
      expect(md).toContain('Alpha');
      expect(md).toContain('AAPL');
      expect(md).toContain('TSLA');
    });

    it('should render monthly performance template', () => {
      const template = createMonthlyPerformanceTemplate();
      expect(template.type).toBe('monthly');

      const data = {
        month: 'June 2026',
        monthReturn: 4.2,
        cumulativeReturn: 18.5,
        sharpeRatio: 1.35,
        maxDrawdown: 5.2,
        volatility: 12.1,
        winRate: 58.3,
        profitFactor: 1.85,
        allocation: { 'US Equities': 45, 'Bonds': 30, 'Cash': 15, 'Commodities': 10 },
        var95: 2.1,
        cvar95: 3.4,
        beta: 0.85,
        sortino: 1.52,
        calmar: 2.31,
        totalTrades: 45,
        winningTrades: 26,
        losingTrades: 19,
        avgWin: 1.8,
        avgLoss: -0.9,
        largestWin: 5.2,
        largestLoss: -3.1,
      };

      const md = renderTemplate(template, data);
      expect(md).toContain('Monthly Summary');
      expect(md).toContain('June 2026');
      expect(md).toContain('Sharpe Ratio');
      expect(md).toContain('US Equities');
      expect(md).toContain('VaR');
    });

    it('should render risk analysis template', () => {
      const template = createRiskAnalysisTemplate();
      expect(template.type).toBe('risk');

      const data = {
        riskLevel: 'MEDIUM',
        riskScore: 55,
        riskBudgetUsed: 60,
        riskBudgetRemaining: 40,
        exposure: { Technology: 35, Healthcare: 20, Finance: 25, Energy: 20 },
        stressTests: [
          { scenario: 'Market Crash -20%', impact: -15.3, probability: 'Low' },
          { scenario: 'Rate Hike +100bps', impact: -5.2, probability: 'Medium' },
        ],
        recommendations: ['Reduce tech exposure', 'Add hedging positions'],
      };

      const md = renderTemplate(template, data);
      expect(md).toContain('Risk Overview');
      expect(md).toContain('MEDIUM');
      expect(md).toContain('Technology');
      expect(md).toContain('Market Crash');
      expect(md).toContain('Reduce tech exposure');
    });

    it('should handle missing data gracefully in templates', () => {
      const template = createDailyReportTemplate();
      const md = renderTemplate(template, {});
      expect(md).toContain('No market data available');
      expect(md).toContain('No risk alerts');
    });

    it('should get templates via getReportTemplate', () => {
      expect(getReportTemplate('daily').type).toBe('daily');
      expect(getReportTemplate('weekly').type).toBe('weekly');
      expect(getReportTemplate('monthly').type).toBe('monthly');
      expect(getReportTemplate('risk').type).toBe('risk');
      expect(() => getReportTemplate('unknown' as any)).toThrow('Unknown template type');
    });
  });

  // 5. Report generation
  describe('Report Generation', () => {
    it('should generate report from template with charts', () => {
      const meta = makeMetadata({ title: 'Daily P&L Report' });
      const data = {
        indices: { 'S&P 500': 0.8 },
        totalPnL: 2000,
        totalPnLPct: 2.0,
        positions: [],
        alerts: [],
        events: [],
      };

      const report = generateReportFromTemplate('daily', data, meta, undefined, [makeLineChart()]);
      expect(report.content).toContain('Daily P&amp;L Report');
      expect(report.content).toContain('Charts');
      expect(report.content).toContain('<svg');
      expect(report.sizeBytes).toBeGreaterThan(0);
      expect(report.templateType).toBe('daily');
    });

    it('should generate report from raw markdown', () => {
      const md = '# Custom Report\n\n## Section 1\n\nSome content here.\n\n- Point A\n- Point B';
      const meta = makeMetadata({ title: 'Custom' });
      const report = generateReportFromMarkdown(md, meta);
      expect(report.content).toContain('Custom');
      expect(report.content).toContain('Section 1');
      expect(report.sizeBytes).toBeGreaterThan(0);
    });
  });

  // 6. Email integration
  describe('Email Integration', () => {
    it('should validate email config correctly', () => {
      const valid = makeEmailConfig();
      expect(validateEmailConfig(valid).valid).toBe(true);

      const noHost = makeEmailConfig({ smtpHost: '' });
      const result = validateEmailConfig(noHost);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SMTP host is required');

      const badPort = makeEmailConfig({ smtpPort: 0 });
      expect(validateEmailConfig(badPort).valid).toBe(false);

      const badFrom = makeEmailConfig({ from: 'not-an-email' });
      expect(validateEmailConfig(badFrom).valid).toBe(false);
    });

    it('should build email message for different report types', () => {
      const report = makeReport();

      const dailyMsg = buildEmailMessage('daily', ['user@example.com'], report);
      expect(dailyMsg.subject).toContain('Daily Report');
      expect(dailyMsg.to).toEqual(['user@example.com']);
      expect(dailyMsg.attachments).toHaveLength(1);

      const weeklyMsg = buildEmailMessage('weekly', ['a@x.com', 'b@x.com'], report);
      expect(weeklyMsg.subject).toContain('Weekly Summary');
      expect(weeklyMsg.to).toHaveLength(2);

      const customMsg = buildEmailMessage('monthly', ['c@x.com'], report, 'Custom Subject');
      expect(customMsg.subject).toBe('Custom Subject');
    });

    it('should create SMTP transporter and send mail', async () => {
      const config = makeEmailConfig();
      const transporter = createSmtpTransporter(config);
      expect(transporter).toBeDefined();

      const result = await transporter.sendMail({
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Hello',
        attachments: [],
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toContain('dawn-whales');
    });

    it('should reject invalid email config when creating transporter', () => {
      const badConfig = makeEmailConfig({ smtpHost: '' });
      expect(() => createSmtpTransporter(badConfig)).toThrow('Invalid email config');
    });
  });

  // 7. Batch report generation
  describe('Batch Report Generation', () => {
    it('should generate multiple reports in batch', () => {
      const config: BatchReportConfig = {
        reports: [
          {
            templateType: 'daily',
            data: { indices: { 'S&P': 0.5 }, totalPnL: 100, totalPnLPct: 1, positions: [], alerts: [], events: [] },
            filename: 'daily_report.html',
            metadata: makeMetadata({ title: 'Daily' }),
          },
          {
            templateType: 'weekly',
            data: { weekReturn: 2, benchmarkReturn: 1, tradingDays: 5, totalTrades: 10, dailyBreakdown: [], topPerformers: [], worstPerformers: [] },
            filename: 'weekly_report.html',
            metadata: makeMetadata({ title: 'Weekly' }),
          },
          {
            templateType: 'risk',
            data: { riskLevel: 'LOW', riskScore: 30, riskBudgetUsed: 30, riskBudgetRemaining: 70, exposure: {}, stressTests: [], recommendations: [] },
            filename: 'risk_report.html',
            metadata: makeMetadata({ title: 'Risk' }),
          },
        ],
        outputDir: './reports',
      };

      const result = generateBatchReports(config);
      expect(result.totalGenerated).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.reports[0].filename).toBe('daily_report.html');
      expect(result.reports[1].filename).toBe('weekly_report.html');
      expect(result.reports[2].filename).toBe('risk_report.html');
      expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
    });

    it('should handle batch with empty report list', () => {
      const result = generateBatchReports({ reports: [], outputDir: './reports' });
      expect(result.totalGenerated).toBe(0);
      expect(result.failedCount).toBe(0);
    });
  });

  // 8. Schedule and export
  describe('Schedule & Export', () => {
    it('should return schedule info for different schedules', () => {
      const daily = scheduleReportGeneration('daily', 'daily', () => ({}), () => makeMetadata(), './out');
      expect(daily.schedule).toBe('0 18 * * 1-5');
      expect(daily.nextRun).toBeTruthy();
      expect(typeof daily.cancel).toBe('function');
      daily.cancel(); // should not throw

      const weekly = scheduleReportGeneration('weekly', 'weekly', () => ({}), () => makeMetadata(), './out');
      expect(weekly.schedule).toBe('0 18 * * 5');

      const monthly = scheduleReportGeneration('monthly', 'monthly', () => ({}), () => makeMetadata(), './out');
      expect(monthly.schedule).toBe('0 18 1 * *');
    });

    it('should export reports to file system', () => {
      const reports = [makeReport(), { ...makeReport(), filename: 'report2.html' }];
      const result = exportReportsToFileSystem(reports, './output');
      expect(result.exported).toBe(2);
      expect(result.files).toContain('./output/test_report.html');
      expect(result.files).toContain('./output/report2.html');
      expect(result.errors).toHaveLength(0);
    });
  });

  // 9. PDFReportGenerator class
  describe('PDFReportGenerator Class', () => {
    let generator: PDFReportGenerator;

    beforeEach(() => {
      generator = new PDFReportGenerator('./test-reports');
    });

    it('should initialize with default output dir', () => {
      expect(generator.getOutputDir()).toBe('./test-reports');
      expect(generator.isEmailConfigured()).toBe(false);
    });

    it('should generate reports via class method', () => {
      const meta = makeMetadata();
      const report = generator.generate('daily', {
        indices: {}, totalPnL: 0, totalPnLPct: 0, positions: [], alerts: [], events: [],
      }, meta);
      expect(report.templateType).toBe('daily');
      expect(report.content).toContain('Test Report');
    });

    it('should generate from markdown via class method', () => {
      const meta = makeMetadata({ title: 'MD Report' });
      const report = generator.generateFromMarkdown('# Hello\n\nWorld', meta);
      expect(report.content).toContain('Hello');
    });

    it('should configure email and send reports', async () => {
      generator.configureEmail(makeEmailConfig());
      expect(generator.isEmailConfigured()).toBe(true);
      expect(generator.getEmailConfig()).toBeTruthy();

      const report = makeReport();
      const result = await generator.sendReport(report, ['test@example.com']);
      expect(result.success).toBe(true);
    });

    it('should throw when sending without email config', async () => {
      const report = makeReport();
      await expect(generator.sendReport(report, ['x@x.com'])).rejects.toThrow('Email not configured');
    });

    it('should throw on invalid email config', () => {
      expect(() => generator.configureEmail(makeEmailConfig({ smtpHost: '' }))).toThrow('Invalid email configuration');
    });

    it('should generate batch reports via class method', () => {
      const result = generator.generateBatch({
        reports: [
          {
            templateType: 'daily',
            data: { indices: {}, totalPnL: 0, totalPnLPct: 0, positions: [], alerts: [], events: [] },
            filename: 'batch_daily.html',
            metadata: makeMetadata(),
          },
        ],
        outputDir: './test-reports',
      });
      expect(result.totalGenerated).toBe(1);
    });

    it('should export reports via class method', () => {
      const result = generator.exportReports([makeReport()]);
      expect(result.exported).toBe(1);
    });

    it('should change output dir', () => {
      generator.setOutputDir('/new/path');
      expect(generator.getOutputDir()).toBe('/new/path');
    });

    it('should emit events', () => {
      const events: string[] = [];
      generator.on('reportGenerated', () => events.push('reportGenerated'));
      generator.on('emailConfigured', () => events.push('emailConfigured'));
      generator.on('batchCompleted', () => events.push('batchCompleted'));

      generator.generate('daily', {
        indices: {}, totalPnL: 0, totalPnLPct: 0, positions: [], alerts: [], events: [],
      }, makeMetadata());

      generator.configureEmail(makeEmailConfig());

      generator.generateBatch({
        reports: [],
        outputDir: './test-reports',
      });

      expect(events).toContain('reportGenerated');
      expect(events).toContain('emailConfigured');
      expect(events).toContain('batchCompleted');
    });

    it('should get schedule info via class method', () => {
      const info = generator.getScheduleInfo('daily', 'daily');
      expect(info.schedule).toBeTruthy();
      expect(info.nextRun).toBeTruthy();
      info.cancel();
    });
  });

  // 10. Default page layout
  describe('Default Page Layout', () => {
    it('should have valid default layout', () => {
      expect(DEFAULT_PAGE_LAYOUT.pageSize).toBe('A4');
      expect(DEFAULT_PAGE_LAYOUT.orientation).toBe('portrait');
      expect(DEFAULT_PAGE_LAYOUT.margins.top).toBe(20);
      expect(DEFAULT_PAGE_LAYOUT.margins.right).toBe(15);
      expect(DEFAULT_PAGE_LAYOUT.margins.bottom).toBe(20);
      expect(DEFAULT_PAGE_LAYOUT.margins.left).toBe(15);
    });
  });
});
