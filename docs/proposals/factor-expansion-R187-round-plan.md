# R187: 🟡进阶因子Batch1 — 通用+A类 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 2 首轮 | v2.6.0-alpha
> 前置: R186(集成+场景包)✅ | 本轮: 34个🟡因子+PK+权重+相关性
> R186审计: 4因子从🟢降级🟡 → 追加入R187 (30→34)

---

## 🎯 Round目标

1. **34个🟡进阶因子**全部可计算: 30原计划 + 4降级追加
2. **因子相关性矩阵**: Pearson/Spearman + 相关系数阈值
3. **FactorWeightSlider**: 权重拖拽+自动归一化
4. **FactorPK**: 2因子实时PK对比台
5. **🟡因子FactorCard**: 含进阶参数调节控件
6. **8语言i18n**: 34×8=272条 + 相关性术语

---

## ⚠️ R186审计 → R187 4个降级追加

| # | 因子ID | 中文名 | 降级原因 | 教育文案要求 |
|---|--------|--------|----------|-------------|
| 1 | DISPOSITION_EFFECT | 处置效应 | 行为金融学"赚就跑/亏就扛" | "人性弱点：赚钱的股票卖太快，亏钱的死扛" |
| 2 | ANCHORING | 锚定效应 | 心理"锚点"概念 | "你被买入价'锚'住了，别用成本价判断该不该卖" |
| 3 | EQUITY_MULTIPLIER | 权益乘数 | 杜邦分析中间项 | "1元净资产撬动了多少资产？>3说明杠杆高" |
| 4 | AH_PREMIUM_CHANGE | AH溢价变化 | 变化率比绝对值更复杂 | "A股比H股贵/便宜的变化方向，南下资金风向标" |

---

## 📋 34🟡因子ID对照表

### A1 价值🟡 (3)

| # | 因子ID | 中文名 | 计算类型 | IC历史均值 |
|---|--------|--------|----------|-----------|
| 1 | SALES_TO_PRICE | 市销率倒数 | 比率型 | ~0.03 |
| 2 | CASHFLOW_YIELD | 现金流收益率 | 比率型 | ~0.04 |
| 3 | PEG_RATIO | PEG比率 | 比率型 | ~0.02 |

### A2 质量🟡 (3)

| # | 因子ID | 中文名 | 计算类型 | 说明 |
|---|--------|--------|----------|------|
| 4 | ROIC | 投入资本回报率 | 比率型 | 巴菲特最爱 |
| 5 | ASSET_TURNOVER | 资产周转率 | 比率型 | 资产使用效率 |
| 6 | PIOTROSKI_F | Piotroski F-Score | 打分型 | 0-9分基本面 |

### A3 低波🟡 (2)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 7 | IDIO_VOL | 特质波动率 | 比率型 |
| 8 | DOWNSIDE_VOL | 下行波动率 | 比率型 |

### A4 情绪🟡 (3)

| # | 因子ID | 中文名 | 计算类型 | 6虾关注 |
|---|--------|--------|----------|---------|
| 9 | ANALYST_REVISION | 分析师修正 | 排名型 | ⭐5/6推荐 |
| 10 | SHORT_INTEREST | 空头占比 | 比率型 | |
| 11 | ETF_FLOW | ETF资金净流入 | 排名型 | |

### A5 宏观🟡 (2)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 12 | INFLATION_BETA | 通胀敏感度 | 比率型 |
| 13 | RATE_SENSITIVITY | 利率敏感度 | 比率型 |

### A6 主题🟡 (3)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 14 | THEME_AI | AI主题暴露 | 排名型 |
| 15 | THEME_GREEN | 绿色能源暴露 | 排名型 |
| 16 | THEME_CONSUMPTION | 消费升级暴露 | 排名型 |

### A7 期权🟡 (3)

| # | 因子ID | 中文名 | 计算类型 | 6虾关注 |
|---|--------|--------|----------|---------|
| 17 | IV_SKEW | 波动率偏斜 | 比率型 | ML/QClaw推荐 |
| 18 | IV_RANK_ADVANCED | IV Rank进阶 | 排名型 | |
| 19 | PUT_CALL_RATIO | PCR看跌看涨比 | 比率型 | |

### A8 事件🟡 (3)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 20 | EARNINGS_ESTIMATE | 盈利预测修正 | 排名型 |
| 21 | PRE_EARNINGS_IV | 财报前IV飙升 | 比率型 |
| 22 | INDEX_REBALANCE | 指数再平衡 | 事件型 |

### A9 基本面🟡 (5)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 23 | FREE_CASH_FLOW | 自由现金流 | 比率型 |
| 24 | OPERATING_MARGIN | 营业利润率 | 比率型 |
| 25 | NET_MARGIN_STABILITY | 净利率稳定性 | 排名型 |
| 26 | SALES_GROWTH_CONSISTENCY | 营收增长持续性 | 排名型 |
| 27 | INVENTORY_TURNOVER | 存货周转率 | 比率型 |

### A10 行为🟡 + 降级 (4)

| # | 因子ID | 中文名 | 计算类型 | 来源 |
|---|--------|--------|----------|------|
| 28 | DISPOSITION_EFFECT | 处置效应 | 排名型 | ⬇️ R186降级 |
| 29 | ANCHORING | 锚定效应 | 排名型 | ⬇️ R186降级 |
| 30 | EQUITY_MULTIPLIER | 权益乘数 | 比率型 | ⬇️ R186降级 |

### 港股🟡 + 降级 (1)

| # | 因子ID | 中文名 | 计算类型 | 来源 |
|---|--------|--------|----------|------|
| 31 | AH_PREMIUM_CHANGE | AH溢价变化 | 排名型 | ⬇️ R186降级 |

### 补充🟡 (3)

