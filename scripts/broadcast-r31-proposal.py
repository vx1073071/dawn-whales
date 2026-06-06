#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R31_PROPOSAL",
    "title": "[ML] R31 Proposal — Sprint 3 Kick-off: Quality First (500 tests + Performance + Docs)",
    "round": 31,
    "content": "[ML] R31 Proposal: Sprint 3 launches — quality over features.\n487 tests, v0.7.0 released, Sprint 2 done.\n\nFocus: Test stability 500+, Performance benchmark, Architecture docs, Code audit.\n\nFull proposal: docs/tasks/round31-proposal-from-ml.md",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round31-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {"test": ">= 500", "perf": "v0.7.0 benchmark", "docs": "Architecture doc complete"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R31 proposal sent: {msg['msgId']}")
