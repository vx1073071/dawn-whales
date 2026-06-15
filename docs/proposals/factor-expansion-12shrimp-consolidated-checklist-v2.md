# TradingEasy 因子扩充 — 6虾12份建议合并选择清单 v2

> PM(Claw) 整理 | 2026-06-15 v2 | KDJ已恢复 | 全因子三级分类 | 收费模式调研

---

## ⚡ v2 更新摘要

1. **KDJ已恢复** — 用户明确不删除，加入A4情绪类
2. **全因子三级分类** — 🟢入门(新手友好) / 🟡进阶(有经验) / 🔴专业(量化级别)，别吓到新手
3. **策略因子收费调研** — 深度调研6大平台，结论见文末

---

## 📋 来源文件 (12份)

| # | 虾 | 文件 | 重点 |
|---|---|------|------|
| 1 | 🦐 Claw(PM) | factor-expansion-proposal.md | 通用35因子，42→77 |
| 2 | 🦐 Claw(PM) | factor-expansion-hk-us-crypto-v2.md | 港股18+美股20+加密16，42→96 |
| 3 | 🦐 youdao | tradingeasy-factor-expansion-proposal.md | 70+因子6大类，44→150+ |
| 4 | 🦐 youdao | tradingeasy-hkus-crypto-factor-proposal-v2.md | 港股12+美股13+加密30+跨市场10 |
| 5 | 🦐 ML | factor-expansion-ux-proposal-R183.md | 7高价值因子+5UX |
| 6 | 🦐 ML | tradingeasy-hkus-crypto-factor-proposal-v2.md | 美股8+港股6+加密10+跨市场3+7UX |
| 7 | 🦐 QClaw | factor-expansion-optimization-proposal.md | 50+因子8类+10UX |
| 8 | 🦐 QClaw | strategy-factor-polish-proposal.md | 因子7+策略8+UI6+数据5=26项 |
| 9 | 🦐 youdao | strategy-factor-review-human-ux.md | 人类UX审查 |
| 10 | 🦐 youdao | factor-revenue-ux-review-v3.md | 营收对齐审查 |
| 11 | 🦐 JVS | (口头建议已含在chat-bridge) | 引擎层因子预处理+数据适配 |
| 12 | 🦐 autoclaw | (口头建议已含在chat-bridge) | 数据管线+因子→信号管线 |

---

## 🎚️ 三级分类标准

| 等级 | 图标 | 门槛 | 适合人群 | 默认可见 | 说明 |
|------|------|------|----------|----------|------|
| **L1 入门** | 🟢 | 无 | 新手/散户 | ✅ 默认展示 | 经典指标、直觉易懂、无需金融背景 |
| **L2 进阶** | 🟡 | 无 | 有经验交易者 | ❌ 需切换"进阶模式" | 需理解金融概念、有参数可调 |
| **L3 专业** | 🔴 | 无 | 量化/专业交易者 | ❌ 需切换"专业模式" | 复杂算法、链上数据、替代数据、需风控意识 |

> **关键UX原则**: 新手首次打开只看到🟢L1(约35个因子)，界面清爽不吓人。
> 点击"显示更多因子"→展示🟡L2。同理🟡→🔴。三级分类仅为信息分级，无任何使用门槛。

---

## 🔴 A部分：新因子注册 — 三级分类 + KDJ恢复

> ⛔ 已去除A股专属: BIAS乖离率(A股特有)、北向资金(A股专属)、大小非解禁(A股)、
> 申万行业轮动(A股)、沪深300选股(A股)、创业板/科创板策略(A股)、东方财富/雪球情绪(A股数据)
> ✅ KDJ已恢复(港美股加密也广泛使用)

### A1. 价值类 — 7个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A1-01 | EARNINGS_YIELD | 盈利收益率 | 🟢 | E/P，市盈率倒数，越高越便宜 | Claw/youdao/QClaw | ☐ |
| A1-02 | BOOK_TO_PRICE | 市净率倒数 | 🟢 | B/P，每元股价对应多少净资产 | Claw/ML | ☐ |
| A1-03 | SALES_TO_PRICE | 市销率倒数 | 🟡 | S/P，销售额相对股价 | Claw | ☐ |
| A1-04 | CASHFLOW_YIELD | 现金流收益率 | 🟡 | CF/P，真金白银vs股价 | Claw/youdao | ☐ |
| A1-05 | EBITDA_EV | 企业价值倍数 | 🔴 | EBITDA/EV，排除资本结构 | Claw | ☐ |
| A1-06 | DIVIDEND_YIELD | 股息率 | 🟢 | 年分红/股价，收息族最爱 | Claw/ML/QClaw | ☐ |
| A1-07 | PEG_RATIO | PEG比率 | 🟡 | PE/增长率，成长调整估值 | Claw/youdao | ☐ |

### A2. 质量类 — 8个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A2-01 | ROA | 总资产收益率 | 🟢 | 资产使用效率 | Claw/youdao | ☐ |
| A2-02 | ROIC | 投入资本回报率 | 🟡 | 巴菲特最爱指标 | youdao/ML | ☐ |
| A2-03 | ACCRUALS | 应计利润比 | 🔴 | 利润"水分"检测 | Claw/youdao | ☐ |
| A2-04 | GROSS_MARGIN | 毛利率 | 🟢 | 定价权指标 | Claw/QClaw | ☐ |
| A2-05 | ASSET_TURNOVER | 资产周转率 | 🟡 | 资产榨出收入的效率 | Claw | ☐ |
| A2-06 | DEBT_TO_EQUITY | 负债权益比 | 🟢 | 杠杆越低越安全 | Claw | ☐ |
| A2-07 | PIOTROSKI_F | Piotroski F-Score | 🟡 | 0-9分基本面评分 | youdao/QClaw/ML | ☐ |
| A2-08 | GRAHAM_NET | Graham Net-Net | 🔴 | 流动资产-总负债>市值=极度便宜 | QClaw | ☐ |

