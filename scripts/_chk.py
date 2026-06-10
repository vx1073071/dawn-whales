import re
with open('src/components/billing/core/HelpCenter.tsx','r',encoding='utf-8') as f:
    content=f.read()
cn_strings = set()
for m in re.finditer(r"""['"]([^'"]*[\u4e00-\u9fff][^'"]*)['"]""", content):
    cn_strings.add(m.group(0))
print(f'Unique CN strings: {len(cn_strings)}')
for s in sorted(cn_strings)[:25]:
    print(f'  {s[:120]}')
