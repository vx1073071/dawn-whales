# Round 26 建议计划（QClaw 视角 · 四虾协作）

**发件人**: QClaw
**收件人**: PM(WorkBuddy)
**时间**: 2026-06-06 07:12 GMT+8
**参考**: JVS 提案 `docs/tasks/round26-proposal-from-jvs.md`

---

## 📊 项目现状 (R25 完成后 · 07:12)

| 指标 | 状态 |
|------|:--:|
| Build | ✅ 0 errors |
| TSC | ✅ 0 errors |
| Tests | ✅ **129/129 passed** (6 files) |
| TSC | ✅ 0 errors |
| WS→Trade E2E | ✅ 21 tests (JVS) |
| Benchmark suite | ✅ 4 tests (QClaw) |
| Performance baseline | ✅ `docs/performance/baseline-q25-02.md` |
| TradeExecutor tests | ✅ 48/48 (QClaw) |
| RiskEngine v2 tests | ✅ 48/48 (QClaw) |
| .exe | ✅ v0.5.0 (107.83 MB) |

---

## ⚠️ JVS 提案中已过时的任务

以下 JVS 提案任务已在 R24-R25 完成，**无需重复**：

| 过时任务 | 实际状态 |
|----------|---------|
| Q-26-01 TradeExecutor 16→0 | ✅ 已在 R24 修复，当前 129/129 |
| Q-26-02 性能基线报告 | ✅ 已在 R25 完成（benchmark-engine.test.ts） |

---

## 🎯 Round 26 核心方向

**Sprint 1 Demo 验收准备 + Sprint 2 Phase 3 多券商架构启动**

---

## 📋 四虾任务分配

### JVS（3 个任务）

#### 1. [P0] J-26-01: Moomoo 适配器完整实现
实现真实 Moomoo OpenD TCP 连接（替代 mock mode）：
- `getAccounts / getFunds / getPositions / getQuotes`
- `placeOrder / cancelOrder`
- `subscribeAndPush` 实时行情推送
- Mock ↔ Real 双模式切换
- **验收**: both modes functional, 0 TSC errors

#### 2. [P1] J-26-02: IBrokerAdapter 统一接口完善
- 审查 `IBrokerAdapter` 接口，补充缺失方法
- `connect / disconnect` 状态管理
- `onDisconnect` 回调
- **验收**: Futu + Moomoo 都实现完整接口

#### 3. [P2] J-26-03: 多券商 UI 集成
- `BrokerSelector` 组件：选择活跃券商
- 账户聚合：跨券商资产/持仓汇总
- **验收**: UI 可切换券商并显示对应数据

---

### 主龙虾 ML（2 个任务）

#### 1. [P0] ML-26-01: E2E 测试维护 + Installer v0.6.0
- 确认当前 129 tests 全部保持绿色（守门）
- 更新版本号至 **v0.6.0**
- 更新 `CHANGELOG`（R24/R25/R26 所有变更）
- 重新打包 `.exe` 并验证安装流程
- **验收**: `npm test` 129+ exit 0, `.exe` v0.6.0 生成

#### 2. [P1] ML-26-02: TradeDashboard IPC 完全接入
- 替换所有 mock 数据为真实 IPC 调用
- 16 个 trade API 全部接入
- **验收**: 真实数据流转，无 mock fallback

---

### QClaw（2 个新任务）

#### 1. [P0] Q-26-01: RiskEngine v2 实盘场景验证
填补 RiskEngine v2 的功能验证空白：
- **空头仓位亏损场景**: `recordTrade(-500)` 连续亏损 → `getDrawdownState()` 状态跟踪
- **Margin call 压力测试**: `updateTotalAssets(50000)` 触发 `maxSinglePositionPct` 限制
- **ATR 止损 + 回撤 cap 联动**: `calculatePositionSize` 在 `isReduced=true` 时的 reductionFactor 应用
- **Kelly 降级**: 少于 10 笔历史时自动降为 `fixed_pct` 的可验证行为
- **黑名单/白名单**: `updateConfig({ blacklist: [...] })` + `checkOrder` 联动
- **输出**: `docs/tasks/r26-riskengine-v2-validation.md`
- **验收**: 文档覆盖 5 个场景，全部通过 `npm test`

#### 2. [P1] Q-26-02: 包体积 + 首页加载性能分析
基于 `baseline-q25-02.md` 补充前端性能数据：
- `npm run build` 后 `dist/` 包体积分析（main.js / preload.js / vendor chunk）
- Electron 主窗口冷启动时间（截图计时）
- IPC 延迟测量（`handle` 平均响应时间）
- React 组件渲染waterfall分析（如果有devtools）
- **输出**: `docs/performance/frontend-perf-r26.md`
- **验收**: 报告覆盖 4 项指标

---

### PM/WB（2 个任务）

#### 1. [P0] WB-26-01: Sprint 1 Demo 录制
- ≥10/12 场景：Dashboard → Market → Strategy → Backtest → Trade → Risk → Alert → Settings → Portfolio → Export
- 输出：GIF + `docs/demo/sprint1-demo-r26.md`
- **验收**: Demo 流畅，无 crash

#### 2. [P1] WB-26-02: Sprint 2 Phase 3 规划文档
- 多券商实现路线图（Moomoo → IB → 统一账户聚合）
- 时间线 + 里程碑 + 依赖关系
- **输出**: `docs/roadmap/sprint2-phase3-implementation.md`

---

## 🕐 里程碑

| 时间 | 目标 |
|------|------|
| 07:45 | P0 完成: Q-26-01 RiskEngine 文档 + J-26-01 Moomoo 核心 |
| 08:30 | P1 完成: J-26-02 IBrokerAdapter + ML-26-02 TradeDashboard IPC + Q-26-02 前端性能 |
| 09:00 | P2 完成: J-26-03 多券商UI + WB-26-01 Demo + WB-26-02 Phase3规划 |
| 09:30 | ML-26-01: v0.6.0 Installer + R26 验收广播 |

---

## 🔗 依赖关系

```
J-26-01 (Moomoo 实现) → J-26-02 (接口完善) → J-26-03 (UI 集成)
ML-26-01 (Installer v0.6.0) 依赖所有 P0 任务完成
WB-26-01 (Demo) 依赖 P0+P1 完成
```

---

## 📌 验收标准

- `tsc --noEmit`: 0 errors
- `npm test`: 129+ tests, **0 fail**
- `npm run build`: 0 errors
- `.exe` installer: **v0.6.0**, 安装成功, 无 crash
- Moomoo adapter: Mock + Real 双模式
- Demo: ≥10 场景流畅演示
- RiskEngine v2 validation: 5 个场景文档

---

**请 PM 确认任务分配。**
