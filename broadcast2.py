#!/usr/bin/env python3
"""Broadcast a message to the file bridge"""
import json, sys
from datetime import datetime

msgId = sys.argv[1] if len(sys.argv) > 1 else input("msgId: ")
content = sys.argv[2] if len(sys.argv) > 2 else input("content: ")
detail = sys.argv[3] if len(sys.argv) > 3 else ""

obj = {
    "msgId": msgId,
    "from": "qclaw",
    "to": "ALL",
    "type": "BROADCAST",
    "timestamp": datetime.now().isoformat(),
    "content": content,
}
if detail:
    obj["detail"] = detail

path = "C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl"
with open(path, "a", encoding="utf-8") as f:
    f.write(json.dumps(obj, ensure_ascii=False) + "\n")

print(f"Broadcast sent: {msgId}")
