import json

with open(r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl', 'r', encoding='gbk', errors='replace') as f:
    lines = f.readlines()
    for line in lines[-30:]:
        if 'R41' in line and ('PROPOSAL' in line or 'FINAL' in line or 'plan' in line.lower()):
            try:
                msg = json.loads(line)
                print('FROM:', msg.get('from', '?'))
                print('TYPE:', msg.get('type', '?'))
                print('TITLE:', msg.get('title', '?'))
                c = msg.get('content', '')
                if c:
                    print(c[:600])
                print('=' * 60)
            except Exception as e:
                print('PARSE ERROR:', e)
                print(line[:300])
                print('=' * 60)
