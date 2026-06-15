# TradingEasy R198 — 🛢️ 大宗商品 UX + 14因子故事 + 季节性环形日历

> **Round**: R198 (🛢️ 大宗商品因子 · Phase 1) | **角色**: QClaw(设计虾) | **日期**: 2026-06-15
> **因子**: 14 (L1期限7 + L2库存5 + L6季节2) | **故事**: 42条三语

---

# Part A: 大宗商品 UX 设计规范

## A.1 四大品类配色系统

> 设计理念：四种商品各有性格——黄金的尊贵、原油的炽热、铜的冷峻、农产品的生机

### 🥇 贵金属 — 暖金配色

```css
:root {
  --cmd-gold-primary:     #DAA520;  /* 黄金本色 — 尊贵 */
  --cmd-gold-primary-dark:#B8860B;  /* 暗金 */
  --cmd-gold-accent:      #FFD700;  /* 亮金 — 上涨! */
  --cmd-gold-bg:          #1A1610;  /* 暗色底(金在暗底最亮) */
  --cmd-gold-card:        #252018;
  --cmd-gold-border:      #4A3A20;
  --cmd-gold-text:        #F5E6C8;
  --cmd-gold-muted:       #A09070;
  
  /* 信号灯 */
  --cmd-gold-up:          #FFD700;
  --cmd-gold-down:        #8B7355;
  --cmd-gold-neutral:     #C0A060;
}
```

### 🛢️ 能源 — 熔岩橙配色

```css
:root {
  --cmd-energy-primary:   #FF6B35;  /* 火焰橙 — 炽热 */
  --cmd-energy-dark:      #CC4400;  /* 深焰 */
  --cmd-energy-accent:    #FFD700;  /* 火花金 — 上涨! */
  --cmd-energy-bg:        #1A1210;  /* 暗炉底 */
  --cmd-energy-card:      #251A14;
  --cmd-energy-border:    #4A2A18;
  --cmd-energy-text:      #F5E0D0;
  --cmd-energy-muted:     #A08060;
  
  /* 信号灯 — 能源专属: 橙色上涨(油价上涨=世界在烧) */
  --cmd-energy-up:        #FF8C00;
  --cmd-energy-down:      #336699;  /* 冷蓝=油价下跌=世界冷静 */
  --cmd-energy-neutral:   #FF6B35;
}
```

### 🔩 工业金属 — 冷钢银配色

```css
:root {
  --cmd-metal-primary:    #C0C0C0;  /* 白银色 — 冷峻 */
  --cmd-metal-dark:       #708090;  /* 板岩灰 */
  --cmd-metal-accent:     #00CED1;  /* 铜氰绿 — 上涨! */
  --cmd-metal-bg:         #101418;
  --cmd-metal-card:       #181C22;
  --cmd-metal-border:     #303840;
  --cmd-metal-text:       #E0E4E8;
  --cmd-metal-muted:      #889098;
  
  /* 信号灯 */
  --cmd-metal-up:         #00CED1;
  --cmd-metal-down:       #B22222;  /* 火砖红 */
  --cmd-metal-neutral:    #A0B0B8;
}
```

### 🌾 农产品 — 生机绿配色

```css
:root {
  --cmd-agri-primary:     #228B22;  /* 森林绿 — 生长 */
  --cmd-agri-dark:        #556B2F;  /* 橄榄绿 */
  --cmd-agri-accent:      #7CFC00;  /* 草坪绿 — 上涨! */
  --cmd-agri-bg:          #101A10;
  --cmd-agri-card:        #182218;
  --cmd-agri-border:      #2A4028;
  --cmd-agri-text:        #D8E8D0;
  --cmd-agri-muted:       #709868;
  
  /* 信号灯 */
  --cmd-agri-up:          #7CFC00;
  --cmd-agri-down:        #CD853F;  /* 秘鲁褐(干旱色) */
  --cmd-agri-neutral:     #90B870;
}
```

---

## A.2 商品因子卡片设计

```
┌─────────────────────────────────────────────┐
│ 🛢️  CMD_ROLL_YIELD  展期收益      🟢 L1     │
│ ─────────────────────────────────────────── │
│                                             │
│  当前值: +6.8% / 年                          │
│  ┌─────────────────────────────────────┐   │
│  │  📈 过去12月展期收益走势             │   │
│  │  ▁▂▃▄▅▆▇█▇▆▅▄▃  ← +6.8% (高于均值)  │   │
│  │  均值: 4.2%         最高: 12.1%      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🟢 信号: 做多有利                          │
│  💡 "换月成本: 原油近月比远月便宜6.8%/年，   │
│      每个月换仓等于白赚0.57%"                │
│                                             │
│  [详情] [加到我的因子] [分享]                │
└─────────────────────────────────────────────┘
```

