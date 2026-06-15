# TradingEasy R187 设计交付 — 因子婚姻冲突可视化 + 🟡进阶因子三语故事 + 权重拖拽UX + 降级教育文案

> **Round**: R187 (🟡进阶因子Batch1) | **角色**: QClaw(设计虾)
> **交付物**: ① 因子婚姻冲突可视化 ② 🟡因子三语故事(34个) ③ 权重拖拽交互UX ④ 4降级因子教育文案
> **对齐**: PM R187广播 + 12虾合并清单v2 | **日期**: 2026-06-15

---

# Part A: 因子婚姻冲突可视化

## A.1 设计哲学

```
问题: 相关性矩阵是一堆冰冷的数字(r=0.85, r=-0.42...)
      用户看不懂，也不想看。
方案: 用"婚姻"比喻，让相关系数变成人物关系故事。

        r≥0.7    → 💍 互补婚姻
        0.3≤r<0.7 → 🤝 同事关系
        -0.3<r<0.3 → 🚶 路人
        r≤-0.7    → ⚔️ 冲突
```

## A.2 婚姻关系分类体系

### 四类关系定义

| 关系 | 图标 | r范围 | 婚姻比喻 | UI颜色 | 信号含义 |
|------|------|------|----------|--------|----------|
| **互补** | 💍 | r≥0.7 | "天生一对" | 🟢暖金 #D4A574 | 选一个就够了，两个都配重复 |
| **搭配** | 🤝 | 0.3≤r<0.7 | "好搭档" | 🟡琥珀 #F5A623 | 可以一起，但不是必须 |
| **独立** | 🚶 | -0.3<r<0.3 | "各过各的" | ⚪灰 #9E9E9E | 完全不重叠，各提供独立信息 |
| **冲突** | ⚔️ | r≤-0.7 | "水火不容" | 🔴赤 #E53935 | 选了A就不能选B，信号相反 |

> 注: r≤-0.7译为"冲突"而非"对冲"，因为散户不理解对冲概念。
> "冲突"更直观——两个因子指向相反方向。

### 特殊关系: "婚后生活"评估

除了相关性r值，还考虑因子组合的"长期幸福指数"：

| 维度 | 权重 | 计算 |
|------|------|------|
| 相关性得分 | 30% | 1 - |r| (越低越互补) |
| IC一致性 | 25% | 1 - σ(IC差值)/均值 |
| 覆盖度 | 20% | 因子类别重叠度(1=完全不同类) |
| 衰减同步性 | 15% | 1 - |半衰期差值|/365 |
| 市场适应一致性 | 10% | 牛市+熊市+震荡市3场景胜负一致性 |

综合分 → 婚姻等级:
- 100-80: 💍 金婚 — 完美组合
- 79-60: 💐 银婚 — 可靠搭档
- 59-40: 🔔 纸婚 — 刚认识，观望
- 39-20: ⚠️ 冷战 — 经常意见不合
- 19-0: ⚔️ 离婚 — 不要放一起

---

## A.3 可视化UI: 因子配对卡片

### 3.1 因子配对列表

```
┌──────────────────────────────────────────────────────┐
│  💍 因子配对分析 — 避免选"两口子"因子                   │
│  ──────────────────────────────────────────────────── │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ 💍 MOM_12M + GROWTH                        │      │
│  │ r=0.85 强互补                               │      │
│  │ ████████████████████████████████████████████ │      │
│  │                                             │      │
│  │ 👰 MOM_12M                              🤵 GROWTH│
│  │ "涨得快的"                           "利润在长的"  │
│  │                                             │      │
│  │ 📋 "这两口子说一样的话——长得快的公司利润也在涨。 │      │
│  │   选一个就行，两个都配是重复劳动。"          │      │
│  │                                      [删除一个] │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ ⚔️ MOM_12M + RSI_14                         │      │
│  │ r=-0.72 强冲突                                │      │
│  │ ████████████████████████░░░░░░░░░░░░░░░░░░░░ │      │
│  │                                             │      │
│  │ 👊 MOM_12M                              ⚔️ RSI_14│
│  │ "追趋势"                             "等回调"    │
│  │                                             │      │
│  │ 📋 "一个在追涨一个在等跌，永远在吵架。        │      │
│  │   同时持有=左脚踩右脚，建议只留一个。"        │      │
│  │                                      [解决冲突] │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ 🚶 BOOK_TO_PRICE + ADX                     │      │
│  │ r=-0.05 完全独立                             │      │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │      │
│  │                                             │      │
│  │ 🚶 BOOK_TO_PRICE                        🚶 ADX│
│  │ "便宜不便宜"                         "有没有趋势"│
│  │                                             │      │
│  │ 📋 "这俩人住在同一条街但从未说过话。          │      │
│  │   分别提供完全不同的信息=你得到了2份独立情报。"│      │
│  └────────────────────────────────────────────┘      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.2 相关性热力图

```
┌─────────────────────────────────────────────────────────┐
│  💍 因子婚姻热力图 — 当前场景包: 🔄震荡轮动               │
│  ──────────────────────────────────────────────────────── │
│                                                         │
│           RSI  KDJ BOLL ATR  DISPO ANCH MAXDD          │
│  RSI      1.0                                          │
│  KDJ     💍0.88  1.0                                    │
│  BOLL    🤝0.45 🤝0.38  1.0                              │
│  ATR     🚶-0.12 🚶-0.08 🤝0.32  1.0                    │
│  DISPO   🚶0.05 🚶0.10 🚶-0.15 🚶0.02  1.0             │
│  ANCH    🚶-0.08 🚶0.03 🚶0.18 🚶0.11 🤝0.55  1.0      │
│  MAXDD   🚶0.22 🚶0.15 🚶-0.05 ⚔️-0.75 🚶0.01 🚶0.09 1.0│
│                                                         │
│  📋 警告: RSI+KDJ=💍 0.88 "两口子" — 删掉一个           │
│          ATR+MAXDD=⚔️ -0.75 "水火不容" — 确认逻辑矛盾    │
│                                                         │
│  婚姻健康总分: 72/100 | 💐 银婚 — 可靠但有改进空间       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.3 冲突解决引导