### A3. 低波动/防御类 — 5个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A3-01 | BETA | 市场贝塔 | 🟢 | <1=比大盘稳 | Claw | ☐ |
| A3-02 | IDIO_VOL | 特质波动率 | 🟡 | 剔掉大盘影响后的波动 | Claw/youdao | ☐ |
| A3-03 | DOWNSIDE_VOL | 下行波动率 | 🟡 | 只算下跌时的"受伤感" | Claw | ☐ |
| A3-04 | MAX_DRAWDOWN_1Y | 1年最大回撤 | 🟢 | 最近1年最惨跌了多少 | Claw | ☐ |
| A3-05 | BAB | 低Beta异象 | 🔴 | 低Beta股长期风险调整收益更优 | ML/youdao | ☐ |

### A4. 情绪/资金流类 — 8个（含恢复KDJ）

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A4-01 | KDJ | KDJ随机指标 | 🟢 | 超买超卖，金叉死叉 | **用户要求恢复** | ☐ |
| A4-02 | ANALYST_REVISION | 分析师预期修正 | 🟡 | 上调/下调EPS预测比例 | Claw/ML/youdao/QClaw | ☐ |
| A4-03 | SHORT_INTEREST | 空头占比 | 🟡 | 做空比例，过高=轧空机会 | Claw | ☐ |
| A4-04 | INSIDER_BUYING | 内部人增持 | 🟢 | 高管自掏腰包买入 | Claw/ML/youdao/QClaw | ☐ |
| A4-05 | FUND_FLOW | 资金流量 | 🟢 | 资金净流入/流出 | Claw | ☐ |
| A4-06 | SHORT_SQUEEZE | 轧空风险 | 🔴 | 高空头+低流通+涨价=逼空 | QClaw/ML | ☐ |
| A4-07 | SHORT_CROWDING | 空头拥挤度 | 🔴 | 做空比例在同行百分位 | ML | ☐ |
| A4-08 | ETF_FLOW | ETF资金净流入 | 🟡 | 板块/风格ETF资金流 | QClaw | ☐ |

### A5. 宏观/事件类 — 7个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A5-01 | INFLATION_BETA | 通胀敏感度 | 🟡 | 通胀涨1%股价涨多少 | Claw | ☐ |
| A5-02 | RATE_SENSITIVITY | 利率敏感度 | 🟡 | 利率涨1%股价变化 | Claw/ML | ☐ |
| A5-03 | GDP_BETA | GDP敏感度 | 🔴 | 经济对股价的影响 | Claw | ☐ |
| A5-04 | EARNINGS_SURPRISE | 业绩超预期 | 🟢 | 实际EPS vs 预期(PEAD) | Claw/ML/QClaw/youdao | ☐ |
| A5-05 | DIVIDEND_CHANGE | 股息变化 | 🟢 | 最近股息调整方向 | Claw/QClaw | ☐ |
| A5-06 | VOLATILITY_REGIME | 波动率区间 | 🔴 | 当前低/中/高波区间 | Claw | ☐ |
| A5-07 | FACTOR_CROWDING | 因子拥挤度 | 🔴 | 太多人用同一因子=要失效 | ML/QClaw/youdao | ☐ |

### A6. 行业/主题类 — 4个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A6-01 | SECTOR_STRENGTH | 行业强度 | 🟢 | 所在行业相对大盘强度 | Claw | ☐ |
| A6-02 | THEME_AI | AI主题暴露 | 🟡 | AI相关业务收入占比 | Claw | ☐ |
| A6-03 | THEME_GREEN | 绿色能源暴露 | 🟡 | 新能源/ESG占比 | Claw | ☐ |
| A6-04 | THEME_CONSUMPTION | 消费升级暴露 | 🟡 | 消费类业务占比 | Claw | ☐ |

### A7. 期权/衍生品类 — 10个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A7-01 | IV_SKEW | 波动率偏斜 | 🟡 | 看跌比看涨贵=恐惧 | Claw/QClaw/ML | ☐ |
| A7-02 | GAMMA_EXPOSURE | Gamma暴露 | 🔴 | 做市商对冲压力 | Claw/QClaw/ML | ☐ |
| A7-03 | IMPLIED_CORRELATION | 隐含相关性 | 🔴 | 期权价格隐含的个股相关性 | Claw | ☐ |
| A7-04 | IV_TERM_STRUCT | 波动率期限结构 | 🔴 | 近月vs远月=恐慌程度 | QClaw | ☐ |
| A7-05 | VRP | 波动率风险溢价 | 🔴 | IV-RV=卖期权信号 | QClaw | ☐ |
| A7-06 | OPTION_VOLUME_PCR | 期权成交量PCR | 🟡 | 盘中实时情绪 | QClaw | ☐ |
| A7-07 | OPTION_FLOW | 大单期权流向 | 🔴 | >100张合约的大单方向 | QClaw | ☐ |
| A7-08 | PINCH_RISK | Pin风险 | 🔴 | 到期日行权价集中度 | QClaw | ☐ |
| A7-09 | EARNINGS_MOVE | 财报隐含波动 | 🟡 | 财报前跨式期权价/股价 | QClaw | ☐ |
| A7-10 | OPTION_SKEW | 期权偏度(25Delta) | 🔴 | OTM Put IV - OTM Call IV | ML | ☐ |

### A8. 事件驱动类 — 7个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A8-01 | EARNINGS_REVISION | 一致预期修正 | 🟡 | 分析师上调/下调EPS比例 | QClaw/ML | ☐ |
| A8-02 | DIVIDEND_CHANGE_EV | 分红变动 | 🟢 | 新旧分红变化幅度 | QClaw | ☐ |
| A8-03 | BUYBACK_ANNOUNCE | 回购公告 | 🟡 | 宣布回购/市值 | QClaw | ☐ |
| A8-04 | INDEX_REBALANCE | 指数调仓预期 | 🔴 | 纳入/剔除指数 | QClaw | ☐ |
| A8-05 | INSIDER_TRADE | 内部人交易 | 🟡 | 高管买卖净额/日均成交 | QClaw/ML | ☐ |
| A8-06 | BOND_SPREAD | 信用利差变动 | 🔴 | CDS利差扩大=违约风险 | QClaw | ☐ |
| A8-07 | BUYBACK_YIELD | 回购收益率(升级) | 🔴 | 净回购/市值+加速度+授权量 | ML | ☐ |

