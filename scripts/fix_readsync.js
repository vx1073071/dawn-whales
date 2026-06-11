// Fix readFileSync after _allEngineFiles basename mapping
// The pattern: _allEngineFiles returns basenames, then readFileSync(path.join(dir, f)) fails
// Fix: replace readFileSync(path.isAbsolute(f) ? f : path.join(dir, f)) with _readEngineFile(f)
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
let fixCount = 0;

function walkTests(dir) {
  const results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isFile() && (e.name.endsWith('.test.ts') || e.name.endsWith('.test.tsx'))) results.push(fp);
    if (e.isDirectory() && !e.name.startsWith('.')) results.push(...walkTests(fp));
  }
  return results;
}

walkTests(TESTS_DIR).forEach(fp => {
  let c = fs.readFileSync(fp, 'utf8');
  let modified = false;

  // Fix 1: readFileSync(path.isAbsolute(f) ? f : path.join(dir, f)) → _readEngineFile(path.basename(f))
  const oldPattern = /fs\.readFileSync\(path\.isAbsolute\(f\) \? f : path\.join\(dir, f\),\s*['"]utf-?8['"]\)/g;
  if (oldPattern.test(c)) {
    c = c.replace(oldPattern, "_readEngineFile(path.basename(f)) || ''");
    modified = true;
  }

  // Fix 2: fs.readFileSync(path.join(ENGINE, f)) where f is basename → _readEngineFile
  const pattern2 = /fs\.readFileSync\(path\.join\(ENGINE,\s*f\),\s*['"]utf-?8['"]\)/g;
  if (pattern2.test(c)) {
    c = c.replace(pattern2, "_readEngineFile(path.basename(f)) || ''");
    modified = true;
  }

  // Fix 3: fs.readFileSync(path.join(dir, f)) without isAbsolute → _readEngineFile
  const pattern3 = /fs\.readFileSync\(path\.join\(dir,\s*f\),\s*['"]utf-?8['"]\)/g;
  if (pattern3.test(c)) {
    c = c.replace(pattern3, "_readEngineFile(path.basename(f)) || ''");
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[READFIX] ${path.basename(fp)}`);
    fixCount++;
  }
});

console.log(`\nFixed ${fixCount} files`);
