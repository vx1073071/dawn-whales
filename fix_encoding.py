#!/usr/bin/env python3
from pathlib import Path

fp = Path(r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc\alert-notification-ipc.ts')
data = fp.read_bytes()
lines = data.split(b'\n')

ln = lines[115]
target = '暂无活跃警报'.encode('utf-8')
target_hex = target.hex()
hex_str = ln.hex()
idx = hex_str.find(target_hex)
byte_pos = idx // 2

# Everything from after target up to (and including) the replacement char + '? '
# is: efbfbd(replacement) 3f(?) 20(space) 7d(}) 3b(;)
# We want: space + } + ;
# So strip: efbfbd3f
new_line = ln[:byte_pos + len(target)] + b' };'

lines[115] = new_line
data = b'\n'.join(lines)
fp.write_bytes(data)
print('Fixed! New line:', new_line.decode('latin-1'))
