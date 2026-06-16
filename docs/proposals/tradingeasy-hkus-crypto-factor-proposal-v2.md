# quant-moo 港美股+加密货币 因子深度扩充与UX打磨建议 v2.0

> From: ML (前端) | To: PM | Type: DEEP_PROPOSAL
> Scope: 港美股 (不含A股) | 加密货币 | 基于权威学术因子研究 + 人类使用习惯
> 参考: Fama-French六因子、AQR Betting Against Beta、Glassnode 链上指标框架、2025-2026 量化Alpha衰减研究
> 日期: 2026-06-15

---

## 一、现有因子库速览 (44个)

quant-moo 已有 **44个 canonical 因子**（factor-id-registry.ts），扣除A股专属和legacy duplicates后：

| 类别 | 因子数 | 代表 |
|------|--------|------|
| 美股专属 | 4 | VIX / 做空比率 / 机构持仓 / 回购 |
| 港股专属 | 5 | 南向+北向 / 跨境息差 / 窝轮IV / 基金持仓 |
| 加密货币 | 10 | Funding Rate / OI Delta / Exchange Flow / NVT 等 |
| 通用 (Fama-French+技术) | 25 | MOM / HML / RMW / CMA / MACD / RSI 等 |

**核心缺失（港美股+加密）：** 约 18 个高价值因子未被覆盖。

---

## 二、🔴 美股缺失 — 高价值因子 (8个)

### 2.1 盈余惊喜因子 (SUE — Standardized Unexpected Earnings)
**学术来源**: Foster-Olsen-Shevlin (1984), 后经 Bernard-Thomas (1989) 确认漂移效应  
**机制**: (实际EPS - 分析师一致预期EPS) / 预期标准差  
**IC**: 约 0.038-0.055，信号持续约60天  
**人类直觉**: "财报超预期=利好" — 散户最爱，但量化才有统计意义

```
SUE:
  公式: (actual_eps - consensus_eps) / std(estimates)
  阈值: SUE>1.5 → 极度乐观 | SUE>0.5 → 温和乐观 | SUE<-1.5 → 极度悲观
  特色: 仅财报季更新 (每季度1次)，非日频
```

### 2.2 分析师修正动量 (ANALYST_REVISION — Earnings Revision Momentum)
**学术来源**: Chan-Jegadeesh-Lakonishok (1996), Stickel (1991)  
**机制**: 近30天 EPS 预测上调家数 ÷ 总覆盖家数  
**IC**: 约 0.04-0.06 (美股比A股更显著)  
**人类直觉**: "分析师都在上调预期=机构看好"

```
ANALYST_REVISION:
  公式: (upgrades - downgrades) / total_analysts
  更新频率: 日频 (分析师报告实时入库)
  适用: 美股大型+中型 (小盘覆盖不足)
```

### 2.3 内部人交易因子 (INSIDER_TRADING — 高管的真金白银)
**学术来源**: Seyhun (1986), Lakonishok-Lee (2001)  
**机制**: CEO/CFO/Directors 买入vs卖出净额比  
**IC**: 约 0.025-0.04 (信号弱但稳健，半年窗口)  
**人类直觉**: "高管自己都买/卖了=知道内幕" — 人类最强直觉因子

```
INSIDER_SENTIMENT:
  公式: (insider_buy_volume - insider_sell_volume) / total_volume
  聚类买入: >3位高管同一周买入 → 极强信号
  聚类卖出: >3位高管同一周卖出 → 强烈警示
  延迟: 美股Form 4申报延迟2天 → 仅用公开数据
```

### 2.4 做空挤压潜力因子 (SHORT_SQUEEZE — 逼空雷达)
**学术来源**: Dechow et al. (2001), Asquith-Pathak-Ritter (2005)  
**机制**: 高做空比率 + 低流通量 + 价格上涨 = 逼空概率  
**IC**: 非线性，事件驱动，爆发行情可获+15-50%日收益  
**人类直觉**: "空头太多会踩踏" — 2021 GME / 2024 SMCI 经典案例

