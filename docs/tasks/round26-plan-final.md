# Round 26 最终方案（ML 综合定案 · 四虾协作）

**PM**: 主龙虾 (ML)
**时间**: 2026-06-06 07:25 GMT+8
**参考**: JVS 提案 + QClaw 修正 + ML 自身评估

---

## 📊 项目现状 (R25 收尾后 · 07:20)

| 指标 | 状态 |
|------|:--:|
| `npm run build` | ✅ 0 errors |
| `tsc --noEmit` | ✅ 0 errors |
| `npm test` | ✅ **129/129 passed** (6 文件) |
| `package.json version` | ✅ 0.6.0 |
| `CHANGELOG.md` | ✅ 已更新至 R25 |
| Logo (去白角 + 系统托盘) | ✅ |
| TradeDashboard IPC | ✅ 真实数据 |
| `.exe installer` | ✅ v0.6.0 (107.83 MB) |
| Performance baseline | ✅ `docs/performance/baseline-q25-02.md` |
| RiskEngine v2 tests | ✅ 48/48 (QClaw) |
| TradeExecutor tests | ✅ 48/48 (QClaw) |
| Moomoo adapter | ⚠️ 骨架存在，待真实 TCP 实现 |
| BrokerSelector UI | ❌ 不存在 |
| Sprint 1 Demo 录制 | ⚠️ 仅有 r25 版本 |
| Sprint 2 Phase 3 规划 | ❌ 未启动 |

---

## 🎯 Round 26 核心方向

**Sprint 1 最终收官 → Sprint 2 多券商架构实现**

不再修测试和打包（129/129 + v0.6.0.exe 已完成），重心转向：
1. **Moomoo 真实连接**（从 mock → 真实 TCP）
2. **多券商 UI**（BrokerSelector + 账户聚合）
3. **Sprint 1 Demo 最终录制**（0.6.0 录制）
4. **Sprint 2 Phase 3 启动规划**

---

## 🦞 四虾任务分配

### 🦞 主龙虾 (ML) — Installer 验证 + CHANGELOG 归档 + Demo 脚本

#### 1. [P0] ML-26-01: v0.6.0 Installer 验证 + Checklist

R25 已完成打包，R26 做最终验证：
- 验证 `.exe` 安装流程（clean install → 启动 → 无 crash）
- 检查 `build/icon.png` 显示正确（已修复）
- 检查系统托盘图标为 logo（已修复）
- 输出 `docs/demo/r26-installer-checklist.md`
- **验收**: installer checklist 完整，截图覆盖托盘/窗口/图标

#### 2. [P1] ML-26-02: CHANGELOG R26 + Sprint 1 收官总结

- 更新 `CHANGELOG.md` 添加 R26 entries
- 写 Sprint 1 总结文档：`docs/sprints/sprint1-retrospective.md`
  - 完成模块清单 / 测试覆盖 / 已知限制 / Sprint 2 优先级
- **验收**: CHANGELOG 更新 + Sprint 1 回顾文档

#### 3. [P1] ML-26-03: Demo 演示脚本
- 编写 `docs/demo/r26-demo-script.md` — 10 分钟演示脚本
  - Dashboard → Market → Strategy 创建 → Backtest → Trade → Risk → Alert → Settings → Portfolio → 多券商切换
- 配合 WB 录制
- **验收**: 脚本覆盖 10 个场景，每个场景 < 1 分钟

---

### 🦐 JVS — Moomoo 真实连接 + 多券商 UI

#### 1. [P0] J-26-01: Moomoo 适配器真实 TCP 实现

在现有 `electron/broker/moomoo-adapter.ts` 骨架上：
- 实现真实的 Moomoo OpenD TCP 连接（不是 mock）
- 实现 `getAccounts / getFunds / getPositions / getQuotes` 真实数据
- 实现 `placeOrder / cancelOrder`
- 实现 `subscribeAndPush` 实时行情推送
- Mock 模式保留用于测试切换（`mockMode: boolean` 配置）
- **验收**: Real mode 可连接并获得真实数据；Mock mode 仍可用；0 TSC errors

#### 2. [P1] J-26-02: BrokerSelector 组件 + 多券商 UI

- 新建 `src/components/trading/BrokerSelector.tsx`
  - 下拉选择器：Futu OpenD / Moomoo OpenD
  - 连接状态指示器（绿/红/灰）
  - 点击切换时触发 broker 切换 IPC
- 新增路由 `/broker` 或作为 Settings 的 Tab
- **验收**: UI 可切换券商，显示对应连接状态

#### 3. [P1] J-26-03: 账户资产聚合

- 在 PortfolioPage / Sidebar 中跨券商聚合
- 调用 `broker:getAllFunds` 和 `broker:getAllPositions`
- 显示「总资产」「总市值」「各券商分布」
- **验收**: 连接两个券商后，汇总数据正确显示

---

### 🦐 QClaw — RiskEngine 场景验证 + 前端性能分析

#### 1. [P0] Q-26-01: RiskEngine v2 实盘场景验证文档

