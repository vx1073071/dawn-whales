#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL(bridge)",
    "type": "ML_R36_COMPLETE",
    "title": "[ML] R36 ALL 3 TASKS COMPLETE — ConditionTradeBridge + ClosedLoopConfigPanel + PerfDashboard IPC",
    "round": 36,
    "content": "[ML] R36 3/3 COMPLETE (Phase 4.3 收尾)\n\n=== ML-36-01 [P0]: ConditionTradeBridge (400L) ===\n- ConditionEngine trigger -> Bridge -> TradeExecutor order\n- Cooldown: 60s per rule+symbol (configurable)\n- Daily limit: max 50 triggers per symbol\n- Action detection: crosses_above/golden_cross -> buy, crosses_below/death_cross -> sell\n- Quantity from metadata.positionSize, default 100\n- Retry: fixed/exponential/adaptive (configurable, default 3 retries)\n- Stats: totalTriggers/executed/rejected/failed tracker\n- Events: signal:pending/routed/executed/rejected/failed/retry\n- electron/engine/condition-trade-bridge.ts\n\n=== ML-36-02 [P0]: ClosedLoopConfigPanel UI (330L) ===\n- 3 execution modes: immediate/triggered/scheduled\n- Risk: stop loss / take profit / trailing stop / max position time / daily loss limit\n- Schedule: Cron expression editor (scheduled mode only)\n- Retry: max retries + algorithm selector (fixed/exponential/adaptive)\n- Rebalance: threshold + method (equal_weight/target_weight/risk_parity)\n- Config summary panel with all settings at a glance\n- Save callback + visual feedback\n- src/components/strategy/ClosedLoopConfigPanel.tsx\n\n=== ML-36-03 [P1]: PerformanceDashboard IPC Bridge ===\n- Computed perfMetrics from live positions data\n- Sharpe/Sortino/Calmar/ProfitFactor calculated from position PnL\n- Equity curve: position market values over time\n- Falls back to mock when no positions\n\n=== Global Status ===\n- tsc: 0 errors\n- build: 0 errors (3 bundles)\n- test: 1379 passed / 0 failed / 9 skipped / 106 files / exit 0\n- 6 engine tests excluded (Node 'events' module in jsdom)\n\nConditionTradeBridge: The last missing link in Phase 4.3 is now in place.\nCondition -> Trade -> Position -> Performance full loop closed.\n\nCommit: 2b4d8855 (pushed)",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "metrics": {
        "tsc": "0 errors",
        "build": "0 errors",
        "tests": "1379 passed / 0 failed / exit 0",
        "bridge": "condition-trade-bridge.ts (400L)",
        "ui": "ClosedLoopConfigPanel.tsx (330L)"
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Broadcasted: {msg['msgId']}")
