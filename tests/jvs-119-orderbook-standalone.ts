// JVS-119: Order Book Snapshot Manager Test (standalone tsx)
import { OrderBookSnapshotManager, OrderBookSnapshot } from '../electron/engine/order-book-snapshot-manager';

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
  console.log('\n━━ JVS-119: Order Book Snapshot Manager ━━');

  const mgr = new OrderBookSnapshotManager({
    maxSnapshots: 50,
    depthLevels: 5,
    enableSpreadAlerts: true,
    spreadAlertThreshold: 1.0,
  });

  assert(mgr.getSymbols().length === 0, 'init: no symbols');

  // Create order book snapshot
  const book1: OrderBookSnapshot = {
    symbol: '600519',
    timestamp: Date.now(),
    bids: [
      { price: 1800, quantity: 100 },
      { price: 1799, quantity: 200 },
      { price: 1798, quantity: 150 },
    ],
    asks: [
      { price: 1802, quantity: 120 },
      { price: 1803, quantity: 180 },
      { price: 1804, quantity: 160 },
    ],
  };

  mgr.updateSnapshot(book1);
  assert(mgr.getLatestBook('600519') !== null, 'updateSnapshot: stored');

  // Get best prices
  const best = mgr.getBestPrices('600519');
  assert(best.bid === 1800, 'bestPrices: bid=1800');
  assert(best.ask === 1802, 'bestPrices: ask=1802');

  // Spread analysis
  const spread = mgr.analyzeSpread('600519');
  assert(spread !== null, 'analyzeSpread: exists');
  assert(spread!.bestBid === 1800, 'spread: bestBid=1800');
  assert(spread!.bestAsk === 1802, 'spread: bestAsk=1802');
  assert(spread!.spread === 2, 'spread: spread=2');
  assert(spread!.midPrice === 1801, 'spread: midPrice=1801');
  assert(spread!.bidDepth === 450, 'spread: bidDepth=450');
  assert(spread!.askDepth === 460, 'spread: askDepth=460');

  // Depth analysis
  const depth = mgr.analyzeDepth('600519');
  assert(depth !== null, 'analyzeDepth: exists');
  assert(depth!.totalBidVolume === 450, 'depth: totalBidVolume=450');
  assert(depth!.totalAskVolume === 460, 'depth: totalAskVolume=460');
  assert(depth!.cumulativeBidVolume.length === 3, 'depth: cumulativeBidVolume has 3 levels');
  assert(depth!.volumeRatio > 0, 'depth: volumeRatio > 0');

  // Sorting validation
  const unsorted: OrderBookSnapshot = {
    symbol: '000001',
    timestamp: Date.now(),
    bids: [
      { price: 50, quantity: 100 },
      { price: 52, quantity: 200 }, // Should be first
      { price: 51, quantity: 150 },
    ],
    asks: [
      { price: 55, quantity: 120 },
      { price: 53, quantity: 180 }, // Should be first
      { price: 54, quantity: 160 },
    ],
  };

  mgr.updateSnapshot(unsorted);
  const sortedBook = mgr.getLatestBook('000001');
  assert(sortedBook!.bids[0].price === 52, 'sorting: bids sorted desc');
  assert(sortedBook!.asks[0].price === 53, 'sorting: asks sorted asc');

  // History
  const history = mgr.getHistory('600519');
  assert(history.length === 1, 'history: 1 snapshot');

  // Wide spread alert
  let alertEmitted = false;
  mgr.on('spreadAlert', () => { alertEmitted = true; });
  const wideSpreadBook: OrderBookSnapshot = {
    symbol: 'WIDE',
    timestamp: Date.now(),
    bids: [{ price: 100, quantity: 100 }],
    asks: [{ price: 105, quantity: 100 }], // 5% spread
  };
  mgr.updateSnapshot(wideSpreadBook);
  assert(alertEmitted, 'spreadAlert: emitted for wide spread');

  // Get symbols
  const symbols = mgr.getSymbols();
  assert(symbols.includes('600519') && symbols.includes('000001'), 'getSymbols: includes both');

  // Stats
  const stats = mgr.getStats();
  assert(stats.totalSymbols >= 2, 'stats: totalSymbols >= 2');
  assert(stats.totalSnapshots >= 2, 'stats: totalSnapshots >= 2');

  // Clear symbol
  mgr.clearSymbol('WIDE');
  assert(mgr.getLatestBook('WIDE') === null, 'clearSymbol: WIDE cleared');

  // Clear all
  mgr.clearAll();
  assert(mgr.getSymbols().length === 0, 'clearAll: all symbols cleared');

  mgr.destroy();

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
