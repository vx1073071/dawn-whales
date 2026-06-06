#!/usr/bin/env python
import json, uuid
from datetime import datetime, timezone, timedelta

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R38_PROPOSAL",
    "title": "[ML] R38 5虾建议计划 — Phase 5.0 启动: v0.8.0发布 + Dashboard 2.0 + Multi-Timeframe",
    "content": "[ML] R38 Proposal\n\n=== Baseline ===\ntsc 0 | build 0 | 1527/0/9 tests | 115 files | 5虾全勤\nR37: ML(3)+JVS(3)+QClaw(3)+PM(3)+DAO(4) 全部完成\n\n=== R38 方向 ===\nPhase 5.0 启动: v0.8.0发布 + Dashboard 2.0 + Multi-Timeframe + 1550+ tests\n\n=== 五虾 ===\nML: v0.8.0发布 + SystemHealthPanel + Phase5路线图\nJVS: K线回放引擎 + 多周期回测 + 集成测试\nQClaw: 测试1550+ + 覆盖率报告 + Phase5测试策略\nPM: 守护 + GitHub Release + 验收\nDAO: 引擎测试审查 + CHANGELOG + API文档 + R37代码审查\n\n=== 验收 ===\ntsc 0 | build 0 | 1550+ tests 0fail | v0.8.0发布 | K线回放可用\n\n完整: docs/tasks/round38-proposal-from-ml.md",
    "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
    "file": "docs/tasks/round38-proposal-from-ml.md",
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "PM": 3, "DAO": 4},
    "targetMilestones": {
        "test": ">= 1550, 0 fail",
        "release": "v0.8.0 on GitHub",
        "replay": "replay-engine.ts operational",
        "dashboard": "SystemHealthPanel on Dashboard"
    }
}

bridge_path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(bridge_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print(f"R38 proposal sent: {msg['msgId']}")
