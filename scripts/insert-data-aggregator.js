const fs = require('fs');
const content = fs.readFileSync('electron/preload.ts', 'utf8');
const lines = content.split('\n');

// Insert after line 702 (0-indexed: 701)
const insertAfter = 701;
const newLines = [
  '',
  '  // ── Data Aggregator (JVS-56) ───────────────────────────────────────────',
  '  dataAggregator: {',
  '    aggregate: (codes: string[]) => ipcRenderer.invoke("data:aggregate", codes),',
  '    stats: () => ipcRenderer.invoke("data:aggregator-stats"),',
  '    clearCache: () => ipcRenderer.invoke("data:aggregator-clear-cache"),',
  '  },',
];

lines.splice(insertAfter + 1, 0, ...newLines);
fs.writeFileSync('electron/preload.ts', lines.join('\n'));
console.log('Inserted dataAggregator into preload.ts');
