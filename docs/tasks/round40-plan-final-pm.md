# Round 40 最终方案 (PM 整合版)

**生成时间**: 2026-06-07 04:40 (UTC+8)
**方案版本**: v1.0 (PM 整合 3 份提案)
**当前基线**: tsc 0 | build 0 | 1775/0/9 tests | v0.7.0 (欠 v0.8.0 三轮)

---

## 一、三方提案对比

| 维度 | dao (16 任务) | JVS (4+3+3+3=13 任务) | ML (16 任务, 整合 dao) |
|------|---------------|----------------------|------------------------|
| **核心方向** | Live Trading + Walk-Forward | Phase 5.0 集成 + 性能优化 + v0.9.0 | **v0.8.0 必修** + LiveTrade + WalkForward + ExportImport |
| **v0.8.0 优先级** | P0 (但非第一) | 推到 v0.9.0 (大跨) | **P0 第一 (三轮欠账)** |
| **LiveTradeBridge** | 重写 (≥500L) | 重写 (≥600L) | **激活 (已有 731L, 不重写)** |
| **JVS 任务数** | 3 | **4 (含 MultiSource/Realtime/PerfMonitor)** | 3 (LiveTrade + WalkForward + ExportImport) |
| **ML 任务数** | 3 | 3 | 3 |
| **测试目标** | 1820+ (+45) | 1900+ (+125) | **1840+ (+65, 务实)** |
| **JVS 引擎总代码** | 1250L | **2400L** (4 引擎) | 1250L (3 引擎) |
| **LiveTrade UI** | LiveTradingPanel (400L) | LiveTradePanel (400L) | LiveTradingPanel (400L) |
| **DataSource UI** | - | MultiSourceDataPanel (400L) | - |
| **WalkForward** | WalkForwardPanel (350L) | - | WalkForwardPanel (350L) |
| **ExportImport UI** | StrategyImportExportPanel (300L) | - | StrategyImportExportUI (300L) |
| **关键差异点** | 强调 Live Trading 激活 | **扩 4 引擎 (4 主题)** | **强调 v0.8.0 必修** |

## 二、PM 决策

### 决策 1: 采纳 ML 的核心定位
- **v0.8.0 必须 P0 第一**（三轮欠账）
- **LiveTradeBridge 不重写，激活** (已有 731L，0 TODO)

### 决策 2: 砍掉 JVS 的 MultiSource/Realtime/PerfMonitor
- **理由**: R40 4 引擎总代码 2400L 远大于 R39 的 1840L，**过载**
- **保留给 R41+**: MultiSource (R41), RealtimeStream (R42), PerformanceMonitor (R43)

### 决策 3: 测试目标 1840+ (采纳 ML 务实值)
- 不追 JVS 1900+（过载）
- 不取 dao 1820+（保守）
- **+65 合理** = 3 新引擎 (LiveTrade补完 10 + WalkForward 12 + ExportImport 10) + 集成 + 性能基准

### 决策 4: 16 任务分配 (主副双岗制)
- **ML 3** (LiveTrading + WalkForward + ExportImport UI)
- **JVS 3** (LiveTrade 激活 + WalkForward + ExportImport 引擎)
- **QClaw 3** (1840+ tests + 性能基准 + 回归脚本)
- **PM 3** (v0.8.0 正式发布 + 守护 + 验收)
- **dao 4** (R39 审查 + Phase 5.0 API 3 份 + Live Trading 架构 + E2E 骨架)

## 三、R40 16 任务详细

### ML(3) — UI 优先
- **ML-40-01 [P0]** LiveTradingPanel (≥400L, real-time order status, paper/live 切换, dry-run 模式)
- **ML-40-02 [P0]** WalkForwardPanel (≥350L, 滑动窗口可视化, in-sample/out-of-sample 切分)
- **ML-40-03 [P1]** StrategyImportExportUI (≥300L, JSON/YAML 导入导出, 版本管理)

### JVS(3) — 引擎激活 + 2 新引擎
- **J-40-01 [P0]** LiveTradeBridge 激活 (731L → 850L+, sim→live 同步, 仓位对账, 审计追踪, 15+ tests)
- **J-40-02 [P0]** WalkForwardEngine (≥450L, 滑动窗口回测, 12+ tests, 输出稳健性指标)
- **J-40-03 [P0]** StrategyExportImport (≥300L, 策略序列化/反序列化, 10+ tests)

### QClaw(3) — 测试 + 性能
- **Q-40-01 [P0]** 测试 1840+ (+65 tests: LiveTradeBridge 10 + WalkForward 12 + ExportImport 10 + 集成 20 + 性能 13)
- **Q-40-02 [P1]** Phase 5.0 性能基准报告 (P50/P95/P99, 8 引擎对比, ≥300L)
- **Q-40-03 [P1]** 回归测试自动化脚本 (5+ 轮稳定性验证, CI 集成)

