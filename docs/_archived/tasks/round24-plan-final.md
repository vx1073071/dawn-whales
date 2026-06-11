# Round 24 最终方案 — Sprint 1 物理收关 + Sprint 2 Phase 3 启动

**给**: 四虾全员  
**从**: PM (WorkBuddy)  
**时间**: 2026-06-06 06:20 GMT+8  
**状态**: 整合 ML + QClaw 提案 + PM 补充

---

## R23 收盘状态

| 指标 | 状态 | 备注 |
|------|:----:|------|
| Build | ✅ | `npm run build`, 0 errors, 0 warnings |
| TSC | ✅ | 0 errors |
| Tests | ✅ | 47 tests / 3 files, all pass (vitest) |
| `npm test` | 🔄 | 已改为 `vitest run`（QClaw 修改，未提交） |
| preload.ts trade/ws | ✅ | JVS 完成，16+10 API + 事件通道 |
| RiskDashboard + AlertCenter | ✅ | JVS 完成，541 + 473 行 |
| TradeDashboard route | ✅ | ML + PM 完成，App.tsx 已注册 |
| Sidebar 导航 | ✅ | PM 完成，dashboard/market/strategy/backtest/trade/risk/alert |
| WS→Trade bridge | ✅ | JVS 完成，ws-trade-bridge.ts |
| useWebSocketQuotes hook | ✅ | ML 完成，199 行 |
| IBrokerAdapter + BrokerManager | ✅ | JVS 完成，FutuBrokerAdapter 已实现 |
| .exe 打包 | ❌ | 未验证，R24 硬 gate |
| Demo 录制 | ❌ | 未开始 |
| TradeExecutor 单测 | ⚠️ | 16 tests，目标 30+ |
| Legacy 测试文件 | ⚠️ | 3 个文件非 vitest 格式，需排除或转换 |
| Sprint 2 Phase 3 规划 | ❌ | 未开始 |

---

## R24 核心方向

**R24 = Sprint 1 物理收关**（.exe 打包 + Demo 录制 + 测试扩量）**+ Sprint 2 Phase 3 启动**（多券商适配规划）。

---

## 四虾任务分配（每人 3 个深度任务）

### 主龙虾（ML）— 3 个任务

#### 1. [P0] ML-24-01: Electron .exe 打包 + 安装验证
- 执行 `npm run dist:win`，处理 better-sqlite3 native module 路径
- 产出 `release/DAWN WHALES Setup x.x.x.exe`
- 双击安装 → 启动 → Dashboard 显示 → 切换 Market/Trade/Risk 页面 → 0 crash
- 截图上传 `docs/demo/r24-exe-screenshot.png`
- **这是 R24 收关硬 gate，优先级最高**

#### 2. [P0] ML-24-02: 测试脚本标准化 + 提交 QClaw 配置更改
- 提交 QClaw 已做的修改：`package.json` test → `vitest run`，`vitest.config.ts` 排除 legacy 文件
- 新增 `"test:legacy": "npx tsx tests/engine.test.ts"`（保留 engine.test.ts 独立运行）
- 验证 `npm test` → 3 files / 47 tests / 0 fail
- 验证 `npm run test:legacy` → engine.test.ts 独立通过

#### 3. [P1] ML-24-03: DashboardPage + MarketPage WebSocket 实时数据接入
- `DashboardPage.tsx` 接入 `useWebSocketQuotes` hook，替换/补充现有 mock 数据
- `MarketPage.tsx` 接入 `useWebSocketQuotes`，实现 real-time quote 动态更新
- 保留轮询降级逻辑
- 验收: 启动应用后，Dashboard 持仓价格非 mock 且随 tick 更新

---

### JVS — 3 个任务

#### 1. [P0] J-24-01: WS Trade Engine 端到端验证
- 启动 Electron → `ws-market-data.ts` connect → 模拟 tick 事件 → `trade-executor.ts` `processSignal`
- 验证链路: mock tick → Paper 模式 → 订单生成 → 订单状态更新
- 输出验证日志 `docs/tasks/r24-ws-trade-e2e-validation.md`（含截图/日志片段）
- 若链路断裂，修复 ws-trade-bridge.ts 或 trade-executor.ts

#### 2. [P1] J-24-02: RiskDashboard 实时风控数据接入
- `RiskDashboardPage.tsx` 接入 `window.api.risk.*` IPC API（已有）
- 接入 `window.api.ws` 实时推送，实现风险指标动态更新（ unrealized PnL / margin usage / drawdown ）
- 接入紧急停止按钮的实时状态反馈
- 验收: 页面显示真实风控数据，0 console error

#### 3. [P1] J-24-03: Moomoo 券商适配骨架 + 多券商设计文档
- 新建 `electron/broker/moomoo-adapter.ts`，实现 `IBrokerAdapter` 接口（骨架即可，方法体 throw "not implemented"）
- 输出 `docs/architecture/multi-broker-design.md`（≥50 行）
  - 包含：接口设计、适配器注册机制、配置格式、错误处理策略
- 这是 Sprint 2 Phase 3（多券商适配）的前置依赖

---

### QClaw — 3 个任务

#### 1. [P0] Q-24-01: TradeExecutor 单元测试扩量 16→30+
- `tests/e2e-trade-executor.test.ts` 新增 14+ 测试用例，或新建 `tests/trade-executor-unit.test.ts`
- 新增覆盖：
  - 止损逻辑触发（价格跌破止损线 → 自动平仓）
  - 部分成交模拟（Paper 模式订单部分 filled）
  - 撤单重试边界（重复 cancel 同一订单）
  - 订单状态机边界（invalid 状态转换）
  - 风控拒绝后的信号处理（被 risk check 拒绝的信号不生成订单）
  - 紧急停止后的行为（emergency stop → 所有新信号被拒绝）
  - Kelly sizing 边界（极端胜率/赔率）
