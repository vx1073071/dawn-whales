// ├─ DAWN WHALES — Performance Benchmark (R88 J-03) ───────────────────────
// Quick engine benchmark for CI performance monitoring.
// Run: node scripts/benchmark.js

const { performance } = require('perf_hooks');
const START = performance.now();

// ── Benchmark helpers ──────────────────────────────────────────────────────

function bench(name, fn, iterations = 1000) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const ms = (performance.now() - t0).toFixed(2);
  const ops = Math.round(iterations / (ms / 1000));
  console.log(`  ${name.padEnd(40)} ${ms.padStart(8)}ms  ${ops.toLocaleString().padStart(10)} ops/s`);
}

// ── Core math ────────────────────────────────────────────────────────────

bench('Math.sqrt x1000', () => { for (let i = 0; i < 1000; i++) Math.sqrt(i); });

bench('normalCDF x1000', () => {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  for (let i = -500; i < 500; i++) {
    const x = i/100, sign = x<0?-1:1, t=1/(1+p*Math.abs(x));
    const y = 1-(a1*t+a2*t*t+a3*t*t*t+a4*t*t*t*t+a5*t*t*t*t*t)*Math.exp(-x*x/2);
  }
});

// ── Array ops ─────────────────────────────────────────────────────────────

const arr = Array.from({length: 10000}, () => Math.random());
bench('Array.reduce sum 10K', () => arr.reduce((a,b)=>a+b,0));

// ── Object ops ────────────────────────────────────────────────────────────

const obj = { a:1, b:2, c:3, d:4, e:5 };
bench('JSON.stringify x1000', () => { for(let i=0;i<1000;i++) JSON.stringify(obj); });

// ── Summary ───────────────────────────────────────────────────────────────

const total = (performance.now() - START).toFixed(0);
console.log(`\n┌─ Total: ${total}ms — Threshold: <500ms ─────────────────────────────┐`);
if (parseInt(total) < 500) console.log('│ ✅ PASS (under 500ms threshold)');
else console.log('│ ⚠️  WARN (over 500ms threshold)');
console.log('└────────────────────────────────────────────────────────────────┘');
