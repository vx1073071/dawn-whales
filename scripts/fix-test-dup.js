const fs = require('fs');
let c = fs.readFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts', 'utf8');
// Remove duplicate block after the first "});" ending the file
// Find last occurrence of "});" and remove everything after the one before it
let idx = c.lastIndexOf('});');
let idx2 = c.lastIndexOf('});', idx - 1);
if (idx2 >= 0 && idx > idx2) {
  c = c.substring(0, idx + 3);
  // Add trailing newline
  c = c.trimEnd() + '\n';
}
fs.writeFileSync('C:/Users/vx107/.easyclaw/workspace/dawn-whales/tests/quant/lobehub-r253-r255-quant.test.ts', c, 'utf8');
console.log('Fixed, length:', c.length);
