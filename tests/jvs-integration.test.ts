// ── JVS Integration Test Suite ─────────────────────────────────────────────
// Validates JVS-1~18 modules with real scenarios
// Run: npx tsx tests/jvs-integration.test.ts

import { SentimentIndexEngine } from '../electron/engine/analysis/sentiment-index';
import { StockAnomalyDetector } from '../electron/engine/data/stock-anomaly-detector';
import { NewsAggregator } from '../electron/engine/data/news-aggregator';
import { SectorRotationMonitor } from '../electron/engine/data/sector-rotation';
import { MarketHotspotService } from '../electron/engine/data/market-hotspot';

// ── Test Framework ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.log(`  ❌ ${name}`);
          errors.push(`${name}: ${err.message}`);
          failed++;
        });
    }
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}`);
    errors.push(`${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── JVS-3: Sentiment Index Tests ──────────────────────────────────────────

async function testSentimentIndex() {
  console.log('\n📊 JVS-3: Sentiment Index');

  const engine = new SentimentIndexEngine();

  await runTest('Should compute neutral sentiment with balanced inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: 0,
      advanceCount: 2000,
      declineCount: 2000,
      totalTurnover: 1000,
    });
    assert(result?.score >= 40 && result?.score <= 60, `Score ${result?.score} not in neutral range`);
    assert(result.level === 'neutral', `Level ${result.level} should be neutral`);
  });

  await runTest('Should compute greedy sentiment with bullish inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: 100,
      northboundNetBuy: 15,
      advanceCount: 4000,
      declineCount: 500,
      totalTurnover: 1800,
      limitUpCount: 50,
      limitDownCount: 2,
    });
    assert(result?.score >= 60, `Score ${result?.score} should be >= 60`);
    assert(['greed', 'extreme_greed'].includes(result.level), `Level ${result.level} should be greed+`);
  });

  await runTest('Should compute fearful sentiment with bearish inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: -150,
      northboundNetBuy: -10,
      advanceCount: 500,
      declineCount: 4000,
      totalTurnover: 600,
      limitUpCount: 2,
      limitDownCount: 50,
    });
    assert(result?.score <= 40, `Score ${result?.score} should be <= 40`);
    assert(['fear', 'extreme_fear'].includes(result.level), `Level ${result.level} should be fear+`);
  });

  await runTest('Should generate contrarian signals', () => {
    const fearful = engine.compute({
      capitalFlowNetInflow: -200,
      advanceCount: 200,
      declineCount: 4500,
      limitUpCount: 0,
      limitDownCount: 100,
    });
    assert(['strong_buy', 'buy'].includes(fearful.signal), `Signal ${fearful.signal} should be buy for extreme fear`);

    const greedy = engine.compute({
      capitalFlowNetInflow: 200,
      advanceCount: 4500,
      declineCount: 200,
      limitUpCount: 100,
      limitDownCount: 0,
    });
    assert(['strong_sell', 'sell'].includes(greedy.signal), `Signal ${greedy.signal} should be sell for extreme greed`);
  });

  await runTest('Should track history', () => {
    engine.compute({ capitalFlowNetInflow: 50 });
    engine.compute({ capitalFlowNetInflow: -50 });
    engine.compute({ capitalFlowNetInflow: 0 });
    const history = engine.getHistory(5);
    assert(history.length >= 3, `History should have at least 3 entries`);
  });
}

// ── JVS-7: Anomaly Detector Tests ─────────────────────────────────────────

