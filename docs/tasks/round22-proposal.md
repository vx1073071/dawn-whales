# Round 22 提案 — Trade Execution + Sprint 2 Phase 2 Integration

## 当前状态（2026-06-06 04:44 GMT+8）

| 指标 | 状态 |
|------|------|
| TypeScript 编译 | ✅ 0 errors |
| 单元测试 | ✅ 726/726 pass |
| npm run build | ✅ success |
| Electron .exe | ✅ 启动正常 |
| NSIS installer | ⚠️ `signAndEditExecutable:false` 已配置，待重新 build 验证 |
| IPC Full-Link smoke | ✅ 140/140 pass |
| Strategy/backtest tests | ✅ 27/27 pass |

### R22 已完成（另一个 agent）
- ✅ Test Zero achieved — 133 fail → 0 fail
- ✅ Trade Execution Engine — `electron/engine/trade-executor.ts` (1638 lines)
  - 7 项风险检查：position size / daily loss / max orders / duplicate signal / trading hours / concentration / confidence
  - Paper + Real 双模式，滑点模拟
  - 自定义 TypedEventEmitter，10 种事件类型
  - Broker Adapter 模式，仓位追踪，日盈亏计算
- ✅ `electron/ipc/trade-executor-ipc.ts` (387 lines) — 18 个 IPC handlers

---

## Sprint 2 Phase 2 任务清单

### 🔵 QClaw — 核心任务

**Q-22-01 [P0]: TradeExecutor 单元测试**
- `tests/trade-executor.test.ts` — 覆盖 7 项风险检查逻辑、Paper/Real 模式切换、仓位更新、TypedEventEmitter 事件、Broker Adapter 调用
- 目标：≥30 tests，100% pass

**Q-22-02 [P0]: TradeExecutor IPC 串联验证**
- `tests/trade-executor-ipc.test.ts` — 验证 18 个 IPC handler 全部可调用
- 覆盖：signal processing / risk checks / order management / position tracking / daily P&L / event forwarding

**Q-22-03 [P1]: TradeExecutor 与 Strategy/LiveExecutor 串联**
- 确认 `trade-executor.ts` 如何从 `live-executor.ts` 接收信号（IPC / 事件总线）
- 确认 `strategy.ts` 的 `update` 回调触发 TradeExecutor 的流程
- 验收：手动演示 signal → trade 完整链路

### 🟢 JVS — Phase 2 核心

**J-22-01 [P0]: WebSocket 行情引擎串联验证**
- `electron/engine/ws-market-data.ts` 与 TradeExecutor 信号联动
- WS 实时报价 → signal 生成 → TradeExecutor 执行
- 验收：WS 连接 → 订阅标的 → 实时 tick → 触发 signal 事件

**J-22-02 [P1]: MarketPage 行情数据完善**
- 接入 ws-market-data.ts 的实时数据
- 显示实时报价/涨跌/成交量

### 🟠 WorkBuddy (PM)

**WB-22-01 [P0]: 审批提案 + 广播分工**
**WB-22-02 [P0]: NSIS Installer 重新 build 验证**
- 运行 `npm run dist:win`，确认 `signAndEditExecutable:false` 绕过 winCodeSign macOS symlink 问题
- 确认 `.exe` installer 生成成功

**WB-22-03 [P1]: Sprint 1 Demo 最终验收**
- 12 个 Demo 场景逐一验收
- 录制 Demo 视频（06:00 前）

### 🟡 主龙虾 (ML)

**ML-22-01 [P1]: TradeDashboardPage UI**
- 实时 P&L 面板、持仓管理、交易历史
- TradeExecutor 事件监听展示

**ML-22-02 [P1]: Sprint 1 E2E 自动化测试补全**
- 补充 TradeExecutor 相关 E2E 场景

---

## 验收标准

```
✅ npx tsc --noEmit → 0 errors
✅ npm run build → success
✅ npm run dist:win → .exe installer 生成
✅ TradeExecutor tests ≥30/30 pass
✅ TradeExecutor IPC tests ≥18/18 pass
✅ signal → trade 完整链路可演示
✅ 726 existing tests still pass (no regression)
```

## 预计时间
- QClaw: 45-60 分钟
- JVS: 30-45 分钟
- WorkBuddy: 30 分钟
- ML: 45-60 分钟
- 总 Round 22: 1.5-2 小时

## 关键文件路径
- DAWN WHALES: `C:\Users\vx107\.easyclaw\workspace\dawn-whales`
- TradeExecutor: `electron/engine/trade-executor.ts`
- TradeExecutor IPC: `electron/ipc/trade-executor-ipc.ts`
- WS Market Data: `electron/engine/ws-market-data.ts`
- Live Executor: `electron/engine/live-executor.ts`
- Strategy Engine: `electron/engine/strategy/`
