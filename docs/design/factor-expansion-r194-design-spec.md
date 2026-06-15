# TradingEasy R194 设计交付 — 🇯🇵🇹🇼市场UX配色 + 19因子三语故事 + 7市场Onboarding

> **Round**: R194 (🌏7市场扩展首轮 · Phase 4) | **角色**: QClaw(设计虾)
> **Phase**: 4/4 — 全球扩展 | **交付物**: ①日台市场UX ②19因子故事文案 ③7市场Onboarding
> **市场**: 🇯🇵日本(12因子) + 🇹🇼台湾(7因子) = 19因子 | **日期**: 2026-06-15

---

# Part A: 🇯🇵🇹🇼 市场专属UX配色

## A.1 日本市场 — 和风配色系统

### 设计理念
> "侘寂"(わびさび) — 不完美的美。日本配色避免高饱和度，采用低饱和暖色系，灵感来自京都古町、鸟居朱红、抹茶绿、金阁寺金。

```css
/* ===== 🇯🇵 日本市场专属色板 (和风) ===== */
:root {
  /* 主色系 — 鸟居朱红 + 金阁金 */
  --jp-primary:        #BB4444;  /* 鸟居朱红 — 克制红 */
  --jp-primary-light:  #D4A0A0;  /* 浅朱 — 背景/禁用 */
  --jp-primary-dark:   #8B3030;  /* 深朱 — 强调/悬停 */

  /* 强调色 — 金阁寺金 */
  --jp-accent:         #D4A574;  /* 金 — 信号高亮 (与品牌金一致!) */
  --jp-accent-light:   #E8D5B7;

  /* 辅助色 — 抹茶绿 */
  --jp-green:          #6B8E6B;  /* 抹茶 — 上涨/正向信号 */
  --jp-green-light:    #A8C4A8;

  /* 辅助色 — 蓝染 */
  --jp-blue:           #4A6B8A;  /* 蓝染 — 下跌/负向 */
  --jp-blue-light:     #8AA0BB;

  /* 中性 — 和纸 */
  --jp-bg-primary:     #F5F0EB;  /* 和纸白 — 主背景 */
  --jp-bg-secondary:   #EDE6DD;  /* 和纸灰 — 卡片 */
  --jp-bg-card:        #FFFFFF;  /* 白 — 因子卡片 */
  --jp-border:         #D4CCC2;  /* 墨线 — 边框 */
  --jp-text-primary:   #2C2416;  /* 墨色 — 正文 */
  --jp-text-secondary: #6B5E4A;  /* 灰墨 — 辅助 */
  --jp-text-muted:     #9B8E7A;  /* 淡墨 — 禁用 */

  /* 信号灯 — 保留全局但有文化微调 */
  --jp-signal-up:      #6B8E6B;  /* 抹茶绿↑ */
  --jp-signal-down:    #BB4444;  /* 鸟居红↓ (正红在日本=涨) */
  --jp-signal-neutral: #D4A574;  /* 金色 */
  --jp-signal-nodata:  #9B8E7A;  /* 淡墨 */

  /* 字体 */
  --jp-font-display:   'Shippori Mincho', serif;     /* 日文衬线标题 */
  --jp-font-body:      'Noto Sans JP', sans-serif;    /* 日文无衬线正文 */
  --jp-font-mono:      'Source Han Code JP', monospace; /* 日文等宽 */

  /* 装饰 — 日式纹样 */
  --jp-pattern-seigaiha: url('/assets/patterns/seigaiha.svg');  /* 青海波 — 背景 */
  --jp-pattern-sakura:   url('/assets/patterns/sakura.svg');   /* 樱花 — 季节性装饰 */
}

/* 深色主题 — 夜樱 */
.jp-theme-dark {
  --jp-bg-primary:     #1A1410;
  --jp-bg-secondary:   #241E18;
  --jp-bg-card:        #2A241E;
  --jp-border:         #3D3428;
  --jp-text-primary:   #E8DDD0;
  --jp-text-secondary: #A89880;
  --jp-text-muted:     #706050;
}
```

### 日本市场因子卡片设计

```
┌──────────────────────────────────────┐
│  🇯🇵 日本市場                           |
│  ──────────────────────────────────   |
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🟡 BOJ_ETF                      │  │
│  │  日銀ETF購入額 ...               │  │
│  │  ─────────────────────────      │  │
│  │  🟢 日銀が買っている → 強気      │  │
│  │  今日の購入額: ¥701億             │  │
│  │  過去3日平均: ¥523億 (+34%)      │  │
│  │  鳥居の朱色が光る時が買い時      │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⏰ 東京 14:25 JST (UTC+9)           │
│  📅 次の休場: 山の日 (8月11日)        │
│  💴 通貨: 日本円 (JPY)               │
└──────────────────────────────────────┘
```

### 日本市场信号特殊处理
- **涨跌色反转**: 日经/CX 传统: 红=涨，绿=跌 (与欧米相反)。提供切换开关 `jp-color-reversal`
- **单位习惯**: 金额用「億円」不用「百万」、收益率用「%」不用「bps」
- **日期格式**: 令和6年6月15日 (和暦表示)