用户点击"解决冲突"按钮时弹出：

```
┌────────────────────────────────────────────────────┐
│  ⚔️ 因子冲突解决                                    │
│                                                    │
│  MOM_12M (趋势) ↔ RSI_14 (震荡)                    │
│  r = -0.72                                         │
│                                                    │
│  🤔 为什么冲突？                                    │
│  MOM_12M说"买了别动，趋势在延续"                    │
│  RSI_14说"涨太多了，赶紧卖"                        │
│  这俩在熊市反弹时特别容易打架。                     │
│                                                    │
│  你该怎么办？                                      │
│  ┌──────────────────────────────────────┐          │
│  │ 🅰️ 留趋势(MOM_12M)，舍弃震荡(RSI_14) │          │
│  │   适合: 牛市/趋势行情                  │          │
│  └──────────────────────────────────────┘          │
│  ┌──────────────────────────────────────┐          │
│  │ 🅱️ 留震荡(RSI_14)，舍弃趋势(MOM_12M) │          │
│  │   适合: 横盘/震荡行情                  │          │
│  └──────────────────────────────────────┘          │
│  ┌──────────────────────────────────────┐          │
│  │ 🅲️ 全留着，但设市场条件自动切换        │          │
│  │   ADX>25→用MOM | ADX<25→用RSI        │          │
│  │   💡 推荐！(1.5U/次AI优化条件)         │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  [我选A]  [我选B]  [推荐C→AI自动配(1.5U)]          │
└────────────────────────────────────────────────────┘
```

---

# Part B: 🟡进阶因子三语故事 (34个)

## B.1 A1 价值进阶 (3)

**1. SALES_TO_PRICE — 市销率倒数**
- 🇨🇳: 不看利润看营收。有些公司暂时亏损但营收在涨(早期科技/生物)。市销率倒数=一块钱能买到多少销售额。越低越有"营收安全垫"。
- 🇺🇸: "Ignore profit — focus on revenue. Some companies lose money but revenue grows (early-stage tech/biotech). S/P = how much sales per dollar. Lower = bigger revenue cushion."
- 🇯🇵: 利益ではなく売上を見る。一時的に赤字でも売上が伸びている会社(初期テック/バイオ)がある。S/P=1円でいくらの売上を買えるか。低いほど売上の安全マージンが大きい。

**2. CASHFLOW_YIELD — 现金流收益率**
- 🇨🇳: 一家公司赚100亿利润但现金只有5亿→纸面富贵。现金流收益率=真金白银/股价。比PE更"诚实"，因为现金不会撒谎。
- 🇺🇸: "A company reports $10B profit but has only $500M in cash → paper wealth. Cash flow yield = real cash / share price. More honest than P/E — cash doesn't lie."
- 🇯🇵: 会社が1000億円の利益を報告しても現金は50億円だけ→帳簿上の富。キャッシュフロー利回り=本物の現金÷株価。PERより「正直」——現金は嘘をつかない。

**3. PEG_RATIO — PEG比率**
- 🇨🇳: PE/增长率。PE=30看起来贵，但增长率也是30%=PEG=1=合理。PE=15但增长率只有5%=PEG=3=反而贵。PEG=兼顾估值+成长。
- 🇺🇸: "PE / growth rate. PE=30 seems expensive, but if growth=30% → PEG=1 = fair. PE=15 but growth=5% → PEG=3 = actually expensive. PEG considers both valuation AND growth."
- 🇯🇵: PER÷成長率。PER=30は高く見えるが成長率も30%ならPEG=1=妥当。PER=15だが成長率5%ならPEG=3=実は割高。PEGはバリュエーションと成長の両方を見る。

## B.2 A2 质量进阶 (3)