### 卡片布局规则
- **左上角**: 品类emoji + 因子ID + 等级标签
- **主视觉**: 迷你走势图(最近N期) + 当前值超大号
- **信号区**: 信号灯emoji + 方向判断
- **人话区**: 💡 开头的一句话翻译
- **行动区**: 三个CTA按钮

---

## A.3 库存图表设计

```
┌─────────────────────────────────────────────┐
│ 🛢️  CMD_EIA_CRUDE  EIA原油库存   🟢 L2      │
│ ─────────────────────────────────────────── │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  EIA 原油库存 (百万桶)              │   │
│  │  450│                    ● ← 实际    │   │
│  │     │          ●───●───●             │   │
│  │  430│    ●───●           ●───●       │   │
│  │     │ ●─●                 ●──●  ●    │   │
│  │  410│●                              ●│   │
│  │     └──────────────────────────────  │   │
│  │       2026-01   2026-03   2026-05     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  实际: 428.5M 桶                              │
│  预期: 435.0M 桶    ← 比预期少了6.5M!         │
│  5年均值: 440.2M                             │
│                                             │
│  🟢 信号: 库存低于预期=需求旺盛/供应趋紧        │
│  💡 "EIA库存比华尔街预期少了650万桶：           │
│      这是6周以来最大的'意外短缺'"              │
│                                             │
│  [详情] [看历史库存] [EIA原文链接]             │
└─────────────────────────────────────────────┘
```

### 库存图核心规则
1. **三线叠加**: 实际(实线) + 预期(虚线) + 5年均值(浅色区域)
2. **关键指标**: 实际vs预期的差值(Δ) = 核心信号
3. **更新时间**: 右下角标注 "数据: EIA 2026-06-11 周三"
4. **颜色编码**: 库存低于预期=🟢绿色/高于预期=🔴红色

---

# Part B: 14因子三语故事文案

## B.1 L1 期限结构 (7因子)

### CMD_ROLL_YIELD — 展期收益 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 期货合约有到期日——每个月你必须"换仓"(卖掉快到期的，买下个月的)。这个换仓过程可能赚钱也可能亏钱。"展期收益"=换仓赚到的钱(年化)。原油近月比远月便宜=换仓赚钱=展期收益为正=做多有利。反过来远月更便宜=换仓亏钱=多头不利。📖 Working(1949), *The Theory of Price of Storage* |
| 🇯🇵 日文 | 先物契約には期限がある——毎月「ロールオーバー」(期限切れ間近を売り、翌月を買う)が必要。このロールオーバーで儲かることも損することもある。「ロールイールド」=ロールで稼げる金額(年率)。原油の期近が期先より安い=ロールで稼げる=ロールイールド正=ロング有利。逆に期先が安い=ロールで損=ロング不利。📖 Working(1949), *The Theory of Price of Storage* |
| 🇺🇸 英文 | "Futures expire — every month you must 'roll' (sell near-month, buy next-month). Rolling can make or lose money. Roll Yield = annualized profit from rolling. Crude oil near-month cheaper than far-month = roll earns = Roll Yield positive = long favored. Reverse = roll loses = long unfavored. 📖 Working (1949), *The Theory of Price of Storage*" |
| ⚙️ 参数 | (近月价 - 次月价) / 近月价 × 365/天数 | 正值>3%=强做多 |

### CMD_TERM_STRUCTURE — 期限斜率 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 把近月、次月、远月期货价格连成一条线=期货"曲线"。曲线向下倾斜(近贵远贱)=现货升水(Backwardation)=供应紧张信号=做多。曲线向上(近贱远贵)=期货升水(Contango)=供应充裕=做空有利。关键是曲线的"陡峭度"——越陡越极端。原油曲线从Contango翻到Backwardation=历史上最重要的做多信号之一。 |
| 🇯🇵 日文 | 期近、次月、期先の先物価格を線でつなぐ=先物「カーブ」。カーブ右下がり(期近高・期先安)=バックワーデーション=供給逼迫シグナル=ロング。カーブ右上がり(期近安・期先高)=コンタンゴ=供給潤沢=ショート有利。鍵はカーブの「スティープネス」——急勾配ほど極端。原油カーブがコンタンゴ→バックワーデーション反転=歴史上最も重要なロングシグナルの一つ。 |
| 🇺🇸 英文 | "Plot near-month, next-month, far-month futures = the 'curve'. Curve sloping down (near high, far low) = Backwardation = supply squeeze signal = long. Curve sloping up (near low, far high) = Contango = supply plentiful = short favored. Key: steepness — steeper = more extreme. Crude oil curve flipping Contango→Backwardation = historically one of the most important long signals." |
| ⚙️ 参数 | (远月-近月)/近月 | Backwardation=正信号, Contango=负信号 |

