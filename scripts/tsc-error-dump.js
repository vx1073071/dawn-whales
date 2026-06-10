/**
 * TSC Error Dump v2 — robust parsing with prefix stripping
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let raw;
try {
  raw = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', cwd: root, timeout: 120000 });
  console.log('0 errors');
  process.exit(0);
} catch (e) {
  raw = e.stdout || '';
}

// Debug: show first 3 lines of raw output
const rawLines = raw.split('\n');
console.log('RAW first 3 lines:');
rawLines.slice(0, 3).forEach((l, i) => console.log(`  [${i}] ${l.substring(0, 120)}`));

// Find lines with "error TS"
const errors = [];
rawLines.forEach(rawLine => {
  const line = rawLine.trim();
  if (!line.includes('error TS')) return;
  // Standard TSC format: filepath(line,col): error TSXXXX: message
  const m = line.match(/^([\w./\\-]+(?:\.config\.\w+|\.tsx?|\.jsx?))\((\d+),(\d+)\):\s*error TS(\d+):\s*(.+)$/);
  if (!m) {
    // Debug: print first 3 unmatched lines
    if (errors.length === 0 && unmatched < 3) {
      unmatched++;
      console.log(`  UNMATCHED: ${line.substring(0, 150)}`);
    }
    return;
  }
  errors.push({
    file: m[1],
    line: parseInt(m[2]),
    col: parseInt(m[3]),
    code: m[4],
    message: m[5]
  });
});
let unmatched = 0;

console.log(`\nParsed ${errors.length} errors`);

// Write JSON
fs.writeFileSync(path.join(root, 'scripts', 'tsc-errors.json'), JSON.stringify(errors, null, 2));

// Analysis
const byCode = {};
errors.forEach(e => { byCode[e.code] = (byCode[e.code] || 0) + 1; });
console.log('\n=== By Error Code ===');
Object.entries(byCode).sort((a,b) => b[1]-a[1]).forEach(([code, c]) => {
  console.log(`  TS${code}: ${c}`);
});

const byFile = {};
errors.forEach(e => { byFile[e.file] = (byFile[e.file] || 0) + 1; });
console.log('\n=== Top 20 Files ===');
Object.entries(byFile).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([f, c]) => {
  console.log(`  ${c.toString().padStart(3)} | ${f}`);
});
console.log(`Total files: ${Object.keys(byFile).length}`);

// TS2300 analysis
const ts2300 = errors.filter(e => e.code === '2300');
if (ts2300.length > 0) {
  console.log(`\n=== TS2300 (${ts2300.length}) — Duplicate Identifier ===`);
  const dupNames = {};
  ts2300.forEach(e => {
    const m = e.message.match(/Duplicate identifier '(.+)'/);
    if (m) dupNames[m[1]] = (dupNames[m[1]] || 0) + 1;
  });
  Object.entries(dupNames).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([name, count]) => {
    console.log(`  ${count}x: '${name}'`);
  });
}

// TS2305 analysis
const ts2305 = errors.filter(e => e.code === '2305');
if (ts2305.length > 0) {
  console.log(`\n=== TS2305 (${ts2305.length}) — No exported member ===`);
  const msgs = {};
  ts2305.forEach(e => { msgs[e.message] = (msgs[e.message] || 0) + 1; });
  Object.entries(msgs).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([m, c]) => {
    console.log(`  ${c}x: ${m.substring(0, 100)}`);
  });
}

// TS18046 analysis
const ts18046 = errors.filter(e => e.code === '18046');
if (ts18046.length > 0) {
  console.log(`\n=== TS18046 (${ts18046.length}) — unknown type ===`);
  const unknownVars = {};
  ts18046.forEach(e => {
    const m = e.message.match(/'(\w+)' is of type 'unknown'/);
    if (m) unknownVars[m[1]] = (unknownVars[m[1]] || 0) + 1;
  });
  Object.entries(unknownVars).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([name, c]) => {
    console.log(`  ${c}x: '${name}'`);
  });
}

// TS2339 analysis
const ts2339 = errors.filter(e => e.code === '2339');
if (ts2339.length > 0) {
  console.log(`\n=== TS2339 (${ts2339.length}) — Property not exist ===`);
  const props = {};
  ts2339.forEach(e => {
    const m = e.message.match(/Property '(\w+)' does not exist on type '(.+?)'/);
    if (m) {
      const type = m[2].substring(0, 60);
      props[`${m[1]} on ${type}`] = (props[`${m[1]} on ${type}`] || 0) + 1;
    }
  });
  Object.entries(props).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([key, c]) => {
    console.log(`  ${c}x: ${key}`);
  });
}
