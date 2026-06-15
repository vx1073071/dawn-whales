# TradingEasy 策略模板深度扩充建议书

> youdao | 2026-06-15 10:10 HKT | 致 PM
> 基于: 258因子 × 11市场 × 人类交易习惯 × 行业对标

---

## 一、现状 vs 目标

| 指标 | 现状 (R192) | 建议 | 提升 |
|------|-----------|------|------|
| 策略模板总数 | 22 | **88** | 4× |
| 覆盖市场 | 2 (港/美) | **11** | 5.5× |
| 覆盖资产 | 股票+期权 | **股票+加密+商品+期权+跨市场** | 3× |
| 收费模板 | 0 | **28 个付费模板 (1U/次应用)** | 新收入 |
| 对标 (TradingView) | 22 vs 100+ public | **88** | 接近 |

---

## 二、策略模板扩充 — 11 市场 × 8 大类 = 88 模板

### 2.1 📈 趋势追踪 (Trend Following) — 14 模板

最受欢迎的策略类型，人类天生理解"顺势而为"。

```
🇭🇰 T01. 港股金叉猎手 — MA5×MA20×MA60 三线金叉 + SOUTHBOUND_FLOW确认 + AH_PREMIUM筛选
🇭🇰 T02. 北水跟投策略 — SOUTHBOUND_FLOW>5天净买 + MOM_12M>0 + PE<市场均值
🇺🇸 T03. 美股七巨头动量 — MAG7_MOMENTUM + EARNINGS_SURPRISE + IV_RANK<50
🇺🇸 T04. 13F跟随策略 — 13F_FLOW>5%增持 + SEASONALITY旺季 + BUYBACK_YIELD>2%
🪙 T05. 加密趋势火箭 — MOM_12M>30% + FUNDING_RATE<0.05% + MVRV<3.0 + OI_QUADRANT=价格↑OI↑
🪙 T06. 山寨季猎手 — BTC_DOMINANCE下降 + MOM_1M>BTC + FUNDING_RATE正常
🇯🇵 T07. 日本银行股复苏 — JP_BANK_LENDING增长 + JPY_SENSITIVITY出口有利 + JPX_400入选
🇹🇼 T08. 台股外资跟随 — TW_FOREIGN_FLOW连续5天 + TW_TSMC_LINKAGE联动 + TW_MARGIN正常
🇰🇷 T09. 三星生态追踪 — KR_SAMSUNG_LINKAGE>0.7 + KR_FOREIGN增持 + KRW_SENSITIVITY
🛢️ T10. 原油趋势追踪 — CMD_MOM_12M>0 + CMD_BASIS backw + EIA库存连续3周下降
🛢️ T11. 黄金牛市配置 — GOLD_REAL_RATE<0 + DXY_LINKAGE weak + COT_SPECULATOR做多 + GOLD_ETF流入
🌏 T12. 泛亚洲成长 — JP+TW+KR+IN 四市场 MOM_12M排名 Top3 × PE<市场均值
🇮🇳 T13. 印度人口红利 — IN_FII连续买入 + MONTH_SEASON非雨季 + RUPEE稳定
🇪🇺 T14. 欧洲价值复苏 — EU_STOXX金融>科技 + EUR_SENSITIVITY出口受益 + EU_ESG评分排除
```

**免费模板**: T01-T05 (引流)
**付费模板**: T06-T14 (1U/次应用，含AI权重优化)

### 2.2 🔄 均值回归 (Mean Reversion) — 10 模板

"涨多了会跌，跌多了会涨"——人类第二本能。

```
🇺🇸 M01. 超跌反弹猎手 — RSI_14<30 + MOM_1M<-15% + ANCHORING远离52周高 + VOL>均值2σ
🇭🇰 M02. AH溢价均值回归 — AH_PREMIUM<-20% + SOUTHBOUND_FLOW流入 + HSCEI_PREMIUM收窄
🇭🇰 M03. 港股沽空挤压 — SHORT_RATIO>20% + CBBC_DISTANCE<10% + WARRANT_IV高位
🪙 M04. 加密恐慌抄底 — MVRV<1.5 + FUNDING_RATE<0 + SOPR<1 + EXCH_INFLOW低
🪙 M05. 山寨超跌反弹 — MOM_1M<-30% + BTC_DOM高 + SOCIAL_VOLUME极端低位
🇯🇵 M06. 日元套息平仓反弹 — JPY_CARRY反向 + JP_FOREIGN_FLOW流出后回流 + JP_MARCH_EFFECT
🛢️ M07. 原油超卖反弹 — EIA库存意外减少 + COT_COMMERCIAL转向 + CRACK_SPREAD<15
🥇 M08. 金银比均值回归 — GOLD_SILVER>85 + 白银MOM_12M<金 + COT白银净空极致
🇦🇺 M09. 澳元商品反弹 — AUD_SENSITIVITY弱→强 + COMMODITY_LINK价格反弹 + FRANKING_CREDIT高
🇸🇬 M10. REIT息差回归 — SG_REIT_SPREAD>4% + SGD_LINKAGE稳定 + STI_WEIGHT银行股稳定
```