### CMD_BASIS — 基差 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 基差=现货价格-期货价格。这是中国商品交易员每天打开电脑看的第一个数字。现货比期货贵=正基差=现货升水=有人现在就想买=做多期货。现货比期货便宜=负基差=期货升水=做空有利。极端基差(超过历史2个标准差)往往预示反转——基差太大会回归。中国散户叫"买基差"：基差大的时候买期货，等基差缩小了赚钱。 |
| 🇯🇵 日文 | ベーシス=現物価格-先物価格。これは中国の商品トレーダーが毎朝PCを開いて最初に見る数字。現物が先物より高い=正ベーシス=現物プレミアム=誰かが今すぐ買いたがっている=先物ロング。現物が先物より安い=負ベーシス=先物ショート有利。極端ベーシス(過去の2標準偏差超)=反転を予示——ベーシスが大きすぎると回帰する。（中国リテールの言い方「買基差」：基差が大きい時先物を買い、基差縮小時に儲ける） |
| 🇺🇸 英文 | "Basis = Spot Price - Futures Price. The #1 number Chinese commodity traders check every morning. Spot > Futures = positive basis = backwardation = someone wants it NOW = long futures. Spot < Futures = negative basis = contango = short favored. Extreme basis (>2σ historical) often signals reversal — basis too wide must converge. Chinese traders call it 'buy the basis': buy futures when basis is wide, profit when it narrows." |
| ⚙️ 参数 | 现货-期货 / 标准差 | >2σ=极端(回归信号) |

### CMD_MOMENTUM_12M — 12月动量 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 过去12个月的收益率就是"趋势的力量"。这是商品世界最古老、最稳定、最不花哨的赚钱方式——跟着走。石油涨了一年=继续涨的概率高于反转。黄金跌了一年=继续跌的概率高于反转。关键：12个月窗口避开了短期的噪音(天气、新闻、仓位)，留下的就是真正的供需趋势。📖 Moskowitz, Ooi & Pedersen (2012), *Time Series Momentum* |
| 🇯🇵 日文 | 過去12ヶ月のリターン=「トレンドの力」。これは商品世界で最も古く、最も安定した、最も派手でない儲け方——ついていくだけ。石油が1年上がった=反転より続伸の確率が高い。金が1年下がった=反転より続落の確率が高い。鍵：12ヶ月窓は短期のノイズ(天候・ニュース・ポジション)を避け、残るのは本物の需給トレンド。📖 Moskowitz, Ooi & Pedersen (2012), *Time Series Momentum* |
| 🇺🇸 英文 | "Past 12-month return = 'power of the trend'. The oldest, most stable, least flashy way to make money in commodities — just follow. Oil up 12 months = more likely to keep rising than reverse. Gold down 12 months = more likely to keep falling than reverse. Key: 12-month window filters short-term noise (weather, news, positioning), leaving genuine supply-demand trends. 📖 Moskowitz, Ooi & Pedersen (2012), *Time Series Momentum*" |
| ⚙️ 参数 | 12M total return | >0=正趋势, <0=负趋势 |

### CMD_MOMENTUM_1M — 1月反转 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 过去1个月涨得最凶的商品——下个月往往跌回来。1个月的反转效应在商品中比股票强很多。原因？短期极端天气(寒潮、飓风)→价格暴涨→天气恢复→暴跌。投机仓位拥挤→踩踏出逃→极端反转。📖 De Groot, Karolyi & Miffre (2018), *Commodity Return Reversals* |
| 🇯🇵 日文 | 過去1ヶ月で最も急騰した商品——翌月は往々にして下落する。1ヶ月のリバーサル効果は商品では株式よりはるかに強い。理由？短期の異常気象(寒波・ハリケーン)→価格急騰→天候回復→暴落。投機ポジション混雑→パニック脱出→極端な反転。📖 De Groot, Karolyi & Miffre (2018), *Commodity Return Reversals* |
| 🇺🇸 英文 | "Commodities that rose the most in the past month — often fall back next month. The 1-month reversal effect is much stronger in commodities than stocks. Why? Short-term extreme weather (cold snap, hurricane) → price spike → weather normalizes → crash. Crowded speculative positioning → panic exit → extreme reversal. 📖 De Groot, Karolyi & Miffre (2018), *Commodity Return Reversals*" |
| ⚙️ 参数 | 1M return (反向信号) | 极端涨→看空, 极端跌→看多 |