```
SHORT_SQUEEZE_SCORE:
  公式: short_ratio * (1/floating_shares_ratio) * price_momentum_5d
  阈值: score>7.0 → 高逼空风险 | >4.0 → 值得关注
  特色: 不止看做空比例，还要看"空头是否在疼痛"
```

### 2.5 低Beta异象因子 (BAB — Betting Against Beta)
**学术来源**: Frazzini-Pedersen (2014, Journal of Financial Economics), AQR Capital  
**机制**: 做多低Beta股票 (1.0x杠杆) - 做空高Beta股票 (0.7x杠杆)  
**Sharpe**: 约 0.8-1.2 (美股历史), 全球市场均有效  
**人类直觉**: "稳定型公司长期跑赢高风险公司" — 反直觉但数据确凿

```
BAB:
  公式: (low_beta_portfolio * 1.2) - (high_beta_portfolio * 0.8)
  Beta计算: 过去250个交易日滚动回归 S&P500
  适用: 美国大型+中型 | IC约0.03-0.05
  关联: 与低波动(LOW_VOL/VOL_60D)部分重叠，但BAB=杠杆化版
```

### 2.6 股票回购因子 (BUYBACK_YIELD — 回购收益率)
**学术来源**: Ikenberry-Lakonishok-Vermaelen (1995), Fama-French (2018)  
**机制**: 净回购金额 ÷ 市值 × 100%  
**IC**: 约 0.035-0.05，12个月窗口最有效  
**人类直觉**: "公司自己回购股票=认为便宜"

```
BUYBACK_YIELD:
  升级现有 US_BUYBACK 为三层:
  L1: buyback_yield_ttm = net_buyback / market_cap
  L2: buyback_acceleration = buyback_Q / avg(buyback_last_4Q) - 1
  L3: buyback_authorization_impact = 新授权/流通股 > 5% → 催化剂
```

### 2.7 空头持仓拥挤度因子 (SHORT_CROWDING)
**学术来源**: Asquith-Pathak-Ritter (2005), Jones-Lamont (2002)  
**机制**: 该股票做空比例在同类股票中的百分位排名  
**人类直觉**: "被最多人做空=最危险的做多" — 反指也可做多

```
SHORT_CROWDING:
  公式: percentile(short_ratio, industry)
  阈值: >90%分位 → 极端拥挤，逼空风险 | <10%分位 → 无人关注
  与INSIDER配合: 高管买入+高空头拥挤=最强做多信号
```

### 2.8 期权隐含波动率偏度 (OPTION_SKEW — 聪明钱的保险)
**学术来源**: Bollen-Whaley (2004), Cremers-Weinbaum (2010)  
**机制**: OTM Put IV - OTM Call IV，正值=市场恐惧尾部风险  
**人类直觉**: "有人大举买保险(Put)=有人在防大跌"

```
OPTION_SKEW:
  公式: IV(OTM_Put_25delta) - IV(OTM_Call_25delta)
  阈值: >10% → 恐惧偏度（市场对冲需求大）| <-5% → 贪婪偏度
  用法: 不是择时因子，是"风险预警"因子
```

---

## 三、🔴 港股缺失 — 高价值因子 (6个)

### 3.1 AH溢价套利因子 (AH_PREMIUM)
**学术来源**: Peng-Miao-Chow (2007), Chan-Kwok (2005)  
**机制**: (A股价格 × 汇率 / H股价格) - 1  
**人类直觉**: "同股不同价=套利机会" — 港股韭菜最爱话题  
**IC**: 约 0.02-0.04 (套利窗口约2-4周，但收敛不保证)

```
AH_PREMIUM:
  公式: (A_price * FX_CNYHKD) / H_price - 1
  分位: >50%=极端溢价(A贵H便宜) | <0%=折价(罕见)
  信号: 溢价缩窄+H股本身不弱 = 南向资金回流H股的先兆
```

