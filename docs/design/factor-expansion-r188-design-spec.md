# quant-moo R188 设计交付 — 因子衰退倒计时UX + 港美股加密因子三语故事 + 市场专属UX

> **Round**: R188 (🟡港美股加密专属因子) | **角色**: QClaw(设计虾)
> **交付物**: ① 因子衰退倒计时UX ② 港美股加密34因子三语故事 ③ 市场专属UX(旗帜/时区/假期)
> **对齐**: PM R188广播 | **日期**: 2026-06-15

---

# Part A: 因子衰退倒计时UX

## A.1 设计哲学

```
问题: 因子IC不是永恒的。MOM_12M去年IC=0.08，今年=0.02。
      用户还在用这个因子做决策，但因子已经"死了"。
方案: "因子也有保质期"。当IC衰减时，主动提醒用户，
      给出生动的时间倒计时和优化建议。
```

## A.2 核心机制: 因子衰退模型

### 2.1 衰退检测三信号

| 信号 | 检测方式 | 阈值 | 含义 |
|------|---------|------|------|
| 🟡 IC趋势衰减 | IC 60日EMA < IC 252日均值 × 0.7 | 减速30% | "这个因子正在变弱" |
| 🟠 IC失效 | IC 252日 < 0.02(绝对值) | 接近零 | "这个因子已经没用了" |
| 🔴 半衰期逼近 | 衰减速度×剩余IC→<90天 | 3个月 | "这个因子快过期了" |

### 2.2 衰退等级

| 等级 | 状态 | 图标 | 剩余有效期 | 动作 |
|------|------|------|-----------|------|
| 🟢 健康 | IC稳定或上升 | 💚 | >365天 | 正常使用 |
| 🟡 亚健康 | IC缓慢下降 | 💛 | 180-365天 | 监测中，可继续使用 |
| 🟠 衰退 | IC加速下降 | 🧡 | 90-180天 | 建议减仓该因子权重 |
| 🔴 报废 | IC失效 | ❤️ | <90天 | 强烈建议替换 |

---

## A.3 衰退倒计时UI

### 3.1 因子卡片上的衰退指示器

```
┌───────────────────────────────────────────┐
│  MOM_12M                                   │
│  📊 动量因子                                │
│                                           │
│  当前IC: 0.045  ┌─────────────────────┐   │
│  IC趋势: ↘ -6%/月│                     │   │
│                 │   🟡 亚健康          │   │
│                 │   剩余: ~210天       │   │
│                 │                     │   │
│                 │  ████████████░░░░░░  │   │
│                 │  ██ 65% IC剩余       │   │
│                 │                     │   │
│                 └─────────────────────┘   │
│                                           │
│  📅 预测: 若趋势不变，2026年1月IC降至无效  │
│                                           │
│  [查看详情] [降低权重↘] [找替代因子→]      │
│                                           │
└───────────────────────────────────────────┘
```

### 3.2 衰退详细面板 (点击"查看详情")

