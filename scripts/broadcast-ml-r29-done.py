#!/usr/bin/env python
"""Broadcast ML R29 completion to bridge."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R29 ALL 3 TASKS COMPLETE

=== ML-29-01 [P0]: CronScheduler (Task Scheduler) ===
OK: electron/engine/cron-scheduler.ts (323 lines)
- schedule/cancel/list/pause/resume/trigger API
- Cron expression parser + interval support
- Task status machine + StrategyRunnerInterface
- IPC handlers: cron:schedule/cancel/list/pause/resume/trigger
- WebSocket push: cron:event for real-time UI
- Integrated into main.ts with strategyRunner bridge

=== ML-29-02 [P1]: Backtest -> Auto-Exec Bridge ===
OK: BacktestReportPage.tsx 'Set Auto Schedule' button
- Gold-styled CTA card in overview tab
- Pre-fills: strategyId + cron (weekday 21:00) + dry-run
- One-click IPC call to CronScheduler

=== ML-29-03 [P1]: Landing Page v0.7.0 Update ===
OK: site/index.html: v0.3.0 -> v0.7.0
- Download links + badges + stats updated

=== Verification ===
- npm run build: 0 errors
- npm test: 381/385 pass (4 failures in QClaw risk-engine-v3.test.ts)
- All ML code compiles cleanly

Commit: f192b6c7 (pushed)
All ML tasks done. Waiting for JVS/QClaw/WB for R29 sign-off."""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R29 ALL 3 TASKS COMPLETE — CronScheduler + Backtest Bridge + Landing Page",
    "round": 29,
    "content": content,
    "taskStatus": {"ML-29-01": "DONE", "ML-29-02": "DONE", "ML-29-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "f192b6c7",
    "verification": {"build": "0 errors", "test": "381/385 pass (4 QClaw)"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
