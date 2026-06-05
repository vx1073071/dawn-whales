content = open('dist-electron/main.cjs', 'r', encoding='utf-8-sig').read()
lines = content.split('\n')
for i in range(36, 45):
    print(f'L{i+1}: {lines[i]}')