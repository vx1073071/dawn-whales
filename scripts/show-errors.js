const d = JSON.parse(require('fs').readFileSync('scripts/tsc-errors.json', 'utf-8'));
const f = {};
d.forEach(e => { if (!f[e.file]) f[e.file] = []; f[e.file].push(e); });
Object.entries(f).sort((a, b) => b[1].length - a[1].length).slice(0, 8).forEach(([file, errs]) => {
  console.log('\n=== ' + file + ' (' + errs.length + ' errors) ===');
  errs.forEach(e => console.log('  L' + e.line + ' TS' + e.code + ' ' + e.message.substring(0, 100)));
});
