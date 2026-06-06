import json
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

with open('C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

# Get last 10 messages
for line in lines[-10:]:
    if line.strip():
        msg = json.loads(line)
        ts = msg.get('timestamp', '?')
        frm = msg.get('from', '?')
        to = msg.get('to', '?')
        mtype = msg.get('type', '?')
        title = msg.get('title', msg.get('msgId', '?'))[:80]
        print(f"{ts} | {frm} -> {to} | {mtype} | {title}")
