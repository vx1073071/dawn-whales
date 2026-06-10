const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); }
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) fix(f);
  }
}
function fix(fp) {
  let c = fs.readFileSync(fp, 'utf-8');
  const lines = c.split('\n');
  const utLines = [];
  lines.forEach((l, i) => {
    if (/import\s*\{[^}]*useTranslation[^}]*\}\s*from\s*['"]react-i18next['"]/.test(l)) utLines.push(i);
  });
  if (utLines.length <= 1) return;
  const all = new Set();
  utLines.forEach(i => {
    const m = lines[i].match(/\{([^}]+)\}/);
    if (m) m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(x => all.add(x));
  });
  lines[utLines[0]] = "import { " + [...all].join(', ') + " } from 'react-i18next';";
  for (let i = utLines.length - 1; i >= 1; i--) lines.splice(utLines[i], 1);
  fs.writeFileSync(fp, lines.join('\n'), 'utf-8');
  console.log('FIXED: ' + path.relative(root, fp));
}
walk(path.join(root, 'src'));
