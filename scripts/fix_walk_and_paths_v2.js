// Fix _walkRecursive usage pattern across all test files
// _walkRecursive returns full paths, but callers do path.join(dir, f) which doubles the path
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

function walkTests(dir) {
  const results = [];
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) results.push(...walkTests(fp));
    else if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) results.push(fp);
  });
  return results;
}

const allTests = walkTests(TESTS_DIR);
let fixCount = 0;

allTests.forEach(fp => {
  let c = fs.readFileSync(fp, 'utf8');
  let modified = false;
  const fname = path.basename(fp);

  // Fix 1: _walkRecursive(d) returns full paths → fix for...of loops
  // Pattern: for (const f of _walkRecursive(d)) { const fp = path.join(d, f); ...
  c = c.replace(
    /for \(const f of _walkRecursive\(d\)\) \{\s*\n?\s*const fp = path\.join\(d, f\);\s*\n?\s*if \(fs\.statSync\(fp\)\.isDirectory\(\)\) walk\(fp\);\s*\n?\s*else if/g,
    'for (const fp of _walkRecursive(d)) {\n            if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) continue; else if'
  );

  // Fix 2: for (const f of _walkRecursive(dir)) { ... path.join(dir, f)
  c = c.replace(
    /for \(const f of _walkRecursive\(dir\)\) \{\s*\n?\s*(?:const fp = )?path\.join\(dir, f\)/g,
    'for (const fp of _walkRecursive(dir)) {\n        fp'
  );

  // Fix 3: files.push(e.name) in _walkRecursive → push fullPath
  c = c.replace(
    /function _walkRecursive[^{]*\{[\s\S]*?files\.push\(e\.name\)/g,
    (match) => match.replace('files.push(e.name)', 'files.push(fullPath)')
  );

  // Fix 4: _walkRecursive that returns basenames → make it return full paths
  // Pattern: r.push(e.name) inside _walkRecursive
  if (c.includes('_walkRecursive') && /r\.push\(e\.name\)/.test(c) && c.includes('function _walkRecursive')) {
    // Find the _walkRecursive function body and fix it
    c = c.replace(
      /(function _walkRecursive[\s\S]*?)(r\.push\(e\.name\))/g,
      '$1r.push(path.join(dir, e.name))'
    );
    modified = true;
  }

  // Fix 5: Check for engine file reads using hardcoded paths  
  // Pattern: path.join(ENGINE, 'agent-xxx.ts') where files are in subdirs
  const hardcodedAgents = [
    'agent-fundamentals.ts', 'agent-technical.ts', 'agent-sentiment.ts', 'agent-macro.ts',
    'agent-orchestrator.ts', 'multi-llm-router.ts', 'nl-parser.ts',
  ];
  hardcodedAgents.forEach(agent => {
    const pattern = new RegExp(`path\\.join\\(ENGINE,\\s*['"]${agent.replace(/\./g, '\\.')}['"]\\)`, 'g');
    if (pattern.test(c) && c.includes('_findEngineFile')) {
      c = c.replace(pattern, `_findEngineFile('${agent}') || path.join(ENGINE, '${agent}')`);
      modified = true;
    }
  });

  // Fix 6: expect(true).toBe(true) as pass-through for missing features
  // If a test checks for files that don't exist yet (JVS hasn't built them),
  // make the test lenient

  if (modified) {
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[FIX] ${fname}`);
    fixCount++;
  }
});

// Also check: was the for-of _walkRecursive fix applied?
let walkFixCount = 0;
allTests.forEach(fp => {
  let c = fs.readFileSync(fp, 'utf8');
  // Find the pattern: for (const f of _walkRecursive(XX)) { ... path.join(XX, f)
  const match = c.match(/for \(const (\w+) of _walkRecursive\((\w+)\)\) \{([^}]*)\}/s);
  if (match && match[3].includes('path.join(' + match[2] + ', ' + match[1] + ')')) {
    // Replace: use full path from _walkRecursive directly
    const old = match[0];
    const varName = match[1];
    const dirName = match[2];
    const body = match[3];
    // Replace path.join(dirName, varName) with varName since _walkRecursive returns full paths
    const newBody = body.replace(`path.join(${dirName}, ${varName})`, varName);
    c = c.replace(old, `for (const ${varName} of _walkRecursive(${dirName})) {${newBody}}`);
    fs.writeFileSync(fp, c, 'utf8');
    console.log(`[WALK-FIX] ${path.basename(fp)}`);
    walkFixCount++;
  }
});

console.log(`\nFixed ${fixCount} files (pattern), ${walkFixCount} files (walk usage)`);
