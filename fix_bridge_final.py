import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

# The declare global block at line 3 is missing its closing brace.
# After '  }' (Window close) and '}' (supposed declare global close), depth is still 1.
# We need to add an extra '}' after the existing closing sequence.

# Find the pattern: the end of the declare global block
# Original:     };\r\n  }\r\n}\r\n\r\nfunction hasIPC
# Should be:    };\r\n  }\r\n}\r\n\r\nfunction hasIPC
# The issue: there should be TWO '}' after '};', not one.

# Look for '  }\r\n}\r\n' (Window close, then supposed declare global close)
pattern = b'  }\r\n}\r\n\r\nfunction hasIPC'
replacement = b'  }\r\n}\r\n\r\nfunction hasIPC'

# Actually the pattern might be: '    };\r\n  }\r\n}\r\n'
# We need to add a '}\r\n' after the existing '}'
# The existing structure is:
#   };\r\n  <- api close (4 spaces)
#   }\r\n   <- Window close (2 spaces)
#   }\r\n   <- THIS SHOULD BE declare global close (0 spaces) - but it seems to be missing
# Wait, looking at the depth trace, after '}' on the last line depth is 1.
# So the '}' is closing Window (2->1), not declare global.
# We need ANOTHER '}' at 0 indent to close declare global (1->0).

# Find the sequence and add the missing }
old = b'  }\r\n}\r\n\r\nfunction hasIPC'
new = b'  }\r\n}\r\n\r\nfunction hasIPC'

# Actually, let me count the braces in the first 190 lines
lines = data.split(b'\r\n')
depth = 0
for i, line in enumerate(lines[:200]):
    for c in line:
        if c == ord('{'):
            depth += 1
        elif c == ord('}'):
            depth -= 1
    if i >= 185 and i <= 195:
        print(f'  After line {i+1}: depth={depth}')

print(f'Depth after 200 lines: {depth}')

# The fix: add '}' on its own line after the current close sequence
# Find the exact location to insert
idx = data.find(b'\r\n\r\nfunction hasIPC')
if idx >= 0:
    # Insert '}\r\n' before the empty line
    data = data[:idx] + b'\r\n}\r\n' + data[idx:]
    print(f'Inserted closing brace at byte {idx}')
else:
    print('Pattern not found!')

# Verify
lines2 = data.split(b'\r\n')
depth = 0
for i, line in enumerate(lines2[:200]):
    for c in line:
        if c == ord('{'):
            depth += 1
        elif c == ord('}'):
            depth -= 1
    if i >= 188 and i <= 196:
        print(f'  After line {i+1}: depth={depth}')

opens = data.count(b'{')
closes = data.count(b'}')
print(f'Braces: open={opens}, close={closes}, diff={opens-closes}')

with open('src/lib/bridge-api.ts', 'wb') as f:
    f.write(data)
print('Saved')
