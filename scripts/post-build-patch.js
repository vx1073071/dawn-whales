// Post-build fix: patch vite-plugin-electron CJS interop in main.cjs
const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'dist-electron', 'main.cjs');
if (!fs.existsSync(mainPath)) {
  console.log('[post-build] main.cjs not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(mainPath, 'utf-8');

// Fix 1: _interopNamespaceDefault crash when d.get is undefined
const oldPattern = 'Object.defineProperty(n, k, d.get ? d : {';
const newPattern = 'Object.defineProperty(n, k, d && d.get ? d : {';

if (content.includes(oldPattern)) {
  content = content.replaceAll(oldPattern, newPattern);
  console.log('[post-build] Fixed _interopNamespaceDefault (d.get -> d && d.get)');
}

// Fix 2: Ensure electron/node module paths are correct
fs.writeFileSync(mainPath, content, 'utf-8');
console.log('[post-build] main.cjs patched successfully');
