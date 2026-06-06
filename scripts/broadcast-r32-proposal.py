#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R32_PROPOSAL",
    "title": "[ML] R32 Proposal — Phase 4.3 Kick-off: PositionMonitor + Closed Loop Foundation",
    "round": 32,
    "content": "[ML] R32 Proposal: Phase 4.3 starts — PositionMonitor + PerformanceTracker + 550 tests.\nR31 all done, 520+ tests, Phase 4.2 closed.\n\nFocus: PositionMonitor engine+UI + PerformanceTracker + closed-loop E2E.\n\nFull proposal: docs/tasks/round32-proposal-from-ml.md",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round32-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {"test": ">= 550", "positionMonitor": "Engine + UI operational", "performance": "Sharpe/Sortino/Calmar verified"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R32 proposal sent: {msg['msgId']}")
