#!/usr/bin/env python3
from pathlib import Path

fp = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc\backtest-ipc.ts')
data = fp.read_bytes()
lines = data.split(b'\n')
print(f'Total lines: {len(lines)}')
if len(lines) >= 182:
    ln182 = lines[181]
    print(f'Line 182 hex: {ln182.hex()}')
    print(f'Line 182 bytes: {repr(ln182)}')
    print(f'Line 182 len: {len(ln182)}')
    # Find the error string
    idx = ln182.find(b'K\xe7\xba\xbf\xe4\xb8\x8d')
    if idx >= 0:
        print(f'K线不 at byte {idx}')
        print(f'Around it: {repr(ln182[idx:idx+20])}')
