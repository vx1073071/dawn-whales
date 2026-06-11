const fs = require('fs');
const path = require('path');
const ED = path.resolve(__dirname, '..', 'electron', 'engine');

function walk(d) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isFile() && e.name.endsWith('.ts')) {
        const c = fs.readFileSync(fp, 'utf8');
        if (c.includes('agent-fundamentals') && !fp.endsWith('agent-fundamentals.ts')) {
          const lines = c.split('\n');
          lines.forEach((l, i) => {
            if (l.includes('agent-fundamentals')) {
              console.log(`${fp}:${i+1}: ${l.trim()}`);
            }
          });
        }
      }
      if (e.isDirectory() && !e.name.startsWith('.')) walk(fp);
    }
  } catch (e) { console.error('ERR', d, e.message); }
}
walk(ED);
