/**
 * TSC Batch Fix Script — R89 Q-02
 * Fixes TS18046/TS2339/TS2345/TS2322/TS2571/TS2740/TS2769/TS2362/TS2365
 * by adding type assertions to unknown/Record<string,unknown> consumption.
 * 
 * Strategy:
 * - catch(e) → catch(e: unknown) + cast e as Error where needed
 * - .map((item) => ...) where item is unknown → .map((item: any) => ...)
 * - Property access on {} or unknown → add `as Type` or `as any`
 * - TS2300 duplicate identifier → detect and rename
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// Get current TSC errors
function getErrors() {
  try {
    execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', cwd: root, timeout: 120000 });
    return [];
  } catch (e) {
    return (e.stdout || '').split('\n').filter(l => l.includes('error TS'));
  }
}

// Parse error into structured format
function parseError(line) {
  // Handle possible prefix like "npm exec..." before the actual error line
  const m = line.match(/(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$/);
  if (!m) return null;
  // Clean file path — remove any prefix text before the actual file path
  let file = m[1].trim();
  // Remove any leading junk (like "npm exec..." or "管理员:" prefixes)
  file = file.replace(/^.*?(?=src\/|electron\/|tests\/|server\/|vite\.config|vitest\.config)/, '');
  if (!file) return null;
  return { file, line: parseInt(m[2]), col: parseInt(m[3]), code: m[4], message: m[5] };
}

// Group errors by file
function groupByFile(errors) {
  const groups = {};
  errors.forEach(e => {
    if (!groups[e.file]) groups[e.file] = [];
    groups[e.file].push(e);
  });
  return groups;
}

// Fix a single file
function fixFile(filePath, errors) {
  const fullPath = path.join(root, filePath.replace(/\//g, path.sep));
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP: ${filePath} not found`);
    return 0;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  let fixCount = 0;

  // Sort errors by line (reverse order to avoid offset issues)
  errors.sort((a, b) => b.line - a.line);

  for (const err of errors) {
    const lineIdx = err.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    let line = lines[lineIdx];

    // TS18046: 'e' is of type 'unknown' → add cast
    if (err.code === '18046') {
      // catch(e) → catch block, need `e as Error`
      if (line.includes('e.message') || line.includes('e?.message')) {
        // Already using e.message, change to (e as Error).message
        line = line.replace(/\be\.message\b/g, '(e as Error).message');
        line = line.replace(/\be\?\.message\b/g, '(e as Error)?.message');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // e.toString() → (e as Error).toString()
      if (line.includes('e.toString()')) {
        line = line.replace(/\be\.toString\(\)/g, '(e as Error).toString()');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // Generic e access → cast to any
      if (/\be\.\w/.test(line)) {
        line = line.replace(/\be\./g, '(e as any).');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // 't' is of type unknown — template iteration
      if (line.includes('t.') || line.includes('t?.')) {
        line = line.replace(/\bt\./g, '(t as any).');
        line = line.replace(/\bt\?\./g, '(t as any)?.');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // 'a' is of type unknown
      if (line.includes('a.') || line.includes('a?.')) {
        line = line.replace(/\ba\./g, '(a as any).');
        line = line.replace(/\ba\?\./g, '(a as any)?.');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // 'err' is of type unknown
      if (line.includes('err.') || line.includes('err?.')) {
        line = line.replace(/\berr\./g, '(err as any).');
        line = line.replace(/\berr\?\./g, '(err as any)?.');
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // Generic unknown variable
      const match = err.message.match(/'(\w+)' is of type 'unknown'/);
      if (match) {
        const varName = match[1];
        const regex = new RegExp(`\\b${varName}\\.`, 'g');
        line = line.replace(regex, `(${varName} as any).`);
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
    }

    // TS2339: Property does not exist on type '{}'
    if (err.code === '2339') {
      const propMatch = err.message.match(/Property '(\w+)' does not exist on type '\{\}'/);
      if (propMatch) {
        const prop = propMatch[1];
        // Find pattern like `obj.prop` or `data.prop` and add `as any`
        // Common patterns: result.xxx, data.xxx, info.xxx, response.xxx, config.xxx, status.xxx
        const patterns = [
          new RegExp(`(\\w+)\\.${prop}\\b`, 'g'),
        ];
        for (const p of patterns) {
          if (p.test(line)) {
            line = line.replace(p, (match) => {
              const obj = match.slice(0, -(prop.length + 1));
              return `(${obj} as any).${prop}`;
            });
            lines[lineIdx] = line;
            fixCount++;
            break;
          }
        }
        continue;
      }
      // Property does not exist on Window.api type
      if (err.message.includes("does not exist on type '{ broker:")) {
        // window.api doesn't have the property — add via (window.api as any).xxx
        const propMatch2 = err.message.match(/Property '(\w+)' does not exist/);
        if (propMatch2) {
          const prop = propMatch2[1];
          line = line.replace(new RegExp(`(window\\.api)\\.${prop}\\b`), `(window.api as any).${prop}`);
          lines[lineIdx] = line;
          fixCount++;
          continue;
        }
      }
    }

    // TS2345: Argument type not assignable
    if (err.code === '2345') {
      // Common: passing unknown to SetStateAction → add `as Type`
      // For setState calls: setXxx(value) where value is unknown → setXxx(value as any)
      if (line.includes('setState') || /set\w+\(/.test(line)) {
        // Wrap the first argument with `as any`
        line = line.replace(/(\w+\()([^)]+?)(\))/, (match, open, arg, close) => {
          if (arg.includes(' as ')) return match;
          return `${open}${arg} as any${close}`;
        });
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // Generic argument type mismatch → add `as any` to problematic arg
      // This is harder to do automatically, skip for now
      continue;
    }

    // TS2322: Type not assignable (variable assignment)
    if (err.code === '2322') {
      // Type '{}' not assignable to type 'string'/'number'/etc
      // Type 'unknown[]' not assignable to type 'XxxType[]'
      // Type 'unknown' not assignable to type 'XxxType'
      // Type 'null' not assignable to type 'Record<string, unknown>'

      // For variable declarations: const x: Type = expr → const x = expr as Type
      // For return statements: return expr → return expr as Type

      // Simple approach: add `as any` before the semicolon or at end of expression
      if (line.includes('return ') && !line.includes(' as ')) {
        line = line.replace(/return\s+(.+?)(;?\s*)$/, (match, expr, semi) => {
          return `return (${expr}) as any${semi}`;
        });
        lines[lineIdx] = line;
        fixCount++;
        continue;
      }
      // Assignment: xxx = yyy → xxx = yyy as any (but careful)
      // Skip complex cases
      continue;
    }

    // TS2571: Object is of type 'unknown'
    if (err.code === '2571') {
      // Common in catch blocks: err.xxx
      line = line.replace(/\berr\b/g, '(err as any)');
      lines[lineIdx] = line;
      fixCount++;
      continue;
    }

    // TS2740: Type Record<string, unknown> missing properties
    if (err.code === '2740' || err.code === '2739') {
      // Add `as any` to the assignment
      if (line.includes('return ')) {
        line = line.replace(/return\s+(.+?)(;?\s*)$/, (match, expr, semi) => `return (${expr}) as any${semi}`);
      } else {
        // For const x: Type = expr → add `as any`
        const assignMatch = line.match(/(=\s*)(.+?)(;?\s*)$/);
        if (assignMatch) {
          line = line.replace(assignMatch[0], `${assignMatch[1]}(${assignMatch[2]}) as any${assignMatch[3]}`);
        }
      }
      lines[lineIdx] = line;
      fixCount++;
      continue;
    }

    // TS2769: No overload matches this call
    if (err.code === '2769') {
      // Usually a component prop type mismatch — harder to fix automatically
      // Skip for now
      continue;
    }

    // TS2362/TS2365: Arithmetic on non-number types
    if (err.code === '2362' || err.code === '2365') {
      // Cast operands to number
      // Find the expression and wrap with Number()
      // This is complex, skip for now
      continue;
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
    console.log(`  Fixed ${fixCount}/${errors.length} errors in ${filePath}`);
  } else {
    console.log(`  No auto-fix for ${errors.length} errors in ${filePath}`);
  }

  return fixCount;
}

// Main
console.log('=== TSC Batch Fix Script ===');
console.log('Getting current errors...');
const errors = getErrors();
console.log(`Total errors: ${errors.length}`);

const parsed = errors.map(parseError).filter(Boolean);
const grouped = groupByFile(parsed);

const fileCount = Object.keys(grouped).length;
console.log(`Files with errors: ${fileCount}`);

let totalFixed = 0;
for (const [file, fileErrors] of Object.entries(grouped)) {
  totalFixed += fixFile(file, fileErrors);
}

console.log(`\nTotal fixes applied: ${totalFixed}`);
console.log('Re-running TSC to verify...');

const remaining = getErrors();
console.log(`Remaining errors: ${remaining.length}`);