### CMD_VOLATILITY — 实际波动率 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 商品比股票更"狂暴"。原油一天涨10%、天然气一天跌15%——在商品世界里不是新闻。但这恰好是信号的来源：波动率低的时候做多、波动率飙升时做空。低波动=市场在安静地走趋势。高波动=恐慌/贪婪→即将回归平静→反转。📖 Szymanowska, De Roon, Nijman & Van den Goorbergh (2014), *An Anatomy of Commodity Futures Risk Premia* |
| 🇯🇵 日文 | 商品は株式より「暴力的」。原油が1日で10%高、天然ガスが15%安——商品世界ではニュースでもない。しかしこれこそシグナルの源泉：ボラ低時にロング、ボラ急騰時にショート。低ボラ=市場は静かにトレンドを歩んでいる。高ボラ=パニック/欲望→まもなく平静に戻る→反転。📖 Szymanowska et al. (2014), *An Anatomy of Commodity Futures Risk Premia* |
| 🇺🇸 英文 | "Commodities are more 'violent' than stocks. Crude +10% in a day, natural gas -15% — not news in the commodity world. But this IS the signal source: low vol → long, vol spike → short. Low vol = market quietly trending. High vol = panic/greed → soon returning to calm → reversal. 📖 Szymanowska et al. (2014), *An Anatomy of Commodity Futures Risk Premia*" |
| ⚙️ 参数 | 20日实际波动率 | 低波(分位底部30%)=看多, 高波(顶部30%)=看空 |

### CMD_SKEWNESS — 收益偏度 (🔴专业)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 收益分布不对称=商品比股票更"歪"。负偏度=大的暴跌+小的慢涨(像天然气: 温和上升→寒潮→一天暴跌15%)。正偏度=小的慢跌+大的暴涨(像黄金: 缓慢下跌→危机→一天飙5%)。做多负偏度品种(天然气、农产品)的长期平均收益更高——因为你在为"极端暴跌风险"收保险费。📖 Fernandez-Perez, Frijns, Fuertes & Miffre (2016), *The Skewness of Commodity Futures Returns* |
| 🇯🇵 日文 | リターン分布の非対称性=商品は株より「歪んでいる」。負の歪度=大きな暴落+小さな徐々の上昇(天然ガスのように: 緩やかな上昇→寒波→1日で15%暴落)。正の歪度=小さな徐々の下落+大きな急騰(金のように: 緩やかな下落→危機→1日で5%急騰)。負の歪度の商品(天然ガス・農産物)のロング長期平均リターンは高い——「極端な暴落リスク」に対する保険料を受け取っているから。📖 Fernandez-Perez et al. (2016), *The Skewness of Commodity Futures Returns* |
| 🇺🇸 英文 | "Return distribution asymmetry = commodities are more 'skewed' than stocks. Negative skew = big crashes + small steady rises (like natgas: gentle up → cold snap → -15% day). Positive skew = small steady drops + big spikes (like gold: gentle down → crisis → +5% day). Going long negative-skew commodities (natgas, ags) earns higher long-term average returns — you're collecting 'crash insurance premium'. 📖 Fernandez-Perez et al. (2016), *The Skewness of Commodity Futures Returns*" |
| ⚙️ 参数 | 日收益偏度(252日) | 负偏=长期做多有利, 正偏=做多谨慎 |

---

## B.2 L2 库存供需 (5因子)

### CMD_EIA_CRUDE — EIA原油库存 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 全世界原油交易员的日历上都有一个红圈：每周三美东时间10:30——EIA(美国能源信息署)公布上周原油库存。实际vs预期=唯一重要的事。库存降了=需求旺/供应紧=涨。库存增了=需求弱/供应松=跌。但关键不是绝对数字，是"意外"——市场已经预期了库存变化，只有实际偏离预期的部分才是新信息。📖 EIA Weekly Petroleum Status Report |
| 🇯🇵 日文 | 全世界の原油トレーダーのカレンダーに赤丸がある：毎週水曜日 東部時間10:30——EIA(米国エネルギー情報局)が先週の原油在庫を発表。実際vs予想だけが重要。在庫減=需要旺盛/供給逼迫=上がる。在庫増=需要弱含み/供給潤沢=下がる。ただし鍵は絶対水準ではなく「サプライズ」——市場は在庫変化をすでに織込み済み、実際が予想から乖離した分だけが新情報。📖 EIA Weekly Petroleum Status Report |
| 🇺🇸 英文 | "Every crude oil trader's calendar has a red circle: Wednesday 10:30 AM ET — EIA releases last week's crude inventory. Actual vs Expected = all that matters. Inventory down = demand strong/supply tight = up. Inventory up = demand weak/supply loose = down. But key: not the absolute number — the 'surprise'. Market already expects inventory changes; only the deviation from expectation is new information. 📖 EIA Weekly Petroleum Status Report" |
| ⚙️ 参数 | (实际库存 - 预期库存) / 预期标准差 | 负意外(实际<预期)=🟢看涨 |

