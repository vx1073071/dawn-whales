const fs = require('fs');
const lines = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8').split('\n');
const line = lines[17];
console.log('L18 length:', line.length);
console.log('L18 raw:', JSON.stringify(line));
// Check quote balance
let sq = 0, dq = 0;
for (const ch of line) { if (ch === "'") sq++; if (ch === '"') dq++; }
console.log('single:', sq, 'double:', dq);
// Check if this was already broken before our changes
