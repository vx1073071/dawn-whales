// Parse tsc-raw.txt (BOM-safe) and dump JSON
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const raw = fs.readFileSync(path.join(root, 'scripts', 'tsc-raw.txt'), 'utf-8')
  .replace(/^\uFEFF/, '') // strip BOM
  .replace(/\r\n/g, '\n');

const lines = raw.split('\n').filter(l => l.includes('error TS'));
console.log(`Lines with 'error TS': ${lines.length}`);

const errors = [];
lines.forEach(line => {
  const m = line.match(/^(.+?)\((\d+),(\d+)\):\s*error TS(\d+):\s*(.+)$/);
  if (!m) return;
  errors.push({
    file: m[1],
    line: parseInt(m[2]),
    col: parseInt(m[3]),
    code: m[4],
    message: m[5]
  });
});

console.log(`Parsed errors: ${errors.length}`);
fs.writeFileSync(path.join(root, 'scripts', 'tsc-errors.json'), JSON.stringify(errors, null, 2));

const byCode = {};
errors.forEach(e => { byCode[e.code] = (byCode[e.code] || 0) + 1; });
console.log('\n=== By Code ===');
Object.entries(byCode).sort((a,b) => b[1]-a[1]).forEach(([c, n]) => console.log(`  TS${c}: ${n}`));

const byFile = {};
errors.forEach(e => { byFile[e.file] = (byFile[e.file] || 0) + 1; });
console.log('\n=== Top 20 Files ===');
Object.entries(byFile).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([f, c]) => console.log(`  ${c.toString().padStart(3)} | ${f}`));

// TS2300 duplicate identifiers
const ts2300 = errors.filter(e => e.code === '2300');
console.log(`\n=== TS2300 (${ts2300.length}) ===`);
const dupNames = {};
ts2300.forEach(e => {
  const m = e.message.match(/Duplicate identifier '(.+?)'/);
  if (m) dupNames[m[1]] = (dupNames[m[1]] || 0) + 1;
});
Object.entries(dupNames).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([n, c]) => console.log(`  ${c}x: '${n}'`));

// TS2305 no exported member
const ts2305 = errors.filter(e => e.code === '2305');
console.log(`\n=== TS2305 (${ts2305.length}) ===`);
const expMsgs = {};
ts2305.forEach(e => { expMsgs[e.message] = (expMsgs[e.message] || 0) + 1; });
Object.entries(expMsgs).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([m, c]) => console.log(`  ${c}x: ${m.substring(0,100)}`));

// TS18046 unknown vars
const ts18046 = errors.filter(e => e.code === '18046');
console.log(`\n=== TS18046 (${ts18046.length}) ===`);
const uVars = {};
ts18046.forEach(e => {
  const m = e.message.match(/'(.+?)' is of type 'unknown'/);
  if (m) uVars[m[1]] = (uVars[m[1]] || 0) + 1;
});
Object.entries(uVars).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([n, c]) => console.log(`  ${c}x: '${n}'`));