### A9. 套利/相对价值类 — 6个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A9-01 | PAIRS_SPREAD | 配对价差偏离 | 🔴 | 2只高相关股偏离>2σ | QClaw | ☐ |
| A9-02 | CROSS_MARKET_DISCOUNT | 跨市场折溢价 | 🔴 | 同资产不同市场价格比 | QClaw | ☐ |
| A9-03 | ETF_NAV_DISCOUNT | ETF折溢价 | 🟡 | ETF市价 vs NAV | QClaw | ☐ |
| A9-04 | FIXED_INCOME_CARRY | Carry因子 | 🔴 | 近远月展期收益率 | QClaw | ☐ |
| A9-05 | CONVERTIBLE_ARB | 可转债套利信号 | 🔴 | 隐含波 vs 正股历史波 | QClaw | ☐ |
| A9-06 | STAT_ARB_RESIDUAL | 统计套利残差 | 🔴 | 多因子回归残差偏离 | QClaw | ☐ |

### A10. 基本面深度类 — 6个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A10-01 | ROE_TREND | ROE变动趋势 | 🟡 | 当前vs 5年均值ROE | QClaw | ☐ |
| A10-02 | FREE_CASHFLOW_YIELD | 自由现金流收益率 | 🟡 | FCF/市值，比PE更诚实 | youdao/QClaw | ☐ |
| A10-03 | GROSS_MARGIN_TREND | 毛利率趋势 | 🟡 | 当前vs 3年均值，扩张=定价权 | QClaw | ☐ |
| A10-04 | DEBT_MATURITY | 债务到期风险 | 🔴 | 1年内到期债/现金 | QClaw | ☐ |
| A10-05 | CAPEX_INTENSITY | 资本开支强度 | 🔴 | CapEx/折旧，>1=扩张 | QClaw | ☐ |
| A10-06 | ALTMAN_Z | Altman Z-Score | 🟡 | 破产风险评分，<1.8=危险 | youdao | ☐ |

### A11. 行为金融类 — 5个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A11-01 | SHORT_TERM_REVERSAL | 短期反转 | 🟡 | 上月最差下月反弹 | QClaw | ☐ |
| A11-02 | DISPOSITION_EFFECT | 处置效应 | 🔴 | 浮盈/浮亏的行为偏差 | QClaw | ☐ |
| A11-03 | GAP_FILL | 缺口回补倾向 | 🟡 | 跳空缺口回补概率 | QClaw | ☐ |
| A11-04 | VOLUME_CLIMAX | 天量天价 | 🟢 | 量>3倍+涨>3%=衰竭 | QClaw | ☐ |
| A11-05 | RETAIL_SENTIMENT | 散户情绪 | 🟡 | Reddit/社区讨论热度 | QClaw | ☐ |

### A12. 替代数据类 — 6个

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| A12-01 | NEWS_NLP | 新闻情绪NLP | 🟡 | 正负面新闻评分-1到+1 | youdao/QClaw | ☐ |
| A12-02 | APP_DOWNLOADS | 应用下载量 | 🔴 | 公司App下载趋势 | QClaw | ☐ |
| A12-03 | JOB_POSTINGS | 招聘发布量 | 🔴 | 新岗位数变化 | QClaw | ☐ |
| A12-04 | SUPPLY_CHAIN | 供应链信号 | 🔴 | 上下游股价联动 | QClaw | ☐ |
| A12-05 | ESG_SCORE | ESG评分变动 | 🟡 | MSCI ESG评级变化 | youdao/QClaw | ☐ |
| A12-06 | PATENT_FILING | 专利申请 | 🔴 | 专利申请数量增速 | QClaw | ☐ |

---

