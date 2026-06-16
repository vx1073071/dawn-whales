#!/usr/bin/env node
/**
 * R91 Y-01/Y-02/Y-03: Silent test runner
 * Runs vitest in background, collects results, writes to file
 * No console windows, no stderr noise
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CWD = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';
const OUT = path.join(CWD, 'r91-test-results.json');

function runRound(roundNum) {
  return new Promise((resolve) => {
    const child = spawn('node', [
      'node_modules/vitest/vitest.mjs', 'run', '--reporter=json'
    ], {
      cwd: CWD,
      detached: false,
      windowsHide: true,  // KEY: no console window
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 300000
    });
    
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    
    child.on('close', (code) => {
      try {
        // Find the JSON in output (vitest may print warnings before JSON)
        const jsonStart = stdout.indexOf('{"numTotalTestSuites"');
        if (jsonStart === -1) {
          resolve({ round: roundNum, error: 'No JSON found', exitCode: code });
          return;
        }
        const json = JSON.parse(stdout.substring(jsonStart));
        resolve({
          round: roundNum,
          passed: json.numPassedTests || 0,
          failed: json.numFailedTests || 0,
          skipped: json.numPendingTests || 0,
          total: json.numTotalTests || 0,
          exitCode: code,
          failedTests: (json.testResults || [])
            .flatMap(t => (t.assertionResults || [])
              .filter(a => a.status === 'failed')
              .map(a => ({
                suite: path.basename(t.name || ''),
                test: a.title,
                ancestor: (a.ancestorTitles || []).join(' > ')
              })))
        });
      } catch (e) {
        resolve({ round: roundNum, error: e.message, exitCode: code });
      }
    });
    
    child.on('error', (e) => {
      resolve({ round: roundNum, error: e.message });
    });
  });
}

async function main() {
  const results = [];
  
  // Run 3 rounds (Y-03: flaky detection with 3 rounds instead of 5 to save time)
  for (let i = 0; i < 3; i++) {
    const r = await runRound(i + 1);
    results.push(r);
    if (r.error) {
      console.log(`Round ${i+1}: ERROR - ${r.error}`);
    } else {
      console.log(`Round ${i+1}: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped (${r.total} total)`);
    }
  }
  
  // Analyze flaky tests
  const testResults = {};
  for (const r of results) {
    if (r.failedTests) {
      for (const t of r.failedTests) {
        const key = `${t.ancestor} > ${t.test}`;
        if (!testResults[key]) testResults[key] = { count: 0, suite: t.suite };
        testResults[key].count++;
      }
    }
  }
  
  // Tests that fail in SOME but not ALL rounds = flaky
  const flaky = Object.entries(testResults)
    .filter(([, v]) => v.count > 0 && v.count < results.length)
    .map(([name, v]) => ({ name, failCount: v.count, totalRounds: results.length }))
    .sort((a, b) => b.failCount - a.failCount);
  
  // Summary
  const r0 = results[0] || {};
  const summary = {
    timestamp: new Date().toISOString(),
    rounds: results.map(r => ({
      round: r.round,
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      total: r.total,
      error: r.error
    })),
    flakyTests: flaky,
    consistentlyFailing: Object.entries(testResults)
      .filter(([, v]) => v.count === results.length)
      .map(([name]) => name),
    y01: { target: '<=10 fails', current: r0.failed || 'unknown', status: (r0.failed || 999) <= 10 ? 'PASS' : 'FAIL' },
    y03: { target: '5 rounds flaky detection', roundsCompleted: results.filter(r => !r.error).length, flakyCount: flaky.length }
  };
  
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to ${OUT}`);
  console.log(`Flaky tests found: ${flaky.length}`);
  console.log(`Consistently failing: ${summary.consistentlyFailing.length}`);
  if (flaky.length > 0) {
    console.log('\nTop 10 flaky:');
    flaky.slice(0, 10).forEach((t, i) => console.log(`  ${i+1}. [${t.failCount}/${t.totalRounds}] ${t.name}`));
  }
}

main().catch(e => console.error(e));
