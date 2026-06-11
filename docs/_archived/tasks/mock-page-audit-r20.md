# R20 Mock Page Audit — Sprint 1 vs Sprint 2 优先级评估

**Author**: 主龙虾  
**Date**: 2026-06-06  

---

## 审计清单

| 页面/组件 | 当前状态 | 是否使用 IPC | Sprint 1 需求 | Sprint 2 需求 |
|-----------|---------|:---:|:---:|:---:|
| **DashboardPage** | ✅ 已接入 IPC (R19) | ✅ | 已完成 | — |
| **PortfolioPage** | ✅ 已接入 IPC (R19) | ✅ | 已完成 | — |
| **StrategyPage** | ⚠️ 部分 IPC (回测 mock) | ⚠️ | P1 — 回测 IPC 接线 | — |
| **RiskDashboardPage** | ✅ v0.6.0 稳定版 | ⚠️ | P1 — IPC 接线 | — |
| **AlertCenterPage** | ✅ IPC-aware (fallback mock) | ⚠️ | P0 — IPC 接线完成 (R20) | — |
| **MarketPage** | ⚠️ 部分 IPC (K线 mock) | ⚠️ | P2 — 接入真实行情 | — |
| **TradingDeskPage** | ⚠️ mock 订单数据 | ❌ | P2 — 接入真实交易 | — |
| **MonteCarloPage** | ⚠️ mock 计算 | ❌ | — | ✅ Sprint 2 |
| **SentimentDashboardPage** | ⚠️ mock 情绪数据 | ❌ | — | ✅ Sprint 2 |
| **MarketplacePage** | ⚠️ mock 列表 | ❌ | — | ✅ Sprint 2 |
| **SmartPickerPage** | ❌ 纯 mock | ❌ | — | ✅ Sprint 2 |
| **DailyPnLSummary** | ⚠️ mock 数据 | ❌ | — | ⚠️ 可选 |
| **PortfolioRebalancerPage** | ❌ 纯 mock | ❌ | — | ✅ Sprint 2 |
| **RealTimeMarketDashboard** | ⚠️ mock (JVS 编码损坏) | ❌ | — | ✅ Sprint 2 |

---

## Sprint 1 优先级（必须完成）

| # | 页面 | 工作量 | 理由 |
|---|------|:---:|------|
| 1 | AlertCenter | ✅ Done (R20) | 告警是风控第一道防线 |
| 2 | StrategyPage 回测 | 500行 | 核心功能，Demo 必须展示 |
| 3 | RiskDashboard IPC | 300行 | 风控仪表盘 |
| 4 | MarketPage K线 | 400行 | 行情是产品门面 |

### Sprint 2 候选（Demo 后迭代）

| # | 页面 | 优先级理由 |
|---|------|-----------|
| 1 | MonteCarlo | 高级分析，非核心路径 |
| 2 | SentimentDashboard | JVS 负责，需完整数据源 |
| 3 | MarketplacePage | 策略市场，需社区功能 |
| 4 | TradingDeskPage | 真实交易，需要实盘账户 |
| 5 | PortfolioRebalancer | 高级调仓，Sprint 2 功能 |

---

## 建议

1. **Sprint 1 Demo 聚焦 6 个核心页面**: Dashboard / Portfolio / Strategy / RiskDashboard / AlertCenter / Market
2. **Sprint 2 对接**: MonteCarlo / Sentiment / Marketplace / TradingDesk
3. **永久 mock**: SmartPicker / DailyPnLSummary（非核心路径，mock 数据足够展示概念）
