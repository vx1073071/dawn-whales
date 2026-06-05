const fs = require('fs');
const c = fs.readFileSync('src/components/risk/RiskDashboardPage.tsx', 'utf8');
const lines = c.split('\n');
console.log('Total lines:', lines.length);

// Find the array literal with .map - look for {[ ... ].map pattern
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.includes('.map(')) console.log('L' + (i+1) + ': ' + l);
  if (l.startsWith('{[') || (l.includes('[') && l.includes('.map'))) {
    console.log('L' + (i+1) + ': ' + l);
  }
}

// Also print lines 250-265
console.log('\n--- Lines 250-265 ---');
for (let i = 249; i < 265; i++) {
  if (lines[i]) console.log('L' + (i+1) + ': ' + lines[i]);
}