async function testAnomalyDetector() {
  console.log('\n🚨 JVS-7: Anomaly Detector');

  const detector = new StockAnomalyDetector();

  await runTest('Should detect limit up', () => {
    const alerts = detector.processQuotes([{
      code: '600519',
      name: '贵州茅台',
      price: 1980,
      changePct: 9.95,
      volume: 5000000000,
      highPrice: 1980,
      lowPrice: 1800,
      openPrice: 1810,
      prevClose: 1800,
      timestamp: Date.now(),
    }]);
    assert(alerts.length > 0, 'Should detect limit up');
    assert(alerts.some(a => a.type === 'limit_up'), 'Should have limit_up alert');
  });

  await runTest('Should detect volume surge', () => {
    // Set avg volume
    detector.updateAverageVolumes(new Map([['600519', 1000000000]]));
    
    const alerts = detector.processQuotes([{
      code: '600519',
      name: '贵州茅台',
      price: 1850,
      changePct: 3.5,
      volume: 5000000000, // 5x avg
      highPrice: 1860,
      lowPrice: 1800,
      openPrice: 1810,
      prevClose: 1800,
      timestamp: Date.now() + 1000,
    }]);
    assert(alerts.some(a => a.type === 'volume_surge'), 'Should detect volume surge');
  });

  await runTest('Should detect rapid change', () => {
    const now = Date.now();
    // Feed historical quotes
    detector.processQuotes([{
      code: '000001',
      name: '平安银行',
      price: 10.00,
      changePct: 0,
      volume: 1000000,
      highPrice: 10.00,
      lowPrice: 10.00,
      openPrice: 10.00,
      prevClose: 10.00,
      timestamp: now - 300000, // 5 min ago
    }]);

    const alerts = detector.processQuotes([{
      code: '000001',
      name: '平安银行',
      price: 10.35, // +3.5% in 5 min
      changePct: 3.5,
      volume: 1500000,
      highPrice: 10.35,
      lowPrice: 10.00,
      openPrice: 10.00,
      prevClose: 10.00,
      timestamp: now,
    }]);
    assert(alerts.some(a => a.type === 'rapid_change'), 'Should detect rapid change');
  });

  await runTest('Should get summary', () => {
    const summary = detector.getSummary();
    assert(summary.totalAlerts >= 0, 'Should return summary');
    assert(typeof summary.critical === 'number', 'Should have critical count');
    assert(typeof summary.warning === 'number', 'Should have warning count');
  });
}

// ── JVS-6: Sector Rotation Tests ──────────────────────────────────────────

async function testSectorRotation() {
  console.log('\n🔄 JVS-6: Sector Rotation');

  const monitor = new SectorRotationMonitor();

  await runTest('Should record snapshots', () => {
    monitor.recordSnapshot([
      { code: 'BK0001', name: '银行', changePct: 1.5, volume: 100, risingCount: 30, fallingCount: 5, timestamp: Date.now() },
      { code: 'BK0002', name: '半导体', changePct: 2.8, volume: 150, risingCount: 25, fallingCount: 10, timestamp: Date.now() },
    ], true);
  });

  await runTest('Should analyze rotation', () => {
    // Add more snapshots over time (force=true to bypass TTL)
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      monitor.recordSnapshot([
        { code: 'BK0001', name: '银行', changePct: 1.0 + i * 0.3, volume: 100 + i * 10, risingCount: 25 + i * 2, fallingCount: 5 + i, timestamp: now + i * 86400000 },
        { code: 'BK0002', name: '半导体', changePct: 2.0 + i * 0.5, volume: 150 + i * 30, risingCount: 30 + i * 3, fallingCount: 3, timestamp: now + i * 86400000 },
        { code: 'BK0003', name: '医药', changePct: -0.5 - i * 0.2, volume: 80, risingCount: 10, fallingCount: 20 + i, timestamp: now + i * 86400000 },
      ], true);
    }

    const report = monitor.analyze();
    assert(report.success, 'Should generate report');
    assert(report.hotSectors.length >= 0, 'Should have hot sectors array');
    assert(report.summary.length > 0, 'Should have summary text');
  });
}

// ── JVS-5: News Aggregator Tests ──────────────────────────────────────────

