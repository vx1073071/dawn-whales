#!/usr/bin/env node
/**
 * test-batch.js — OOM-safe batch test runner
 * 
 * Runs tests in small batches with forced GC between batches.
 * Usage:
 *   node scripts/test-batch.js              # Run all tests in batches of 10
 *   node scripts/test-batch.js 5            # Batches of 5
 *   node scripts/test-batch.js 10 electron/ # Only electron tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = parseInt(process.argv[2]) || 10;
const FILTER = process.argv[3] || '';
const REPO = path.resolve(__dirname, '..');

// Find all test files
function walk(dir) {
  let files = [];
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
        files = files.concat(walk(full));
      } else if (entry.match(/\.test\.(ts|tsx|js)$/)) {
        files.push(full);
      }
    }
  } catch(e) {}
  return files;
}

let allTests = walk(REPO);
if (FILTER) {
  allTests = allTests.filter(f => f.replace(/\\/g, '/').includes(FILTER));
}

// Exclude standalone tests (they have their own runners)
allTests = allTests.filter(f => !f.endsWith('.standalone.ts'));

console.log(`\n=== OOM-Safe Batch Test Runner ===`);
console.log(`Test files found: ${allTests.length}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log(`Batches: ${Math.ceil(allTests.length / BATCH_SIZE)}\n`);

let passed = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < allTests.length; i += BATCH_SIZE) {
  const batch = allTests.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(allTests.length / BATCH_SIZE);
  
  console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.length} files) ---`);
  batch.forEach(f => console.log(`  ${path.relative(REPO, f)}`));
  
  const files = batch.map(f => path.relative(REPO, f)).join(' ');
  try {
    execSync(`npx vitest run ${files} --no-coverage --reporter=verbose`, {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 600000, // 10 min per batch
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      stdio: 'pipe',
    });
    passed += batch.length;
    console.log(`  ✅ Batch ${batchNum} passed`);
  } catch(e) {
    failed += batch.length;
    const output = (e.stdout || '') + (e.stderr || '');
    const failLines = output.split('\n').filter(l => l.includes('FAIL') || l.includes('Error'));
    failures.push({
      batch: batchNum,
      files: batch.map(f => path.relative(REPO, f)),
      errors: failLines.slice(0, 5),
    });
    console.log(`  ❌ Batch ${batchNum} failed`);
    failLines.slice(0, 3).forEach(l => console.log(`    ${l.trim()}`));
  }
  
  // Force GC hint between batches
  if (global.gc) global.gc();
}

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`=== BATCH TEST SUMMARY ===`);
console.log(`Total: ${allTests.length} files`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Pass rate: ${((passed / allTests.length) * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log(`\n=== FAILURES ===`);
  failures.forEach(f => {
    console.log(`\nBatch ${f.batch}:`);
    f.files.forEach(file => console.log(`  - ${file}`));
    f.errors.forEach(e => console.log(`    ${e}`));
  });
}

process.exit(failed > 0 ? 1 : 0);