## 🇭🇰 B部分：港股专属因子 — 三级分类

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| HK-01 | HK_CBBC_RATIO | 牛熊比例 | 🟡 | 牛证/熊证成交比 | Claw | ☐ |
| HK-02 | HK_WARRANT_IV | 窝轮引伸波幅 | 🔴 | 窝轮定价的隐含波动率 | Claw | ☐ |
| HK-03 | HK_WARRANT_TURNOVER | 窝轮成交额 | 🟡 | 窝轮+牛熊证日均成交 | Claw | ☐ |
| HK-04 | HK_CBBC_DISTANCE | 牛熊证回收距离 | 🟡 | 牛证距回收价% | Claw | ☐ |
| HK-05 | HK_WARRANT_DELTA | 窝轮对冲值 | 🔴 | 正股涨1元轮涨多少 | Claw | ☐ |
| HK-06 | HK_SHORT_SELL_RATIO | 港股沽空比率 | 🟡 | 沽空/总成交，>20%=高沽空 | Claw/youdao | ☐ |
| HK-07 | HK_IPO_PERFORMANCE | 新股首日表现 | 🟢 | 近3月新股首日平均涨跌 | Claw/youdao | ☐ |
| HK-08 | HK_PROPERTY_SECTOR | 地产板块强度 | 🟢 | 香港地产股相对恒指 | Claw | ☐ |
| HK-09 | HK_FINANCIAL_SECTOR | 金融板块强度 | 🟢 | 汇丰/渣打等相对表现 | Claw | ☐ |
| HK-10 | HK_TECH_SECTOR | 科技板块强度 | 🟢 | 腾讯/阿里等相对表现 | Claw | ☐ |
| HK-11 | HK_DIVIDEND_YIELD | 港股股息率 | 🟢 | 恒指整体股息率 | Claw | ☐ |
| HK-12 | HK_REIT_YIELD | REIT收益率 | 🟡 | 领展等REIT分派率 | Claw | ☐ |
| HK-13 | HK_HSCEI_PREMIUM | H股溢价 | 🟡 | AH溢价指数，>100=H股便宜 | Claw/ML | ☐ |
| HK-14 | HK_ETF_FLOW | ETF资金流 | 🟡 | 盈富基金等大ETF资金 | Claw | ☐ |
| HK-15 | HK_LEVERAGE_INVERSE | 杠杆反向产品 | 🔴 | 南方/FI恒指成交量 | Claw | ☐ |
| HK-16 | HK_SOUTHBOUND_SMART | 南向资金动量分化 | 🔴 | 股价↓+南向↑=聪明钱抄底 | youdao/ML | ☐ |
| HK-17 | HK_WARRANT_OVERHEAT | 窝轮街货量 | 🔴 | 街货/总发行，>80%=过热 | ML | ☐ |
| HK-18 | HK_DIV_TAX_ADV | 红利税优化 | 🟡 | H股20%/红筹10%/本地0%净收益 | ML | ☐ |
| HK-19 | HKD_PEG_PRESSURE | 港元联系汇率压力 | 🔴 | USDHKD接近7.85=热钱要跑 | ML | ☐ |
| HK-20 | HIBOR_STEEPNESS | 港元拆息陡峭度 | 🔴 | 3M-O/N利差，>50bp=紧张 | ML | ☐ |
| HK-21 | HK_PRIVATIZATION | 私有化概率 | 🔴 | 市值<净资产+P/B<1+增持 | youdao | ☐ |
| HK-22 | HK_DERIV_POS_ANOMALY | 衍生品持仓异动 | 🔴 | 牛证/熊证街货量突变 | youdao | ☐ |
| HK-23 | HK_HSI_WEIGHT_CHANGE | 恒指成分股权重变动 | 🔴 | 被动基金调仓预测 | youdao | ☐ |
| HK-24 | HK_BOARD_ROTATION | 板块轮动强度 | 🟡 | 科技vs金融vs地产 | youdao | ☐ |

---

## 🇺🇸 C部分：美股专属因子 — 三级分类

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| US-01 | US_EARNINGS_SURPRISE | 业绩超预期幅度 | 🟢 | 实际EPS vs 预期 | Claw/youdao | ☐ |
| US-02 | US_EARNINGS_REVISION | 盈利预测上调 | 🟡 | 分析师上调EPS | Claw/youdao | ☐ |
| US-03 | US_REVENUE_SURPRISE | 营收超预期 | 🟡 | 实际营收 vs 预期 | Claw | ☐ |
| US-04 | US_GUIDANCE_CHANGE | 管理层指引变化 | 🔴 | 下季指引上调/下调 | Claw | ☐ |
| US-05 | US_POST_EARNINGS_DRIFT | 财报后漂移 | 🔴 | PEAD效应 | Claw | ☐ |
| US-06 | US_OI_PUT_CALL | 未平仓PCR | 🟡 | 持仓看跌/看涨比 | Claw | ☐ |
| US-07 | US_VOLUME_PCR | 成交量PCR | 🟡 | 今日看跌/看涨成交比 | Claw | ☐ |
| US-08 | US_GAMMA_EXPOSURE | Gamma暴露 | 🔴 | 做市商对冲压力 | Claw | ☐ |
| US-09 | US_MAX_PAIN | 最大痛点 | 🔴 | 期权到期买方最大损失价位 | Claw | ☐ |
| US-10 | US_IV_RANK | 隐含波幅百分位 | 🟡 | 当前IV在1年中的位置 | Claw | ☐ |
| US-11 | US_SKEW_INDEX | 偏斜指数 | 🔴 | 看跌减看涨IV差 | Claw | ☐ |
| US-12 | US_13F_FLOW | 机构持仓变动 | 🟡 | 每季度13F报告 | Claw/youdao | ☐ |
| US-13 | US_INSIDER_TRADING | 内部人交易 | 🟢 | CEO/CFO买卖 | Claw/youdao | ☐ |
| US-14 | US_BUYBACK_YIELD | 回购收益率 | 🟡 | 净回购/市值 | Claw | ☐ |
| US-15 | US_SHORT_FLOAT | 沽空流通比 | 🟡 | 做空/流通股，>20%可能轧空 | Claw | ☐ |
| US-16 | US_MAG7_STRENGTH | 七巨头强度 | 🟢 | AAPL/MSFT/NVDA等相对标普 | Claw | ☐ |
| US-17 | US_SECTOR_LEADER | 板块龙头 | 🟢 | 各板块市值最大股强度 | Claw | ☐ |
| US-18 | US_RETAIL_FLOW | 散户资金流 | 🟡 | Robinhood等零售流入 | Claw | ☐ |
| US-19 | US_EARNINGS_SEASON | 财报季节奏 | 🟢 | 当前处于财报季哪阶段 | Claw | ☐ |
| US-20 | US_DEBT_CEILING | 债务上限影响 | 🔴 | 政治风险量化 | Claw | ☐ |
| US-21 | US_0DTE_RATIO | 0DTE期权占比 | 🔴 | 日内赌博情绪 | youdao | ☐ |
| US-22 | US_MEME_STOCK | Meme Stock热度 | 🟡 | Reddit WSB提及次数 | youdao | ☐ |
| US-23 | US_SPLIT_EXPECT | 拆股预期 | 🔴 | 股价>$500+历史模式 | youdao | ☐ |
| US-24 | US_BUYBACK_ACCEL | 回购加速度 | 🔴 | 本季/上季-1 | youdao | ☐ |
| US-25 | US_SHORT_INTEREST_RATE | 卖空利息率 | 🔴 | 借券做空年化成本，>50%=逼空 | youdao | ☐ |
| US-26 | US_SPAC_PROGRESS | SPAC合并进度 | 🔴 | De-SPAC完成度 | youdao | ☐ |
| US-27 | US_SECTOR_ETF_FLOW | 板块ETF资金流 | 🟡 | XLK/XLE/XLF资金 | youdao | ☐ |
| US-28 | US_SEASONALITY | 季节性效应 | 🟡 | 同月历史胜率 | youdao | ☐ |
| US-29 | US_SHORT_SQUEEZE_SCORE | 逼空雷达 | 🔴 | 高空头+低流通+涨价 | ML | ☐ |

