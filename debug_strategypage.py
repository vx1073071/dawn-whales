#!/usr/bin/env python3
d = open(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\src\components\strategy\StrategyPage.tsx', 'rb').read()
lines = d.split(b'\n')
print(f'Total lines: {len(lines)}')

# Find component start
for i, l in enumerate(lines):
    if b'export default function StrategyPage' in l or (b'function StrategyPage' in l and b'{' in l):
        print(f'Component at L{i+1}: {repr(l[:80])}')
        break

# Check for obvious JSX issues near line 556
# Look for unclosed tags or mismatched braces
# Check if there's a multi-line string or template that ends incorrectly
# Scan lines 500-560 for suspicious patterns
for i in range(495, 560):
    ln = lines[i].decode('utf-8', errors='replace')
    if '{' in ln or '}' in ln or '<Div' in ln or '</Div' in ln:
        print(f'L{i+1}: {ln[:120]}')
