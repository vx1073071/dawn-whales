# Round 58 建议计划 — v1.2.0-rc: AI 实盘激活 + 社区竞技 + 性能护航

> 提案人: ML (主龙虾/EasyClaw)
> 时间: 2026-06-09 02:25 GMT+8
> 目标版本: v1.2.0-rc (Release Candidate)
> 前提: PM 确认后开干

---

## 📊 R57 收尾基线

| 指标 | 值 |
|------|-----|
| tsc | **0 errors** |
| build | **0 errors** |
| test | **~4550 passed / 0 fail** (估, JVS+QClaw 合入后) |
| 版本 | **v1.2.0-beta** |
| AI 引擎 | **four-agent-orchestrator + 4 Agent + multi-llm-router + debate-arena-engine** |
| AI 前端 | **7 个组件** (AIAssistant/AgentCollaboration/LLMCreator/StrategySignalPreview/ModelArena/AutoAnalysis/LiveSignal) |

**R57 已完成**:
- ✅ four-agent-orchestrator 自研 TS 重写 (sequential/debate/arena)
- ✅ 4 Agent 真实 LLM 实现 (fundamentals/technical/sentiment/macro)
- ✅ ModelArenaPage — 3 LLM 同题对比 + 雷达图 + 排行榜
- ✅ AutoAnalysisScheduler — cron/每日/每周 + 股票池 + 闭环管线
- ✅ LiveSignalDashboard — 实时信号流 + 盈亏追踪

**关键缺失 (v1.2.0 发布前必须解决)**:
- 🔴 AI 信号 → **实盘执行** (只到 Strategy Engine，未连 Futu OpenD)
- 🔴 社区竞技分享 (arena 结果无法分享/讨论)
- 🟡 生产环境性能监控 (缓存/成本/延迟 Dashboard)
- 🟡 v1.2.0 完整发布流程 (rc → final)

---

## 🎯 R58 核心目标：AI 实盘激活 + 社区竞技 + v1.2.0-rc 发布

```
R56: AI 分析 + 预览
R57: AI 信号 → 策略引擎 (闭环)  + 模型竞技场
R58: AI 信号 → 实盘执行 (Futu OpenD) + 社区分享 + 性能护航 → v1.2.0-rc
```

---

## 🦐 5 虾分工 (13 任务)

### 🦞 ML (主龙虾) — 实盘 UI + 社区竞技 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **ML-58-01** | P0 | LiveExecutionConsole | AI信号→实盘执行控制台 — 信号审批/仓位确认/一键执行/成交回报 | ≥350L |
| **ML-58-02** | P0 | ArenaCommunityShare | 竞技场社区分享 — 分享结果卡片/社区投票/讨论/排行榜小组件 | ≥300L |
| **ML-58-03** | P1 | AIPerformanceDashboard | AI性能仪表板 — 缓存命中率/成本趋势/延迟分布/模型对比 | ≥250L |

**总代码量**: ≥900L

---

### ⚙️ JVS (后端主力) — 实盘桥接 + 社区后端 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **J-58-01** | P0 | live-execution-bridge | AI信号→Futu OpenD 桥接 — 信号审批→下单→成交回报→状态同步 | ≥450L |
| **J-58-02** | P0 | arena-social-engine | 竞技场社区引擎 — 分享/投票/评论/排行榜持久化 | ≥350L |
| **J-58-03** | P1 | ai-cost-monitor | AI成本监控 — 每Agent/每Model成本追踪+预算告警+趋势预测 | ≥250L |

**总代码量**: ≥1050L

---

### 🧪 QClaw (质量保障) — 实盘安全测试 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **Q-58-01** | P0 | live-execution 安全测试 | 信号→下单→风控→成交 全链路安全验证 (≥30 tests) | ≥300L |
| **Q-58-02** | P0 | 全量回归 4550→4700+ | 5 轮 0 fail | ≥100L |
| **Q-58-03** | P1 | 社区竞技测试 | 分享/投票/排行榜 数据一致性 (≥20 tests) | ≥200L |