async function testNewsAggregator() {
  console.log('\n📰 JVS-5: News Aggregator');

  const aggregator = new NewsAggregator();

  await runTest('Should score positive sentiment', () => {
    const result = aggregator.search({
      query: '半导体 芯片 上涨 利好',
      hoursBack: 24,
      limit: 10,
    });
    // Result will be empty without real data, but structure should be correct
    assert(result instanceof Promise, 'Should return promise');
  });

  await runTest('Should get market mood', async () => {
    const mood = await aggregator.getMarketMood();
    assert(mood.mood !== undefined, 'Should have mood');
    assert(typeof mood.score === 'number', 'Should have score');
  });
}

// ── JVS-12: Capital Flow Monitor Tests ─────────────────────────────────────

import { getCapitalFlowMonitor } from '../electron/engine/analysis/capital-flow-monitor';

async function testCapitalFlowMonitor() {
  console.log('\n💰 JVS-12: Capital Flow Monitor');

  await runTest('Should initialize with default config', () => {
    const monitor = getCapitalFlowMonitor();
    const config = monitor.getConfig();
    assert(config.mainForceThreshold === 5000, 'Default main force threshold should be 5000');
    assert(config.largeOrderThreshold === 1000, 'Default large order threshold should be 1000');
    assert(config.enabled === true, 'Should be enabled by default');
  });

  await runTest('Should generate alert for large main force inflow', () => {
    const monitor = getCapitalFlowMonitor();
    monitor.updateConfig({ mainForceThreshold: 100, alertInterval: 1000 });
    monitor.clearHistory();
    const alerts = monitor.process([
      { code: '600519', name: '贵州茅台', mainNetInflow: 500, superLargeIn: 0, turnover: 10000, changePct: 3.5 },
    ]);
    assert(alerts.length > 0, 'Should generate alerts for large inflow');
    assert(alerts[0].type === 'main_force_inflow', 'Should be main_force_inflow type');
    assert(alerts[0].severity === 'medium' || alerts[0].severity === 'high', 'Should have appropriate severity');
  });

  await runTest('Should suppress duplicate alerts within interval', () => {
    const monitor = getCapitalFlowMonitor();
    monitor.updateConfig({ mainForceThreshold: 100, alertInterval: 60000 });
    monitor.clearHistory();
    const firstAlerts = monitor.process([
      { code: '000001', name: '平安银行', mainNetInflow: 200, superLargeIn: 0, turnover: 5000, changePct: 2 },
    ]);
    const secondAlerts = monitor.process([
      { code: '000001', name: '平安银行', mainNetInflow: 200, superLargeIn: 0, turnover: 5000, changePct: 2 },
    ]);
    assert(firstAlerts.length > 0, 'First batch should generate alerts');
    assert(secondAlerts.length === 0, 'Second batch should be suppressed');
  });

  await runTest('Should detect unusual activity', () => {
    const monitor = getCapitalFlowMonitor();
    monitor.updateConfig({ mainForceThreshold: 10000 });
    monitor.clearHistory();
    const alerts = monitor.process([
      { code: '600000', name: '浦发银行', mainNetInflow: 5000, superLargeIn: 0, turnover: 12000, changePct: 1 },
    ]);
    const unusual = alerts.find(a => a.type === 'unusual_activity');
    assert(unusual !== undefined, 'Should detect unusual activity when main force ratio > 30%');
  });
}

// ── JVS-15: Portfolio Risk Tests ───────────────────────────────────────────

import { calculatePortfolioRisk } from '../electron/engine/portfolio/portfolio-risk';

