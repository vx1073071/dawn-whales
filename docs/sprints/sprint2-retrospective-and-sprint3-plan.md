# Sprint 2 回顾与 Sprint 3 规划

**日期**: 2026-06-06
**Sprint 2 周期**: R20 — R30（约 11 轮）
**Sprint 2 主题**: 多券商交易系统 + 自动化交易引擎骨架

---

## Sprint 2 回顾

### 交付总览

| 指标 | Sprint 1 (R1-R19) | Sprint 2 (R20-R30) | 变化 |
|------|-------------------|--------------------|------|
| 总测试数 | ~120 | **385** | +265 (+221%) |
| 测试文件 | 5 | **14** | +9 |
| 代码行数 | ~30K | **~55K+** | +25K+ |
| 券商数 | 1 (Futu) | **3** (Futu+Moomoo+IB) | +2 |
| .exe 版本 | v0.5.0 | **v0.7.0** | +2 个版本 |
| 核心引擎 | 3 | **8** | +5 |

### Phase 里程碑

#### Phase 3: 多券商交易 (R20-R28) ✅

**R20-R23: 基础打通**
- 修复 Electron CJS interop 崩溃
- 修复 UTF-16 BOM 问题
- TradeExecutor 架构完成（信号→风控→下单）
- Vitest 测试基础设施建立
- Test Zero 达成：125/125 pass

**R24-R25: 功能扩展**
- WebSocket 行情引擎 (ws-market-data.ts, 1,265L)
- TradeExecutor IPC (18 个 handler)
- Sprint 1 Demo 录制脚本
- 测试扩量至 125/125

**R26: 组件爆发**
- JVS: Moomoo 真实 TCP (1,185L) + Broker UI (1,261L) + 账户聚合 (948L) = **2,622 行**
- QClaw: RiskEngine v2 20/20
- 测试：149/149 pass

**R27: 系统集成**
- IB Adapter 骨架 (2,032L)
- App Shell 集成 (Sidebar/Dashboard/Header)
- nl-parser + strategy-engine 测试盲区补全 (71 tests)
- 测试：259/259 pass

**R28: v0.7.0 准备**
- UnifiedAccountManager (1,229L)
- Full Pipeline E2E (16 tests)
- OpenDBaseAdapter 重构指南 (1,345L)
- Moomoo 实盘验证 (9 API 样本)
- 测试：355/355 pass

#### Phase 4.1: 自动化交易引擎骨架 (R29) ✅

- **OpenDBaseAdapter 重构** (1,340L)：Futu -285L (-67%)，Moomoo -913L (-77%)
- **StrategyRunner** (904L)：dry-run + live-run 双模式
- **CronScheduler** (323L)：cron 表达式 + 状态机 + WS 推送
- **RiskEngine v3** (597L)：跨券商聚合 + 保证金 + 敞口 + 熔断
- **Backtest → Auto-Exec 桥接**
- 测试：385/385 pass

### 四虾贡献统计

**JVS**
- R26: Moomoo TCP + Broker UI + Account Aggregation (2,622L)
- R27: IB Adapter + Strategy-Broker 绑定 (2,341L)
- R28: UnifiedAccountManager + OpenDBaseAdapter 设计 (2,574L)
- R29: OpenDBaseAdapter 重构 + StrategyRunner (2,244L)
- R30: Condition Triggers + RiskEngine 集成 (进行中)
- **累计**: ~10K+ 行后端代码

**ML**
- R26: Installer + Retrospective + Demo 脚本
- R27: App Shell 集成 + Multi-Broker E2E (13 tests)
- R28: v0.7.0 Release + Full Pipeline E2E (16 tests) + README
- R29: CronScheduler + Backtest 桥接 + Landing Page
- R30: v0.7.0 GitHub Release + ConditionWatcher (进行中)
- **累计**: 前端集成 + 打包发布 + E2E 测试

**QClaw**
- R26: RiskEngine v2 20/20
- R27: nl-parser 42 tests + strategy-engine 29 tests
- R28: Backtest Enhancer 31 tests + RiskEngine v3 规划
- R29: RiskEngine v3 30 tests (0 fail)
- R30: ConditionEngine 核心 (进行中)
- **累计**: 132+ 测试，风控体系 v1→v3

**PM/WB**
- 每轮方案制定与广播 (R20-R30)
- Build/Test 守护循环 (~30 次)
- Demo 录制脚本 + 检查清单
- Release Notes + Phase 路线图
- Sprint 中期检视
- v0.7.0 GitHub Release
- **累计**: 11 轮方案 + 30+ 守护循环 + 10+ 文档

### 成功因素

1. **测试驱动**: 每轮以测试增长为硬指标，从 120 → 385
2. **守护循环**: PM 每 30 分钟检测 regression，问题秒级发现
3. **分工明确**: JVS 后端 / ML 前端+集成 / QClaw 测试+风控 / PM 协调+交付
4. **快速迭代**: 每轮 1-1.5 小时，问题不过夜
5. **文档先行**: 每个重大功能先写设计文档，再写代码

### 问题与教训

1. **OpenDBaseAdapter 重构推迟两轮** (R27/R28 推迟到 R29)
   - 原因：功能优先级高于重构
   - 教训：重构应尽早，否则债务累积

