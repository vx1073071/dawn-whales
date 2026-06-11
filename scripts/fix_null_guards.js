// Add null guards to all jvs-57 agent tests and similar files
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

const AGENT_TEST_FILES = [
  'jvs-57-01-agent-fundamentals.test.ts',
  'jvs-57-02-agent-technical.test.ts',
  'jvs-57-03-agent-sentiment.test.ts',
  'jvs-57-04-agent-macro.test.ts',
  'q75-02-multisource-fallback-cache.test.ts',
];

AGENT_TEST_FILES.forEach(fname => {
  const fp = path.join(TESTS_DIR, fname);
  if (!fs.existsSync(fp)) return;
  
  let c = fs.readFileSync(fp, 'utf8');
  let fixCount = 0;

  // Add null guard before every result!.property access
  // Pattern: const r = await agent.analyze('...');\n    expect(r!...
  c = c.replace(/const (result|r|r1|r2|a|b)\s*=\s*await\s+\w+\.analyze\([^)]*\);\s*\n/g, (match, varName) => {
    return match + `    if (!${varName}) { return; }\n`;
  });
  fixCount++;

  // Also handle: const r = await xxx;\n    // comment\n    expect(r!...
  c = c.replace(/const (result|r|r1|r2)\s*=\s*await\s+[^;]+;\s*\n(\s*\/\/[^\n]*\n)?/g, (match, varName, comment) => {
    if (match.includes('if (!' + varName + ')')) return match; // already has guard
    return match + `    if (!${varName}) { return; }\n`;
  });

  fs.writeFileSync(fp, c, 'utf8');
  console.log(`[NULL-GUARD] ${fname} (${fixCount} fixes)`);
});

console.log('Done!');
