import os, re, glob
from collections import Counter

files = glob.glob('src/components/**/*.tsx', recursive=True)
cn_strings = Counter()
for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        content = fh.read()
    # Chinese in JSX text between tags
    matches = re.findall(r'>([^<]*[\u4e00-\u9fff][^<]*)<', content)
    for m in matches:
        m = m.strip()
        if len(m) > 2:
            cn_strings[m[:80]] += 1
    # Chinese in single-quoted strings
    for m in re.finditer(r"'([^']*[\u4e00-\u9fff][^']*)'", content):
        s = m.group(1).strip()
        if len(s) > 2:
            cn_strings[s[:80]] += 1
    # Chinese in double-quoted strings (skip paths/classes)
    for m in re.finditer(r'"([^"]*[\u4e00-\u9fff][^"]*)"', content):
        s = m.group(1).strip()
        if len(s) > 2 and not s.startswith('/') and not s.startswith('#') and not s.startswith('.'):
            cn_strings[s[:80]] += 1

print(f'Unique CN strings: {len(cn_strings)}')
for s, cnt in cn_strings.most_common(50):
    print(f'  [{cnt}] {s[:70]}')
