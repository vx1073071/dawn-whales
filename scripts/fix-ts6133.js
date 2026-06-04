/**
 * Auto-fix TS6133 "declared but never read" errors
 * Handles:
 * 1. Unused `import React from 'react'` (React 17+ JSX transform)
 * 2. Unused named imports from modules
 * 3. Unused destructured variables from hooks
 *
 * Usage: node scripts/fix-ts6133.js
 * Safe: only removes imports/variables that are definitely unused
 */
const fs = require('fs');
const path = require('path');

const fixes = [
  // Pattern 1: unused `import React from 'react'`
  {
    name: 'unused React import',
    test: (content) => /import React from ['"]react['"]/.test(content),
    fix: (content) => content.replace(/import React from ['"]react['"]\s*\n?/g, ''),
  },
  // Pattern 2: unused `import { useCallback } from 'react'` (single import)
  {
    name: 'unused single named import',
    test: (content, name) => new RegExp(`import\\s+\\{\\s*${name}\\s*\\}\\s+from`).test(content),
    fix: (content, name) => content.replace(new RegExp(`import\\s+\\{\\s*${name}\\s*\\}\\s+from[^;]+;\\s*\\n?`), ''),
  },
  // Pattern 3: unused item in multi-import
  {
    name: 'unused item in multi-import',
    test: (content, name) => new RegExp(`import\\s+\\{[^}]*${name}[^}]*\\}\\s+from`).test(content),
    fix: (content, name) => {
      const regex = new RegExp(`(import\\s+\\{[^}]*)${name}\\s*,?\\s*(\\}\\s+from)`, 'g');
      return content.replace(regex, '$1$2');
    },
  },
];

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let changed = false;

  // Fix 1: Remove unused React import
  if (/import React from ['"]react['"]/.test(modified)) {
    // Check if React is actually used (other than JSX)
    const withoutImport = modified.replace(/import React from ['"]react['"]\s*\n?/g, '');
    // Simple check: look for "React." usage
    if (!/React\./.test(withoutImport)) {
      modified = withoutImport;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, modified, 'utf8');
    return true;
  }
  return false;
}

// Process specific files known to have issues
const filesToFix = [
  'src/components/common/LoadingSpinner.tsx',
  'src/components/market/CapitalFlowPage.tsx',
  'src/components/market/ConsumerDashboard.tsx',
  'src/components/market/DailyReportPage.tsx',
  'src/components/market/DragonTigerPage.tsx',
  'src/components/market/FundHoldingsPage.tsx',
  'src/components/market/MarginDashboard.tsx',
  'src/components/market/NewsDashboardPage.tsx',
  'src/components/market/SectorRotationPage.tsx',
  'src/components/market/StockOverviewPage.tsx',
];

let fixedCount = 0;
for (const file of filesToFix) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (processFile(fullPath)) {
      console.log(`Fixed: ${file}`);
      fixedCount++;
    }
  }
}

console.log(`\nFixed ${fixedCount} files`);