### CMD_NATGAS_STORAGE — 天然气库存 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 天然气是"天气商品"——比原油更受季节驱动。每年4-10月注气(把夏天的便宜气存起来)→11-3月提取(冬天取暖用)。EIA每周四公布储气量。核心看两点：(1) 当前储气量vs5年均值(高于均值=过剩=跌)；(2) 注气/提气速度(比正常快=供过于求=看空)。天然气库存的季节模式是所有商品中最可预测的。 |
| 🇯🇵 日文 | 天然ガスは「天候商品」——原油以上に季節駆動。毎年4-10月注入(夏の安いガスを貯蔵)→11-3月取出(冬の暖房用)。EIAが毎週木曜日に貯蔵量を発表。核心は2点：(1)現在貯蔵量vs5年平均(上回る=過剰=下落)；(2)注入/取出し速度(通常より速い=供給過剰=弱気)。天然ガス在庫の季節パターンは全商品中で最も予測可能。 |
| 🇺🇸 英文 | "Natural gas = 'weather commodity' — even more seasonal than crude. Apr-Oct injection (store cheap summer gas) → Nov-Mar withdrawal (winter heating). EIA reports storage every Thursday. Two key views: (1) Current storage vs 5-year average (above = surplus = down); (2) Injection/withdrawal rate (faster than normal = oversupply = bearish). Natgas storage seasonality is the most predictable of all commodities." |
| ⚙️ 参数 | (当前库存-5年同期均值)/标准差 + 注采速度 | 低于均值=🟢看涨 |

### CMD_LME_INVENTORY — LME铜库存 (🟡进阶)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 铜=全球经济体温计。看LME(伦敦金属交易所)每日公布的铜库存：注册仓单(on-warrant)+注销仓单(canceled warrant)。关键信号：注销仓单激增=有人在大量提货=需求恢复=看涨。但更关键的是LME+COMEX+SHFE三地库存合计——单一交易所库存可能只是"搬仓"(从一个交易所搬到另一个)，必须看全球总库存。📖 LME Daily Stocks Report |
| 🇯🇵 日文 | 銅=グローバル経済体温計。LME(ロンドン金属取引所)が毎日発表する銅在庫を見る：オン・ワラント(on-warrant)+キャンセルド・ワラント(canceled warrant)。鍵シグナル：キャンセル急増=誰かが大量に引き取り中=需要回復=強気。しかしより重要なのはLME+COMEX+SHFEの3所在庫合計——単一取引所在庫は単なる「倉庫間移動」の可能性がある、必ずグローバル総在庫を見ろ。📖 LME Daily Stocks Report |
| 🇺🇸 英文 | "Copper = global economy thermometer. Watch LME daily copper inventory: on-warrant + canceled warrant. Key signal: canceled warrants spike = someone is taking large delivery = demand recovering = bullish. But MORE important: LME+COMEX+SHFE combined = global total inventory. Single-exchange inventory could just be 'warehouse shuffling'; must watch global total. 📖 LME Daily Stocks Report" |
| ⚙️ 参数 | 三地总库存周变化 + 注销比 | 总库存下降+注销比>50%=强看涨 |

### CMD_GOLD_ETF — 黄金ETF持仓 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 黄金ETF(如GLD)=散户和机构买黄金最方便的方式。ETF持仓量变化=黄金的"聪明钱"指标。持仓增加=资金流入黄金=避险需求上升。持仓减少=资金流出=风险偏好回升。最经典的信号：股市大跌+黄金ETF持仓激增=市场在"逃向安全资产"。持仓量是每日更新的真实资金流。📖 GLD/IAU持仓数据 |
| 🇯🇵 日文 | ゴールドETF(例: GLD)=リテールと機関が金を買う最も便利な方法。ETF保有量変化=金の「スマートマネー」指標。保有増加=資金が金に流入=リスクオフ需要上昇。保有減少=資金流出=リスクオン回帰。最も古典的なシグナル：株式急落+ゴールドETF保有急増=市場が「安全資産に逃避」している。保有量は毎日更新されるリアルな資金フロー。📖 GLD/IAU保有データ |
| 🇺🇸 英文 | "Gold ETF (e.g., GLD) = the easiest way for retail & institutions to buy gold. ETF holdings change = gold's 'smart money' indicator. Holdings up = money flowing into gold = risk-off demand rising. Holdings down = money out = risk-on returning. Classic signal: stocks crash + gold ETF holdings surge = market is 'fleeing to safety'. Holdings data is daily, real, actual money flows. 📖 GLD/IAU holdings data" |
| ⚙️ 参数 | GLD 持仓量周变化(吨) | 连续增持=长期看涨 |

