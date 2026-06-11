// Deep analysis of assertion failures - extract specific failure messages per file
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
const failed = d.testResults.filter(f => f.status === 'failed');

// For each failed file, list all failed tests with their error messages (shortened)
failed.forEach(f => {
  const fn = f.name.replace(/.*[/\\]tests[/\\]/, 'tests/');
  const fails = f.assertionResults.filter(a => a.status === 'failed');
  if (fails.length === 0) return;
  
  console.log(`\n=== ${fn} (${fails.length} fails) ===`);
  fails.forEach(a => {
    const msg = (a.failureMessages || []).join(' ').substring(0, 200);
    console.log(`  FAIL: ${a.title}`);
    console.log(`    ${msg}`);
  });
});
