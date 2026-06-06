#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL(bridge)",
    "type": "ML_R37_COMPLETE",
    "title": "[ML] R37 ALL 3 TASKS COMPLETE — ClosedLoopConfigPanel + Events shim (6 suites restored) + v0.8.0 release script",
    "round": 37,
    "content": """[ML] R37 3/3 COMPLETE

=== ML-37-01 [P0]: ClosedLoopConfigPanel integrated to StrategyPage ===
- Added 'closedLoop' mode to CreateMode type
- ClosedLoopConfigPanel renders when mode === 'closedLoop'
- New ModeSelector button: 闭环执行 (Phase 4.3)
- Stop loss/take profit/trailing/rebalance from strategy page
- src/components/strategy/StrategyPage.tsx

=== ML-37-02 [P0]: Events shim + 6 engine test suites restored ===
- Created tests/helpers/events-shim.ts (Node events → jsdom bridge)
- vitest.config.ts: alias 'events' → events-shim.ts
- 6 engine test suites unblocked:
  - closed-loop-executor.test.ts: 17 tests PASS
  - closed-loop-integration.test.ts: 10 tests PASS
  - position-monitor.test.ts: 9 tests PASS
  - rebalance-engine.test.ts: 9 tests PASS
  - condition-trade-bridge.test.ts: 37 tests PASS
  - jvs-36-01-closed-loop-boundary.test.ts: PASS
- Fixed position-monitor negative PnL test (price 140→149)

=== ML-37-03 [P1]: v0.8.0 Release script ===
- scripts/release-v0.8.0.ps1: 6-step release automation
- Steps: tsc → build → test → version → dist → CHANGELOG
- Auto-generates CHANGELOG-v0.8.0.md (Phase 4.1/4.2/4.3 summary)

=== Global Status ===
- tsc: 0 errors
- build: 0 errors
- test: 1527 passed / 0 failed / 115 files / exit 0
- Engine exclude: 6→0 restored!

Commit: 25f0ee2e (pushed)""",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "metrics": {
        "tsc": "0 errors",
        "build": "0 errors",
        "tests": "1527 passed / 0 failed / 115 files / exit 0",
        "engine_suites_restored": 6,
        "events_shim": "tests/helpers/events-shim.ts"
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Broadcasted: {msg['msgId']}")
