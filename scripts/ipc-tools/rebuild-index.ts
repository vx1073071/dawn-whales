/**
 * Rebuild index.ts with correct function signatures
 */
const fs = require('fs');
const path = require('path');

const ipcDir = path.join('electron', 'ipc');

// 读取各模块的函数签名
const files = fs.readdirSync(ipcDir).filter(f => f.endsWith('-ipc.ts'));

const modules = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(ipcDir, file), 'utf8');
  const modName = file.replace('-ipc.ts', '');
  
  // 提取 export function registerXxxIPC(param1, param2, ...)
  const match = content.match(/export function register(\w+)IPC\(([^)]*)\)/);
  if (match) {
    const regName = match[1];
    const params = match[2].split(',').map(s => {
      const trimmed = s.trim();
      return trimmed.split(':')[0].trim();
    }).filter(p => p);
    modules.push({ name: modName, regName: `register${regName}IPC`, params });
  }
}

// 生成 index.ts
const lines = [];
lines.push(`// ── QUANT MOO IPC — Unified Registration ─────────────────────────`);
lines.push(`// Auto-generated. Imports all 22 IPC modules.`);
lines.push(`//`);
lines.push(`// Usage in main.ts:`);
lines.push(`//   import { registerAllIPC } from './ipc';`);
lines.push(`//   registerAllIPC({ ... all services ... });`);
lines.push(``);

for (const m of modules) {
  lines.push(`import { ${m.regName} } from './${m.name}-ipc';`);
}

lines.push(``);
lines.push(`export function registerAllIPC(services: {`);
// 收集所有参数
const allParams = new Set();
for (const m of modules) {
  for (const p of m.params) {
    allParams.add(p);
  }
}
for (const p of [...allParams].sort()) {
  lines.push(`  ${p}: any;`);
}
lines.push(`}) {`);

for (const m of modules) {
  if (m.params.length > 0) {
    const args = m.params.map(p => `services.${p}`).join(', ');
    lines.push(`  ${m.regName}(${args});`);
  } else {
    lines.push(`  ${m.regName}();`);
  }
}

lines.push(`}`);
lines.push(``);

const indexPath = path.join(ipcDir, 'index.ts');
fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');

console.log(`✅ index.ts rebuilt with ${modules.length} modules`);
console.log(`Services: ${allParams.size}`);
for (const m of modules) {
  console.log(`  ${m.regName}(${m.params.join(', ')})`);
}
