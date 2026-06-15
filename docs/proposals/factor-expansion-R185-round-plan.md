# R185: 🟢入门35因子实现 — Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 1 | v2.5.0-alpha
> 前置: R184(基础设施)已完成 | 本轮: 35个入门因子全部可计算+信号灯+场景包+i18n

---

## 🎯 Round目标

1. **35个🟢入门因子**全部可计算，IC值输出合理
2. **信号灯组件**🟢🟡🔴⚪渲染正确
3. **8场景包**定义完整，可选择
4. **8语言i18n**无缺译，故事文案自然
5. **≥175单元测试**pass

---

## 📋 🟢入门35因子ID对照表 (清单v2 ↔ Registry v2)

### ⚠️ 命名差异需对齐

清单v2中的因子ID与registry v2存在部分命名不一致，R185必须统一。

| # | 清单v2 ID | Registry v2 ID | 状态 | 对齐方案 |
|---|-----------|----------------|------|----------|
| **A1 价值类 (3)** | | | | |
| 1 | EARNINGS_YIELD | EP_RATIO | ⚠️ 名称不同 | 采用清单ID `EARNINGS_YIELD`，registry新增别名 |
| 2 | BOOK_TO_PRICE | HML | ⚠️ 名称不同 | 采用清单ID `BOOK_TO_PRICE`，registry新增别名 |
| 3 | DIVIDEND_YIELD | YIELD | ⚠️ 名称不同 | 采用清单ID `DIVIDEND_YIELD`，registry新增别名 |
| **A2 质量类 (3)** | | | | |
| 4 | ROA | — (无) | 🆕 新增 | registry新增 `ROA` |
| 5 | GROSS_MARGIN | GROSS_MARGIN_TREND | ⚠️ 不同因子 | registry新增 `GROSS_MARGIN`(当期值)，保留TREND |
| 6 | DEBT_TO_EQUITY | — (有DEBT_COVERAGE) | 🆕 新增 | registry新增 `DEBT_TO_EQUITY`(D/E比) |
| **A3 低波类 (2)** | | | | |
| 7 | BETA | MKT | ⚠️ 名称不同 | 采用清单ID `BETA`(贝塔值)，MKT保留为市场因子 |
| 8 | MAX_DRAWDOWN_1Y | MAX_DRAWDOWN | ⚠️ 后缀不同 | 采用清单ID `MAX_DRAWDOWN_1Y`，MAX_DRAWDOWN为通用版 |
| **A4 情绪类 (4)** | | | | |
| 9 | KDJ | KDJ | ✅ 一致 | — |
| 10 | INSIDER_BUYING | INSIDER_TRADING / US_INSIDER_BUY | ⚠️ 名称不同 | 采用清单ID `INSIDER_BUYING`，registry新增 |
| 11 | FUND_FLOW | — (有INSTITUTIONAL_FLOW) | 🆕 新增 | registry新增 `FUND_FLOW`(净资金流) |
| 12 | ETF_FLOW | — (无) | 🆕 新增 | registry新增 `ETF_FLOW` |
| **A5 事件类 (2)** | | | | |
| 13 | EARNINGS_SURPRISE | EARNINGS_SURPRISE | ✅ 一致 | — |
| 14 | DIVIDEND_CHANGE | — (有DIVIDEND_CAPTURE) | 🆕 新增 | registry新增 `DIVIDEND_CHANGE`(股息变化方向) |
| **A6 行业类 (1)** | | | | |
| 15 | SECTOR_STRENGTH | SECTOR_ROTATION | ⚠️ 不同因子 | registry新增 `SECTOR_STRENGTH`(个股行业强度) |
| **A7 期权类 (1)** | | | | |
| 16 | IV_RANK | — (有OPTION_PCR/PUT_CALL_SKEW) | 🆕 新增 | registry新增 `IV_RANK` |
| **A8 宏观事件 (1)** | | | | |
| 17 | CURRENCY_EFFECT | FX_EXPOSURE | ⚠️ 不同语义 | registry新增 `CURRENCY_EFFECT`(汇率影响) |
| **A9 基本面 (2)** | | | | |
| 18 | FREE_CASH_FLOW_YIELD | CASH_FLOW_YIELD / FREE_CASH_FLOW | ⚠️ 混合 | registry新增 `FREE_CASH_FLOW_YIELD`(FCF/P) |
| 19 | EQUITY_MULTIPLIER | — (无) | 🆕 新增 | registry新增 `EQUITY_MULTIPLIER`(权益乘数) |
| **A10 行为类 (2)** | | | | |
| 20 | DISPOSITION_EFFECT | — (无) | 🆕 新增 | registry新增 `DISPOSITION_EFFECT` |
| 21 | ANCHORING | — (无) | 🆕 新增 | registry新增 `ANCHORING` |
| **港股🟢 (5)** | | | | |
| 22 | HK_AH_PREMIUM | HK_AH_PREMIUM | ✅ 一致 | — |
| 23 | AH_PREMIUM_CHANGE | HKEX_CBCS_PREMIUM | ⚠️ 不同 | registry新增 `AH_PREMIUM_CHANGE`(变化率) |
| 24 | SOUTHBOUND_FLOW | HK_SOUTHBOUND_FLOW / HKEX_SOUTHBOUND | ⚠️ 重复 | 统一为 `SOUTHBOUND_FLOW`，registry去重 |
| 25 | HSI_CONSTITUENT | — (无) | 🆕 新增 | registry新增 `HSI_CONSTITUENT` |
| 26 | HK_REIT_YIELD | — (无) | 🆕 新增 | registry新增 `HK_REIT_YIELD` |
| **美股🟢 (5)** | | | | |
| 27 | US_EARNINGS_CALENDAR | — (有EARN_ANNOUNCEMENT) | 🆕 新增 | registry新增 `US_EARNINGS_CALENDAR` |
| 28 | US_SECTOR_ROTATION | SECTOR_ROTATION | ⚠️ 前缀不同 | registry新增 `US_SECTOR_ROTATION`(美股板块) |
| 29 | US_SMALL_CAP_MOMENTUM | — (无) | 🆕 新增 | registry新增 `US_SMALL_CAP_MOMENTUM` |
| 30 | US_DIVIDEND_ARISTOCRATS | US_DPS_STABILITY | ⚠️ 不同 | registry新增 `US_DIVIDEND_ARISTOCRATS` |
| 31 | US_SP500_EQUAL_WEIGHT | — (无) | 🆕 新增 | registry新增 `US_SP500_EQUAL_WEIGHT` |
| **加密🟢 (6)** | | | | |
| 32 | CRYPTO_MVRV | CRYPTO_MVRV | ✅ 一致 | — |
| 33 | CRYPTO_NVT | CRYPTO_NVT / CRYPTO_NVT_SIGNAL | ⚠️ 重复 | 统一为 `CRYPTO_NVT`(基础版)，SIGNAL为🟡 |
| 34 | CRYPTO_S2F | — (无) | 🆕 新增 | registry新增 `CRYPTO_S2F`(Stock-to-Flow) |
| 35 | CRYPTO_EXCHANGE_FLOW | CRYPTO_EXCHANGE_FLOW | ✅ 一致 | — |
| 36 | CRYPTO_ACTIVE_ADDRESSES | CRYPTO_ACTIVE_ADDR | ⚠️ 后缀不同 | 统一为 `CRYPTO_ACTIVE_ADDRESSES` |
| 37 | CRYPTO_HASH_RATE | — (无) | 🆕 新增 | registry新增 `CRYPTO_HASH_RATE` |
| **跨市场🟢 (3)** | | | | |
| 38 | XM_MKTCAP_EXPOSURE | SIZE | ⚠️ 不同 | registry新增 `XM_MKTCAP_EXPOSURE`(市值暴露) |
| 39 | XM_LIQUIDITY | LIQ | ⚠️ 名称不同 | registry新增 `XM_LIQUIDITY`(非流动性) |
| 40 | XM_DIVIDEND_ARAMA | — (无) | 🆕 新增 | registry新增 `XM_DIVIDEND_ARAMA`(股息贵族) |

