import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();

// 1. Version
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
console.log(`version: ${pkg.version}`);

// 2. Git info
const commits = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
console.log(`git: branch=${branch}, commits=${commits}`);

// 3. i18n
const i18nDir = path.join('src', 'i18n');
let langCount = 0, totalKeys = 0;
if (fs.existsSync(i18nDir)) {
  for (const f of fs.readdirSync(i18nDir)) {
    if (f.endsWith('.ts') || f.endsWith('.json')) {
      const c = fs.readFileSync(path.join(i18nDir, f), 'utf-8');
      langCount++;
      totalKeys += (c.match(/['"][\w.-]+['"]\s*:/g) || []).length;
    }
  }
}
// Engine i18n calls
let engineI18n = 0;
function walkI18n(d) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isFile() && e.name.endsWith('.ts')) {
        engineI18n += (fs.readFileSync(fp, 'utf-8').match(/i18n\.t\(/g) || []).length;
      } else if (e.isDirectory() && !e.name.startsWith('.')) walkI18n(fp);
    }
  } catch {}
}
walkI18n(path.join('electron', 'engine'));
console.log(`i18n: ${langCount} lang files, ~${totalKeys} keys, ${engineI18n} engine i18n.t() calls`);

// 4. EngineError usage
let engineErr = 0, totalThrows = 0;
function walkErr(d) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isFile() && e.name.endsWith('.ts')) {
        const c = fs.readFileSync(fp, 'utf-8');
        engineErr += (c.match(/new EngineError/g) || []).length;
        totalThrows += (c.match(/throw new/g) || []).length;
      } else if (e.isDirectory() && !e.name.startsWith('.')) walkErr(fp);
    }
  } catch {}
}
walkErr(path.join('electron', 'engine'));
const errPct = totalThrows ? Math.round(engineErr / totalThrows * 100) : 0;
console.log(`EngineError: ${engineErr}/${totalThrows} throws (${errPct}%)`);

// 5. Source file counts
let engineFiles = 0, testFiles = 0, srcFiles = 0;
function countFiles(d, ext) {
  let c = 0;
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isFile() && e.name.endsWith(ext)) c++;
      else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') c += countFiles(fp, ext);
    }
  } catch {}
  return c;
}
engineFiles = countFiles(path.join('electron', 'engine'), '.ts');
testFiles = countFiles('tests', '.test.ts') + countFiles('tests', '.test.tsx');
srcFiles = countFiles('src', '.ts') + countFiles('src', '.tsx');
console.log(`files: engine=${engineFiles}, tests=${testFiles}, src=${srcFiles}`);

// 6. Bundle size
const distDir = 'dist/assets';
let totalBundle = 0;
if (fs.existsSync(distDir)) {
  for (const f of fs.readdirSync(distDir)) {
    if (f.endsWith('.js') || f.endsWith('.css')) {
      totalBundle += fs.statSync(path.join(distDir, f)).size;
    }
  }
}
console.log(`bundle: ${(totalBundle / 1024).toFixed(0)} KB (dist/assets)`);

// 7. Excluded test files
const vitestConfig = fs.readFileSync('vitest.config.ts', 'utf-8');
const excludeMatches = vitestConfig.match(/'tests\/[^']+\.test\.ts(?:x)?'/g) || [];
console.log(`vitest_exclude: ${excludeMatches.length} test files excluded`);

// 8. Skipped test files
const skipFiles = fs.readdirSync('tests').filter(f => f.endsWith('.skip.ts'));
console.log(`skipped_files: ${skipFiles.length} .skip.ts files`);

// 9. Dependencies
console.log(`deps: ${Object.keys(pkg.dependencies || {}).length} prod, ${Object.keys(pkg.devDependencies || {}).length} dev`);

// 10. Playwright spec count
const e2eDir = 'e2e';
const specFiles = fs.existsSync(e2eDir) ? fs.readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts')) : [];
console.log(`e2e_specs: ${specFiles.length} files`);
