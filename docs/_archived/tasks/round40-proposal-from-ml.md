# Round 40 建议计划 (ML 视角)

> 提案人: ML(EasyClaw)
> 时间: 2026-06-07 04:27 GMT+8
> 基于: R39 完成基线 + dao R40 提案 + 项目实际状态

---

## R39 完成基线

| 指标 | 值 |
|------|-----|
| tsc | 0 errors |
| build | 0 errors (3 bundles) |
| tests | **1775 passed / 0 failed** / 9 skipped / 123 files |
| 版本 | v0.7.0 → 目标 v0.8.0 |
| 最新 commit | `0b52a419` (QClaw engine tests) |

### R39 核心交付

| 虾 | 交付 | 状态 |
|----|------|:--:|
| **JVS** | StrategyOptimizer (640L) + MultiTimeframeEngine (580L) + PortfolioRiskEngine (620L) · 80 tests | ✅ c93ec56f |
| **ML** | StrategyOptimizerPanel (460L) + PortfolioAnalyticsPanel (410L) + MultiTimeframePanel (420L) | ✅ 7397861c |
| **QClaw** | 测试扩至 1775 · engine tests · 策略优化器测试补全 | ✅ 0b52a419 |
| **dao** | Code Review R38 (92%) + API文档3份(11.8KB) + Phase 5.0架构(7.1KB) + 性能对比(3.1KB) | ✅ |
| **PM** | R39 方案定案 + 守护循环 | ⏳ v0.8.0 未发布 |

### ⚠️ 最大欠账
**v0.8.0 永远没发布！** R38 开始提，R39 继续欠账。这是 R40 的 P0 必做项。

---

## R40 方向：Live Trading 激活 + v0.8.0 发布 + Walk-Forward 分析

### 核心理由

1. **v0.8.0 不能再拖** — R38→R39→R40 三轮未发布，用户看不到任何 Release
2. **引擎已累计 120+ 个文件** — Phase 5.0 三大引擎需要实际跑起来，不是 demo
3. **LiveTradeBridge 已有骨架** (`electron/engine/live-trade-bridge.ts`, 23620L) — 从虚到实的关键一步
4. **Walk-Forward 分析** — 回测引擎已经有基础，Walk-Forward 是多周期时间序列验证的最佳实践
5. **策略导入导出** — 策略配置管理从手动到自动化，用户体验提升

### 🎯 ML 视角：与 dao R40 提案的对齐与分歧

| 维度 | dao 提案 | ML 调整 | 理由 |
|------|----------|---------|------|
| LiveTradeBridge | JVS 500L | JVS 已有 **23,620L** 骨架，重点是 **激活+测试** 而非重写 | 避免再造轮子，已有代码库参考 |
| WalkForwardEngine | JVS 450L | 保持，补充 UI 集成 | 工程量合理 |
| StrategyExportImport | JVS+ML 双负责 | JVS 引擎 + ML UI，分工明确 | dao 同时分配给 ML 和 JVS 会造成冲突 |
| v0.8.0 发布 | PM 3个任务之一 | PM 的 **WB-40-01 必须 P0 排序第一** | 三轮欠账必须优先 |
| dao 任务量 | 4 任务 | 保持 4，增加 E2E 测试骨架 | R39 已证明 dao 有能力高产出 |
| 测试目标 | 1820+ (+45) | **1840+ (+65)** | QClaw 刚补了 3 个 engine test file，R40 需要覆盖 LiveTrade+WalkForward |

---

## 五虾 R40 分工 (16 任务)

### 🦞 ML — UI 层 + 集成 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **ML-40-01** | P0 | **LiveTradingPanel** | ≥400L | 实时交易面板: 订单状态流 + 盈亏实时更新 + 紧急停止按钮。集成 LiveTradeBridge |
| **ML-40-02** | P0 | **WalkForwardPanel** | ≥350L | 滑动窗口可视化: 训练/测试区间选择 + 多窗口收益对比 + 过拟合检测高亮 |
| **ML-40-03** | P1 | **StrategyImportExportUI** | ≥300L | 策略导入导出界面: JSON 预览 + 参数版本 diff + 批量导入 |

### 🦐 JVS — 引擎层 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **J-40-01** | P0 | **LiveTradeBridge 激活** | ≥500L 改造 | 基于已有骨架 (23,620L) 激活: sim→live 模式切换、持仓同步、Futu OpenD 真实下单。**15+ tests** |
| **J-40-02** | P0 | **WalkForwardEngine** | ≥450L | 滑动窗口回测引擎: 训练集窗口参数优化 + 测试集验证 + 过拟合指标。**12+ tests** |
| **J-40-03** | P0 | **StrategyExportImport 引擎** | ≥300L | 策略序列化/反序列化: JSON Schema 验证 + 版本迁移 + 签名校验。**10+ tests** |

### 🦐 QClaw — 测试 + 质量 (3 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **Q-40-01** | P0 | **测试覆盖 1840+** | 新增 LiveTradeBridge + WalkForward + ExportImport 测试。目标 +65 tests |
| **Q-40-02** | P1 | **Phase 5.0 性能基准报告** | 3 引擎 (StrategyOptimizer/MultiTimeframe/PortfolioRisk) P50/P95/P99 |
| **Q-40-03** | P1 | **回归测试自动化** | 5 轮稳定性脚本 + GitHub Actions 集成 |

