import re

with open('electron/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

handlers = re.findall(r"ipcMain\.handle\('([^']+)'", content)
handlers_sorted = sorted(set(handlers))

print("All IPC handlers in main.ts:")
print("=" * 60)

# Group by prefix
groups = {}
for h in handlers_sorted:
    prefix = h.split(':')[0]
    if prefix not in groups:
        groups[prefix] = []
    groups[prefix].append(h)

for prefix in sorted(groups.keys()):
    print(f"\n{prefix}: ({len(groups[prefix])})")
    for h in groups[prefix]:
        print(f"  - {h}")

print(f"\n{'=' * 60}")
print(f"Total unique handlers: {len(set(handlers))}")
print(f"Total handler registrations: {len(handlers)}")
