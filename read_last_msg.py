import json

with open('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', 'rb') as f:
    raw = f.read()

# Try utf-8, fall back to latin-1
try:
    text = raw.decode('utf-8')
except:
    text = raw.decode('latin-1')

lines = text.strip().split('\n')
# Find lines containing R43
for line in reversed(lines):
    line = line.strip()
    if not line:
        continue
    try:
        j = json.loads(line)
        content = j.get('content', '')
        sender = j.get('sender', '?')
        msgid = j.get('msgId', j.get('id', '?'))
        # Look for R43 or PM content
        if 'R43' in content or 'Phase' in content or sender in ['PM', 'WorkBuddy']:
            print(f'=== {sender} [{msgid}] ===')
            print(content[:1500])
            print()
    except Exception as e:
        pass