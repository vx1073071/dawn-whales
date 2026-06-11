const fs = require('fs');
const path = require('path');
const ED = path.resolve(__dirname, '..', 'electron', 'engine');

function find(name, dir) {
  for (const e of fs.readdirSync(dir || ED, { withFileTypes: true })) {
    const fp = path.join(dir || ED, e.name);
    if (e.isFile() && e.name === name) return fp;
    if (e.isDirectory() && !e.name.startsWith('.')) {
      const r = find(name, fp);
      if (r) return r;
    }
  }
  return null;
}

const fp = find('p2p-transfer-engine.ts');
console.log('p2p-transfer-engine.ts:', fp || 'NOT FOUND');

if (fp) {
  const c = fs.readFileSync(fp, 'utf8');
  console.log('Has EngineError:', c.includes('EngineError'));
  console.log('Has import:', c.split('\n').find(l => l.includes('import') && l.includes('error')));
  console.log('Has Not implemented:', c.includes('Not implemented'));
}