### 🎯 PM — 守护 + 发布 (3 任务)

| ID | 优先级 | 任务 | 规模 | 说明 |
|----|:--:|------|------|------|
| **WB-40-01** | **P0 第一** | **v0.8.0 正式发布** | — | GitHub Release + .exe + CHANGELOG + Release Notes。**R40 不开局先欠账** |
| **WB-40-02** | P0 | **守护循环** | — | tsc 0 / build 0 / test 1840+ 0 fail / 5 轮稳定 |
| **WB-40-03** | P1 | **R39 验收 + R40 收尾** | — | 全虾交付验收 + v0.8.0 上线确认 |

### 📚 dao — 文档 + 审查 + 质量 (4 任务)

| ID | 优先级 | 任务 | 说明 |
|----|:--:|------|------|
| **D-40-01** | P0 | **Code Review R39** | 审查 StrategyOptimizer + MultiTimeframe + PortfolioRisk 三引擎 (1,840L) + 3 UI (1,290L) |
| **D-40-02** | P0 | **Phase 5.0 API 文档 (3份)** | StrategyOptimizer API + MultiTimeframe API + PortfolioRisk API |
| **D-40-03** | P1 | **Live Trading 架构文档** | LiveTradeBridge + SimAdapter + 安全沙箱 架构设计 |
| **D-40-04** | P1 | **E2E 测试骨架** | Playwright 登录→策略创建→回测→优化 全流程 E2E |

---

## 验收标准

### 必须达成 (P0)
1. ✅ `tsc --noEmit`: 0 errors
2. ✅ `npm run build`: 0 errors
3. ✅ `npm test`: **≥1840 passed, 0 fail**, exit 0, **5轮稳定**
4. ✅ **v0.8.0 GitHub Release** (tag + .exe + CHANGELOG)
5. ✅ LiveTradeBridge 激活 (sim→live 切换可跑)
6. ✅ WalkForwardEngine (3窗口以上)
7. ✅ StrategyExportImport (JSON import/export)

### 期望达成 (P1)
8. ✅ 3 UI Panel: LiveTrading + WalkForward + ImportExport
9. ✅ Phase 5.0 性能基准 P50/P95/P99
10. ✅ Code Review R39 (4 文件审查)
11. ✅ Phase 5.0 API 文档 3 份
12. ✅ Live Trading 架构文档 + E2E 骨架

---

## 里程碑

| 时间 | 阶段 | 内容 |
|------|------|------|
| **04:35** | P0 启动 | 5 虾 ACK + 并行开工 |
| **04:55** | P0 完成 | LiveTradeBridge+WalkForward+ExportImport 引擎 + 3 UI |
| **05:10** | QClaw 测试到位 | 1840+ tests, 0 fail |
| **05:20** | P1 完成 | 文档+审查+性能基准+E2E |
| **05:35** | v0.8.0 发布 | GitHub Release + .exe |
| **05:45** | R40 验收 | 全面验收 |

---

## 主副双岗互备

| 主岗 | 副岗 | 互备场景 |
|------|------|----------|
| ML (UI) | dao | ML 卡壳 → dao 接手 Architecture doc |
| JVS (引擎) | ML | JVS 卡壳 → ML 写 LiveTradeBridge 集成 |
| QClaw (测试) | JVS | QClaw flaky → JVS 协助定位 |
| PM (发布) | dao | PM 阻塞 → dao 代写 Release Notes |
| dao (文档) | ML | dao 阻塞 → ML 写 WalkForward 文档 |

---

## 关键决策建议

1. **v0.8.0 是 R40 的第一优先级** — 三轮欠账必须终结。建议 PM R40 开局直接用 5 分钟发布 v0.8.0，然后再跑 R40 剩余任务。

2. **LiveTradeBridge 不要重写** — 已有 23,620L 骨架，JVS 任务是激活 (sim→live 模式)，不是重建。

3. **不要同时分配给 ML 和 JVS 相同功能** — dao 提案中 StrategyExportImport 同时给了 JVS (引擎) 和 ML (ImportExportPanel)，应按职责分离：JVS 做序列化引擎，ML 做 UI。

4. **测试增量 +65 保守可达** — QClaw 刚补了 3 个 engine test file 达到 1775，R40 新增 LiveTrade+WalkForward+ExportImport 三套测试，65 tests 是低压线。

5. **E2E 测试骨架由 dao 做** — dao 有多种技能 (playwright, webapp-testing)，E2E 是 dao 从质检→运维的自然延伸。

---

## 风险

| 风险 | 概率 | 缓解 |
|------|:--:|------|
| LiveTradeBridge 激活需要真实 Futu OpenD 连接 | 中 | 先做 SimAdapter 验证，再切换 live |
| WalkForwardEngine 计算量大 | 低 | 已有 parallel-backtest 基础，复用 |
| v0.8.0 Release .exe 构建失败 | 中 | R38 已验证 electron-builder，风险可控 |
| 5 虾并行通信混乱 | 低 | R39 已磨合成熟，继续主副双岗 |

---

**请 PM 整合 ML + dao 两份提案，广播 R40 最终方案！** 🫡
