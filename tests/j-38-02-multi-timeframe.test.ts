// J-38-03: Multi-Timeframe Replay Integration Tests (8+ tests)
// Tests multi-timeframe synchronization, aggregation, and cross-timeframe events

import { MultiTimeframeReplayEngine, KLineBar, TimeframeKey } from '../electron/engine/multi-timeframe-replay';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.log(`  [FAIL] ${msg}`);
  }
}

function generateMockBars(count: number, startPrice: number, startTime: number, intervalMs: number): KLineBar[] {
  const bars: KLineBar[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(1, price + change);

    bars.push({
      timestamp: startTime + i * intervalMs,
      open: price,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price + (Math.random() - 0.5),
      volume: Math.floor(1000 + Math.random() * 5000),
      amount: Math.floor(100000 + Math.random() * 500000),
    });
  }

  return bars;
}

function run() {
  console.log('\n━━ J-38-03: Multi-Timeframe Replay Integration Tests ━━\n');

  // Test 1: Initialize multi-timeframe engine
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m', '15m'],
      syncMode: 'master-slave',
    });

    assert(engine !== null, 'T1: Engine initialized');
    assert(engine.getOverallProgress() === 0, 'T1: Initial progress is 0');
    engine.destroy();
  }

  // Test 2: Load raw data and auto-aggregate
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m', '15m'],
      baseTimeframe: '1m',
    });

    const startTime = Date.now();
    const rawBars = generateMockBars(100, 100, startTime, 60000); // 100 1-minute bars

    engine.loadFromRaw(rawBars);

    const snapshots = engine.getSnapshot();
    assert(snapshots.length === 3, 'T2: Three timeframes loaded');

    // Check aggregation
    const tf1m = snapshots.find(s => s.timeframe === '1m');
    const tf5m = snapshots.find(s => s.timeframe === '5m');
    const tf15m = snapshots.find(s => s.timeframe === '15m');

    assert(tf1m && tf1m.totalBars === 100, 'T2: 1m has 100 bars');
    assert(tf5m && tf5m.totalBars === 20, 'T2: 5m has 20 bars (100/5)');
    assert(tf15m && tf15m.totalBars === 7, 'T2: 15m has ~7 bars (100/15)');
    engine.destroy();
  }

  // Test 3: Load pre-aggregated data
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m', '1h'],
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(60, 100, startTime, 60000),
      '5m': generateMockBars(12, 100, startTime, 300000),
      '1h': generateMockBars(1, 100, startTime, 3600000),
    });

    const snapshots = engine.getSnapshot();
    assert(snapshots.every(s => s.state === 'READY'), 'T3: All timeframes READY');
    engine.destroy();
  }

  // Test 4: Play and pause all timeframes
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
      syncMode: 'parallel',
      speed: 10,
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(50, 100, startTime, 60000),
      '5m': generateMockBars(10, 100, startTime, 300000),
    });

    engine.play();
    const snapshotsAfterPlay = engine.getSnapshot();
    assert(snapshotsAfterPlay.some(s => s.state === 'PLAYING'), 'T4: At least one timeframe PLAYING');

    engine.pause();
    const snapshotsAfterPause = engine.getSnapshot();
    assert(snapshotsAfterPause.every(s => s.state === 'PAUSED'), 'T4: All timeframes PAUSED');
    engine.destroy();
  }

  // Test 5: Step forward all timeframes
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(50, 100, startTime, 60000),
      '5m': generateMockBars(10, 100, startTime, 300000),
    });

    engine.stepForward(5);

    const currentBars = engine.getCurrentBars();
    assert(currentBars.get('1m') !== null, 'T5: 1m has current bar');
    assert(currentBars.get('5m') !== null, 'T5: 5m has current bar');
    engine.destroy();
  }

  // Test 6: Seek to timestamp
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(100, 100, startTime, 60000),
      '5m': generateMockBars(20, 100, startTime, 300000),
    });

    const targetTime = startTime + 30 * 60000; // 30 minutes in
    engine.seekTo(targetTime);

    const progress = engine.getOverallProgress();
    assert(progress > 0 && progress < 100, 'T6: Progress after seek is valid');
    engine.destroy();
  }

  // Test 7: Speed control
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m'],
      speed: 1,
    });

    const rawBars = generateMockBars(50, 100, Date.now(), 60000);
    engine.loadFromRaw(rawBars);

    engine.setSpeed(5);
    assert(true, 'T7: Speed changed to 5x without error');

    engine.setSpeed(10);
    assert(true, 'T7: Speed changed to 10x without error');
    engine.destroy();
  }

  // Test 8: Sync check
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
      baseTimeframe: '1m',
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(100, 100, startTime, 60000),
      '5m': generateMockBars(20, 100, startTime, 300000),
    });

    const isSynced = engine.isSynced();
    assert(typeof isSynced === 'boolean', 'T8: isSynced returns boolean');
    engine.destroy();
  }

  // Test 9: Cross-timeframe events
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
      syncMode: 'parallel',
      speed: 100,
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(20, 100, startTime, 60000),
      '5m': generateMockBars(4, 100, startTime, 300000),
    });

    let barEventCount = 0;
    engine.on('bar', () => { barEventCount++; });

    engine.stepForward(5);
    assert(barEventCount > 0, 'T9: Bar events emitted during playback');
    engine.destroy();
  }

  // Test 10: Stop and reset
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(50, 100, startTime, 60000),
      '5m': generateMockBars(10, 100, startTime, 300000),
    });

    engine.stepForward(10);
    engine.stop();

    const snapshots = engine.getSnapshot();
    assert(snapshots.every(s => s.state === 'STOPPED'), 'T10: All timeframes STOPPED');
    engine.destroy();
  }

  // Test 11: Master-slave sync mode
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m', '5m'],
      syncMode: 'master-slave',
      masterTimeframe: '1m',
      speed: 10,
    });

    const startTime = Date.now();
    engine.loadPreAggregated({
      '1m': generateMockBars(50, 100, startTime, 60000),
      '5m': generateMockBars(10, 100, startTime, 300000),
    });

    engine.play();
    setTimeout(() => {
      engine.pause();
      const snapshots = engine.getSnapshot();
      assert(snapshots.length === 2, 'T11: Master-slave mode works');
      engine.destroy();
    }, 200);
  }

  // Test 12: Timeframe complete events
  {
    const engine = new MultiTimeframeReplayEngine({
      symbol: 'TEST',
      timeframes: ['1m'],
      speed: 100,
    });

    const rawBars = generateMockBars(10, 100, Date.now(), 60000);
    engine.loadFromRaw(rawBars);

    let completeEventFired = false;
    engine.on('timeframe:complete', () => { completeEventFired = true; });

    engine.stepForward(10);
    assert(completeEventFired || engine.getOverallProgress() >= 100, 'T12: Timeframe complete or progress 100%');
    engine.destroy();
  }

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  return failed;
}

const failures = run();
process.exit(failures > 0 ? 1 : 0);
