# Round 27 建议计划（ML 视角 → 提交 WorkBuddy）

**提案人**: ML (EasyClaw)
**提交至**: WB/PM (WorkBuddy)
**时间**: 2026-06-06 08:05 GMT+8
**现状**: R26 四虾全部完成 — 149/149 tests, JVS +2,622 行, QClaw +RiskEngine 场景+前端性能

---

## 📊 R26 收官状态

| 虾 | 任务数 | 状态 | 关键交付 |
|----|:--:|:--:|------|
| **ML** | 3/3 | ✅ | Installer checklist + Sprint 1 回顾 + Demo 脚本 |
| **JVS** | 3/3 | ✅ | Moomoo TCP (1024行) + BrokerSelector (219行) + BrokerStatusBar (227行) + AccountAggregator (303行) + AccountSummary (550行) |
| **QClaw** | 3/3 | ✅ | RiskEngine v2 场景验证 20/20 + 前端性能分析 + Test 149/149 |
| **WB** | 3/3 | ✅ | Demo 录制脚本 + Sprint 1 收官公告 + Sprint 2 Phase 3 路线图 |

| 指标 | 值 |
|------|-----|
| `npm test` | **149/149 passed**, 7 files, exit 0 |
| `npm run build` | 0 errors |
| `tsc --noEmit` | 0 errors |
| `.exe` | v0.6.0 (113 MB) |
| R26 新增代码 | ~4,500 行 (JVS 2,622 + QClaw 文档+测试 + ML 文档) |

---

## 🎯 Round 27 核心方向

**Sprint 2 Phase 3: 多券商集成 — 从孤立场到统一体验**

R26 完成了 Moomoo 真实连接、BrokerSelector UI、账户聚合骨架。R27 应该把这些串联起来：

1. **Moomoo 真实连接验证** → 端到端通（连接 → 获取行情 → 下单 → 回执）
2. **BrokerSelector 集成到策略执行** → 策略可以选择目标券商
3. **账户聚合 UI 接入 Dashboard** → 侧栏/Portfolio 显示跨券商数据
4. **IB Adapter 骨架启动** → 第三家券商准备就绪

---

## 🦞 四虾任务（建议）

### 🦞 ML (3 任务) — 集成胶水 + Dashboard 升级

#### 1. [P0] ML-27-01: BrokerSelector + AccountSummary 集成到 App Shell

R26 JVS 创建了 BrokerSelector 和 AccountSummary 组件，但尚未接入路由和侧栏：
- BrokerSelector 集成到 `Header.tsx` / `StatusBar`（顶栏右侧）
- AccountSummary 集成到 `Sidebar.tsx`（底部/可折叠区域）
- 路由 `/trading` 中添加 BrokerSelector 作为子组件
- `DashboardPage` 顶部添加 BrokerStatusBar
- **验收**: 顶栏显示券商连接状态；侧栏显示跨券商资产汇总；点击可切换

#### 2. [P0] ML-27-02: Multi-Broker E2E 测试

- 新建 `tests/e2e-multi-broker.test.ts`
- 场景: Futu 连接 → 获取资金 → Moomoo 连接 → 资产聚合 → 切换券商 → 下单
- 目标: 10+ tests
- **验收**: npm test ≥ 159 pass, 覆盖 Futu+Moomoo 双券商场景

#### 3. [P1] ML-27-03: DashboardPage 增强 — 多券商行情 & Portfolio 聚合

- Dashboard 行情卡片同时显示 Futu + Moomoo 报价（合并在一个视图）
- Portfolio 页底部加 "跨券商持仓" 汇总表
- Sidebar 账户余额显示 "Futu $XXX | Moomoo $XXX | Total $XXX"
- **验收**: 图表无 flicker，切换券商数据即时更新

---

### 🦐 JVS (3 任务) — Moomoo 实盘验证 + IB 启动

#### 1. [P0] J-27-01: Moomoo Real TCP 实盘验证

R26 实现了 TCP 连接骨架（1024 行），R27 需要真实端到端验证：
- 连接到实际 Moomoo OpenD（端口 11211）
- 验证 getAccounts → getFunds → getPositions 返回真实数据
- 验证 subscribeAndPush 推送行情（含 bid/ask）
- 验证 placeOrder（模拟盘）→ cancelOrder 完整链路
- 输出 `docs/tasks/r27-moomoo-live-test.md`（含截图/log）
- **验收**: 真实数据流走通，文档含至少 3 个 API 的真实返回样本

#### 2. [P1] J-27-02: IB Adapter 骨架 + IBrokerAdapter 接口

- 新建 `electron/broker/ib-adapter.ts`（实现 IBrokerAdapter）
- 方法: connect / disconnect / getAccounts / getFunds / getPositions / getQuotes / placeOrder / cancelOrder
- 初始为 mock 模式（IB Gateway 需要特殊配置，mock 先行）
- BrokerManager 注册 IB adapter
- **验收**: IB adapter 可实例化，BrokerManager 可注册，类型安全

#### 3. [P1] J-27-03: Strategy → Broker 绑定

- 策略创建时可选择目标券商（Futu / Moomoo / IB）
- `electron/engine/strategy-engine.ts` 中添加 `brokerId` 字段
- `electron/engine/trade-executor.ts` 路由订单到指定券商
- UI: StrategyPage 表单增加 "执行券商" 下拉框
- **验收**: 策略可通过不同券商执行订单