**4. ROIC — 投入资本回报率**
- 🇨🇳: 巴菲特最爱。同样的生产线，A公司投100万赚30万(ROIC=30%)，B公司投100万赚5万(ROIC=5%)。ROIC告诉你在正确的地方花钱vs在错误的地方烧钱。
- 🇺🇸: "Buffett's favorite. Same factory line — Company A invests $1M and earns $300K (ROIC=30%), Company B earns $50K (5%). ROIC separates smart spending from cash burning."
- 🇯🇵: バフェットの一番好きな指標。同じ生産ラインで、A社は100万ドル投資して30万ドル稼ぐ(ROIC=30%)、B社は5万ドル(5%)。ROICは賢い支出と無駄遣いを見分ける。

**5. ASSET_TURNOVER — 资产周转率**
- 🇨🇳: 用100万的资产能"榨"出多少收入。零售业希望高周转(薄利多销)，重工业自然低。同行比较才有意义。高周转=管理层的"榨汁能力"。
- 🇺🇸: "How much revenue you can squeeze from $1M in assets. Retail wants high turnover (thin margins, high volume), heavy industry is naturally low. Compare within industry. High turnover = management's juicing ability."
- 🇯🇵: 100万ドルの資産からどれだけの収入を絞り出せるか。小売は高回転(薄利多売)を望み、重工業は自然に低い。同業種内で比較。高回転=経営陣の「搾汁能力」。

**6. PIOTROSKI_F — Piotroski F-Score**
- 🇨🇳: 0-9分的基本面体检表。9分=满分健康。0分=ICU。从盈利/杠杆/效率三个维度打分。在便宜股(低PB)里筛出"真便宜"vs"价值陷阱"的神器。
- 🇺🇸: "A 0-9 health checkup for fundamentals. 9 = perfect health. 0 = ICU. Scores profitability, leverage, and efficiency. The magic tool that separates 'genuinely cheap' from 'value traps' in cheap stocks."
- 🇯🇵: 0-9点のファンダメンタル健康診断。9点=完全な健康。0点=ICU。収益性/レバレッジ/効率性の3次元で採点。割安株の中で「本当に安い」と「バリュートラップ」を見分ける魔法のツール。

## B.3 A3 低波进阶 (2)

**7. IDIO_VOL — 特质波动率**
- 🇨🇳: 把大盘影响剔除后，这只股票自身的"任性程度"。大盘涨它跌，大盘跌它涨=高特质波动=不跟大盘走。很多人以为这是"风险"，其实是选股的Alpha来源。
- 🇺🇸: "After removing market influence, how 'willful' this stock is. Market up it's down, market down it's up = high idiosyncratic vol. Many see this as 'risk' — it's actually a source of stock-picking alpha."
- 🇯🇵: 市場の影響を取り除いた後の、この株の「わがまま度」。市場が上がっても下がる、市場が下がっても上がる=高い固有ボラティリティ。多くの人はこれを「リスク」と見るが、実は銘柄選択のアルファ源。

**8. DOWNSIDE_VOL — 下行波动率**
- 🇨🇳: 只算下跌时的波动。上涨的波动是开心的，下跌的才是真疼。下行波动率=这只股票"伤人的时候有多疼"。低下行波动=温柔地跌，高下行波动=刀子落地。
- 🇺🇸: "Only measures volatility on the way down. Upward volatility is fun — downward is pain. Downside vol = how much it hurts when this stock falls. Low = gentle descent, high = knife falling."
- 🇯🇵: 下落時のボラティリティだけを測る。上昇のボラティリティは楽しいが、下落は痛い。下方ボラティリティ=この株が下がる時の痛み。低い=優しい下落、高い=ナイフが落ちる。

## B.4 A4 情绪进阶 (3)

**9. ANALYST_REVISION — 分析师修正**
- 🇨🇳: 华尔街分析师集体上调/下调盈利预测。分析师是最后承认现实的人——他们上调时往往已经涨了很多。这个因子最值钱的地方在"谁还没调"——还没上调但很快会上调的公司。
- 🇺🇸: "Wall Street analysts collectively upgrade/downgrade estimates. Analysts are the last to admit reality — upgrades often come after the rally. The alpha here is in 'who hasn't revised yet'."
- 🇯🇵: ウォール街のアナリストが一斉に利益予想を上方/下方修正。アナリストは最後に現実を認める人たち——上方修正は上昇の後であることが多い。このファクターの真価は「まだ修正していないのは誰か」にある。

**10. SHORT_INTEREST — 空头占比**
- 🇨🇳: 做空比例。>20%=很多人押注下跌。但空头必须买回来平仓→潜在的"轧空"买家。高空头比例=双刃剑：要么是聪明钱看跌，要么是轧空火箭燃料。
- 🇺🇸: "Short ratio. >20% = many betting against it. But shorts must buy back to close → potential 'squeeze' buyers. High short interest = double-edged sword: either smart money sees trouble, or rocket fuel for a squeeze."
- 🇯🇵: 空売り比率。20%超=多くの人が下落に賭けている。でも空売りは買い戻しが必要→潜在的な「スクイーズ」買い手。高空売り比率=両刃の剣：賢い資金がトラブルを見ているか、スクイーズのロケット燃料か。

