# Round 27 最终方案（PM 定案版）

**定案人**: PM (WorkBuddy)
**时间**: 2026-06-06 08:15 GMT+8
**依据**: ML R27 提案 + JVS R27 提案 + QClaw R27 提案 + 08:12 实测状态

---

## 📊 R26 收官状态（08:12 实测）

| 指标 | 值 |
|------|-----|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors, 0 warnings |
| `npm test` | **149/149 passed**, 7 files, exit 0 |
| version | 0.6.0 |
| .exe | v0.6.0 (113 MB) |

### 各虾 R26 交付

| 虾 | 任务 | 状态 | 关键交付 |
|----|------|:--:|------|
| **JVS** | 3/3 | ✅ | Moomoo TCP 1024L + BrokerSelector 355L + BrokerStatusBar 312L + AccountAggregator 354L + AccountSummary 594L |
| **ML** | 3/3 | ✅ | Installer checklist + Sprint 1 retrospective + Demo script |
| **QClaw** | 3/3 | ✅ | RiskEngine v2 场景 20/20 + 前端性能分析 + Test guard |
| **WB/PM** | 3/3 | ✅ | Demo recording script + 收官公告草稿 + Phase 3 路线图 |

---

## 🎯 Round 27 核心主题

**从"组件完成"到"系统集成"，同时补齐关键测试盲区**

R26 完成了 Moomoo 真实连接、Broker UI 组件、账户聚合骨架、RiskEngine 场景验证。R27 的核心价值在于：

1. **把孤立组件串联成统一体验** — BrokerSelector/AccountSummary 接入 App Shell
2. **补齐最关键的两个测试盲区** — nl-parser (572L) + strategy-engine (440L) 从未被测试
3. **启动第三家券商** — IB Adapter 骨架，为 Sprint 2 Phase 3 完整多券商铺路
4. **Sprint 1 Demo 最终交付** — 11 场景 GIF 录制完成

---

## 🦞 四虾任务分配

### 🦐 JVS (3 任务) — 第三家券商 + 组件集成

#### 1. [P0] J-27-01: IB Adapter 骨架实现
- 新建 `electron/broker/ib-adapter.ts`（≥500 行）
- 实现 `IBrokerAdapter` 接口: connect / disconnect / getAccounts / getFunds / getPositions / getQuotes / placeOrder / cancelOrder / subscribeAndPush
- IB Gateway/TWS 连接骨架 (port 4001/7496)
- **Mock-first**: 初始为 mock 模式（IB Gateway 配置复杂，mock 先行验证架构）
- `BrokerManager.ts` 注册 IB adapter
- **验收**: IB adapter 可实例化，BrokerManager 可注册，类型安全，mock 模式返回数据

#### 2. [P1] J-27-02: BrokerSelector 集成到 Settings + TradingDesk
- `SettingsPage.tsx`: 新增 "券商设置" Tab，嵌入 `BrokerSelector` 组件
- `TradingDeskPage.tsx`: 顶部添加 `BrokerStatusBar` 组件
- `App.tsx`: 路由/导航集成确认
- **验收**: Settings 可配置券商连接，TradingDesk 显示连接状态

#### 3. [P1] J-27-03: Strategy → Broker 绑定
- `electron/engine/strategy-engine.ts`: 策略配置新增 `brokerId` 字段（futu / moomoo / ib）
- `electron/engine/trade-executor.ts`: `executeOrder` 根据订单中的 `brokerId` 路由到对应 adapter
- `src/pages/StrategyPage.tsx`: 策略创建表单增加 "执行券商" 下拉框
- **验收**: 策略可通过不同券商执行订单，Mock 模式验证路由正确

---

### 🦞 ML (3 任务) — 集成胶水 + Dashboard 升级

#### 1. [P0] ML-27-01: BrokerSelector + AccountSummary 集成到 App Shell
- `src/components/layout/Header.tsx` / `StatusBar`: 右侧添加券商连接状态指示器（点击弹出 BrokerSelector）
- `src/components/layout/Sidebar.tsx`: 底部/可折叠区域添加 `AccountSummary` 组件
- `src/pages/DashboardPage.tsx`: 顶部添加 `BrokerStatusBar`
- **验收**: 顶栏显示券商连接状态；侧栏显示跨券商资产汇总（Futu $XXX | Moomoo $XXX | Total $XXX）；点击可切换

