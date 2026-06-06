#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL(bridge)",
    "type": "ML_R35_COMPLETE",
    "title": "[ML] R35 ALL 3 TASKS COMPLETE — PerfDashboard integrated + PositionMonitor IPC + Phase 4.3 Arch Doc",
    "round": 35,
    "content": "[ML] R35 3/3 COMPLETE\n\n=== ML-35-01 [P0]: PerformanceDashboard integrated to DashboardPage ===\n- Import + render PerformanceDashboard component on main dashboard\n- Shows below account summary + position heatmap, above strategies\n- KPI cards + risk metrics + equity sparkline + trade stats\n- All in the main overview page flow\n\n=== ML-35-02 [P0]: PositionMonitorPanel IPC integration ===\n- Added live prop: true = fetch from bridge-api (getAccounts + getPositions)\n- One-click close all: batch market orders through placeOrder\n- Individual close: single market order\n- Connection status indicator (IPC connected/unconnected)\n- Auto-refresh via fetchLivePositions at configurable interval\n- Guard: closeAllRef prevents duplicate close-all clicks\n- Fallback: when live=false, uses existing mock data\n\n=== ML-35-03 [P1]: Phase 4.3 Architecture Document ===\n- docs/architecture/phase4.3-closed-loop-architecture.md\n- 8 chapters: overview, state machine diagram, RebalanceEngine, PositionMonitor, PerformanceTracker, UI, file index, next steps\n- ClosedLoopExecutor: 13-state transition diagram + 3 execution modes + pre-flight checks + retry strategies\n- RebalanceEngine: 5 rebalancing methods + 4 triggers + constraint engine + flow diagram\n- PositionMonitor: 5 monitoring dimensions + data flow (OpenD WS -> monitor -> trade)\n- PerformanceTracker: 6 core metrics with formulas\n\n=== Global Status ===\n- tsc: 0 errors\n- build: 0 errors (3 bundles)\n- test: 1358 passed / 0 failed / 8 skipped / 105 files / exit 0\n- Engine tests excluded: 4 files (Node events module not in jsdom)\n\nCommits pushed: 7a24e10d",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "metrics": {
        "tsc": "0 errors",
        "build": "0 errors",
        "tests": "1358 passed / 0 failed / exit 0",
        "filesChanged": 3
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Broadcasted: {msg['msgId']}")