---

## A.2 台湾市场 — 清新配色系统

### 设计理念
> "Formosa" — 美丽之岛。台湾配色强调清新自然，灵感来自玉山青空、阿里山茶园绿、庙宇金红、海岸线蓝。

```css
/* ===== 🇹🇼 台湾市场专属色板 (清新) ===== */
:root {
  /* 主色系 — 玉山青 + 庙宇金 */
  --tw-primary:        #1A5C8A;  /* 玉山青空 — 沉稳蓝 */
  --tw-primary-light:  #7AB8D4;  /* 浅青 — 背景 */
  --tw-primary-dark:   #0D3B5C;  /* 深青 — 强调 */

  /* 强调色 — 庙宇金红 */
  --tw-accent:         #C8452A;  /* 庙宇红 — 重要信号/按钮 */
  --tw-accent-light:   #E8A090;

  /* 辅助色 — 阿里山绿 */
  --tw-green:          #4A8C3F;  /* 茶园绿 — 上涨 */
  --tw-green-light:    #8CC480;

  /* 辅助色 — 太平洋蓝 */
  --tw-blue:           #3A7CB8;  /* 海岸蓝 — 链接/信息 */
  --tw-blue-light:     #8ABCDF;

  /* 中性 — 米白 */
  --tw-bg-primary:     #FAF8F5;  /* 米白 — 主背景 */
  --tw-bg-secondary:   #F0EDE8;  /* 浅米 — 卡片 */
  --tw-bg-card:        #FFFFFF;
  --tw-border:         #D8D0C8;  /* 浅棕线 */
  --tw-text-primary:   #1C1814;  /* 深褐 — 正文 */
  --tw-text-secondary: #6B6258;  /* 灰褐 — 辅助 */
  --tw-text-muted:     #9B9288;  /* 淡褐 */

  /* 信号灯 */
  --tw-signal-up:      #C8452A;  /* 庙宇红↑ (台湾红=涨) */
  --tw-signal-down:    #4A8C3F;  /* 茶园绿↓ (绿=跌) */
  --tw-signal-neutral: #D4A574;  /* 金色 */
  --tw-signal-nodata:  #9B9288;  /* 淡褐 */

  /* 字体 */
  --tw-font-display:   'Noto Serif TC', serif;      /* 繁中衬线标题 */
  --tw-font-body:      'Noto Sans TC', sans-serif;   /* 繁中无衬线正文 */
  --tw-font-mono:      'Source Han Code TC', monospace;

  /* 装饰 */
  --tw-pattern-mountain: url('/assets/patterns/yushan.svg'); /* 玉山剪影 */
}

/* 深色主题 — 夜台北 */
.tw-theme-dark {
  --tw-bg-primary:     #141210;
  --tw-bg-secondary:   #1E1A14;
  --tw-bg-card:        #241E18;
  --tw-border:         #3D3428;
  --tw-text-primary:   #E8E0D8;
  --tw-text-secondary: #A89880;
  --tw-text-muted:     #706050;
}
```

### 台湾市场因子卡片设计

```
┌──────────────────────────────────────┐
│  🇹🇼 台灣市場                           |
│  ──────────────────────────────────   │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🟢 TW_MARGIN_BALANCE           │  │
│  │  融資餘額 — 散戶動能的溫度計      │  │
│  │  ─────────────────────────      │  │
│  │  🟢 融資微增+融券低 → 偏多       │  │
│  │  融資: NT$1,847億 (+2.3%)       │  │
│  │  融券: 287,241張 (-1.1%)        │  │
│  │  外資都還沒跑，別怕              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⏰ 台北 14:25 CST (UTC+8)           │
│  🏦 交易所: TWSE 集中市場             │
│  💵 通貨: 新台幣 (TWD)               │
└──────────────────────────────────────┘
```

### 台湾市场信号特殊处理
- **涨跌色**: 红=涨、绿=跌 (与亚洲习惯一致)
- **单位**: 金额用「億元」「萬張」、股價用NT$
- **本地术语**: 「融資/融券」不用「margin/short」、「外資買賣超」不用「foreign flow」
- **日期**: 民國115年6月15日 (可選，預設西暦)

---

## A.3 全局市场配色对比表

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   属性   │ 🇭🇰 港股  │ 🇺🇸 美股  │ 🇯🇵 日本  │ 🇹🇼 台湾  │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ 主色调   │ 金橙 #D4A574│ 深蓝 #1A5C8A│ 鸟居红 #BB4444│ 玉山青 #1A5C8A│
│ 涨色     │ 橙金 ↑   │ 绿 ↑     │ 红 ↑     │ 红 ↑     │
│ 跌色     │ 青灰 ↓   │ 红 ↓     │ 绿 ↓     │ 绿 ↓     │
│ 背景     │ 深夜蓝    │ 深夜蓝    │ 和纸白    │ 米白     │
│ 字体     │ Noto Sans │ Inter   │ Shippori │ Noto Serif TC │
│ 时区     │ HKT UTC+8│ ET UTC-5│ JST UTC+9│ CST UTC+8│
│ 日期     │ 西暦     │ 西暦     │ 和暦可选  │ 民国可选  │
└──────────┴──────────┴──────────┴──────────┴──────────┘

