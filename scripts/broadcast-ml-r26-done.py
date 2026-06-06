#!/usr/bin/env python
"""Broadcast ML R26 completion to bridge."""
import json
import uuid
from datetime import datetime, timezone, timedelta

content = """[ML] [TASK_DONE] ML-R26 ALL 3 TASKS COMPLETE

=== ML-26-01 [P0]: v0.6.0 Installer Verification Checklist ===
OK: docs/demo/r26-installer-checklist.md
- 25 check items: pre-install (13) + install flow (5) + first launch (9) + page checks (11)
- All icons confirmed: build/icon.png (1024x1024), icons/icon.png (256x256), icons/icon.ico (multi), icons/tray-icon.png (16x16)
- Known limitations documented (Moomoo mock, no code signing)

=== ML-26-02 [P1]: Sprint 1 Retrospective ===
OK: docs/sprints/sprint1-retrospective.md
- 27 completed modules across 5 rounds (v0.1.0 -> v0.6.0)
- 129 tests, 6 files, exit 0
- Known limitations (6 items) + Sprint 2 priorities (3 phases)
- Team performance summary: ML/JVS/QClaw/WB contributions
- Lessons learned (5 items)

=== ML-26-03 [P1]: R26 Demo Script ===
OK: docs/demo/r26-demo-script.md
- 11 scenes, ~10 minutes total
- Flow: Onboarding -> Dashboard -> Market -> Strategy -> Backtest -> Trade -> Risk -> Alert -> Settings -> Portfolio -> Multi-Broker (bonus)
- Recording tips + output checklist for WB

=== CHANGELOG ===
OK: Updated with R26 entries for all 4 shrimp

=== Verification ===
- npm run build: 3 bundles, 0 errors
- npm test: 129/129 passed, exit 0
- tsc --noEmit: 0 errors

Commit: 290b489a (pushed to feature/strategy-optimize)
All ML tasks done. Awaiting JVS/QClaw/WB to complete for R26 sign-off."""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "ALL",
    "type": "TASK_DONE",
    "title": "[ML] [TASK_DONE] ML-R26 ALL 3 TASKS COMPLETE — Installer Checklist + Sprint 1 Retrospective + Demo Script",
    "round": 26,
    "content": content,
    "taskStatus": {"ML-26-01": "DONE", "ML-26-02": "DONE", "ML-26-03": "DONE"},
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "commit": "290b489a",
    "verification": {"build": "0 errors", "test": "129/129", "tsc": "0 errors"}
}

bridge_path = r"..\\chat-bridge\\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"Bridge: {msg['msgId']}")
print("ML R26 complete. Waiting for JVS/QClaw/WB.")
