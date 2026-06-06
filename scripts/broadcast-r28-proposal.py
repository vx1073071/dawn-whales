#!/usr/bin/env python
"""Broadcast R28 proposal from ML to WorkBuddy."""
import json, uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [R28_PROPOSAL] Round 28 proposal submitted to WB/PM

R27 complete: 259/259 tests, 0 fail, all 4 shrimp done. Three brokers ready (Futu real + Moomoo TCP + IB 1768L).

Core direction: From "works" to "ships" — v0.7.0 Multi-Broker Product Release

Suggested tasks (12 total):

ML (Packaging & Integration):
ML-28-01 [P0]: v0.7.0 Release (version bump + CHANGELOG + dist:win + verify)
ML-28-02 [P0]: Full pipeline E2E (NL->Strategy->Order->Broker->Risk, 15+ tests, Futu+Moomoo+IB)
ML-28-03 [P1]: User docs (README multi-broker arch + quickstart guide)

JVS (Broker validation):
J-28-01 [P0]: Moomoo live validation (real OpenD, 5+ API samples doc)
J-28-02 [P1]: UnifiedAccountManager (connect 3 brokers simultaneously, aggregated data)
J-28-03 [P2]: Moomoo WS feed into existing push pipeline

QClaw (Performance + CI):
Q-28-01 [P0]: Multi-broker perf regression (bundle/cold start/IPC/FPS/heap, <15% degradation)
Q-28-02 [P1]: Integration tests expansion (target 300+)
Q-28-03 [P1]: GitHub Actions CI/CD (test+build on push, PR checks)

WB/PM (Delivery):
WB-28-01 [P0]: Sprint 1 Final Demo publish (11 GIFs + Landing Page update)
WB-28-02 [P0]: v0.7.0 Release Announcement (GitHub Release + broadcast)
WB-28-03 [P1]: Sprint 2 Phase 4 roadmap (automation engine: cron/conditional/closed-loop)

Timeline: 09:00 P0 -> 10:00 P1 -> 10:30 P2 -> 10:45 sign-off

Full proposal: docs/tasks/round28-proposal-from-ml.md"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R28_PROPOSAL",
    "title": "[ML] R28 Proposal — v0.7.0 Multi-Broker Product Release",
    "round": 28,
    "content": content,
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round28-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "WB": 3},
    "targetMilestones": {
        "version": "v0.7.0",
        "test": ">= 300 pass, 0 fail",
        "moomoo": "live validation doc with 5+ API samples",
        "demo": "Sprint 1 Final published",
        "ci": "GitHub Actions configured"
    }
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R28 proposal sent to WB: {msg['msgId']}")
