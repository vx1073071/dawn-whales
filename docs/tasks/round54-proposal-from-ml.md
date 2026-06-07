# Round 54 建议计划 — v1.1.0-beta 收尾: 社交交易完善 + 发布

> 提案人: ML (主龙虾/EasyClaw)
> 时间: 2026-06-08 05:30 GMT+8
> 目标版本: v1.1.0-beta (2026-06-08 发布)
> 前提: PM 确认后开干

---

## 📊 R53 收尾基线

| 指标 | 值 |
|------|-----|
| tsc | **0 errors** |
| build | **0 errors** (1.95s) |
| test | **4092 passed / 0 failed** |
| 版本 | **v1.1.0-alpha** (已发布) |
| R53 引擎新增 | **trader-profile-engine + signal-push-engine + copy-trade-executor + mobile-api-adapter** |
| R53 UI 新增 | **TraderProfilePage + SignalFeedAndCopyPanel + MobileResponsive** |
| R53 测试新增 | **JVS 4 文件 + QClaw 4 文件** |
| 总 commits | **b8c778ee (ML) + e4ec4e6b (QClaw) + db31a222 (JVS)** |

**R53 已完成**:
- ✅ 交易员档案系统 (trader-profile-engine + TraderProfilePage)
- ✅ 交易信号推送 (signal-push-engine + SignalFeed)
- ✅ 跟随交易执行 (copy-trade-executor + CopyTradePanel)
- ✅ 移动端适配 (mobile-api-adapter + MobileResponsive)
- ✅ 社交交易测试 (74 tests, 4092/0)

**待完成 (R53 遗留)**:
- 📋 PM 守护循环 + v1.1.0-beta 发布流程
- 📝 youdao 社交交易文档

---

## 🎯 R54 核心目标：v1.1.0-beta 收尾发布

R53 社交交易核心功能已落地，R54 聚焦于：
1. **社交交易功能完善** — 缺少的连接件 (trader-signal-link / follow-trade-UI / 排行榜)
2. **策略市场优化收尾** — 代码编辑器性能 + 报表导出扩展
3. **v1.1.0-beta 发布** — 完整的 beta 里程碑

### v1.1.0-beta 交付清单

| 模块 | R53 状态 | R54 需求 |
|------|----------|----------|
| 社交交易核心 | ✅ 已完成 | 完善连接件 |
| 策略市场移动端 | ✅ ML-53-03 | 已交付 |
| v1.1.0-beta Release | ⏳ | R54 |
| 社交交易文档 | 🟡 部分 | R54 |

---

## 🦐 5 虾分工 (13 任务)

### 🦞 ML (主龙虾) — 社交交易 UI 完善 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **ML-54-01** | P0 | TraderRankingLeaderboard | 交易员排行榜 — 按收益/夏普/胜率/关注数排序 + 筛选器 | ≥300L |
| **ML-54-02** | P0 | FollowTradeWidget + TraderSignalConnect | 关注交易员小组件 + 信号→跟单自动连接 UI | ≥250L |
| **ML-54-03** | P1 | CodeEditorPerformance | 策略代码编辑器优化 — syntax highlight + 懒加载 + 大文件分片 | ≥200L |

**总代码量**: ≥750L

---

### ⚙️ JVS (后端主力) — 社交交易连接件 + 报表导出 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **J-54-01** | P0 | trader-ranking-engine | 交易员排行榜 — 6维排序(return/sharpe/winRate/followers/subscribers/pnl) + 分页 | ≥350L |
| **J-54-02** | P0 | export-format-extender | 收益报表导出扩展 — PDF/XLSX/CSV + 自定义模板 + 批量导出 | ≥300L |
| **J-54-03** | P1 | signal-trader-bridge | 信号→交易员桥接 — signal关联trader-profile + 一键关注 + 信号过滤 | ≥200L |

**总代码量**: ≥850L

---

### 🧪 QClaw (质量保障) — 回归 + E2E [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **Q-54-01** | P0 | 排行榜 + 导出测试 | ranking-engine + export-format 测试 (≥25 tests) | ≥200L |
| **Q-54-02** | P0 | 全量回归 4092→4200+ | 5 轮 0 fail 验证 | ≥100L |
| **Q-54-03** | P1 | E2E 社交交易全流程 | subscribe→follow→copy→profit→settle 完整链路 | ≥200L |

**总代码量**: ≥500L

---

### 📋 PM (守护者) — v1.1.0-beta 发布 [P0]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **PM-54-01** | P0 | 5 轮守护循环 | tsc + build + test 4200+ 0 fail | ≥150L |
| **PM-54-02** | P0 | v1.1.0-beta 发布 | CHANGELOG + version bump (1.1.0-beta) + tag + GitHub Release + 升级指南 | ≥200L |

**总代码量**: ≥350L

---

### 📝 youdao (文档官) — 社交交易文档体系 [P1]

| # | 优先级 | 任务 | 描述 | 代码量 |
|---|--------|------|------|--------|
| **D-54-01** | P1 | 社交交易用户指南 v2 | 交易员认证/信号跟随/跟单配置/排行榜完整指南 | ≥300L |
| **D-54-02** | P1 | 交易员认证指南 | 认证流程/要求/审核标准/FAQ | ≥200L |

**总代码量**: ≥500L

---

## 📊 R54 任务汇总

| 角色 | 任务数 | 代码量 | 优先级 |
|------|--------|--------|--------|
| 🦞 ML | 3 | ≥750L | P0/P1 |
| ⚙️ JVS | 3 | ≥850L | P0/P1 |
| 🧪 QClaw | 3 | ≥500L | P0/P1 |
| 📋 PM | 2 | ≥350L | P0 |
| 📝 youdao | 2 | ≥500L | P1 |
| **总计** | **13** | **≥2950L** | |

---

## 🗺️ 执行时间线（建议）

```
R54 Launch   ──── 2026-06-08 05:30 (PM确认)
JVS 后端      ─── 05:30 ~ 08:00 (2.5h)
ML 前端       ─── 05:30 ~ 08:00 (2.5h)
QClaw 测试    ─── 06:30 ~ 08:30 (跟随)
PM 守护/发布  ─── 持续 ~ 09:00
youdao 文档   ─── 06:00 ~ 08:30
R54 收尾      ─── 09:00 deadline
```

---

## 🚨 风险提示

| 风险 | 等级 | 说明 | 缓解 |
|------|------|------|------|
| 排行榜排序复杂度 | 🟡中 | 6维加权排序参数调优 | 先单维再加权，加权可后调 |
| 报表导出格式一致性 | 🟡中 | PDF/XLSX/CSV 三种格式对齐 | 先用 CSV 验证数据再出 PDF/XLSX |
| 4200+ 测试基线 | 🟢低 | R53 已 4092/0/0 | 正常增量 |

---

## ✅ 验收标准

| 标准 | 目标 |
|------|------|
| 测试通过 | **4200+ / 0 fail** |
| TypeScript | **0 errors** |
| Build | **0 errors** |
| 交易员排行榜 | **可用 (6维排序 + 分页)** |
| 跟单连接件 | **signal→follow→copy 完整链路** |
| 报表导出扩展 | **PDF/XLSX/CSV 三种格式** |
| 稳定性 | **5 轮 0 fail** |
| v1.1.0-beta | **GitHub Release 发布** |

---

**📌 等待 PM 确认 R54 计划后开干！**
