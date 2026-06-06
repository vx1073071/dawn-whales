#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL(bridge)",
    "type": "ML_R38_COMPLETE",
    "title": "[ML] R38 v2 ALL 3 TASKS COMPLETE — SystemHealthPanel + AdaptiveParamPanel + Phase 5.0 roadmap",
    "round": 38,
    "content": """[ML] R38 v2 3/3 COMPLETE

=== ML-38-01 [P0]: SystemHealthPanel integrated to Dashboard ===
- New component: src/components/dashboard/SystemHealthPanel.tsx (290L)
- 10 engines monitored: OpenD/Strategy/Condition/ClosedLoop/Risk/Backtest/Trade/Performance/MarketData/DB
- Real-time status: online/degraded/offline with color indicators
- Resource meters: memory (bar) + CPU (bar) with threshold colors
- Offline alert panel: red warning when any engine down
- 10s auto-refresh + manual refresh button
- Expandable list (compact → show all)
- Replaced static StatusRow components in DashboardPage
- Footer: version (v0.8.0-alpha) + test count (1527 passed)

=== ML-38-02 [P0]: AdaptiveParamPanel (500L) ===
- StrategyPage new mode: 'adaptive' (Phase 4.4)
- 4 strategy types: MA_CROSS / RSI / MACD / BOLLINGER
- Parameter comparison: current vs suggested with diff indicators
- Reward history: SVG sparkline chart + table (last 10 iterations)
- Auto-learn mode: 3s interval auto-exploration
- Learning controls: rate, exploration rate, iterations
- Reset to best params button
- Apply suggested params callback
- StrategyPage ModeSelector: "自适应学习" button (Phase 4.4 ->)

=== ML-38-03 [P1]: Phase 5.0 Roadmap ===
- docs/roadmap/phase5.0-plan.md
- 3 pillars: Multi-Timeframe / Portfolio Analytics / Live Trading
- R39-R42 detailed plan
- Tech decisions: Web Worker / WASM / SQLite WAL
- Milestone timeline to v1.0.0

=== Global Status ===
- tsc: 0 errors
- build: 0 errors (3 bundles)
- test: 1527 passed / 0 failed / 115 files / exit 0

Commit: 635f9149 (pushed)""",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "metrics": {
        "tsc": "0 errors",
        "build": "0 errors",
        "tests": "1527 passed / 0 failed / exit 0",
        "ui_components": "SystemHealthPanel + AdaptiveParamPanel",
        "doc": "phase5.0-plan.md"
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Broadcasted: {msg['msgId']}")
