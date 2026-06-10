import re, glob
files = glob.glob('src/components/**/*.tsx', recursive=True)
total = 0
in_t = 0
hard = 0
for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        for line in fh.readlines():
            cn = re.findall(r'[\u4e00-\u9fff]', line)
            if not cn: continue
            total += len(cn)
            s = line.strip()
            if re.search(r"t\s*\(\s*['\"]", s) or s.startswith('//') or s.startswith('*') or s.startswith('import'):
                in_t += len(cn)
            else:
                hard += len(cn)
print(f"Total: {total}")
print(f"In t()/comments: {in_t}")
print(f"Hardcoded: {hard}")
print(f"Reduction from baseline (~22493): {22493 - hard}")
