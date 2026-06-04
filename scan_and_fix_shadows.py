#!/usr/bin/env python3
"""Fix duplicate parameter/const declarations in T7 auto-generated IPC files.

Problem: export function registerXxxIPC(
    param1: any,
    param2: any,
  ) {        ← closing ) on its own line
    const param1 = new Class();  // shadows the parameter!
"""
import re
from pathlib import Path

ROOT = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc')

for fp in sorted(ROOT.glob('*.ts')):
    raw = fp.read_bytes().decode('utf-8', errors='replace')
    text = raw.replace('\r\n', '\n').replace('\r', '\n')
    lines = text.split('\n')
    
    # Find function signature (may span multiple lines)
    sig_start = -1
    sig_end = -1
    all_params = ''
    for i, line in enumerate(lines):
        if 'export function register' in line and 'IPC' in line:
            sig_start = i
            # Find the closing paren
            j = i
            while j < len(lines) and ')' not in lines[j]:
                j += 1
            # Collect all param lines
            param_lines = []
            k = i
            while k <= j:
                param_lines.append(lines[k])
                if ')' in lines[k]:
                    break
                k += 1
            all_params = '\n'.join(param_lines)
            sig_end = j
            break
    
    if sig_start < 0:
        continue
    
    # Parse param names
    param_names = set()
    for m in re.finditer(r'(\w+)(?:\s*\?)?\s*(?::\s*[^,)]+)?', all_params):
        n = m.group(1)
        if (n and len(n) > 1 and 
            n not in ('any', 'string', 'number', 'boolean', 'void',
                      'true', 'false', 'null', 'undefined', 'any[]')):
            param_names.add(m.group(1))
    
    # Find local const declarations that shadow params
    fixes = []
    for i, line in enumerate(lines):
        if i == sig_start or i == sig_end:
            continue
        m = re.match(r'^(\s*)const (\w+)\s*=\s*new\s+(\w+)\(\)', line.rstrip())
        if m and m.group(2) in param_names:
            fixes.append((i, m.group(2), m.group(3)))
    
    if fixes:
        print(f"\n{fp.name}: params={sorted(param_names)}, clashes={[(l+1,n) for l,n,c in fixes]}")
        for i, name, cls_name in fixes:
            new_name = 'local' + cls_name
            old_line = lines[i].rstrip()
            new_line = re.sub(
                r'^(\s*)const \w+\s*=\s*new\s+',
                lambda m: m.group(1) + 'const ' + new_name + ' = new ',
                old_line
            )
            if new_line != old_line:
                lines[i] = new_line
                print(f"  L{i+1}: '{name}' -> '{new_name}'")
        
        result = '\n'.join(lines) + '\n'
        fp.write_bytes(result.encode('utf-8'))
        print(f"  [OK] Written")
