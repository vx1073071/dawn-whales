const fs = require('fs');
const d = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
const failed = d.testResults.filter(f => f.status === 'failed');
const cats = {};
let total = 0;

failed.forEach(f => {
  const fn = f.name.replace(/.*[/\\]tests[/\\]/, 'tests/');
  f.assertionResults.filter(a => a.status === 'failed').forEach(a => {
    const msg = (a.failureMessages || []).join(' ');
    let c = 'other';
    if (msg.includes('randomUUID')) c = 'randomUUID';
    else if (msg.includes('ErrorDomain is not defined')) c = 'ErrorDomain';
    else if (msg.includes('EngineError is not defined')) c = 'EngineError';
    else if (msg.includes('i18n is not defined')) c = 'i18n';
    else if (msg.includes('Transform failed') || msg.includes('Failed to resolve import')) c = 'transform';
    else if (msg.includes('ENOENT') || msg.includes('EISDIR')) c = 'file-not-found';
    else if (msg.includes('is not a constructor')) c = 'not-constructor';
    else if (msg.includes('done() callback')) c = 'done-deprecated';
    else if (msg.includes('is not a function')) c = 'not-a-function';
    else if (msg.includes('AssertionError') || msg.includes('expected')) c = 'assertion';
    if (!cats[c]) cats[c] = { count: 0, files: new Set(), samples: [] };
    cats[c].count++;
    cats[c].files.add(fn);
    if (cats[c].samples.length < 2) cats[c].samples.push(fn + ' | ' + msg.substring(0, 150));
    total++;
  });
});

console.log('FAILED FILES:', failed.length);
console.log('FAILED TESTS:', total);
Object.entries(cats).sort((a, b) => b[1].count - a[1].count).forEach(([c, d]) => {
  console.log(`\n[${c}] ${d.count} failures, ${d.files.size} files`);
  [...d.files].forEach(f => console.log('  ' + f));
  d.samples.forEach(s => console.log('  Sample: ' + s));
});
