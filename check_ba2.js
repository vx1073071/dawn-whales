const fs = require('fs');
const c = fs.readFileSync('src/lib/bridge-api.ts', 'utf8');
const lines = c.split('\n');
let output = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('prefs')) {
    output.push((i+1) + ': ' + lines[i].trim().substring(0, 100));
  }
}
fs.writeFileSync('prefs_check2.txt', output.join('\n') + '\nTotal: ' + lines.length);
console.log('done');