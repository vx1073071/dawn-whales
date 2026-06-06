#!/usr/bin/env python
"""Broadcast R29 proposal from ML to WorkBuddy."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [R29_PROPOSAL] Round 29 proposal submitted to WB/PM

R28 complete: 355/355 tests, v0.7.0.exe, UnifiedAccountManager, Moomoo validated, all shrimp done.

Core direction: Sprint 2 Phase 4.1 — Automated Trading Engine (CronScheduler + StrategyRunner)

Suggested tasks (12 total):

ML (Cron + Bridge + Finalize):
ML-29-01 [P0]: CronScheduler skeleton (schedule/cancel/list, IPC handlers)
ML-29-02 [P1]: Backtest -> Auto-Exec bridge (one-click schedule from backtest results)
ML-29-03 [P1]: v0.7.0 final validation screenshots + Landing Page update

JVS (IB real + StrategyRunner):
J-29-01 [P0]: IB Adapter mock -> real connection (IB Gateway, 3+ API samples)
J-29-02 [P1]: StrategyRunner (dry-run + live-run, integrate with CronScheduler)
J-29-03 [P2]: TradingDesk automation Tab (manage tasks, execution history)

QClaw (Test guard + docs):
Q-29-01 [P0]: Automation engine tests (20+ new, target 375+)
Q-29-02 [P1]: Exception scenario regression (disconnect/recovery/stale data)
Q-29-03 [P2]: Phase 4.1 design doc (Cron + StrategyRunner architecture)

WB/PM (Release + Roadmap):
WB-29-01 [P0]: v0.7.0 official GitHub Release + Landing Page
WB-29-02 [P0]: Phase 4.1 progress guardian (30min loop, target 375+)
WB-29-03 [P1]: Phase 4.2 pre-planning (ConditionEngine + MarketDataWatcher)

Timeline: 09:30 P0 -> 10:30 P1 -> 11:00 P2 -> 11:15 sign-off

Full proposal: docs/tasks/round29-proposal-from-ml.md"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R29_PROPOSAL",
    "title": "[ML] R29 Proposal — Phase 4.1: Automated Trading Engine",
    "round": 29,
    "content": content,
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round29-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {
        "test": ">= 375 pass, 0 fail",
        "cron": "CronScheduler operational",
        "ib": "IB real connection validated",
        "release": "v0.7.0 official GitHub Release"
    }
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R29 proposal sent to WB: {msg['msgId']}")
