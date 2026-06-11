// R92 youdao: Run full vitest suite, capture JSON results, analyze
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales';
process.chdir(ROOT);

console.log('[R92] Starting full vitest run...');
const startTime = Date.now();

try {
  // Use JSON reporter for machine-readable output
  const output = execSync('npx vitest run --reporter=json 2>&1', {
    encoding: 'utf-8',
    timeout: 600000,  // 10 minutes
    maxBuffer: 100 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Save raw output
  fs.writeFileSync(path.join(ROOT, 'scripts/r92-full-results.json'), output);
  
  // Try to parse JSON
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch(e) {
    // JSON might have extra output before it
    const jsonStart = output.indexOf('{');
    if (jsonStart > 0) {
      parsed = JSON.parse(output.substring(jsonStart));
    } else {
      console.log('[R92] Could not parse JSON output');
      console.log('[R92] First 500 chars:', output.substring(0, 500));
      console.log('[R92] Last 500 chars:', output.substring(output.length - 500));
      process.exit(1);
    }
  }
  
  const results = parsed.testResults || [];
  let totalPass = 0, totalFail = 0, totalSkip = 0;
  const failDetails = [];
  
  for (const file of results) {
    const assertions = file.assertionResults || [];
    for (const a of assertions) {
      if (a.status === 'passed') totalPass++;
      else if (a.status === 'failed') {
        totalFail++;
        const shortFile = file.name.replace(/.*dawn-whales[\\/]/, '');
        failDetails.push({
          file: shortFile,
          test: (a.ancestorTitles || []).concat(a.title || a.fullName || '').join(' > '),
          message: (a.failureMessages || []).join('\n').substring(0, 300)
        });
      }
      else if (a.status === 'pending' || a.status === 'skipped') totalSkip++;
    }
  }
  
  console.log(`[R92] Done in ${elapsed}s`);
  console.log(`[R92] PASS: ${totalPass}, FAIL: ${totalFail}, SKIP: ${totalSkip}`);
  console.log(`[R92] Total: ${totalPass + totalFail + totalSkip}`);
  
  // Group failures by file
  const byFile = {};
  for (const f of failDetails) {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  }
  
  console.log(`\n[R92] FAILING FILES: ${Object.keys(byFile).length}`);
  for (const [file, fails] of Object.entries(byFile)) {
    console.log(`\n  ${file} (${fails.length} fails):`);
    for (const f of fails) {
      console.log(`    × ${f.test}`);
      if (f.message) {
        const firstLine = f.message.split('\n')[0].substring(0, 150);
        console.log(`      → ${firstLine}`);
      }
    }
  }
  
  // Save detailed report
  fs.writeFileSync(path.join(ROOT, 'scripts/r92-fail-report.json'), JSON.stringify({
    elapsed,
    totalPass,
    totalFail,
    totalSkip,
    failDetails
  }, null, 2));
  
  console.log('\n[R92] Reports saved to scripts/r92-full-results.json and scripts/r92-fail-report.json');
  
} catch(e) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[R92] Failed after ${elapsed}s, exit code: ${e.status}`);
  if (e.stdout) {
    fs.writeFileSync(path.join(ROOT, 'scripts/r92-full-results.txt'), e.stdout);
    // Try to extract summary
    const lines = e.stdout.split('\n');
    const summaryLines = lines.filter(l => /Tests|Test Files|passed|failed/.test(l));
    console.log('[R92] Summary lines:');
    summaryLines.forEach(l => console.log('  ' + l.trim()));
    
    // Extract × lines
    const failLines = lines.filter(l => l.includes('\u00d7'));
    console.log(`[R92] Fail markers: ${failLines.length}`);
    failLines.slice(0, 30).forEach(l => console.log('  ' + l.trim().substring(0, 200)));
    
    console.log('[R92] Full output saved to scripts/r92-full-results.txt');
  }
  if (e.stderr) console.log('[R92] STDERR:', e.stderr.substring(0, 500));
}
