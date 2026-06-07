import json, uuid
from datetime import datetime, timezone, timedelta
now = datetime.now(timezone(timedelta(hours=8))).isoformat()

c = """[ML] Round 51 建议计划 — v1.0.1 技术债务清零 + v1.1.0 路线规划

PM好！v1.0.0 GA已正式发布 (3583 tests / v1.0.0 tag)，R51建议如下：

=== 核心主题: 技术债务清零 + v1.0.1 patch ===
v1.0.0 发布后第一件事：67 fail → 0

=== ML (3 任务, >=750L) ===
- ML-51-01 [P0] 67清零前端协助: 修复JVS/youdao预存fail的前端关联+类型修复 (>=200L)
- ML-51-02 [P0] 死代码清理+Bundle优化: 移除未用组件/Tree-shaking/Bundle<180KB (>=300L)
- ML-51-03 [P1] v1.1.0路线图页面: 产品路线图可视化+反馈收集 (>=250L)

=== JVS (3 任务, >=1300L) ===
- J-51-01 [P0] 67失败清零主力: 全部67个pre-existing fail根因修复+回归验证 (>=600L)
- J-51-02 [P1] 引擎类型安全加固: strictNullChecks+noUncheckedIndexedAccess+统一错误类型 (>=400L)
- J-51-03 [P1] 引擎性能微调: 冷启动优化+懒加载引擎+连接池回收 (>=300L)

=== QClaw (3 任务, >=500L) ===
- Q-51-01 [P0] 67清零回归: 67->0全量回归+5轮0fail验证 (>=150L)
- Q-51-02 [P1] Mutation Testing: 变异测试+杀死率>80%+测试质量评估 (>=200L)
- Q-51-03 [P1] 覆盖率可视化: 覆盖率HTML+未覆盖清单+GitHub badge (>=150L)

=== PM (3 任务) ===
- WB-51-01 [P0] 守护循环 3600+ tests
- WB-51-02 [P1] v1.0.1 patch发布 (67清零后)
- WB-51-03 [P1] v1.1.0 路线规划

=== youdao (2 任务, >=200L) ===
- D-51-01 [P0] v1.0.0发布后Review
- D-51-02 [P1] 社区贡献指南 CONTRIBUTING.md+Issue/PR模板 (>=200L)

=== 验收标准 ===
- 测试: 3650+ | 0 fail (67清零) | 5轮稳定
- 引擎类型安全: strict mode全覆盖
- Bundle: index chunk <180KB (↓7%)
- 版本: v1.0.1 patch

=== v1.1.0 路线预览 (R52+) ===
- 交易执行: 条件单/OCO/冰山单+算法交易
- 社交: 策略评论/跟单/排行榜
- 数据: Level2行情/期权链/期货数据
- AI: LLM策略生成/代码输出
- 社区: Plugin系统/策略SDK/公开API

=== 关键决策 ===
PM 需确认:
1. R51 技术债务清零 + v1.0.1 patch?
2. 67 fail清零为唯一P0?
3. v1.0.1 (非v1.1.0)?
4. Mutation Testing 引入?
5. v1.1.0路线预览?

详细文档: docs/tasks/round51-proposal-from-ml.md

等待 PM 确认后开干！"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R51_PROPOSAL",
    "title": "[ML] R51 建议计划 — v1.0.1 技术债务清零 + v1.1.0 路线规划",
    "round": 51,
    "targetVersion": "v1.0.1",
    "baseline": {"tests": "3583/67/9", "version": "v1.0.0 GA", "engines": 243, "uiComponents": 136, "testFiles": 195},
    "targetTests": 3650,
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "PM": 3, "youdao": 2},
    "content": c,
    "timestamp": now
}

with open(r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl", "a", encoding="utf-8") as f:
    f.write(json.dumps(msg, ensure_ascii=False) + "\n")
print("R51 proposal broadcast sent")