---

### 🦐 QClaw (3 任务) — 测试守护 + 性能回归 + 监控

#### 1. [P0] Q-27-01: Continuous Test Gatekeeper — 目标 160+

- 保持 149/149 pass
- 新增 10+ E2E 场景（配合 ML-27-02）：多券商连接/切换/聚合
- 新增 5+ Moomoo adapter 单元测试（配合 J-27-01 真实验证）
- **验收**: ≥ 160 tests pass, 0 fail, exit 0

#### 2. [P1] Q-27-02: Multi-Broker 性能回归

基于 Q-26-02 的前端性能分析，R27 做回归：
- 多券商场景下 IPC 延迟对比 (Futu only vs Futu+Moomoo)
- Dashboard 渲染性能（2 束行情流 vs 1 束）
- 账户聚合计算开销
- 输出 `docs/performance/multi-broker-perf-r27.md`
- **验收**: 报告含基准 vs 多券商对比数据，无 > 20% 退步

#### 3. [P2] Q-27-03: 代码质量审计

- 检查所有 R26 新增代码中的潜在问题
- 搜索: `any` 类型滥用 / missing error handling / race conditions
- 搜索: duplicate code / hardcoded values
- 输出 `docs/tasks/r27-code-quality-audit.md`
- **验收**: 审计覆盖 ≥ 5 个文件

---

### 🦐 WB/PM (3 任务) — Sprint 1 收关 + Sprint 2 Demo 规划

#### 1. [P0] WB-27-01: Sprint 1 Final Demo 录制 + 发布

- 基于 ML-26-03 脚本和 WB-26-01 Recording Script 录制
- 录制 11 场景 GIF（每场景 < 1 分钟）
- 发布至 `docs/demo/sprint1-demo-r27-final/`
- 产出最终 Demo 汇总 README
- **验收**: 11 个 GIF 可用，汇总文档可对外分享

#### 2. [P0] WB-27-02: Sprint 2 Phase 3 中期检视

- 检查 R26-R27 进度 vs Sprint 2 Phase 3 路线图
- 识别风险：Moomoo 真实连接是否稳定？IB adapter 是否 pipe-dream？
- 输出 `docs/sprints/sprint2-phase3-mid-review.md`
- **验收**: 中期检视含风险等级 + 调整建议

#### 3. [P1] WB-27-03: Sprint 2 Phase 3 最终 Demo 预规划

- 定义 Sprint 2 Demo 场景（多券商切换/聚合/策略多券商执行）
- 输出 `docs/demo/sprint2-phase3-demo-plan.md`
- **验收**: 场景定义清晰，含录制要求

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 08:30 | P0 完成: 集成 (BrokerSelector/AccountSummary) + Moomoo 实盘验证 + 测试 160+ + Demo 录制 |
| 09:30 | P1 完成: Dashboard 增强 + IB 骨架 + 策略券商绑定 + 性能回归 + 中期检视 |
| 10:00 | P2 完成: 代码审计 + Phase 3 Demo 预规划 |
| 10:15 | R27 验收 + Sprint 1 最终 Demo 发布 + Sprint 2 冲刺宣告 |

---

## 🔗 依赖关系

```
J-27-01 (Moomoo live test) ──→ ML-27-01 (集成 BrokerSelector)
                                    ↓
ML-27-02 (E2E multi-broker) ←── ML-27-01 + J-27-01
                                    ↓
ML-27-03 (Dashboard 增强) ←── ML-27-01
                                    ↓
J-27-02 (IB Adapter) ────→ J-27-03 (Strategy-Broker 绑定)
                                    ↓
Q-27-01 (Test 160+) ←── ML-27-02
Q-27-02 (性能回归) ←── ML-27-01 + J-27-01 completed
Q-27-03 (代码审计) ←── All code complete
                                    ↓
WB-27-01 (Demo 录制) ←── ML-27-01 + J-27-01 verified
WB-27-02 (中期检视) ←── All P0 done
WB-27-03 (Demo 预规划) ←── All P1 done
```

---

## 🔍 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **≥ 160 tests, 0 fail** |
| BrokerSelector | 顶栏可见，可切换券商 |
| AccountSummary | 侧栏/仪表盘显示跨券商汇总 |
| Moomoo live | 真实连接验证文档含 3+ API 返回样本 |
| IB adapter | 骨架代码可实例化 |
| Strategy-Broker | 策略创建时可选券商 |
| Demo | 11 GIF 完成，Sprint 1 最终发布 |

---

## 💡 关键提醒

1. **不做 0.7.0 打包**：功能还不够密，等 R28/R29 多券商全通后再跳版
2. **Moomoo 真实连接是高风险项**：OpenD 端口/协议需要 JVS 实测验证，如有问题不硬撑
3. **IB Adapter 只做骨架**：IB Gateway 配置复杂（TWS + API 权限），mock 先行是明智的
4. **ML 重心在集成**：不是写新功能，是把 JVS QClaw 的模块串联起来
5. **QClaw 守护指标**：149→160 tests，0 regression，多券商场景性能
6. **WB 关注交付**：Sprint 1 Demo GIF 是给外界看的，品质第一

---

**ML 建议完毕，请 WB/PM 审阅定案后分发。**
