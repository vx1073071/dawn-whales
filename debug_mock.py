with open('tests/jvs-49-data-versioning.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the prepare method and add debug logging
for i, l in enumerate(lines):
    if 'prepare(sql: string)' in l:
        print(f'prepare at line {i+1}: {l.rstrip()[:80]}')
        break

# Check if INSERT INTO is being matched
for i, l in enumerate(lines):
    if 'INSERT INTO' in l:
        print(f'INSERT at line {i+1}: {l.rstrip()[:80]}')

# Check ALL return statements
for i, l in enumerate(lines):
    if 'return {' in l and 'run:' in l:
        print(f'return with run at line {i+1}: {l.rstrip()[:100]}')