---

## 🪙 D部分：加密货币专属因子 — 三级分类

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| CC-01 | CRYPTO_MVRV | MVRV比率 | 🟡 | 市值/实现市值，>3.7=过热 | Claw/ML/youdao | ☐ |
| CC-02 | CRYPTO_SOPR | 花费产出利润率 | 🟡 | >1=获利卖出，<1=割肉 | Claw/ML/youdao | ☐ |
| CC-03 | CRYPTO_PUELL | Puell多重 | 🔴 | 矿工收入/365日均线 | Claw | ☐ |
| CC-04 | CRYPTO_HASHRATE | 哈希率变化 | 🟡 | 算力增长/下降速率 | Claw | ☐ |
| CC-05 | CRYPTO_STABLECOIN_RATIO | 稳定币占比 | 🟢 | USDT+USDC/总市值，>15%=避险 | Claw | ☐ |
| CC-06 | CRYPTO_EXCHANGE_RESERVE | 交易所余额 | 🟢 | 余额下降=提币囤积 | Claw/ML | ☐ |
| CC-07 | CRYPTO_DEFI_TVL | DeFi锁仓量 | 🟢 | 总锁仓上升=生态活跃 | Claw/QClaw/youdao | ☐ |
| CC-08 | CRYPTO_NFT_VOLUME | NFT交易量 | 🔴 | NFT市场周变化 | Claw | ☐ |
| CC-09 | CRYPTO_L2_TVL | L2锁仓量 | 🟡 | Arbitrum/Optimism TVL | Claw | ☐ |
| CC-10 | CRYPTO_STAKING_YIELD | 质押收益率 | 🟢 | ETH质押年化 | Claw | ☐ |
| CC-11 | CRYPTO_BRIDGE_FLOW | 跨链桥流量 | 🔴 | Ethereum/L2/Solana间流动 | Claw/ML | ☐ |
| CC-12 | CRYPTO_USDT_PREMIUM | USDT溢价 | 🟡 | 场外偏离1美元幅度 | Claw | ☐ |
| CC-13 | CRYPTO_DEX_VOLUME | DEX成交量 | 🟢 | Uniswap等日成交 | Claw | ☐ |
| CC-14 | CRYPTO_FEAR_GREED | 恐惧贪婪指数 | 🟢 | 0=极度恐惧, 100=贪婪 | Claw | ☐ |
| CC-15 | CRYPTO_SOCIAL_VOLUME | 社交讨论量 | 🟡 | Twitter/Reddit讨论热度 | Claw | ☐ |
| CC-16 | CRYPTO_LONGSHORT_RATIO | 多空比 | 🟢 | 全网合约多空持仓比 | Claw | ☐ |
| CC-17 | CRYPTO_STABLECOIN_MINT | 稳定币铸造量 | 🔴 | USDT/USDC 7d净增发 | QClaw | ☐ |
| CC-18 | CRYPTO_WHALE_MOVEMENT | 巨鲸转账 | 🟡 | >1000 BTC转入/出交易所 | QClaw | ☐ |
| CC-19 | CRYPTO_MINER_FLOW | 矿工流向 | 🔴 | 矿工→交易所BTC | QClaw/ML | ☐ |
| CC-20 | CRYPTO_PERP_PREMIUM | 合约溢价 | 🟡 | 永续-现货价格差 | QClaw | ☐ |
| CC-21 | CRYPTO_MVRV_Z | MVRV Z-Score | 🔴 | 偏离链上成本的极端度 | ML/youdao | ☐ |
| CC-22 | CRYPTO_HODL_WAVE | 持币周期波 | 🔴 | 短期/中期/长期UTXO占比 | ML | ☐ |
| CC-23 | CRYPTO_EXCHANGE_PREMIUM | 交易所净流入升级 | 🔴 | 鲸鱼+余额比+总流通量 | ML | ☐ |
| CC-24 | CRYPTO_STABLECOIN_M2 | 稳定币M2变化 | 🔴 | 总稳定币30d变化率 | ML | ☐ |
| CC-25 | CRYPTO_FUNDING_EXTREME | 资金费率极端值 | 🔴 | 百分位+累计+拥挤检测 | ML | ☐ |
| CC-26 | CRYPTO_OI_QUADRANT | OI四象限 | 🟡 | 价格↑+OI↑=真突破 等 | ML | ☐ |
| CC-27 | CRYPTO_ONCHAIN_GDP | 链上活跃度综合分 | 🔴 | DAU+交易+量+Gas加权 | ML | ☐ |
| CC-28 | CRYPTO_MINER_SELL_PRESS | 矿工卖出压力 | 🔴 | 矿工→交易所/总产出 | ML | ☐ |
| CC-29 | CRYPTO_CROSSCHAIN_FLOW | 跨链资金流 | 🔴 | L2资金净流入/流出 | ML | ☐ |
| CC-30 | CRYPTO_GAS_TREND | Gas费趋势 | 🟡 | ETH gas费MA | youdao | ☐ |
| CC-31 | CRYPTO_RESERVE_PROOF | 交易所储备金证明 | 🔴 | 钱包余额趋势 | youdao | ☐ |
| CC-32 | CRYPTO_WHALE_TX_COUNT | 巨鲸交易笔数 | 🔴 | >$1M交易30日均值 | youdao | ☐ |
| CC-33 | CRYPTO_25DELTA_RR | 25Delta风险逆转 | 🔴 | Call IV - Put IV专业情绪 | youdao | ☐ |
| CC-34 | CRYPTO_BTC_DOM_CHANGE | BTC Dominance变化 | 🟡 | 占比30日变化=山寨季 | youdao | ☐ |
| CC-35 | CRYPTO_PERP_BASIS | 永续合约基差 | 🟡 | 永续-现货价格 | youdao | ☐ |
| CC-36 | CRYPTO_LIQUIDATION_MAP | 清算热力图 | 🔴 | 各价格区间清算密集度 | youdao | ☐ |
| CC-37 | CRYPTO_OPTION_TERM | 期权期限结构 | 🔴 | 近月vs远月IV差 | youdao | ☐ |
| CC-38 | CRYPTO_TAKER_RATIO | Taker买卖比 | 🟡 | 主动买/主动卖量 | youdao | ☐ |
| CC-39 | CRYPTO_DEV_ACTIVITY | 开发者活跃度 | 🟡 | GitHub commits 30日均值 | youdao | ☐ |
| CC-40 | CRYPTO_DEV_CENTRAL | 开发者集中度 | 🔴 | Top10开发者贡献占比 | youdao | ☐ |
| CC-41 | CRYPTO_TOKEN_UNLOCK | 代币解锁时间表 | 🔴 | 30/90天解锁量/流通量 | youdao | ☐ |
| CC-42 | CRYPTO_PROTOCOL_REV | 协议收入 | 🔴 | 30日协议费用收入 | youdao | ☐ |
| CC-43 | CRYPTO_PF_RATIO | P/F Ratio | 🔴 | 市值/协议年化收入 | youdao | ☐ |
| CC-44 | CRYPTO_INFLATION | 通胀率 | 🟡 | 年化新增/流通量 | youdao | ☐ |
| CC-45 | CRYPTO_GOVERNANCE | 治理提案活跃度 | 🔴 | 提案数+投票参与率 | youdao | ☐ |

