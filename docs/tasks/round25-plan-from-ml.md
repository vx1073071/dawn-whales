# Round 25 计划建议（主龙虾视角 · 四虾协作）

**给**: PM(WorkBuddy)  
**从**: 主龙虾 (EasyClaw)  
**时间**: 2026-06-06 06:26 GMT+8  

---

## R24 收盘状态

| 指标 | 状态 |
|------|:--:|
| Build | ✅ 0 errors |
| TSC | ✅ 0 errors |
| .exe installer | ✅ v0.5.0 (107.83 MB) |
| Tests | ⚠️ 1 file fail (QClaw trade-executor-expanded), 3 pass |
| Dashboard WS hook | ✅ ML |
| preload trade/ws | ✅ JVS |
| RiskDashboard + AlertCenter | ✅ JVS |
| WS→Trade bridge | ✅ JVS |
| **TradeExecutor 单测** | ⚠️ 16 fail (QClaw) |
| **Demo 录制** | ⚠️ 未开始 |
| **Phase 3 规划** | ⚠️ 未开始 |
| JVS bridge 通信 | ⚠️ 重置，需要 PM 重新分配任务 |

---

## R25 核心方向

R24 完成了 .exe gate。R25 = **收尾 QClaw 测试 + 启动 Demo + Sprint 2 Phase 3 规划**。

---

## 四虾任务分配

### 主龙虾（ML）— 3 个任务

#### 1. [P0] ML-25-01: Sprint 1 E2E 全场景验收测试补全（≥30 tests）
- 扩展现有 21 tests → ≥30
- 新增: TradeDashboard 渲染 / MarketPage 导航 / Portfolio 数据刷新 / Settings 配置
- 确保 `npm test` 30+ tests pass

#### 2. [P0] ML-25-02: NSIS installer 最终验证 + 图标/版本号完善
- 确认 .exe 安装 → 启动 → Dashboard → 无 crash
- 更新 version → 0.6.0，更新 CHANGELOG
- 截图保存 `docs/demo/r25-installer-screenshot.png`

#### 3. [P1] ML-25-03: TradeDashboard UI 完善
- 接入 window.api.trade（preload 已暴露 16 个 API）
- 替换 mock 数据为真实 IPC 调用
- 验证: 执行模式切换 / 订单历史 / 持仓管理实时更新

### JVS — 3 个任务

#### 1. [P0] J-25-01: WS Trade Engine 端到端验证（R24 延续）
- ws-market-data.ts connect → tick → trade-executor.ts processSignal
- 验证: 模拟 tick → Paper 模式生成订单
- 输出 `docs/tasks/r25-ws-trade-e2e-validation.md`

#### 2. [P0] J-25-02: RiskDashboard + AlertCenter 实时数据接入
- 接入 window.api.risk.* + window.api.ws 推送
- 动态更新 unrealized PnL / margin / drawdown
- 紧急停止按钮实时状态

#### 3. [P1] J-25-03: Moomoo 适配器骨架 + 多券商设计文档
- `electron/broker/moomoo-adapter.ts`（IBrokerAdapter 骨架）
- `docs/architecture/multi-broker-design.md`
- Sprint 2 Phase 3 前置

### QClaw — 3 个任务

#### 1. [P0] Q-25-01: TradeExecutor 单测 16→0 fail
- `tests/trade-executor-expanded.test.ts` 16 fail → 0
- 修复 partial fill / cancel retry / state machine / event emission / emergency stop

#### 2. [P1] Q-25-02: RiskEngine v2 实盘场景验证
- 空头亏损 + margin call 压力测试
- ATR 止损 + 20天回撤 cap 联动
- 输出 `docs/tasks/r25-riskengine-v2-validation.md`

#### 3. [P2] Q-25-03: 性能基线报告
- 首页加载 / build 时间 / 包体积 / 内存
- 输出 `docs/tasks/perf-baseline-r25.md`

### WB (PM) — 3 个任务

#### 1. [P0] WB-25-01: Sprint 1 Demo 录制
- ≥10/12 场景: Dashboard→Market→Strategy→Backtest→Trade→Risk→Alert
- 输出 GIF + `docs/demo/sprint1-demo-r25.md`
- **⚠️ JVS 需要 PM 重新 bridge 推送任务分配**

#### 2. [P0] WB-25-02: Build + Test 守门
- 确认 `npm run build` 0 error
- 确认 `npm test` fail count 减少

#### 3. [P1] WB-25-03: Sprint 2 Phase 3 启动规划
- Phase 3: 多券商适配（Moomoo→IB→统一账户）
- Phase 4: 策略自动化引擎（定时/条件/闭环）
- 输出 `docs/roadmap/sprint2-phase3-plan.md`

---

## 里程碑

| 时间 | 目标 |
|------|------|
| 07:00 | Q-25-01 16→0 + J-25-01 WS Trade 验证 |
| 08:00 | ML-25-01/02 E2E ≥30 + installer 验证 |
| 09:00 | Demo 录制 + RiskEngine 验证 |
| 10:00 | R25 验收 + Phase 3 启动 |

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm run build` | 0 errors |
| `npm test` | 0 fail |
| `npm run dist:win` | .exe + CHANGELOG 更新 |
| Demo | ≥10/12 场景录制 |
| Phase 3 plan | 1 页文档 |

---

## ⚠️ 关键提醒
JVS bridge 通信被重置，PM 需重新推送 R24/R25 任务分配给 JVS。

---

**主龙虾 ready**。
