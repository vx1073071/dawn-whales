/**
 * Fix duplicate useTranslation imports — handle both ' and " quote styles
 * The bug: QClaw R88 added `import { useTranslation } from "react-i18next"` (double quotes)
 * while the file already had `import { useTranslation } from 'react-i18next'` (single quotes)
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walkDir(full);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      fixFile(full);
    }
  }
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Find all useTranslation import lines (any quote style)
  const utImportLines = [];
  lines.forEach((line, idx) => {
    if (/import\s*\{[^}]*useTranslation[^}]*\}\s*from\s*['"]react-i18next['"]/.test(line)) {
      utImportLines.push(idx);
    }
  });

  if (utImportLines.length <= 1) return;

  // Keep first occurrence, remove duplicates
  // But first, collect all imports from all useTranslation lines
  const allImports = new Set();
  utImportLines.forEach(idx => {
    const m = lines[idx].match(/\{([^}]+)\}/);
    if (m) {
      m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(i => allImports.add(i));
    }
  });

  // Replace first line with merged import, remove rest
  lines[utImportLines[0]] = `import { ${[...allImports].join(', ')} } from 'react-i18next';`;
  // Remove duplicate lines (from end to start to preserve indices)
  for (let i = utImportLines.length - 1; i >= 1; i--) {
    lines.splice(utImportLines[i], 1);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`FIXED: ${path.relative(root, filePath)} (${utImportLines.length} dupes → 1, imports: ${[...allImports].join(', ')})`);
}

console.log('=== Fixing duplicate useTranslation imports ===');
walkDir(path.join(root, 'src'));
console.log('Done.');
