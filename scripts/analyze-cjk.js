// Analyze CJK patterns in electron files
const fs = require('fs');
const path = require('path');
const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/;

function scan(dir, results = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (['node_modules', 'dist', '.git'].includes(f.name)) return;
    if (f.isDirectory()) scan(p, results);
    else if (/\.ts$/.test(f.name)) {
      try {
        const c = fs.readFileSync(p, 'utf8');
        const lines = c.split('\n');
        let sq = 0, dq = 0, tl = 0, cmt = 0, other = 0;
        lines.forEach(l => {
          if (!CJK.test(l)) return;
          const t = l.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) { cmt++; return; }
          if (t.startsWith('import ')) return;
          if (l.includes('`')) { tl++; return; }
          if (/'[^']*[\u4e00-\u9fff][^']*'/.test(l)) { sq++; return; }
          if (/"[^"]*[\u4e00-\u9fff][^"]*"/.test(l)) { dq++; return; }
          other++;
        });
        if (sq + dq + tl + cmt + other > 0) {
          results.push({
            file: path.relative(process.cwd(), p).replace(/\\/g, '/'),
            sq, dq, tl, cmt, other
          });
        }
      } catch {}
    }
  });
  return results;
}

const res = scan('electron');
res.sort((a, b) => (b.sq + b.dq + b.tl) - (a.sq + a.dq + a.tl));
console.log('Top 30 electron files by CJK line type:');
let tSQ = 0, tDQ = 0, tTL = 0, tCMT = 0, tOTH = 0;
res.slice(0, 30).forEach(f => {
  console.log(f.file.padEnd(60), 'SQ:' + f.sq, 'DQ:' + f.dq, 'TL:' + f.tl, 'CMT:' + f.cmt, 'OTH:' + f.other);
  tSQ += f.sq; tDQ += f.dq; tTL += f.tl; tCMT += f.cmt; tOTH += f.other;
});
console.log('\nTOTALS:', 'SQ:' + tSQ, 'DQ:' + tDQ, 'TL:' + tTL, 'CMT:' + tCMT, 'OTH:' + tOTH);
