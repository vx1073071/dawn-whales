const fs = require('fs');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';

const config = fs.readFileSync(ROOT + '/vitest.config.ts', 'utf-8');

// Find exclude block
const startIdx = config.indexOf('exclude: [');
if (startIdx < 0) { console.log('No exclude found'); process.exit(1); }

const endIdx = config.indexOf('],', startIdx);
const block = config.substring(startIdx, endIdx + 2);

// Count lines that start with ' (test file paths)
const lines = block.split('\n');
const fileLines = lines.filter(l => /^\s*'tests\//.test(l));
console.log('Exclude file entries:', fileLines.length);
fileLines.forEach(l => {
  const file = l.trim().split("'")[1];
  const exists = fs.existsSync(ROOT + '/' + file);
  console.log(exists ? '  ✓' : '  ✗', file);
});