2. **IB 真实连接多次推迟** (R27→R30→R31)
   - 原因：需要 Gateway 环境，mock 已覆盖 12 合约
   - 教训：外部依赖应提前准备环境

3. **QClaw 测试偶尔 fail 批量出现** (R26 7 fail, R27 8 fail, R29 4 fail)
   - 原因：测试与实现并行开发，API 变更未同步
   - 教训：测试应在 API 稳定后写，或 mock 要足够健壮

4. **v0.7.0 发布推迟两轮** (R28 打包 → R30 发布)
   - 原因：每轮都有更高优先级功能
   - 教训：发布应有明确 deadline，否则无限推迟

### 技术债务

| 债务项 | 严重程度 | 计划修复 |
|--------|----------|----------|
| IB 真实连接 | 中 | R31 |
| Moomoo 实盘下单验证 | 中 | R31 |
| 前端性能优化 (Lighthouse ~45) | 中 | R32 |
| CI/CD PR 检查 | 低 | R32 |
| Demo GIF 实际录制 | 低 | Sprint 3 |
| OpenDBaseAdapter Futu 重构 | 低 | R29 已完成 |

---

## Sprint 3 规划

### Sprint 3 主题
**从"条件自动"到"闭环自动" — 自动化交易引擎完整版**

### 周期
**R31 — R40**（约 10 轮）

### Phase 划分

#### Phase 4.2: 条件触发引擎 (R30-R32)
- **目标**: 价格/指标/成交量条件触发自动交易
- **核心交付**: ConditionEngine + ConditionWatcher + Triggers + UI 面板
- **验收**: 400+ tests, crosses 精确触发

#### Phase 4.3: 闭环执行引擎 (R33-R36)
- **目标**: 持仓监控 + 自动止损止盈 + 再平衡
- **核心交付**: PositionMonitor + ClosedLoopExecutor + RebalanceEngine
- **验收**: 450+ tests, 闭环策略可全自动运行 24h

#### Phase 4.4: 性能优化与 v0.8.0 (R37-R40)
- **目标**: 性能基线 + 前端优化 + 稳定版本发布
- **核心交付**: Lighthouse > 80 + 内存泄漏修复 + v0.8.0
- **验收**: 500+ tests, Lighthouse > 80, v0.8.0 .exe

### 详细路线图

```
R31: IB 真实连接 + Moomoo 实盘验证 + ConditionEngine UI 完善
R32: 前端性能优化 + CI/CD + Volume/Volatility Trigger
R33: PositionMonitor 骨架 + 持仓追踪
R34: ClosedLoopExecutor 闭环执行 + 止损止盈
R35: RebalanceEngine 再平衡 + 目标权重
R36: 混合策略 (Cron + Condition + ClosedLoop)
R37: 性能基线 + 内存泄漏修复
R38: 前端 Lighthouse 优化
R39: E2E 测试扩展至 500+
R40: v0.8.0 发布 + Sprint 3 收官
```

### 四虾分工

**JVS**: 后端引擎核心
- Phase 4.2: Price/Indicator/Volume Triggers
- Phase 4.3: PositionMonitor + ClosedLoopExecutor
- Phase 4.4: 性能优化 + 内存管理

**ML**: 集成 + UI + 发布
- Phase 4.2: ConditionWatcher + ConditionRulePanel
- Phase 4.3: Rebalance UI + 持仓监控面板
- Phase 4.4: v0.8.0 打包 + Landing Page

**QClaw**: 测试 + 风控 + 质量
- Phase 4.2: ConditionEngine 测试 (30 tests)
- Phase 4.3: 闭环测试 + 性能回归
- Phase 4.4: 测试扩展至 500+ + CI/CD

**PM/WB**: 协调 + 交付 + 守护
- 每轮方案制定与广播
- Build/Test 守护
- Demo 录制与发布
- 版本发布管理

### 关键风险

1. **IB 真实连接**: 需要 TWS/Gateway 环境，可能再次推迟
2. **前端性能**: Lighthouse 从 ~45 到 >80 跨度大，可能需要重构
3. **闭环执行**: 涉及真实资金，风控必须 100% 可靠
4. **测试扩展**: 从 385 到 500+，测试运行时间可能过长

### 成功指标

| 指标 | Sprint 2 终态 | Sprint 3 目标 |
|------|---------------|---------------|
| 测试数 | 385 | **500+** |
| 测试文件 | 14 | **20+** |
| Lighthouse | ~45 | **>80** |
| 券商真实连接 | 1 (Futu) | **2+ (Futu+Moomoo)** |
| 自动化模式 | 定时 (Cron) | **定时+条件+闭环** |
| 版本 | v0.7.0 | **v0.8.0** |

---

## 附录: R20-R30 版本发布历史

| 版本 | 日期 | 代号 | 核心特性 |
|------|------|------|----------|
| v0.5.0 | 06/06 | Stability | 基础架构稳定 |
| v0.6.0 | 06/06 | Integration | WebSocket + TradeExecutor |
| v0.7.0 | 06/06 | Multi-Broker | 三券商 + 自动化骨架 |
| v0.8.0 | 待定 | Auto-Trading | 闭环自动化 + 性能优化 |

---

*Sprint 2 于 2026-06-06 收官。Sprint 3 将于 R31 启动。*
