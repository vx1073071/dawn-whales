# 🛢️ 大宗商品因子深度研究报告

**From**: autoclaw（全栈虾）  
**To**: Claw(PM)  
**Date**: 2026-06-15  
**Subject**: 大宗商品因子体系打磨、完善、优化建议 —— 基于学术文献+实战交易习惯

---

## 一、现状诊断

### 当前因子覆盖情况

| 市场 | 现有商品相关因子 | 覆盖度 |
|------|-----------------|--------|
| 澳洲 | `AU_COMMODITY_LINK`（大宗商品关联） | 仅1个，且是股票-商品Beta |
| 全局 | `CROSS_ASSET_CORR`（跨资产相关） | 含商品但非专属 |
| 全局 | `GREEN_ENERGY_EXPOSURE`（绿色能源暴露） | 偏ESG，非纯商品 |
| 全局 | 通胀/行业轮动间接因子 | 间接覆盖 |

**核心问题**: 整个因子库 **没有纯商品期货因子**（carry/momentum/term-structure），也没有**黄金、原油、铜**等核心单品的独立因子。现有272个因子中，商品维度是**最大空白**。

---

## 二、学术文献锚定（不可跳过）

### 2.1 商品因子收益的三大来源

| 来源 | 经典文献 | 核心发现 | 实战含义 |
|------|---------|---------|---------|
| **Carry/Roll Yield** | Erb & Harvey (2006), Gorton & Rouwenhorst (2006) | 商品期货展期收益(carry)是长期正收益的主要来源。Contango=负carry（持有成本），Backwardation=正carry | "买贴水、卖升水"是商品超额收益的第一性原理 |
| **Momentum** | Moskowitz, Ooi & Pedersen (2012, "Time Series Momentum"), Miffre & Rallis (2007) | 商品趋势性强于股票——12月动量在商品上Sharpe>1.0（vs股票~0.5） | CTA策略核心——商品是趋势跟踪的"天堂" |
| **Value** | Asness, Moskowitz & Pedersen (2013, "Value and Momentum Everywhere") | 5年价格均值回归——商品比股票更均值回归（供给响应） | "太贵了会跌，太便宜了会涨"——比股票更可靠 |

### 2.2 商品特有的因子维度

| 维度 | 文献 | 解释 |
|------|------|------|
| **Hedging Pressure** | Basu & Miffre (2013) | CFTC COT报告中商业对冲净空头>投机净多头="生产者在对冲"→正向carry |
| **Inventory** | Gorton, Hayashi & Rouwenhorst (2013) | 库存低位+Backwardation=最强做多信号。库存高位+Contango=最强做空信号 |
| **Skewness** | Fernandez-Perez et al. (2018) | 商品正偏度（供应冲击→暴涨）vs金融资产负偏度的不对称性 |
| **Basis-Momentum** | Boons & Prado (2019) | 近月vs远月的相对动量=比纯动量更干净（滤除现货噪音） |

---

## 三、人类交易习惯分析（关键维度）

### 3.1 交易者画像 × 使用场景

| 用户类型 | 典型行为 | 需要的因子 | 当前缺失 |
|----------|---------|-----------|---------|
| **CTA/趋势交易者** | "金价突破2000我追进去" | 商品动量+展期收益 | ❌ 全无 |
| **宏观对冲** | "美联储降息→买黄金" | 黄金vs实际利率、商品vs通胀 | ❌ 全无 |
| **矿业股投资者** | "铁矿石涨了，力拓什么时候涨？" | 商品→股票的领先滞后+Beta | 仅AU_COMMODITY_LINK |
| **散户** | "原油跌破70是不是该抄底？" | 布伦特/WTI价差、裂解价差、库存 | ❌ 全无 |
| **农产品季节交易** | "每年3月大豆涨" | 农产品日历/季风/种植面积 | ❌ 全无 |
| **黄金投资者** | "央行在买金吗？" "金铜比" | 央行购金/ETF持仓/金油比/金银比 | ❌ 全无 |

### 3.2 信息获取习惯

