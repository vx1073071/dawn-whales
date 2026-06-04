#!/usr/bin/env python3
from pathlib import Path

fp = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc\strategy-ipc.ts')
data = fp.read_bytes()
lines = data.split(b'\n')

# Find lines containing error messages related to K-line
for i, line in enumerate(lines):
    if b'K\xe7\xba\xbf' in line or 'K线'.encode('utf-8') in line:
        print(f'Line {i+1} (byte {i}): {repr(line)}')
        print(f'  hex: {line.hex()}')

# Also check around line 119 with CRLF split
print('\nChecking lines 117-122 with CRLF awareness:')
raw = fp.read_text(encoding='utf-8', errors='replace')
# Normalize and find the function
for i, line in enumerate(raw.split('\n')):
    if i >= 116 and i <= 122:
        print(f'Line {i+1}: {repr(line)}')
