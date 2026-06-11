// Count failures per file from test output
const fs = require('fs');
const data = fs.readFileSync('test-run-v4.txt', 'utf8')
  .replace(/\x1b\[[0-9;]*m/g, '');

const lines = data.split('\n');
let currentFile = null;
const fileResults = {};

for (const line of lines) {
  const failMatch = line.match(/FAIL\s+(tests\/[^\s(]+)/);
  if (failMatch) {
    currentFile = failMatch[1];
    if (!fileResults[currentFile]) fileResults[currentFile] = { fail: 0, pass: 0, error: null };
  }

  // Count individual test results
  if (currentFile) {
    if (/^\s*(✓|√|PASS)\s/.test(line)) fileResults[currentFile].pass++;
    if (/^\s*(×|✗|FAIL|×)\s/.test(line) || /AssertionError/.test(line)) fileResults[currentFile].fail++;
  }

  // Capture error messages
  if (line.match(/Error:|TypeError:|Cannot find|Failed to resolve|is not a function|is not defined|EISDIR|ENOENT|timed out/i)) {
    if (currentFile && !fileResults[currentFile].error) {
      fileResults[currentFile].error = line.trim().substring(0, 120);
    }
  }
}

// Sort by failures
const sorted = Object.entries(fileResults)
  .filter(([, v]) => v.fail > 0 || v.error)
  .sort((a, b) => b[1].fail - a[1].fail);

console.log(`Files with failures: ${sorted.length}`);
console.log(`\nTop 30 by failure count:`);
sorted.slice(0, 30).forEach(([file, data]) => {
  console.log(`  ${data.fail}F/${data.pass}P | ${file} | ${data.error || ''}`);
});

// Category analysis
const categories = { transform: [], import: [], assertion: [], timeout: [], other: [] };
sorted.forEach(([file, data]) => {
  const err = data.error || '';
  if (err.includes('Transform failed') || err.includes('Failed to resolve')) categories.transform.push(file);
  else if (err.includes('Cannot find') || err.includes('ENOENT') || err.includes('EISDIR')) categories.import.push(file);
  else if (err.includes('timed out')) categories.timeout.push(file);
  else if (err.includes('is not a function') || err.includes('is not defined')) categories.other.push(file);
  else categories.assertion.push(file);
});

console.log(`\nCategories:`);
Object.entries(categories).forEach(([cat, files]) => {
  console.log(`  ${cat}: ${files.length} files`);
});