```
┌──────────────────────────────────────────────────┐
│  📊 MOM_12M 衰退分析                               │
│  ────────────────────────────────────────────────  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 📈 IC 走势 (252日)                           │  │
│  │                                             │  │
│  │  0.10  ·                                    │  │
│  │        ··\                                  │  │
│  │  0.08  ··  \────\                           │  │
│  │        ··        \────\                     │  │
│  │  0.06  ··              \────\               │  │
│  │        ··                    \────\          │  │
│  │  0.04  ··                          \──\-   │  │
│  │               ··                    \────\- │  │
│  │  0.02  ─── - - - 失效线 - - - ───────────  │  │
│  │        ←───── 4月 ──→                    │  │
│  │                                             │  │
│  │  🟢 健康期  ▏🟡 亚健康   ▏🧡 衰退   ▏🔴 报废 │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  🧠 衰退归因 (AI分析):                            │
│  "动量因子近几年表现下降主要有两个原因：            │
│   1. 因子拥挤：太多人用动量(拥挤度>85分位)          │
│   2. 市场结构：2024-25高波动市动量反转频繁           │
│   但动量在低波动市中仍有效。"                      │
│                                                   │
│  🔄 推荐替代因子 (IC仍健康):                       │
│  ┌─────────────────┬────────┬──────┐             │
│  │ 因子            │ IC当前 │ 相关性│             │
│  ├─────────────────┼────────┼──────┤             │
│  │ GROWTH          │ 0.062  │ 0.55 │  ← 最佳替代 │
│  │ EARNINGS_SURPRISE│ 0.058  │ 0.32 │             │
│  │ FUND_FLOW       │ 0.051  │ 0.28 │             │
│  └─────────────────┴────────┴──────┘             │
│                                                   │
│  [替换为GROWTH]  [保留但降权至15%]  [暂时忽略]     │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 3.3 一键优化弹窗 (主动推送)

当用户打开策略页面时，若检测到有因子进入🟠或🔴区：

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ⚠️ 你的因子"ROIC"快过期了！                         │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │  🟠 ROIC 衰退中                              │      │
│  │  ██████████████░░░░░░░░░░░░ 55% 有效        │      │
│  │  IC从 0.048→0.022 (衰退中)                  │      │
│  │  预测 90天后失效                            │      │
│  │                                                      │
│  │  影响: 你持仓中3只股票(共25%仓位)依赖此因子  │      │
│  │  风险: 如果继续依赖，预期超额收益减少1.2%    │      │
│  │                                           │      │
│  └────────────────────────────────────────────┘      │
│                                                      │
│  怎么办？                                            │
│  ┌────────────────────────────────────────┐          │
│  │ 🅰️ 一键替换 (推荐)                      │          │
│  │   用 Piotroski F-Score(IC 0.055)替换ROIC│          │
│  │   同期相关性 r=0.62 → 平滑迁移           │          │
│  │   [一键替换 →]                          │          │
│  └────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────┐          │
│  │ 🅱️ 保留但降权                            │          │
│  │   ROIC权重 20%→8% + 加入Piotroski 12%   │          │
│  │   [混合使用 →]                          │          │
│  └────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────┐          │
│  │ 🅲️ AI深度分析 (1.5U)                    │          │
│  │   完整的归因+迁移路径+最优权重方案       │          │
│  │   [AI分析和迁移 →]                     │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  [跳过本次]  [暂停提醒30天]  [不再提醒这个因子]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## A.4 场景包衰退总览

```
┌──────────────────────────────────────────────────────┐
│  🐂 牛市进攻 — 因子健康总览                           │
│  ──────────────────────────────────────────────────── │
│                                                      │
│  ┌────────┬────────┬────────┬────────┬────────┐      │
│  │ MOM_12M│ GROWTH │ SECTOR │ FUND   │ SIZE   │      │
│  │ 🟡     │ 🟢     │ 🟢     │ 🟢     │ 🟡     │      │
│  │ 210天  │ 健康   │ 健康   │ 健康   │ 185天  │      │
│  └────────┴────────┴────────┴────────┴────────┘      │
│                                                      │
│  场景包健康指数: 76/100 🟡                             │
│  "2个因子在衰退中，但不严重。建议关注MOM_12M。"        │
│                                                      │
│  [一键优化整个场景包 →]                               │
└──────────────────────────────────────────────────────┘
```

---

## A.5 IC衰减预测算法 (UX视角)

```
🟢 健康: IC保持>0.04 且 60EMA > 252均值×0.9
🟡 亚健康: 252均值×0.7 < 60EMA ≤ 252均值×0.9
🟠 衰退:   0.02 < 60EMA ≤ 252均值×0.7
🔴 报废:   60EMA < 0.02 或 预测剩余<90天