**总代码量**: ≥600L

---

### 📋 PM (守护者) — v1.2.0-rc 发布 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **PM-58-01** | P0 | 5 轮守护循环 | tsc + build + test 4700+ 0 fail | ≥150L |
| **PM-58-02** | P0 | v1.2.0-rc 发布 | CHANGELOG + version bump + tag + GitHub Release + 升级指南 | ≥200L |

**总代码量**: ≥350L

---

### 📝 youdao (文档官) — v1.2.0 文档 + 出版 [P1]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **D-58-01** | P1 | v1.2.0 AI协作完整指南 | 4 Agent/竞技场/调度/实盘 全模块使用指南 | ≥300L |
| **D-58-02** | P1 | v1.2.0 Release Notes | 完整版本说明 + 升级路径 + 已知问题 | ≥250L |

**总代码量**: ≥550L

---

## 📊 R58 任务汇总

| 角色 | 任务数 | 代码量 | 优先级 |
|------|--------|--------|--------|
| 🦞 ML | 3 | ≥900L | P0/P1 |
| ⚙️ JVS | 3 | ≥1050L | P0/P1 |
| 🧪 QClaw | 3 | ≥600L | P0/P1 |
| 📋 PM | 2 | ≥350L | P0 |
| 📝 youdao | 2 | ≥550L | P1 |
| **总计** | **13** | **≥3450L** | |

---

## 🗺️ 执行时间线（建议）

```
R58 Launch  ──── 2026-06-09 02:30 (PM确认)
JVS 后端      ─── 02:30 ~ 05:30 (3h)
ML 前端       ─── 02:30 ~ 05:30 (3h)
QClaw 测试    ─── 03:30 ~ 06:30 (跟随)
PM 守护/发布  ─── 持续 ~ 07:00
youdao 文档   ─── 03:00 ~ 06:00
R58 收尾      ─── 07:00 deadline
```

---

## 🚨 风险提示

| 风险 | 等级 | 说明 | 缓解 |
|------|------|------|------|
| 实盘执行安全 | 🔴高 | AI 信号直接下单可能造成资金损失 | 必须过人工审批 + 风控 + 仓位限制 |
| Futu OpenD 稳定性 | 🟡中 | API 限流/断连 | 已有 live-trade-bridge，增量连接 |
| AI 成本失控 | 🟡中 | 社区竞技可能导致大量并发分析 | 预算上限 + 频率限制 |

---

## ✅ 验收标准

| 标准 | 目标 |
|------|------|
| 测试通过 | **4700+ / 0 fail** |
| TypeScript | **0 errors** |
| Build | **0 errors** |
| 实盘执行 | **AI信号→审批→Futu OpenD→成交 全链路** |
| 社区竞技 | **分享/投票/排行榜 可用** |
| 成本监控 | **每Agent/每Model 成本追踪 Dashboard** |
| 稳定性 | **5 轮 0 fail** |
| v1.2.0-rc | **GitHub Release 发布** |

---

## 🎯 R58 在全局中的位置

```
R52: 策略市场        (v1.1.0-alpha)  ✅
R53: 社交交易核心    (v1.1.0-beta)   ✅
R54: 社交交易收尾    (v1.1.0-beta)   ✅
R55: v15 商业模型    (v1.1.0-final)  ✅
R56: TradingAgents   (v1.2.0-alpha)  ✅
R57: AI闭环+竞技     (v1.2.0-beta)   ✅
R58: AI实盘+社区     (v1.2.0-rc)     📋 ← 本轮
R59: v1.2.0 正式版   (v1.2.0-final)  🔮
```

**PM 路线图对应**: R56(接口) → R57(真实实现) → **R58(实盘+社区)** → R59(付费/正式版)

---

**📌 等待 PM 确认 R58 计划后开干！**