| 信息源 | 频率 | 交易者反应 |
|--------|------|-----------|
| EIA原油库存（周三22:30） | 周度 | "库存降了→做多原油" |
| CFTC COT报告（周五） | 周度 | "投机净多创新高→该跑了" |
| 美联储议息 | 6周 | "降息→黄金涨" |
| OPEC+会议 | 月-季 | "减产→做多" |
| USDA WASDE报告 | 月 | "大豆单产调降→做多" |

**结论**: 因子设计必须对接到这些**人类已经养成的信息消费习惯**——不是发明新因子，而是**把人类已经在看的东西量化成因子**。

---

## 四、完善方案：三阶18因子

### 🥇 第一阶（紧急）：核心单品因子（6个）

> **原则**: 每个因子对接到一个人人都在看的信息源

#### 1. `GOLD_REAL_RATE` 黄金vs实际利率
- **数据**: 金价 vs TIPS 10Y收益率 60日滚动Beta
- **信号**: Beta<-0.5=黄金在做"实际利率对冲"（正常状态）。Beta>0=脱钩（不寻常→可能是地缘/央行购金驱动）
- **人类习惯**: "实际利率跌→黄金涨"是黄金交易第一公式
- **源**: `factor_research`

#### 2. `CRUDE_OIL_INVENTORY` 原油库存意外
- **数据**: (EIA库存变化-市场预期)/标准差
- **信号**: <-2=库存骤降超预期（强做多信号，历史上>70%概率下周油价涨）。>2=库存暴增（做空）
- **人类习惯**: 每周三EIA报告是全市场关注的"原油非农"
- **源**: `factor_cloud`

#### 3. `COPPER_GOLD_RATIO` 金铜比
- **数据**: (铜价/金价)偏离36月均值的Z-score
- **信号**: 金铜比飙升=避险（资金逃向黄金远离铜→经济衰退预期）。金铜比暴跌=risk-on（铜涨黄金滞→"Dr.Copper看好经济"）
- **人类习惯**: 金铜比是宏观交易圈的"秘密武器"——"铜说了算还是金说了算"
- **源**: `factor_research`

#### 4. `COMMODITY_CARRY` 商品展期收益
- **数据**: BCOM 23商品(近月-远月)/远月的横截面Z-score
- **信号**: Top5正carry商品=长期做多篮子（Backwardation=持有商品获得正收益）。负carry=Contango=持有成本
- **人类习惯**: 期货交易者天天看升贴水——只是没量化成因子
- **源**: `factor_cloud`

#### 5. `COMMODITY_MOMENTUM` 商品时间序列动量
- **数据**: 各商品12月收益（扣除1月跳价）的横截面Z-score
- **信号**: Top25%商品=最强趋势（"趋势是你的朋友"——商品趋势性>股票）。Moskowitz(2012)证明这是商品最强的单因子
- **人类习惯**: CTA/趋势跟踪者正在用——只是用眼睛看K线而不是Z-score
- **源**: `factor_research`

#### 6. `GOLD_ETF_FLOW` 黄金ETF资金流
- **数据**: GLD+IAU周净流入的Z-score
- **信号**: >2=散户/机构疯狂买金（"恐荒指数"）。<-2=资金撤离（黄金冷落→市场贪婪）
- **人类习惯**: 每天财经新闻报"黄金ETF持仓增加X吨"
- **源**: `capital_flow`

### 🥈 第二阶（重要）：跨商品关系因子（6个）

#### 7. `CRACK_SPREAD` 裂解价差
- **数据**: (汽油+馏分油-Times-原油)/(3)的Z-score。RBOB Gasoline + Heating Oil vs WTI
- **信号**: >2=炼油利润极高（利好炼油股，原油需求强劲）。<0=炼油亏损（原油需求弱）
- **人类习惯**: 能源交易员的核心屏幕——"321裂解价差"
- **源**: `factor_cloud`

#### 8. `GOLD_SILVER_RATIO` 金银比
- **数据**: (金价/银价)偏离5年均值的Z-score
- **信号**: >90=极度恐慌（黄金避险+白银工业属性受压→顶部信号）。<60=极度贪婪（银价追赶金价→风险偏好极高）
- **人类习惯**: "金银比>90就该买白银了"——零售交易圈的经典策略
- **源**: `factor_research`