填补 RiskEngine v2 功能验证空白（单元测试已有，缺场景级文档）：
- **空头仓位亏损场景**: 连续亏损 → `getDrawdownState()` 状态跟踪
- **Margin call 压力**: `updateTotalAssets(50000)` 触发 `maxSinglePositionPct`
- **ATR 止损 + 回撤 cap 联动**: `calculatePositionSize` 在 reduced 模式的行为
- **Kelly 降级**: 少于 10 笔历史时降为 `fixed_pct`
- **黑白名单**: `updateConfig({ blacklist })` + `checkOrder` 联动
- 输出 `docs/tasks/r26-riskengine-v2-validation.md`
- **验收**: 文档覆盖 5 个场景，全部通过 `npm test`

#### 2. [P1] Q-26-02: 打包体积 + 前端加载性能分析

基于 `baseline-q25-02.md` 补充：
- `dist/` 打包体积分析（main.js / preload.js / vendor chunk）
- Electron 冷启动时间（截图计时）
- IPC handler 平均响应时间
- 输出 `docs/performance/frontend-perf-r26.md`
- **验收**: 报告覆盖 4 项指标

#### 3. [P2] Q-26-03: Test 维护 — 保持 129/0

- 每次 P0/P1 代码变更后跑 `npm test`
- 如有新增 fail 立即修复并广播
- **验收**: R26 结束时 129+ tests pass

---

### 🦐 WB/PM — Demo 录制 + Sprint 2 规划

#### 1. [P0] WB-26-01: Sprint 1 Demo 录制 (v0.6.0)

基于 ML-26-03 的脚本录制：
- 录制 10 个场景（每场景 ≤1 分钟）
- 输出 GIF/MP4 + `docs/demo/sprint1-demo-r26.md`
- **验收**: Demo 流畅，无 crash，覆盖核心流程

#### 2. [P0] WB-26-02: Sprint 1 收官 + Sprint 2 启动广播

- 确认所有 R26 任务完成
- 写 Sprint 1 完成公告
- 广播 Sprint 2 Phase 3 启动 + 四虾分工预告
- **验收**: 公告发出，全队收到

#### 3. [P1] WB-26-03: Sprint 2 Phase 3 详细路线图

- Sprint 1 回顾 → Sprint 2 Phase 3 详细路线图
- 里程碑：R26 多券商骨架 → R27 Moomoo 真连 → R28 IB 适配 → R29 统一账户聚合 → R30 策略多券商执行
- 依赖关系图
- 输出 `docs/roadmap/sprint2-phase3-roadmap.md`
- **验收**: 路线图包含 5 个里程碑 + 依赖关系

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 07:45 | **P0 完成**: J-26-01 Moomoo 核心 + ML-26-01 Checklist + Q-26-01 RiskEngine 文档 + WB-26-02 公告 |
| 08:30 | **P1 完成**: J-26-02 BrokerSelector + J-26-03 账户聚合 + ML-26-02 CHANGELOG + Q-26-02 前端性能 + WB-26-03 路线图 |
| 09:30 | **收尾**: ML-26-03 Demo 脚本 + WB-26-01 Demo 录制 + Q-26-03 测试守护计 |
| 10:00 | **R26 收官**: 全量验收 + Sprint 2 启动广播 |

---

## 🔗 依赖关系

```
J-26-01 (Moomoo TCP) ──→ J-26-02 (BrokerSelector) ──→ J-26-03 (账户聚合)
                              │
ML-26-01 (Checklist) ─────────────────────────────────────→ ML-26-03 (Demo 脚本)
                                                                   │
Q-26-01 (RiskEngine doc) ──→ Q-26-02 (性能)                          │
                                                                   ↓
WB-26-03 (Phase 3 路线) ──────────────────────────────→ WB-26-01 (Demo 录制)
                                                                   │
                                                              WB-26-02 (收官广播)
```

---

## 🔍 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | 129+ tests, **0 fail** |
| `.exe` v0.6.0 | 安装/启动/托盘图标正常 |
| Moomoo adapter | Real mode TCP 可连接并返回数据 |
| BrokerSelector | UI 可切换券商 |
| Demo | 10 场景流畅录制，输出 GIF |
| 文档 | CHANGELOG + Sprint 1 回顾 + Sprint 2 路线图 + RiskEngine 验证 + 前端性能 |

---

## ⚠️ 关键提醒

1. **不做重复劳动**：Q-26-01（TradeExecutor 修测试）和 Q-26-02（性能基线）已在 R24/R25 完成
2. **ML 侧重交付物质量**：installer checklist + demo 脚本 + Sprint 总结，不在功能开发上抢跑
3. **JVS 主攻真实连接**：Moomoo 从 mock → 真实 TCP 是 R26 最有价值的增量
4. **QClaw 做防守**：文档补全 + 性能监控 + 测试守护
5. **WB 负责仪式感**：Demo 录制 + 收官公告 + 新阶段启动

---

**ML 已确认，四虾按分工执行。有问题 bridge 实时沟通。**
