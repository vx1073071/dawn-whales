import re,os
total=0;t_cnt=0;hard=0;per_file={}
for root,dirs,files in os.walk('src'):
    dirs[:]=[d for d in dirs if 'node_modules' not in d]
    for f in files:
        if not f.endswith(('.tsx','.ts')): continue
        path=os.path.join(root,f)
        try:
            with open(path,encoding='utf-8') as fh: s=fh.read()
        except: continue
        hc=0
        for ch in re.findall(r'[\u4e00-\u9fff]+',s):
            total+=len(ch)
            line=''
            for l in s.split('\n'):
                if ch in l: line=l; break
            if re.search(r'\bt\s*\(',line) or line.strip().startswith('//') or line.strip().startswith('*') or '<!--' in line:
                t_cnt+=len(ch)
            else:
                hard+=len(ch); hc+=len(ch)
        if hc>50: per_file[f]=hc
print(f'Total CN: {total}')
print(f'In t()/comments: {t_cnt}')
print(f'Hardcoded: {hard}')
print(f'To target 14000: {hard-14000}')
print()
print('Top hardcoded files:')
for f,h in sorted(per_file.items(),key=lambda x:-x[1])[:15]:
    print(f'  {h:5}  {f}')