### CMD_BALANCE_SHEET — 供需平衡 (🔴专业)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 大宗商品的终极基本面=全球供给 vs 全球需求。USDA每月WASDE报告(农产品)、IEA每月石油市场报告(能源)、ICSG/ILZSG(铜/铅锌)——这些是让你看到"牌桌底下"的供需数字。盈余(供应>需求)=价格承压。赤字(需求>供应)=价格上涨。但关键：市场已经在交易当前的赤字/盈余，你需要比市场更早知道下一份报告的"意外"方向。📖 USDA WASDE / IEA OMR / ICSG |
| 🇯🇵 日文 | コモディティの究極のファンダメンタル=グローバル供給 vs グローバル需要。USDA月次WASDE報告(農産物)、IEA月次石油市場報告(エネルギー)、ICSG/ILZSG(銅/鉛亜鉛)——これらは「テーブルの下」の需給数字を見せてくれる。余剰(供給>需要)=価格に圧力。赤字(需要>供給)=価格に上昇圧力。ただし鍵：市場はすでに現在の赤字/余剰を取引済み。あなたは次回報告の「サプライズ」方向を市場より早く知る必要がある。📖 USDA WASDE / IEA OMR / ICSG |
| 🇺🇸 英文 | "The ultimate commodity fundamental = global supply vs global demand. USDA monthly WASDE (agriculture), IEA monthly Oil Market Report (energy), ICSG/ILZSG (copper/lead-zinc) — these show the supply-demand numbers 'under the table'. Surplus (supply>demand) = price pressure. Deficit (demand>supply) = price upside. But key: the market is ALREADY trading the current deficit/surplus. YOU need to know the 'surprise' direction of the next report before the market does. 📖 USDA WASDE / IEA OMR / ICSG" |
| ⚙️ 参数 | (产量-消费量)/消费量 + 报告月vs上月变化 | 赤字扩大=看涨, 盈余扩大=看空 |

---

## B.3 L6 季节性 (2因子)

### CMD_SEASONALITY — 商品季节性 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 商品有"日历底牌"——某些月份涨的概率远高于50%。这不是迷信，是物理：天然气11-2月取暖需求→涨价。原油6-9月驾车旺季→涨价。大豆8-9月收获压力→跌价。黄金9月印度婚礼季→涨价。每个商品都有自己一年12个月的"输赢表"——过去20年这个月涨了多少次、跌了多少次、平均涨跌幅。用这张表当"直觉检验"：信号说买，但这个月历史上90%跌→再想想。📖 Anderson (1980), *The Seasonality of Commodity Prices* |
| 🇯🇵 日文 | 商品には「カレンダーの切り札」がある——ある月の上昇確率が50%を大きく上回る。これは迷信でなく物理学：天然ガス11-2月暖房需要→上昇。原油6-9月ドライブシーズン→上昇。大豆8-9月収穫圧力→下落。金9月インド婚礼シーズン→上昇。各商品には一年12ヶ月の「勝敗表」がある——過去20年この月は何回勝ち、何回負け、平均リターンはいくらか。この表を「直感検証」に使え：シグナルが買いと言っても、この月は歴史的に90%下落→もう一度考えろ。📖 Anderson (1980), *The Seasonality of Commodity Prices* |
| 🇺🇸 英文 | "Commodities have a 'calendar edge' — certain months win way more than 50% of the time. Not superstition, it's physics: Natgas Nov-Feb heating demand → up. Crude Jun-Sep driving season → up. Soybeans Aug-Sep harvest pressure → down. Gold Sep Indian wedding season → up. Every commodity has a 12-month 'win/loss table' — how many times in 20 years this month won, lost, average return. Use it as a 'gut check': signal says buy, but this month historically loses 90% → think twice. 📖 Anderson (1980), *The Seasonality of Commodity Prices*" |
| ⚙️ 参数 | 月胜率(正收益月份/总年数) | >70%=强季节性, <30%=弱季节性 |

### CMD_GOLD_SUMMER — 黄金夏季效应 (🟢入门)

| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 黄金的"夏季低点"是商品世界最著名的季节性模式。(1) 6-7月印度雨季=婚礼减少=黄金需求低谷。(2) 8月欧美度假季=交易清淡=波动小。(3) 9月印度排灯节+婚礼季=需求爆发。历史上看：6-7月买入黄金、持有到9-10月——胜率超过65%。这不是魔法，是印度每年消耗800吨黄金(全球1/4)的文化节奏。📖 Lucey & Tully (2006), *Seasonal Patterns in Gold Returns* |
| 🇯🇵 日文 | 金の「夏季底値」はコモディティ世界で最も有名な季節性パターン。(1)6-7月インド雨季=婚礼減少=金需要の谷。(2)8月欧米休暇シーズン=取引薄=変動小。(3)9月インドのディワリ+婚礼シーズン=需要爆発。歴史的に：6-7月に金購入、9-10月まで保有——勝率65%超。これは魔法でなく、インドが毎年800トンの金を消費する(世界の1/4)文化リズム。📖 Lucey & Tully (2006), *Seasonal Patterns in Gold Returns* |
| 🇺🇸 英文 | "Gold's 'summer dip' = the most famous seasonal pattern in commodities. (1) Jun-Jul Indian monsoon = fewer weddings = gold demand trough. (2) Aug Western vacation = thin trading = low volatility. (3) Sep Indian Diwali + wedding season = demand explosion. Historically: buy gold Jun-Jul, hold to Sep-Oct — win rate >65%. Not magic — it's India consuming 800 tonnes of gold/year (1/4 of global) on a cultural rhythm. 📖 Lucey & Tully (2006), *Seasonal Patterns in Gold Returns*" |
| ⚙️ 参数 | 6-7月做多信号 + 9-10月做多 | 6-7月低位建仓, 9-10月旺季获利 |

---

# Part C: 季节性环形日历视觉设计

## C.1 设计理念

> **"把12个月围成一圈，让季节的韵律一眼可见"**

## C.2 环形日历布局

```
                    ┌─────────────────────────────────────┐
                    │       🌾 玉米季节性日历              │
                    │                                     │
                    │             12月 🔴                 │
                    │         1月 🔴   11月 🔴             │
                    │                                     │
                    │    2月 🔴              10月 🟡      │
                    │                                     │
                    │ 3月 🟡            【玉米】    9月 🟡 │
                    │                                     │
                    │    4月 🟢              8月 🔴       │
                    │                                     │
                    │         5月 🟢    7月 🔴             │
                    │             6月 🟢                  │
                    │                                     │
                    │   🟢=旺季(4-6月种植期, 天气溢价)    │
                    │   🟡=过渡期(3/9/10月)               │
                    │   🔴=淡季(8月收获压力 + 11-2月)     │
                    │                                     │
                    │  ▸ 当前位置: 6月 🟢 种植关键期      │
                    │  ▸ 月胜率: 71% (过去20年)           │
                    │  ▸ 月均收益: +2.3%                  │
                    └─────────────────────────────────────┘
```

## C.3 环形日历 CSS 实现思路

```css
.seasonality-ring {
  display: grid;
  width: 360px;
  height: 360px;
  position: relative;
  border-radius: 50%;
}

.month-slot {
  position: absolute;
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  transition: all 0.3s ease;
}

/* 12个月定位 — 用 transform rotate + translate */
/* Month 1 (Jan) at 12 o'clock */
.month-1  { transform: rotate(-90deg) translate(140px) rotate(90deg); }
.month-2  { transform: rotate(-60deg) translate(140px) rotate(60deg); }
.month-3  { transform: rotate(-30deg) translate(140px) rotate(30deg); }
/* ... etc evenly spaced at 30° intervals ... */

/* 季节颜色 */
.season-peak     { background: #228B22; color: #fff; } /* 🟢 旺季 */
.season-transition { background: #DAA520; color: #000; } /* 🟡 过渡 */
.season-trough   { background: #8B0000; color: #fff; } /* 🔴 淡季 */
.season-current  { box-shadow: 0 0 20px currentColor; transform: scale(1.3); }
```

## C.4 悬浮提示(Tooltip)

```
┌──────────────────────────────┐
│  🌽 玉米 — 6月                │
│  ────────────────────────── │
│  🟢 旺季 · 种植关键期        │
│                              │
│  历史表现 (2005-2025):        │
│  胜率: 71% (15胜/6负)         │
│  月均收益: +2.3%              │
│  最大盈利: +18.7% (2012)      │
│  最大亏损: -12.1% (2020)      │
│                              │
│  💡 为什么？                  │
│  播种面积已定→市场在猜测      │
│  天气对单产的影响→"天气溢价"   │
│  这段时间任何干旱预报都会      │
│  推动玉米大涨                  │
│                              │
│  📊 本月 vs 其他月份:         │
│  ████████████░░ 71% 胜率       │
│  均值50%      ←本月胜率更高!   │
└──────────────────────────────┘
```

## C.5 六商品季节性速查表

