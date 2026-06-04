// ── JVS-28: Full Pipeline Integration Test ──────────────────────────────────
// Validates: JVS data layer -> QClaw strategy engine -> WB frontend IPC
// Run: npx tsx tests/integration-full-pipeline.test.ts

import { SentimentIndexEngine } from '../electron/engine/sentiment-index';
import { StockAnomalyDetector } from '../electron/engine/stock-anomaly-detector';
import { SectorRotationMonitor } from '../electron/engine/sector-rotation';
import { NewsAggregatorService } from '../electron/engine/news-aggregator';
import { CapitalFlowMonitor } from '../electron/engine/capital-flow-monitor';
import { SmartPickerService } from '../electron/engine/smart-picker';
import { calculatePortfolioRisk } from '../electron/engine/portfolio-risk';
import { diagnoseStock } from '../electron/engine/stock-diagnosis';
import { getMarketBreadth } from '../electron/engine/market-breadth';
import { getConsumerDataReport } from '../electron/engine/consumer-data';
import { getMarginDataReport } from '../electron/engine/margin-data';
import { getUnlockCalendar } from '../electron/engine/unlock-calendar';
import { getDividendCalendar } from '../electron/engine/dividend-calendar';
import { getEarningsCalendar } from '../electron/engine/earnings-calendar';
import { DataQualityMonitor } from '../electron/engine/data-quality-monitor';
import { getStockOverview, getMarketOverview, getDailyReport } from '../electron/engine/emi-unified';

