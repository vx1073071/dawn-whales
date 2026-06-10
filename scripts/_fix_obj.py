import re,glob,os
for fp in glob.glob('src/**/*.tsx',recursive=True):
    with open(fp,'r',encoding='utf-8') as f: orig=f.read()
    fixed = re.sub(r'^(\s*\w+\s*:\s*)\{t\(', r'\1t(', orig, flags=re.MULTILINE)
    if fixed!=orig:
        with open(fp,'w',encoding='utf-8') as f: f.write(fixed)
        print(f'Fixed: {os.path.basename(fp)}')