| 商品 | 最佳月 | 最差月 | 季节性强度 | 驱动因素 |
|------|:---:|:---:|:---:|------|
| 🥇 黄金 | 1月(+2.1%), 9月(+1.8%) | 6月(-0.5%) | ⭐⭐⭐ | 印度婚礼/排灯节/ETF再平衡 |
| 🛢️ 原油 | 2月(+2.8%), 7月(+3.1%) | 11月(-1.2%) | ⭐⭐⭐ | 驾车旺季/炼厂检修/取暖油 |
| 🔩 铜 | 1月(+3.2%), 2月(+2.5%) | 6月(-1.1%) | ⭐⭐⭐⭐ | 中国春节后补库/财年预算 |
| 💨 天然气 | 9月(+3.8%), 10月(+4.2%) | 3月(-2.1%) | ⭐⭐⭐⭐⭐ | 飓风季/注气季/冬季预期 |
| 🌽 玉米 | 6月(+2.3%), 7月(+1.8%) | 9月(-3.1%) | ⭐⭐⭐⭐ | 种植进度/授粉天气/收割压力 |
| 🌾 大豆 | 5月(+2.0%), 7月(+2.5%) | 10月(-2.8%) | ⭐⭐⭐⭐ | USDA 5月报告/生长天气/收割 |

---

## C.6 商品Onboarding 3步向导

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1/3           🛢️ 选你的商品                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│ │
│  │  │  🥇      │ │  🛢️      │ │  🔩      │ │  🌾      ││ │
│  │  │ 贵金属   │ │  能源    │ │ 工业金属  │ │  农产品   ││ │
│  │  │ 黄金/银  │ │ 原油/气  │ │ 铜/铝/锌  │ │ 玉米/大豆 ││ │
│  │  │          │ │          │ │          │ │          ││ │
│  │  │ [选择]   │ │ [选择]   │ │ [选择]   │ │ [选择]   ││ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│ │
│  │                                                       │ │
│  │  💡 不知道选什么? 新手建议从 🥇黄金 或 🛢️原油开始       │ │
│  │     这两个市场规模最大, 数据最完整, 因子最稳定           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 2/3           🔑 核心因子                              │
│  🛢️ 原油 WTI 的关键信号:                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  🟢 展期收益: 换仓每月白赚0.57% (长期持有有利)          │ │
│  │  🟢 12月动量: 过去一年涨了15% (趋势向上)                │ │
│  │  🟡 EIA库存: 比预期少了6.5M桶 (需求超预期)             │ │
│  │  🟡 基差: 期货贴水1.2% (中性)                          │ │
│  │                                                       │ │
│  │  💡 "原油最核心就三个数: 展期收益(换月赚不赚钱)、       │ │
│  │     EIA库存(多了还是少了)、动量(趋势还在不在)"          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 3/3           📖 怎么看信号?                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  🛢️ 原油综合信号: 🟢 偏多 (4/5 正向)                   │ │
│  │                                                       │ │
│  │  ┌───────────────────────────────────────────────┐   │ │
│  │  │  📅 季节性提醒: 7月是原油旺季(驾车高峰)         │   │ │
│  │  │     历史胜率: 68% · 月均+3.1% (过去20年)       │   │ │
│  │  │     → 季节性也支持当前的做多信号 ✅              │   │ │
│  │  └───────────────────────────────────────────────┘   │ │
│  │                                                       │ │
│  │  ⚠️ 注意：商品信号 ≠ 股票信号                          │ │
│  │  - 商品看"展期收益"不看"PE"                             │ │
│  │  - 商品看"EIA库存"不看"财报"                            │ │
│  │  - 商品有"季节性"股票没有                               │ │
│  │                                                       │ │
│  │  [加入我的仪表板] [换一个商品]                           │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 交付清单

| # | PM要求 | 交付 | 状态 |
|---|--------|------|:--:|
| ① | 商品UX设计规范: 4配色+信号卡+库存图 | ✅ 4品类配色CSS+卡片布局+库存图规则 |
| ② | 14因子故事文案(中英日42条) | ✅ L1(7)+L2(5)+L6(2)=14×3=42条 含学术引用+参数 |
| ③ | 季节性环形日历设计 | ✅ CSS+12月布局+6商品速查+Tooltip |

**验收对照**:
- ✅ 4类配色: 金🥇/橙🛢️/银🔩/绿🌾 各有独立CSS变量文件
- ✅ 14因子×3语=42条故事: 人话翻译(换月成本/大佬底牌/天气溢价)
- ✅ 环形日历: 12月围圈+🟢🟡🔴三色+当前月高亮+悬浮详情+6商品速查表
- ✅ Onboarding 3步: 选商品→看因子→学信号

---

*QClaw(设计虾) | R198 🛢️ 大宗商品因子首轮完成! | 2026-06-15*
