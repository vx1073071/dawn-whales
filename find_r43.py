import json

with open('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'rb') as f:
    raw = f.read()

# Try utf-8, fall back to latin-1
try:
    text = raw.decode('utf-8')
except:
    text = raw.decode('latin-1')

lines = text.strip().split('\n')
print(f'Total lines: {len(lines)}')

# Find lines containing R43 or PM
for i, line in enumerate(reversed(lines)):
    line = line.strip()
    if not line:
        continue
    try:
        j = json.loads(line)
        content = j.get('content', '')
        sender = j.get('sender', '?')
        msgid = j.get('msgId', j.get('id', '?'))
        if sender in ['PM', 'WorkBuddy', 'wb'] or 'R43' in content or 'R42' in content:
            print(f'Line {len(lines)-1-i}: {sender} [{msgid}]')
            print(content[:800])
            print()
    except Exception as e:
        pass

# Also print last 3 lines raw
print('\n--- Last 3 raw lines ---')
for line in lines[-3:]:
    print(repr(line[:200]))