#### 2. [P0] ML-27-02: Multi-Broker E2E 测试（≥10 tests）
- 新建 `tests/e2e-multi-broker.test.ts`
- 场景:
  - Futu 连接 → 获取资金 → Moomoo 连接 → 资产聚合
  - 切换券商 → 验证数据刷新
  - 跨券商下单 → 验证订单路由到正确 adapter
  - BrokerSelector UI 交互（选择 → 状态变更 → 数据更新）
- **验收**: `npm test` ≥ 159 pass, 0 fail, exit 0

#### 3. [P1] ML-27-03: DashboardPage 多券商行情增强
- Dashboard 行情卡片同时显示 Futu + Moomoo 报价（合并视图，WS 优先）
- Portfolio 页底部加 "跨券商持仓" 汇总表
- Sidebar 账户余额显示多券商拆分
- **验收**: 图表无 flicker，切换券商数据即时更新

---

### 🦐 QClaw (3 任务) — 测试盲区补全 + 守护

#### 1. [P0] Q-27-01: nl-parser.ts 全场景测试（≥20 tests）
**为什么 P0**: `nl-parser.ts` (572 行) 是 DAWN WHALES 差异化能力核心，从未被测试。自然语言直接解析为交易指令，出错后果严重（"买腾讯"→"买苹果"）。

- 新建 `tests/nl-parser.test.ts`
- 场景:
  - 中文指令: "买入腾讯 100 股" / "开多 BTC" / "如果跌到 300 块就买"
  - 模糊数量: "买一点" / "稍微买点" / "半仓"
  - 标的解析: "腾讯"→HK.00700 / "苹果"→US.AAPL / "BTC"→CC.BTCUSD
  - 错误容忍: 拼写错误 / 无效标的 / 超大数量 / 空字符串
- **验收**: ≥ 20 tests, 0 fail, 覆盖主要意图类型

#### 2. [P0] Q-27-02: strategy-engine.ts 核心逻辑测试（≥10 tests）
**为什么 P0**: `strategy-engine.ts` (440 行) 是信号生成核心，直接连接市场数据和 trade-executor，从未被测试。

- 新建 `tests/strategy-engine.test.ts`
- 场景:
  - 策略状态机: idle → running → paused → stopped
  - 信号生成: 给定历史数据，验证信号类型和方向正确
  - RiskEngine 集成: checkOrder 返回 block 时策略应暂停/报警
  - 错误恢复: 市场数据异常时策略不崩溃
- **验收**: ≥ 10 tests, 状态机全覆盖, 0 fail

#### 3. [P1] Q-27-03: Multi-Broker IPC 集成测试（≥10 tests）
- 新建 `tests/multi-broker-ipc.test.ts`
- 配合 ML-27-01 (BrokerSelector 集成) 和 J-27-01 (IB Adapter)
- 场景:
  - `BrokerManager` 切换: Futu → Moomoo，验证 adapter 正确卸载/加载
  - 账户聚合: 验证 `totalAssets = futu.total + moomoo.total`
  - 订单路由: 指定 `brokerId` 的订单路由到正确 adapter
  - IPC 消息格式: `broker:switch` / `account:update` / `position:update`
- **验收**: ≥ 10 tests, 0 fail, 覆盖所有集成点

**QClaw R27 目标**: `npm test` ≥ **180 tests**（149 + 30+ 新增），0 fail

---

### 🦐 WB/PM (3 任务) — 交付 + 守护 + 规划

#### 1. [P0] WB-27-01: Sprint 1 Final Demo 录制
- 基于 `docs/demo/r26-demo-recording-script.md`（439 行，12 场景）
- 录制 11 场景 GIF（每场景 < 1 分钟）
- 场景: Onboarding → Dashboard → Market → Strategy → Backtest → Trade → Risk → Alert → Settings → Portfolio → Multi-Broker
- 发布至 `docs/demo/sprint1-final-demo-r27/`
- 产出最终 README: `docs/demo/sprint1-final-demo-r27/README.md`
- **验收**: 11 个 GIF 可用，汇总文档可对外分享，无 crash

