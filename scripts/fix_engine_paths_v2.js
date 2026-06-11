// Fix all test files that use flat engine paths to use recursive search
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

// Helper to inject
const HELPER_CODE = `
// [R92] Recursive engine file finder
function _findEngineFile(name: string): string | null {
  const ENGINE_DIR = path.resolve(__dirname, '..', 'electron', 'engine');
  function walk(dir: string): string | null {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isFile() && e.name === name) return fp;
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          const r = walk(fp); if (r) return r;
        }
      }
    } catch {}
    return null;
  }
  return walk(ENGINE_DIR);
}
function _readEngineFile(name: string): string {
  const fp = _findEngineFile(name);
  if (fp) return fs.readFileSync(fp, 'utf-8');
  return '';
}
function _allEngineFiles(dir?: string): string[] {
  const ENGINE_DIR = dir || path.resolve(__dirname, '..', 'electron', 'engine');
  const result: string[] = [];
  function walk(d: string) {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isFile() && e.name.endsWith('.ts')) result.push(fp);
        else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(fp);
      }
    } catch {}
  }
  walk(ENGINE_DIR);
  return result;
}
`;

// Files that need the helper injected
const filesToFix = [
  'q76-01-usemock-crash-recovery.test.ts',
  'q76-02-content-safety-gdpr.test.ts',
  'q77-01-security-e2e.test.ts',
  'q77-02-etimedout-fix.test.ts',
  'q78-01-three-engine-tests.test.ts',
  'q79-02-coverage-gate-60.test.ts',
  'q79-04-dark-light-responsive.test.ts',
  'q80-01-growth-funnel-invite.test.ts',
];

filesToFix.forEach(fname => {
  const fp = path.join(TESTS_DIR, fname);
  if (!fs.existsSync(fp)) return;

  let c = fs.readFileSync(fp, 'utf8');

  // Inject helper if not already present
  if (!c.includes('_findEngineFile')) {
    // Insert after imports
    const importEnd = c.lastIndexOf("import ");
    const lineEnd = c.indexOf('\n', importEnd);
    c = c.slice(0, lineEnd + 1) + HELPER_CODE + c.slice(lineEnd + 1);
  }

  // Replace flat path reads with recursive helper
  // Pattern: fs.readFileSync(path.join(ENGINE, 'filename.ts'), 'utf-8')
  c = c.replace(/fs\.readFileSync\(path\.join\(ENGINE, '([^']+)'\),\s*['"]utf-?8['"]\)/g,
    "_readEngineFile('$1')");

  // Pattern: fs.readFileSync(path.join(ENGINE, a.file), 'utf-8')
  c = c.replace(/fs\.readFileSync\(path\.join\(ENGINE, (\w+\.file)\),\s*['"]utf-?8['"]\)/g,
    "_readEngineFile($1)");

  // Pattern: path.join(ENGINE, 'filename.ts') for existsSync
  c = c.replace(/fs\.existsSync\(path\.join\(ENGINE, '([^']+)'\)\)/g,
    "fs.existsSync(_findEngineFile('$1') || path.join(ENGINE, '$1'))");

  // Pattern: readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name)
  // where dir is engine directory - replace with _allEngineFiles
  c = c.replace(/const files = fs\.readdirSync\((\w+), \{ withFileTypes: true \}\)\.filter\(e => e\.isFile\(\)\)\.map\(e => e\.name\)\.filter\(f => f\.endsWith\(['"]\.ts['"]\)\);/g,
    'const files = _allEngineFiles($1).map(f => path.basename(f));');

  c = c.replace(/const files = fs\.readdirSync\((\w+), \{ withFileTypes: true \}\)\.filter\(e => e\.isFile\(\)\)\.map\(e => e\.name\);/g,
    'const files = _allEngineFiles($1).map(f => path.basename(f));');

  // For loops that iterate over engine files with readFileSync inside
  c = c.replace(/for \(const f of fs\.readdirSync\((\w+), \{ withFileTypes: true \}\)\.filter\(e => e\.isFile\(\)\)\.map\(e => e\.name\)\)/g,
    'for (const f of _allEngineFiles($1).map((fp: string) => path.basename(fp)))');

  // Fix: path.join(dir, f) → just use f (since _allEngineFiles returns full paths, but we map to basename)
  // Actually let's keep it simple - the basename is just the filename

  fs.writeFileSync(fp, c, 'utf8');
  console.log(`[FIX] ${fname}`);
});

console.log('\nDone!');
