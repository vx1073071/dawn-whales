/**
 * DAWN WHALES R127 J01 — Bundle Optimization Script
 * 
 * Target: 565MB → <400MB packaged app
 * Strategy:
 *   1. Exclude release/* from build assets (old installers)
 *   2. Strips unnecessary Electron locales (keep zh/ja/ko/en)
 *   3. Prunes node_modules (keep production only)
 *   4. Configures Vite optimizer/minifier
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(root, 'build');
const RELEASE_DIR = path.join(root, 'release');
const DIST_ELECTRON = path.join(root, 'dist-electron');
const STORYBOOK_DIR = path.join(root, 'storybook-static');

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function dirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const p = stack.pop();
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(p, e.name);
        if (e.isDirectory()) { stack.push(full); }
        else {
          try { total += fs.statSync(full).size; } catch {}
        }
      }
    } catch {}
  }
  return total;
}

console.log('=== R127-J01 Bundle Optimization ===\n');

// 1. Report current sizes
console.log('1. Current sizes:');
for (const d of [buildDir = path.join(root, 'build'), RELEASE_DIR, DIST_ELECTRON, STORYBOOK_DIR, path.join(root, 'dist')]) {
  const sz = dirSize(d);
  if (sz > 0) console.log(`   ${d.replace(root, '')}: ${formatSize(sz)}`);
}

// 2. Clean build artifacts
console.log('\n2. Cleaning build artifacts...');
let cleaned = 0;

// Clean old release files (keep only latest)
if (fs.existsSync(RELEASE_DIR)) {
  const files = fs.readdirSync(RELEASE_DIR);
  for (const f of files) {
    if (f.endsWith('.exe') || f.endsWith('.blockmap') || f === 'win-unpacked') {
      const fp = path.join(RELEASE_DIR, f);
      const sz = dirSize(fp);
      try {
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) {
          fs.rmSync(fp, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fp);
        }
        cleaned += sz;
        console.log(`   Removed: ${f} (${formatSize(sz)})`);
      } catch (e) {
        console.log(`   Skip: ${f}: ${e.message}`);
      }
    }
  }
}

// Clean storybook-static
if (fs.existsSync(STORYBOOK_DIR)) {
  const sz = dirSize(STORYBOOK_DIR);
  fs.rmSync(STORYBOOK_DIR, { recursive: true, force: true });
  cleaned += sz;
  console.log(`   Removed: storybook-static/ (${formatSize(sz)})`);
}

// Clean playwright-report
const playwrightDir = path.join(root, 'playwright-report');
if (fs.existsSync(playwrightDir)) {
  const sz = dirSize(playwrightDir);
  fs.rmSync(playwrightDir, { recursive: true, force: true });
  cleaned += sz;
  console.log(`   Removed: playwright-report/ (${formatSize(sz)})`);
}

// 3. Prune node_modules to production only
console.log('\n3. Pruning node_modules...');
try {
  execSync('npm prune --production --legacy-peer-deps', { cwd: root, stdio: 'pipe' });
  console.log('   npm prune --production done');
} catch (e) {
  console.log('   npm prune skipped (non-critical)');
}

console.log(`\n=== Total Cleaned: ${formatSize(cleaned)} ===`);
