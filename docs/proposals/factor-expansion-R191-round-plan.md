# R191: 🔴专业因子Batch1 — 期权+套利+替代数据 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 3 首轮 | v3.0.0-alpha
> 前置: R190(Phase 2收尾)✅ | 本轮: 30个🔴因子 + 替代数据 + AI优化 + 替代数据解锁

---

## 🎯 Round目标

1. **30个🔴专业因子**全部可计算: 期权7+套利3+替代数据3+深度基本面+宏观+情绪
2. **替代数据适配器**: NewsAPI + JobPostingAPI + ESG评分
3. **🔴专业模式UI**: 切换确认 + 高级参数面板
4. **DeepDiagnosisPanel**: 5维雷达图诊断 (💰 1U/次, R189已建计费)
5. **AIParameterOptimizer**: AI自动调参 (💰 1.5U/次, v17.7 #27)
6. **替代数据解锁**: Pro因子→浏览免费→付费解锁 (💰 2U/次, v17.7 #28)
7. **8语言i18n**: 30×8=240条

---

## 📋 30🔴专业因子清单

### 价值🔴 (2)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 1 | EBITDA_EV | 企业价值倍数 | 比率型 | 财报 | ⭐⭐ |
| 2 | GRAHAM_NET | Graham Net-Net | 比率型 | 财报 | ⭐⭐⭐ |

### 质量🔴 (2)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 3 | ACCRUALS | 应计利润水分 | 比率型 | 财报 | ⭐⭐⭐ |
| 4 | DEBT_MATURITY | 债务到期风险 | 比率型 | 财报 | ⭐⭐ |

### 低波🔴 (2)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 5 | BAB | 低Beta异象 | 排序型 | 市场数据 | ⭐⭐⭐ |
| 6 | TAIL_RISK | 尾部风险 | 统计型 | 市场数据 | ⭐⭐⭐ |

### 情绪🔴 (3)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 | 6虾 |
|---|--------|--------|----------|--------|------|------|
| 7 | SHORT_SQUEEZE | 轧空风险 | 打分型 | 做空数据 | ⭐⭐⭐ | ⭐共识 |
| 8 | SHORT_CROWDING | 空头拥挤度 | 排序型 | 做空数据 | ⭐⭐ | |
| 9 | FACTOR_CROWDING | 因子拥挤度 | 排序型 | 计算 | ⭐⭐⭐ | ⭐5/6 |

### 宏观🔴 (3)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 10 | GDP_BETA | GDP敏感度 | 回归型 | 宏观数据 | ⭐⭐⭐ |
| 11 | VOLATILITY_REGIME | 波动率区间 | 分类型 | 市场数据 | ⭐⭐ |
| 12 | CROSS_ASSET_CORR | 跨资产相关性 | 统计型 | 多市场 | ⭐⭐⭐ |

### 期权🔴 (7)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 13 | GAMMA_EXPOSURE | Gamma暴露 | 统计型 | 期权链 | ⭐⭐⭐⭐ |
| 14 | IMPLIED_CORRELATION | 隐含相关性 | 统计型 | 期权链 | ⭐⭐⭐⭐ |
| 15 | IV_TERM_STRUCT | 期限结构 | 比率型 | 期权链 | ⭐⭐⭐ |
| 16 | VRP | 波动率风险溢价 | 比率型 | IV-RV | ⭐⭐⭐ |
| 17 | OPTION_FLOW | 大单期权流向 | 排序型 | 期权成交 | ⭐⭐⭐ |
| 18 | PINCH_RISK | Pin风险 | 统计型 | 期权OI | ⭐⭐⭐ |
| 19 | OPTION_SKEW | 25Delta偏度 | 比率型 | 期权链 | ⭐⭐⭐ |

### 事件🔴 (3)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 20 | INDEX_REBALANCE | 指数调仓 | 事件型 | 指数公告 | ⭐⭐ |
| 21 | BOND_SPREAD | 信用利差 | 比率型 | CDS | ⭐⭐⭐ |
| 22 | BUYBACK_YIELD_ADV | 回购升级版 | 比率型 | 财报+公告 | ⭐⭐ |

### 套利🔴 (3)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 23 | PAIRS_SPREAD | 配对价差 | 统计型 | 市场数据 | ⭐⭐⭐⭐ |
| 24 | CROSS_MARKET_DISCOUNT | 跨市场折溢价 | 比率型 | 多市场 | ⭐⭐⭐ |
| 25 | FIXED_INCOME_CARRY | Carry因子 | 比率型 | 期货 | ⭐⭐ |

### 基本面🔴 (2)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 | 6虾 |
|---|--------|--------|----------|--------|------|------|
| 26 | CAPEX_INTENSITY | 资本开支强度 | 比率型 | 财报 | ⭐⭐ | |
| 27 | ALTMAN_Z | Altman Z-Score | 打分型 | 财报 | ⭐⭐⭐ | ⭐共识 |

### 替代数据🔴 (3)

| # | 因子ID | 中文名 | 计算类型 | 数据源 | 难度 |
|---|--------|--------|----------|--------|------|
| 28 | APP_DOWNLOADS | 应用下载量 | 排序型 | App Store | ⭐⭐ |
| 29 | JOB_POSTINGS | 招聘发布量 | 排序型 | Indeed | ⭐⭐ |
| 30 | SUPPLY_CHAIN | 供应链信号 | 统计型 | 上下游股价 | ⭐⭐⭐ |

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 30🔴因子计算实现 | `electron/engine/factors/calculators/pro-*.ts` | ≥600行 | 30因子可计算 |
| J2 | 替代数据适配器框架 | `electron/engine/factors/adapters/altdata-adapter.ts` | ≥250行 | NewsAPI+JobPosting+ESG可扩展 |
| J3 | 期权复杂因子适配器 | 期权链解析+Greeks计算 | ≥150行 | Gamma/IV/Skew计算正确 |
| J4 | 30🔴因子Registry注册 | `factor-id-registry.ts` | ≥50行 | L3标记正确 |

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | DeepDiagnosisPanel | `src/components/strategy/DeepDiagnosisPanel.tsx` | ≥250行 | 5维雷达图+IC衰减+优化建议 |
| M2 | AIParameterOptimizer | `src/components/strategy/AIParameterOptimizer.tsx` | ≥200行 | 参数输入→AI调参→前后对比 |
| M3 | 🔴专业模式UI | `src/components/strategy/ProModeSwitch.tsx` | ≥150行 | 切换确认+高级参数面板 |

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 30🔴因子i18n(8语言) | `factor-i18n-map.ts` + locales | ≥350行 | 240条0缺译 |
| A2 | POST /api/factor/ai-optimize | `electron/api/factor-ai-optimize.ts` | ≥200行 | 调参→计费1.5U→返回 |
| A3 | POST /api/factor/alt-data-unlock | `electron/api/factor-alt-data.ts` | ≥150行 | 解锁→计费2U→返回数据 |

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 替代数据解锁UX | `docs/design/pro-factor-unlock-ux.md` | ≥150行 | "Pro🔴"→浏览→付费→解锁 |
| Q2 | 🔴因子故事文案30个 | `docs/design/factor-stories-pro-zh.md` | ≥200行 | 含学术引用+专业解释 |
| Q3 | 因子3步发现向导 | `docs/design/factor-discovery-wizard.md` | ≥150行 | 选因子→选市场→看结果 |

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 30🔴因子单元测试 | `tests/unit/factors-pro-*.test.ts` | ≥300行 | ≥150测试pass |
| Y2 | 替代数据管线测试 | `tests/integration/altdata-pipeline.test.ts` | ≥100行 | NewsAPI→NLP→因子信号 |
| Y3 | 新增2项计费测试 | `tests/integration/pro-billing.test.ts` | ≥150行 | AI优化(1.5U)+替代数据(2U) 7场景 |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R191 | 广播消息 | — | 6虾确认 |
| C2 | R191 Round计划(本文档) | 验收标准+分工 | ≥400行 | 完整 |
| C3 | 🔴因子质量审计 | 30因子计算+替代数据+计费 | ≥200行 | 验收通过 |
| C4 | Phase 3启动里程碑 | Phase 3目标确认 | ≥100行 | 里程碑确认 |

---

## ✅ 验收标准

### P0 必过 (12项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | 30🔴因子计算 | 全部可计算+信号灯输出 | JVS |
| V03 | 替代数据适配器 | NewsAPI+JobPosting+ESG框架 | JVS |
| V04 | 期权因子7个 | Gamma/Skew/VRP等计算正确 | JVS |
| V05 | DeepDiagnosisPanel | 5维雷达图+IC衰减+建议 | ML |
| V06 | AIParameterOptimizer | 参数输入→AI调参→前后对比 | ML |
| V07 | 🔴专业模式UI | 切换确认+高级参数面板 | ML |
| V08 | 30🔴因子i18n | 8语言240条0缺译 | autoclaw |
| V09 | AI优化API | 计费1.5U+hold→settle/refund | autoclaw |
| V10 | 替代数据API | 计费2U+hold→settle/refund | autoclaw |
| V11 | ≥150单元测试 | 30因子×5=150 | youdao |
| V12 | 新增2项计费测试 | AI优化7场景+替代数据7场景 | youdao |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V13 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |
| V14 | 期权因子精度 | 与CBOE官方值误差<2% | JVS |
| V15 | 替代数据论文案 | 30因子含学术引用 | QClaw |
| V16 | 发现向导流畅度 | 3步<30s完成 | QClaw |

---

## 💰 Phase 3 收费全景

| # | 功能 | 单价 | 首次出现 | 状态 |
|---|------|------|----------|------|
| 25 | 多因子组合回测 | 1U/次 | R189 | ✅ |
| 26 | 因子深度诊断 | 1U/次 | R189 | ✅ |
| 27 | AI因子参数优化 | **1.5U/次** | **R191** | 🆕 |
| 28 | 替代数据因子解锁 | **2U/次** | **R191** | 🆕 |

---

## 📊 Phase 3 进度追踪

| Round | 状态 | 🔴因子数 | 累计🔴 | 累计总因子 |
|-------|------|---------|--------|-----------|
| **R191** | 🟢 启动 | **30** | 30 | 99+30=129 |
| R192 | ⏳ 待通知 | 30 (HK/US/CC) | 60 | 159 |
| R193 | ⏳ 待通知 | 29 (剩余) | 89 | 188 |
| **合计** | | **89** | | **188** (42旧+31🟢+68🟡+89🔴) |

---

## 🔑 关键规则 (R191)

1. **🔴专业模式**: 切换时弹窗确认("专业因子含复杂算法，请确认你理解风险")，无门槛
2. **因子免费+深度服务按次** — 30🔴因子本身免费(v17.7)
3. **替代数据**: 浏览免费(看名字+描述)，查看数值付费(2U/次)
4. **AI优化**: 手动调参免费，AI自动调参1.5U/次
5. **DeepDiagnosisPanel 5维**: IC趋势/IR比率/因子稳定性/拥挤度/衰退预警
6. **学术引用**: 🔴因子故事必须标注学术来源(Fama-French/BAB/Piotroski/Altman等)

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- 收费目录v17.7: `Desktop/quant-moo-收费目录-v17.7.txt`
- R189深度服务: `docs/proposals/factor-expansion-R189-round-plan.md`