### 2.3 💎 价值挖掘 (Value Hunting) — 12 模板

"买便宜的好公司"——巴菲特流。

```
🇭🇰 V01. 港股深度价值 — EARNINGS_YIELD>8% + BOOK_TO_PRICE>0.5 + AH_PREMIUM<-20% + DIV_YIELD>5%
🇺🇸 V02. 美股股息贵族 — DIV_ARISTOCRATS>25年 + BUYBACK_YIELD>3% + DEBT_TO_EQUITY<50%
🇺🇸 V03. 格雷厄姆烟蒂 — GRAHAM_NET>1.5 + EARNINGS_YIELD>10% + ROIC>12%
🇯🇵 V04. 日本价值解放 — CROSS_HOLDING<15%(改革中) + BOOK_TO_PRICE>1.0 + JP_VALUE_TRAP=false
🇯🇵 V05. 日本高股息 — DIVIDEND_SEASON临近 + SHAREHOLDER_BENEFIT>1%等价 + JPX_400入选
🇰🇷 V06. 韩国财阀折价 — CHAEBOL_DISCOUNT>30% + FOREIGN_OWNERSHIP上升 + 改革预期
🇹🇼 V07. 台股高殖利率 — DIVIDEND_CHASE即将除权 + MARGIN_BALANCE正常 + TW_FOREIGN持有
🇸🇬 V08. 新加坡REIT收入 — SG_REIT_SPREAD>3% + DIV_CULTURE(90%强制) + SGD联动稳定
🇦🇺 V09. 澳洲红利税优势 — FRANKING_CREDIT>80% + BANK_DIVIDEND>5% + DIV_SEASON2/8月
🇪🇺 V10. 欧洲ESG溢价 — ESG_PREMIUM>10% + EUR_SENSITIVITY稳定 + STOXX质量因子
🛢️ V11. 铂金折价套利 — PLATINUM_DISCOUNT>20% + 工业需求上升(新能源) + COT空头极致
🌏 V12. 全球价值扫描 — 跨市场EARNINGS_YIELD排名 + 过滤政治风险 + 汇率对冲成本
```

### 2.4 🛡️ 风险防御 (Defensive) — 10 模板

"先不亏钱，再赚钱"——震荡市/熊市必备。

```
🇺🇸 D01. 低波动防御 — BETA<0.7 + MAX_DRAWDOWN<15% + DIV_YIELD>3% + QUAL>70
🇺🇸 D02. 尾部风险对冲 — TAIL_RISK低 + OPTION_SKEW正常 + VRP>0 + GAMMA_EXPOSURE正
🪙 D03. 加密熊市生存 — STABLECOIN_RES高位 + MVRV<1.5 + FUNDING_RATE负 + 矿工持仓不增
🇭🇰 D04. 港股防御组合 — HK_REIT_YIELD>5% + HK_DIV_TAX优化 + SHORT_RATIO<5%
🇯🇵 D05. 日元避险配置 — JPY_CARRY反向 + JP_BANK稳定 + JP_DIVIDEND_SEASON + CROSS_HOLDING低
🥇 D06. 黄金避险模式 — GOLD_REAL_RATE负 + DXY弱 + GEOPOL_RISK>150 + GOLD_ETF流入
🛢️ D07. 商品衰退对冲 — GOLD_OIL>25 + INFLATION_BE<2% + BALANCE_SHEET过剩
🌏 D08. 多货币对冲 — USD/JPY/EUR/AUD篮子 + CURRENCY_HEDGE对冲 + CROSS_ASSET_CORR
🇸🇬 D09. 新加坡避风港 — SGD_LINKAGE稳定 + REIT_SPREAD>3% + STI_WEIGHT银行主导
🇦🇺 D10. 澳元硬资产 — AUD_SENSITIVITY商品 + FRANKING_CREDIT税收优势 + COMMODITY_LINK正
```

### 2.5 🪙 加密专属 (Crypto Native) — 12 模板

加密市场24/7+高波动=独特策略空间。

