import re

# Extract preload handlers
with open(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\preload.ts', 'r', encoding='utf-8-sig') as f:
    preload = f.read()

preload_handlers = re.findall(r"ipcRenderer\.invoke\(['\"]([^'\"]+)['\"]", preload)
preload_handlers = sorted(set(preload_handlers))

# Extract main.ts handlers
with open(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\main.ts', 'r', encoding='utf-8-sig') as f:
    main = f.read()

main_handlers = set(re.findall(r"ipcMain\.handle\(['\"]([^'\"]+)['\"]", main))

# Also check registerMonteCarloIPC
missing = [h for h in preload_handlers if h not in main_handlers]

print(f'Preload handlers: {len(preload_handlers)}')
print(f'Main.ts handlers: {len(main_handlers)}')
print(f'Missing in main.ts: {len(missing)}')
print()
for h in missing:
    print(f'  MISSING: {h}')