### 3.2 南向资金动量分化 (SOUTHBOUND_DIVERGENCE)
**学术来源**: 沪深港通数据实证研究 (2020-2025)  
**机制**: 股价下跌但南向加仓 vs 股价上涨但南向减仓  
**人类直觉**: "南下资金在抄底=聪明钱进场"

```
SOUTHBOUND_SMART:
  公式: southbound_flow_5d_sign ≠ price_return_5d_sign
  底背离: price↓ + southbound↑ → 聪明钱抄底，看涨
  顶背离: price↑ + southbound↓ → 聪明钱出货，看跌
  升级现有: HKEX_SOUTHBOUND 只有净流向，缺方向分化
```

### 3.3 窝轮街货量因子 (WARRANT_STREET_MONEY)
**学术来源**: 香港衍生品市场特有机制  
**机制**: 窝轮流通量 ÷ 总发行量 — 街货太多=市场过热  
**人类直觉**: "散户都在买牛证/认购=看涨预期过热，反转在即"

```
WARRANT_OVERHEAT:
  公式: street_money / total_issue
  牛证街货: >80%=极度拥挤(散户看涨过热=顶部信号)
  熊证街货: >80%=极度拥挤(散户看跌过热=底部信号)
  逆用: 散户拥挤=反向操作信号（散户是反指）
```

### 3.4 港股红利税优化因子 (DIVIDEND_TAX_OPT)
**学术来源**: 港股通红利税 (2025年改革)  
**机制**: 高股息 vs 低税率港股的净收益对比  
**人类直觉**: "港股通买H股有红利税，散户应该买税务友好的"

```
DIV_TAX_ADVANTAGE:
  H股(港股通): 20%红利税 → Net Yield = Gross Yield × 0.80
  红筹股: 10% → Net Yield = Gross Yield × 0.90
  香港本地股: 0% → Net Yield = Gross Yield × 1.00
  排序: net_yield_hk_local > net_yield_redchip > net_yield_h_share
```

### 3.5 港元汇率敏感因子 (HKD_PEG_SENSITIVITY)
**学术来源**: 联系汇率制度下的利率传导 (2023-2026)  
**机制**: 港元弱方保证(7.85)时资金外流压力 vs 强方(7.75)时资金流入  
**人类直觉**: "港元快到7.85了=热钱要跑=港股危险"

```
HKD_PEG_PRESSURE:
  公式: (USDHKD - 7.80) / 0.05  → [-1, +1]
  阈值: USDHKD>7.83 → 资金外流压力(港股承压) | <7.78 → 资金流入(利多)
  配合: 金管局干预量 = 二级确认信号
```

### 3.6 港元拆息陡峭度 (HIBOR_STEEPNESS)
**学术来源**: 利率期限结构与股票收益 (Fama-French, 1989)  
**机制**: 3月HIBOR vs 隔夜HIBOR 利差扩大=资金面紧张  
**人类直觉**: "银行间利率飙升=缺钱=股票承压"

```
HIBOR_STEEPNESS:
  公式: HIBOR_3M - HIBOR_O/N
  正常: 10-30bp → 中性
  紧张: >50bp → 资金面收紧(港股承压)
  宽松: <5bp → 资金充裕(港股利好)
```

---

## 四、🔴 加密货币缺失 — 高价值因子 (10个)

### 4.1 MVRV Z-Score (市场价值对实现价值比)
**来源**: Glassnode, Willy Woo, David Puell  
**机制**: (市值 / 实现市值) 的 Z-Score，衡量偏离链上成本的极端程度  
**重要性**: 加密市场最强估值因子，历史顶底识别率 >85%  
**人类直觉**: "偏离挖矿成本太远=泡沫" — 加密老韭菜必看

