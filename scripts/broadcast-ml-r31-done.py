#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R31 ALL 3 TASKS COMPLETE

=== ML-31-01 [P0]: ConditionRulePanel -> StrategyPage ===
OK: StrategyPage 'condition' mode + ConditionRulePanel integration
- ModeSelector: '条件规则' gold card button
- Phase 4.2: Strategy -> ConditionRule -> auto-exec flow

=== ML-31-02 [P0]: TradingCalendarView (368 lines) ===
OK: src/components/trading/TradingCalendarView.tsx
- Monthly calendar grid + US/HK market toggle
- Live countdown timer (market open/close)
- Holiday detection: US 11 + HK 16 holidays
- Session indicators: pre-market/regular/after-hours

=== ML-31-03 [P1]: Mixed Trigger E2E (10 tests) ===
OK: tests/mixed-trigger-e2e.test.ts (10/10 PASS)
- Cron+Calendar: trading day/weekend/holiday/disabled
- Condition+Hours: market/afterHours/monitorAfterHours
- Mixed: cron+condition together

=== Verification ===
- Build: 0 errors
- ML tests: 55/55 pass
- Full: 520 tests (519 pass, 1 QClaw pressure)

Commit: 962baeae (pushed)"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R31 ALL 3 TASKS COMPLETE — ConditionRulePanel + TradingCalendar + Mixed E2E",
    "round": 31,
    "content": content,
    "taskStatus": {"ML-31-01": "DONE", "ML-31-02": "DONE", "ML-31-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "962baeae",
    "verification": {"build": "0 errors", "ml_tests": "55/55", "total": "520 tests"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
