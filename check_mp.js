const fs = require('fs');
const buf = fs.readFileSync('src/components/market/MarketPage.tsx');
const lines = buf.toString('utf8').split('\n');
console.log('total:', lines.length);
const output = [];
for (let i = 91; i < 99; i++) {
  const line = lines[i];
  if (line !== undefined) {
    output.push('L' + (i+1) + ': ' + line.substring(0, 100));
  }
}
fs.writeFileSync('check_mp_out.txt', output.join('\n'));
console.log('written');