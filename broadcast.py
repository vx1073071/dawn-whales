"""Broadcast a completion message to the team file bridge."""
import json, sys, os
from datetime import datetime, timezone

BRIDGE = r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl'

def broadcast_complete(task_id: str, description: str, detail: str = '', files: list = None):
    tz = timezone.utc
    now = datetime.now(tz)
    msg = {
        'from': 'qclaw',
        'to': 'ALL',
        'type': 'BROADCAST',
        'msgId': f'qc-complete-{now.strftime("%Y%m%d-%H%M%S")}',
        'time': now.isoformat(),
        'text': f'✅ QClaw 完成 {task_id}',
        'task': task_id,
        'description': description,
        'detail': detail,
        'files': files or [],
        'status': 'complete'
    }
    line = json.dumps(msg, ensure_ascii=False)
    with open(BRIDGE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')
    print(f'Broadcast sent: {task_id}')

if __name__ == '__main__':
    # Read args: task_id description [detail]
    args = sys.argv[1:]
    if len(args) < 2:
        print('Usage: python broadcast.py <task_id> <description> [detail]')
        sys.exit(1)
    task_id = args[0]
    description = args[1]
    detail = args[2] if len(args) > 2 else ''
    broadcast_complete(task_id, description, detail)