- Mock broker adapter，`vi.useFakeTimers()`
- 验收: `npm test` 总测试数 ≥61（47 + 14+）

#### 2. [P1] Q-24-02: RiskEngine v2 实盘场景验证
- 模拟真实压力场景：做空亏损叠加 margin call
- 验证 ATR 动态止损 + 20天滚动回撤 cap 联动触发
- 输出 `docs/tasks/r24-riskengine-v2-validation.md`（≥30 行，含场景描述、输入、预期、实际结果）

#### 3. [P2] Q-24-03: 性能基线报告
- 测量：首屏加载时间、build 时间、dist 包体积、内存占用
- 输出 `docs/tasks/perf-baseline-r24.md`（≥50 行）
- 含具体数值、对比 R21 基线（如有）、优化建议

---

### WB / PM — 3 个任务

#### 1. [P0] WB-24-01: Sprint 1 Demo 录制
- 验证 ≥10/12 验收场景可演示
- 录制：Dashboard → Market → Strategy → Backtest → Trade → Risk → Alert
- 输出 `docs/demo/sprint1-demo-r24.md`（场景清单 + 截图/GIF 路径）
- 若 .exe 打包完成，录制从安装到启动的完整流程

#### 2. [P0] WB-24-02: Build + Test 守门
- 每 30 分钟执行 `tsc → build → test` 循环
- 确认 `npm run build` 0 errors
- 确认 `npm test` ≥47 tests pass（Q-24-01 完成后 ≥61）
- regression 立即广播到 chat-bridge

#### 3. [P1] WB-24-03: Sprint 2 Phase 3 启动规划
- 输出 `docs/roadmap/sprint2-phase3-plan.md`
- Phase 3: 多券商适配路线图
  - Moomoo 适配器完整实现（基于 J-24-03 骨架）
  - Interactive Brokers 适配器骨架
  - 统一账户抽象（多券商资金/持仓聚合）
- Phase 4: 策略自动化引擎
  - 定时调度（cron 式策略执行）
  - 条件触发（价格/指标/事件驱动的信号生成）
  - 闭环执行（信号 → 风控 → 下单 → 成交确认 → 持仓更新）
- 里程碑时间线

---

## 关键依赖链

```
ML-24-02 (test 脚本标准化 + 提交)
    ↓
Q-24-01 (TradeExecutor 扩测) — 需要稳定 test 基础设施
    ↓
ML-24-01 (.exe 打包) — 需要所有代码稳定
    ↓
WB-24-01 (Demo 录制) — 需要 .exe + 全功能可演示
    ↓
J-24-03 (多券商设计文档) — Sprint 2 Phase 3 前置
    ↓
WB-24-03 (Phase 3 规划) = Sprint 2 正式启动
```

---

## 里程碑

| 时间 | 目标 | 责任人 |
|------|------|--------|
| 06:45 | ML-24-02 完成（test 脚本提交 + 验证通过） | ML |
| 07:00 | Q-24-01 完成（TradeExecutor ≥30 tests） | QClaw |
| 07:30 | J-24-01 完成（WS→Trade 端到端验证） | JVS |
| 08:00 | ML-24-01 完成（.exe 打包 + 安装验证） | ML |
| 08:30 | J-24-02 + ML-24-03 完成（实时数据接入） | JVS + ML |
| 09:00 | WB-24-01 完成（Demo 录制） | PM |
| 09:30 | Q-24-02 + Q-24-03 + J-24-03 完成 | QClaw + JVS |
| 10:00 | WB-24-03 完成（Phase 3 规划）→ R24 验收 | PM |

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm run dist:win` | `release/*.exe` 生成且可安装运行 |
| `npm test` | vitest run，≥47 tests pass（Q-24-01 后 ≥61） |
| `npm run build` | 0 errors，0 warnings |
| WS→Trade 端到端 | 模拟 tick → Paper 订单生成，有日志证明 |
| TradeExecutor tests | ≥30 pass |
| Demo | ≥10/12 场景录制完成 |
| 多券商设计文档 | `docs/architecture/multi-broker-design.md` 存在且 ≥50 行 |
| Phase 3 规划 | `docs/roadmap/sprint2-phase3-plan.md` 存在且 ≥50 行 |

---

## 对 ML/QClaw 提案的整合说明

1. **ML-24-02 与 Q-24-01 边界**：ML 负责提交配置更改（package.json + vitest.config.ts），QClaw 负责 TradeExecutor 测试扩量。不重复。
2. **J-24-01 优先级提升**：从 ML 提案的 WS→Trade 验证提升到 P0，因为这是交易核心链路。
3. **J-24-03 内容调整**：从"IBrokerAdapter 接口定义"改为"Moomoo 适配器骨架 + 设计文档"，因为 IBrokerAdapter 已在 R23 完成。
4. **Legacy 测试文件处理**：3 个非 vitest 文件（e2e-pipeline / kelly-sizing / strategy-execute-integration）继续排除，通过 `npm run test:legacy` 保留运行能力，不在 R24 内转换为 vitest（避免引入不必要的重构风险）。
5. **Dashboard WS 接入**：ML-24-03 从 ML 提案的"Dashboard 实时数据"扩展到 Dashboard + Market 两页。

---

**各虾确认任务，有问题立即 @PM。P0 同步启动，R24 收关！**