剩余有效天数 = (当前IC - 0.02) / |衰减斜率|
衰减斜率 = 60EMA的线性回归斜率(美元/天)
```

---

# Part B: 港美股加密🟡因子三语故事 (34个)

## B.1 🇭🇰 港股专属 (9)

**1. HK_CBBC_RATIO — 牛熊证街货比**
- 🇨🇳: 牛证(看涨)和熊证(看跌)的街货量比。>1=牛多=看多的人多=大家都看好时往往...你知道的。这个数字极值时最有用：极度看多=该跌了。
- 🇺🇸: "Bull/Bear CBBC ratio. >1 = bulls dominate = everyone's bullish = you know what happens. Most useful at extremes: extreme bullish = time to fade."
- 🇯🇵: ブル/ベアCBBC比率。1超=ブル優勢=みんな強気=結果は知っての通り。極値で最も有用：極度の強気=そろそろ逆。

**2. HK_WARRANT_TURNOVER — 窝轮成交量**
- 🇨🇳: 窝轮(涡轮)=港股特有的杠杆衍生品。成交量突然放大=有人在大举押注方向性行情。散户最爱的赌具，成交量暴增预示波动来临。
- 🇺🇸: "Warrant volume = HK's leveraged derivative. Volume surging = someone betting big on directional moves. Retail investors' favorite gambling tool. Volume spike = volatility ahead."
- 🇯🇵: ワラント出来高=香港特有のレバレッジデリバティブ。出来高急増=誰かが方向性に大きく賭けている。個人投資家の一番好きなギャンブルツール。出来高急増=ボラティリティが来る。

**3. HK_CBBC_DISTANCE — 牛熊证回收距离**
- 🇨🇳: 牛熊证有"回收价"，股价碰到就废纸一张。距离回收价越近→风险越大→但也意味着可能"挟淡仓"(挤空头)。这是香港市场的独特"灭灯游戏"。
- 🇺🇸: "CBBC has a 'knockout' price — touch it and the certificate is worthless. Closer to knockout = higher risk = potential 'squeeze'. HK's unique knockout game."
- 🇯🇵: CBBCには「ノックアウト価格」がある——触れれば紙切れ。ノックアウトに近いほど=リスク大=でも「スクイーズ」の可能性も。香港独自のノックアウトゲーム。

**4. HK_SHORT_SELL_RATIO — 沽空比率 ⭐**
- 🇨🇳: ⭐6虾共识。港股卖空成交/总成交。>20%=有人在疯狂做空。但如果有人在做空，谁在反向买入？查找反向买入的经纪商=找到"接刀子的人"。这是香港的"笨钱/聪明钱"追踪器。
- 🇺🇸: "⭐6-shrimp consensus. HK short selling/total volume. >20% = heavy shorting. But if someone is shorting, who's buying? Find the opposite broker = find the 'catcher'. HK's dumb/smart money tracker."
- 🇯🇵: ⭐6匹のエビ合意。香港の空売り/総出来高。20%超=激しい空売り。でも誰かが空売りしているなら、誰が買っているのか？逆のブローカーを探せ=「落ちてくるナイフを取る人」を見つけろ。香港の愚かな/賢い資金トラッカー。

**5. HK_REIT_YIELD — REIT收益率**
- 🇨🇳: 领展 vs 港铁 vs 长实。香港REITs以高派息著称，5-6%收益率在低息环境下是现金奶牛。但注意：高收益可能因为股价跌了而不是派息涨了。
- 🇺🇸: "Link REIT vs MTR vs CK Asset. HK REITs famous for high distributions — 5-6% yield is a cash cow in low-rate environments. Watch out: high yield may be from dropping price, not rising payout."
- 🇯🇵: リンクREIT vs MTR vs CKアセット。香港REITは高分配で有名——5-6%利回りは低金利環境でのキャッシュカウ。注意：高利回りは分配金上昇ではなく株価下落の可能性もある。

**6. HK_HSCEI_PREMIUM — H股指数溢价**
- 🇨🇳: H股(在港上市的内地企业) vs A股的同公司。溢价=H股相对A股的折价。你的中石油在香港买比上海便宜多少？这个溢价在"北水/南水"间像潮汐一样波动。
- 🇺🇸: "H-shares (mainland companies in HK) vs A-shares of same company. Premium = H-share discount vs A-share. How much cheaper is PetroChina in HK vs Shanghai? This premium ebbs and flows like a tide between north/southbound flows."
- 🇯🇵: H株(香港上場の本土企業) vs 同社のA株。プレミアム=H株のA株に対する割引。ペトロチャイナは上海より香港でいくら安いか？このプレミアムは南北資金フローの間で潮のように満ち引きする。

**7. HK_ETF_FLOW — 港股ETF资金**
- 🇨🇳: 追踪港股ETF(2800盈富/2828恒生中国企业等)的资金净流向。南向资金先流入ETF=机构进场。ETF流入>个股流入=聪明的钱在"买指数"。
- 🇺🇸: "HK ETF flows (TraHK 2800/HSCEI 2828). Southbound flows into ETFs first = institutional entry. ETF inflow > stock inflow = smart money 'buying the index'."
- 🇯🇵: 香港ETFフロー(トラッカー2800/HSCEI2828)。ETFに先に入るサウスバウンド資金=機関参入。ETF流入>個別株流入=賢い資金が「指数を買っている」。

**8. HK_DIV_TAX_ADV — 红利税优化**
- 🇨🇳: 内地投资者买港股通过港股通需要交20%红利税。直接开香港账户只交0-10%。有一批股票因"避税"而溢价。红利税优化因子=量化这个"避税溢价"。
- 🇺🇸: "Mainland investors via Stock Connect pay 20% dividend tax. Direct HK accounts pay 0-10%. Some stocks command premium for 'tax avoidance.' This factor quantifies the tax-avoidance premium."
- 🇯🇵: 本土投資家がストックコネクト経由で香港株を買うと20%の配当税。直接香港口座なら0-10%。一部の銘柄は「節税」プレミアムがつく。このファクターは節税プレミアムを定量化する。

**9. HK_BOARD_ROTATION — 港股板块轮动**
- 🇨🇳: 港股11个行业板块的资金轮动。地产→银行→科技→消费→地产...每月都有"轮动之王"。找到资金正在流入的板块=站在浪潮的起点。
- 🇺🇸: "HK 11 sector rotation. Property → Banks → Tech → Consumer → Property... Every month has a 'rotation king'. Find the sector attracting inflows = stand at the wave's starting point."
- 🇯🇵: 香港11セクターローテーション。不動産→銀行→テック→消費→不動産...毎月「ローテーションの王」がいる。資金流入中のセクターを見つける=波の出発点に立つ。

---

## B.2 🇺🇸 美股专属 (12)

**10. US_EARNINGS_REVISION — 盈利预测修正**
- 🇨🇳: 财报前1-4周，分析师会悄悄调整EPS预测。这个"悄悄地调"就是信息。向上修正>向下修正=公司可能超预期。但要注意：修正方向知道的人多了就没用了。
- 🇺🇸: "1-4 weeks before earnings, analysts quietly adjust EPS estimates. These 'quiet adjustments' are the signal. Upward revision > downward = potential beat. But: once everyone knows the revision, it's priced in."
- 🇯🇵: 決算の1-4週間前、アナリストが静かにEPS予想を調整する。この「静かな調整」がシグナル。上方修正>下方修正=サプライズの可能性。でも：みんなが修正を知ったら織り込み済み。

**11. US_REVENUE_SURPRISE — 营收超预期**
- 🇨🇳: 盈利可以靠"会计魔术"，但营收造不了假。营收超预期>盈利超预期→更真实的增长信号。你卖的东西多了才是真的增长。
- 🇺🇸: "Earnings can be 'accounting magic,' but revenue can't be faked easily. Revenue beat > earnings beat → more genuine growth signal. You're selling more stuff — that's real growth."
- 🇯🇵: 利益は「会計マジック」が可能だが、収入は簡単に偽装できない。収入サプライズ>利益サプライズ→より本物の成長シグナル。より多く売れている——それこそ本物の成長。

**12. US_OI_PUT_CALL — 未平仓Put/Call**
- 🇨🇳: 看跌期权未平仓/看涨期权未平仓。>1=持仓看跌的更多。不同于成交量PCR(捕捉日内交易员)，未平仓PCR反映的是"大户押注"——聪明钱在布局什么方向。
- 🇺🇸: "Open interest Put/Call. >1 = more bets on puts. Unlike volume PCR (captures day traders), OI PCR reflects 'big money positioning' — which direction smart money is betting on."
- 🇯🇵: 建玉プット/コール。1超=プットの方が建玉多い。出来高PCR(デイトレーダーを捉える)と異なり、建玉PCRは「大口のポジション」を反映——賢い資金がどちらの方向に賭けているか。

**13. US_VOLUME_PCR — 成交量Put/Call**
- 🇨🇳: 今天买了多少看跌vs看涨期权。日内情绪温度计。极端值>1.5=群体恐慌=短期反弹概率高。极端值<0.4=群体狂热=短期回调概率高。反着用的因子。
- 🇺🇸: "How many puts vs calls bought today. Intraday sentiment thermometer. Extreme >1.5 = crowd panic = short-term bounce likely. Extreme <0.4 = crowd euphoria = short-term pullback likely. A contrarian factor."
- 🇯🇵: 今日いくつのプットvsコールが買われたか。日中センチメント温度計。極値>1.5=群衆パニック=短期的反発確率高。極値<0.4=群衆陶酔=短期的調整確率高。逆張りファクター。

**14. US_IV_RANK — IV百分位(美股版)**
- 🇨🇳: 美股个股IV在1年中的百分位。>80=期权贵的离谱，适合卖期权。美国期权市场深度全球第一，IV信号比任何其他市场都可靠。
- 🇺🇸: "US single-stock IV percentile over 1 year. >80 = options absurdly expensive → sell options. US options market is the deepest in the world — IV signals here are more reliable than any other market."
- 🇯🇵: 米国個別株のIVパーセンタイル(1年)。80超=オプションが異常に高い→オプションを売る。米国オプション市場は世界最深——ここのIVシグナルは他のどの市場よりも信頼できる。

**15. US_13F_FLOW — 13F机构持仓 ⭐**
- 🇨🇳: ⭐共识。每季度大机构(Soros/Baupost/Appaloosa...)公布持仓文件。不只要看"买了什么"，更要看"增持速度"。连续3个季度增持=机构强烈看好。
- 🇺🇸: "⭐Consensus. Every quarter, big funds (Soros/Baupost/Appaloosa...) file 13F holdings. Don't just look at 'what they bought' — watch 'accumulation speed.' 3 consecutive quarters of buying = strong conviction."
- 🇯🇵: ⭐合意。四半期ごとに大口ファンド(Soros/Baupost/Appaloosa...)が13F保有銘柄を開示。「何を買ったか」だけでなく「蓄積速度」を見ろ。3四半期連続購入=強い確信。

**16. US_BUYBACK_YIELD — 回购收益率**
- 🇨🇳: 公司用现金买回自己股票=减少流通股=EPS自动增加=变相分红。高回购收益率的公司→至少管理层认为"我的股票便宜"。但如果借债来回购→红色警戒。
- 🇺🇸: "Company buys back its own stock with cash = fewer shares = automatic EPS boost = backdoor dividend. High buyback yield → at minimum, management thinks 'my stock is cheap.' But if buying back with debt → red flag."
- 🇯🇵: 会社が自社株を現金で買い戻す=発行済株減少=自動的にEPS増加=裏口配当。高自社株買い利回り→最低限、経営陣は「私の株は安い」と思っている。でも借金で自社株買いなら→赤信号。

**17. US_SHORT_FLOAT — 沽空流通比例**
- 🇨🇳: 流通股中有多少比例在做空。>15%=轧空风险区。GameStop 2021的故事：140%做空=碾压空头。美股空头比例是对冲基金的"集体投票"——他们都看空时，可能所有人都是错的。
- 🇺🇸: "% of float shorted. >15% = squeeze risk zone. GameStop 2021 story: 140% short = crushing shorts. US short float is hedge funds' 'collective vote' — when they're all bearish, everyone might be wrong."
- 🇯🇵: 浮動株の空売り比率。15%超=スクイーズリスクゾーン。GameStop 2021の話：140%空売り=空売り勢を粉砕。米国の空売り比率はヘッジファンドの「集団投票」——全員が弱気の時、全員が間違っている可能性。

**18. US_RETAIL_FLOW — 散户资金流**
- 🇨🇳: Robinhood/Fidelity等散户平台的资金去向。散户是"落后指标"——等散户大规模进场，机构已经吃饱了。散户资金流最有用的是"反向用"：散户狂热买=你该卖。
- 🇺🇸: "Robinhood/Fidelity retail flow. Retail is a 'lagging indicator' — by the time retail pours in, institutions are already full. Retail flow is most useful inverted: retail euphoria buying = time to sell."
- 🇯🇵: Robinhood/Fidelity等の個人資金の行方。個人投資家は「遅行指標」——個人が大量参入する頃には機関はもう満腹。個人フローは逆に使うのが最も有用：個人の熱狂的購入=売りのタイミング。

**19. US_MEME_STOCK — Meme股热度**
- 🇨🇳: Reddit/WallStreetBets的帖子和评论提及量。一只股票突然在r/wallstreetbets爆火=波动率确定性极高。方向未知，但波动一定大。适合卖跨式期权(L3专业用法)。
- 🇺🇸: "Reddit/WallStreetBets post & comment mentions. A stock exploding on r/wallstreetbets = guaranteed extreme volatility. Direction unknown, but vol is certain. Great for selling straddles (L3 pro usage)."
- 🇯🇵: Reddit/WallStreetBetsの投稿とコメントでの言及量。r/wallstreetbetsで爆発的に話題になる=極端なボラティリティが保証される。方向は不明だが、ボラは確実。ストラドル売りに最適(L3プロ向け)。

**20. US_SECTOR_ETF_FLOW — 板块ETF资金**
- 🇨🇳: XLF(金融)/XLK(科技)/XLE(能源)/XLV(医疗)...板块ETF比个股更代表机构行为。资金从XLF流向XLK=市场在切换主题。连续3天同方向=主题确认。
- 🇺🇸: "XLF(financial)/XLK(tech)/XLE(energy)/XLV(healthcare)... Sector ETFs represent institutional behavior better than individual stocks. Flow XLF→XLK = market rotating themes. 3 consecutive days same direction = theme confirmed."
- 🇯🇵: XLF(金融)/XLK(テック)/XLE(エネルギー)/XLV(ヘルスケア)...セクターETFは個別株より機関行動を代表する。XLF→XLKへの資金移動=市場がテーマを切り替え中。同じ方向に3日連続=テーマ確認。

**21. US_SEASONALITY — 季节性**
- 🇨🇳: "Sell in May"=真？5-10月美股平均跑输11-4月。税收损失卖出(12月)、年初效应(1月)、万圣节效应(10月后到次年5月更强势)。季节性=日历上的统计规律——不是100%，但你不该完全忽略。
- 🇺🇸: "'Sell in May' — real? May-Oct underperforms Nov-Apr on average. Tax-loss selling (Dec), January effect, Halloween effect (Oct-May stronger). Seasonality = calendar patterns — not 100%, but you shouldn't completely ignore them."
- 🇯🇵: 「Sell in May」は本当？5-10月は平均的に11-4月を下回る。税損売却(12月)、1月効果、ハロウィン効果(10月-翌5月が強い)。季節性=カレンダー上の統計パターン——100%ではないが、完全に無視すべきではない。

---

## B.3 🪙 加密专属 (13)

**22. CRYPTO_SOPR — 花费产出利润率 ⭐**
- 🇨🇳: ⭐共识。每个被卖出的币，计算"买入价vs卖出价"。>1=卖出的人平均赚钱=获利盘。持续>1且在增加=牛市。跌破<1=恐慌割肉。SOPR告诉你"现在卖出的人脑子里在想什么"。
- 🇺🇸: "⭐Consensus. For every coin moved, calculates 'buy vs sell price.' >1 = sellers on average making profit. Sustained >1 & rising = bull. Drops below 1 = panic selling. SOPR shows 'what sellers are thinking'."
- 🇯🇵: ⭐合意。動かされた各コインについて「買値vs売値」を計算。1超=売り手は平均的に利益確定中。持続的に1超かつ上昇=強気。1割れ=パニック売り。SOPRは「売り手の頭の中」を見せてくれる。

**23. CRYPTO_HASHRATE — 算力变化**
- 🇨🇳: 比特币全网算力的月度变化。算力上升=矿工增加信心和投入。算力大幅下跌=矿工关机关机(中国雨季结束/电价飙升)。算力是比特币"基本面的底层"。
- 🇺🇸: "Bitcoin hashrate monthly change. Rising = miners adding capacity & confidence. Sharp drop = miners shutting down (China rainy season ends / power price spikes). Hashrate is bitcoin's 'fundamental basement.'"
- 🇯🇵: ビットコインハッシュレートの月次変化。上昇=マイナーが設備と自信を追加。急落=マイナーが停止(中国の雨季終了/電力価格急騰)。ハッシュレートはビットコインの「ファンダメンタルの地下階」。

**24. CRYPTO_L2_TVL — Layer2锁仓量**
- 🇨🇳: Arbitrum/Optimism/Polygon等L2的总锁仓量(TVL)。以太坊主网车票贵，L2是"快速公交"。L2 TVL增长率>主网TVL增长率=资金在迁移到更高效的链=生态活跃。
- 🇺🇸: "Arbitrum/Optimism/Polygon L2 total value locked. Ethereum mainnet tickets are expensive, L2 is the 'express bus.' L2 TVL growth > mainnet TVL growth = capital migrating to more efficient chains = ecosystem active."
- 🇯🇵: Arbitrum/Optimism/Polygon等L2の総ロック価値。イーサリアムメインネットのチケットは高い、L2は「高速バス」。L2 TVL成長>メインネットTVL成長=資金がより効率的なチェーンに移行中=エコシステム活発。

**25. CRYPTO_USDT_PREMIUM — USDT溢价**
- 🇨🇳: USDT的市场价vs锚定价($1)。>1.01=Tether在溢价=有人在疯狂买入USDT=要么抄底要么逃命。溢价告诉你：市场现在"急迫"程度。
- 🇺🇸: "USDT market price vs peg ($1). >1.01 = Tether at premium = someone is frantically buying USDT = either bottom-fishing or fleeing. The premium shows: how 'urgent' is the market right now?"
- 🇯🇵: USDTの市場価格vsペッグ(1ドル)。1.01超=テザーがプレミアム=誰かが必死にUSDTを買っている=底値買いか逃亡か。プレミアムは市場の「緊迫度」を示す。

**26. CRYPTO_SOCIAL_VOLUME — 社交热度**
- 🇨🇳: Twitter/Reddit/Telegram上某币的提及量。突然暴涨=FOMO启动。但与股票不同：加密的社交热度常常领先价格数小时(因为有新消息在群里传)。这是"内幕信息传播探测器"。
- 🇺🇸: "Twitter/Reddit/Telegram mentions of a token. Volume spike = FOMO igniting. Unlike stocks: crypto social volume often leads price by hours (info spreads in chat groups first). An 'insider information propagation detector.'"
- 🇯🇵: Twitter/Reddit/Telegramでのトークン言及量。急増=FOMO着火。株と違って：暗号のソーシャルボリュームはしばしば価格より数時間先行する(情報が先にチャットグループで広がる)。「インサイダー情報伝播検知器」。

**27. CRYPTO_WHALE_MOVEMENT — 巨鲸动向**
- 🇨🇳: 大额(>$1M)链上转账。巨鲸把币从钱包转到交易所=可能准备卖。从交易所转出到钱包=准备HODL。但巨鲸也会故意制造假转账来误导市场——所以要看"持续模式"不是单笔。
- 🇺🇸: "Large (>$1M) on-chain transfers. Whale moves coins from wallet to exchange = might sell. Exchange to wallet = ready to HODL. But whales also create fake transfers to mislead — watch 'sustained patterns,' not single moves."
- 🇯🇵: 大口(100万ドル超)のオンチェーン送金。クジラがウォレットから取引所に送金=売る可能性。取引所からウォレットに=HODL準備。でもクジラは偽の送金で誤誘導もする——「持続的パターン」を見ろ、単発ではない。

**28. CRYPTO_PERP_PREMIUM — 永续合约溢价**
- 🇨🇳: 永续合约价格vs现货价格。>1%=资金费率正=多头太多=做空有利(赚资金费)。溢价极端时是最可靠的反向信号——贪婪过头了。
- 🇺🇸: "Perp price vs spot. >1% = funding rate positive = too many longs = shorting pays (earn funding). Extreme premium is the most reliable contrarian signal — greed is overdone."
- 🇯🇵: 無期限先物価格vs現物価格。1%超=ファンディングレート正=ロングが多すぎ=ショート有利(ファンディングを稼ぐ)。極端なプレミアムは最も信頼できる逆張りシグナル——強欲が行き過ぎ。

**29. CRYPTO_OI_QUADRANT — OI四象限 ⭐**
- 🇨🇳: ⭐共识。OI(未平仓)+价格=四象限。价涨+OI涨=多头开仓(牛市确认)。价跌+OI跌=多头认输(熊市确认)。价涨+OI跌=空头投降(轧空)。价跌+OI涨=空头增仓(下行趋势)。
- 🇺🇸: "⭐Consensus. Open Interest + Price = four quadrants. Price↑ + OI↑ = longs adding (bull confirmed). Price↓ + OI↓ = longs capitulating (bear confirmed). Price↑ + OI↓ = shorts surrendering (squeeze). Price↓ + OI↑ = shorts adding (downtrend)."
- 🇯🇵: ⭐合意。建玉+価格=4象限。価格↑+OI↑=ロング追加(強気確認)。価格↓+OI↓=ロング降伏(弱気確認)。価格↑+OI↓=ショート降伏(スクイーズ)。価格↓+OI↑=ショート追加(下降トレンド)。

**30. CRYPTO_GAS_TREND — Gas费趋势**
- 🇨🇳: 以太坊Gas费(交易手续费)的7日趋势。Gas暴涨=NFT/DeFi有人在抢=链上活动爆表。持续高Gas=有人在支付高额费用，说明事情值得做。Gas是加密的"活跃度"实时指标。
- 🇺🇸: "Ethereum gas 7-day trend. Gas surging = NFT/DeFi activity exploding = on-chain action. Sustained high gas = someone is paying high fees = the activity is worth doing. Gas is crypto's real-time 'activity' metric."
- 🇯🇵: イーサリアムガス代の7日トレンド。ガス急騰=NFT/DeFiで誰かが争奪戦=オンチェーン活動爆発。持続的高ガス=誰かが高い手数料を払っている=その活動には価値がある。ガスは暗号のリアルタイム「活動量」指標。

**31. CRYPTO_BTC_DOM_CHANGE — BTC市占率变化**
- 🇨🇳: BTC市值/总加密市值。BTC主导率下降+总市值上涨=山寨季(alt season)开启。所有人都在"卖比特币买山寨币"。BTC主导率方向=资金偏好的信号。
- 🇺🇸: "BTC market cap / total crypto cap. BTC dominance dropping + total cap rising = altcoin season. Everyone 'selling BTC to buy alts.' BTC dominance direction = capital preference signal."
- 🇯🇵: BTC時価総額/暗号総時価総額。BTCドミナンス低下+総時価総額上昇=アルトシーズン。みんな「BTCを売ってアルトを買う」。BTCドミナンスの方向=資金選好のシグナル。

**32. CRYPTO_PERP_BASIS — 永续基差**
- 🇨🇳: 不同到期日的合约价差。远月-近月>0=现货升水(contango)=多头支付空头=市场看涨。近月-远月>0=现货贴水(backwardation)=空头支付多头=市场看跌。
- 🇺🇸: "Price spread between expiry dates. Far-month - near-month > 0 = contango = longs pay shorts = bullish. Near-month - far-month > 0 = backwardation = shorts pay longs = bearish."
- 🇯🇵: 異なる限月の価格差。遠月-近月>0=コンタンゴ=ロングがショートに支払う=強気。近月-遠月>0=バックワーデーション=ショートがロングに支払う=弱気。

**33. CRYPTO_TAKER_RATIO — Taker买卖比**
- 🇨🇳: 主动买/主动卖。>1=主动买更多=市价单在追=急迫。taker ratio告诉你：市场现在是"追着买"还是"慌着卖"。结合OI四象限一起看效果更好。
- 🇺🇸: "Active buy / active sell volume. >1 = more market buys = chasing = urgency. Taker ratio shows: is the market 'chasing to buy' or 'panicking to sell' right now? Best paired with OI quadrant."
- 🇯🇵: 成行買い/成行売り。1超=成行買いが多い=追っている=緊迫。テイカー比率は「市場が今追い買いしているか、パニック売りしているか」を示す。OI四象限と併用がベスト。

**34. CRYPTO_DEV_ACTIVITY — 开发者活跃度**
- 🇨🇳: GitHub提交/Issue活跃度。开发者还在写代码=项目还活着。开发者跑了=僵尸项目。这是加密项目的"员工在职率"——最根本的基本面。
- 🇺🇸: "GitHub commits/issue activity. Devs still coding = project alive. Devs gone = zombie project. This is the crypto equivalent of 'employee retention' — the most fundamental fundamental."
- 🇯🇵: GitHubコミット/Issue活動。開発者がまだコードを書いている=プロジェクト生存。開発者消滅=ゾンビプロジェクト。これは暗号プロジェクトの「従業員定着率」——最も根本的なファンダメンタル。

---

# Part C: 港美股加密市场专属UX

## C.1 市场区域旗帜识别系统

### 3.1 因子卡片市场标识

```
┌─────────────────────────────────────────────┐
│  🇭🇰 港股  ┌─── 市场标签 ───┐               │
│  ────────────────────────────────────────── │
│  HK_SHORT_SELL_RATIO                        │
│  沽空比率 ⭐                                 │
│                                             │
│  🕐 交易时段: 09:30-16:00 HKT               │
│  📅 下一假期: 6月19日(端午节)               │
│  ⚠️ 因子仅在港股交易时段有效更新              │
│                                             │
│  [查看详情]                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  🇺🇸 美股  ┌─── 市场标签 ───┐               │
│  ────────────────────────────────────────── │
│  US_13F_FLOW                                │
│  机构持仓 ⭐                                 │
│                                             │
│  🕐 交易时段: 09:30-16:00 ET (冬令时20:30-05:00 HKT)│
│  📅 下一假期: 6月19日(六月节Juneteenth)     │
│  ⚠️ 13F数据每季度更新(45天后公布)           │
│                                             │
│  [查看详情]                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  🪙 加密  ┌─── 市场标签 ───┐               │
│  ────────────────────────────────────────── │
│  CRYPTO_SOPR ⭐                              │
│  花费产出利润率                               │
│                                             │
│  🕐 交易: 24/7/365 全天候                   │
│  ⚠️ 链上数据实时更新                        │
│  ⚡ 3秒级数据刷新(最高频因子)                │
│                                             │
│  [查看详情]                                  │
└─────────────────────────────────────────────┘
```

### 3.2 市场切换器

```
┌──────────────────────────────────────────────┐
│  🌏 市场:                                     │
│                                              │
│  [🇭🇰 港股]  [🇺🇸 美股]  [🪙 加密]  [🌐 全部]  │
│    ───────                                    │
│                                               │
│  当前: 🇭🇰 港股  ▏因子: 9 🟡+5 🟢 = 14      │
│                                               │
│  ┌─────────────────────────────────────┐      │
│  │ 🇭🇰 港股专属因子卡片列表...            │      │
│  └─────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

