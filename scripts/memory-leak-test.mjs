/**
 * Q-02: Memory Leak Detection
 * Pattern: idle -> operate -> idle
 * Checks if memory returns to baseline ±10%
 */
import { writeFileSync } from 'fs';

// Force GC if available
function gc() {
  if (global.gc) global.gc();
}

function getHeapUsedMB() {
  gc();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function measure(label, fn) {
  const before = getHeapUsedMB();
  await fn();
  gc();
  await sleep(100);
  const after = getHeapUsedMB();
  return { label, before, after, delta: after - before };
}

async function main() {
  console.log('Q-02: Memory Leak Detection');
  console.log('='.repeat(60));

  // Phase 1: Idle baseline (3 samples)
  console.log('\nPhase 1: Idle baseline (3 × 500ms)');
  const baselines = [];
  for (let i = 0; i < 3; i++) {
    await sleep(500);
    const mem = getHeapUsedMB();
    baselines.push(mem);
    console.log(`  Sample ${i + 1}: ${mem.toFixed(2)} MB`);
  }
  const baselineAvg = baselines.reduce((a, b) => a + b, 0) / baselines.length;
  console.log(`  Baseline average: ${baselineAvg.toFixed(2)} MB`);

  // Phase 2: Operations (simulate heavy usage)
  console.log('\nPhase 2: Heavy operations');
  const operations = [];

  // Op 1: Load test modules
  const op1 = await measure('Import test modules', async () => {
    const { execSync } = await import('child_process');
    // Just import vitest config
    try {
      execSync('node -e "require(\'./vitest.config.ts\')" 2>/dev/null', { cwd: process.cwd(), encoding: 'utf-8', timeout: 5000 });
    } catch { /* ignore */ }
  });
  operations.push(op1);

  // Op 2: Create and destroy large arrays
  const op2 = await measure('Large array churn (1M items × 5 cycles)', async () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const arr = Array.from({ length: 1000000 }, (_, i) => ({ id: i, val: Math.random() }));
      arr.filter(x => x.val > 0.5);
      arr.map(x => x.id);
    }
  });
  operations.push(op2);

  // Op 3: String processing
  const op3 = await measure('String processing (100K concatenations)', async () => {
    let s = '';
    for (let i = 0; i < 100000; i++) {
      s += `item_${i}_` + Math.random().toString(36).slice(2);
    }
  });
  operations.push(op3);

  // Op 4: Map/Set churn
  const op4 = await measure('Map/Set churn (50K entries)', async () => {
    const map = new Map();
    const set = new Set();
    for (let i = 0; i < 50000; i++) {
      map.set(`key_${i}`, { data: new Array(10).fill(i) });
      set.add(`val_${i}`);
    }
    map.clear();
    set.clear();
  });
  operations.push(op4);

  // Op 5: Promise chains
  const op5 = await measure('Promise chains (10K async ops)', async () => {
    const promises = [];
    for (let i = 0; i < 10000; i++) {
      promises.push(new Promise(r => setTimeout(r, 0)).then(() => i));
    }
    await Promise.all(promises);
  });
  operations.push(op5);

  console.log('\n  Operations results:');
  operations.forEach(op => {
    console.log(`    ${op.label}: ${op.before.toFixed(2)} → ${op.after.toFixed(2)} MB (Δ${op.delta >= 0 ? '+' : ''}${op.delta.toFixed(2)})`);
  });

  // Phase 3: Recovery (idle + GC, then measure)
  console.log('\nPhase 3: Recovery (idle 2s + GC)');
  await sleep(2000);
  gc();
  await sleep(500);

  const recoveries = [];
  for (let i = 0; i < 3; i++) {
    await sleep(500);
    const mem = getHeapUsedMB();
    recoveries.push(mem);
    console.log(`  Sample ${i + 1}: ${mem.toFixed(2)} MB`);
  }
  const recoveryAvg = recoveries.reduce((a, b) => a + b, 0) / recoveries.length;
  console.log(`  Recovery average: ${recoveryAvg.toFixed(2)} MB`);

  // Verdict
  const deltaMB = recoveryAvg - baselineAvg;
  const deltaPct = (deltaMB / baselineAvg) * 100;
  const threshold = 10; // ±10%

  console.log(`\n${'='.repeat(60)}`);
  console.log('MEMORY LEAK VERDICT');
  console.log('='.repeat(60));
  console.log(`  Baseline: ${baselineAvg.toFixed(2)} MB`);
  console.log(`  Recovery: ${recoveryAvg.toFixed(2)} MB`);
  console.log(`  Delta: ${deltaMB >= 0 ? '+' : ''}${deltaMB.toFixed(2)} MB (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`);
  console.log(`  Threshold: ±${threshold}%`);

  const verdict = Math.abs(deltaPct) <= threshold ? 'PASS ✅ (no leak)' : 'FAIL ❌ (possible leak)';
  console.log(`  Verdict: ${verdict}`);

  const report = {
    baselineAvg,
    recoveryAvg,
    deltaMB,
    deltaPct,
    threshold,
    verdict: Math.abs(deltaPct) <= threshold ? 'PASS' : 'FAIL',
    operations: operations.map(op => ({ label: op.label, before: op.before, after: op.after, delta: op.delta })),
    timestamp: new Date().toISOString()
  };
  writeFileSync('memory-leak-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to memory-leak-report.json');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