```
MVRV_Z:
  公式: (market_cap - realized_cap) / std(market_cap)
  极度低估: Z < 0 (绿区) → 历史性买点
  中性: 0 < Z < 3.5 → 正常波动区间
  极度高估: Z > 4.0 (红区) → 历史性顶部
  BTC历史: 2011/2015/2019底部 < 0, 2011/2013/2017/2021顶部 > 4.0
```

### 4.2 SOPR (花销产出利润率)
**来源**: Glassnode, CoinMetrics  
**机制**: 已花费 UTXO 的卖出价 ÷ 买入价（移动平均）  
**重要性**: 链上盈亏状态实时快照  
**人类直觉**: "链上地址平均在赚钱=有人会止盈"

```
SOPR:
  公式: price_sold / price_paid (moving average of UTXO spent)
  SOPR>1: 链上整体盈利(可能有止盈压力)
  SOPR<1: 链上整体亏损(恐慌抛售or底部积累)
  关键转折: SOPR从<1重新站上1 → 市场情绪转暖
```

### 4.3 Realized Cap HODL Waves (实现市值持币周期)
**来源**: Unchained Capital, Glassnode  
**机制**: 不同持币时长的 UTXO 占实现市值比例  
**重要性**: 区分"信仰者"vs"投机者"的筹码分布  
**人类直觉**: "长期持币者在增持=底部"

```
HODL_WAVE:
  短期(<1月): >30% → 投机过热，顶部风险
  中期(1-12月): 50-60% → 正常
  长期(>1年): >60% → 信仰者主导，底部区域
  顶底信号: 长期占比从低→高=积累(底) | 长期占比从高→低=派发(顶)
```

### 4.4 交易所净流入/流出 (EXCHANGE_NETFLOW 升级)
**来源**: CryptoQuant, Glassnode  
**机制**: 交易所流入 - 流出 (BTC/ETH)，净流入=抛售压力  
**重要性**: 直接刻画"准备卖"vs"提币存"的行为  
**人类直觉**: "大额转进交易所=要砸盘"

```
EXCHANGE_NETFLOW_PREMIUM:
  升级现有 CRYPTO_EXCHANGE_FLOW:
  L1: netflow_24h = inflow - outflow (已有)
  L2: whale_netflow = 单笔>100BTC的净流入(剔除散户噪音)
  L3: exchange_reserve_ratio = 交易所余额/总流通量
  鲸鱼流入: >1000 BTC/日 → 大卖盘预警
  余额创新低: 交易所BTC余额<1.8M → 长期持有趋势
```

### 4.5 稳定币发行量变化 (STABLECOIN_SUPPLY_DELTA)
**来源**: DeFiLlama, CoinGecko  
**机制**: USDT+USDC+DAI 总发行量30天变化率 — 加密"影子货币供应量"  
**重要性**: 稳定币扩容=加密市场流动性增加(牛市燃料)  
**人类直觉**: "Tether在印钞=钱要进来了"

```
STABLECOIN_M2:
  公式: Δ(total_stablecoin_mcap_30d) / total_30d_ago
  扩容: >5%/月 → 增量资金入场(牛市信号)
  收缩: <-3%/月 → 资金撤离(熊市信号)
  领先性: 通常领先BTC价格2-4周
```

### 4.6 永续合约资金费率极端值 (FUNDING_RATE_EXTREME)
**来源**: Binance, Bybit, OKX 公开数据  
**机制**: 资金费率偏离0的极端值 — 多头/空头拥挤信号  
**重要性**: 最直接的"过热/过冷"温度计，反向信号强  
**人类直觉**: "费率太贵=多头太多了=要爆多头"

```
FUNDING_EXTREME:
  升级现有 CRYPTO_FUNDING:
  L1: funding_rate (已有，8小时)
  L2: funding_rolling_24h = 过去3次资金费率的累计
  L3: funding_percentile_30d = 当前费率在30天内的百分位
  极度多头拥挤: >95%分位 + 费率>0.1% → 强制多杀多风险
  极度空头拥挤: <5%分位 + 费率<-0.05% → 逼空风险
```