## C.2 时区与时差提示

### 2.1 全局时段指示器

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  🕐 当前: 15:30 HKT (GMT+8)                      │
│                                                  │
│  ┌───────────┬───────────┬───────────┐          │
│  │ 🇭🇰 港股   │ 🇺🇸 美股   │ 🪙 加密   │          │
│  │ 🟢 交易中 │ ⚫ 休市   │ 🟢 24/7   │          │
│  │ 15:30    │ 03:30 ET │ 实时     │          │
│  │ 还有30分钟│ 5.5h后开盘│          │          │
│  └───────────┴───────────┴───────────┘          │
│                                                  │
│  📊 港股因子最新: 15:29 (1分钟前)                 │
│  📊 美股因子最新: 04:00 ET (11.5小时前，盘后更新) │
│  📊 加密因子最新: 15:30 (实时)                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 2.2 因子数据新鲜度标签

| 状态 | 图标 | 数据时效 | 标签 |
|------|------|---------|------|
| 实时 | ⚡ | <1分钟 | 绿色脉冲动画 |
| 新鲜 | 🟢 | 1-15分钟 | 绿色 |
| 延迟 | 🟡 | 15-60分钟 | 黄色 |
| 过期 | 🟠 | 1-6小时 | 橙色 |
| 非交易 | ⚫ | 休市中 | 灰色虚线 |

