# 📋 R210 审计报告 — 策略排行榜+因子盲盒+跟单抽成+盲盒交易(Phase 3第3轮)

> **PM Claw** | 2026-06-16 | R210 PM Audit — 排行榜盲盒

---

## 一、R209 验收结论

| 虾 | 交付物 | 代码量 | 状态 |
|---|---------|:------:|:----:|
| autoclaw #3 | RankingPipeline.ts (5类+Orchestrator, 完整IC→排名→简报→推送→计费) | 768L | ✅ TSC 0 |
| QClaw #6 | 龙虎榜引流文案 9语言 | — | ✅ commit d8b854c7 |
| JVS #1+#2 | RankingEngine+SignalPushQueue优化 | — | ⚠️ 未确认 |
| ML #4+#5 | DailyBriefingPage+SignalPushPopup | — | ⚠️ 未确认 |

---

## 二、R210 核心差距分析

### 🔥 可复用度: 30-50% (中等)

| R210模块 | 已有基础 | 复用度 |
|---------|---------|:---:|
| LeaderboardPage | CreatorLeaderboard(R58, 6级+排名+收益分) + FactorWeeklyLeaderboard(R189, Top10+IC+信号) | **50%** |
| BlindBoxCard | BillingCard×7(R201, 扣费卡片模式) + ScenarioPackSelector(R185, 卡片网格) | **30%** |
| LeaderboardEngine | ExecutionFeeEngine(R200) + TemplateEngine(R204) | **40%** |
| FollowTradePipeline | SignalPushPipeline(R202) + ExecutionFeeEngine(R200) | **50%** |
| BlindBoxEngine | ai-orchestrator(扣费+AI) + TemplateEngine(策略模板) | **30%** |

### 不存在模块 (需新建)

| 模块 | 负责虾 | 难度 | 工时 | 关键点 |
|------|--------|:----:|:----:|------|
| LeaderboardEngine.ts | JVS#1 | 🔴 | 8h | 实盘成绩+排名+跟单+3级抽成(30%/20%/10%)+等级自动升级 |
| BlindBoxEngine.ts | JVS#2 | 🔴 | 6h | AI生成3组合→1免费+2×1U+DeepSeek解读 |
| FollowTradePipeline.ts | autoclaw#3 | 🔴 | 6h | 展示→跟单→下单→0.1%执行费→抽成→记录 |
| BlindBoxToTradePipeline.ts | autoclaw#4 | 🟡 | 4h | 解锁→因子→回测→AI优化→交易 |
| LeaderboardPage.tsx | ML#5 | 🟡 | 4h | 升级CreatorLeaderboard(R58), 改6级→3级+跟单按钮 |
| BlindBoxCard.tsx | ML#6 | 🔴 | 4h | 全新(开箱动效+3卡片+翻牌1U+DeepSeek) |

### 🔥 CreatorLeaderboard.tsx (R58) 现有功能

```
✅ 6级创作者系统 (bronze→silver→gold→platinum→diamond→king)
✅ 收益分成展示 (L1:70/30 / L2:80/20 / L3:90/10)
✅ 4维度排行 (total/30d/Sharpe/subscribers)
✅ 时间范围切换 (weekly/monthly/all-time)
✅ 创作者卡片 (头像+等级徽章+数据+排名)
✅ 9语言i18n
```

> **ML#5只需升级**: 6级→3级(L1/L2/L3: 100/1000笔), 新增跟单按钮, 30天成绩图表

---

## 三、创作者抽成机制

| 等级 | 条件 | 抽成 | 创作者得 | 跟单费 | 创作者净得 |
|------|------|:---:|:---:|:---:|------|
| L1 | 注册即 | 30% | 70% | 执行费0.1% | 70% × 0.1% |
| L2 | 累计100笔 | 20% | 80% | 执行费0.1% | 80% × 0.1% |
| L3 | 累计1000笔 | 10% | 90% | 执行费0.1% | 90% × 0.1% |

> 等级自动升级: LeaderboardEngine周期性检查交易笔数→自动升级→更新徽章

---

## 四、关键风险与建议

### 🔴 风险1: LeaderboardEngine需全新实盘成绩系统

**问题**: R210的"实盘成绩"需真实交易数据(跟单笔数+收益+Sharpe), 当前无此数据库表/API
**建议**: R210用mock数据+占位表结构, 真实交易数据留R211 API Key接入后补齐

### 🔴 风险2: BlindBoxCard 开箱动效+DeepSeek对话

**问题**: 全新组件(0%复用), 需前端动效+AI对话+扣费+一键应用, 4h紧
**建议**: 分2步: 静态卡片+扣费(2h) → 开箱动效+DeepSeek对话(2h)

### 🟡 风险3: 跟单链路需ExecutionFeeEngine集成

**问题**: 跟单→下单→0.1%执行费→抽成 链路需ExecutionFeeEngine+钱包系统联动
**建议**: autoclaw#3复用ExecutionFeeEngine(R200)的hold→settle链路, 仅增量抽成分账逻辑

### 🟡 风险4: ML#5 LeaderboardPage为升级非新建

**问题**: CreatorLeaderboard(R58)是6级系统, R210要求3级+跟单
**建议**: 简化level枚举(6→3)+新增FollowButton+30天成绩图表, 4h可完成

---

## 五、依赖顺序建议

```
🥇 JVS#1 LeaderboardEngine (8h, 🔑关键路径)
🥇 JVS#2 BlindBoxEngine (6h, 独立)
🥇 QClaw#7 文案 (2h, 独立)
🥇 ML#5 LeaderboardPage (基于CreatorLeaderboard升级, 4h)
🥇 ML#6 BlindBoxCard (全新组件, 4h)
🥈 autoclaw#3 FollowTradePipeline (等#1引擎, 6h)
🥈 autoclaw#4 BlindBoxToTradePipeline (等#2引擎, 4h)
🏁 youdao#8 全链路测试 (等全部完成, 4h)
```

---

## 六、R210关键参数速查

| 参数 | 值 |
|------|-----|
| 排行榜维度 | 30天/90天 实盘成绩+Sharpe+跟单数 |
| 抽成等级 | L1:30% / L2:20% / L3:10% (100/1000笔) |
| 盲盒组合 | AI生成3组合 (1免费+2×1U) |
| 跟单链路 | 排行→跟单→下单→0.1%执行费→抽成 |
| 盲盒链路 | 持仓→1U解锁→看因子→回测→1.5U优化→交易 |
| 总工时 | 30h |

---

*PM Claw | 2026-06-16 | R210 Audit — 排行榜盲盒审计*