> ⚠️ 总计: ✅一致6个 / ⚠️名称差异15个 / 🆕需新增14个 = 35个

### 命名对齐规则 (PM审核通过)

1. **清单v2 ID为最终标准** — 用户可见的因子ID以清单v2为准
2. **Registry v2保留旧ID** — 旧ID通过LEGACY_ID_MAP映射到新ID
3. **新增14个因子** — 全部按清单v2 ID注册到FACTOR_SPEC
4. **去重3个** — SOUTHBOUND_FLOW统一(删除HK_SOUTHBOUND_FLOW/HKEX_SOUTHBOUND)，CRYPTO_NVT统一(SIGNAL为🟡版)，MAX_DRAWDOWN_1Y(1Y版为🟢，通用版为🟡)
5. **前缀规范**: 港股HK_ / 美股US_ / 加密CRYPTO_ / 跨市场XM_ / 通用无前缀

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎) — 因子计算 + IC框架

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | registry v2更新: 14个新ID+15个别名映射+3个去重 | factor-id-registry.ts补丁 | ≥100行 | 35个ID全部可查+LEGACY映射 |
| J2 | 35🟢因子计算实现(用R184模板) | factors/calculators/ | ≥800行 | 35因子可计算+IC值合理 |
| J3 | IC计算框架: 滚动IC+信号灯数据源 | factors/ic-calculator.ts | ≥200行 | IC输出Spearman Rank IC |