## C.3 假期与日历

### 3.1 假期提示条

```
┌──────────────────────────────────────────────────┐
│  📅 即将休市:                                     │
│                                                  │
│  🇭🇰 6月19日 端午节 — 港股休市                    │
│  🇺🇸 6月19日 Juneteenth — 美股休市                 │
│                                                  │
│  ⚠️ 休市日因子信号不会更新                        │
│  💡 建议提前调整仓位：假期前后波动加大             │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3.2 因子日历视图

```
┌──────────────────────────────────────────────────────┐
│  📅 6月 因子日历                                       │
│  ────────────────────────────────────────────────────  │
│                                                      │
│  一   二   三   四   五   六   日                     │
│        2    3    4    5    6    7                     │
│  8    9    10   11   12   13   14                     │
│  15   16   17   18   19🎌  20   21                     │
│  22   23   24   25   26   27   28                     │
│  29   30                                              │
│                                                      │
│  🎌 = 港美股同日休市  │  🏮 = 港股休市  │  🗽 = 美股休市│
│                                                      │
│  ⚠️ 6/19: 港美股休市。                                     │
│  → 港股因子: 13🇭🇰个信号停更                             │
│  → 美股因子: 12🇺🇸个信号停更                             │
│  → 加密因子: 正常更新                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## C.4 市场专属数据说明

