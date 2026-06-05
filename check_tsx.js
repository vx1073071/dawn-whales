const fs = require('fs');
const c = fs.readFileSync('src/components/risk/RiskDashboardPage.tsx', 'utf8');
const lines = c.split('\n');
console.log('Total lines:', lines.length);
[244, 245, 246, 247, 248, 249, 250, 251].forEach(i => {
  console.log(`L${i+1}: ${JSON.stringify(lines[i])}`);
});
