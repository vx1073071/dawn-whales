const { execSync } = require('child_process');
const fs = require('fs');

// Run vitest with JSON reporter for clean output
try {
  const out = execSync(
    'node --no-warnings node_modules/vitest/vitest.mjs run --reporter=json --outputFile=test-results.json 2>&1',
    { cwd: __dirname, encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }
  );
} catch (e) {
  // vitest exits non-zero on test failure, that's fine
}

// Parse JSON results
const raw = fs.readFileSync(__dirname + '/test-results.json', 'utf-8');
const data = JSON.parse(raw);

const failedFiles = [];
const failedTests = [];
let totalPassed = 0;
let totalFailed = 0;

for (const f of data.testResults || []) {
  if (f.status === 'failed') {
    failedFiles.push({ file: f.name, message: (f.message || '').substring(0, 200) });
  }
  for (const t of f.assertionResults || []) {
    if (t.status === 'failed') {
      failedTests.push({
        file: f.name.split('\\').pop().split('/').pop(),
        test: t.fullName || t.title,
        msg: (t.failureMessages || [])[0] || ''
      });
      totalFailed++;
    } else {
      totalPassed++;
    }
  }
}

// Categorize failures
const categories = {};
for (const ft of failedTests) {
  const m = ft.msg.substring(0, 100);
  const key = m.includes('Cannot find module') ? 'Module Not Found' :
              m.includes('is not defined') ? 'Not Defined' :
              m.includes('TypeError') ? 'TypeError' :
              m.includes('expected') ? 'Assertion Failed' :
              m.includes('timeout') ? 'Timeout' :
              m.includes('mock') || m.includes('Mock') ? 'Mock Issue' :
              'Other';
  if (!categories[key]) categories[key] = [];
  categories[key].push(ft.file + ' > ' + ft.test.substring(0, 60));
}

// Write report
let report = '';
report += `# Test Failure Analysis\n`;
report += `Total: ${totalPassed} passed, ${totalFailed} failed\n`;
report += `Failed test files: ${failedFiles.length}\n\n`;
report += `## Categories\n`;
for (const [cat, items] of Object.entries(categories).sort((a,b) => b[1].length - a[1].length)) {
  report += `\n### ${cat} (${items.length})\n`;
  for (const item of items.slice(0, 5)) {
    report += `- ${item}\n`;
  }
  if (items.length > 5) report += `- ... and ${items.length - 5} more\n`;
}

report += `\n## Failed Files (first 30)\n`;
for (const f of failedFiles.slice(0, 30)) {
  const fname = f.file.split('\\').pop().split('/').pop();
  report += `- ${fname}: ${(f.message || 'no message').substring(0, 120)}\n`;
}

fs.writeFileSync(__dirname + '/test-analysis.md', report, 'utf-8');
console.log(report);
