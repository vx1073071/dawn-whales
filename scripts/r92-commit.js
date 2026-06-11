const { execSync } = require('child_process');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/dawn-whales';

try {
  execSync('git add tests/helpers/crypto-polyfill.ts tests/condition-engine.test.ts', { cwd: ROOT, encoding: 'utf-8' });
  const r = execSync('git commit -m "youdao R92 Q-01: fix crypto.randomUUID polyfill (165 tests) + condition-engine id regex"', { cwd: ROOT, encoding: 'utf-8' });
  console.log(r);
  const log = execSync('git log --oneline -5', { cwd: ROOT, encoding: 'utf-8' });
  console.log(log);
} catch(e) {
  console.log('Error:', e.message);
  if (e.stdout) console.log(e.stdout);
  if (e.stderr) console.log(e.stderr.substring(0, 500));
}
