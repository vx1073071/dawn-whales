#!/usr/bin/env node
/**
 * R91 Y-03: Flaky Test Detection Script
 * Runs tests in batches by directory to avoid OOM
 * Tracks which tests fail inconsistently across runs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIRS = [
  'tests/market',
  'tests/account', 
  'tests/broker',
  'tests/strategy',
  'tests/risk',
  'tests/executor',
  'tests/automation',
  'tests/ui-trading',
  'tests/ui-monitor',
  'tests/integration',
  'tests/performance',
  'tests/ui-config'
];

const ROUNDS = 3; // Reduced from 5 to save time
const RESULTS_FILE = 'flaky-test-results.json';

const results = {
  startTime: new Date().toISOString(),
  rounds: [],
  flakyTests: [],
  summary: {}
};

function runTestBatch(dir, round) {
  console.log(`\n[Round ${round + 1}/${ROUNDS}] Running ${dir}...`);
  
  try {
    const output = execSync(
      `npx vitest run ${dir} --reporter=json`,
      { 
        cwd: path.dirname(__dirname),
        encoding: 'utf8',
        timeout: 120000, // 2 min timeout per batch
        stdio: 'pipe'
      }
    );
    
    // Parse JSON output
    const match = output.match(/\{[\s\S]*\}/);
    if (match) {
      const json = JSON.parse(match[0]);
      return {
        dir,
        round,
        passed: json.numPassedTests || 0,
        failed: json.numFailedTests || 0,
        skipped: json.numPendingTests || 0,
        tests: json.testResults?.map(t => ({
          name: t.name,
          status: t.status,
          duration: t.duration
        })) || []
      };
    }
  } catch (error) {
    // Process killed or timeout
    return {
      dir,
      round,
      passed: 0,
      failed: -1,
      skipped: 0,
      tests: [],
      error: error.message.substring(0, 200)
    };
  }
  return { dir, round, passed: 0, failed: 0, skipped: 0, tests: [] };
}

function detectFlaky() {
  const testMap = new Map();
  
  // Group results by test name
  for (const round of results.rounds) {
    for (const test of round.tests) {
      const key = test.name;
      if (!testMap.has(key)) {
        testMap.set(key, []);
      }
      testMap.get(key).push(test.status);
    }
  }
  
  // Find tests with inconsistent results
  const flaky = [];
  for (const [name, statuses] of testMap) {
    const unique = new Set(statuses);
    if (unique.size > 1) {
      flaky.push({
        name,
        statuses,
        failureRate: statuses.filter(s => s === 'failed').length / statuses.length
      });
    }
  }
  
  return flaky.sort((a, b) => b.failureRate - a.failureRate);
}

// Main execution
console.log('=== R91 Y-03: Flaky Test Detection ===');
console.log(`Running ${ROUNDS} rounds across ${TEST_DIRS.length} directories\n`);

for (let round = 0; round < ROUNDS; round++) {
  const roundResults = [];
  for (const dir of TEST_DIRS) {
    const result = runTestBatch(dir, round);
    roundResults.push(result);
    console.log(`  ${dir}: ${result.passed} passed, ${result.failed} failed`);
  }
  results.rounds.push(roundResults);
}

// Detect flaky tests
results.flakyTests = detectFlaky();

// Generate summary
const allTests = results.rounds.flat().flatMap(r => r.tests);
results.summary = {
  totalTests: allTests.length,
  flakyCount: results.flakyTests.length,
  stableCount: allTests.length - results.flakyTests.length,
  flakyRate: (results.flakyTests.length / allTests.length * 100).toFixed(2) + '%'
};

// Save results
fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n=== Results ===');
console.log(`Total tests analyzed: ${results.summary.totalTests}`);
console.log(`Flaky tests found: ${results.summary.flakyCount}`);
console.log(`Flaky rate: ${results.summary.flakyRate}`);
console.log(`\nDetailed results saved to: ${RESULTS_FILE}`);

if (results.flakyTests.length > 0) {
  console.log('\nTop 10 Flaky Tests:');
  results.flakyTests.slice(0, 10).forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${(t.failureRate * 100).toFixed(0)}% failure rate)`);
  });
}