---

## 🌏 E部分：跨市场通用因子 — 三级分类

| # | 因子ID | 中文名 | 等级 | 人话解释 | 推荐虾 | ✅选? |
|---|--------|--------|------|----------|--------|------|
| XM-01 | MARKET_CAP_BETA | 市值因子暴露 | 🟡 | 大小盘Beta | youdao | ☐ |
| XM-02 | AMIHUD_ILLIQUID | Amihud非流动性 | 🔴 | 价格冲击/成交量 | youdao | ☐ |
| XM-03 | COSKEWNESS | 协偏度 | 🔴 | 与市场非线性关系 | youdao | ☐ |
| XM-04 | RECOVERY_DAYS | 最大回撤恢复天数 | 🟡 | 韧性因子 | youdao | ☐ |
| XM-05 | HIGH_52W_DISTANCE | 52周高点距离 | 🟢 | 当前价/52周最高-1 | youdao | ☐ |
| XM-06 | INST_RETAIL_RATIO | 机构vs散户持仓比 | 🟡 | 成熟度指标 | youdao | ☐ |
| XM-07 | ANALYST_COVERAGE_CHG | 分析师覆盖变化 | 🔴 | 关注度因子 | youdao | ☐ |
| XM-08 | TARGET_PRICE_DISP | 目标价离散度 | 🔴 | 不确定性指标 | youdao | ☐ |
| XM-09 | DIVIDEND_ARISTOCRAT | 股息贵族年限 | 🟢 | 连续分红>25年 | youdao | ☐ |
| XM-10 | SECTOR_ROTATION_SPEED | 板块轮动速度 | 🔴 | 轮动快=震荡市 | ML | ☐ |

---

## 🎨 F部分：UX/功能打磨

### F1. 因子展示优化（含三等级落地）

| # | 建议 | 内容 | 推荐虾 | ✅选? |
|---|------|------|--------|------|
| F1-01 | 因子三级分类落地 | 🟢入门默认展示/🟡进阶需切换/🔴专业需切换(无门槛) | Claw/youdao | ☐ |
| F1-02 | 场景化因子包(一键配置) | 牛市进攻/熊市防御/震荡轮动/加密趋势等 | 全部6虾 | ☐ |
| F1-03 | 因子信号灯灯🟢🟡🔴 | IC值→视觉信号替代裸数字 | QClaw/youdao | ☐ |
| F1-04 | 因子故事化文案 | 每因子配一句话人话+比喻 | Claw/ML/QClaw | ☐ |
| F1-05 | 因子市场自动切换 | 选港股→自动显示港股因子 | Claw | ☐ |
| F1-06 | 因子搜索(说人话) | 输入"便宜好公司"→匹配因子 | Claw | ☐ |

### F2. 因子交互优化

| # | 建议 | 内容 | 推荐虾 | ✅选? |
|---|------|------|--------|------|
| F2-01 | 因子权重拖拽滑块 | 实时拖拽调权重+自动归一化 | QClaw | ☐ |
| F2-02 | 因子PK对比台 | 2因子实时PK+结论+互补建议 | ML/QClaw | ☐ |
| F2-03 | 因子婚姻冲突可视化 | 相关性用婚姻比喻展示 | ML/QClaw | ☐ |
| F2-04 | 因子衰退倒计时 | IC衰减预测+优化建议 | ML/QClaw | ☐ |
| F2-05 | 因子互动滑块 | 拖动参数实时看预估效果 | QClaw | ☐ |
| F2-06 | 因子健康预警 | IC/拥挤度/相关性四维健康 | ML | ☐ |
| F2-07 | 因子沙盒速算 | 选中因子→秒级历史回测 | ML | ☐ |
| F2-08 | 一键诊断模式 | 输入股票→自动跑全因子→Top5 | QClaw | ☐ |
| F2-09 | 因子日历热力图 | 月度因子收益热力图 | ML | ☐ |
| F2-10 | 因子周龙虎榜 | 本周哪些因子赚钱 | ML | ☐ |

### F3. 因子社交/引导