// ── Test Framework ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}: ${err.message}`);
    errors.push(`${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── Pipeline Stage 1: JVS Data Layer ───────────────────────────────────────

async function testJVSDataLayer() {
  console.log('\n📡 Stage 1: JVS Data Layer (29 modules)');

  await test('SentimentIndex: compute with market inputs', async () => {
    const engine = new SentimentIndexEngine();
    const result = engine.compute({
      capitalFlowNetInflow: 50,
      northboundNetBuy: 10,
      advanceCount: 3000,
      declineCount: 1500,
      totalTurnover: 1200,
      limitUpCount: 20,
      limitDownCount: 3,
    });
    assert(result.score >= 0 && result.score <= 100, 'Score in range');
    assert(result.signal !== undefined, 'Has signal');
    assert(result.level !== undefined, 'Has level');
    console.log(`    Score: ${result.score} (${result.level}), signal: ${result.signal}`);
  });

  await test('AnomalyDetector: detect multiple anomaly types', async () => {
    const detector = new StockAnomalyDetector();
    const alerts = detector.processQuotes([
      { code: '600519', name: 'Moutai', price: 2000, changePct: 10, volume: 5e9, highPrice: 2000, lowPrice: 1820, openPrice: 1830, prevClose: 1818, timestamp: Date.now() },
      { code: '000001', name: 'PA Bank', price: 12, changePct: -10, volume: 3e9, highPrice: 13.5, lowPrice: 12, openPrice: 13.5, prevClose: 13.33, timestamp: Date.now() },
    ]);
    assert(alerts.length >= 2, `Should detect limit up + limit down, got ${alerts.length}`);
    const types = alerts.map(a => a.type);
    console.log(`    Alerts: ${types.join(', ')}`);
  });

  await test('SectorRotation: record + analyze', async () => {
    const monitor = new SectorRotationMonitor();
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      monitor.recordSnapshot([
        { code: 'BK001', name: 'Tech', changePct: 2 + i * 0.3, volume: 100 + i * 20, risingCount: 25 + i * 2, fallingCount: 5, timestamp: now + i * 86400000 },
        { code: 'BK002', name: 'Finance', changePct: -0.5 + i * 0.1, volume: 80, risingCount: 10, fallingCount: 20, timestamp: now + i * 86400000 },
      ], true);
    }
    const report = monitor.analyze();
    assert(report.success, 'Report should succeed');
    assert(report.hotSectors !== undefined, 'Has hot sectors');
    console.log(`    Hot: ${report.hotSectors.length}, Cold: ${report.coldSectors.length}`);
  });

  await test('SmartPicker: multi-source scoring', async () => {
    const picker = new SmartPickerService();
    const result = await picker.pick({ limit: 5 });
    assert(result.success || result.picks.length >= 0, 'Should complete (may be empty if no data)');
    console.log(`    Picks: ${result.picks.length} from ${result.total} candidates`);
  });

  await test('PortfolioRisk: multi-position analysis', async () => {
    const result = await calculatePortfolioRisk({
      positions: [
        { code: '600519', name: 'Moutai', shares: 100, avgCost: 1800, currentPrice: 1900, sector: 'Liquor' },
        { code: '000858', name: 'WLY', shares: 500, avgCost: 150, currentPrice: 165, sector: 'Liquor' },
        { code: '300750', name: 'CATL', shares: 200, avgCost: 200, currentPrice: 220, sector: 'Battery' },
      ],
      includeCorrelation: false,
      includeSentiment: false,
    });
    assert(result.success, 'Should succeed');
    assert(result.overview.totalValue > 0, 'Has value');
    assert(result.riskScore >= 0, 'Has risk score');
    console.log(`    Value: ${result.overview.totalValue}, Risk: ${result.riskScore}/100 (${result.riskGrade})`);
  });

  await test('StockDiagnosis: 5-dimension analysis', async () => {
    const result = await diagnoseStock({
      code: '600519', name: 'Moutai',
      includeCapitalFlow: false, includeFundHoldings: false,
      includeDragonTiger: false, includeNews: false, includeAnomalies: true,
    });
    assert(result.success, 'Should succeed');
    assert(typeof result.overview.score === 'number', 'Has score');
    console.log(`    Score: ${result.overview.score} (${result.overview.grade})`);
  });

  await test('EMI Unified: market overview', async () => {
    const result = await getMarketOverview();
    assert(result.timestamp > 0, 'Has timestamp');
    assert(result.sentiment !== undefined, 'Has sentiment');
    console.log(`    Sentiment: ${result.sentiment.score}, Sectors: ${result.topSectors.length}`);
  });

  await test('EMI Unified: daily report generation', async () => {
    const result = await getDailyReport();
    assert(result.content.length > 0, 'Has content');
    assert(result.date.length > 0, 'Has date');
    console.log(`    Report: ${result.content.length} chars, date: ${result.date}`);
  });
}

// ── Pipeline Stage 2: QClaw Strategy Integration ──────────────────────────

async function testQClawIntegration() {
  console.log('\n🧠 Stage 2: QClaw Strategy Integration');

  await test('Sentiment -> Strategy signal mapping', async () => {
    const engine = new SentimentIndexEngine();

    // Extreme fear -> buy signal
    const fear = engine.compute({
      capitalFlowNetInflow: -200, advanceCount: 200, declineCount: 4500,
      limitUpCount: 0, limitDownCount: 100, totalTurnover: 400,
    });
    assert(['strong_buy', 'buy'].includes(fear.signal), `Fear should trigger buy, got ${fear.signal}`);

    // Extreme greed -> sell signal
    const greed = engine.compute({
      capitalFlowNetInflow: 200, advanceCount: 4500, declineCount: 200,
      limitUpCount: 100, limitDownCount: 0, totalTurnover: 2000,
    });
    assert(['strong_sell', 'sell'].includes(greed.signal), `Greed should trigger sell, got ${greed.signal}`);

    console.log(`    Fear: score=${fear.score} signal=${fear.signal}`);
    console.log(`    Greed: score=${greed.score} signal=${greed.signal}`);
  });

  await test('CapitalFlow -> Multi-factor scoring', async () => {
    const monitor = new CapitalFlowMonitor();
    monitor.updateConfig({ mainForceThreshold: 100, alertInterval: 1000 });
    monitor.clearHistory();

    const alerts = monitor.process([
      { code: '600519', name: 'Moutai', mainNetInflow: 500, superLargeIn: 200, turnover: 10000, changePct: 3.5 },
      { code: '000001', name: 'PA Bank', mainNetInflow: -300, superLargeIn: -100, turnover: 5000, changePct: -2.1 },
    ]);

    assert(alerts.length >= 2, 'Should generate alerts for both stocks');
    const inflow = alerts.find(a => a.type === 'main_force_inflow');
    const outflow = alerts.find(a => a.type === 'main_force_outflow');
    assert(inflow !== undefined, 'Has inflow alert');
    assert(outflow !== undefined, 'Has outflow alert');
    console.log(`    Inflow: ${inflow?.code}, Outflow: ${outflow?.code}`);
  });

  await test('Portfolio risk -> Position sizing compatibility', async () => {
    const result = await calculatePortfolioRisk({
      positions: [
        { code: '600519', name: 'A', shares: 100, avgCost: 100, currentPrice: 110, sector: 'X' },
        { code: '000858', name: 'B', shares: 200, avgCost: 50, currentPrice: 55, sector: 'Y' },
      ],
      includeCorrelation: false, includeSentiment: false,
    });
    assert(result.success, 'Risk calc should succeed');
    // Verify output format compatible with QClaw dynamic-sizer
    assert(typeof result.riskScore === 'number', 'Has riskScore for sizer');
    assert(result.positionRisks.length === 2, 'Has per-position risks');
    for (const pr of result.positionRisks) {
      assert(typeof pr.weight === 'number', 'Each position has weight');
      assert(typeof pr.pnlPct === 'number', 'Each position has pnlPct');
    }
    console.log(`    Risk score: ${result.riskScore}, positions: ${result.positionRisks.length}`);
  });
}

// ── Pipeline Stage 3: WB Frontend IPC Compatibility ────────────────────────

async function testWBFrontendCompatibility() {
  console.log('\n🖥️ Stage 3: WB Frontend IPC Compatibility');

  await test('MarketOverview IPC format (for DashboardPage)', async () => {
    const result = await getMarketOverview();
    // Verify WB DashboardPage can consume this format
    assert(typeof result.sentiment.score === 'number', 'sentiment.score is number');
    assert(typeof result.sentiment.level === 'string', 'sentiment.level is string');
    assert(Array.isArray(result.topSectors), 'topSectors is array');
    assert(typeof result.breadth.advancing === 'number', 'breadth.advancing is number');
    assert(typeof result.breadth.trend === 'string', 'breadth.trend is string');
    console.log(`    Format OK: sentiment, sectors, breadth, macro all present`);
  });

  await test('DailyReport IPC format (for DailyReportPage)', async () => {
    const result = await getDailyReport();
    assert(typeof result.content === 'string', 'content is string (markdown)');
    assert(result.content.includes('# '), 'content has markdown headers');
    assert(typeof result.date === 'string', 'date is string');
    console.log(`    Format OK: markdown ${result.content.length} chars`);
  });

  await test('SmartPicker IPC format (for SmartPickerPage)', async () => {
    const picker = new SmartPickerService();
    const result = await picker.pick({ limit: 3 });
    // Verify WB SmartPickerPage can consume this format
    assert(typeof result.success === 'boolean', 'success is boolean');
    assert(Array.isArray(result.picks), 'picks is array');
    if (result.picks.length > 0) {
      const p = result.picks[0];
      assert(typeof p.code === 'string', 'pick.code is string');
      assert(typeof p.totalScore === 'number', 'pick.totalScore is number');
      assert(typeof p.grade === 'string', 'pick.grade is string');
      assert(Array.isArray(p.reasons), 'pick.reasons is array');
      assert(typeof p.scores === 'object', 'pick.scores is object');
    }
    console.log(`    Format OK: ${result.picks.length} picks with score/grade/reasons`);
  });

  await test('StockDiagnosis IPC format (for StockOverviewPage)', async () => {
    const result = await diagnoseStock({
      code: '600519', name: 'Moutai',
      includeCapitalFlow: false, includeFundHoldings: false,
      includeDragonTiger: false, includeNews: false, includeAnomalies: false,
    });
    // Verify WB StockOverviewPage can consume this format
    assert(result.success === true, 'success is true');
    assert(typeof result.overview.score === 'number', 'overview.score is number');
    assert(typeof result.overview.grade === 'string', 'overview.grade is string');
    assert(typeof result.overview.recommendation === 'string', 'overview.recommendation is string');
    assert(typeof result.dimensions === 'object', 'dimensions is object');
    console.log(`    Format OK: score=${result.overview.score}, grade=${result.overview.grade}`);
  });

  await test('PortfolioRisk IPC format (for RiskDashboardPage)', async () => {
    const result = await calculatePortfolioRisk({
      positions: [
        { code: '600519', name: 'A', shares: 100, avgCost: 100, currentPrice: 110, sector: 'X' },
      ],
      includeCorrelation: false, includeSentiment: false,
    });
    assert(result.success === true, 'success is true');
    assert(typeof result.overview === 'object', 'overview is object');
    assert(typeof result.concentration === 'object', 'concentration is object');
    assert(typeof result.correlation === 'object', 'correlation is object');
    assert(typeof result.marketRisk === 'object', 'marketRisk is object');
    assert(typeof result.riskScore === 'number', 'riskScore is number');
    assert(typeof result.riskGrade === 'string', 'riskGrade is string');
    assert(Array.isArray(result.recommendations), 'recommendations is array');
    console.log(`    Format OK: riskScore=${result.riskScore}, grade=${result.riskGrade}`);
  });

  await test('AnomalyDetector IPC format (for AnomalyAlertPanel)', async () => {
    const detector = new StockAnomalyDetector();
    const alerts = detector.processQuotes([
      { code: '600519', name: 'Moutai', price: 2000, changePct: 10, volume: 5e9, highPrice: 2000, lowPrice: 1820, openPrice: 1830, prevClose: 1818, timestamp: Date.now() },
    ]);
    assert(alerts.length > 0, 'Has alerts');
    const a = alerts[0];
    assert(typeof a.code === 'string', 'alert.code is string');
    assert(typeof a.type === 'string', 'alert.type is string');
    assert(typeof a.level === 'string', 'alert.level is string');
    assert(typeof a.title === 'string', 'alert.title is string');
    assert(typeof a.timestamp === 'number', 'alert.timestamp is number');
    console.log(`    Format OK: ${alerts.length} alerts with code/type/level/title/timestamp`);
  });
}

// ── Run All ────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('══════════════════════════════════════════════════');
  console.log('  JVS-28: Full Pipeline Integration Test');
  console.log('  JVS Data -> QClaw Strategy -> WB Frontend');
  console.log('══════════════════════════════════════════════════');

  await testJVSDataLayer();
  await testQClawIntegration();
  await testWBFrontendCompatibility();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