### 🦐 ML (前端) — 信号灯+场景包+卡片

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorSignalLight组件 | FactorSignalLight.tsx | ≥150行 | 🟢🟡🔴⚪渲染+过渡动画 |
| M2 | ScenarioPackSelector组件 | ScenarioPackSelector.tsx | ≥200行 | 8场景包可选+切换流畅 |
| M3 | 35🟢FactorCard渲染 | FactorCard含信号灯+level徽章 | ≥250行 | 35卡片渲染+0 TSC |

### 🦐 autoclaw (全栈) — i18n+故事文案

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 35🟢因子8语言i18n | billing-locale扩展 | ≥560行 | 8语言无缺译 |
| A2 | 因子故事文案35×8=280条 | factor-i18n-map升级 | ≥280行 | 故事自然+比喻生动 |

### 🦐 QClaw (设计) — 场景包+文案+向导

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 8场景包因子组合+权重 | scenario-packs.json | ≥200行 | 8场景包可运行 |
| Q2 | 35因子故事文案中文版 | factor-stories-zh.md | ≥350行 | 故事生动+人话+比喻 |
| Q3 | Onboarding 3步向导流程图 | onboarding-flow.md | ≥150行 | 流程清晰+步骤完整 |

### 🦐 youdao (测试) — 单元+信号灯+场景包

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 35因子单元测试(每因子≥5) | tests/factors/ | ≥350行 | ≥175测试pass |
| Y2 | 信号灯IC→颜色映射测试 | tests/signal-light.test.ts | ≥100行 | IC>0.05→🟢等映射正确 |
| Y3 | 场景包集成测试 | tests/scenario-pack.test.ts | ≥100行 | 选场景→因子组合正确 |

### 🦐 Claw (PM) — 审计+验收+广播

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R185 | 广播消息 | — | 6虾确认 |
| C2 | 因子命名规范审核(本文档) | 命名对照表+对齐规则 | ≥200行 | 35因子ID统一 |
| C3 | R185验收报告 | R185-verification-report.md | ≥300行 | 35因子验收 |

---

## ✅ 验收标准

### P0 必过 (12项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML |
| V02 | 35因子可计算 | 每个因子输入mock数据→输出数值 | JVS |
| V03 | IC框架可用 | 输出Spearman Rank IC值 | JVS |
| V04 | Registry 35 ID | 全部注册+LEGACY映射 | JVS |
| V05 | 信号灯渲染 | 🟢🟡🔴⚪ 4色正确显示 | ML |
| V06 | 场景包可选 | 8场景包可点击切换 | ML |
| V07 | FactorCard渲染 | 35卡片+level徽章+信号灯 | ML |
| V08 | 8语言i18n | 35因子×8语言=280条无缺译 | autoclaw |
| V09 | 故事文案 | 35因子×中文人话+比喻 | QClaw |
| V10 | ≥175测试pass | 35因子×5用例=175 | youdao |
| V11 | 信号灯映射 | IC→颜色4级映射正确 | youdao |
| V12 | 场景包集成 | 选择→组合正确 | youdao |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V13 | 8场景包权重 | 每包5-8因子+权重归一化 | QClaw |
| V14 | Build 0 error | 整体编译通过 | JVS/autoclaw |
| V15 | 因子故事8语言 | 中英日3语+5语机翻 | autoclaw |
| V16 | Onboarding流程图 | 3步向导逻辑完整 | QClaw |

---

## 🔑 关键规则 (R185)

1. **清单v2 ID为最终标准** — 用户可见因子ID以清单v2为准
2. **三级分类无门槛** — 🟢🟡🔴仅为信息分级，不限制使用
3. **因子免费+深度服务按次** — 与v17.7收费模型一致
4. **不做A股** — KDJ除外(港美股加密通用)
5. **使用R184基础设施** — 计算模板+3级分类UI+i18n批量脚本
6. **信号灯4色**: 🟢绿=强正向(IC>0.05) 🟡黄=中性(0.02-0.05) 🔴红=强负向(<-0.05) ⚪灰=数据不足

---

## 📎 参考文件

- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
- 费率体系: `docs/reference/fee-schedule.md`