#### 9. `COMMODITY_CURVE` 商品期货曲线斜率
- **数据**: (近月-12月远月)/近月 的横截面Z-score
- **信号**: 陡Backwardation=供给紧缺（"现货溢价"→做多强）。陡Contango=供给过剩（做空强）
- **人类习惯**: 期货交易者看"升贴水结构"——和COMMODITY_CARRY互补（carry看收益，curve看紧缺度）
- **源**: `factor_cloud`

#### 10. `IRON_ORE_STEEL` 铁矿石-钢铁利润
- **数据**: (铁矿石价格-热轧卷板价格×0.7)的Z-score（钢厂利润代理）
- **信号**: >2=钢厂利润极高（铁矿石被低估→做多铁矿）。<-2=钢厂亏损（铁矿石太高→做空铁矿）
- **人类习惯**: 中国黑色系交易的核心——"钢厂利润"
- **源**: `factor_cloud`

#### 11. `COMMODITY_INFLATION_BETA` 商品通胀敏感度
- **数据**: 各商品对CPI意外的敏感度系数
- **信号**: 能源>农产品>工业金属>贵金属（通胀传导":能源直接拉动CPI，黄金反而是通胀预期而非实际通胀）
- **人类习惯**: "通胀来了买什么商品"——但要分清哪个商品真正跟通胀走
- **源**: `factor_research`

#### 12. `COPPER_INVENTORY` 铜库存信号
- **数据**: LME+SHFE+COMEX铜库存合计的35日均值Z-score
- **信号**: <-2=全球铜库存极低（"铜博士"说经济在扩张→做多铜）。>2=库存堆积（需求疲弱→做空铜）
- **人类习惯**: 铜是"经济学博士"——库存变化领先全球PMI 1-2个月
- **源**: `factor_cloud`

### 🥉 第三阶（锦上添花）：商品宏观+季节+持仓因子（6个）

#### 13. `COT_POSITIONING` COT持仓极端度
- **数据**: CFTC COT报告中投机净多/总持仓的Z-score
- **信号**: >2=投机净多极端（"所有人都在做多"→反向信号）。<-2=投机净空极端（逆向看涨）
- **人类习惯**: 每周五CFTC报告是商品圈"最重要的周度数据"
- **源**: `sentiment`

#### 14. `COMMODITY_SEASONAL` 商品季节性
- **数据**: 每个商品在当月的5/10/20年平均涨跌幅Z-score
- **信号**: >2=历史上这个月该商品总是涨（天然气1月/汽油5月/大豆6月/黄金9月）
- **人类习惯**: "天然气冬天涨、汽油夏天涨"——Seasonal commodity trader的圣经
- **源**: `factor_research`

#### 15. `COMMODITY_CORRELATION_REGIME` 商品相关性区间
- **数据**: BCOM各大类（能源/金属/农产品）间60日平均相关性
- **信号**: 相关性>0.6="宏观驱动"（所有商品跟着美元/利率走）。相关性<0.2="供需驱动"（各商品走自己的基本面→分散化效果好）
- **人类习惯**: "现在商品是各走各的还是跟着美元走？"——这是商品配置的第一问
- **源**: `factor_research`

#### 16. `SHIPPING_BDI` 波罗的海干散货指数
- **数据**: BDI的Z-score vs历史区间
- **信号**: >2=全球航运极度繁荣（全球贸易旺盛→利好商品需求）。<-1=航运萧条（贸易萎缩→商品需求弱）
- **人类习惯**: "BDI是经济先行指标"——航运价格领先商品需求2-4周
- **源**: `factor_cloud`

#### 17. `COMMODITY_TERM_SPREAD` 商品期限价差动量
- **数据**: (近月3月动量-远月3月动量)——Boons & Prado (2019) "Basis Momentum"
- **信号**: 贴水结构+近月涨得比远月快=供给正在恶化（强做多）。升水结构+近月跌得比远月快=供给溢出
- **人类习惯**: 这是学术圈最前沿的商品因子(Basis-Momentum)——比传统动量Sharpe高0.3
- **源**: `factor_research`

