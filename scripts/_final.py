import re, glob

files = glob.glob('src/components/**/*.tsx', recursive=True)
total = 0
in_t = 0
hard = 0
per_file = {}

for f in files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
        h = 0
        for line in fh.readlines():
            cn = re.findall(r'[\u4e00-\u9fff]', line)
            if not cn:
                continue
            total += len(cn)
            s = line.strip()
            if re.search(r"t\s*\(\s*['\"]", s) or s.startswith('//') or s.startswith('*') or s.startswith('import'):
                in_t += len(cn)
            else:
                hard += len(cn)
                h += len(cn)
        if h > 50:
            per_file[f] = h

def short(p):
    return p.replace('src\\components\\', '').replace('\\', '/')

print(f'Total: {total}')
print(f'i18n done: {in_t}')
print(f'Still hardcoded: {hard}')
print(f'\nTop remaining hardcoded files:')

for f_val, h_val in sorted(per_file.items(), key=lambda x: -x[1])[:20]:
    print(f'  {h_val:5d}  {short(f_val)}')
