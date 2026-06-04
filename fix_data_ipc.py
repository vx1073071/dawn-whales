#!/usr/bin/env python3
from pathlib import Path

fp = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc\data-ipc.ts')
data = fp.read_bytes()

# Rename the const declaration to avoid shadowing the parameter
old = b'  const orderRouter = new SmartOrderRouter();'
new = b'  const localOrderRouter = new SmartOrderRouter();'
count = data.count(old)
if count:
    data = data.replace(old, new)
    fp.write_bytes(data)
    print(f'Fixed {count} occurrence(s) of const orderRouter')
else:
    print('const orderRouter not found')
