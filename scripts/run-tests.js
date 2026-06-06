#!/usr/bin/env node
// Wrapper that runs vitest and propagates exit code correctly on Windows.
// Handles the CJS deprecation warning that corrupts exit codes when run via npm scripts.
const { spawn } = require('child_process');

const child = spawn(
  process.execPath,
  ['--no-deprecation', 'node_modules/vitest/vitest.mjs', 'run'],
  {
    cwd: __dirname,
    stdio: 'inherit',
    shell: false,
  }
);

child.on('exit', (code) => {
  process.exit(code === 0 ? 0 : 1);
});