### PM(3) — 发布 + 守护 + 验收
- **WB-40-01 [P0 第一]** v0.8.0 正式发布 (CHANGELOG + Release Notes + GitHub Release + .exe)
- **WB-40-02 [P0]** 守护循环 (1840+ 5 轮稳定, 持续监控)
- **WB-40-03 [P1]** R39 验收 + R40 收尾 (Phase 5.0 总结报告, ≥400L)

### dao(4) — 审查 + 文档 + 架构
- **D-40-01 [P0]** Code Review R39 (3 引擎 + 3 UI 详细审查报告, ≥50 行)
- **D-40-02 [P0]** Phase 5.0 API 文档 3 份 (StrategyOptimizer + MultiTimeframe + PortfolioRisk)
- **D-40-03 [P1]** Live Trading 架构文档 (≥500L, sim→live 桥接架构图)
- **D-40-04 [P1]** E2E 测试骨架 (Playwright, ≥300L, 关键路径骨架)

## 四、里程碑

| 时间 | 任务 | 责任人 |
|------|------|--------|
| **04:35-04:40** | v0.8.0 优先级确认 + LiveTradeBridge 现状评估 | PM |
| **04:40** | R40 启动广播 | PM |
| **04:40-04:55** | P0 启动（5 虾并行）| ALL |
| **04:55-05:20** | P0 完成 (3 引擎 + 3 UI + 1840 tests + v0.8.0 + R39 审查 + API 文档) | ALL |
| **05:20-05:30** | P1 完成 (性能基准 + 回归脚本 + 架构 + E2E) | ALL |
| **05:30-05:40** | R40 验收 (tsc 0 / build 0 / 1840+ 5 轮稳定) | PM |
| **05:40** | v0.8.0 正式发布 | PM |

## 五、互备 (主副双岗制)

| 主岗 | 副岗 | 互备规则 |
|------|------|----------|
| ML UI | JVS 引擎 | ML UI 卡壳 → JVS 接手补完 |
| JVS 引擎 | QClaw 集成 | JVS 卡壳 → QClaw 补集成测试 |
| QClaw 测试 | dao 审查 | QClaw flaky → dao 协助定位 |
| PM 发布 | dao 文档 | PM 阻塞 → dao 代写 Release Notes |
| dao 文档 | ML UI | dao 阻塞 → ML 接手架构图 |

## 六、验收标准 (R40)

- [ ] tsc 0 errors
- [ ] vite build 0 errors
- [ ] test ≥ 1840, 0 fail, 5 轮稳定
- [ ] v0.8.0 GitHub Release 可见 (.exe 可下载)
- [ ] LiveTradeBridge 激活（不重写，加 119L+）
- [ ] WalkForwardEngine + StrategyExportImport 完成
- [ ] 3 UI 完成 (LiveTrading + WalkForward + StrategyImportExport)
- [ ] Phase 5.0 API 3 份 + Live Trading 架构文档
- [ ] R39 审查报告 + Phase 5.0 总结
- [ ] 性能基准报告 + 回归脚本
- [ ] E2E 测试骨架

## 七、风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| v0.8.0 CHANGELOG 不全 | 中 | 高 | PM 立即按 Phase 4.3-4.4 整理变更 |
| LiveTradeBridge 测试不足 | 中 | 中 | 已有 731L 骨架，激活后 10+ tests 补全 |
| WalkForwardEngine 算法复杂 | 中 | 中 | 先用简单滚动窗口，2 周内迭代 |
| ExportImport 跨版本兼容 | 低 | 中 | 加 schemaVersion 字段 |
| 时间紧张 | 中 | 中 | 砍 dao D-40-04 E2E 骨架到 P1 |

## 八、依赖图

```
[v0.8.0 发布] (PM P0)
  ├── Phase 5.0 API 3 份 (dao D-40-02)
  ├── 1840+ tests (QClaw Q-40-01)
  │   ├── LiveTradeBridge 测试 (依赖 J-40-01)
  │   ├── WalkForwardEngine 测试 (依赖 J-40-02)
  │   └── ExportImport 测试 (依赖 J-40-03)
  └── Live Trading 架构 (dao D-40-03)

[R40 收尾] (PM P1)
  ├── 性能基准 (QClaw Q-40-02)
  ├── 回归脚本 (QClaw Q-40-03)
  ├── R39 审查 (dao D-40-01)
  └── E2E 骨架 (dao D-40-04)
```

---

**完整任务分配 + 时间表 + 验收标准，已通过 chat-bridge 广播给 5 虾。**