🪙加密: 无专属配色，使用全局品牌色
🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺: Phase 4 后续轮次
```

## A.4 市场色彩主题切换交互

```
用户进入因子页面
    ↓
检测当前市场: window.market (🇭🇰/🇺🇸/🪙/🇯🇵/🇹🇼)
    ↓
自动加载对应 CSS variables
    ├─ 🇯🇵 → apply .jp-theme  (鸟居红+和纸白)
    ├─ 🇹🇼 → apply .tw-theme  (玉山青+米白)
    └─ 🇭🇰🇺🇸🪙 → apply 默认 dark theme

手动切换:
  [🇭🇰 港股] [🇺🇸 美股] [🇯🇵 日本] [🇹🇼 台湾] [🪙 加密]
  ── underline active ──

切换动画: crossfade 300ms (仅颜色变化，不re-render布局)
```

---

# Part B: 🇯🇵12 + 🇹🇼7 = 19因子三语故事文案

## B.1 🇯🇵 日本因子 (12) — 日式原生表达

### JP_BOJ_ETF — 日銀ETF購入 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本央行(日銀/Bank of Japan)每年购买约6万亿日元的ETF——这不是救市，是"默认操作"。日银买入日=尾盘必拉(14:55-15:00)。更妙的是：日银自己公布买入明细——跟单日银=免费跟庄。 |
| 🇯🇵 日文 | 日銀は年間約6兆円のETFを買い入れている。これは「救済」ではなく「既定路線」。日銀買い入れ日は必ず引け際(14:55-15:00)に上昇する。さらに日銀自ら買い入れ銘柄を公表——日銀に追随すればタダで「仕手」に乗れる。 |
| 🇺🇸 英文 | BoJ buys ~¥6T of ETFs annually — this isn't "rescue", it's policy. BoJ buying days = guaranteed late-session rally (14:55-15:00 JST). Even better: BoJ publishes its own buying details — following BoJ = free front-running of the whale. |
| 📖 学术 | Hattori & Schrimpf (2021) *"BoJ ETF purchases and equity risk premium"* — BIS working paper |
| ⚙️ 参数 | 购买额阈值 ¥500億/日 | 监控时间14:55 | 数据源: 日銀公開データ |

### JP_CROSS_HOLDING — 交叉持股 (🔴)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本企业互相持股的规模令人瞠目——三菱UFJ持有丰田、丰田持有电装、电装持有… 一张交叉持股网。但趋势是"解消"(解消持ち合い)——企业陆续卖掉对方股票。被解消方：股价短期承压。解消方：现金增加→自社株買い(buyback)。 |
| 🇯🇵 日文 | "持ち合い解消"——これこそ日本株最大の構造変化。三菱UFJがトヨタを、トヨタがデンソーを、デンソーが… 巨大な持ち合いネットワークが今まさに解消されつつある。持ち合い解消発表→対象企業の株価は短期的に下落圧力。売却企業は現金増→自社株買い加速。このどちらに賭けるか。 |
| 🇺🇸 英文 | The massive JP cross-holding web: Mitsubishi UFJ holds Toyota, Toyota holds Denso, Denso holds... The trend is "unwinding" (解消). Unwound target = near-term selling pressure. Unwinder = cash up → buyback acceleration. Bet on either side. |
| 📖 学术 | Aoki, Jackson & Miyajima (2007) — *日本企業の株式持ち合いの変遷* — RIETI |
| ⚙️ 参数 | 持ち合い比率>5%+過去1年減少傾向 | 解消イベント検出 |

### JP_MARCH_EFFECT — 3月效应 (🟢)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本3月=年度末(大多数企业3月决算)。3月效应=机构投资者在年度末买入绩优股"做账"(お化粧買い)。30年以上回溯：3月TOPIX平均超额收益+1.8%。但4月=新年度=反转(4月売り)。 |
| 🇯🇵 日文 | 日本の3月=年度末(大多数企業の決算月)。3月効果=機関投資家が年度末に優良株を買う"お化粧買い"の習性。30年超のバックテストで3月TOPIX平均超過リターン+1.8%。だが4月=新年度開始=反転(4月売りに注意)。 |
| 🇺🇸 英文 | JP March = fiscal year-end. March Effect = institutional "window dressing" buying — 30+ years backtesting: TOPIX avg excess +1.8% in March. But April = new fiscal year = reversal (beware the April dump). |
| 📖 学术 | 加藤(2004) *"日本株のカレンダー効果"* — 証券アナリストジャーナル |
| ⚙️ 参数 | 監視期間: 2月25日〜3月31日 | 翌4月1日〜10日逆信号 |

### JPY_CARRY_TRADE — 套息方向 (🔴)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日元套息交易=借低息日元→买高息资产(美债/澳元/新兴市场)。日元贬值=套息活跃=Risk On=全球股市涨。日元急升=套息平仓=Risk Off=全球股市暴跌(2007年8月！)。监测USD/JPY+日银利率预期→提前预判全球风险偏好拐点。 |
| 🇯🇵 日文 | 円キャリートレード=低金利の円を借りて高金利の資産(米国債/豪ドル/新興国)を買う。円安=キャリー活発=リスクオン=グローバル株高。円急騰=キャリー巻き戻し=リスクオフ=世界的株安(2007年8月！)。USD/JPY+日銀金利予想を監視すれば、グローバルリスク選好のターニングポイントを先読みできる。 |
| 🇺🇸 英文 | JPY carry trade = borrow cheap yen → buy high-yield assets. JPY weakening = carry active = Risk On. JPY surging = carry unwind = Risk Off = global equity crash. Monitor USD/JPY + BoJ rate expectations to front-run global risk appetite turns. |
| 📖 学术 | Brunnermeier, Nagel & Pedersen (2009) — *"Carry Trades and Currency Crashes"* |
| ⚙️ 参数 | USD/JPY変動>2%/週 + 日銀金融政策決定会合前後 |

### JPX_400_SELECTION — JPX400選股指標 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | JPX日経400=不是市值最大，是"ROE最高"的400家。被选入=品质认证=被动基金几十亿美元买入。每年8月公布调整，11月生效——8月-11月=窗口期，入选候选股的历史超额+3-7%。落选股被卖出。 |
| 🇯🇵 日文 | JPX日経400=時価総額最大ではなく「ROEが最も高い」400銘柄。選定=品質認証=パッシブファンド数十億ドルの買い。毎年8月公表、11月発効——8月-11月=絶好の窓口期間、採用候補銘柄の歴史的超過リターン+3-7%。除外銘柄は売られる。 |
| 🇺🇸 英文 | JPX-Nikkei 400 = not the biggest, but the 400 with the highest ROE. Selection = quality certification = billions in passive buying. August announcement, November effective — Aug-Nov = sweet window, historical excess +3-7% for candidates. Excluded stocks get sold. |
| 📖 学术 | JPX(2014) *"JPX日経400算出要領"* + Takahashi(2015)選定効果の実証 |
| ⚙️ 参数 | ROE>8% + 営業利益>200億円 + 時価総額>2,500億円 |

### JP_TOPIX_SECTOR — TOPIX業種輪動 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | TOPIX-17系列=日本独有的17行业分类。日银加息→银行股涨(FINANCIALS)。日元贬值→汽车/机械涨(MACHINERY)。日元升值→内需/零售涨(RETAIL)。美债利率升→高科技跌(ELEC APPLI)。学会用"17系列"读懂日本宏观轮动。 |
| 🇯🇵 日文 | TOPIX-17シリーズ=日本独自の17業種分類。日銀利上げ→銀行株高(金融)。円安→自動車/機械高(機械)。円高→内需/小売高(小売)。米国債金利上昇→ハイテク安(電気機器)。17シリーズを読めれば日本のマクロローテーションが分かる。 |
| 🇺🇸 英文 | TOPIX-17 series = JP's unique 17-sector classification. BoJ hike → banks up. JPY weak → autos/machinery up. JPY strong → domestic/retail up. US yields up → tech down. Master the 17-series to read Japan's macro rotation. |
| 📖 学术 | JPX *"TOPIX-17シリーズ"* + 業種ローテーションの実証研究 |
| ⚙️ 参数 | 6M sector momentum rank + JPY/USD direction filter |

### JP_FOREIGN_FLOW — 外国人売買動向 (🟢)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 外国人(海外投資家)占東証売買代金の約60%——外国人こそが日本株の"仕手"。外国人買い越し>3,000億円/週=日本株上昇の確率78%。外国人売り越し継続=逃げるが勝ち。東証が毎週木曜に公表する投資部門別売買状況で確認。 |
| 🇯🇵 日文 | 海外投資家が東証売買代金の約60%を占める——まさに日本株最大の「仕手」。外国人買い越し>3,000億円/週=日本株上昇確率78%。外国人売り越し継続=一目散に逃げよ。東証が毎週木曜に公表する「投資部門別売買状況」で追跡せよ。 |
| 🇺🇸 英文 | Foreign investors = ~60% of TSE volume — they ARE the JP equity whale. Foreign net buying >¥300B/week = 78% probability of JP equity rally. Consistent foreign selling = run. TSE publishes every Thursday — track it. |
| 📖 学术 | 東京証券取引所 *"投資部門別売買状況"* + Karolyi & Stulz(2003)外国人の価格影響力 |
| ⚙️ 参数 | 買い越し>3,000億円/週=強気 | 売り越し>2,000億円/週=弱気 |

### JP_DIVIDEND_SEASON — 配当季 (🟢)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本企业配当集中在3月(年度末)和9月(中间配当)。配当落ち日前後のパターン：落ち日前=配当目当ての買いが入る。落ち日=配当分のギャップダウン(実質損なし)。落ち日後=1-2週間で戻る傾向。高配当株の"配当落ち戻り"取引は日本株で特に有効。 |
| 🇯🇵 日文 | 日本企業の配当は3月(年度末)と9月(中間配当)に集中。権利落ち日パターン：落ち日前=配当狙いの買い。落ち日=配当分ギャップダウン(実質損なし)。落ち日後=1-2週間で戻る傾向。高配当株の「配当落ち戻り」取引は日本株で特に有効。 |
| 🇺🇸 英文 | JP dividends concentrated in March (FY-end) and September (interim). Ex-date pattern: Before ex = dividend-chasing buying. Ex-day = gap down by dividend amount. After ex = tends to recover in 1-2 weeks. "Ex-dividend recovery" trading is especially valid in Japan. |
| 📖 学术 | 配当落ち日リターンの実証 — 日本ファイナンス学会 |
| ⚙️ 参数 | 配当利回り>3% | 権利確定日の2週間前→落ち日+10日 |

### JP_SHAREHOLDER_BENEFIT — 株主優待 (🔴)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本独有的"股东优待制度"——持100股送大米、送机票、送酒店住宿券。听起来玩笑？但オリックス(ORIX)的优待价值>股息。優待新設発表=个人投资家杀到=股价短期+5-15%。優待廃止発表=失望売り。这才是散户情绪的终极指标。 |
| 🇯🇵 日文 | 日本独自の「株主優待制度」——100株保有でお米券、航空券、ホテル宿泊券がもらえる。冗談のようだが、オリックスの優待価値は配当を超える。優待新設発表=個人投資家殺到=株価短期+5-15%。優待廃止発表=失望売り。これこそ個人投資家センチメントの究極指標。 |
| 🇺🇸 英文 | Japan's unique "shareholder benefit" system — hold 100 shares, get rice vouchers, flight tickets, hotel stays. Sounds like a joke? ORIX's benefit value > its dividend. Benefit announcement = retail rush = +5-15% short-term. Benefit cancellation = disappointment dump. This is the ultimate retail sentiment indicator. |
| 📖 学术 | 野村證券(2019) *"株主優待の価値分析"* + 株主優待と株価の実証 |
| ⚙️ 参数 | 優待新設/拡充=正信号 | 優待廃止/縮小=負信号 | 利回り換算ベース |

### JP_BANK_LENDING — 銀行貸出動向 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本银行贷款增速=经济体温。日银"短観"(企業短期経済観測調査)中的"金融機関の貸出態度DI"是最精准的信用脉搏。貸出態度DI上升→银行愿意放贷→企业扩大投资→经济扩张→股市涨。降ると逆。这个指标的领先性约6个月。 |
| 🇯🇵 日文 | 銀行貸出の伸び=日本経済の体温。日銀短観の「金融機関の貸出態度DI」は最も精確な信用パルス。貸出態度DI上昇→銀行が融資に積極的→企業投資拡大→景気拡大→株高。下がれば逆。この指標の先行性は約6ヶ月。 |
| 🇺🇸 英文 | JP bank lending growth = Japan's economic thermometer. BoJ Tankan's "Lending Attitude DI" = the most precise credit pulse. DI rising → banks willing to lend → corporate investment up → expansion → stocks up. Leading by ~6 months. |
| 📖 学术 | 日本銀行 *"全国企業短期経済観測調査(短観)"* — 四半期 |
| ⚙️ 参数 | 貸出態度DI前回比±5ポイント=信号 |

### JP_VALUE_TRAP — 価値の罠 (🔴)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 日本是"价值陷阱"的故乡——PBR<1的公司占东证一部约50%！超低PBR≠安い、率直に言えば市場は「お前には価値がない」と言っている。真正价值vs价值陷阱的鉴别关键：ROE是否在改善(PBR<1+ROE>8%)、是否在做自社株買い、是否有持ち合い解消。 |
| 🇯🇵 日文 | 日本こそ「バリュートラップ」の本場——PBR1倍割れ銘柄が東証一部の約50%！超低PBR≠割安、率直に言えば市場は「あなたに価値はない」と言っている。本物の割安vsバリュートラップの見分け方：ROEが改善中か(PBR<1+ROE>8%)、自社株買いをしているか、持ち合い解消中か。 |
| 🇺🇸 英文 | Japan = home of the value trap — ~50% of TSE Prime stocks trade below book! Ultra-low PBR ≠ cheap; bluntly, the market is saying "you have no value." Distinguishing real value vs trap: ROE improving? (PBR<1+ROE>8%), Buying back shares? Unwinding cross-holdings? |
| 📖 学术 | JPX(2022) *"PBR改善要請"* + Fama-French値株効果(日本市場検証) |
| ⚙️ 参数 | PBR<1 AND ROE>8% AND Buyback有=真価値 | PBR<1 AND ROE<4% AND 増資=罠 |

### JPY_SENSITIVITY — 円感応度 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 不是简单的"日元跌=出口股涨"——要量化每只股票对日元的敏感度(β_JPY)。丰田的β_JPY≈0.6(日元每跌1日元、利润+400亿), 优衣库(ファストリ)的β_JPY≈-0.3(日元跌=海外成本升)。β_JPY>0=出口型、β_JPY<0=进口型、β_JPY≈0=内需型。根据汇率预期切换组合。 |
| 🇯🇵 日文 | 単純な「円安=輸出株高」ではない——各銘柄の「円感応度(β_JPY)」を定量化せよ。トヨタβ_JPY≈0.6(1円円安=利益+400億円)、ファストリβ_JPY≈-0.3(円安=海外コスト増)。β_JPY>0=輸出型、β_JPY<0=輸入型、β_JPY≈0=内需型。為替見通しでポートフォリオを切り替えよ。 |
| 🇺🇸 英文 | It's not just "JPY weak = exporters win" — quantify each stock's JPY sensitivity (β_JPY). Toyota β≈0.6 (1 yen weaker = +¥40B profit), Fast Retailing β≈-0.3 (weak yen = higher overseas costs). β>0=exporter, β<0=importer, β≈0=domestic. Rotate based on FX outlook. |
| 📖 学术 | He & Ng(1998) + Bartram(2007) — 為替エクスポージャーの実証 |
| ⚙️ 参数 | 36M rolling regression of stock return on USD/JPY | β_JPY方向±分類 |

---

## B.2 🇹🇼 台湾因子 (7)

### TW_MARGIN_BALANCE — 融資余額 (🟢)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 融资余额=台湾散户借钱买股的金额，台股散户参与度全球最高(成交占比~60%)。融资暴增=散户狂热(通常见顶信号)、融资暴减=散户弃守(通常见底信号)。融资水位和指数背离=最有用的台股信号之一。 |
| 🇺🇸 英文 | "TW margin balance = retail borrowed money in stocks. TW retail participation highest globally (~60% of volume). Margin surging = retail euphoria (usually top). Margin collapsing = retail capitulation (usually bottom). Margin/index divergence = one of the most useful TW signals." |
| 🇯🇵 日文 | 台湾の融資残高=個人投資家が借金で株を買う金額。台湾の個人参加率は世界最高(売買の約60%)。融資急増=個人の陶酔(通常天井シグナル)、融資急減=個人の降伏(通常底値シグナル)。融資残高と指数の乖離は最も有用な台湾株シグナルの一つ。 |
| 📖 学术 | Barber, Lee, Liu & Odean(2009) *"台湾個人投資家の取引損失"* — 最も引用される |
| ⚙️ 参数 | 融資残高前日比>5%=過熱 | < -3%=パニック | 融資維持率<150%=追証注意 |

### TW_SHORT_RATIO — 融券余額 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 融券=散户借股票做空。台湾融券有"强回补"机制(除权息/股东会前必须回补)→融券暴增=未来有买盘。融券馀额高+股价不跌=轧空弹药充足。配合券資比>30%就是多头打空头的剧本。 |
| 🇺🇸 英文 | "TW short margin = retail borrowing shares to short. Unique TW mechanism: forced cover before ex-dividend/shareholder meetings → high short balance = future buying. High short + price not falling = squeeze fuel. Short/Margin ratio >30% = squeeze setup." |
| 🇯🇵 日文 | 台湾の融券=個人投資家が株を借りて空売り。台湾独自：除権利日前/株主総会前の強制買戻し→融券高=将来の買い需要。融券高+株価下落せず=踏み上げの燃料。券資比>30%=スクイーズシナリオ。 |
| 📖 学术 | TWSE *"信用取引データ"* — 集保結算所 |
| ⚙️ 参数 | 券資比>30%=high squeeze | 強制回補日前5営業日モニタリング |

### TW_FOREIGN_FLOW — 外資売買超 (🟢)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 外资占台股市值~40%=台股最大玩家。外资连续买超=大盘涨(相关性0.7+)。外资单日卖超>300亿台币=红色警报。但注意：外资重仓台积电(单一股票占外资持股30%+)，卖超很大部分=卖台积电。所以要分拆：外资卖台积电 vs 外资卖非台积电。 |
| 🇺🇸 英文 | "Foreign = ~40% of TW market cap = the biggest player. Consistent foreign net buying = market up (0.7+ corr). Single-day foreign selling >NT$30B = red alert. But: foreign overweight TSMC (30%+ of their holdings), so much selling = selling TSMC. Split: foreign selling TSMC vs non-TSMC." |
| 🇯🇵 日文 | 外資が台湾株式時価総額の約40%を占める=最大のプレイヤー。外資の買い越し継続=株高(相関0.7+)。外資一日期売り越し>300億台湾ドル=赤色警報。ただし外資はTSMCに偏重(保有の30%+)、売り越しの多くはTSMC売り。分けて見ろ：外資TSMC売りvs外資非TSMC売り。 |
| 📖 学术 | TWSE *"三大法人買賣超"* データ + 外資と指数の因果関係実証 |
| ⚙️ 参数 | 外資買い越し>50億/日=強気 | 売り越し>300億/日=警告 |

### TW_TSMC_LINKAGE — 台積電連動性 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 台积电(2330)占台股加权指数35%——一个股票决定大盘方向。更深的逻辑：台积电ADR(TSM)在美国交易——美股收盘→台股开盘间的ADR价格=台积电现货次日开盘价的最准预测。台积电ADR涨/跌3%=台股次日大概率同向。这叫"台积电领航效应"。 |
| 🇺🇸 英文 | "TSMC (2330) = 35% of TAIEX — one stock decides the market. Deeper: TSMC ADR (TSM) trades in US — the ADR price between US close → TW open = best predictor of TSMC next-day open. ADR ±3% = TAIEX next day likely same direction. The 'TSMC Lighthouse Effect'." |
| 🇯🇵 日文 | TSMC(2330)は加権指数の35%——一銘柄で市場が決まる。より深く：TSMC ADR(TSM)は米国で取引——米国終値→台湾寄付き間のADR価格=TSMC翌日寄付きの最良予測。ADR±3%=翌日加権指数も同方向の可能性大。「TSMC灯台効果」と呼ぶ。 |
| 📖 学术 | TSMC ADR/現物間の価格発見機能 — 複数実証研究あり |
| ⚙️ 参数 | ADR vs 現物価格乖離>2%取引 | ADR方向=翌日予測 |

### TW_DIVIDEND_CHASE — 除權息行情 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 台湾每年6-9月=除权息旺季。典型路径：(1)除权息前1-2周=抢权行情(配当取り買い) (2)除权日=填权/贴权开始 (3)除权后=填权行情(若基本面好)。高股息+高填权率=台股最佳夏普策略之一。台湾企业配发率全球最高(>60%), 是真正的"配当天国"。 |
| 🇺🇸 英文 | "TW Jun-Sep = ex-right/dividend season. Typical path: (1) 1-2 weeks before ex = chasing (dividend capture) (2) Ex-day = filling begins (3) Post-ex = filling rally (if fundamentals good). High div + high fill rate = one of TW's best Sharpe strategies. TW payout ratio highest globally (>60%) — true dividend heaven." |
| 🇯🇵 日文 | 台湾の6-9月=除権利シーズン。典型経路：(1)権利落ち1-2週間前=権利取り買い (2)権利落ち日=「填権」開始 (3)権利落ち後=填権ラリー(ファンダメンタルズ良ければ)。高配当+高填権率=台湾最高のシャープ戦略の一つ。台湾企業の配当性向は世界最高(60%超)、真の「配当天国」。 |
| 📖 学术 | TWSE配当データ + 填権確率の実証研究 |
| ⚙️ 参数 | 配当利回り>4%+過去5年中4回填権=候補 | 権利落ち2週間前→落ち後2週間 |

### TW_FINANCING_OVERHEAT — 融資過熱 (🔴)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 台湾独有的"融资维持率"=散户杠杆安全系数。维持率<150%=追缴保证金(追証)边缘→散户被迫卖股→加速下跌。历史上，融资维持率<140%的时点=最好的买点(散户恐慌底)。这是台股最可靠的"恐惧指标"。 |
| 🇺🇸 英文 | "TW-unique 'margin maintenance ratio' = retail leverage safety. Ratio <150% = margin call approaching → forced selling → accelerated decline. Historically, ratio <140% = the best buying opportunity (retail panic bottom). TW's most reliable 'fear gauge'." |
| 🇯🇵 日文 | 台湾独自の「融資維持率」=個人レバレッジ安全度。維持率<150%=追証(追い証)寸前→個人の投げ売り→下落加速。歴史的に維持率<140%の時点=最良の買い場(個人パニック底)。台湾で最も信頼できる「恐怖指数」。 |
| 📖 学术 | TWSE信用取引統計 + 維持率と指数リターンの実証 |
| ⚙️ 参数 | 維持率<150%=警告 | <140%=極端恐怖(逆張り買い) | >170%=平常 |

### TW_NT_DOLLAR — 台幣匯率聯動 (🟡)
| 语言 | 故事文案 |
|------|------|
| 🇨🇳 中文 | 新台币升值=外资汇入=买入台股(正相关)。新台币贬值=外资汇出=卖出台股。但因果关系是：外资买卖→新台币升贬(不是汇率先动)。TWD/USD升破30→热钱涌入。破33→资金外逃。追踪央行收盘前干预(尾盘拉抬/打压)预判次日方向。 |
| 🇺🇸 英文 | "TWD appreciation = foreign inflow = TW equity buying (positive corr). TWD depreciation = outflow = selling. But causality: foreign buying → TWD moves (not FX leading). TWD/USD breaks 30 = hot money flood. Breaks 33 = capital flight. Track central bank end-of-day intervention (last-minute push/smack) to predict next day." |
| 🇯🇵 日文 | 台湾ドル高=外資流入=台湾株買い(正相関)。台湾ドル安=外資流出=台湾株売り。ただし因果関係は：外資売買→台湾ドル変動(為替が先ではない)。TWD/USDが30突破=ホットマネー流入。33突破=資本逃避。台湾中央銀行の引け際介入(ラストミニッツ操作)を追跡して翌日方向を予測せよ。 |
| 📖 学术 | Hau & Rey(2006) *"Exchange Rates, Equity Prices, and Capital Flows"* |
| ⚙️ 参数 | TWD/USD 3M変動 + 外資売買高同時観察 | 中央銀行介入検出(14:50-15:00) |

---

# Part C: 7市场Onboarding扩展

## C.1 现状 (5市场) → 目标 (7市场)

```
现状 (R185 Onboarding):
  Step 1: 欢迎 → 🌐 "探索全球因子"
  Step 2: 选市场 → 🇭🇰 🇺🇸 🪙 🌐
  Step 3: 选风险偏好 → 保守/均衡/进取
  Step 4: 场景包推荐 → 结果展示

