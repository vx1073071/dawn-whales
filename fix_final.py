import sys
sys.stdout.reconfigure(encoding='utf-8')

# Fix TradingDeskPage.tsx - remove trailing garbage lines
with open('src/components/orders/TradingDeskPage.tsx', 'rb') as f:
    data = f.read()

# Remove trailing "iv>\r\n  );\r\n}" 
if data.endswith(b'iv>\r\n  );\r\n}'):
    data = data[:-len(b'iv>\r\n  );\r\n}')]
    print('Removed trailing garbage from TradingDeskPage.tsx')
elif data.endswith(b'iv>\n  );\n}'):
    data = data[:-len(b'iv>\n  );\n}')]
    print('Removed trailing garbage from TradingDeskPage.tsx (LF)')
else:
    print('Could not find trailing garbage pattern')
    # Show last 30 bytes
    print(f'Last 30 bytes: {repr(data[-30:])}')

with open('src/components/orders/TradingDeskPage.tsx', 'wb') as f:
    f.write(data)

# Fix bridge-api.ts - add missing closing brace
with open('src/lib/bridge-api.ts', 'rb') as f:
    data = f.read()

# Count braces
opens = data.count(b'{')
closes = data.count(b'}')
print(f'bridge-api.ts braces: open={opens}, close={closes}, diff={opens-closes}')

if opens > closes:
    # Add missing closing brace at end
    if not data.endswith(b'\n'):
        data += b'\n'
    data += b'}\n'
    print('Added missing closing brace to bridge-api.ts')

with open('src/lib/bridge-api.ts', 'wb') as f:
    f.write(data)

print('Done')
