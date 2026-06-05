import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

# Add export {} at the very beginning
if not data.startswith(b'export {};'):
    data = b'export {};\n' + data
    print('Added export {}; at top')
else:
    print('export {}; already present')

# Also remove duplicate prefs at line 174 (second prefs declaration)
# Find the second prefs declaration and remove it
idx1 = data.find(b'prefs?:')
if idx1 >= 0:
    idx2 = data.find(b'prefs?:', idx1 + 10)
    if idx2 >= 0:
        # Remove the second prefs block (from line before to closing };)
        # Find the end of the second prefs block
        end_idx = data.find(b'      };', idx2)
        if end_idx >= 0:
            end_idx += len(b'      };')
            # Remove from just before prefs to after };
            # Find the start of the line containing the second prefs
            line_start = data.rfind(b'\n', 0, idx2) + 1
            data = data[:line_start] + data[end_idx:]
            print(f'Removed duplicate prefs block at byte {idx2}')

# Count braces
opens = data.count(b'{')
closes = data.count(b'}')
print(f'Braces: open={opens}, close={closes}, diff={opens-closes}')

# If diff > 0, add missing close braces
while data.count(b'{') > data.count(b'}'):
    data = data.rstrip() + b'\n}\n'
    print('Added missing }')

with open('src/lib/bridge-api.ts', 'wb') as f:
    f.write(data)
print('Saved')
