<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# Phase 5.0 路线图 — DAWN WHALES

> 版本: v0.8.0 → v1.0.0
> 状态: Phase 4.4 中 → Phase 5.0 规划
> 时间: 2026-06-07

---

## 当前状态 (R37 收官)

| 指标 | 值 |
|------|-----|
| 测试 | 1527 passed / 0 fail |
| 引擎 | 12 个核心引擎 (Condition/ClosedLoop/Rebalance/PositionMonitor/PerformanceTracker/Backtest/Risk/Strategy/TradeExecutor/AdaptiveParam/Reward/Bridge) |
| UI 组件 | 20+ 组件 (Dashboard/StrategyPage/Trading/Market) |
| 文档 | 50+ 文档 (API/架构/审查/规划) |
| 团队 | 5 虾全勤 |

---

## Phase 5.0 核心目标

从 **Phase 4.x 的"工具链就绪"** 升级到 **Phase 5.0 的"自主交易就绪"**。

### 三大支柱

```
Phase 5.0 自主交易
├── 1. Multi-Timeframe (多周期)
│   ├── K线回放引擎 (R38 JVS)
│   ├── 多周期回测 (1m/5m/15m/1h/4h/1d)
│   └── 跨周期信号融合
│
├── 2. Portfolio Analytics (组合分析)
│   ├── 多策略组合优化
│   ├── 相关性矩阵 + 风险预算
│   ├── 资金分配最优配置
│   └── 绩效归因 (选股/时机/风控)
│
└── 3. Live Trading (实盘交易)
    ├── 纸交易模式 (PaperTrader)
    ├── 渐进式实盘 (1%→5%→全量)
    ├── 自动风控熔断
    └── 交易日志 + 复盘
```

---

## 详细路线图

### R38 (Phase 4.4) — 自主决策引擎
- ✅ SystemHealthPanel (ML)
- ✅ AdaptiveParamPanel (ML)
- 🔄 AdaptiveParamEngine (JVS)
- 🔄 RewardEngine (JVS)
- 🔄 测试 1550+ (QClaw)
- 🔄 v0.8.0 发布 (PM)
- 🔄 R37 审查 + v0.8.0 CHANGELOG (dao)

### R39 (Phase 5.0 Kick-off) — 多周期基石
- Multi-Timeframe 回测引擎
- K线回放完善 (倍速/断点续播)
- 跨周期信号验证
- 测试 1600+

### R40 (Phase 5.0 Core) — 组合分析
- Portfolio Analytics 引擎
- 相关性矩阵
- 资金分配优化器
- 绩效归因报告
- 测试 1650+

### R41 (Phase 5.0 Live) — 实盘就绪
- PaperTrader 完善
- 渐进式实盘开关
- 自动风控降级
- 交易日志 + 复盘系统
- 测试 1700+

### R42 (Phase 5.0 Final) — v1.0.0
- 全链路 E2E 验证
- 性能基准最终报告
- CHANGELOG v1.0.0
- 正式发布

---

## 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 多周期回测 | Canvas + Web Worker | 避免主线程阻塞 |
| 组合优化 | WebAssembly (rust → wasm) | 协方差矩阵计算性能 |
| 实盘风控 | 独立 Node.js 进程 | 进程隔离，主进程崩溃不影响 |
| 交易日志 | SQLite WAL 模式 | 并发写性能 |
| 复盘回放 | WebSocket + Canvas | 逐笔渲染 |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 多周期回测性能瓶颈 | 预计算 + 缓存 + Web Worker |
| 实盘资金安全 | 渐进式 (1% → 5% → 全量) + 双重确认 |
| 组合优化过度拟合 | 样本外验证 + 滚动窗口 |
| 5虾任务并行冲突 | 职责红线 + 主副双岗制 |

---

## 里程碑

| 阶段 | 目标 | 预计 |
|------|------|------|
| Phase 4.4 (R38) | v0.8.0 发布 | 当前 |
| Phase 5.0 Kickoff (R39) | 多周期回测可用 | R38 后 |
| Phase 5.0 Core (R40) | 组合分析就绪 | R39 后 |
| Phase 5.0 Live (R41) | 实盘就绪 | R40 后 |
| Phase 5.0 Final (R42) | v1.0.0 发布 | R41 后 |

---

*Phase 5.0: 让 DAWN WHALES 从"工具"进化为"交易伙伴"。*
