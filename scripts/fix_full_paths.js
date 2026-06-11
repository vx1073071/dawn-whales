// Fix _walk and _allEngineFiles to use full paths, and fix readFileSync to use full paths
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

// Fix all test files that use inline _walk or _allEngineFiles
function walkTests(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) results.push(...walkTests(fp));
    else if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) results.push(fp);
  });
  return results;
}

const allTests = walkTests(TESTS_DIR);
let fixes = 0;

allTests.forEach(fp => {
  let c = fs.readFileSync(fp, 'utf8');
  let modified = false;

  // Fix 1: inline _walk that pushes e.name → push fp (full path)
  if (c.includes('files.push(e.name)') && c.includes('const _walk =')) {
    c = c.replace(/files\.push\(e\.name\)/g, 'files.push(fp)');
    modified = true;
  }

  // Fix 2: fs.readFileSync(path.join(dir, f), 'utf-8') where f comes from _walk
  // After fix 1, f is a full path, so just use f directly
  if (c.includes('fs.readFileSync(path.join(dir, f)')) {
    c = c.replace(/fs\.readFileSync\(path\.join\(dir, f\),\s*['"]utf-?8['"]\)/g,
      'fs.readFileSync(f, "utf-8")');
    modified = true;
  }

  // Fix 3: .filter(e => e.isFile()).map(e => e.name) → returns basenames, but need full paths
  if (c.includes('.filter(e => e.isFile()).map(e => e.name)') && c.includes('_walkRecursive')) {
    // This is in _walkRecursive - fix it to return full paths
    c = c.replace(
      /function _walkRecursive\(dir: string\): string\[\] \{[\s\S]*?return r;\s*\}/,
      `function _walkRecursive(dir: string): string[] {
  let r: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        r = r.concat(_walkRecursive(fullPath));
      } else if (entry.isFile()) {
        r.push(fullPath);
      }
    }
  } catch (_e) {}
  return r;
}`
    );
    modified = true;
  }

  // Fix 4: _allEngineFiles that returns basenames → return full paths
  if (c.includes('_allEngineFiles') && c.includes('.map(f => path.basename(f))')) {
    c = c.replace(/_allEngineFiles\((\w+)\)\.map\(f => path\.basename\(f\)\)/g,
      '_allEngineFiles($1).map((f: string) => path.basename(f))');
    // Actually let's just keep basename mapping but fix the readFileSync
  }

  // Fix 5: For files using _walkRecursive, fix the readFileSync(path.join(dir, f)) pattern
  // where f comes from _walkRecursive result that may have been mapped to basename
  if (c.includes('_walkRecursive') && c.includes('path.basename(f)')) {
    // Check if there's a loop that uses basename and then reads with path.join
    // This is complex - let's just ensure _walkRecursive returns full paths
    // and the consumer uses full paths
  }

  // Fix 6: for loops iterating files from _walk with readFileSync(path.join(dir, f))
  // After fix 1, f is full path
  if (c.includes('for (const f of files)') && c.includes('fs.readFileSync(path.join(dir, f)')) {
    c = c.replace(/fs\.readFileSync\(path\.join\(dir, f\),\s*['"]utf-?8['"]\)/g,
      'fs.readFileSync(f, "utf-8")');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[FIX] ${path.basename(fp)}`);
    fixes++;
  }
});

console.log(`\nFixed ${fixes} files`);