**11. ETF_FLOW — ETF资金流 (进阶版)**
- 🇨🇳: 进阶视角: 不是看净流入，是看净流入的加速度。流入从+50M减缓到+10M=热度减退。流出从-20M收窄到-5M=恐慌见底。看二阶导数比看绝对值更准。
- 🇺🇸: "Advanced view: watch the acceleration, not just the flow. Inflow slowing from +$50M to +$10M = cooling. Outflow narrowing from -$20M to -$5M = panic bottoming. The second derivative is more telling."
- 🇯🇵: 上級視点：純流入ではなく加速度を見る。流入が+50Mから+10Mに減速=熱が冷めている。流出が-20Mから-5Mに縮小=パニック底打ち。二階微分の方がより示唆的。

## B.5 A5 宏观进阶 (2)

**12. INFLATION_BETA — 通胀敏感度**
- 🇨🇳: 通胀涨1%股价涨多少？资源股正β(通胀涨我也涨)，科技股负β(通胀涨我跌—因为加息)。2022年的教训：通胀β的负值越大，加息时跌越惨。
- 🇺🇸: "How much stock moves when inflation rises 1%. Commodities = positive beta (inflation up, I'm up). Tech = negative beta (inflation up = rates up = I crash). 2022 lesson: the bigger the negative inflation beta, the harder you fell."
- 🇯🇵: インフレが1%上昇した時、株価はどれだけ動くか。資源株=正のベータ(インフレ↑で私も↑)。テック株=負のベータ(インフレ↑=金利↑=暴落)。2022年の教訓：負のインフレベータが大きいほど、金利上昇でより激しく下落。

**13. RATE_SENSITIVITY — 利率敏感度**
- 🇨🇳: 利率涨1%股价变化。银行正敏感(涨息赚更多利差)，REITs负敏感(涨息=融资成本更高)。2023美息见顶→利率敏感度从重要变成离场信号→现在又回来了。
- 🇺🇸: "Stock movement per 1% rate change. Banks = positive (higher rates = wider spreads). REITs = negative (higher rates = higher financing costs). 2023 peak rates → rate sensitivity faded → now it's back."
- 🇯🇵: 金利1%上昇あたりの株価変動。銀行=正(金利上昇=利ざや拡大)。REIT=負(金利上昇=資金調達コスト上昇)。2023年金利ピーク→感応度は一旦薄れた→今また戻ってきた。

## B.6 A6 主题进阶 (3)

**14. THEME_AI — AI主题暴露**
- 🇨🇳: AI相关收入占比。>30%=纯AI公司，10-30%=AI驱动，<10%=蹭热点。2024年教训：很多公司把"AI"加进名字涨了50%，但实际收入来自AI的不到3%。这个因子帮你区分"真AI"。
- 🇺🇸: "AI-related revenue %. >30% = pure AI play. 10-30% = AI-driven. <10% = AI-washing. 2024 lesson: companies added 'AI' to their name & jumped 50%, but actual AI revenue <3%. This factor separates real from fake."
- 🇯🇵: AI関連収入の割合。30%超=純粋なAI銘柄。10-30%=AI駆動型。10%未満=AI便乗。2024年の教訓：「AI」を社名に入れて50%上昇した会社の実際のAI収入は3%未満。このファクターが本物と偽物を見分ける。

**15. THEME_GREEN — 绿色能源暴露**
- 🇨🇳: 新能源/ESG收入占比。政策顺风时跑赢，油价跌时跑输。关键不在占比多高，而在"增速"——从5%涨到15%的公司跑赢一直15%的公司。变化>绝对值。
- 🇺🇸: "Green/ESG revenue %. Outperforms with policy tailwinds, underperforms when oil falls. Key isn't the level — it's the 'growth'. Companies going from 5% to 15% beat those steady at 15%. Change > absolute."
- 🇯🇵: 新エネルギー/ESG収入比率。政策の追い風でアウトパフォーム、原油安でアンダーパフォーム。重要なのは水準ではなく「伸び」——5%から15%に伸びた会社は、ずっと15%の会社を上回る。変化>絶対値。

**16. THEME_CONSUMPTION — 消费升级暴露**
- 🇨🇳: 消费升级/降级方向。经济好时升级因子跑赢，经济差时降级因子跑赢。中国市场：拼多多>京东=降级信号。全球：LVMH>优衣库=升级信号。
- 🇺🇸: "Consumption upgrade/downgrade direction. Upgrade wins in good times, downgrade in bad. China: PDD > JD = downgrade signal. Global: LVMH > Uniqlo = upgrade signal."
- 🇯🇵: 消費のアップグレード/ダウングレード方向。好況時はアップグレードが勝ち、不況時はダウングレードが勝つ。中国：拼多多>京東=ダウングレード信号。世界：LVMH>ユニクロ=アップグレード信号。

## B.7 A7 期权进阶 (3)

