/**
 * Fix IPC modules — 自动补全缺失的 import 语句
 */
const fs = require('fs');
const path = require('path');

const ipcDir = path.join('electron', 'ipc');
const files = fs.readdirSync(ipcDir).filter(f => f.endsWith('-ipc.ts'));

// 从main.ts的import行建立映射
const mainLines = fs.readFileSync('electron/main.ts', 'utf8').split('\n');
const importMap = {};

// 扫描 main.ts 的 import 语句
for (const line of mainLines.slice(0, 160)) {
  // import { X, Y, Z } from 'path'
  const m = line.match(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
  if (m) {
    const names = m[1].split(',').map(s => s.trim()).filter(n => n);
    const p = m[2];
    for (const name of names) {
      if (!importMap[name]) importMap[name] = p;
    }
  }
  // import X from 'path' (default)
  const m2 = line.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
  if (m2) {
    importMap[m2[1]] = m2[2];
  }
  // import * as X
  const m3 = line.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
  if (m3) {
    importMap[m3[1]] = m3[2];
  }
  // const X = require('...')
  const m4 = line.match(/^const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/);
  if (m4) {
    importMap[m4[1]] = m4[2];
  }
}

// 已知的内置Node模块
const BUILTIN = ['fs', 'path', 'os', 'child_process', 'util', 'url', 'http', 'https', 'crypto', 'stream', 'events', 'assert'];

function isBuiltin(p) {
  return BUILTIN.includes(p) || p.startsWith('node:') || p === 'electron-log';
}

// 处理每个文件
for (const file of files) {
  const filePath = path.join(ipcDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 提取已有import
  const existingImports = new Set();
  const importLines = content.split('\n').filter(l => l.startsWith('import '));
  for (const l of importLines) {
    const m = l.match(/import\s+\{([^}]+)\}\s+from/);
    if (m) {
      m[1].split(',').map(s => s.trim()).forEach(n => existingImports.add(n));
    }
    const m2 = l.match(/import\s+(\w+)\s+from/);
    if (m2) existingImports.add(m2[1]);
  }
  
  // 找handler块中使用的引用
  const body = content;
  const neededImports = new Map(); // path -> Set<names>
  
  for (const [name, importPath] of Object.entries(importMap)) {
    if (name === 'z' || name === 'validate' || name === 'log') continue; // handled separately
    if (isBuiltin(importPath)) continue;
    if (existingImports.has(name)) continue;
    if (name.length < 2) continue;
    
    // 检查是否在handler块中使用（不是参数名）
    // 排除函数参数中定义的
    const paramPattern = new RegExp(`\\b${name}\\s*:\\s*\\w+`, 'g');
    const usePattern = new RegExp(`\\b${name}\\b`, 'g');
    
    // 计算使用次数
    const allUses = (body.match(usePattern) || []).length;
    const paramUses = (body.match(paramPattern) || []).length;
    
    if (allUses > paramUses) {
      // 真的使用到
      if (!neededImports.has(importPath)) {
        neededImports.set(importPath, new Set());
      }
      neededImports.get(importPath).add(name);
    }
  }
  
  if (neededImports.size === 0) continue;
  
  // 生成新增imports
  const newImports = [];
  for (const [p, names] of neededImports) {
    const nameList = [...names].sort().join(', ');
    if (p.startsWith('.')) {
      // 计算相对路径
      const relPath = p.startsWith('./') ? '.' + p.slice(1) : p;
      newImports.push(`import { ${nameList} } from '${relPath}';`);
    }
  }
  
  if (newImports.length === 0) continue;
  
  // 在第一个现有import之后插入
  const lines = content.split('\n');
  let lastImportLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportLine = i;
    }
  }
  
  // 插入新的imports
  const insertLines = ['', '// Auto-imported dependencies:'];
  insertLines.push(...newImports);
  
  lines.splice(lastImportLine + 1, 0, ...insertLines);
  
  const updated = lines.join('\n');
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ ${file}: +${newImports.length} imports`);
  }
}

console.log('\n✅ Import fix complete!');
