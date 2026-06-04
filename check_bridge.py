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

dict_objs = [o for o in all_json if isinstance(o, dict)]
print(f'Total JSON dicts: {len(dict_objs)}')

# Show ALL dicts
for obj in dict_objs:
    mid = obj.get('msgId', '?')
    sender = obj.get('from', '?')
    to = obj.get('to', '?')
    typ = obj.get('type', '?')
    # Get ALL text content
    parts = []
    for key in ['text', 'description', 'task', 'content', 'message']:
        if key in obj and obj[key]:
            parts.append(str(obj[key]))
    text_val = ' | '.join(parts)
    print(f'\n=== [{mid}] from={sender} to={to} type={typ} ===')
    print(text_val)