| # | 建议 | 内容 | 推荐虾 | ✅选? |
|---|------|------|--------|------|
| F3-01 | 因子朋友圈(社交证明) | "1247人正在使用"+评分+评价 | QClaw | ☐ |
| F3-02 | 因子说明书Onboarding | 3步向导→推荐入门组合 | QClaw | ☐ |
| F3-03 | 因材施教推荐 | 用户画像→因子匹配 | QClaw | ☐ |
| F3-04 | 食材超市+菜包模式 | 专业自选 vs 散户一键包 | QClaw | ☐ |

### F4. 架构/引擎打磨

| # | 建议 | 内容 | 推荐虾 | ✅选? |
|---|------|------|--------|------|
| F4-01 | 因子预处理管线 | MAD去极值+行业中性化+标准化 | QClaw/JVS | ☐ |
| F4-02 | 因子数据统一适配层 | FactorDataProvider接口 | QClaw/JVS | ☐ |
| F4-03 | 因子发现向导3步 | 选因子→选市场→看结果 | QClaw | ☐ |
| F4-04 | 因子滚动IC监控 | 12月IC趋势热力图 | QClaw | ☐ |
| F4-05 | 因子拥挤度报警 | 估值溢价+持仓集中+换手 | QClaw | ☐ |
| F4-06 | 因子回测(单因子测试) | 分层回测+多空组合+换手成本 | QClaw | ☐ |
| F4-07 | 策略模板扩展6→22 | 4趋势+4均值+4动量+3价值+3多因子+4期权 | QClaw | ☐ |
| F4-08 | 参数敏感性分析 | 热力图+过拟合警告 | QClaw | ☐ |
| F4-09 | 策略健康评分 | 0-100分+自动诊断 | QClaw | ☐ |
| F4-10 | 实盘vs回测偏差 | 曲线对比+归因分析 | QClaw | ☐ |

---

## 📊 三等级分布统计

| 类别 | 总数 | 🟢入门 | 🟡进阶 | 🔴专业 |
|------|------|--------|--------|--------|
| A1 价值 | 7 | 3 | 3 | 1 |
| A2 质量 | 8 | 3 | 2 | 3 |
| A3 低波/防御 | 5 | 2 | 2 | 1 |
| A4 情绪/资金流 | 8 | 3 | 2 | 3 |
| A5 宏观/事件 | 7 | 2 | 2 | 3 |
| A6 行业/主题 | 4 | 1 | 3 | 0 |
| A7 期权/衍生品 | 10 | 0 | 3 | 7 |
| A8 事件驱动 | 7 | 1 | 3 | 3 |
| A9 套利/相对价值 | 6 | 0 | 1 | 5 |
| A10 基本面深度 | 6 | 0 | 4 | 2 |
| A11 行为金融 | 5 | 1 | 3 | 1 |
| A12 替代数据 | 6 | 0 | 2 | 4 |
| 🇭🇰 港股专属 | 24 | 5 | 8 | 11 |
| 🇺🇸 美股专属 | 29 | 5 | 10 | 14 |
| 🪙 加密货币 | 45 | 6 | 13 | 26 |
| 🌏 跨市场 | 10 | 2 | 3 | 5 |
| **合计** | **187** | **34** | **64** | **89** |

> 🟢入门34个 = 新手默认看到的所有因子，界面清爽不吓人
> 🟡进阶64个 = 有经验交易者的扩展库
> 🔴专业89个 = 量化级，需确认才能展示

---

## 💰 策略因子收费深度调研

### 调研覆盖平台

| 平台 | 类型 | 因子/指标收费模式 | 核心发现 |
|------|------|-------------------|----------|
| **TradingView** | 全球最大 | **指标免费100+内置 + 社区10万+免费 + 第三方付费$20-50/月** | 平台本身不卖因子，创作者在平台外卖 |
| **LuxAlgo** | TV头部付费指标 | **$20-50/月订阅制** | 30天退款，按年有折扣 |
| **QuantConnect** | 量化云平台 | **因子免费，回测免费，实盘付费$8+/月** | 数据免费→算力付费→替代数据额外付费 |
| **WorldQuant BRAIN** | 因子众包 | **因子提交者按Alpha表现获报酬** | 因子贡献者赚钱，使用者免费 |
| **Wind万得** | 专业终端 | **年费¥10万+** | 机构级，散户买不起 |
| **同花顺** | 中国散户 | **Level-2 ¥298/年，专业版¥598/年** | 数据付费，基础指标免费 |
| **东方财富** | 中国散户 | **Level-2 PC¥298/年，手机¥68-88/年** | 数据付费，基础免费 |
| **factors.directory** | 开源因子库 | **500+因子完全免费** | 学术开放精神 |
| **3Commas/信号群** | 加密信号 | **免费群(延迟)+付费群$50-200/月** | 实时性=付费点 |

### 竞品收费模式总结

| 模式 | 代表 | 收什么 | 不收什么 | 适用场景 |
|------|------|--------|----------|----------|
| **A. 指标免费+平台订阅** | TradingView | 高级图表/数据速度 | 所有指标 | 用量变现 |
| **B. 基础免费+高级付费** | QuantConnect | 实盘/算力/替代数据 | 因子/回测 | 算力变现 |
| **C. 创作者付费指标** | LuxAlgo/Zeiierman | 指标套件$20-50/月 | TV内置指标 | 生态变现 |
| **D. 数据付费+指标免费** | 同花顺/东财 | Level-2/实时数据 | 基础指标 | 数据变现 |
| **E. 信号订阅** | 加密信号群 | 实时信号$50-200/月 | 延迟信号 | 时效变现 |
| **F. 因子贡献者赚钱** | WorldQuant | 贡献者获报酬 | 使用者免费 | 众包变现 |

### 🎯 TradingEasy 因子收费建议

#### 核心结论：**因子本身不收费，但因子相关的高级服务收费**