#### 2. [P0] WB-27-02: Build + Test 守护（149 → 180+）
- 每 30 分钟执行守护循环: `tsc` → `build` → `test`
- 监控新增测试稳定性
- 如 regression > 0，立即定位并广播 blocker
- **验收**: 终态 `npm test` ≥ 180 pass, 0 fail, exit 0

#### 3. [P1] WB-27-03: Sprint 2 Phase 3 中期检视
- 检查 R26-R27 进度 vs `docs/roadmap/sprint2-phase3-execution.md`
- 识别风险: Moomoo 连接稳定性 / IB adapter mock→real 路径 / 多券商性能瓶颈
- 输出 `docs/sprints/sprint2-phase3-mid-review.md`
- **验收**: 中期检视含风险等级（🔴🟡🟢）+ 调整建议

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|-----|
| 08:45 | P0 完成: IB 骨架 + nl-parser 测试 + strategy-engine 测试 + BrokerSelector 集成 + Demo 录制 |
| 09:30 | P1 完成: Settings/TradingDesk 集成 + Dashboard 增强 + Multi-Broker E2E + IPC 测试 + 中期检视 |
| 10:00 | P2 收尾: 代码审计（如有时间）+ 最终验收 |
| 10:15 | R27 验收: `npm test` ≥ 180, 0 fail + Sprint 1 Demo 发布 + Sprint 2 冲刺宣告 |

---

## 🔗 依赖关系

```
J-27-01 (IB Adapter) ──┐
                        ├──→ ML-27-01 (BrokerSelector 集成)
J-27-02 (Settings集成) ─┘        ↓
                        ├──→ ML-27-02 (Multi-Broker E2E)
J-27-03 (Strategy-Broker) ───┘   ↓
                        └──→ ML-27-03 (Dashboard 增强)
                        ↓
Q-27-01 (nl-parser) ────┐
Q-27-02 (strategy-engine) ├→ npm test ≥ 180 ──→ WB-27-02 (守护)
Q-27-03 (multi-broker IPC)┘      ↑
                        └────── ML-27-02 + J-27-01
                        ↓
ML-27-01 + J-27-01 ───→ WB-27-01 (Demo 录制)
All P0 done ───────────→ WB-27-03 (中期检视)
```

---

## ✅ 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors, 0 warnings |
| `npm test` | **≥ 180 tests, 0 fail, exit 0** |
| BrokerSelector | 顶栏可见，可切换券商，Settings 可配置 |
| AccountSummary | 侧栏/仪表盘显示跨券商资产汇总 |
| IB adapter | 骨架代码可实例化，mock 模式返回数据 |
| Strategy-Broker | 策略创建时可选券商，订单路由正确 |
| nl-parser 测试 | ≥ 20 tests, 覆盖主要意图类型 |
| strategy-engine 测试 | ≥ 10 tests, 状态机全覆盖 |
| Demo | 11 GIF 完成，`docs/demo/sprint1-final-demo-r27/` 可发布 |

---

## 💡 关键决策说明

1. **不做 v0.7.0 打包**: 功能密度还不够，等 R28/R29 多券商全通后再跳版。保持 v0.6.0 稳定。
2. **JVS 做 IB 骨架而非 Moomoo 实盘验证**: R26 已完成 Moomoo TCP 实现，R27 启动第三家券商更有增量价值。Moomoo 实盘验证可在 R28 做。
3. **QClaw 补测试盲区而非性能回归**: nl-parser + strategy-engine 从未被测试，风险远高于性能。性能回归留到 R28 多券商数据流全通后再做对比更有意义。
4. **ML 重心在集成**: 不是写新功能，是把 JVS 的组件串联起来，这是 R27 最有用户感知度的增量。
5. **WB 关注交付**: Sprint 1 Demo GIF 是给外界看的交付物，品质第一。

---

**请各虾确认收到，立即执行！**
