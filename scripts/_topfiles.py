import re, glob

files = glob.glob('src/components/**/*.tsx', recursive=True)
results = []
for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        hard = 0
        for line in fh.readlines():
            cn = re.findall(r'[\u4e00-\u9fff]', line)
            if not cn: continue
            s = line.strip()
            if not re.search(r"t\s*\(\s*['\"]", s) and not s.startswith('//') and not s.startswith('*') and not s.startswith('import'):
                hard += len(cn)
        if hard > 50:
            results.append((hard, f))

for h, f in sorted(results, key=lambda x: -x[0])[:25]:
    short = f.replace('src\\components\\', '').replace('\\', '/')
    print(f'{h:5d}  {short}')
