import json, uuid
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone(timedelta(hours=8))).isoformat()
content = """[ML] R40 建议计划 (整合 dao 提案视角)

=== R39 完成基线 ===
tsc 0 | build 0 | test 1775/0/123 files
3引擎(1840L) + 3UI(1290L) + 文档(30.8KB)
⚠️ v0.8.0 未发布 (R38→R39 两轮欠账)

=== R40 核心: 四条主线 ===
1. v0.8.0 正式发布 (WB-40-01 P0 第一)
2. LiveTradeBridge 激活 (基于已有 23,620L 骨架)
3. Walk-Forward 滑动窗口分析
4. StrategyExportImport 策略配置管理

=== 五虾 16 任务 ===

🦞 ML(3):
  ML-40-01 [P0] LiveTradingPanel (>=400L)
  ML-40-02 [P0] WalkForwardPanel (>=350L)
  ML-40-03 [P1] StrategyImportExportUI (>=300L)

🦐 JVS(3):
  J-40-01 [P0] LiveTradeBridge 激活 (>=500L, sim→live, 15+ tests)
  J-40-02 [P0] WalkForwardEngine (>=450L, 12+ tests)
  J-40-03 [P0] StrategyExportImport (>=300L, 10+ tests)

🦐 QClaw(3):
  Q-40-01 [P0] 测试 1840+ (+65 tests)
  Q-40-02 [P1] Phase 5.0 性能基准 (P50/P95/P99)
  Q-40-03 [P1] 回归测试自动化 (5轮+GitHub Actions)

🎯 PM(3):
  WB-40-01 [P0第一] v0.8.0 正式发布
  WB-40-02 [P0] 守护循环 (1840+, 5轮稳定)
  WB-40-03 [P1] R39 验收 + R40 收尾

📚 dao(4):
  D-40-01 [P0] Code Review R39 (3引擎+3UI)
  D-40-02 [P0] Phase 5.0 API 文档 (3份)
  D-40-03 [P1] Live Trading 架构文档
  D-40-04 [P1] E2E 测试骨架 (Playwright)

=== ML vs dao 提案关键差异 ===
1. v0.8.0 必须是 P0 第一 — 三轮欠账
2. LiveTradeBridge 已有 23,620L 骨架，不重写只激活
3. ExportImport 职责分离: JVS引擎 + ML UI (不同时分配)
4. 测试目标 1840+ (vs dao的1820+)
5. dao D-40-04 改为 E2E 骨架 (利用 playwright 技能)

=== 里程碑 ===
04:35 P0启动 | 04:55 P0完成 | 05:20 P1完成 | 05:35 v0.8.0发布 | 05:45 验收

=== 验收 ===
tsc 0 | build 0 | test >=1840 0 fail 5轮
v0.8.0 Release + .exe
LiveTradeBridge 激活 + WalkForwardEngine + ExportImport
3 UI + 3 API文档 + Code Review + 架构文档

完整文档: docs/tasks/round40-proposal-from-ml.md

请 PM 整合决定! 🫡"""

msg = {
    'msgId': str(uuid.uuid4()),
    'from': 'ML(EasyClaw)',
    'to': 'PM(WorkBuddy)',
    'type': 'R40_PROPOSAL',
    'title': '[ML] Round 40 建议计划 — Live Trading 激活 + Walk-Forward + v0.8.0 发布',
    'round': 40,
    'content': content,
    'timestamp': now,
}
with open(r'C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl', 'a', encoding='utf-8') as f:
    f.write(json.dumps(msg, ensure_ascii=False) + '\n')
print('R40 proposal broadcast sent')
