# R185 🟢入门因子验收报告 — PM审计

> PM(Claw) | 2026-06-15 | R185 | 🟢入门35因子

---

## 1. 因子ID命名审计

### 1.1 命名差异汇总

清单v2与Registry v2的35个🟢因子ID对照，共发现:

| 状态 | 数量 | 说明 |
|------|------|------|
| ✅ 完全一致 | 6 | KDJ / EARNINGS_SURPRISE / HK_AH_PREMIUM / CRYPTO_MVRV / CRYPTO_NVT / CRYPTO_EXCHANGE_FLOW |
| ⚠️ 名称差异 | 15 | 同义不同名(如EP_RATIO→EARNINGS_YIELD) |
| 🆕 需新增 | 14 | registry中不存在的因子 |

### 1.2 命名对齐决策

**决策1**: 清单v2 ID为最终标准，registry v2通过LEGACY_ID_MAP兼容旧ID

理由:
- 清单v2 ID是6虾12份建议合并后的共识命名
- 更语义化(如`EARNINGS_YIELD`比`EP_RATIO`更直观)
- 用户可见ID应友好易理解

**决策2**: 3组重复ID统一

| 保留ID | 废弃/映射ID | 理由 |
|--------|-------------|------|
| `SOUTHBOUND_FLOW` | HK_SOUTHBOUND_FLOW / HKEX_SOUTHBOUND | 统一命名，去重 |
| `CRYPTO_NVT` | CRYPTO_NVT_SIGNAL | NVT为基础版(🟢)，SIGNAL为进阶版(🟡) |
| `MAX_DRAWDOWN_1Y` | MAX_DRAWDOWN | 1Y版为🟢入门，通用版为🟡进阶 |

**决策3**: 前缀规范

| 市场 | 前缀 | 示例 |
|------|------|------|
| 通用 | 无前缀 | EARNINGS_YIELD / KDJ |
| 港股 | HK_ | HK_AH_PREMIUM / HK_REIT_YIELD |
| 美股 | US_ | US_EARNINGS_CALENDAR / US_DIVIDEND_ARISTOCRATS |
| 加密 | CRYPTO_ | CRYPTO_MVRV / CRYPTO_S2F |
| 跨市场 | XM_ | XM_MKTCAP_EXPOSURE / XM_LIQUIDITY |

### 1.3 14个新增因子清单

| # | 因子ID | 中文名 | L1分类 | L2分类 | 计算类型 |
|---|--------|--------|--------|--------|----------|
| 1 | ROA | 总资产收益率 | L1_FUNDAMENTAL | L2_PROFIT_QUALITY | 比率型 |
| 2 | GROSS_MARGIN | 毛利率 | L1_FUNDAMENTAL | L2_PROFIT_QUALITY | 比率型 |
| 3 | DEBT_TO_EQUITY | 负债权益比 | L1_FUNDAMENTAL | L2_RISK_STRUCTURE | 比率型 |
| 4 | INSIDER_BUYING | 内部人增持 | L1_SENTIMENT | L2_FLOW | 信号型 |
| 5 | FUND_FLOW | 资金流量 | L1_SENTIMENT | L2_FLOW | 排名型 |
| 6 | ETF_FLOW | ETF资金净流入 | L1_SENTIMENT | L2_FLOW | 排名型 |
| 7 | DIVIDEND_CHANGE | 股息变化 | L1_EVENT | L2_CORPORATE | 信号型 |
| 8 | SECTOR_STRENGTH | 行业强度 | L1_MACRO | L2_CYCLE | 排名型 |
| 9 | IV_RANK | 隐含波动率排名 | L1_SENTIMENT | L2_OPTIONS | 排名型 |
| 10 | CURRENCY_EFFECT | 汇率影响 | L1_MACRO | L2_CURRENCY | 比率型 |
| 11 | FREE_CASH_FLOW_YIELD | 自由现金流收益率 | L1_FUNDAMENTAL | L2_VALUE_DEEP | 比率型 |
| 12 | EQUITY_MULTIPLIER | 权益乘数 | L1_FUNDAMENTAL | L2_RISK_STRUCTURE | 比率型 |
| 13 | DISPOSITION_EFFECT | 处置效应 | L1_SENTIMENT | L2_MARKET_MOOD | 信号型 |
| 14 | ANCHORING | 锚定效应 | L1_SENTIMENT | L2_MARKET_MOOD | 信号型 |
| 15 | AH_PREMIUM_CHANGE | AH溢价变化率 | L1_HK | L2_PRICING | 比率型 |
| 16 | HSI_CONSTITUENT | 恒指成分股 | L1_HK | L2_PRICING | 信号型 |
| 17 | HK_REIT_YIELD | 港股REIT收益率 | L1_HK | L2_YIELD | 比率型 |
| 18 | US_EARNINGS_CALENDAR | 美股财报日历 | L1_US | L2_EVENT | 信号型 |
| 19 | US_SECTOR_ROTATION | 美股板块轮动 | L1_US | L2_CYCLE | 排名型 |
| 20 | US_SMALL_CAP_MOMENTUM | 美股小盘动量 | L1_US | L2_MOMENTUM | 排名型 |
| 21 | US_DIVIDEND_ARISTOCRATS | 美股股息贵族 | L1_US | L2_YIELD | 信号型 |
| 22 | US_SP500_EQUAL_WEIGHT | 标普等权 | L1_US | L2_STATS | 排名型 |
| 23 | CRYPTO_S2F | Stock-to-Flow | L1_CRYPTO | L2_VALUATION | 比率型 |
| 24 | CRYPTO_HASH_RATE | 算力 | L1_CRYPTO | L2_ONCHAIN | 排名型 |
| 25 | XM_MKTCAP_EXPOSURE | 市值暴露 | L1_CLASSIC | L2_SIZE | 排名型 |
| 26 | XM_LIQUIDITY | 非流动性 | L1_RISK | L2_LIQUIDITY | 排名型 |
| 27 | XM_DIVIDEND_ARAMA | 股息贵族 | L1_CROSS_ASSET | L2_YIELD | 信号型 |

