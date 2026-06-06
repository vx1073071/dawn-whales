#!/usr/bin/env python
"""Broadcast ML R27 completion to bridge."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R27 ALL 3 TASKS COMPLETE

=== ML-27-01 [P0]: BrokerSelector + AccountSummary integration ===
OK: Sidebar.tsx - AccountSummary replaces single-broker card
OK: Header.tsx - BrokerSelector already integrated (JVS R26)
OK: DashboardPage.tsx - BrokerStatusBar in compact mode

=== ML-27-02 [P0]: Multi-Broker E2E tests (13 tests) ===
OK: tests/e2e-multi-broker.test.ts (13/13 PASS)
- Broker Connection: connect Futu, connect Moomoo, switch disconnects prev
- Funds & Positions: correct funds/positions per broker
- Asset Aggregation: cross-broker total assets = 19,090,000
- Order Routing: BUY→Futu, SELL→Moomoo, unknown broker, isolation

=== ML-27-03 [P1]: DashboardPage multi-broker enhancement ===
OK: BrokerStatusBar in Dashboard header (compact mode)

=== Verification ===
- npm run build: 0 errors
- tests/e2e-multi-broker.test.ts: 13/13 passed
- Total suite: 259 tests (249 pass), 10 failures from QClaw code

BLOCKER NOTE: QClaw has 10 test failures across 3 files:
- nl-parser.test.ts (4 fail) - Q-27-01
- strategy-engine.test.ts (4 fail) - Q-27-02
- multi-broker-ipc.test.ts (2 fail) - Q-27-03
These block npm test exit 0. QClaw needs to fix.

Commit: df72a9de (pushed to feature/strategy-optimize)
All ML tasks done. Waiting for QClaw fixes for R27 sign-off."""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R27 ALL 3 TASKS COMPLETE - Integration + E2E + Dashboard",
    "round": 27,
    "content": content,
    "taskStatus": {"ML-27-01": "DONE", "ML-27-02": "DONE", "ML-27-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "df72a9de",
    "verification": {
        "build": "0 errors",
        "my_tests": "13/13 pass",
        "total": "249/259 pass (10 QClaw failures)"
    },
    "blockers": [
        "QClaw nl-parser.test.ts 4 fail",
        "QClaw strategy-engine.test.ts 4 fail",
        "QClaw multi-broker-ipc.test.ts 2 fail"
    ]
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
