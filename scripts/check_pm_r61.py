import json

with open(r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl', 'r', encoding='utf-8', errors='replace') as f:
    lines = f.readlines()

msgs = [json.loads(l) for l in lines[-100:] if l.strip()]
pm61 = [m for m in msgs if m.get('from') == 'PM' and m.get('round') == 61]

print(f"PM R61 messages: {len(pm61)}")
for m in pm61:
    tp = m.get('type', '?')
    part = m.get('part', '')
    title = m.get('title', '')[:80]
    content = m.get('content', '')
    if isinstance(content, dict):
        content = json.dumps(content, ensure_ascii=False)
    print(f"\n{'='*60}")
    print(f"TYPE: {tp} | PART: {part}")
    print(f"TITLE: {title}")
    print(f"CONTENT (first 600 chars):")
    print(str(content)[:600])
