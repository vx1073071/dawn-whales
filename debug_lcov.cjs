const fs = require('fs');
const lines = fs.readFileSync('coverage/lcov.info', 'utf-8').replace(/\r\n/g, '\n').split('\n');
let currentFile = '';
let hitLines = new Set();
let allLines = new Set();
let daCount = 0;
for (const L of lines) {
  if (L.startsWith('SF:')) {
    if (currentFile) {
      console.log('File:', currentFile, 'total:', allLines.size, 'covered:', hitLines.size);
    }
    currentFile = L.slice(3);
    hitLines = new Set();
    allLines = new Set();
  } else if (L.startsWith('DA:')) {
    daCount++;
    const parts = L.slice(3).split(',');
    const line = parseInt(parts[0]);
    const hits = parseInt(parts[1] || '0');
    allLines.add(line);
    if (hits > 0) hitLines.add(line);
  }
}
console.log('DA count:', daCount);
if (currentFile) {
  console.log('Last file:', currentFile, 'total:', allLines.size, 'covered:', hitLines.size);
}