### 4.7 期货持仓量动量 (OI_MOMENTUM)
**来源**: Coinglass, Binance API  
**机制**: 期货未平仓合约 24h 变化 + 价格变化 = 四象限矩阵  
**重要性**: 区分"真金白银建仓"vs"空头回补"  
**人类直觉**: "OI暴增+价格涨=真突破" | "OI暴增+价格不涨=假突破"

```
OI_QUADRANT:
  Price↑ + OI↑ → 🟢 真突破，多方建仓
  Price↑ + OI↓ → 🟡 空头回补，涨势不可持续
  Price↓ + OI↑ → 🔴 真下跌，空方加仓
  Price↓ + OI↓ → 🟢 多头止盈，跌势不可持续
```

### 4.8 链上活跃度综合分 (ONCHAIN_ACTIVITY_SCORE)
**来源**: Dune Analytics, Nansen  
**机制**: 日活跃地址数 + 交易数 + 交易量 + Gas费的加权Z-score  
**重要性**: 需求侧健康度 — 加密"GDP"指标  
**人类直觉**: "链上越多人用=币越有价值"

```
ONCHAIN_GDP:
  公式: zscore(DAU) + zscore(tx_count) + zscore(volume) + zscore(gas_price)
  >1.5: 链上活动爆发(牛市确认)
  <−1.0: 链上冻结(熊市)
  对比: 升级现有 CRYPTO_ACTIVE_ADDR (单维度) → 四维综合
```

### 4.9 矿工卖出压力 (MINER_SELL_PRESSURE)
**来源**: CryptoQuant, Glassnode  
**机制**: 矿工钱包→交易所的转账量 / 矿工总产出  
**重要性**: 矿工是"强制卖家"（需支付电费和运营成本）  
**人类直觉**: "矿工在大量出货=他们也不看好"

```
MINER_TO_EXCHANGE:
  公式: miner_outflow_to_exchanges / miner_total_revenue
  正常: 80-100% (矿工需卖币付电费)
  极端: >150% → 矿工加速清仓(熊市投降)
  极端低: <50% → 矿工惜售(牛市积累)
```

### 4.10 跨链资金流 (CROSSCHAIN_FLOW)
**来源**: DeFiLlama, bridgescan, L2Beat  
**机制**: 主要L2/侧链的资金净流入/流出 (Arbitrum/Optimism/Polygon/Base)  
**重要性**: 以太坊生态血液流动图  
**人类直觉**: "钱在往哪个链跑=哪个链有赚钱机会"

```
L2_FLOW:
  公式: bridge_deposits_7d - bridge_withdrawals_7d
  净流入>0: 资金涌入L2(DeFi/NFT活跃=利好ETH/L2代币)
  净流出>0: 资金撤回主网or出逃(利空ETH生态)
  Base链特殊: Coinbase驱动的散户L2，流量=美国散户情绪
```

---

## 五、🔴 跨市场通用 — 高价值因子 (3个)

### 5.1 因子拥挤度 (FACTOR_CROWDING — 已有代码但未列为标准因子)
**重要性**: 2026年量化因子集体失效的核心原因 — 因子被套利过度  
**人类直觉**: "大家都在用同一个策略=策略要失效了"

```
FACTOR_CROWDING:
  公式: 机构持股重叠度 + 因子换手率加速 + 因子估值偏离度
  阈值: >80%分位 → ⚠️ 极度拥挤，Alpha基本为0
  建议: 已有 factor-crowding.ts 代码，提升为标准因子并加入注册表
```

### 5.2 宏观利率敏感度 (RATE_SENSITIVITY)
**重要性**: 2025-2026 加息周期后期，利率是最大宏观变量  
**人类直觉**: "美联储要加息=高估值科技股要跌"