| 项目 | 🟢免费(L1) | 🟡进阶(L2) | 🔴专业(L3) |
|------|-----------|-----------|-----------|
| **因子列表/名称/简介** | ✅ 免费 | ✅ 免费 | ✅ 免费 |
| **因子计算结果** | ✅ 免费 | ✅ 免费 | ✅ 免费 |
| **因子IC值/信号灯** | ✅ 基础信号灯 | ✅ 完整IC | ✅ 历史IC趋势 |
| **因子权重调整** | ✅ 场景包一键 | ✅ 手动调权重 | ✅ 自由组合 |
| **因子回测** | ❌ 不提供 | 🟡 单因子免费 | 💰 多因子组合1U/次 |
| **因子健康诊断** | ❌ 不提供 | 🟡 基础预警免费 | 💰 深度诊断1U/次 |
| **因子参数优化** | ❌ 不提供 | ❌ 不提供 | 💰 AI优化1.5U/次 |
| **因子故事+详细文档** | ✅ 一句话 | ✅ 完整说明 | ✅ 学术引用 |
| **替代数据因子** | ❌ 不展示 | ❌ 标注"Pro" | 💰 解锁2U/次 |

#### 💡 收费逻辑（对照竞品）

| 原则 | 解释 | 竞品参考 |
|------|------|----------|
| **1. 因子本身永远免费** | 34个🟢入门因子完全免费，这是获客引擎 | TradingView 100+免费指标 |
| **2. 算力/深度=付费点** | 多因子回测、深度诊断消耗服务器算力 | QuantConnect 回测免费→实盘付费 |
| **3. 替代数据=付费点** | 链上数据/新闻NLP/招聘数据有API成本 | QuantConnect 替代数据额外付费 |
| **4. 不按因子数量收费** | 不做"解锁这个因子¥X"模式 | ❌ 无竞品这样做 |
| **5. 场景包免费引流** | 一键场景包免费→用户学会→付费深度使用 | TradingView 社区指标免费引流 |

#### ❌ 不建议的收费方式

| 不做 | 原因 |
|------|------|
| 单个因子收费 | 阻碍获客，散户抵触，竞品无此先例 |
| 因子数量阶梯(1-50免费/51+) | 新手看到"187个因子只有34免费"会跑 |
| 因子包订阅制 | 与已有AI按次收费体系冲突 |
| 因子VIP会员 | 与"免费软件"定位矛盾 |

#### ✅ 与现有盈利模型的衔接

| 已有收入 | 因子如何增强 |
|----------|-------------|
| AI按次(1-2U) | AI参数填充时推荐因子→增加AI使用频次 |
| 交易手续费(0.1%) | 更多因子=更精准策略=更多交易=更多手续费 |
| 创作者市场(9.9U+) | 创作者策略模板可包含L3因子组合 |
| 场景包免费 | 引流→深度回测/诊断付费 |

---

## 📊 数量总览

| 类别 | 新因子数 | 🟢入门 | 🟡进阶 | 🔴专业 |
|------|---------|--------|--------|--------|
| A1-A12 通用 | 78 | 17 | 28 | 33 |
| 🇭🇰 港股专属 | 24 | 5 | 8 | 11 |
| 🇺🇸 美股专属 | 29 | 5 | 10 | 14 |
| 🪙 加密货币 | 45 | 6 | 13 | 26 |
| 🌏 跨市场 | 10 | 2 | 3 | 5 |
| **新因子合计** | **187** | **35** | **62** | **89** |
| 现有因子 | 42 | — | — | — |
| **扩充后总计** | **229** | — | — | — |

### UX/功能建议

| 类别 | 数量 |
|------|------|
| F1 展示优化 | 6 |
| F2 交互优化 | 10 |
| F3 社交/引导 | 4 |
| F4 架构/引擎 | 10 |
| **合计** | **30** |

---

## 🎯 6虾共识Top因子（4虾以上推荐 = 必做）

| 因子 | 等级 | 推荐虾数 | 理由 |
|------|------|---------|------|
| EARNINGS_SURPRISE (业绩超预期) | 🟢 | 6/6 🏆 | PEAD学术最强，全市场通用 |
| ANALYST_REVISION (分析师修正) | 🟡 | 5/6 | 美股/港股核心alpha信号 |
| FACTOR_CROWDING (因子拥挤度) | 🔴 | 5/6 | 2026年风控第一因子 |
| INSIDER_BUYING (内部人增持) | 🟢 | 5/6 | 人类最强直觉因子 |
| CRYPTO_MVRV (MVRV比率) | 🟡 | 5/6 | 加密最强估值因子 |
| CRYPTO_SOPR (链上盈亏) | 🟡 | 4/6 | 链上实时快照 |
| PIOTROSKI_F (F-Score) | 🟡 | 4/6 | 价值股中的"真便宜" |
| BAB (低Beta异象) | 🔴 | 4/6 | 全球有效反直觉因子 |
| IV_SKEW / OPTION_SKEW | 🟡 | 4/6 | 聪明钱的保险 |
| KDJ (随机指标) | 🟢 | **用户指定** | 经典超买超卖，港美股加密通用 |
| 场景化因子包 | — | 6/6 🏆 | 散户最需要的一键配置 |
| 因子信号灯🟢🟡🔴 | — | 4/6 | IC裸数字→视觉信号 |
| 因子故事化文案 | — | 4/6 | 学术→人话 |

---

> ⬆️ 请勾选 ✅ 要做的项目和因子，PM据此制定Round计划。
> 
> 建议分3阶段:
> - **Phase 1** (v2.5.0): 🟢入门因子(35个) + 场景化因子包 + 三级分类UX + 信号灯 + KDJ
> - **Phase 2** (v2.6.0): 🟡进阶因子(62个) + 因子交互 + 港美股加密专属
> - **Phase 3** (v3.0.0): 🔴专业因子(89个) + 替代数据 + 高级UX + 架构打磨
> 
> 💰 因子本身不收费，深度服务(AI优化/多因子回测/替代数据)按次收费1-2U
