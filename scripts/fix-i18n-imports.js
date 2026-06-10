/**
 * Fix mis-imported React hooks from react-i18next → react
 * R89 Q-02: TS2300(96) + TS2305(48) = 144 errors fixed by this script
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');

const reactHooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef'];
let totalFixed = 0;

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
  const original = content;

  // Find imports from react-i18next that contain React hooks
  const i18nImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]react-i18next['"]/g;
  
  let match;
  let hooksInI18n = [];
  let keepInI18n = [];
  
  while ((match = i18nImportRegex.exec(content)) !== null) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    imports.forEach(imp => {
      // Check if it's a React hook (not useTranslation)
      if (reactHooks.includes(imp)) {
        hooksInI18n.push(imp);
      } else {
        keepInI18n.push(imp);
      }
    });
  }

  if (hooksInI18n.length === 0) return;

  // Step 1: Remove hooks from react-i18next import
  if (keepInI18n.length > 0) {
    // Keep remaining i18n imports
    const newI18nImport = `import { ${keepInI18n.join(', ')} } from 'react-i18next'`;
    content = content.replace(
      /import\s*\{[^}]+\}\s*from\s*['"]react-i18next['"]/,
      newI18nImport
    );
  } else {
    // Remove entire react-i18next import line
    content = content.replace(
      /import\s*\{[^}]+\}\s*from\s*['"]react-i18next['"]\s*;?\s*\n?/,
      ''
    );
  }

  // Step 2: Add or merge React hooks import
  const hooksImport = `import { ${[...new Set(hooksInI18n)].join(', ')} } from 'react'`;
  
  // Check if there's already a react import
  const reactImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/);
  if (reactImportMatch) {
    // Merge with existing react import
    const existingImports = reactImportMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const merged = [...new Set([...existingImports, ...hooksInI18n])];
    content = content.replace(
      /import\s*\{[^}]+\}\s*from\s*['"]react['"]/,
      `import { ${merged.join(', ')} } from 'react'`
    );
  } else {
    // Add new react import at top (after any leading comments)
    const lines = content.split('\n');
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('//') || lines[i].startsWith('/*') || lines[i].startsWith('*') || lines[i].trim() === '') {
        insertIdx = i + 1;
      } else if (lines[i].startsWith('import')) {
        insertIdx = i;
        break;
      }
    }
    lines.splice(insertIdx, 0, hooksImport);
    content = lines.join('\n');
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  totalFixed++;
  const rel = path.relative(root, filePath);
  console.log(`  FIXED: ${rel} (${hooksInI18n.join(', ')})`);
}

console.log('=== Fixing mis-imported React hooks ===');
walkDir(srcDir);
console.log(`\nTotal files fixed: ${totalFixed}`);
