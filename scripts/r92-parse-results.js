const fs = require('fs');
const path = require('path');

const d = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/scripts/r92-full-results.txt', 'utf-8');

// Extract JSON - it starts with {"numTotalTestSuites
const jsonStart = d.indexOf('{"numTotalTestSuites');
if (jsonStart < 0) {
  console.log('No JSON found');
  process.exit(1);
}

const jsonStr = d.substring(jsonStart).split('\n')[0];
let parsed;
try {
  parsed = JSON.parse(jsonStr);
} catch(e) {
  // The JSON might be on a line that also has other content
  // Find the matching closing brace
  let depth = 0;
  let end = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') depth++;
    if (jsonStr[i] === '}') depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  parsed = JSON.parse(jsonStr.substring(0, end));
}

console.log('Total suites:', parsed.numTotalTestSuites);
console.log('Passed suites:', parsed.numPassedTestSuites);
console.log('Failed suites:', parsed.numFailedTestSuites);
console.log('Total tests:', parsed.numTotalTests);
console.log('Passed tests:', parsed.numPassedTests);
console.log('Failed tests:', parsed.numFailedTests);
console.log('Pending tests:', parsed.numPendingTests);

// Group failures by error type
const results = parsed.testResults || [];
const errorTypes = {};
const failingFiles = [];

for (const r of results) {
  if (r.status !== 'failed') continue;
  const fails = (r.assertionResults || []).filter(a => a.status === 'failed');
  if (fails.length === 0) continue;
  
  const shortName = r.name.replace(/.*dawn-whales[\\/]/, '');
  failingFiles.push({ file: shortName, count: fails.length });
  
  for (const f of fails) {
    const msg = (f.failureMessages || []).join(' ');
    let category = 'unknown';
    
    if (msg.includes('randomUUID') && msg.includes('not a function')) category = 'randomUUID-not-function';
    else if (msg.includes('to be greater than or equal to')) category = 'static-count-threshold';
    else if (msg.includes('ENOENT')) category = 'ENOENT-file-not-found';
    else if (msg.includes('timed out') || msg.includes('Timeout')) category = 'timeout';
    else if (msg.includes('expected') && msg.includes('to be true')) category = 'expected-true-got-false';
    else if (msg.includes('throw error') || msg.includes('to throw')) category = 'expected-throw';
    else if (msg.includes('not equal') || msg.includes('Object.is')) category = 'equality-mismatch';
    else category = msg.substring(0, 60).replace(/\n/g, ' ');
    
    if (!errorTypes[category]) errorTypes[category] = { count: 0, files: new Set() };
    errorTypes[category].count++;
    errorTypes[category].files.add(shortName);
  }
}

console.log('\n=== TOP FAILING FILES ===');
failingFiles.sort((a, b) => b.count - a.count).slice(0, 30).forEach(f => 
  console.log('  ' + f.file + ': ' + f.count + ' fails')
);

console.log('\n=== ERROR CATEGORIES ===');
Object.entries(errorTypes).sort((a, b) => b[1].count - a[1].count).forEach(([cat, data]) => {
  const fileList = Array.from(data.files).slice(0, 5).join(', ');
  console.log('  [' + data.count + ' fails in ' + data.files.size + ' files] ' + cat);
  console.log('    Files: ' + fileList + (data.files.size > 5 ? ' ...' : ''));
});

// Save
fs.writeFileSync(
  'C:/Users/vx107/.easyclaw/workspace/dawn-whales/scripts/r92-parsed-results.json',
  JSON.stringify(parsed, null, 2)
);
console.log('\nParsed results saved.');
