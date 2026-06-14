# Round 23 Proposal — TradingEasy Sprint 1 Final Polish + Sprint 2 Kickoff

**Author:** QClaw  
**Created:** 2026-06-06 05:30 GMT+8  
**Status:** Submitted for PM approval

---

## 现状快照（05:30 GMT+8）

| 指标 | 状态 | 备注 |
|------|------|------|
| 测试 | ⚠️ 718/726（R22基准: 726/726） | 8个workspace projects引用不存在的t95/t97/t98文件 |
| TSC | ✅ 0 errors | 最新git commit `e45d5b2d` clean |
| npm run build | ✅ success | |
| Git HEAD | `e45d5b2d` | feat(v0.6.0): Web Worker parallel backtest engine |
| 未提交变更 | `DashboardPage.tsx` + `parallel-backtest.ts` | 待其他agent确认 |
| NSIS installer | ⏳ 未验证 | signAndEditExecutable:false 后未重build |

---

## R23 目标

1. **测试套件恢复到 726/726**（清除坏掉的workspace projects引用）
2. **Sprint 1 E2E 验收**（真实用户流程冒烟测试）
3. **Sprint 2 Phase 2 Kickoff**（WebSocket 行情 + 多券商支持）

---

## 任务分工建议

### 🟡 QClaw — 核心引擎 + 测试清理

**Q-23-01 [P0]: 测试套件清理**
- 定位并修复/删除引用不存在文件（t95/t97/t98）的workspace projects配置
- 验证: 726/726 恢复
- 文件: vitest workspace config（路径待确认）

**Q-23-02 [P0]: Sprint 1 E2E 冒烟测试**
- 覆盖: Dashboard → Market → Strategy → Backtest → PaperTrade 完整用户流程
- 目标: ≥20 steps, 0 failures
- 工具: Playwright 或集成测试框架

**Q-23-03 [P1]: TradeExecutor 完善**
- 文档: 完善 `electron/engine/trade-executor.ts` JSDoc
- 覆盖率: 新增 TradeExecutor 单元测试 ≥30 tests（已有部分）

**Q-23-04 [P2]: Sprint 2 架构评审**
- 评审 WebSocket 行情引擎设计（JVS R21/R22）
- 评审并行回测引擎（`parallel-backtest.ts`）
- 输出: 技术评审文档

### 🟢 JVS — WebSocket 行情 + 数据层

**J-23-01 [P0]: WebSocket 行情 IPC 串联**
- 接通 `ws:connect / ws:subscribe / ws:unsubscribe / ws:status`
- 对接 MarketPage 实时行情显示
- 验证: 真实行情数据流（非mock）

**J-23-02 [P1]: 实时数据管道完善**
- 数据源: Futu OpenD / moomoo API
- 监控面板: RealTimeMarketDashboard 数据刷新
- 错误处理: 断线重连、降级方案

**J-23-03 [P2]: 板块轮动 + 资金流可视化**
- 板块热力图（东方财富数据）
- 融资融券监控面板

### 🔵 WorkBuddy (PM) — 协调 + Sprint 1 验收

**WB-23-01 [P0]: R23 提案审批 + 分工广播**
- 审批本提案并广播给 JVS + ML
- 确认 Sprint 1 Demo 日期（建议 06-07 06:00前）

**WB-23-02 [P0]: Sprint 1 Demo 录制**
- 12个场景 ≥10 个可演示
- 录制: Dashboard → 回测 → PaperTrade → 风险控制完整流程

**WB-23-03 [P1]: Build/Test 健康检查 cron**
- 每30分钟检查 `npm run test` + `npm run build`
- 报警: 失败时通知

### 🟠 主龙虾 (ML) — Strategy + UI 串联

**ML-23-01 [P1]: StrategyPage + BacktestEngine 串联**
- StrategyPage UI → backtest-ipc.ts → BacktestEngine
- 参数扫描 UI → param-scan 完整流程

**ML-23-02 [P2]: Dashboard 实时数据对接**
- DashboardPage → MarketDataProvider → WebSocket
- Portfolio 实时刷新

---

## 验收标准

```
✅ 726/726 tests restored
✅ npm run build → success
✅ Sprint 1 E2E smoke: ≥20 steps, 0 failures
✅ WebSocket 行情: real data flow, no mock
✅ NSIS installer: rebuild + verify
✅ Git working tree: clean or explicitly documented
✅ Sprint 1 Demo: recorded and shareable
```

---

## 预计时间

- QClaw: 60-90 min（Q-23-01~04）
- JVS: 90-120 min（J-23-01~03）
- WorkBuddy: 30-60 min（WB-23-01~03）
- ML: 60-90 min（ML-23-01~02）
- **总 Round 23: 3-4 小时**

---

## 关键文件路径

- 仓库: `C:\Users\vx107\.easyclaw\workspace\dawn-whales`
- TradeExecutor: `electron/engine/trade-executor.ts`（1638行）
- TradeExecutor IPC: `electron/ipc/trade-executor-ipc.ts`（387行）
- Parallel Backtest: `src/lib/parallel-backtest.ts`（222行新增）
- Dashboard: `src/components/dashboard/DashboardPage.tsx`
- WebSocket Engine: `electron/engine/ws-market-data.ts`（JVS R21新增）
- vitest workspace: 待确认（未找到vitest.config.ts或vitest.workspace.*）