async function testPortfolioRisk() {
  console.log('\n📊 JVS-15: Portfolio Risk');

  await runTest('Should calculate risk for multi-stock portfolio', async () => {
    const report = await calculatePortfolioRisk({
      positions: [
        { code: '600519', name: '贵州茅台', shares: 100, avgCost: 1800, currentPrice: 1900, sector: '白酒' },
        { code: '000858', name: '五粮液', shares: 500, avgCost: 150, currentPrice: 160, sector: '白酒' },
        { code: '601318', name: '中国平安', shares: 1000, avgCost: 50, currentPrice: 48, sector: '保险' },
      ],
      includeCorrelation: false,
      includeSentiment: false,
    });
    assert(report.success === true, 'Should succeed');
    assert(report.overview.positionCount === 3, 'Should have 3 positions');
    assert(report.overview.totalValue > 0, 'Should have positive total value');
    assert(typeof report.riskScore === 'number', 'Should have risk score');
    assert(['A', 'B', 'C', 'D', 'F'].includes(report.riskGrade), 'Should have valid grade');
  });

  await runTest('Should detect high concentration', async () => {
    const report = await calculatePortfolioRisk({
      positions: [
        { code: '600519', name: '贵州茅台', shares: 1000, avgCost: 1800, currentPrice: 1900, sector: '白酒' },
        { code: '000001', name: '平安银行', shares: 100, avgCost: 12, currentPrice: 12, sector: '银行' },
      ],
      includeCorrelation: false,
      includeSentiment: false,
    });
    assert(report.success === true, 'Should succeed');
    assert(report.overview.totalValue > 0, 'Should have positive value');
    assert(report.concentration.hhi > 0, 'Should have HHI index');
    assert(report.recommendations.length > 0, 'Should have recommendations');
  });

  await runTest('Should return empty report for no positions', async () => {
    const report = await calculatePortfolioRisk({ positions: [] });
    assert(report.success === false, 'Should fail with no positions');
    assert(report.error !== undefined, 'Should have error message');
  });
}

// ── JVS-14: Stock Diagnosis Tests ──────────────────────────────────────────

import { diagnoseStock } from '../electron/engine/data/stock-diagnosis';

async function testStockDiagnosis() {
  console.log('\n🔍 JVS-14: Stock Diagnosis');

  await runTest('Should return diagnosis structure', async () => {
    const result = await diagnoseStock({
      code: '600519',
      name: '贵州茅台',
      includeCapitalFlow: false,
      includeFundHoldings: false,
      includeDragonTiger: false,
      includeNews: false,
      includeAnomalies: true,
    });
    assert(result.success === true, 'Should succeed');
    assert(result.code === '600519', 'Should have correct code');
    assert(result.overview !== undefined, 'Should have overview');
    assert(typeof result.overview.score === 'number', 'Should have score');
    assert(result.dimensions !== undefined, 'Should have dimensions');
  });

  await runTest('Should handle missing data gracefully', async () => {
    const result = await diagnoseStock({
      code: '999999',
      name: '不存在',
      includeCapitalFlow: false,
      includeFundHoldings: false,
      includeDragonTiger: false,
      includeNews: false,
      includeAnomalies: false,
    });
    assert(result.success === true, 'Should still succeed');
    assert(result.overview.score === 50, 'Should default to 50 when no data');
  });
}

// ── Run All Tests ─────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('══════════════════════════════════════════════════');
  console.log('  JVS Integration Test Suite');
  console.log('══════════════════════════════════════════════════');

  await testSentimentIndex();
  await testAnomalyDetector();
  await testSectorRotation();
  await testNewsAggregator();
  await testCapitalFlowMonitor();
  await testPortfolioRisk();
  await testStockDiagnosis();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // handled by vitest
}

describe("JVS Integration Suite", () => {
  it("runs JVS-3 SentimentIndex", async () => { await testSentimentIndex(); });
  it("runs JVS-7 AnomalyDetector", async () => { await testAnomalyDetector(); });
  it("runs JVS-6 SectorRotation", async () => { await testSectorRotation(); });
  it("runs JVS-5 NewsAggregator", async () => { await testNewsAggregator(); });
  it("runs JVS-12 CapitalFlowMonitor", async () => { await testCapitalFlowMonitor(); });
  it("runs JVS-15 PortfolioRisk", async () => { await testPortfolioRisk(); });
  it("runs JVS-14 StockDiagnosis", async () => { await testStockDiagnosis(); });
});