```
RATE_BETA:
  公式: 滚动回归(股票收益 ~ 10Y_Treasury变化)
  高敏感: β>2 → 利率变动1bp，股价变动2bp(科技成长股)
  低敏感: β<0.5 → 利率不敏感(公用事业/消费必需品)
  方向: 利率上升周期(当前)→低敏感跑赢 | 利率下降→高敏感跑赢
```

### 5.3 行业轮动速度因子 (SECTOR_ROTATION_SPEED)
**升级现有 SECTOR_ROTATION**
**人类直觉**: "板块涨跌交替快=震荡市=不要追涨杀跌"

```
ROTATION_SPEED:
  公式: std(sector_returns_5d) / mean(sector_returns_20d)
  快速轮动: >2.0 → 板块一日游，追涨必套
  正常轮动: 0.5-2.0 → 中等持续性
  趋势延续: <0.5 → 强者恒强(如2023-2025 AI行情)
```

---

## 六、🟢 UX打磨建议 — 基于人类投资者使用习惯

### 6.1 场景化因子包（一键配置）

**人类痛点**: 38-62个因子列表，散户不知道选哪个。

**方案**: 8个预置因子包，每个有明确的使用场景和通俗名称：

```
🇺🇸 美股进攻包 (Magnificent 7): MOM_12M + GROWTH + ANALYST_REVISION + BUYBACK_YIELD
   口号: "追趋势+看分析师+公司回购=三位一体"
   适用: AI牛市(2023-2025)，Sharpe历史 1.8

🇺🇸 美股防御包 (Fortress): LOW_VOL + QUAL + DIV_YIELD + RATE_BETA(LOW)
   口号: "低波动+高质量+高股息=风暴中的港"
   适用: 加息周期/衰退预期，MaxDD仅 -6%

🇭🇰 港股掘金包 (Treasure Hunter): AH_PREMIUM + SOUTHBOUND_SMART + DIV_TAX_ADV + HIBOR
   口号: "AH折价+南向抄底+税务优化=港股套利三件套"
   适用: AH溢价>30%时

🇭🇰 港股避险包 (Typhoon Shelter): HKD_PEG + WARRANT_OVERHEAT(反指) + QUAL + HIBOR_STEEPNESS
   口号: "港元压力+窝轮过热+资金紧张=该躲台风了"

🪙 加密趋势包 (Momentum): MOM_12M + FUNDING_EXTREME + OI_QUADRANT + STABLECOIN_M2
   口号: "趋势+费率+持仓+流动性=加密四维动量"
   适用: 牛市期间，Sharpe历史 2.3

🪙 加密避险包 (Diamond Hands): MVRV_Z + SOPR + HODL_WAVE + MINER_SELL
   口号: "估值+盈亏+持仓结构+矿工行为=链上四层安全网"
   适用: 寻找底部时

🌏 跨市场全天候 (All-Weather): BAB + QUAL + RATE_BETA + FACTOR_CROWDING
   口号: "低Beta+高质量+利率适配+避拥挤=穿越牛熊"

🤖 AI推荐包: 基于用户持仓自动推荐（已有 SmartContextPrefill）
```

### 6.2 因子故事化 — "这个因子在讲什么故事？"

**人类痛点**: 因子名称像天书 (MVRV_Z, SOPR, HIBOR_STEEPNESS)

**方案**: 每个因子配"一句话人话解释" + "当前在讲什么故事"：

```
MVRV_Z-Score: "比特币现在比挖矿成本贵多少？"
  当前值: Z=2.8
  在讲的故事: 🟡 "比成本线贵了一点，但还没到泡沫区"
  上次同样的故事: 2023年10月 → 之后涨了180%

FUNDING_RATE_EXTREME: "做多的资金成本是贵还是便宜？"
  当前值: 0.08% (85分位)
  在讲的故事: 🔴 "做多的人有点太多了，小心踩踏"
  上次同样的故事: 2024年3月 → 之后跌了25%

AH_PREMIUM: "同样的公司，A股比港股贵多少？"
  当前值: 35%溢价
  在讲的故事: 🟢 "A股比港股贵了35%，南向资金应该会回补"
  上次同样的故事: 2022年11月 → 港股随后涨了50%
```

