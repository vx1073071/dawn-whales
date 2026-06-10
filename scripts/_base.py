import re,os
total=0
t_count=0
hard=0
for root,dirs,files in os.walk('src'):
    dirs[:]=[d for d in dirs if 'node_modules' not in d]
    for f in files:
        if f.endswith(('.tsx','.ts')):
            path=os.path.join(root,f)
            try:
                with open(path,encoding='utf-8') as fh:
                    s=fh.read()
            except:continue
            for ch in re.findall(r'[\u4e00-\u9fff]+',s):
                total+=len(ch)
                # find the line containing this chunk
                line=''
                for l in s.split('\n'):
                    if ch in l:
                        line=l
                        break
                if re.search(r"t\s*\(|//\s|^\s*\*|<!--",line):
                    t_count+=len(ch)
                else:
                    hard+=len(ch)
print(f"Total CN: {total}")
print(f"In t()/comments: {t_count}")
print(f"Hardcoded: {hard}")
print(f"To target 16000: {hard-16000}")
# top files
per_file={}
for root,dirs,files in os.walk('src'):
    dirs[:]=[d for d in dirs if 'node_modules' not in d]
    for f in files:
        if f.endswith(('.tsx','.ts')):
            path=os.path.join(root,f)
            try:
                with open(path,encoding='utf-8') as fh:
                    s=fh.read()
            except:continue
            hardc=0
            for ch in re.findall(r'[\u4e00-\u9fff]+',s):
                line=''
                for l in s.split('\n'):
                    if ch in l:
                        line=l
                        break
                if not re.search(r"t\s*\(|//\s|^\s*\*|<!--",line):
                    hardc+=len(ch)
            if hardc>50:
                per_file[f]=hardc
print("\nTop hardcoded files:")
for f,h in sorted(per_file.items(),key=lambda x:-x[1])[:15]:
    print(f"  {h:5}  {f}")