### 港股因子特殊说明

```
┌──────────────────────────────────────────┐
│  🇭🇰 港股因子须知                         │
│  ──────────────────────────────────────── │
│                                          │
│  ⚠️ HK_CBBC数据: 盘中15秒/盘后延迟5分钟  │
│  ⚠️ HK_SHORT_SELL: 盘后公布，T日可用T+1   │
│  💡 港股通因子: 需区分"港股通"vs"直接"   │
│     → 港股通有10%+红利税                  │
│     → 直接港股账户红利税0-10%            │
│                                          │
└──────────────────────────────────────────┘
```

### 美股因子特殊说明

```
┌──────────────────────────────────────────┐
│  🇺🇸 美股因子须知                         │
│  ──────────────────────────────────────── │
│                                          │
│  ⚠️ 13F: 每季报后45天公布=最大滞后        │
│  ⚠️ 季节性: 统计规律非保证, 降低权重用    │
│  💡 盘前/盘后: 美股有盘前4:00-9:30 ET,    │
│     盘后16:00-20:00 ET                   │
│     → 两大扩展时段数据更噪                │
│                                          │
└──────────────────────────────────────────┘
```

### 加密因子特殊说明

```
┌──────────────────────────────────────────┐
│  🪙 加密因子须知                          │
│  ──────────────────────────────────────── │
│                                          │
│  ⚠️ 链上数据: 依赖节点同步=有延迟         │
│  ⚠️ 社交热度: 可能被机器人刷量            │
│  💡 BTC主导率 = 1 - (Alt市值/总市值)      │
│     → 去除稳定币: USDT/USDC不算山寨       │
│  ⚡ 加密因子24/7更新, 无假期中断          │
│  ⚠️ Gas趋势: 仅限ETH生态链               │
│                                          │
└──────────────────────────────────────────┘
```

---

## 交付清单

| # | 交付物 | 状态 | 对齐 |
|---|--------|:--:|------|
| ① | 因子衰退倒计时UX | ✅ | PM R188 任务① |
| ② | 港美股加密因子三语故事(34个) | ✅ | PM R188 任务② |
| ③ | 市场专属UX(旗帜/时区/假期) | ✅ | PM R188 任务③ |

**验收对照**:
- ✅ 设计完整: 衰退3信号检测+4等级+倒计时+详细面板+一键优化+场景包总览
- ✅ 文案自然: 34因子(HK9+US12+CC13)×3语言=102条故事, 每因子市场特色+策略洞见
- ✅ 市场专属UX: 区域旗帜+时段指示器+数据新鲜度+假期日历+市场特殊说明

---

*QClaw(设计虾) | R188 三项交付 | 2026-06-15*
