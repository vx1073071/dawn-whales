const fs = require('fs');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';

// Count excludes
const config = fs.readFileSync(ROOT + '/vitest.config.ts', 'utf-8');
const excludeMatch = config.match(/exclude:\s*\[([\s\S]*?)\]/);
const excludeLines = excludeMatch[1].split('\n').filter(l => /^\s*['"]/.test(l));
console.log('Excludes:', excludeLines.length);
excludeLines.forEach(l => console.log('  ', l.trim().replace(/['",]/g, '')));

// Check which excluded files actually exist on disk
const testsDir = ROOT + '/tests';
let existCount = 0;
let missingCount = 0;
excludeLines.forEach(l => {
  const file = l.trim().replace(/['",]/g, '');
  const fullPath = ROOT + '/' + file;
  if (fs.existsSync(fullPath)) { existCount++; }
  else { missingCount++; console.log('  MISSING:', file); }
});
console.log('\nExist:', existCount, '| Missing:', missingCount);
