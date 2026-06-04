import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

data = Path(r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl').read_bytes()
decoder = json.JSONDecoder()
data2 = data.decode('utf-8-sig', errors='replace')
pos = 0
all_json = []
while pos < len(data2):
    data2 = data2.lstrip()
    if not data2:
        break
    try:
        obj, end = decoder.raw_decode(data2)
        all_json.append(obj)
        pos += end
        data2 = data2[end:]
    except json.JSONDecodeError:
        pos += 1
        data2 = data2[1:]

# Filter for dicts
dict_objs = [o for o in all_json if isinstance(o, dict)]
print(f'Total JSON dicts: {len(dict_objs)}')

# Show all dicts from the last 20
print('\n--- All dicts (last 20) ---')
for obj in dict_objs[-20:]:
    mid = obj.get('msgId', '?')
    sender = obj.get('from', '?')
    to = obj.get('to', '?')
    typ = obj.get('type', '?')
    text_val = obj.get('text') or obj.get('description') or obj.get('task') or ''
    print(f'[{mid}] from={sender} to={to} type={typ}')
    if text_val:
        print(f'  text: {str(text_val)[:150]}')
