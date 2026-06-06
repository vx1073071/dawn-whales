with open('tests/jvs-49-data-versioning.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix all run: (..._args: any[]) { -> run: (..._args: any[]) => {
fixed = 0
for i, l in enumerate(lines):
    if 'run: (..._args: any[]) {' in l:
        print(f'Fixing line {i+1}: {l.rstrip()[:80]}')
        lines[i] = l.replace('run: (..._args: any[]) {', 'run: (..._args: any[]) => {')
        fixed += 1

print(f'Fixed {fixed} occurrences')
with open('tests/jvs-49-data-versioning.test.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)