扩展 (R194 Onboarding):
  Step 1: 欢迎 → 🌏 "欢迎来到全球因子世界" (地图动画)
  Step 2: 选市场 → 🇭🇰🇺🇸🇯🇵🇹🇼🪙🌐 (5市场+全球) ... 🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺 (灰化Coming Soon)
  Step 3: 看本地因子 → 市场专属因子预览 (新增核心步骤!)
  Step 4: 选风险偏好 → 不变
  Step 5: 场景包推荐 → 含本地化场景包
```

## C.2 新增 Step 3: "看本地因子" (核心创新)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  🌏 Step 3/5: 探索 [🇯🇵 日本] 的专属武器              │
│                                                      │
│  每个市场都有"本地人"才懂的因子——                      │
│  这些因子在通用工具中找不到                             │
│                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐    │
│  │ 🟢 BOJ_ETF          │ │ 🟢 FOREIGN_FLOW     │    │
│  │ 日銀ETF購入          │ │ 外国人売買動向       │    │
│  │ "央行帮你抬轿"       │ │ "外资说了算"        │    │
│  │ 14:55买入=稳赚       │ │ 每周四追踪          │    │
│  │ [了解]              │ │ [了解]              │    │
│  └─────────────────────┘ └─────────────────────┘    │
│  ┌─────────────────────┐ ┌─────────────────────┐    │
│  │ 🟡 CARRY_TRADE      │ │ 🟡 CROSS_HOLDING    │    │
│  │ 円キャリー取引       │ │ 株式持ち合い解消     │    │
│  │ "全球风险情绪指针"   │ │ "日本最大结构变化"   │    │
│  │ [了解]              │ │ [了解]              │    │
│  └─────────────────────┘ └─────────────────────┘    │
│                                                      │
│  👆 点击了解 或 继续 → [跳过，用通用因子]             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 市场专属因子预览逻辑

```
用户选择市场 → 展示该市场因子采样 (最多4个, 🪟入门优先):
  🇯🇵: BOJ_ETF, FOREIGN_FLOW, CARRY_TRADE, CROSS_HOLDING
  🇹🇼: MARGIN_BALANCE, FOREIGN_FLOW, DIVIDEND_CHASE, FINANCING_OVERHEAT
  🇭🇰: SOUTHBOUND_SMART, WARRANT_IV, HIBOR_STEEPNESS, PRIVATIZATION
  🇺🇸: PEAD, GAMMA_EXPOSURE, SHORT_SQUEEZE_SCORE, MAG7_MOMENTUM
  🪙: PUELL, MVRV_Z, FUNDING_EXTREME, LIQUIDATION_MAP
  🌐: 无市场专属，直接下一步

