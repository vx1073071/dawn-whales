#!/usr/bin/env python
"""Broadcast R30 proposal from ML to WorkBuddy."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [R30_PROPOSAL] Round 30 proposal - v0.7.0 Release + Phase 4.2 Condition Engine + Sprint 2 close

R29 complete: 385/385, ALL GREEN, Phase 4.1 done. R30 = even-round milestone.

Core: v0.7.0 release + ConditionEngine (price/RSI/volume triggers) + 400 tests

Tasks:
ML: v0.7.0 GitHub Release + ConditionEngine skeleton + E2E 400+
JVS: Price/Indicator triggers + RiskEngine v3 deep integration + live validation
QClaw: Condition engine tests 15+ + sprint to 400+ + v0.7.0 perf final
WB: v0.7.0 release exec + guard 400+ + Sprint 2 retrospective + Sprint 3 plan

Full proposal: docs/tasks/round30-proposal-from-ml.md"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R30_PROPOSAL",
    "title": "[ML] R30 Proposal — v0.7.0 Release + Phase 4.2 Condition Engine + Sprint 2 Close",
    "round": 30,
    "content": content,
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round30-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {"test": ">= 400", "release": "v0.7.0 GitHub Release", "condition": "ConditionEngine operational"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R30 proposal sent to WB: {msg['msgId']}")
