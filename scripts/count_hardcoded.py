import re, glob

files = glob.glob('src/components/**/*.tsx', recursive=True) + glob.glob('src/components/**/*.ts', recursive=True)
total = 0
in_t = 0
in_comment = 0
hardcoded = 0

for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        for line in fh.readlines():
            cn_chars = re.findall(r'[\u4e00-\u9fff]', line)
            if not cn_chars:
                continue
            total += len(cn_chars)
            stripped = line.strip()
            if re.search(r"t\s*\(\s*['\"]", stripped):
                in_t += len(cn_chars)
            elif stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('import'):
                in_comment += len(cn_chars)
            else:
                hardcoded += len(cn_chars)

print(f'Total CN chars: {total}')
print(f'In t() calls: {in_t}')
print(f'In comments/imports: {in_comment}')
print(f'Hardcoded (needs replacement): {hardcoded}')
