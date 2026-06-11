// JVS-117: Market Data Cache Manager Test (standalone tsx)
import { MarketDataCacheManager } from '../electron/engine/market-data-cache-manager';

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
  console.log('\n━━ JVS-117: Market Data Cache Manager ━━');

  const cache = new MarketDataCacheManager<string>({
    maxEntries: 5,
    defaultTtlMs: 1000,
    evictionPolicy: 'lru',
  });

  assert(cache.keys().length === 0, 'init: empty cache');

  // Set and get
  cache.set('key1', 'value1');
  assert(cache.get('key1') === 'value1', 'set/get: key1');

  // Miss
  assert(cache.get('nonexistent') === null, 'miss: nonexistent key');

  // Has
  assert(cache.has('key1') === true, 'has: key1 exists');
  assert(cache.has('nonexistent') === false, 'has: nonexistent');

  // Multiple entries
  cache.set('key2', 'value2');
  cache.set('key3', 'value3');
  assert(cache.keys().length === 3, 'multiple: 3 entries');

  // TTL expiration
  cache.set('expiring', 'temp', 100);
  assert(cache.get('expiring') === 'temp', 'ttl: before expiry');
  await new Promise(r => setTimeout(r, 150));
  assert(cache.get('expiring') === null, 'ttl: after expiry');

  // LRU eviction
  const smallCache = new MarketDataCacheManager<number>({ maxEntries: 3, defaultTtlMs: 10000 });
  smallCache.set('a', 1);
  await new Promise(r => setTimeout(r, 10));
  smallCache.set('b', 2);
  await new Promise(r => setTimeout(r, 10));
  smallCache.set('c', 3);
  await new Promise(r => setTimeout(r, 10));
  smallCache.get('a'); // Access 'a' to make it recent
  smallCache.get('c'); // Access 'c' to make it recent
  await new Promise(r => setTimeout(r, 10));
  smallCache.set('d', 4); // Should evict 'b' (least recently used)
  assert(smallCache.has('a') && smallCache.has('c') && smallCache.has('d'), 'lru: kept recent');
  assert(!smallCache.has('b'), 'lru: evicted oldest');
  smallCache.destroy();

  // getOrSet
  const val = cache.getOrSet('newkey', () => 'computed', 5000);
  assert(val === 'computed', 'getOrSet: computed value');
  assert(cache.get('newkey') === 'computed', 'getOrSet: cached');

  // Delete
  cache.delete('key2');
  assert(!cache.has('key2'), 'delete: key2 removed');

  // Stats
  const stats = cache.getStats();
  assert(stats.hitCount > 0, 'stats: hitCount > 0');
  assert(stats.missCount > 0, 'stats: missCount > 0');
  assert(stats.hitRate >= 0 && stats.hitRate <= 1, 'stats: hitRate valid');

  // Entries
  const entries = cache.entries();
  assert(entries.length > 0, 'entries: has valid entries');
  assert(entries[0].age >= 0, 'entries: age >= 0');

  // Clean expired
  cache.set('short', 'temp', 50);
  await new Promise(r => setTimeout(r, 100));
  const cleaned = cache.cleanExpired();
  assert(cleaned >= 1, 'cleanExpired: removed expired');

  // Clear
  cache.clear();
  assert(cache.keys().length === 0, 'clear: all entries removed');
  const statsAfterClear = cache.getStats();
  assert(statsAfterClear.hitCount === 0, 'clear: stats reset');

  cache.destroy();

  console.log(`\n━━ Results: ${passed} passed, ${failed} failed ━━`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