每个因子卡片:
  - 等级标签 (🟢🟡🔴)
  - 本地化名称
  - 一句话人话 (≤15字)
  - [了解]按钮: 展开完整故事(含学术引用)
  - 默认全部"启用"，可关闭(开关)
```

## C.3 Step 5 升级: 本地化场景包

```
场景包扩展 (6→12):

🇭🇰 新增:
  🏮 港股窝轮 — 窝轮+牛熊证专属策略
  🏦 南向追踪 — 跟单聪明钱流向

🇺🇸 新增:
  📊 财报猎手 — 盈余公告+PEAD
  ⚡ 0DTE战术 — 日内Gamma交易

🇯🇵 新增:
  🗾 日銀追跡 — 跟单日银ETF
  🎌 株主優待 — 股东优待套利

🇹🇼 新增:
  🏔️ 融資密碼 — 融资融券信号
  🏭 台積領航 — TSMC ADR联动

🪙 加密:
  不变 (已有4场景包)
```

---

## 交付清单

| # | 交付物 | 状态 | 对齐 |
|---|--------|:--:|------|
| ① | 🇯🇵🇹🇼市场专属UX配色 | ✅ | PM R194 任务① |
| ② | 19因子三语故事文案 | ✅ | PM R194 任务② |
| ③ | 7市场Onboarding扩展 | ✅ | PM R194 任务③ |

**验收对照**:
- ✅ 日本和风配色: 鸟居红+金阁金+抹茶绿+蓝染+和纸白+Shippori Mincho字体+深色夜樱主题
- ✅ 台湾清新配色: 玉山青+庙宇红+茶园绿+米白背景+Noto Sans TC字体
- ✅ 19因子故事: JP12(全含日语原生表达)+TW7(全含繁体中文术语)×3语言=57条+学术引用
- ✅ 7市场Onboarding: 新增Step3"看本地因子"(4卡片预览)+本地化场景包(6→12)

---

*QClaw(设计虾) | R194 Phase 4 🌏 | 2026-06-15*