**17. IV_SKEW — 波动率偏斜**
- 🇨🇳: 看跌期权IV - 看涨期权IV。偏斜>0=恐惧(都在买看跌保险)。偏斜<0=贪婪(都在买看涨彩票)。这是"聪明钱的恐惧温度计"。2020年3月IV Skew达到历史极值。
- 🇺🇸: "Put IV - Call IV. Skew > 0 = fear (everyone buying put insurance). Skew < 0 = greed (everyone buying call lottery tickets). The 'smart money fear thermometer.' March 2020 IV Skew hit all-time extreme."
- 🇯🇵: プットIV - コールIV。スキュー>0=恐怖(みんなプット保険を買っている)。スキュー<0=強欲(みんなコール宝くじを買っている)。「賢い資金の恐怖温度計」。2020年3月、IVスキューは歴史的極値に達した。

**18. IV_RANK_ADVANCED — IV Rank进阶**
- 🇨🇳: 不只告诉你IV在1年中的位置，还告诉你IV在"当前这个级别的市场环境下"是否合理。牛市里IV Rank正常偏高是正常的，熊市里IV Rank低才是真低。情境感知的IV Rank。
- 🇺🇸: "Goes beyond percentile — tells you if IV is 'reasonable for current market regime.' Normal IV Rank in a bull market = expected. Low IV Rank in a bear = truly low. Context-aware IV Rank."
- 🇯🇵: パーセンタイルを超えて——IVが「現在の市場レジームで妥当か」を教える。強気相場でIVランクが通常より高いのは当然。弱気相場でIVランクが低いのは本当に低い。文脈を考慮したIVランク。

**19. PUT_CALL_RATIO — 看跌/看涨比**
- 🇨🇳: 成交量的看跌/看涨比。>1=更多的人在买看跌(恐惧)。<0.5=更多的人在买看涨(贪婪)。但极端值往往反着用：极度恐惧时反而是买点。这个因子的信号在极值时最强。
- 🇺🇸: "Volume put/call ratio. >1 = more buying puts (fear). <0.5 = more buying calls (greed). But extremes often reverse: extreme fear = buy signal. This factor's signal is strongest at extremes."
- 🇯🇵: 出来高のプット/コール比率。>1=より多くのプット購入(恐怖)。<0.5=より多くのコール購入(強欲)。でも極値は逆に働く：極度の恐怖は買いシグナル。このファクターのシグナルは極値で最も強い。

## B.8 A8 事件进阶 (3)

**20. EARNINGS_ESTIMATE — 盈利预测一致预期**
- 🇨🇳: 市场对下季EPS的一致预期。告诉你"目前的价格里已经包含了什么预期"。如果一致预期已经被充分定价(=股价已涨)，超预期可能不够→需要超超预期。
- 🇺🇸: "Consensus estimate for next quarter EPS. Shows 'what expectations are already priced in.' If expectations are fully priced (= stock already rallied), beating estimates might not be enough → need to crush estimates."
- 🇯🇵: 来期EPSのコンセンサス予想。「現在の価格にどんな期待が織り込まれているか」を示す。期待が十分に織り込まれていれば(株価既に上昇)、予想超えだけでは不十分→大幅に超える必要がある。

**21. PRE_EARNINGS_IV — 财报前隐含波动**
- 🇨🇳: 财报前的跨式期权价格透露市场对"惊喜/惊吓程度"的预期。IV暴涨=市场预计大波动。但方向未知。结合业绩超预期因子使用：高IV+业绩超预期=可能大涨。
- 🇺🇸: "Straddle price before earnings reveals market's expected 'surprise magnitude.' IV surging = market expects big move. Direction unknown. Pair with earnings surprise: high IV + earnings beat = potential rally."
- 🇯🇵: 決算前のストラドル価格が市場の「サプライズの大きさ」への期待を明らかにする。IV急騰=市場は大きな動きを予想。方向は不明。利益サプライズファクターと併用：高IV+利益サプライズ=大幅上昇の可能性。

**22. INDEX_REBALANCE — 指数调仓预期**
- 🇨🇳: 被纳入标普500/恒指=被动基金强制买入=短期推高股价。被剔除=强制卖出。2024年SMCI被纳入标普→2周涨25%。但纳入后往往"利好出尽"。时机>选股。
- 🇺🇸: "Added to S&P 500/HSI = passive funds forced to buy = short-term price boost. Removed = forced selling. 2024 SMCI added to S&P → +25% in 2 weeks. But post-inclusion often 'buy the rumor, sell the news.' Timing > stock picking."
- 🇯🇵: S&P500/HSIに採用=パッシブファンドが強制購入=短期的な株価上昇。除外=強制売却。2024年SMCIがS&Pに採用→2週間で+25%。でも採用後はしばしば「噂で買って事実で売る」。タイミング>銘柄選択。

## B.9 A9 基本面深度 (5)