```
CC01. 比特币减半周期 — MVRV<2+S2F模型+PUEL多重+HODL_WAVE积累+哈希率上升
CC02. DeFi蓝筹挖矿 — TVL增长率>10%+DEV_ACTIVITY>100+PF_RATIO<20+TOKEN_UNLOCK<5%
CC03. 稳定币收益农耕 — STABLECOIN_MINT增加+USDT_PREMIUM<1%+EXCH_RESERVE安全+PROTOCOL_REV>0
CC04. 永续合约套利 — PERP_PREMIUM>1%→做空合约+买入现货+BASIS年化>10%
CC05. 跨链桥套利 — CROSSCHAIN_FLOW方向+CROSS_MARKET_DISCOUNT>3%+BRIDGE_TVL安全
CC06. L2生态押注 — L2_TVL增长+ETH_GAS趋势下降+ARB/OP治理活跃+NFT_VOLUME回暖
CC07. 清算猎手 — LIQUIDATION_MAP密集区+OI_QUADRANT价格↓OI↑+FUNDING极端负
CC08. 矿工投降抄底 — MINER_FLOW流出剧增+PUEL<0.5+HASHRATE下降+PRICE底部
CC09. 加密期权波动 — OPTION_TERM contango+25DELTA_RR偏斜+VRP高位
CC10. 链上聪明钱跟随 — WHALE_TX增加+SOPR>1获利+EXCH_INFLOW低+STABLECOIN_MINT增
CC11. 加密NFT轮动 — NFT_VOLUME回暖+ETH相对BTC走强+SOCIAL_VOLUME主题轮动
CC12. 治理代币投票权 — GOVERNANCE参与率+PROTOCOL_REV分成+DEV_CENTRAL<30%
```

**免费**: CC01-CC03
**付费**: CC04-CC12 (2U/次，加密专用AI优化更贵)

### 2.6 🛢️ 商品专属 (Commodity) — 10 模板

商品期货的独特逻辑——库存+季节性+展期。

```
CM01. 原油库存周度策略 — EIA_CRUDE实际vs预期+COT_SPECULATOR+CRACK_SPREAD+ROLL_YIELD
CM02. 天然气气候对冲 — NATGAS_STORAGE%+HDD/CDD度日+SEASONALITY+TERM_STRUCTURE
CM03. 铜博士宏观对冲 — LME_INVENTORY+COPPER_GOLD_RATIO+COPPER_TERM backw+MOM_12M
CM04. 农产品WASDE事件 — WASDE_SURPRISE方向+PLANTING_PROGRESS+CROP_CONDITION+CORN_SOYBEAN
CM05. 贵金属三连击 — GOLD_REAL_RATE+GOLD_SILVER_RATIO+GOLD_ETF_FLOW+PLATINUM_DISCOUNT
CM06. 商品展期收益 — 选择ROLL_YIELD>0(backw)品种+MOM_12M筛选+SKEWNESS右偏
CM07. 商品-股票轮动 — COMMODITY_VS_EQUITY>0.5→超配商品+GSCI_WEIGHT能源<40%→超配非能源
CM08. 季节性农场日历 — 按SEASONALITY旺季月份+WEATHER_INDEX厄尔尼诺+历史胜率>60%
CM09. 裂解价差交易 — CRACK_SPREAD趋势+EIA_CRUDE库存+ENERGY_SECTOR_STOCK背离
CM10. 跨界商品配对 — CORN/SOYBEAN比>2.5→做空玉米做多豆+WHEAT/CORN比>1.5→做空小麦做多玉米
```

### 2.7 🔗 跨市场联动 (Cross-Market) — 10 模板

全球宏观视角——最专业的策略。

```
XM01. 美元周期轮动 — DXY趋势+非美市场选择+按CURRENCY_HEDGE成本排序
XM02. 全球因子溢价 — 1因子×10市场IC排名+选Top3市场+等权配置
XM03. 利率敏感轮动 — RATE_SENSITIVITY排序+银行>REIT切换+INFLATION_BE确认
XM04. 地缘风险对冲 — GEOPOL_RISK>150→超配黄金/能源+减配股票+VIX对冲
XM05. 全球价值洼地 — BOOK_TO_PRICE跨市场排名+CURRENCY_EFFECT调整+COUNTRY_RISK加权
XM06. 动量跨市场 — MOM_12M>0市场加权+过滤政治风险+汇率对冲
XM07. 股息全球化 — DIV_YIELD跨市场+TAX_RATE调整+DIV_ARISTOCRATS筛选
XM08. ESG全球配置 — ESG_SCORE>7+排除差治理市场+EU_ESG_PREMIUM确认
XM09. 新兴vs发达 — IN/MX/BR 新兴 vs US/JP/EU 发达 + GDP_BETA增长差
XM10. 全天候组合 — 股票+债券+商品+黄金 风险平价+TAIL_RISK控制+FACTOR_TIMING择时
```

### 2.8 🧪 AI 专属 (AI-Powered) — 10 模板

这是收费核心——AI推荐+人机结合。