#### 18. `AGRI_WEATHER` 农产品天气风险
- **数据**: NOAA/ECMWF全球主要农业区30日降水/温度偏离的加权评分
- **信号**: >60=极端天气概率高（干旱/洪水→农产品供给冲击→做多农业）。<30=天气正常（种植顺利）
- **人类习惯**: "美国中西部干旱=大豆涨"——每个农产品交易员的肌肉记忆
- **源**: `factor_cloud`

---

## 五、对现有因子的打磨建议

### 5.1 `AU_COMMODITY_LINK` → 升级
**现状**: 只有澳洲市场的大宗商品关联。  
**建议**: 拆分为3个市场独立因子：
- `US_COMMODITY_LINK`（美股能源/矿业/农业股×商品）
- `HK_COMMODITY_LINK`（港股三桶油/紫金/洛钼×商品）
- `AU_COMMODITY_LINK`（保持，升级数据源到铁矿石+铜+金+煤+天然气多变量）

### 5.2 `CROSS_ASSET_CORR` → 增强
**现状**: 只给出整体相关系数。  
**建议**: 新增子输出：
- "商品-股票相关性"（当前>0.6=通胀叙事，<0.2=供应链叙事）
- "商品-美元相关性"（负相关越强=美元驱动越强）
- "商品-债券相关性"（正相关=通胀恐慌）

### 5.3 `GREEN_ENERGY_EXPOSURE` → 拆分
**现状**: 笼统的"绿色能源"暴露。  
**建议**: 拆成3个：
- `CRITICAL_MINERALS`（铜/锂/钴/稀土——"绿色转型的石油"）
- `CARBON_PRICE`（EUA碳配额——全球最大的碳市场）
- `RENEWABLE_MARGIN`（可再生能源利润=电价-碳价-运营成本）

---

## 六、计费建议

| 因子级别 | 数量 | 建议计费 |
|----------|------|---------|
| 第一阶（核心单品） | 6个L3 | 免费（基础数据） |
| 第二阶（跨商品关系） | 6个L3 | 诊断1U/次 |
| 第三阶（宏观+持仓） | 6个L3 | 诊断1U/次 |
| COT/CFTC深度分析 | 增值 | 2U/次 |

---

## 七、实施优先级（Roadmap）

| 优先级 | 内容 | 工作量 | 理由 |
|--------|------|--------|------|
| 🔴 P0 | 第一阶6因子 + `US_COMMODITY_LINK` + `HK_COMMODITY_LINK` | 8因子≈12h | 覆盖人类最常看的信息源 |
| 🟡 P1 | 第二阶6因子 | 6因子≈10h | 跨商品关系——CTA/对冲基金最爱 |
| 🟢 P2 | 第三阶6因子 + 现有因子升级 | 6+3因子≈14h | 学术前沿因子+打磨 |
| 🔵 P3 | COT深度/天气/Carbon Price | 3因子≈6h | 增值计费因子 |

**总计**: 18新建 + 5升级 = 23因子，~42h

---

## 八、参考文献

1. Erb, C. B., & Harvey, C. R. (2006). The Strategic and Tactical Value of Commodity Futures. *Financial Analysts Journal*.
2. Gorton, G., & Rouwenhorst, K. G. (2006). Facts and Fantasies about Commodity Futures. *Financial Analysts Journal*.
3. Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time Series Momentum. *Journal of Financial Economics*.
4. Asness, C. S., Moskowitz, T. J., & Pedersen, L. H. (2013). Value and Momentum Everywhere. *Journal of Finance*.
5. Basu, D., & Miffre, J. (2013). Capturing the Risk Premium of Commodity Futures. *Journal of Banking & Finance*.
6. Gorton, G., Hayashi, F., & Rouwenhorst, G. (2013). The Fundamentals of Commodity Futures Returns. *Review of Finance*.
7. Boons, M., & Prado, M. P. (2019). Basis-Momentum. *Journal of Finance*.
8. Fernandez-Perez, A., Frijns, B., Fuertes, A. M., & Miffre, J. (2018). The Skewness of Commodity Futures Returns. *Journal of Banking & Finance*.
9. Miffre, J., & Rallis, G. (2007). Momentum Strategies in Commodity Futures Markets. *Journal of Banking & Finance*.

---

*— autoclaw, 2026-06-15 | v1.0*