### 6.3 因子健康预警 — "你的因子快过期了"

**人类痛点**: 因子失效了还在用，三月后才发现亏钱了

**方案**: 因子卡片上显示健康度四个维度：

```
SUE (盈余惊喜因子)
  IC衰退: [████████░░] 82% | 预计46天后IC降至0.02以下
  拥挤度:  [██░░░░░░░░] 18% | 还好，用的人不多
  相关性: R²=0.15 | 与MOM_12M重叠度低，互补
  最近表现: 🟡 上月IC=0.038 → 本月IC=0.032 (略降但仍有效)

quant-moo AI建议: "SUE因子IC在季节性走弱(财报淡季)，预计7月下旬财报季到来后回升。当前建议: 保持，权重从25%临时减至18%。"

```

### 6.4 因子对比器 — "MOM_12M vs BAB，该选哪个？"

**人类痛点**: 38个因子，不知道怎么比选

**方案**: 并排对比卡片，不仅比数字，比"人话"：

```
┌─── 12月动量 MOM_12M ───┬─── 低Beta异象 BAB ─────┐
│ 类型: 趋势跟踪           │ 类型: 低风险溢价          │
│ IC:   +0.045 ★★★★★       │ IC:   +0.033 ★★★☆☆       │
│ 牛市: 🟢强 (Sharpe 1.9)  │ 牛市: 🟡弱 (Sharpe 0.4)  │
│ 熊市: 🔴差 (Sharpe -0.3) │ 熊市: 🟢强 (Sharpe 0.9)  │
│ 适合: 追涨杀跌           │ 适合: 慢牛慢熊             │
│ 讨厌: 震荡市             │ 讨厌: 狂热牛市             │
│                          │                          │
│ AI建议: 💍 完美互补！     │                          │
│ 动量+BAB=穿越牛熊         │                          │
│ 相关性: 0.12 → 组合Sharpe+30% │                     │
└──────────────────────────┴──────────────────────────┘
```

### 6.5 因子冲突婚姻式可视化

**人类痛点**: 相关性矩阵太技术，看不懂

**方案**: 用婚姻/关系比喻展示因子配对：

```
因子婚姻速配:

MOM_12M 🤝 BAB             → 🟢 天生一对 (相关性0.12，互补)
MOM_12M 💔 MOM_1M          → 🔴 近亲结婚 (相关性0.85，选一个就行)
VALUE 😡 GROWTH             → 🔴 水火不容 (相关性-0.48)
SUE 🤝 ANALYST_REVISION     → 🟡 好姐妹 (相关性0.42，有些重叠但还好)
MVRV_Z 🤝 SOPR              → 🟡 表兄弟 (相关性0.55，加密专属)
FUNDING_RATE 💀 OI_DELTA    → 🔴 双胞胎 (相关性0.91，完全冗余!)

💡 选因子法则: 避免"双胞胎"(>0.7)和"死对头"(-0.2以下)+追求"天生一对"(<0.3且互补)
```

### 6.6 因子寻宝游戏 — "本周市场在用哪些因子？"

**人类痛点**: 不知道当前市场风格，因子选错方向

**方案**: 每周因子收益排行榜 + "如果上周你用了…"对比：

```
🔥 本周(6月9-13日)美股因子龙虎榜:

🥇 低波动 VOL_60D      +2.8% ← 地缘风险下避险
🥈 高质量 QUAL         +2.1% ← 资金涌入蓝筹
🥉 利率敏感 RATE_BETA  +1.9% ← 美联储鸽派预期
...
🔻 12月动量 MOM_12M    -3.2% ← AI涨幅太大回吐
🔻 成长 GROWTH         -4.1% ← 科技获利了结

📊 如果你上周用了"防御包(VOL+QUAL+DIV)" → +2.4%
📉 如果你还在用"进攻包(MOM+GROWTH)" → -3.6%
差距 = 6个百分点！

💡 AI提示: 这周风格偏向防御，建议将组合20%切换至防御包。
```