```
AI01. AI动态因子择时 — AI分析当前市场环境→推荐最优因子组合+FACTOR_TIMING权重
AI02. AI个人画像定制 — USER_PROFILE分析+持仓FINGERPRINT+AI推荐专属策略
AI03. AI多空配对 — AI分析关联对+统计套利残差+配对交易信号
AI04. AI行业轮动 — SECTOR_STRENGTH动态+THEME_AI/GREEN/CONSUMPTION+SECTOR_ROTATION
AI05. AI事件驱动 — EARNINGS_CALENDAR+INDEX_REBALANCE+BOND_SPREAD事件前布局
AI06. AI波动率交易 — VOL_REGIME检测+IV_SKEW/TERM_STRUCT+OPTION策略建议
AI07. AI因子权重优化 — 历史回测+Walker+多目标优化(Sharpe+MaxDD+Turnover Pareto)
AI08. AI市场状态识别 — 牛市/熊市/震荡/恐慌 4态→推荐对应场景包+因子
AI09. AI跨市场套利 — 监测AH/PREMIUM+ADR+ETF折溢价→AI推荐最优套利方向
AI10. AI每日因子简报 — DAILY_REPORT+异常检测+推荐今日关注Top5因子
```

**全部付费**: 1-2U/次，AI10 (每日简报) 支持订阅 $9.9/月。

---

## 三、人类使用习惯 — 模板组织

### 3.1 按用户路径 (不是按数学模型)

```
首次访问 → 🎯 "我不确定" → AI问3个问题→推荐1个模板
         → 🏆 "我想赚钱" → 按市场选 (🇭🇰/🇺🇸/🪙/🇯🇵/🛢️...)
         → 🔍 "我有想法" → 搜索框输入"价值"或"动量"→过滤模板
         → 🧪 "我想学" → 模板广场浏览+按人气/收益/风险排序
```

### 3.2 模板卡片信息 (人类一眼看懂)

每个模板卡片显示:
```
┌──────────────────────┐
│ 🏆 港股金叉猎手      │ ← 名字
│ 🇭🇰 香港 · 趋势追踪   │ ← 市场+类型
│ ⭐ 4.2 (128人用)     │ ← 评分+使用人数
│ 📈 CAGR: 22% ▼12%   │ ← 历史收益+最大回撤
│ 🟢 入门 · 免费        │ ← 难度+价格
│ [一键应用] [先看看]   │
└──────────────────────┘
```

### 3.3 模板筛选器 (侧面栏)

```
市场: [全部] 🇭🇰 🇺🇸 🪙 🇯🇵 🇹🇼 🇰🇷 🇸🇬 🇦🇺 🇮🇳 🇪🇺 🛢️
类型: [全部] 趋势 均值回归 价值 防御 加密 商品 跨市场 AI
难度: [全部] 🟢入门 🟡进阶 🔴专业
价格: [全部] 免费 1U 2U 订阅
排序: 🔥人气最高 ⭐评分最高 📈收益最高 🛡️回撤最低
```

---

## 四、营收对接

### 4.1 模板收费分层

| 类别 | 数量 | 价格 | 年化收入 (500用户) |
|------|------|------|-------------------|
| 免费引流 | 24 | $0 | $0 |
| 标准模板 1U/次 | 38 | $1 | $19K (每月2次×38模板) |
| 加密模板 2U/次 | 9 | $2 | $10.8K |
| AI模板 1-2U/次 | 10 | $1.5 | $9K |
| AI简报订阅 | 1 | $9.9/月 | $59.4K |
| **合计** | **88** | | **~$98K/年** |

### 4.2 模板市场 — 用户上传模板

```
用户自定义模板 → 发布到模板市场(≥4.9U) → 平台抽成15%
热门创作者 → 模板使用量排行 → 创作激励
```

---

## 五、实施路线图

### R200 — 模板批量上线 (20h)

JVS 实现模板引擎 + ML 实现模板卡片+筛选器 + autoclaw i18n + QClaw 60模板文案 + youdao 测试

分两批: 40个免费引流模板先上(R200), 38个付费模板后上(R201)

---

## 六、总结

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 模板总数 | 22 | **88** | 4× |
| 覆盖市场 | 2 | **11** | 5.5× |
| 免费模板 | 22 | **24** | 引流优化 |
| 付费模板 | 0 | **64** | 新收入 |
| 年化收入 | $0 | **~$98K** | 全新 |

**核心**: 用户不是来"选因子"的——用户是来"选策略"的。策略模板是因子系统的"菜单"，88个模板把258个因子变成用户可以一口吃下的套餐。

---

*建议完成: 2026-06-15 10:10 HKT | youdao | TradingEasy 策略模板 22→88*
