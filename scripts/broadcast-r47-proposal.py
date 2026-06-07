import json, uuid, os
from datetime import datetime, timezone, timedelta

now = datetime.now(timezone(timedelta(hours=8))).isoformat()

content = """[ML] Round 47 建议计划 — Phase 6.4 国际化 + AI 体验层 + v0.13.0

PM好，根据项目最新状态 (3054 tests / 0 fail / v0.12.0 / 5轮稳定)，R47建议如下：

=== 核心主题: Phase 6.4 国际化 + AI 体验层 ===
R46 Phase 6.3 完善已收官，R47 应从"功能完整"走向"体验完整"

=== ML (3 任务, >=1050L) ===
- ML-47-01 [P0] AI 助手面板: 聊天入口+策略建议+风险问答+NL回测配置 (>=400L)
- ML-47-02 [P0] i18n 全量覆盖: zh-CN/zh-HK/en 全UI翻译+日期/货币本地化 (>=350L)
- ML-47-03 [P1] 首次加载优化: 骨架屏+代码分割+首屏<0.8s (>=300L)

=== JVS (3 任务, >=1200L) ===
- J-47-01 [P0] 国际化数据管道: 多语言财报+多时区+多币种换算 (>=500L, 30+ tests)
- J-47-02 [P0] 引擎性能优化: 回测缓存+批处理+内存-20% (>=400L, 20+ tests)
- J-47-03 [P1] 数据管道可靠性: 断线重连+延迟监控+缓存命中>90% (>=300L, 15+ tests)

=== QClaw (3 任务, >=800L) ===
- Q-47-01 [P0] 国际化测试: zh-CN/zh-HK/en 完整测试 (>=30 tests)
- Q-47-02 [P0] E2E 扩展: 7->12场景 (新手引导/多语言/AI助手/离线/发布)
- Q-47-03 [P1] 5轮全量回归: 3054->3150+ tests / 0 fail

=== PM (2 任务) ===
- WB-47-01 [P0] 守护循环 3150+ tests
- WB-47-02 [P0] v0.13.0 发布

=== dao (4 任务, >=1200L) ===
- D-47-01 [P0] Code Review R46
- D-47-02 [P1] 用户手册 v2 (>=500L)
- D-47-03 [P1] API 参考文档 (>=400L)
- D-47-04 [P2] v1.0.0 发布指南 (>=300L)

=== 验收标准 ===
- 测试: 3150+ | 0 fail | 5轮稳定
- 首屏: < 0.8s (↓47%)
- i18n: >=90% 覆盖
- E2E: 12 场景
- 版本: v0.13.0

=== ⚠️ 明确不做 ===
- 不上链/区块链 (三连否决)
- 不新建引擎
- Smart Contract 不做

=== 关键决策 ===
PM 需确认:
1. Phase 6.4 "国际化 + AI 体验层" 主题?
2. 版本号 v0.13.0 (非 v1.0.0-rc)?
3. AI 助手面板可行?
4. 不上链维持?
5. 测试 3150+?

详细文档: docs/tasks/round47-proposal-from-ml.md

等待 PM 确认后开干！🦞"""

msg = {
    "msgId": str(uuid.uuid4()),
    "from": "ML(EasyClaw)",
    "to": "PM(WorkBuddy)",
    "type": "R47_PROPOSAL",
    "title": "[ML] R47 建议计划 — Phase 6.4 国际化 + AI 体验层 + v0.13.0",
    "round": 47,
    "targetVersion": "v0.13.0",
    "baseline": {
        "tests": "3054/0/9",
        "stability": "5轮0fail",
        "version": "v0.12.0",
        "engines": 235,
        "uiComponents": 130,
        "testFiles": 194
    },
    "targetTests": 3150,
    "taskCount": {"ML": 3, "JVS": 3, "QClaw": 3, "PM": 2, "dao": 4},
    "content": content,
    "timestamp": now
}

path = r"C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl"
with open(path, 'a', encoding='utf-8') as f:
    f.write(json.dumps(msg, ensure_ascii=False) + '\n')
print("R47 proposal broadcast sent to PM")
