const fs = require('fs');
const c = fs.readFileSync('src/lib/bridge-api.ts', 'utf8');
const lines = c.split('\n');
let output = [];
for (let i = 22; i < 35; i++) {
  if (lines[i]) output.push((i+1) + ': ' + lines[i].trim().substring(0, 100));
}
for (let i = 155; i < 165; i++) {
  if (lines[i]) output.push((i+1) + ': ' + lines[i].trim().substring(0, 100));
}
fs.writeFileSync('ba_check.txt', output.join('\n'));
console.log('done');