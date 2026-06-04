import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

data = Path(r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl').read_bytes().decode('utf-8-sig', errors='replace').replace('\r', '')

# Try to find individual JSON objects
# Remove BOM if present
data = data.lstrip('\ufeff')

# Try to parse the whole thing
print(f'Data length: {len(data)}')
print(f'First 200 chars: {repr(data[:200])}')

# Try splitting by }\n{ pattern
import re
# Find all JSON objects
matches = list(re.finditer(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', data))
print(f'Found {len(matches)} JSON objects by regex')

# Try JSON split
import io
decoder = json.JSONDecoder()
pos = 0
count = 0
while pos < len(data):
    data = data.lstrip()
    if not data:
        break
    try:
        obj, pos = decoder.raw_decode(data)
        print(f'Object {count}: pos={pos}, msgId={obj.get("msgId","?")}, sender={obj.get("sender","?")}')
        count += 1
        data = data[pos:]
    except json.JSONDecodeError as e:
        print(f'Error at pos {pos}: {e}')
        print(f'Data at error: {repr(data[:100])}')
        break
print(f'Total objects found: {count}')
