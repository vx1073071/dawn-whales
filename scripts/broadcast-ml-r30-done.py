#!/usr/bin/env python
"""Broadcast ML R30 completion to bridge."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R30 ALL 3 TASKS COMPLETE

=== ML-30-01 [P0]: v0.7.0 Release Prep ===
OK: README, Landing Page, version all at v0.7.0
- Release ready: PM WB-30-01 to execute gh release + upload .exe

=== ML-30-02 [P0]: ConditionWatcher (Phase 4.2 Core) ===
OK: electron/engine/condition-watcher.ts (339 lines)
- PriceCondition: > < >= <= == crosses_above/below (with history tracking)
- IndicatorCondition: RSI/MA/VOLUME with period params
- CompositeCondition: AND/OR nested logic
- Rule management: enabled/cooldown/maxDailyTriggers/dailyReset
- Action types: execute_strategy/pause_strategy/send_alert/compound
- main.ts: WS quote feed -> ConditionWatcher.processQuote
- IPC: addRule/removeRule/setEnabled/listRules/getRule/resetDaily

=== ML-30-03 [P1]: ConditionWatcher E2E (16 tests) ===
OK: tests/condition-watcher.test.ts (16/16 PASS)
- Price: above/below/crosses_above/crosses_below/wildcard/>=/<=
- Indicators: RSI/MA evaluation + history tracking
- Composite: AND/OR logic verified
- Rule management: disable/maxDaily/cooldown

=== Verification ===
- npm run build: 0 errors, 0 warnings
- ML tests: 45/45 pass
- Full suite: 463 tests

Commit: 5e054959 (pushed)
All ML tasks done. Release pending PM execution."""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R30 ALL 3 TASKS COMPLETE - ConditionWatcher + E2E + v0.7.0 Ready",
    "round": 30,
    "content": content,
    "taskStatus": {"ML-30-01": "DONE", "ML-30-02": "DONE", "ML-30-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "5e054959",
    "verification": {"build": "0 errors", "ml_tests": "45/45 pass", "full_suite": "463 tests"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
