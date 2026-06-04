#!/usr/bin/env python3
# Fix the corrupted Chinese text in strategy-ipc.ts
# Original: K线数据不足（需要至少50根），请确认 OpenD 已连接
# Corrupt:  K线数据不足（需要至?0根），请确认 OpenD 已接用
# The corruption: 用 (e794a8) should be 接 (e8bfa5)

fp = r'C:\Users\vx107\.easyclaw\workspace\dawn-whales\electron\ipc\strategy-ipc.ts'
d = open(fp, 'rb').read()

# Verify: e794a8 should decode to what?
try:
    print('e794a8 as UTF-8:', b'\xe7\x94\xa8'.decode('utf-8'))
except:
    print('e794a8 INVALID UTF-8')
    
# Check: e8bfa5
try:
    print('e8bfa5 as UTF-8:', b'\xe8\xbf\xa5'.decode('utf-8'))
except:
    print('e8bfa5 INVALID UTF-8')

# Check what e68ea5 decodes to (the actual file byte)
try:
    print('e68ea5 as UTF-8:', b'\xe6\x8e\xa5'.decode('utf-8'))
except:
    print('e68ea5 INVALID UTF-8')

# OK so I had the wrong byte for 接
# 接 (U+63A5) = e6 8e a5 = b'\xe6\x8e\xa5' = e68ea5 ✓
# 用 (U+7528) = e7 94 a8 = b'\xe7\x94\xa8' = e794a8 ✓
# So 用 = e794a8, 接 = e68ea5

# File has: e5b7b2 e8bf9e e68ea5 = 已 + 连(?) + 接 = 已连接
# But e8bf9e = ? Let me verify
try:
    print('e8bf9e as UTF-8:', b'\xe8\xbf\x9e'.decode('utf-8'))
except:
    print('e8bf9e INVALID UTF-8')

# Wait, 接 = e68ea5 and 用 = e794a8
# File: 已 (e5b7b2) + e8bf9e + 用 (e68ea5) 
# If e8bf9e = ?, then: 已 + ? + 接
# But that doesn't match any common phrase

# CORRECTION: 接 (U+63A5) = e6 8e a5
# The file hex shows: e8bf9ee68ea5
# = e8bf9e + e68ea5
# If 接 = e68ea5, then: 连(?) + 接 = ?
# But 连 (U+8FDE) = e8 8f be, NOT e8bf9e!

# Let me re-examine: the file ends with 'e5b7b2e8bf9ee68ea5'
# e5b7b2 = 已
# e8bf9e = ? 
# e68ea5 = 接
# So: 已 + ? + 接 = ?

# Let's find out what e8bf9e is
try:
    c = b'\xe8\xbf\x9e'.decode('utf-8')
    print(f'e8bf9e = {c} (U+{ord(c):04X})')
except:
    print('e8bf9e INVALID')

# OK I think the file actually has 连 (e8bf9e) and 接 (e68ea5)
# But 接 is e68ea5 = U+63A5 = 接 ✓
# And 连 is e8bf9e = U+8FDE = 连 ✓
# So: 已 + 连 + 接 = 已连接 ✓
# Wait, then the file IS correct?! 

# Let me check the WHOLE string again
idx = d.find(b'K\xe7\xba\xbf\xe6\x95\xb0\xe6\x8d\xae\xe4\xb8\x8d\xe8\xb6\xb3')
segment = d[idx:idx+120]
# Find the ' 接' position
接_pos = segment.find(b'\xe6\x8e\xa5')
print(f'接 at offset from K: {接_pos}')

# And the 用 position
用_pos = segment.find(b'\xe7\x94\xa8')
print(f'用 at offset from K: {用_pos}')

# Actually let me just find all Chinese chars in the segment
import re
for m in re.finditer(b'[\xe4-\xe9][\x80-\xbf][\x80-\xbf]', segment):
    try:
        c = m.group(0).decode('utf-8')
        print(f'  byte {m.start()}: {c!r} (U+{ord(c):04X}) = {m.group(0).hex()}')
    except:
        print(f'  byte {m.start()}: INVALID: {m.group(0).hex()}')
