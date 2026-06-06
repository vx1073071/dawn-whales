// Pre-commit hook — runs fast sanity checks before allowing commit
// Exit 0 = pass, Exit 1 = fail (block commit)

const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { cwd: projectRoot, stdio: 'pipe', ...opts });
    return true;
  } catch (e) {
    if (opts.strict !== false) {
      console.error('[pre-commit] FAILED:', e.stderr?.toString() || e.message);
      process.exit(1);
    }
    return false;
  }
}

console.log('[pre-commit] Running sanity checks...');

// Run TypeScript check
run('npx tsc --noEmit', { stdio: 'inherit' });

console.log('[pre-commit] All checks passed ✓');
