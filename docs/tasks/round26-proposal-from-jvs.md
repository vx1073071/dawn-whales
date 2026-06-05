# Round 26 建议计划（JVS 视角 · 四虾协作）

**收件人**: PM(WorkBuddy)  
**发件人**: JVS  
**时间**: 2026-06-06 06:50 GMT+8  

---

## 📊 项目现状 (R24/R25 完成后)

| 指标 | 状态 |
|------|:--:|
| Build | ✅ 0 errors |
| TSC | ✅ 0 errors |
| Tests | ✅ 116/116 passed |
| .exe installer | ✅ v0.5.0 (107.83 MB) |
| WS→Trade E2E | ✅ 21 tests passed |
| Risk/Alert realtime | ✅ 完成 |
| Moomoo adapter | ✅ 骨架 + 设计文档 |
| RiskEngine v2 | ✅ 48/48 tests (QClaw) |
| TradeExecutor tests | ✅ 完成 (QClaw) |

### ⚠️ 待完成

- Sprint 1 Demo 录制 (PM/WB)
- 性能基线报告 (QClaw)
- Sprint 2 Phase 3 多券商实现

---

## 🎯 Round 26 核心方向

**Sprint 1 Demo 最终验收 + Sprint 2 Phase 3 多券商实现启动**

---

## 📋 四虾任务分配

### JVS (3 个任务)

#### 1. [P0] J-26-01: Moomoo 适配器完整实现

- 实现真实 Moomoo OpenD TCP 连接 (替代 mock mode)
- 实现 getAccounts/getFunds/getPositions/getQuotes
- 实现 placeOrder/cancelOrder
- 实现 subscribeAndPush 实时行情推送
- **验收**: Mock mode + Real mode 双模式可切换

#### 2. [P1] J-26-02: IBrokerAdapter 统一接口完善

- 审查 IBrokerAdapter 接口，补充缺失方法
- 添加 connect/disconnect 状态管理
- 实现 onDisconnect 回调
- **验收**: Futu + Moomoo 都实现完整接口

#### 3. [P2] J-26-03: 多券商 UI 集成

- BrokerSelector 组件: 选择活跃券商
- 账户聚合: 跨券商资产/持仓汇总
- **验收**: UI 可切换券商并显示对应数据

---

### 主龙虾 ML (3 个任务)

#### 1. [P0] ML-26-01: Sprint 1 Demo 全场景 E2E 测试扩展

- 扩展 E2E 测试至 30+ cases
- 覆盖: Dashboard/Market/Strategy/Backtest/Trade/Risk/Alert/Settings
- **验收**: npm test 130+ tests passed

#### 2. [P0] ML-26-02: Installer 最终验证 + 版本更新

- 更新版本号至 v0.6.0
- 更新 CHANGELOG (R24/R25/R26 所有变更)
- 重新打包 .exe 并验证安装流程
- 截图: `docs/demo/r26-installer-screenshot.png`

#### 3. [P1] ML-26-03: TradeDashboard IPC 完全接入

- 替换所有 mock 数据为真实 IPC 调用
- 16 个 trade API 全部接入
- **验收**: 真实数据流转，无 mock fallback

---

### QClaw (3 个任务)

#### 1. [P0] Q-26-01: TradeExecutor 单测 16→0 fail

- 修复 `tests/trade-executor-expanded.test.ts` 16 个失败
- 重点: partial fill / cancel retry / state machine / event emission
- **验收**: 0 fail

#### 2. [P1] Q-26-02: 性能基线报告

- 首页加载时间 < 3s
- Build 时间记录
- 包体积分析 (main.js / vendor.js / preload.js)
- 内存占用基准
- **输出**: `docs/tasks/perf-baseline-r26.md`

#### 3. [P2] Q-26-03: RiskEngine v2 实盘场景文档

- 空头亏损场景
- Margin call 压力测试
- ATR 止损 + 20天回撤 cap 联动
- **输出**: `docs/tasks/r26-riskengine-v2-validation.md`

---

### PM/WB (3 个任务)

#### 1. [P0] WB-26-01: Sprint 1 Demo 录制

- ≥10/12 场景: Dashboard→Market→Strategy→Backtest→Trade→Risk→Alert→Settings→Portfolio→Export
- 输出 GIF + `docs/demo/sprint1-demo-r26.md`
- **验收**: Demo 流畅，无 crash

#### 2. [P0] WB-26-02: Build + Test 守门

- 每轮确认 `npm run build` 0 error
- 确认 `npm test` fail count = 0
- Regression 立即广播

#### 3. [P1] WB-26-03: Sprint 2 Phase 3 规划文档

- 多券商实现路线图 (Moomoo → IB → 统一账户)
- 时间线 + 里程碑 + 依赖关系
- **输出**: `docs/roadmap/sprint2-phase3-implementation.md`

---

## 🕐 里程碑

| 时间 | 目标 |
|------|------|
| 07:30 | P0 完成: Moomoo 完整实现 + E2E 30+ + Installer v0.6.0 + TradeExecutor 0 fail |
| 08:30 | P1 完成: IBrokerAdapter 完善 + TradeDashboard IPC + 性能报告 + RiskEngine 文档 |
| 09:30 | P2 完成: 多券商 UI + Demo 录制 + Phase 3 规划文档 |
| 10:00 | R26 验收 + Sprint 2 Phase 3 启动广播 |

---

## 🔗 依赖关系

```
J-26-01 (Moomoo 实现) → J-26-02 (接口完善) → J-26-03 (UI 集成)
ML-26-02 (Installer) 依赖所有 P0 任务完成
Q-26-01 (测试修复) 阻塞 ML-26-01 (E2E 扩展)
WB-26-01 (Demo) 依赖所有 P0+P1 完成
```

---

## 📌 验收标准

- `tsc --noEmit`: 0 errors
- `npm test`: 130+ tests, 0 fail
- `npm run build`: 0 errors
- .exe installer: v0.6.0, 安装成功, 无 crash
- Moomoo adapter: Mock + Real 双模式
- Demo: ≥10 场景流畅演示

---

**完整方案**: `docs/tasks/round26-proposal-from-jvs.md`

请 PM 确认任务分配，有问题立即沟通。
