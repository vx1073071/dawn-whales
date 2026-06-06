#!/usr/bin/env python
"""Broadcast ML R28 completion to bridge."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R28 ALL 3 TASKS COMPLETE

=== ML-28-01 [P0]: v0.7.0 Release ===
OK: package.json: 0.6.0 -> 0.7.0
OK: CHANGELOG.md: v0.7.0 section (R26+R27+R28, Futu+Moomoo+IB)
OK: dist:win: DAWN WHALES Setup 0.7.0.exe (114 MB)
OK: npm run build: 0 errors

=== ML-28-02 [P0]: Full Pipeline E2E Tests (16 tests) ===
OK: tests/e2e-full-pipeline-multi-broker.test.ts (16/16 PASS)
- NL Parse -> Strategy -> Signal (5 tests)
- Risk Checks (4): position limit, blacklist, unknown broker
- Multi-Broker Parallel (3): Futu+Moomoo, 3 brokers, asset aggregation
- Strategy Lifecycle (2): start/stop, multi-signal
- Error Handling (2): empty input, partial input
Pipeline: NLParser->StrategyEngine->OrderRouter->RiskEngine->Broker
Total ML E2E: 29 tests (13+16), all pass

=== ML-28-03 [P1]: README + Quickstart Guide ===
OK: README.md: v0.7.0 link + multi-broker + stats
OK: docs/guides/quickstart.md: 5-step first trade guide
- Multi-Broker Architecture diagram (ASCII)
- Key Concepts (Strategies/Brokers/Risk Management)

=== Verification ===
- npm run build: 0 errors
- dist:win: v0.7.0.exe (114 MB)
- ML tests: 29/29 passed
- Full suite: 355 tests

Commit: b8dc7537 (pushed)
All ML tasks done. Waiting for JVS/QClaw/WB for R28 sign-off."""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R28 ALL 3 TASKS COMPLETE — v0.7.0 + Full Pipeline E2E + Docs",
    "round": 28,
    "content": content,
    "taskStatus": {"ML-28-01": "DONE", "ML-28-02": "DONE", "ML-28-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "b8dc7537",
    "verification": {
        "build": "0 errors",
        "dist:win": "DAWN WHALES Setup 0.7.0.exe (114 MB)",
        "ml_tests": "29/29 pass",
        "full_suite": "355 tests"
    }
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
