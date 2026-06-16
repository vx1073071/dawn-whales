const { execSync } = require('child_process');
const path = require('path');
const ROOT = 'C:/Users/vx107/.easyclaw/workspace/quant-moo';
const GIT = 'C:/Users/vx107/AppData/Local/OpenClaw/deps/portable-git/mingw64/bin/git.exe';
const env = {
  ...process.env,
  PATH: 'C:/Users/vx107/AppData/Local/OpenClaw/deps/portable-git/mingw64/bin;' + process.env.PATH
};

try {
  const r1 = execSync(`"${GIT}" add tests/helpers/crypto-polyfill.ts tests/condition-engine.test.ts`, { cwd: ROOT, encoding: 'utf-8', env });
  console.log('add:', r1 || 'ok');
  
  const r2 = execSync(`"${GIT}" commit -m "youdao R92 Q-01: fix crypto.randomUUID polyfill (165 tests) + condition-engine id regex"`, { cwd: ROOT, encoding: 'utf-8', env });
  console.log('commit:', r2);
  
  const r3 = execSync(`"${GIT}" log --oneline -5`, { cwd: ROOT, encoding: 'utf-8', env });
  console.log(r3);
} catch(e) {
  console.log('Error:', e.message);
  if (e.stdout) console.log(e.stdout);
  if (e.stderr) console.log(e.stderr.substring(0, 500));
}
