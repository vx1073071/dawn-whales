// DAWN WHALES — Performance Benchmark (R88 J-03)
// Engine + core operations benchmark for CI performance monitoring.
// Run: node scripts/benchmark.js                    → human-readable
//      node scripts/benchmark.js --json             → CI machine-readable
//      node scripts/benchmark.js --json --output result.json

const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const START = performance.now();

const USE_JSON = process.argv.includes('--json');
const OUTPUT_FILE = process.argv.includes('--output') && process.argv[process.argv.indexOf('--output') + 1];

// ── Benchmark helpers ──────────────────────────────────────────────────────

/** @type {{ name: string, ms: number, ops: number }[]} */
const results = [];

function bench(name, fn, iterations = 1000) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const ms = parseFloat((performance.now() - t0).toFixed(2));
  const ops = Math.round(iterations / (ms / 1000));
  results.push({ name, ms, ops });

  if (!USE_JSON) {
    console.log(`  ${name.padEnd(42)} ${String(ms).padStart(8)}ms  ${ops.toLocaleString().padStart(10)} ops/s`);
  }
}

// ── 1. Core Math ───────────────────────────────────────────────────────────

bench('Math.sqrt x100K', () => {
  for (let i = 0; i < 100000; i++) Math.sqrt(i);
}, 1);

bench('normalCDF x10K', () => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  for (let i = -5000; i < 5000; i++) {
    const x = i / 100, t = 1 / (1 + p * Math.abs(x));
    const y = 1 - (a1*t + a2*t**2 + a3*t**3 + a4*t**4 + a5*t**5) * Math.exp(-x*x/2);
  }
}, 1);

bench('EMA(period=12) x10K', () => {
  const prices = Array.from({ length: 100 }, () => 100 + Math.random() * 20);
  const k = 2 / 13; // period=12
  let ema = prices[0];
  for (let n = 0; n < 100; n++) {
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
  }
}, 1);

// ── 2. Array Operations ────────────────────────────────────────────────────

const arr10K = Array.from({ length: 10000 }, () => Math.random());
bench('Array.reduce sum 10K', () => arr10K.reduce((a, b) => a + b, 0));
bench('Array.sort 10K random', () => [...arr10K].sort((a, b) => a - b));
bench('Array.map + filter 10K', () => arr10K.map(x => x * 2).filter(x => x > 0.5));

// ── 3. Object Operations ───────────────────────────────────────────────────

const objSmall = { a: 1, b: 2, c: 3, d: 4, e: 5 };
bench('JSON.stringify small', () => { for (let i = 0; i < 1000; i++) JSON.stringify(objSmall); });
bench('JSON.parse roundtrip', () => {
  const s = JSON.stringify(objSmall);
  for (let i = 0; i < 1000; i++) JSON.parse(s);
});

// ── 4. String Operations (i18n / template processing) ──────────────────────

const template = 'The {symbol} price is {price} USD at {time}';
bench('String.replace template x10K', () => {
  for (let i = 0; i < 10000; i++) {
    template.replace('{symbol}', 'NVDA').replace('{price}', '142.80').replace('{time}', '14:30:00');
  }
}, 1);

// ── 5. Hash / Crypto (JWT, cache keys, etc.) ───────────────────────────────

const crypto = require('crypto');
bench('SHA256 hash x100', () => {
  for (let i = 0; i < 100; i++) {
    crypto.createHash('sha256').update(JSON.stringify({ id: i, data: 'test' })).digest('hex');
  }
});
bench('MD5 cache key x1000', () => {
  for (let i = 0; i < 1000; i++) {
    crypto.createHash('md5').update(`agent|prompt${i}|user_input_${i}|v4-pro|0.7`).digest('hex');
  }
});

// ── 6. Strategy Signal Computation (simulated) ────────────────────────────

bench('MACD signal x1K', () => {
  const closes = Array.from({ length: 200 }, () => 100 + Math.random() * 50);
  for (let n = 0; n < 1000; n++) {
    let ema12 = closes[0], ema26 = closes[0], signal = 0;
    for (let i = 1; i < closes.length; i++) {
      ema12 = closes[i] * (2/13) + ema12 * (11/13);
      ema26 = closes[i] * (2/27) + ema26 * (25/27);
    }
    const macd = ema12 - ema26;
    signal = macd * (2/10) + signal * (8/10);
  }
}, 1);

bench('RSI(14) x1K', () => {
  const closes = Array.from({ length: 100 }, () => 100 + Math.random() * 50);
  for (let n = 0; n < 1000; n++) {
    let gain = 0, loss = 0;
    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i-1];
      if (diff > 0) gain += diff; else loss -= diff;
    }
    const avgGain = gain / 14, avgLoss = loss / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
  }
}, 1);

// ── 7. RegExp / Pattern Matching ──────────────────────────────────────────

const symbols = ['US.NVDA', 'HK.00700', 'SH.600519', 'US.AAPL', 'SZ.000858'];
bench('regex match symbols x10K', () => {
  for (let n = 0; n < 10000; n++) {
    for (const s of symbols) {
      /^(US|HK|SH|SZ)\.(\w+)$/.test(s);
    }
  }
}, 1);

// ── Summary ────────────────────────────────────────────────────────────────

const totalMs = parseFloat((performance.now() - START).toFixed(0));
const totalOps = results.reduce((sum, r) => sum + r.ops, 0);
const avgOps = Math.round(totalOps / results.length);
const PASS_THRESHOLD = 5000; // 5 seconds total
const passed = totalMs < PASS_THRESHOLD;

if (USE_JSON) {
  // ── JSON output (CI machine-readable) ──
  const report = {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    passed,
    totalMs,
    thresholdMs: PASS_THRESHOLD,
    avgOpsPerSec: avgOps,
    testCount: results.length,
    results,
  };

  const json = JSON.stringify(report, null, 2);
  if (OUTPUT_FILE) {
    fs.writeFileSync(path.resolve(OUTPUT_FILE), json, 'utf8');
    console.log(`Benchmark report written to ${OUTPUT_FILE}`);
  } else {
    console.log(json);
  }
} else {
  // ── Human-readable table ──
  console.log(`\n┌─ DAWN WHALES Benchmark — R88 J-03 ────────────────────────────────┐`);
  console.log(`│ Node: ${process.version.padEnd(18)} Platform: ${process.platform}/${process.arch}`.padEnd(67) + '│');
  console.log(`│ Total: ${String(totalMs + 'ms').padEnd(18)} Avg: ${String(avgOps.toLocaleString()).padEnd(12)} ops/s`.padEnd(67) + '│');
  if (passed) {
    console.log('│ ✅ PASS (under ' + PASS_THRESHOLD + 'ms threshold)                                            │');
  } else {
    console.log('│ ⚠️  WARN (over ' + PASS_THRESHOLD + 'ms threshold — check system load)'.padEnd(67) + '│');
  }
  console.log('└────────────────────────────────────────────────────────────────┘');
}

// ── Exit code for CI ──
process.exit(passed ? 0 : 1);