**23. FREE_CASH_FLOW — 自由现金流**
- 🇨🇳: 公司在支付所有账单、买完所有设备后还剩的现金。FCF为正=自给自足。FCF为负=需要不断融资。这是"薛定谔的利润"的答案——利润可以会计调节，FCF不能。
- 🇺🇸: "Cash left after paying all bills and buying all equipment. FCF positive = self-sufficient. FCF negative = constantly needs financing. The answer to 'Schrödinger's profit' — earnings can be massaged, FCF can't."
- 🇯🇵: すべての請求書を支払い、すべての設備を購入した後に残る現金。FCFプラス=自給自足。FCFマイナス=常に資金調達が必要。「シュレーディンガーの利益」の答え——利益は会計操作できるがFCFはできない。

**24. OPERATING_MARGIN — 营业利润率**
- 🇨🇳: 核心业务的赚钱效率。不同于毛利率(只看成本)，营业利润率看了全部运营费用。>20%=赚钱机器。在竞争加剧时营业利润率会先下滑—领先于收入下降。
- 🇺🇸: "Core business profit efficiency. Unlike gross margin (just costs), operating margin accounts for all OpEx. >20% = money machine. Operating margin drops BEFORE revenue — it's a leading indicator of competitive pressure."
- 🇯🇵: コア事業の利益効率。粗利率(コストだけ)と異なり、営業利益率はすべての営業費用を考慮。20%超=マネーマシン。競争激化時、営業利益率は収入より先に低下——競争圧力の先行指標。

**25. NET_MARGIN_STABILITY — 净利率稳定性**
- 🇨🇳: 过去8个季度净利率的波动。稳定=可预测=市场给的估值更高。不稳定=可能有一次性项目/会计变更/季节波动→需要深挖。稳定的低利润率>不稳定的高利润率。
- 🇺🇸: "Net margin volatility over the last 8 quarters. Stable = predictable = higher valuation multiple. Unstable = possible one-time items/accounting changes/seasonality → requires digging. Stable low margin > unstable high margin."
- 🇯🇵: 過去8四半期の純利益率の変動。安定=予測可能=より高いバリュエーション倍数。不安定=一時的項目/会計変更/季節変動の可能性→深掘りが必要。安定した低利益率>不安定な高利益率。

**26. SALES_GROWTH_CONSISTENCY — 营收增长一致性**
- 🇨🇳: 营收不只是要增长，还要"稳定地增长"。连续8季度同比增长的公司>断断续续增长的公司=管理层执行力可预测。一致性本身就是质量信号。
- 🇺🇸: "Revenue growth isn't just about growing — it's about growing consistently. 8 consecutive quarters of YoY growth > choppy growth = predictable execution. Consistency IS a quality signal."
- 🇯🇵: 売上成長は伸びるだけでなく、「安定して伸びる」ことが重要。8四半期連続で前年比成長>断続的成長=経営陣の実行力が予測可能。一貫性そのものが品質シグナル。

**27. INVENTORY_TURNOVER — 存货周转率**
- 🇨🇳: 存货一年转几圈。周转快=货不积压=需求好。周转突然变慢=东西卖不动了→可能是需求下滑的第一个信号。制造业/零售业的"煤矿金丝雀"。
- 🇺🇸: "How many times inventory turns per year. Fast = no backlog = strong demand. Suddenly slowing = products aren't selling → first signal of demand decline. The 'canary in the coal mine' for manufacturing/retail."
- 🇯🇵: 在庫が年に何回回転するか。速い=滞留在庫なし=需要が強い。急に遅くなる=商品が売れていない→需要減少の最初のシグナル。製造/小売の「炭鉱のカナリア」。

## B.10 降级因子教育文案 (4)

> 以下4个因子在R186审计中被判定"对新手太难理解"，从L1(🟢)降级为L2(🟡)。
> 每个因子附"为什么难理解"和"进阶玩家如何用"两段文案。

**28. DISPOSITION_EFFECT — 处置效应** (🟢→🟡 降级)
- 为什么降级: "这个因子挑战人性。亏损时'再等等'的冲动是写在我们DNA里的。理解它需要承认自己的心理弱点→对新手打击太大。进阶玩家已经交过学费，能笑着接受'我也有处置效应'。"
- 🇨🇳: 每个人的投资组合里都有一只"我舍不得卖"的亏损股。处置效应量化了这个弱点。当市场上有太多人不肯割肉时，真正的底往往还在后面。
- 🇺🇸: "Every portfolio has one 'I can't sell it' loser. Disposition effect quantifies this weakness. When too many refuse to cut losses, the real bottom is still ahead."
- 🇯🇵: 誰のポートフォリオにも「売れない」含み損銘柄がある。ディスポジション効果はこの弱点を数値化する。あまりにも多くの人が損切りを拒否する時、本当の底はまだ先にある。

