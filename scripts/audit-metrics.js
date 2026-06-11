const fs = require('fs');
const path = require('path');

let ee = 0, total = 0, raw = 0, anyCount = 0;
let eeFiles = [];
let rawFiles = [];
const allDirs = ['src', 'electron', 'server'];
const dirs = allDirs.filter(function(d) { return fs.existsSync(d); });

function walk(d) {
  fs.readdirSync(d).forEach(function(f) {
    var p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(ts|tsx)$/.test(p)) {
      total++;
      var c = fs.readFileSync(p, 'utf8');
      if (/EngineError|engine-error|ErrorDomain/.test(c)) {
        ee++;
        eeFiles.push(p);
      }
      var rm = c.match(/throw\s+new\s+Error\s*\(/g);
      if (rm) {
        raw += rm.length;
        rawFiles.push(p + ' (' + rm.length + ')');
      }
      var am = c.match(/:\s*any\b/g);
      if (am) anyCount += am.length;
    }
  });
}

dirs.forEach(function(d) { walk(d); });
console.log('=== AUDIT METRICS ===');
console.log('Total .ts/.tsx files:', total);
console.log('EngineError/ErrorDomain files:', ee, '/', total, '(' + ((ee / total) * 100).toFixed(1) + '%)');
console.log('Raw throw new Error:', raw, 'in', rawFiles.length, 'files');
rawFiles.forEach(function(f) { console.log('  ', f); });
console.log('Any type usages:', anyCount);
console.log('Directories scanned:', dirs.join(', '));
