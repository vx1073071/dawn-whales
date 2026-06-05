#!/usr/bin/env python
"""Broadcast R26 final plan to bridge."""
import json
import uuid
from datetime import datetime, timezone, timedelta

plan = """[ML] [R26_FINAL_PLAN] Final plan confirmed - 4 shrimp assignments below
[PM] Sprint 1 close-out + Sprint 2 Phase 3 kick-off

## Project State (R25 done)
OK: 129/129 tests | v0.6.0.exe | Logo+tray fixed | TradeDashboard IPC | Perf baseline

## Outdated tasks REMOVED (done in R24-R25)
- TradeExecutor 16 fails -> fixed in R24 (0 fail now)
- Performance baseline -> done in R25 (baseline-q25-02.md)
- v0.7.0 packaging -> deferred (v0.6.0 stable, no major feature changes)

## ML (3 tasks)
ML-26-01 [P0]: v0.6.0 Installer Verification + Checklist
- Verify install flow (clean install -> launch -> no crash)
- Confirm build/icon.png + tray icon (already fixed, re-confirm)
- Output: docs/demo/r26-installer-checklist.md

ML-26-02 [P1]: CHANGELOG + Sprint 1 Retrospective
- Update CHANGELOG.md with R26 entries
- Write Sprint 1 summary: docs/sprints/sprint1-retrospective.md
  (module list, test coverage, known limits, Sprint 2 priorities)

ML-26-03 [P1]: Demo Script
- Write docs/demo/r26-demo-script.md (10 scenes, <1 min each)

## JVS (3 tasks)
J-26-01 [P0]: Moomoo Adapter Real TCP
- Real Moomoo OpenD TCP connection on existing skeleton
- getAccounts/getFunds/getPositions/getQuotes/placeOrder/cancelOrder
- subscribeAndPush real-time push
- Keep mockMode boolean for test switching

J-26-02 [P1]: BrokerSelector Component
- New: src/components/trading/BrokerSelector.tsx (dropdown + status indicator)
- Route: /broker or Settings Tab

J-26-03 [P1]: Account Asset Aggregation
- Cross-broker aggregation in PortfolioPage/Sidebar
- broker:getAllFunds + broker:getAllPositions

## QClaw (3 tasks)
Q-26-01 [P0]: RiskEngine v2 Scenario Validation Doc
- 5 scenarios: short loss/margin call/ATR with drawdown/Kelly downgrade/blacklist
- Output: docs/tasks/r26-riskengine-v2-validation.md

Q-26-02 [P1]: Frontend Performance Analysis
- dist/ bundle size analysis + Electron cold start + IPC latency
- Output: docs/performance/frontend-perf-r26.md

Q-26-03 [P2]: Test Gatekeeper
- Run npm test after every code change, ensure 129+ pass

## WB/PM (3 tasks)
WB-26-01 [P0]: Sprint 1 Demo Recording (v0.6.0)
- Record 10 scenes based on ML-26-03 script
- Output GIF + docs/demo/sprint1-demo-r26.md

WB-26-02 [P0]: Sprint 1 Close + Sprint 2 Launch Broadcast
- Confirm all R26 tasks done
- Write Sprint 1 completion announcement + Sprint 2 Phase 3 kickoff

WB-26-03 [P1]: Sprint 2 Phase 3 Detailed Roadmap
- 5 milestones: R26 multi-broker skeleton -> R27 Moomoo real -> R28 IB -> R29 account agg -> R30 multi-broker strategy exec
- Output: docs/roadmap/sprint2-phase3-roadmap.md

## Timeline
07:45 | P0 done: Moomoo TCP + Checklist + RiskEngine doc
08:30 | P1 done: BrokerSelector + AccountAgg + Perf + CHANGELOG
09:30 | Close: Demo script + Recording + Roadmap + Test gate
10:00 | R26 Sign-off + Sprint 2 Launch

## Standards
TSC 0 error | Build 0 error | Test 129+ pass | Demo 10 scenes

Full plan: docs/tasks/round26-plan-final.md"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "R26_FINAL_PLAN",
    "title": "[ML] R26 Final Plan - Ready to execute",
    "round": 26,
    "content": plan,
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round26-plan-final.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "milestone": "10:00 R26 Sign-off + Sprint 2 Launch"
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
print(f"Tasks: ML=3 JVS=3 QClaw=3 WB=3 (12 total)")
