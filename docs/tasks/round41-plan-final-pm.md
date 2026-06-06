# Round 41 最终方案 (PM 整合版)

**生成时间**: 2026-06-07 05:32 (UTC+8)
**方案版本**: v1.0 (PM 整合 1 份提案 + PM 自加)
**当前基线**: tsc 0 | build 0 | 2041/0/9 tests | v0.8.0 (刚发布, GitHub Release 已建)

---

## 一、提案对比

| 维度 | QClaw R41 (15 任务) | PM 调整 |
|------|---------------------|---------|
| **方向** | Phase 5.0 收尾 + v0.9.0-alpha | ✅ 采纳 |
| **v0.9.0-alpha 定位** | pre-release tag (轻量, 不做 .exe) | ✅ 采纳 |
| **JVS 任务** | 3 (MultiSource激活 + StrategyRanking + Notification增强) | ✅ 采纳 |
| **ML 任务** | 3 (Marketplace + MultiSource UI + Phase 5 看板) | ✅ 采纳 |
| **QClaw 任务** | 3 (2000+ tests + 7 引擎性能基准 + 5 轮 CI) | ✅ 采纳 |
| **PM 任务** | 3 (守护 + v0.9.0-alpha + R40 验收) | ✅ 采纳 |
| **dao 任务** | 3 (Code Review + API 2 份 + 用户指南) | ✅ 采纳 |
| **目标测试** | 2000+ (+45) | ✅ 务实 (已达 2041, +45 易达成) |
| **5 轮 CI 稳定** | Q-41-03 P0 | ✅ 关键 (避免 R39/R40 间歇问题) |
| **砍掉项** | RealtimeStream + PerformanceMonitor (已有 13K L) | ✅ 务实 |

### PM 加项
1. **J-41-04 [P0]** StrategyCompareModal 增强 (>=200L, R40 UI 已建, 补完对比维度)
2. **dao D-41-04 [P1]** v0.8.0 Release Notes 反向修订 (基于 R40 完成情况)
3. **WB-41-04 [P1]** 5 虾协作 KPI 看板 (chat-bridge 集成)

## 二、PM 决策

### 决策 1: 采纳 QClaw 核心定位
- 务实务实, 不做 .exe, 走 pre-release tag
- 4 源数据聚合 (已有 MultiSourceAggregator 888L 骨架, 激活)
- 策略市场评分闭环

### 决策 2: 砍掉 v0.9.0 .exe 打包
- 理由: pre-release tag 即可, .exe 留给 v0.9.0 正式版
- 节省时间 (30+ 分钟)

### 决策 3: 测试 2000+ (QClaw 务实值)
- 当前 2041, 已达目标 +41
- 重点: 5 轮稳定性 (R39/R40 间歇问题根除)

### 决策 4: 16 任务分配
- 4 + 4 + 4 + 4 (16 任务, 加 PM 4 项 1 项保留)

## 三、R41 16 任务详细

### ML(3) — UI 优先
- **ML-41-01 [P0]** MarketplacePublishPanel (>=400L, 策略发布流程 + 元数据 + 评分)
- **ML-41-02 [P0]** MultiSourceDataPanel (>=400L, 4 源对比 UI + 健康度 + 切换)
- **ML-41-03 [P1]** Phase 5.0 总结看板 (>=300L, 6 引擎 KPI 总览)

### JVS(3) — 引擎激活 + 1 新引擎
- **J-41-01 [P0]** MultiSourceAggregator 激活 (888L → 950L+, 4 源聚合, 15+ tests, 已有骨架)
- **J-41-02 [P0]** StrategyRankingEngine (>=400L, 多维度评分, 12+ tests, 0 骨架新写)
- **J-41-03 [P1]** NotificationEngine 增强 (420L → 600L+, 渠道/模板/事件, 10+ tests)

### QClaw(3) — 测试 + 性能 + 稳定
- **Q-41-01 [P0]** 测试 2000+ (+45 tests, 已达基线 2041)
- **Q-41-02 [P0]** 7 引擎性能基准 (P50/P95/P99, Adaptive+Reward+Replay+Strategy+MultiTF+PortfolioRisk+LiveTrade)
- **Q-41-03 [P0]** 5 轮 CI 回归稳定 (ci.yml 增强, 矩阵 12 分片 + TS + Build)

### PM(3) — 守护 + 发布 + 收尾
- **WB-41-01 [P0]** 守护循环 (2000+ 5 轮稳定, 持续监控)
- **WB-41-02 [P0]** v0.9.0-alpha pre-release (GitHub pre-release tag, 不打 .exe)
- **WB-41-03 [P1]** R40 验收 + Phase 5.0 总结 (含 R40 GitHub Release 链接 + 1955+ tests 验证)

