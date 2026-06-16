// T-ML-WB-02: Replace console statements with logger
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all tsx files with console statements
const result = execSync(
  'npx grep -rn "console\\." src/components/ --include="*.tsx" -l',
  { encoding: 'utf8', cwd: 'C:/Users/vx107/.easyclaw/workspace/quant-moo' }
);

const files = result.trim().split('\n').filter(f => f);
console.log(`Found ${files.length} files with console statements`);

let totalReplacements = 0;

for (const file of files) {
  if (!file) continue;
  const fp = path.resolve('C:/Users/vx107/.easyclaw/workspace/quant-moo', file);
  let content = fs.readFileSync(fp, 'utf8');
  const original = content;
  
  // Extract component name from filename
  const basename = path.basename(file, '.tsx');
  
  // Add logger import if not present
  if (!content.includes("from '@/lib/logger'") && !content.includes('./logger')) {
    // Find last import line
    const lines = content.split('\n');
    let lastImportIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIdx = i;
      }
    }
    lines.splice(lastImportIdx + 1, 0, `import { createLogger } from '@/lib/logger';`);
    lines.splice(lastImportIdx + 2, 0, `const log = createLogger('${basename}');`);
    lines.splice(lastImportIdx + 3, 0, '');
    content = lines.join('\n');
  }
  
  // Replace patterns
  // console.error('[Error:XXX]', e) → log.error('XXX', e)
  content = content.replace(
    /console\.error\s*\(\s*'\[Error:\s*([^\]]+)\]\s*',\s*/g,
    "log.error('$1', "
  );
  
  // console.error('prefix:', err) → log.error('prefix', err)
  content = content.replace(
    /console\.error\s*\(\s*'\[([^\]]+)\]\s*([^']*)',\s*/g,
    "log.error('$1$2', "
  );
  
  // console.error(...) → log.error(...)
  content = content.replace(/console\.error\(/g, 'log.error(');
  
  // console.warn → log.warn
  content = content.replace(/console\.warn\(/g, 'log.warn(');
  
  // console.log (debug) → log.debug
  content = content.replace(/console\.log\(/g, 'log.debug(');

  // console.info → log.info
  content = content.replace(/console\.info\(/g, 'log.info(');
  
  if (content !== original) {
    fs.writeFileSync(fp, content, 'utf8');
    const changes = (original.match(/console\./g) || []).length;
    totalReplacements += changes;
    console.log(`  ✅ ${basename}: ${changes} replacements`);
  }
}

console.log(`\nTotal: ${totalReplacements} console statements replaced`);