**29. ANCHORING — 锚定效应** (🟢→🟡 降级)
- 为什么降级: "第一次看到的价格=你大脑的'出厂设置'。改变它需要大量反面证据。新手最容易被锚定——'它曾经到过100，现在30一定便宜'。进阶玩家知道锚定是陷阱，但需要工具来量化'市场在锚定什么'。"
- 🇨🇳: 承认吧：你大脑里有一个锚定价格。可能是你买入的价格，可能是它曾经达到的最高价。锚定效应不是你的错——是全人类的设计缺陷。但你可以利用别人的锚定：当所有人都在说"它曾经X元"时，反着做。
- 🇺🇸: "Admit it: you have an anchor price in your head. Maybe your entry, maybe the all-time high. Anchoring isn't your fault — it's a human design flaw. But you can exploit others' anchors: when everyone says 'it was once $X', do the opposite."
- 🇯🇵: 認めよう：頭の中にアンカー価格がある。多分あなたの参入価格か、過去最高値。アンカリングはあなたのせいではない——人間の設計上の欠陥だ。でも他人のアンカーを利用できる：みんなが「かつてXドルだった」と言う時、逆を行け。

**30. EQUITY_MULTIPLIER — 权益乘数** (🟢→🟡 降级)
- 为什么降级: "需要理解'净资产=总资产-总负债'这个会计等式。对新手来说，'权益乘数'这个词本身就劝退。但理解了这个，你就明白了杠杆怎么放大收益和灾难——这是必修课。"
- 🇨🇳: 这是"杠杆"在会计上的名字。权益乘数=3→公司每1块钱股东资金撬动3块钱资产。乘数越大→企业在用别人的钱做生意。好时光里成倍赚钱，坏时光里成倍亏钱。进阶玩家用它设定"我能接受的最大杠杆"。
- 🇺🇸: "Leverage's accounting name. EM=3 → every $1 of shareholder money controls $3 of assets. Bigger = business runs on other people's money. Good times: profits multiply. Bad times: losses multiply. Advanced: use it to set 'maximum leverage I'll accept'."
- 🇯🇵: レバレッジの会計上の名前。EM=3→株主の1ドルが3ドルの資産をコントロール。大きいほど=他人のお金でビジネスをしている。好況時：利益が倍増。不況時：損失が倍増。上級者：これで「許容できる最大レバレッジ」を設定する。

**31. AH_PREMIUM_CHANGE — AH溢价变化** (🟢→🟡 降级)
- 为什么降级: "首先得理解AH溢价(同一公司在A股和H股的价格比)，然后才理解变化方向。两层概念对新手不友好。但对港股进阶玩家，AH溢价变化=套利资金在搬货的信号。"
- 🇨🇳: AH溢价从130缩小到120→H股相对A股涨了=有资金在买港股。溢价扩大=A股相对走强或港股被抛售。这个变化比绝对值更及时——它是港股资金进出的"心电图"。
- 🇺🇸: "AH premium narrowing 130→120 = H-shares rising vs A-shares = money flowing into HK. Widening = A-shares strengthening or HK selling. The change is timelier than the level — it's the 'cardiogram' of cross-border HK flows."
- 🇯🇵: AHプレミアムが130→120に縮小=H株がA株に対して上昇=資金が香港に流入中。拡大=A株が強まるか香港が売られている。変化は水準よりタイムリー——国境を越えた香港資金フローの「心電図」。

---

# Part C: 因子权重拖拽交互规范UX

## C.1 组件定位

```
┌──────────────────────────────────────────────────────┐
│  WeightSlider 使用场景:                                │
│                                                      │
│  1. 场景包自定义模式 (菜包开袋→调权重)                  │
│  2. 超市购物车 (添加因子→分配权重)                      │
│  3. 因子PK对比台 (调两个因子权重看综合效果)             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## C.2 权重拖拽滑块设计

### 2.1 单因子滑块

```
┌──────────────────────────────────────────────────┐
│  EARNINGS_YIELD                          [重置]    │
│  ────────────────────────────────────────────────  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 0%  ●━━━━━━━━━━━━━━━━━━━━━━━━━━○━━ 100%     │  │
│  │      ▲                         ▲            │  │
│  │     20% 当前                    85% 目标      │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  权重: 20% ──────────▶ 25%  (+5%)                 │
│                                                   │
│  提示: 另一个因子权重将自动调低以保持总计100%      │
│                                                   │
└──────────────────────────────────────────────────┘

