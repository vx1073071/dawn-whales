const fs = require('fs');
const c = fs.readFileSync('src/lib/bridge-api.ts', 'utf8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('prefs')) {
    const line = lines[i].trim();
    fs.appendFileSync('prefs_check.txt', `L${i+1}: ${line}\n`);
  }
}
fs.appendFileSync('prefs_check.txt', `Total lines: ${lines.length}\n`);