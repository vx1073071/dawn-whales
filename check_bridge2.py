import json, os

path = 'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl'
if not os.path.exists(path):
    print('No bridge file')
else:
    with open(path, 'rb') as f:
        raw = f.read()
    # Try to find valid JSON objects using a streaming approach
    depth = 0
    buf = bytearray()
    count = 0
    last_msg = None
    for b in raw:
        c = chr(b)
        buf.append(b)
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                try:
                    txt = buf.decode('utf-8')
                    obj = json.loads(txt)
                    count += 1
                    last_msg = obj
                    print(f"[{count}] {obj.get('msgId','?')} | {obj.get('from','?')} | {obj.get('type','?')} | {str(obj.get('content',''))[:80]}")
                except Exception as e:
                    pass
                buf = bytearray()
    print(f'\nTotal valid: {count}')
    if last_msg:
        print(f'Last: {last_msg.get("msgId","?")} from {last_msg.get("from","?")}')
