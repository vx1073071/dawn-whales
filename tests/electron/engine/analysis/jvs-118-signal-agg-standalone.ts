// JVS-118: Strategy Signal Aggregator Test (standalone tsx)
import { StrategySignalAggregator, StrategySignal } from '../electron/engine/strategy-signal-aggregator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

async function run() {
  console.log('\n━━ JVS-118: Strategy Signal Aggregator ━━');

  const agg = new StrategySignalAggregator({
    strategyWeights: { MACD: 1.5, RSI: 1.0, BBANDS: 1.2 },
    minStrategies: 2,
    signalTtlMs: 60_000,
  });

  assert(agg.getSymbols().length === 0, 'init: no symbols');

  // Add signals
  const sig1: StrategySignal = {
    strategy: 'MACD',
    symbol: '600519',
    direction: 'BUY',
    strength: 80,
    timestamp: Date.now(),
  };
  agg.addSignal(sig1);
  assert(agg.getSignals('600519').length === 1, 'addSignal: 1 signal');

  // Not enough strategies yet
  assert(agg.getLatestComposite('600519') === null, 'minStrategies: no composite yet');

  // Add second signal
  const sig2: StrategySignal = {
    strategy: 'RSI',
    symbol: '600519',
    direction: 'BUY',
    strength: 70,
    timestamp: Date.now(),
  };
  agg.addSignal(sig2);

  // Now should have composite
  const comp1 = agg.getLatestComposite('600519');
  assert(comp1 !== null, 'composite: created after minStrategies');
  assert(comp1!.direction === 'BUY', 'composite: BUY direction');
  assert(comp1!.contributingStrategies === 2, 'composite: 2 strategies');

  // Weighted scoring
  const sig3: StrategySignal = {
    strategy: 'BBANDS',
    symbol: '600519',
    direction: 'SELL',
    strength: 60,
    timestamp: Date.now(),
  };
  agg.addSignal(sig3);

  const comp2 = agg.getLatestComposite('600519');
  assert(comp2 !== null && comp2.contributingStrategies === 3, 'composite: 3 strategies');
  assert(comp2!.breakdown.length === 3, 'breakdown: 3 entries');

  // Mixed signals
  const mixedAgg = new StrategySignalAggregator({ minStrategies: 2 });
  mixedAgg.addSignal({ strategy: 'A', symbol: 'X', direction: 'BUY', strength: 80, timestamp: Date.now() });
  mixedAgg.addSignal({ strategy: 'B', symbol: 'X', direction: 'SELL', strength: 90, timestamp: Date.now() });
  const mixedComp = mixedAgg.getLatestComposite('X');
  assert(mixedComp !== null, 'mixed: composite exists');
  assert(mixedComp!.direction === 'SELL', 'mixed: stronger signal wins');

  // Confidence calculation
  const confAgg = new StrategySignalAggregator({ minStrategies: 3, enableConfidence: true });
  confAgg.addSignal({ strategy: 'A', symbol: 'Y', direction: 'BUY', strength: 80, timestamp: Date.now() });
  confAgg.addSignal({ strategy: 'B', symbol: 'Y', direction: 'BUY', strength: 75, timestamp: Date.now() });
  confAgg.addSignal({ strategy: 'C', symbol: 'Y', direction: 'BUY', strength: 85, timestamp: Date.now() });
  const confComp = confAgg.getLatestComposite('Y');
  assert(confComp!.confidence > 50, 'confidence: high agreement');

  // History
  const history = agg.getCompositeHistory('600519');
  assert(history.length > 0, 'history: has entries');

  // Set weight
  agg.setWeight('NEWMACD', 2.0);
  assert(true, 'setWeight: no error');

  // Stats
  const stats = agg.getStats();
  assert(stats.totalSymbols === 1, 'stats: 1 symbol');
  assert(stats.totalSignals === 3, 'stats: 3 signals');
  assert(stats.avgStrategiesPerSymbol === 3, 'stats: avg 3 strategies');

  // Get symbols
  const symbols = agg.getSymbols();
  assert(symbols.includes('600519'), 'getSymbols: includes 600519');

  // Clear symbol
  agg.clearSymbol('600519');
  assert(agg.getSignals('600519').length === 0, 'clearSymbol: signals cleared');
  assert(agg.getLatestComposite('600519') === null, 'clearSymbol: composite cleared');

  agg.destroy();
  mixedAgg.destroy();
  confAgg.destroy();

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
