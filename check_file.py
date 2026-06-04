#!/usr/bin/env python3
import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('electron/main.ts', 'rb') as f:
    data = f.read()

print(f"File size: {len(data)} bytes")
print(f"Has BOM: {data[:3] == b'\\xef\\xbb\\xbf'}")

text = data.decode('utf-8', errors='replace')
matches = re.findall(r"ipcMain\.handle\('([^']+)'", text)
print(f"Total ipcMain.handle calls: {len(matches)}")

for m in sorted(set(matches)):
    print(f"  {m}")
