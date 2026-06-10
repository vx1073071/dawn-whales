#!/usr/bin/env python3
"""Fix stray {t('...')} in non-JSX contexts (arrays, expressions, etc.)
Only remove {} when {t( is NOT inside JSX (not between < and > at same nesting)"""
import re, glob

for fp in glob.glob('src/components/**/*.tsx', recursive=True):
    with open(fp, 'r', encoding='utf-8') as f:
        orig = f.read()
    
    lines = orig.split('\n')
    new_lines = []
    fixed = False
    
    for line in lines:
        # Only fix if line contains {t('...')} but is NOT in JSX
        # JSX lines have <...> tags; non-JSX are pure TS arrays/expressions
        if '{t(' in line and not re.search(r'<\w+', line):
            # This is non-JSX context — remove { } around t()
            # Pattern: {t('xxx')} -> t('xxx')
            # But only if the entire {t('...')} is a standalone expression
            new_line = re.sub(r'\{t\(([^)]*)\)\}', r't(\1)', line)
            if new_line != line:
                fixed = True
            new_lines.append(new_line)
        else:
            new_lines.append(line)
    
    if fixed:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f'Fixed: {fp}')
