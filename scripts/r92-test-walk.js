// R92: Test the _walkRecursive function directly
const fs = require('fs');
const path = require('path');

function _walkRecursive(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) r = r.concat(_walkRecursive(path.join(dir, e.name)));
    else r.push(e.name);
  }
  return r;
}

const engineDir = 'C:/Users/vx107/.easyclaw/workspace/quant-moo/electron/engine';
const allFiles = _walkRecursive(engineDir);
const tsFiles = allFiles.filter(f => f.endsWith('.ts'));
console.log('Total files from _walkRecursive:', allFiles.length);
console.log('TS files:', tsFiles.length);
console.log('First 10 TS files:', tsFiles.slice(0, 10));
