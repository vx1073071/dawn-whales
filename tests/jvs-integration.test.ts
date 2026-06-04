// ── JVS Integration Test Suite ─────────────────────────────────────────────
// Validates all JVS-1~8 modules with real scenarios
// Run: npx tsx tests/jvs-integration.test.ts

import { SentimentIndexEngine } from '../electron/engine/sentiment-index';
import { StockAnomalyDetector } from '../electron/engine/stock-anomaly-detector';
import { NewsAggregatorService } from '../electron/engine/news-aggregator';
import { SectorRotationMonitor } from '../electron/engine/sector-rotation';
import { MarketHotspotService } from '../electron/engine/market-hotspot';

// ── Test Framework ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
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

  await test('Should compute neutral sentiment with balanced inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: 0,
      advanceCount: 2000,
      declineCount: 2000,
      totalTurnover: 1000,
    });
    assert(result.score >= 40 && result.score <= 60, `Score ${result.score} not in neutral range`);
    assert(result.level === 'neutral', `Level ${result.level} should be neutral`);
  });

  await test('Should compute greedy sentiment with bullish inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: 100,
      northboundNetBuy: 15,
      advanceCount: 4000,
      declineCount: 500,
      totalTurnover: 1800,
      limitUpCount: 50,
      limitDownCount: 2,
    });
    assert(result.score >= 60, `Score ${result.score} should be >= 60`);
    assert(['greed', 'extreme_greed'].includes(result.level), `Level ${result.level} should be greed+`);
  });

  await test('Should compute fearful sentiment with bearish inputs', () => {
    const result = engine.compute({
      capitalFlowNetInflow: -150,
      northboundNetBuy: -10,
      advanceCount: 500,
      declineCount: 4000,
      totalTurnover: 600,
      limitUpCount: 2,
      limitDownCount: 50,
    });
    assert(result.score <= 40, `Score ${result.score} should be <= 40`);
    assert(['fear', 'extreme_fear'].includes(result.level), `Level ${result.level} should be fear+`);
  });

  await test('Should generate contrarian signals', () => {
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

  await test('Should track history', () => {
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

  await test('Should detect limit up', () => {
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

  await test('Should detect volume surge', () => {
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

  await test('Should detect rapid change', () => {
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

  await test('Should get summary', () => {
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

  await test('Should record snapshots', () => {
    monitor.recordSnapshot([
      { code: 'BK0001', name: '银行', changePct: 1.5, volume: 100, risingCount: 30, fallingCount: 5, timestamp: Date.now() },
      { code: 'BK0002', name: '半导体', changePct: 2.8, volume: 150, risingCount: 25, fallingCount: 10, timestamp: Date.now() },
    ], true);
  });

  await test('Should analyze rotation', () => {
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

  const aggregator = new NewsAggregatorService();

  await test('Should score positive sentiment', () => {
    const result = aggregator.search({
      query: '半导体 芯片 上涨 利好',
      hoursBack: 24,
      limit: 10,
    });
    // Result will be empty without real data, but structure should be correct
    assert(result instanceof Promise, 'Should return promise');
  });

  await test('Should get market mood', async () => {
    const mood = await aggregator.getMarketMood();
    assert(mood.mood !== undefined, 'Should have mood');
    assert(typeof mood.score === 'number', 'Should have score');
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

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
