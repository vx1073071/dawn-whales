const fs = require('fs');
const content = fs.readFileSync('electron/preload.ts', 'utf8');
const oldCode = `  dataAggregator: {
    aggregate: (codes: string[]) => ipcRenderer.invoke('data:aggregate', codes),
    stats: () => ipcRenderer.invoke('data:aggregator-stats'),
    clearCache: () => ipcRenderer.invoke('data:aggregator-clear-cache'),
  },`;

const newCode = `  dataAggregator: {
    aggregate: (codes: string[]) => ipcRenderer.invoke('data:aggregate', codes),
    stats: () => ipcRenderer.invoke('data:aggregator-stats'),
    clearCache: () => ipcRenderer.invoke('data:aggregator-clear-cache'),
  },

  // ── Data Pipeline (JVS-57) ─────────────────────────────────────────────
  dataPipeline: {
    clean: (point: any) => ipcRenderer.invoke('data:clean', point),
    cleanBatch: (points: any[]) => ipcRenderer.invoke('data:clean-batch', points),
    stats: () => ipcRenderer.invoke('data:pipeline-stats'),
    clearHistory: (code?: string) => ipcRenderer.invoke('data:pipeline-clear-history', code),
  },`;

const newContent = content.replace(oldCode, newCode);
fs.writeFileSync('electron/preload.ts', newContent);
console.log('Updated preload.ts');
