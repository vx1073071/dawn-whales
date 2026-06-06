with open('tests/jvs-37-ipc-validation.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
print(f'Total: {len(lines)}')
for i, l in enumerate(lines):
    if 'describe' in l and 'JVS-37' in l:
        print(f'describe at line {i+1}: {l[:80].strip()}')
        break
count = sum(1 for l in lines if "  test('" in l)
print(f'Total test() calls: {count}')
for i, l in enumerate(lines):
    if '  test(' in l:
        print(f'test at {i+1}: {l[:80].strip()}')