> 注: 实际新增因子在去重合并后为27个，但其中部分ID在registry中已有近似项(如EP_RATIO≈EARNINGS_YIELD)，通过LEGACY_ID_MAP映射而非新增。

---

## 2. 🟢入门35因子分类统计

| 类别 | 数量 | 因子ID |
|------|------|--------|
| A1 价值 | 3 | EARNINGS_YIELD / BOOK_TO_PRICE / DIVIDEND_YIELD |
| A2 质量 | 3 | ROA / GROSS_MARGIN / DEBT_TO_EQUITY |
| A3 低波 | 2 | BETA / MAX_DRAWDOWN_1Y |
| A4 情绪 | 4 | KDJ / INSIDER_BUYING / FUND_FLOW / ETF_FLOW |
| A5 事件 | 2 | EARNINGS_SURPRISE / DIVIDEND_CHANGE |
| A6 行业 | 1 | SECTOR_STRENGTH |
| A7 期权 | 1 | IV_RANK |
| A8 宏观 | 1 | CURRENCY_EFFECT |
| A9 基本面 | 2 | FREE_CASH_FLOW_YIELD / EQUITY_MULTIPLIER |
| A10 行为 | 2 | DISPOSITION_EFFECT / ANCHORING |
| 港股🟢 | 5 | HK_AH_PREMIUM / AH_PREMIUM_CHANGE / SOUTHBOUND_FLOW / HSI_CONSTITUENT / HK_REIT_YIELD |
| 美股🟢 | 5 | US_EARNINGS_CALENDAR / US_SECTOR_ROTATION / US_SMALL_CAP_MOMENTUM / US_DIVIDEND_ARISTOCRATS / US_SP500_EQUAL_WEIGHT |
| 加密🟢 | 6 | CRYPTO_MVRV / CRYPTO_NVT / CRYPTO_S2F / CRYPTO_EXCHANGE_FLOW / CRYPTO_ACTIVE_ADDRESSES / CRYPTO_HASH_RATE |
| 跨市场🟢 | 3 | XM_MKTCAP_EXPOSURE / XM_LIQUIDITY / XM_DIVIDEND_ARAMA |
| **合计** | **40** | **通用21+港股5+美股5+加密6+跨市场3=40** |

> ⚠️ 数量校准: 清单v2标35个🟢入门因子，但对照表列出40个ID。R185实际实现**35个核心入门因子**，以下5个降级为🟡进阶(降低新手信息量):
> - DISPOSITION_EFFECT → 🟡 (行为因子新手难理解)
> - ANCHORING → 🟡 (行为因子新手难理解)
> - CURRENCY_EFFECT → 🟡 (需要宏观背景)
> - EQUITY_MULTIPLIER → 🟡 (杠杆概念新手不熟)
> - AH_PREMIUM_CHANGE → 🟡 (变化率需理解基础版)