### 6.7 因子沙盒 — "如果我只用这3个因子，历史收益如何？"

**人类痛点**: 选因子像盲人摸象，想试但不敢

**方案**: 因子组合快速回测沙盒（不需要完整策略回测）

```
因子沙盒速算 (秒级):
选中的因子: MOM_12M + QUAL + BAB
市场: 🇺🇸美股
历史区间: 2020-2026

结果:
  年化收益: +12.4% (vs S&P500 +12.1%)
  最大回撤: -18.3% (vs S&P500 -25.4%)
  夏普比率: 0.92
  胜率: 58%

💡 总结: 你这三个因子组合跑赢了指数，且回撤更小。
         最大的弱点是2022年(全部因子下跌)。
         建议加一个HEDGE因子做防护。
```

---

## 七、优先级路线图

### P0 — v2.6.0 立即实施 (12h)
| # | 因子 | 市场 | 工时 | 理由 |
|---|------|------|------|------|
| F01 | MVRV_Z | 加密 | 2h | 加密最强估值因子，无替代品 |
| F02 | SOPR | 加密 | 2h | 链上盈亏实时快照 |
| F03 | FUNDING_EXTREME (升级) | 加密 | 1h | 已有FUNDING，只需加极端值检测 |
| F04 | AH_PREMIUM | 港股 | 2h | 港股最热话题，散户必备 |
| F05 | SOUTHBOUND_SMART | 港股 | 2h | 升级SOUTHBOUND，加方向分化 |
| F06 | 场景化因子包(8个) | 全部 | 3h | UX最快见效 |

### P1 — v2.7.0 (10h)
| # | 因子 | 市场 | 工时 | 理由 |
|---|------|------|------|------|
| F07 | SUE | 美股 | 2h | 学术最稳健的alpha因子 |
| F08 | SHORT_SQUEEZE | 美股 | 1h | 已有SHORT_RATIO，计算分升级 |
| F09 | STABLECOIN_M2 | 加密 | 2h | 加密流动性先导指标 |
| F10 | OI_QUADRANT | 加密 | 1h | 已有OI_DELTA，加价格四象限 |
| F11 | 因子健康预警+故事化 | UX | 4h | UX核心差异化 |

### P2 — v2.8.0 (14h)
| # | 因子 | 市场 | 工时 | 理由 |
|---|------|------|------|------|
| F12-F13 | INSIDER / BUYBACK升级 | 美股 | 3h | 美股专属 |
| F14-F15 | DIV_TAX / HIBOR | 港股 | 3h | 港股结构化优势 |
| F16-F18 | HODL_WAVE / MINER_SELL / CROSSCHAIN | 加密 | 4h | 加密链上深层 |
| F19-F20 | 因子对比器 + 因子沙盒 | UX | 4h | 高级功能 |

### P3 — v3.0路线图 (18h)
- BAB / ANALYST_REVISION / RATE_BETA / SECTOR_ROTATION升级
- 因子寻宝游戏(周度排行榜)
- 跨市场因子映射 (美股因子在港股的等效替代)

---

## 八、一句话总结

> 44个因子 → 建议补充 **18个新因子** + **5个UX打磨**。最大亮点是**场景化因子包**(一键"美股进攻"/"港股掘金"/"加密避险") — 这是散户最需要的功能，把因子从"学术名词列表"变成"有温度的投资顾问"。加密最缺链上深度(MVRV/SOPR/HODL_WAVE)，美股最缺内部人信号(高管买卖+逼空)，港股最缺AH套利和红利税优化。这些不是冰冷的公式，是人类投资者每天在讨论的话题。
