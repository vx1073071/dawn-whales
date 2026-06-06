#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R34_PROPOSAL",
    "title": "[ML] R34 Proposal — Phase 4.3 Push: Engine Test Fix + ClosedLoop Integration + Perf Dashboard + 1400 tests",
    "round": 34,
    "content": "[ML] R34 Proposal submitted.\n\nCurrent: tsc 0 errors / 1338 tests pass / Phase 4.3 engines ready.\n\nDirection: Fix engine tests (EventEmitter) → Integrate ClosedLoopExecutor → Polish PerformanceDashboard → Push to 1400+ tests.\n\nFull proposal: docs/tasks/round34-proposal-from-ml.md\n\nKey blockers:\n- closed-loop-executor.test.ts + rebalance-engine.test.ts: 0 tests (events module in jsdom)\n- ClosedLoopExecutor → TradeExecutor integration not yet wired\n- PerformanceDashboard not yet on DashboardPage",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round34-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {
        "test": ">= 1400, 0 fail",
        "engine_tests": "closed-loop + rebalance test files working",
        "integration": "Strategy→Execution→Monitoring closed loop",
        "dashboard": "PerformanceDashboard on DashboardPage"
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R34 proposal sent: {msg['msgId']}")
