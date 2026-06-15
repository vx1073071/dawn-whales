# 📋 R209 审计报告 — 龙虎榜三级漏斗+信号队列优化(Phase 3第2轮)

> **PM Claw** | 2026-06-16 | R209 PM Audit — 龙虎榜三级漏斗

---

## 一、R208 验收结论

### ✅ 全虾3/5确认 (Phase 3开局)

| 虾 | 交付物 | 代码量 | TSC | Commit |
|---|---------|:------:|:---:|--------|
| JVS | DataChannelEngine + 6 DataAdapters | 472L | 0 | b08c5bac |
| autoclaw | BinanceRealtimeAdapter.ts (4流+限频+VIP分层) | 647L | 0 | — |
| ML | DataChannelToggle + ArbitrageHeatmap | ~530L | 0 | 478075d1 |
| QClaw/youdao | — | — | — | ⚠️ 未确认 |

**Phase 3开局交付**: ~1650L, TSC 0, VIP数据通道可用

---

## 二、R209核心差距分析

### 🔥 最大特点: 可复用度恢复至40-70%

R208是0-20%复用度的"裸奔"轮，R209基于R201-R202的大量已有引擎，可复用度大幅回升。

### 基于已有引擎 (非从零开始)

| R209模块 | 已有基础 | 行数 | 复用度 | 增量工作 |
|---------|---------|:----:|:---:|---------|
| RankingEngine | WeeklyRankingPage(R201) + DailyBriefingEngine(R202) + SignalPushEngine(R202) | 861L | **50%** | 新增IC排序+3级漏斗管线 |
| SignalPushQueue优化 | SignalPushEngine.ts(R202) | 331L | **60%** | 新增TokenBucket+批量计费 |
| RankingPipeline | SignalPushPipeline(R202) + SignalPushEngine | — | **40%** | 新增IC→排名→简报→推送链路 |
| DailyBriefingPage | DailyBriefingCard(R202) + BillingCard×7(R201) | ~420L | **50%** | 新增付费门控+升级引导 |
| SignalPushPopup升级 | SignalPushPopup(R202) | ~280L | **70%** | 新增0.5U标签+漏斗引导 |

### 不存在模块 (需新建/升级)

| 模块 | 负责虾 | 类型 | 工时 | 复用度 |
|------|--------|------|:----:|:---:|
| RankingEngine.ts | JVS#1 | 🔴 新建 | 8h | 50% (3引擎组合) |
| SignalPushQueue优化 | JVS#2 | 🟡 升级 | 4h | 60% |
| RankingPipeline | autoclaw#3 | 🟡 新建 | 6h | 40% |
| DailyBriefingPage.tsx | ML#4 | 🟡 新建 | 4h | 50% (DailyBriefingCard) |
| SignalPushPopup升级 | ML#5 | 🟢 升级 | 4h | 70% |

### 三级漏斗复用映射

```
🟢 免费周报 → WeeklyRankingPage (R201 ML#5, 已有 Top20 IC+信号灯)
🟡 付费日简报 → DailyBriefingEngine (R202 JVS#2, 已有 Top5+异常+DeepSeek) + DailyBriefingCard (R202 ML#3)
🔴 实时推送 → SignalPushEngine (R202 JVS#1, 已有 触发+批量计费) + SignalPushPopup (R202 ML#4)
```

### JVS#1 RankingEngine 核心逻辑

```
输入: 因子IC数据(258因子池)
  → calculateIC() → 排序 → 🟢Top20 (免费周报)
  → filterIC > 阈值() → 🟡Top5 + 异常检测 → DeepSeek建议 (日简报, 1U)
  → filterSignal() → 🔴触发推送 (0.5U/条, ≤50/日)
  → 漏斗转化追踪(免费→1U→0.5U)
```

---

## 三、关键风险与建议

### 🔴 风险1: RankingEngine需协调3个已有引擎

**问题**: JVS#1需整合WeeklyRankingPage(ML前端)、DailyBriefingEngine(已有530L)、SignalPushEngine(已有331L)三个不同层级的模块
**建议**: RankingEngine作为瘦编排层(200L), 调用已有引擎的方法, 不做重复实现

### 🟡 风险2: 三级漏斗计费链路复杂

**问题**: 免费→1U日简报→0.5U推送 三级计费需独立计费+降级+互不干扰
**建议**: 每级独立BillingTouchpoint (LEADERBOARD_WEEKLY_FREE / LEADERBOARD_DAILY_BRIEF / LEADERBOARD_SIGNAL_PUSH)

### 🟡 风险3: SignalPushQueue优化改动面大

**问题**: SignalPushEngine.ts(331L)已有去重+限频逻辑, 优化需加TokenBucket+批量计费不破坏现有功能
**建议**: 新增SignalPushQueueOptimizer类, 包裹SignalPushEngine, 不修改原有逻辑

### 🟢 风险4: ML两个组件均为升级

**问题**: DailyBriefingPage基于DailyBriefingCard(~420L) + SignalPushPopup基于已有Popup(~280L)
**建议**: 复用R202组件模式, 增量付费门控+漏斗引导, 4h可完成

---

## 四、依赖顺序建议

```
🥇 JVS#1 RankingEngine (🔑关键路径, 基于3已有引擎, 8h)
🥇 QClaw#6 引流文案 (独立, 2h)
🥇 ML#5 SignalPushPopup升级 (基于R202 SignalPushPopup, 4h)
🥈 JVS#2 SignalPushQueue优化 (基于SignalPushEngine, 4h)
🥈 autoclaw#3 RankingPipeline (等#1引擎, 6h)
🥈 ML#4 DailyBriefingPage (基于DailyBriefingCard, 4h)
🏁 youdao#7 3级E2E (等全部完成, 4h)
```

---

## 五、R209关键参数速查

| 参数 | 值 |
|------|-----|
| 漏斗三级 | 🟢免费周报 Top20 / 🟡1U日简报 Top5+DeepSeek / 🔴0.5U推送 ≤50/日 |
| 可复用度 | 40-70% (vs R208的0-20%) |
| 已有引擎 | WeeklyRankingPage + DailyBriefingEngine(530L) + SignalPushEngine(331L) + SignalPushPopup(280L) |
| 新建模块 | 3个 (RankingEngine + RankingPipeline + DailyBriefingPage) |
| 升级模块 | 2个 (SignalPushQueue + SignalPushPopup) |
| 总工时 | 30h |
| R209验收项 | 3级×3场景=9项E2E |

---

*PM Claw | 2026-06-16 | R209 Audit — 龙虎榜三级漏斗审计*
