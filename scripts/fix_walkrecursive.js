// Fix broken _walkRecursive pattern in all test files
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
const BROKEN_PATTERN = /for \(const e of fs\.readdirSync\(dir, \{ withFileTypes: true \} as any, \{ withFileTypes: true \}\)\.filter\(e => e\.isFile\(\)\)\.map\(e => e\.name\)\) \{\s*if \(\(e as any\)\.isDirectory\(\)\) r = r\.concat\(_walkRecursive\(require\('path'\)\.join\(dir, \(e as any\)\.name\)\)\);\s*else r\.push\(\(e as any\)\.name\);\s*\}/gs;

const GOOD_CODE = `try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        r = r.concat(_walkRecursive(fullPath));
      } else if (entry.isFile()) {
        r.push(fullPath);
      }
    }
  } catch (_e) {}`;

let fixed = 0;
fs.readdirSync(TESTS_DIR).forEach(f => {
  if (!f.endsWith('.test.ts')) return;
  const fp = path.join(TESTS_DIR, f);
  let c = fs.readFileSync(fp, 'utf8');
  if (BROKEN_PATTERN.test(c)) {
    c = c.replace(BROKEN_PATTERN, GOOD_CODE);
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[FIX] ${f}`);
    fixed++;
  }
});
console.log(`\nFixed ${fixed} files with broken _walkRecursive`);
