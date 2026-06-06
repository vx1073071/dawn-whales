// J-38-01/02: KLine Replay Engine Tests (15+ tests)
// Tests replay engine with speed control, breakpoints, multi-timeframe, and integration

import { KLineReplayEngine, KLineBar, ReplayBreakpoint } from '../electron/engine/kline-replay-engine';

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

function generateMockBars(count: number, startPrice: number, startTime: number): KLineBar[] {
  const bars: KLineBar[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2;
    price = Math.max(1, price + change);

    bars.push({
      timestamp: startTime + i * 60000, // 1 min bars
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
  console.log('\n━━ J-38-01: KLine Replay Engine Tests ━━\n');

  // Test 1: Initialize engine
  {
    const engine = new KLineReplayEngine();
    assert(engine.getState() === 'IDLE', 'T1: Initial state is IDLE');
    engine.destroy();
  }

  // Test 2: Load data
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(100, 100, Date.now());

    engine.loadData('TEST', bars);
    assert(engine.getState() === 'READY', 'T2: State is READY after load');
    assert(engine.getStats().totalBars === 100, 'T2: Total bars = 100');
    engine.destroy();
  }

  // Test 3: Play and pause
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'], speed: 1 });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.play();
    assert(engine.getState() === 'PLAYING', 'T3: State is PLAYING after play()');

    engine.pause();
    assert(engine.getState() === 'PAUSED', 'T3: State is PAUSED after pause()');

    engine.destroy();
  }

  // Test 4: Stop and reset
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.play();
    setTimeout(() => {
      engine.stop();
      assert(engine.getState() === 'STOPPED', 'T4: State is STOPPED after stop()');
      assert(engine.getStats().barsProcessed === 0, 'T4: Bars processed reset to 0');
      engine.destroy();
    }, 200);
  }

  // Test 5: Step forward
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    const stepped = engine.stepForward(5);
    assert(stepped.length === 5, 'T5: Step forward returns 5 bars');
    assert(engine.getStats().barsProcessed === 5, 'T5: Bars processed = 5');
    engine.destroy();
  }

  // Test 6: Step backward
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.stepForward(10);
    engine.stepBackward(3);
    assert(engine.getStats().barsProcessed === 10, 'T6: Bars processed unchanged after backward');
    engine.destroy();
  }

  // Test 7: Seek to timestamp
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const startTime = Date.now();
    const bars = generateMockBars(100, 100, startTime);
    engine.loadData('TEST', bars);

    const targetTime = startTime + 50 * 60000;
    engine.seekTo(targetTime);

    const snapshot = engine.getSnapshot();
    assert(snapshot.currentBarIndex >= 50, 'T7: Seeked to approximately correct position');
    engine.destroy();
  }

  // Test 8: Seek to bar index
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(100, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.seekToBar(75);
    const snapshot = engine.getSnapshot();
    assert(snapshot.currentBarIndex === 75, 'T8: Seeked to bar index 75');
    engine.destroy();
  }

  // Test 9: Speed control
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'], speed: 1 });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.setSpeed(5);
    assert(engine.getSpeed() === 5, 'T9: Speed changed to 5x');

    engine.setSpeed(10);
    assert(engine.getSpeed() === 10, 'T9: Speed changed to 10x');
    engine.destroy();
  }

  // Test 10: Add breakpoint
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    const bpId = engine.addBreakpoint({
      id: 'bp1',
      type: 'price_above',
      condition: { price: 105 },
      enabled: true,
      label: 'Price above 105',
    });

    assert(bpId === 'bp1', 'T10: Breakpoint added with correct ID');
    assert(engine.getBreakpoints().length === 1, 'T10: One breakpoint exists');
    engine.destroy();
  }

  // Test 11: Remove breakpoint
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.addBreakpoint({
      id: 'bp1',
      type: 'price_above',
      condition: { price: 105 },
      enabled: true,
    });

    const removed = engine.removeBreakpoint('bp1');
    assert(removed === true, 'T11: Breakpoint removed successfully');
    assert(engine.getBreakpoints().length === 0, 'T11: No breakpoints remain');
    engine.destroy();
  }

  // Test 12: Toggle breakpoint
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.addBreakpoint({
      id: 'bp1',
      type: 'price_above',
      condition: { price: 105 },
      enabled: true,
    });

    engine.toggleBreakpoint('bp1', false);
    const bps = engine.getBreakpoints();
    assert(bps[0].enabled === false, 'T12: Breakpoint disabled');
    engine.destroy();
  }

  // Test 13: Get current bar
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.stepForward(5);
    const current = engine.getCurrentBar('TEST');
    assert(current !== null, 'T13: Current bar exists');
    assert(current!.timestamp === bars[4].timestamp, 'T13: Current bar is at index 4');
    engine.destroy();
  }

  // Test 14: Get history
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.stepForward(10);
    const history = engine.getHistory('TEST', 5);
    assert(history.length === 5, 'T14: History limited to 5 bars');
    engine.destroy();
  }

  // Test 15: Multi-symbol loading
  {
    const engine = new KLineReplayEngine({ symbols: ['SYM1', 'SYM2'] });
    const bars1 = generateMockBars(30, 100, Date.now());
    const bars2 = generateMockBars(30, 200, Date.now());

    engine.loadData('SYM1', bars1);
    engine.loadData('SYM2', bars2);

    assert(engine.getState() === 'READY', 'T15: Both symbols loaded, state READY');
    assert(engine.getStats().symbols === 2, 'T15: Two symbols tracked');
    engine.destroy();
  }

  // Test 16: Loop mode
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'], loopEnabled: true });
    const bars = generateMockBars(20, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.stepForward(20);
    // After exhausting bars with loop enabled, should not stop
    const state = engine.getState();
    assert(state === 'READY' || state === 'PLAYING', 'T16: Loop mode prevents STOPPED state');
    engine.destroy();
  }

  // Test 17: Clear data
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    engine.loadData('TEST', bars);

    engine.clearData();
    assert(engine.getState() === 'IDLE', 'T17: State is IDLE after clear');
    assert(engine.getStats().totalBars === 0, 'T17: No bars after clear');
    engine.destroy();
  }

  // Test 18: Event emission
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(10, 100, Date.now());
    engine.loadData('TEST', bars);

    let barEventFired = false;
    engine.on('bar', () => { barEventFired = true; });

    engine.stepForward(1);
    assert(barEventFired, 'T18: Bar event emitted on step');
    engine.destroy();
  }

  // Test 19: Volume spike breakpoint
  {
    const engine = new KLineReplayEngine({ symbols: ['TEST'] });
    const bars = generateMockBars(50, 100, Date.now());
    // Inject a high volume bar
    bars[25].volume = 999999;
    engine.loadData('TEST', bars);

    let breakpointHit = false;
    engine.addBreakpoint({
      id: 'vol_spike',
      type: 'volume_spike',
      condition: { volume: 500000 },
      enabled: true,
    });

    engine.on('breakpoint:hit', () => { breakpointHit = true; });

    // Step through until we hit the volume spike
    for (let i = 0; i < 30; i++) {
      engine.stepForward(1);
      if (breakpointHit) break;
    }

    assert(breakpointHit, 'T19: Volume spike breakpoint triggered');
    engine.destroy();
  }

  // Test 20: Load batch
  {
    const engine = new KLineReplayEngine();
    const batch = {
      'SYM1': generateMockBars(20, 100, Date.now()),
      'SYM2': generateMockBars(20, 200, Date.now()),
    };

    engine.loadBatch(batch);
    assert(engine.getStats().symbols === 2, 'T20: Batch loaded 2 symbols');
    assert(engine.getState() === 'READY', 'T20: State READY after batch load');
    engine.destroy();
  }

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  return failed;
}

const failures = run();
process.exit(failures > 0 ? 1 : 0);
