#!/usr/bin/env python3
"""
R90 Q-01: Batch fix remaining excluded tests.
Handles engine dir restructure patterns.
"""
import os, re

TESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tests')

# Common recursive helper to inject after imports
HELPER_BLOCK = '''
// Recursive engine file finder (post-restructure)
const _findEngineFiles = (dir: string): string[] => {
  const results: string[] = [];
  const walk = (d: string) => {
    try {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(d, f.name));
        else if (f.name.endsWith('.ts') && f.name !== 'index.ts') results.push(f.name);
      }
    } catch (_e) { /* ignore */ }
  };
  walk(dir);
  return results;
};
const _engineFileExists = (dir: string, name: string): boolean => {
  const walk = (d: string): boolean => {
    try {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) { if (walk(path.join(d, f.name))) return true; }
        else if (f.name === name) return true;
      }
    } catch (_e) { /* ignore */ }
    return false;
  };
  return walk(dir);
};
const _findEngineFile = (dir: string, name: string): string | null => {
  const walk = (d: string): string | null => {
    try {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) { const r = walk(path.join(d, f.name)); if (r) return r; }
        else if (f.name === name) return path.join(d, f.name);
      }
    } catch (_e) { /* ignore */ }
    return null;
  };
  return walk(dir);
};
'''

def inject_helper(content):
    """Inject helper after the last import line."""
    if '_findEngineFiles' in content:
        return content  # already has it
    # Find position after last import
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('const PROJECT') or line.strip().startswith('const PKG'):
            last_import = i
    lines.insert(last_import + 1, HELPER_BLOCK)
    return '\n'.join(lines)

def fix_readdirSync_engine(content):
    """Replace flat readdirSync(engineDir) with recursive."""
    # Pattern: fs.readdirSync(engineDir) where engineDir/engine is the engine root
    content = re.sub(
        r'const (\w+) = fs\.readdirSync\((\w*[Ee]ngine\w*)\);',
        r'const \1 = _findEngineFiles(\2);',
        content
    )
    content = re.sub(
        r'const (\w+) = fs\.readdirSync\((\w*[Ee]ngine\w*)\)\.filter\([^)]+\);',
        r'const \1 = _findEngineFiles(\2);',
        content
    )
    return content

def fix_existsSync_engine(content):
    """Replace flat existsSync(path.join(engineDir, 'file')) with recursive."""
    content = re.sub(
        r'fs\.existsSync\(path\.join\((\w*[Ee]ngine\w*),\s*([\'"][^\'"]+[\'"])\)\)',
        r'_engineFileExists(\1, \2)',
        content
    )
    return content

def fix_readFileSync_engine(content):
    """Replace flat readFileSync(path.join(engineDir, 'file')) with recursive find."""
    # This is harder - need to replace with _findEngineFile pattern
    # Skip for now, handle manually
    return content

def fix_engine_count(content):
    """Replace flat engine count with recursive."""
    content = re.sub(
        r"const count = fs\.readdirSync\(([^)]*[Ee]ngine[^)]*)\)\.filter\(f => f\.endsWith\('\.ts'\)\)\.length;",
        r'''let count = 0;
      const _walkCount = (d: string) => {
        try {
          for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            if (f.isDirectory()) _walkCount(path.join(d, f.name));
            else if (f.name.endsWith('.ts') && f.name !== 'index.ts' && !f.name.endsWith('.test.ts') && !f.name.endsWith('.d.ts')) count++;
          }
        } catch (_e) { /* ignore */ }
      };
      _walkCount(\1);''',
        content
    )
    # Also handle function() style
    content = re.sub(
        r"const count = fs\.readdirSync\(([^)]*[Ee]ngine[^)]*)\)\.filter\(function\(f: string\) \{ return f\.endsWith\('\.ts'\); \}\)\.length;",
        r'''let count = 0;
      const _walkCount = (d: string) => {
        try {
          for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            if (f.isDirectory()) _walkCount(path.join(d, f.name));
            else if (f.name.endsWith('.ts') && f.name !== 'index.ts' && !f.name.endsWith('.test.ts') && !f.name.endsWith('.d.ts')) count++;
          }
        } catch (_e) { /* ignore */ }
      };
      _walkCount(\1);''',
        content
    )
    return content

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    content = inject_helper(content)
    content = fix_engine_count(content)
    content = fix_readdirSync_engine(content)
    content = fix_existsSync_engine(content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    targets = [
        'q74-01-build-deploy-verify.test.ts',
        'q69-02-guest-perf-e2e.test.ts',
        'q75-01-real-vs-mock-compare.test.ts',
        'q75-02-multisource-fallback-cache.test.ts',
        'q76-01-usemock-crash-recovery.test.ts',
        'q76-02-content-safety-gdpr.test.ts',
        'q72-02-factor-compare-portfolio.test.ts',
        'q73-01-realdata-draw-pattern.test.ts',
        'q73-02-onboarding-param-e2e.test.ts',
        'q78-01-three-engine-tests.test.ts',
        'q79-02-coverage-gate-60.test.ts',
        'q58-03-regression-validation.test.ts',
        'q50-03-coverage-boost.test.ts',
    ]
    
    for t in targets:
        fp = os.path.join(TESTS_DIR, t)
        if not os.path.exists(fp):
            print(f"  SKIP {t}: not found")
            continue
        if process_file(fp):
            print(f"  FIXED {t}")
        else:
            print(f"  NO-CHANGE {t}")

if __name__ == '__main__':
    main()
