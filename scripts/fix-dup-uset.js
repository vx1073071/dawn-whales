/**
 * Fix useTranslation duplicate imports (TS2300)
 * Remove useTranslation from 'react' import — it belongs in 'react-i18next'
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let fixed = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); }
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) fix(f);
  }
}

function fix(fp) {
  let c = fs.readFileSync(fp, 'utf-8');
  // Find react import that contains useTranslation
  const reactMatch = c.match(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/);
  if (!reactMatch) return;
  
  const imports = reactMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  if (!imports.includes('useTranslation')) return;
  
  // Remove useTranslation from react import
  const cleaned = imports.filter(i => i !== 'useTranslation');
  if (cleaned.length > 0) {
    c = c.replace(
      /import\s*\{[^}]+\}\s*from\s*['"]react['"]/,
      `import { ${cleaned.join(', ')} } from 'react'`
    );
  } else {
    // Remove entire react import if empty
    c = c.replace(/import\s*\{\s*\}\s*from\s*['"]react['"]\s*;?\s*\n?/, '');
  }
  
  fs.writeFileSync(fp, c, 'utf-8');
  fixed++;
  console.log(`  FIXED: ${path.relative(root, fp)}`);
}

console.log('=== Fixing useTranslation duplicates ===');
walk(path.join(root, 'src'));
console.log(`Total: ${fixed}`);