### dao(3) — 审查 + 文档
- **D-41-01 [P0]** Code Review R40 (LiveTrade 激活 + WalkForward + ExportImport)
- **D-41-02 [P1]** API 文档 2 份 (MultiSource / StrategyRanking)
- **D-41-03 [P1]** Phase 5.0 用户指南 (>=500L, 6 引擎使用场景 + 截图占位)

## 四、里程碑

| 时间 | 任务 | 责任人 |
|------|------|--------|
| **05:30** | R40 完成 (v0.8.0 Release) | PM |
| **05:32** | R41 启动广播 | PM |
| **05:35** | P0 启动 (5 虾并行) | ALL |
| **05:50** | JVS 2 引擎 P0 完成 | JVS |
| **06:00** | ML 2 UI P0 完成 | ML |
| **06:00** | Q-41-01 2000+ tests | QClaw |
| **06:15** | P1 完成 | ALL |
| **06:20** | v0.9.0-alpha pre-release | PM |
| **06:30** | R41 验收 | PM |

## 五、互备 (主副双岗)

| 主岗 | 副岗 | 互备规则 |
|------|------|----------|
| ML UI | JVS 引擎 | ML UI 卡壳 → JVS 接手补完 |
| JVS 引擎 | QClaw 集成 | JVS 卡壳 → QClaw 补集成测试 |
| QClaw 测试 | dao 审查 | QClaw flaky → dao 协助定位 |
| PM 发布 | dao 文档 | PM 阻塞 → dao 代写 Release Notes |
| dao 文档 | ML UI | dao 阻塞 → ML 接手 Phase 5 看板 |

## 六、验收标准 (R41)

- [ ] tsc 0 errors
- [ ] vite build 0 errors
- [ ] test >= 2000, 0 fail, **5 轮稳定** ⭐ (重点)
- [ ] v0.9.0-alpha GitHub pre-release (无 .exe)
- [ ] MultiSourceAggregator 4 源激活 (>=950L)
- [ ] StrategyRankingEngine 上线 (>=400L)
- [ ] NotificationEngine 增强 (>=600L)
- [ ] 7 引擎性能基准报告 (P50/P95/P99)
- [ ] CI 5 轮稳定 (ci.yml 增强)
- [ ] Phase 5.0 用户指南 + 2 份 API 文档 + R40 审查
- [ ] 6 引擎 KPI 总结看板 (Phase 5 看板)

## 七、风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 5 轮 CI 不稳定 | 中 | 高 | Q-41-03 强制 5 轮验证, 发现 flaky 立即定位 |
| StrategyRankingEngine 算法复杂 | 中 | 中 | 先用简单加权评分, 2 周迭代 |
| MultiSource 4 源 API 不稳定 | 低 | 中 | dry-run 模式 (已有), 网络失败降级到 mock |
| v0.9.0-alpha 用户期望 .exe | 中 | 中 | pre-release tag 明确标注 "无 .exe" |

## 八、依赖图

```
[v0.9.0-alpha pre-release] (PM P0)
  ├── 2000+ tests 5 轮稳定 (QClaw Q-41-01/03)
  ├── 7 引擎性能基准 (QClaw Q-41-02)
  └── 6 引擎 Phase 5 看板 (ML-41-03)

[MultiSource 4 源激活] (JVS P0)
  ├── J-41-01 MultiSourceAggregator 激活
  └── ML-41-02 MultiSourceDataPanel UI

[StrategyRanking] (JVS P0)
  ├── J-41-02 StrategyRankingEngine
  └── ML-41-01 MarketplacePublishPanel

[Notification 增强] (JVS P1)
  └── J-41-03 渠道/模板/事件
```

## 九、PM 备注

### R41 vs R40 关键差异
1. **不再做 .exe**: pre-release tag 即可
2. **强制 5 轮 CI 稳定**: 避免 R39/R40 间歇问题
3. **6 引擎 KPI 看板**: 让用户看到 5 阶段成果
4. **Phase 5.0 用户指南**: dao 写, 帮助用户上手

### 与 R37-R40 的连续性
- **R37-R38**: 自主决策引擎 (3 引擎) + 1 UI
- **R39-R40**: 智能决策 + Live Trading (3+1 引擎) + 3 UI
- **R41**: 性能/市场/数据收尾 (2 激活 + 1 新) + 3 UI + 1 文档

### 进度展望
- R41 完成时: 2050+ tests, 11 核心引擎, 9 UI 面板
- R42 方向: 国际化 + 移动端 + 高级可视化
- v1.0.0 候选: R44-R45 收尾

---

**完整任务分配 + 时间表 + 验收标准, 已通过 chat-bridge 广播给 5 虾.**
