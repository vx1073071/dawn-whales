#!/usr/bin/env node
// scripts/install-hook.js
// Installs the pre-commit hook into .git/hooks/pre-commit

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOOK_DIR = path.join(ROOT, '.git', 'hooks');
const HOOK_FILE = path.join(HOOK_DIR, 'pre-commit');
const SOURCE = path.join(ROOT, 'scripts', 'pre-commit-check.js');

if (!fs.existsSync(path.join(ROOT, '.git'))) {
  console.error('❌ No .git directory found. Run from project root.');
  process.exit(1);
}

if (!fs.existsSync(HOOK_DIR)) {
  fs.mkdirSync(HOOK_DIR, { recursive: true });
}

const shebang = '#!/usr/bin/env node\n';
const hookContent = shebang + fs.readFileSync(SOURCE, 'utf-8');

fs.writeFileSync(HOOK_FILE, hookContent, 'utf-8');
fs.chmodSync(HOOK_FILE, 0o755);

console.log('✅ Pre-commit hook installed: ' + HOOK_FILE);
console.log('   Run: npm run install:hook');