| # | 因子ID | 中文名 | 计算类型 |
|---|--------|--------|----------|
| 32 | IC_DECAY_RATE | IC衰减率 | 排名型 |
| 33 | FACTOR_STABILITY | 因子稳定性 | 排名型 |
| 34 | SIGNAL_STRENGTH | 信号强度 | 打分型 |

> **总计: 34个🟡因子** (30原计划 + 4降级追加)

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 实现34🟡因子计算 | `electron/engine/factors/calculators/adv-*.ts` | ≥600行 | 34因子可计算 |
| J2 | Pearson相关系数矩阵 | `electron/engine/factors/correlation-matrix.ts` | ≥200行 | 矩阵输出正确 |
| J3 | Spearman秩相关计算 | 集成在correlation-matrix.ts | ≥50行 | 秩相关可调 |
| J4 | 34因子Registry注册 | `factor-id-registry.ts` | ≥50行 | L2标记正确 |

### 🦐 ML (前端)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorWeightSlider | `src/components/strategy/FactorWeightSlider.tsx` | ≥200行 | 拖拽+归一化和=100% |
| M2 | FactorPK对比台 | `src/components/strategy/FactorPKPanel.tsx` | ≥250行 | 双因子IC/收益/稳定性对比 |
| M3 | 🟡FactorCard进阶版 | `src/components/strategy/FactorCardAdv.tsx` | ≥200行 | 参数调节+信号灯+IC趋势 |

### 🦐 autoclaw (全栈)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 34🟡因子i18n(8语言) | `factor-i18n-map.ts` + locales | ≥400行 | 272条无缺译 |
| A2 | 相关性术语i18n | `src/i18n/locales/correlation-*.json` | ≥100行 | 4术语×8语言=32条 |
| A3 | 降级因子教育i18n | 集成在factor-i18n-map | ≥50行 | 4因子教育文案8语 |

### 🦐 QClaw (设计)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 因子婚姻冲突可视化 | `docs/design/factor-marriage-visual.md` | ≥200行 | 比喻生动 |
| Q2 | 🟡因子故事文案34个 | `docs/design/factor-stories-advanced-zh.md` | ≥150行 | 中文故事自然 |
| Q3 | 4降级因子教育文案 | `docs/design/factor-downgrade-stories.md` | ≥100行 | 解释为何降级+使用指南 |
| Q4 | 权重拖拽交互规范 | `docs/design/weight-slider-ux.md` | ≥100行 | UX规范完整 |

### 🦐 youdao (测试)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 34🟡因子单元测试 | `tests/unit/factors-advanced-*.test.ts` | ≥350行 | ≥170测试pass |
| Y2 | 相关性矩阵测试 | `tests/unit/correlation-matrix.test.ts` | ≥100行 | 高/低/负相关对验证 |
| Y3 | WeightSlider归一化测试 | `tests/unit/weight-slider.test.ts` | ≥50行 | 5项条件验证 |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R187 | 广播消息 | — | 6虾确认 |
| C2 | R187 Round计划(本文档) | 验收标准+分工+因子清单 | ≥400行 | 完整 |
| C3 | 🟡因子ID注册审计 | 因子ID+分类+命名审核 | — | 34因子注册正确 |

---

## ✅ 验收标准

### P0 必过 (12项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | 34🟡因子计算 | 全部可计算+信号灯有输出 | JVS |
| V03 | Pearson相关性矩阵 | 34×34矩阵可输出 | JVS |
| V04 | Spearman秩相关 | 可选启用，与Pearson可通过参数切换 | JVS |
| V05 | FactorWeightSlider | 拖拽权重+自动归一化和=100% | ML |
| V06 | FactorPK | 2因子IC/收益/稳定性实时对比 | ML |
| V07 | 🟡FactorCard | 信号灯+IC趋势+参数滑块 | ML |
| V08 | 34🟡因子i18n | 8语言272条，0缺译 | autoclaw |
| V09 | 相关性术语i18n | 强相关/弱相关/独立/冲突 4术语×8语言 | autoclaw |
| V10 | ≥170单元测试 | 34因子×5=170 | youdao |
| V11 | 相关性测试 | 高相关对/低相关对/负相关对 验证 | youdao |
| V12 | 归一化测试 | WeightSlider 5项条件pass | youdao |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V13 | 因子婚姻可视化 | 比喻生动、用户可理解 | QClaw |
| V14 | 4降级因子教育文案 | 解释"为何难"+"如何用" | QClaw |
| V15 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |
| V16 | 相关性计算<2s | 34×34矩阵秒出 | JVS |

---

## 📊 Phase 2 进度追踪

| Round | 状态 | 🟡因子数 | 累计🟡 |
|-------|------|---------|--------|
| R187 (本轮) | 🟢 启动 | 34 | 34 |
| R188 | ⏳ 待通知 | 30 (HK+US+CC) | 64 |
| R189 | ⏳ 待通知 | 0 (深度服务) | 64 |
| R190 | ⏳ 待通知 | 0 (收尾) | 64 |

---

## 🔑 关键规则 (R187)

1. **三级分类无门槛** — 纯信息分级，🟡需切换"进阶模式"
2. **因子免费+深度服务按次** — 34🟡因子本身免费(v17.7)
3. **不做A股** — KDJ除外
4. **4降级因子** — 必须以🟡等级注册，含教育文案
5. **相关性阈值** — r²≥0.7强相关(🟡警告) / 0.3-0.7中度 / <0.3弱
6. **权重归一化** — 拖拽任意权重后自动归一化和=100%

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- R186 Phase1审计: `docs/proposals/factor-expansion-R186-phase1-audit-report.md`
- 收费目录v17.7: `Desktop/quant-moo-收费目录-v17.7.txt`