### 最终🟢入门35因子 (PM确认版)

通用🟢(17个): EARNINGS_YIELD / BOOK_TO_PRICE / DIVIDEND_YIELD / ROA / GROSS_MARGIN / DEBT_TO_EQUITY / BETA / MAX_DRAWDOWN_1Y / KDJ / INSIDER_BUYING / FUND_FLOW / ETF_FLOW / EARNINGS_SURPRISE / DIVIDEND_CHANGE / SECTOR_STRENGTH / IV_RANK / FREE_CASH_FLOW_YIELD

港股🟢(5个): HK_AH_PREMIUM / SOUTHBOUND_FLOW / HSI_CONSTITUENT / HK_REIT_YIELD / (1个待QClaw定义)

美股🟢(5个): US_EARNINGS_CALENDAR / US_SECTOR_ROTATION / US_SMALL_CAP_MOMENTUM / US_DIVIDEND_ARISTOCRATS / US_SP500_EQUAL_WEIGHT

加密🟢(6个): CRYPTO_MVRV / CRYPTO_NVT / CRYPTO_S2F / CRYPTO_EXCHANGE_FLOW / CRYPTO_ACTIVE_ADDRESSES / CRYPTO_HASH_RATE

跨市场🟢(2个): XM_MKTCAP_EXPOSURE / XM_LIQUIDITY

> 合计: 17+5+5+6+2 = **35** ✅

---

## 3. 信号灯IC映射规范

| 信号灯 | 条件 | 含义 | 视觉 |
|--------|------|------|------|
| 🟢 绿灯 | IC > 0.05 且 p < 0.05 | 强正向因子 | 绿色圆点+脉冲动画 |
| 🟡 黄灯 | 0.02 < IC ≤ 0.05 且 p < 0.1 | 弱正向因子 | 黄色圆点 |
| 🔴 红灯 | IC < -0.05 且 p < 0.05 | 强负向因子 | 红色圆点+警示 |
| ⚪ 灰灯 | 数据不足或 p ≥ 0.1 | 信号不确定 | 灰色圆点 |

---

## 4. 8场景包定义 (PM初审)

| # | 场景包名 | 因子组合(示例) | 目标用户 |
|---|----------|----------------|----------|
| 1 | 🐂 牛市进攻 | EARNINGS_YIELD+MOM+SECTOR_STRENGTH+US_SMALL_CAP_MOMENTUM | 激进型 |
| 2 | 🐻 熊市防御 | DIVIDEND_YIELD+DEBT_TO_EQUITY+BETA+MAX_DRAWDOWN_1Y | 保守型 |
| 3 | 🔄 震荡轮动 | SECTOR_STRENGTH+ETF_FLOW+FUND_FLOW+IV_RANK | 灵活型 |
| 4 | ₿ 加密趋势 | CRYPTO_MVRV+CRYPTO_NVT+CRYPTO_S2F+CRYPTO_EXCHANGE_FLOW | 加密玩家 |
| 5 | 💎 价值掘金 | EARNINGS_YIELD+BOOK_TO_PRICE+ROA+FREE_CASH_FLOW_YIELD | 价值型 |
| 6 | 🚀 成长猎手 | EARNINGS_SURPRISE+US_SMALL_CAP_MOMENTUM+INSIDER_BUYING | 成长型 |
| 7 | 🇭🇰 港股窝轮 | HK_AH_PREMIUM+SOUTHBOUND_FLOW+HSI_CONSTITUENT+HK_REIT_YIELD | 港股玩家 |
| 8 | 🇺🇸 美股财报 | US_EARNINGS_CALENDAR+US_SECTOR_ROTATION+US_DIVIDEND_ARISTOCRATS | 美股玩家 |

> QClaw负责完善权重配置+因子数量(每包5-8因子)

---

## 5. R185验收 Checklist

- [ ] V01: TSC=0新增
- [ ] V02: 35因子可计算
- [ ] V03: IC框架输出Spearman Rank IC
- [ ] V04: Registry 35 ID+LEGACY映射
- [ ] V05: 信号灯4色渲染
- [ ] V06: 8场景包可选
- [ ] V07: 35 FactorCard+level徽章
- [ ] V08: 8语言i18n无缺译
- [ ] V09: 35因子故事文案中文
- [ ] V10: ≥175测试pass
- [ ] V11: IC→颜色映射正确
- [ ] V12: 场景包集成测试pass

---

*PM(Claw) 签发 | 等待6虾完成R185各分工后终审*
