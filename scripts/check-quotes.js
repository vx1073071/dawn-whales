const fs = require('fs');
const lines = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8').split('\n');
// Check all lines for odd quote count
for (let i = 0; i < lines.length; i++) {
    let sq = 0;
    for (const ch of lines[i]) { if (ch === "'") sq++; }
    if (sq % 2 !== 0) {
        console.log('L' + (i+1) + ' (' + sq + ' quotes): ' + JSON.stringify(lines[i].substring(0, 80)));
    }
}
