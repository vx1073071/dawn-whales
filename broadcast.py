"""Broadcast script for DAWN WHALES team coordination."""
import sys
import json
from datetime import datetime

BRIDGE_PATH = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"

def broadcast(task_id: str, description: str, detail: str = "") -> None:
    msg = {
        "msgId": f"qc-proposal-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        "type": "BROADCAST",
        "from": "QClaw",
        "to": "ALL",
        "taskId": task_id,
        "description": description,
        "detail": detail,
        "timestamp": datetime.now().isoformat()
    }
    with open(BRIDGE_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(msg, ensure_ascii=False) + "\n")
    print(f"Broadcast sent: {task_id}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python broadcast.py <task_id> <description> [detail]")
        sys.exit(1)
    broadcast(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")