交互:
• 拖拽手柄: 圆形(直径24px)，hover放大到28px
• 拖拽中: 手柄变金色(#D4A574)，出现实时百分比气泡
• 释放: 自动吸附到最近的5%刻度(bpm: 0/5/10/.../100)
• 键盘: ←→ 微调±1%，Shift+←→ 微调±5%
• 双击: 手动输入数值
```

### 2.2 双因子拖拽联动 (一个增加→另一个自动减少)

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  MOM_12M                           [50%]          │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━○────              │
│                                                   │
│  GROWTH                             [30%]          │
│  ●━━━━━━━━━━━━━━━━━━━━━○───────────                │
│                                                   │
│  SECTOR_STRENGTH                    [20%]          │
│  ●━━━━━━━━━━━━━━━━━━○──────────────                │
│                                                   │
│  ────────────────────────────────────────────────  │
│  总计: 100% ✅                                      │
│                                                   │
└──────────────────────────────────────────────────┘

联动规则:
1. 拖动MOM_12M从50%→60% (+10%)
2. 自动从其他因子按比例扣除10%
   → GROWTH 30% → 24%  (-6%)
   → SECTOR 20% → 16%  (-4%)
   扣除按当前权重占比分配

锁定功能:
• 点击🔒图标 → 该因子权重锁定，不参与自动扣除
• 如果只剩一个未锁定因子 → 禁止拖拽>100%
```

### 2.3 多因子权重面板

```
┌──────────────────────────────────────────────────┐
│  🎚️ 权重调节                                       │
│  ────────────────────────────────────────────────  │
│                                                   │
│  ┌──────┬────────────────────┬───────┬───────┐    │
│  │ 因子  │       滑块         │  数值 │  锁定  │    │
│  ├──────┼────────────────────┼───────┼───────┤    │
│  │MOM   │ ●━━━━━━━━━━━━━○─   │  35% │  🔓   │    │
│  │GROWTH│ ●━━━━━━━━━━━○───   │  25% │  🔒   │    │
│  │SECTOR│ ●━━━━━━━━━━○────   │  20% │  🔓   │    │
│  │FUND  │ ●━━━━━━━━○──────   │  15% │  🔓   │    │
│  │ERN_S │ ●━━━○───────────   │  5%  │  🔓   │    │
│  └──────┴────────────────────┴───────┴───────┘    │
│                                                   │
│  总计: 100%  ✅  | 已锁定: 1个(25%)                │
│                                                   │
│  [均衡分配]  [按IC最优]  [按夏普最优]  [🧹重置]    │
│                                                   │
└──────────────────────────────────────────────────┘
```

## C.3 权重快速设定

```
快捷按钮:
[均衡分配] → 所有因子平分权重
[按IC最优] → IC最高的因子权重最大(IC加权)
[按夏普最优] → 夏普最高的因子权重最大(Sharpe加权)
[🧹重置]   → 恢复默认权重

AI辅助:
[🤖 AI智能配权重] (1.5U/次) → 输入目标(最大化夏普/最小回撤/平衡) → AI返回最优权重分配
```

## C.4 权重可视化

### 4.1 权重圆环图

```
┌──────────────────────────────────────────────────────┐
│  你当前的配置                                         │
│                                                      │
│         ┌───────────────────────┐                     │
│         │          ╭──  MOM 35%│                     │
│         │    ╭─────┤           │                     │
│         │ ╭──┤      ╰── GROWTH│                     │
│         │ │  │          25%   │                     │
│         │ │  ╰── SECTOR 20%   │                     │
│         │ ╰── FUND 15%        │                     │
│         ╰── ERN_S 5%          │                     │
│         └───────────────────────┘                     │
│                                                      │
│  风格: 🟡 偏动量     夏普预估: 0.95                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 权重历史快照

```
┌─────────────────────────────────────────┐
│  📸 权重历史                              │
│  ───────────────────────────────────────  │
│  v3 (当前): MOM 35 / GROWTH 25 / ...     │
│  v2 (昨天): MOM 30 / GROWTH 30 / ...     │
│  v1 (默认): MOM 25 / GROWTH 25 / ...     │
│                                          │
│  改动: MOM +5, GROWTH -5                 │
│                                          │
│  [恢复到 v2]  [恢复到 v1]                │
└─────────────────────────────────────────┘
```

## C.5 拖拽交互规范总结

| 属性 | 值 |
|------|-----|
| 吸附步长 | 5% (可切换1%) |
| 拖拽手柄 | 圆形24px, hover 28px |
| 拖拽中气泡 | 实时百分比+偏移位置 |
| 自动扣除 | 按当前权重占比等比例 |
| 锁定 | 🔒图标，锁定因子不参与自动扣除 |
| 键盘微调 | ←→ ±1% / Shift+←→ ±5% |
| 双击 | 直接输入数值0-100 |
| 取消 | ESC恢复拖拽前权重 |
| 动画 | ease-out 200ms |
| 触屏 | 手柄扩大到36px |
| 无障碍 | aria-valuenow/aria-valuemin/aria-valuemax |

---

## 交付清单

| # | 交付物 | 状态 | 对齐 |
|---|--------|:--:|------|
| ① | 因子婚姻冲突可视化 | ✅ | PM R187 任务① |
| ② | 🟡因子三语故事(31+4=35因子) | ✅ | PM R187 任务②+④ |
| ③ | 权重拖拽交互规范UX | ✅ | PM R187 任务③ |

**验收对照**:
- ✅ 比喻生动: 婚姻关系系统(💍互补/🤝搭配/🚶独立/⚔️冲突) + 婚后幸福指数 + 冲突解决引导
- ✅ 文案自然: 31个🟡+4降级=35因子 ×3语言=105条故事
- ✅ UX规范完整: 单因子/双联动/多面板滑块 + 快速设定 + 圆环可视化 + 历史快照 + 完整交互表

---

*QClaw(设计虾) | R187 三项交付 | 2026-06-15*
