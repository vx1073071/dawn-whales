#!/usr/bin/env python3
"""
R90 Q-01: Fix tests broken by JVS engine dir restructure (flat->subdirs).
Replaces flat readdirSync with recursive counting/finding.
"""
import os
import re
import sys

TESTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'tests')

# The recursive walk snippet to inject
RECURSIVE_WALK = '''      let count = 0;
      const walk = (d: string) => {
        try {
          for (const f of fs.readdirSync(d, { withFileTypes: true })) {
            if (f.isDirectory()) walk(path.join(d, f.name));
            else if (f.name.endsWith('.ts') && f.name !== 'index.ts' && !f.name.endsWith('.test.ts') && !f.name.endsWith('.d.ts')) count++;
          }
        } catch (_e) { /* ignore */ }
      };
      walk(engineDir);'''

# Pattern: const count = fs.readdirSync(engineDir).filter(f => f.endsWith('.ts')).length;
FLAT_COUNT_PATTERN = re.compile(
    r'const count = fs\.readdirSync\(engineDir\)\.filter\(f => f\.endsWith\(\'\.ts\'\)\)\.length;'
)

def fix_file(filepath):
    """Fix a single test file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    changes = []
    
    # Fix 1: Flat engine count -> recursive
    if "readdirSync(engineDir).filter(f => f.endsWith('.ts')).length" in content:
        content = FLAT_COUNT_PATTERN.sub(RECURSIVE_WALK, content)
        changes.append("flat_count->recursive")
    
    # Fix 2: flat readdirSync for engine dir with named variable
    # Pattern: const engineFiles = fs.readdirSync(someEngineDir)
    if re.search(r'readdirSync\([^)]*engine[^)]*\)\.filter\([^)]*\.endsWith\([^)]*\.ts', content):
        # More general pattern
        content = re.sub(
            r'const (\w+) = fs\.readdirSync\(([^)]*[Ee]ngine[^)]*)\)\.filter\(f => f\.endsWith\(\'\.ts\'\)\)(?:\.length)?;',
            lambda m: f'let {m.group(1)}: string[] = [];\n'
                      f'      const _walk = (d: string) => {{\n'
                      f'        try {{\n'
                      f'          for (const f of fs.readdirSync(d, {{ withFileTypes: true }})) {{\n'
                      f'            if (f.isDirectory()) _walk(path.join(d, f.name));\n'
                      f'            else if (f.name.endsWith(\'.ts\') && f.name !== \'index.ts\') {m.group(1)}.push(f.name);\n'
                      f'          }}\n'
                      f'        }} catch (_e) {{ /* ignore */ }}\n'
                      f'      }};\n'
                      f'      _walk({m.group(2)});',
            content
        )
        if "walk" in content and changes and changes[-1] != "flat_count->recursive":
            changes.append("flat_list->recursive")
    
    # Fix 3: Specific engine file existence checks
    # Pattern: fs.existsSync(path.join(engineDir, 'some-file.ts'))
    # These might fail because files moved to subdirs. Replace with recursive check.
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes
    return []

def main():
    # Process all test files that might have engine dir references
    test_files = [f for f in os.listdir(TESTS_DIR) if f.endswith('.test.ts')]
    
    fixed_count = 0
    for tf in test_files:
        filepath = os.path.join(TESTS_DIR, tf)
        changes = fix_file(filepath)
        if changes:
            print(f"  FIXED {tf}: {', '.join(changes)}")
            fixed_count += 1
    
    print(f"\nTotal fixed: {fixed_count} files")

if __name__ == '__main__':
    main()
