# R241-QClaw#1: Risk Scanner + Stock Screener — User Education
## QUANT MOO v2.7.0 NEWS INTELLIGENCE · R241

---

## 1. POSITION RISK SCANNER — USER GUIDE

### 1.1 "What Is Risk Scanning?"
```
┌──────────────────────────────────────────────┐
│  🔴 Position Risk Scanner                    │
│  Let AI watch your portfolio 24/7             │
│                                                │
│  Every 30 minutes, AI scans 23+ news sources  │
│  and checks if any breaking news could impact │
│  your holdings. When risk is detected:        │
│                                                │
│  1️⃣ Identify the news event                  │
│  2️⃣ Match to your holdings (ticker + sector) │
│  3️⃣ Estimate price impact range              │
│  4️⃣ Suggest protective actions               │
│                                                │
│  💰 1 USDT per full scan.                     │
│  First scan free for new users.               │
│                                                │
│  [Scan My Portfolio] [See Sample Scan]        │
└──────────────────────────────────────────────┘
```

### 1.2 Understanding Risk Levels
```
┌──────────────────────────────────────────────┐
│  📊 Risk Level Guide                          │
│                                                │
│  🔴 SEVERE   (>5% estimated loss)             │
│  P0 breaking news directly hits your holding. │
│  Act now: reduce position, set stop-loss, or  │
│  buy protective puts.                         │
│  Example: "SEC sues your company"              │
│                                                │
│  🟠 HIGH     (3-5% estimated loss)            │
│  P1 important news with direct impact.         │
│  Act soon: tighten stop-loss, consider hedge. │
│  Example: "EU fines your sector"              │
│                                                │
│  🟡 MODERATE (1-3% estimated loss)            │
│  P1 sector-level news, indirect impact.        │
│  Monitor: check position sizing, stay alert.  │
│  Example: "Sector-wide regulation change"     │
│                                                │
│  🟢 LOW      (<1% estimated loss)             │
│  P2 news, minor or tangential impact.         │
│  No action needed. Informational only.        │
│  Example: "Minor mention in earnings call"    │
│                                                │
│  ⚪ INFO     (no estimate)                    │
│  Neutral news mentioning your holding.        │
│  Context only. No price impact expected.      │
│                                                │
│  [Got It]                                     │
└──────────────────────────────────────────────┘
```

### 1.3 Reading a Risk Alert
```
┌──────────────────────────────────────────────┐
│  📖 How to Read a Risk Alert                  │
│                                                │
│  1. SEVERITY COLOR — Red=act now,             │
│     Orange=act soon, Yellow=monitor            │
│                                                │
│  2. IMPACT RANGE — AI's best estimate of      │
│     potential price movement. Wider ranges =  │
│     more uncertainty.                         │
│                                                │
│  3. CONFIDENCE % — How many independent       │
│     sources confirm this risk. >80% = high     │
│     reliability.                              │
│                                                │
│  4. SUGGESTED ACTIONS — Click to execute:     │
│     • Reduce position (market order)           │
│     • Set stop-loss (GTC order)               │
│     • Buy protective puts (option order)      │
│                                                │
│  ⚠️ Always verify AI suggestions with your    │
│  own analysis before trading.                 │
│                                                │
│  [Next Tip]                                   │
└──────────────────────────────────────────────┘
```

### 1.4 Auto-Scan Setup Guide
```
┌──────────────────────────────────────────────┐
│  ⚙️ Auto-Scan Settings                        │
│                                                │
│  Scan Frequency:                              │
│    ○ Every 15 min (most active traders)       │
│    ● Every 30 min (recommended)               │
│    ○ Every 1 hour                            │
│    ○ Every 4 hours                           │
│                                                │
│  Alert Channels:                              │
│    ☑ Desktop notification                     │
│    ☐ Email (daily summary only)               │
│    ☑ In-app badge                             │
│                                                │
│  Minimum Severity for Alert:                  │
│    ● 🔴 Severe only                           │
│    ○ 🟠 High and above                        │
│    ○ 🟡 Moderate and above                    │
│                                                │
│  💰 Estimated cost: ~48 USDT/day (every 30m)  │
│  Your balance: 142 USDT                       │
│                                                │
│  [Save Settings]                              │
└──────────────────────────────────────────────┘
```

---

## 2. NEWS STOCK SCREENER — USER GUIDE

### 2.1 "How to Discover Stocks from News"
```
┌──────────────────────────────────────────────┐
│  🔍 News Stock Screener                       │
│  Find stocks before they move                  │
│                                                │
│  Most screeners use price and volume. We add  │
│  a third dimension: NEWS SENTIMENT.            │
│                                                │
│  HOW IT WORKS:                                │
│  1. AI reads all 23+ news sources             │
│  2. Scores sentiment for every stock          │
│  3. You filter by sentiment + volume + price  │
│  4. Get a ranked list of opportunity stocks   │
│                                                │
│  Free to use. No subscription needed.         │
│                                                │
│  [Try a Preset] [Build Custom Screen]         │
└──────────────────────────────────────────────┘
```

### 2.2 Preset Screen Guide
```
┌──────────────────────────────────────────────┐
│  📋 6 Preset Screens Explained                 │
│                                                │
│  🚀 MOMENTUM BREAKOUT                         │
│  Surging bullish sentiment + volume spike     │
│  + price breaking up.                         │
│  When to use: Finding strong trending stocks  │
│  Risk: May chase already-extended moves       │
│                                                │
│  📉 PANIC SELL                                │
│  Crashing bearish + high news volume +        │
│  price drop >5%.                              │
│  When to use: Dip-buying on overreaction      │
│  Risk: Catching a falling knife               │
│                                                │
│  📰 NEWS CATALYST                             │
│  Exploding news volume + pre-move.            │
│  When to use: Early discovery before crowd    │
│  Risk: News may not translate to price move   │
│                                                │
│  🔍 UNDER THE RADAR                           │
│  Bullish sentiment + still low volume.        │
│  When to use: Finding hidden gems             │
│  Risk: May stay undiscovered longer           │
│                                                │
│  💎 VALUE ALERT                               │
│  Bearish sentiment + large cap + price drop.  │
│  When to use: Buying quality on bad news      │
│  Risk: News may be justified sell-off         │
│                                                │
│  🌊 SECTOR ROTATION                           │
│  Same-sector stocks with bullish trend.       │
│  When to use: Catching sector-wide moves      │
│  Risk: Rotation may reverse quickly           │
│                                                │
│  [Pick a Preset]                              │
└──────────────────────────────────────────────┘
```

### 2.3 Reading the Screener Table
```
┌──────────────────────────────────────────────┐
│  📊 How to Read Results                       │
│                                                │
│  TICKER  → Stock symbol. Click for detail.    │
│                                                │
│  SENTIMENT → AI score (-100 to +100).         │
│  🔥 = surging (>+70), 🟢 = bullish,           │
│  ⚪ = neutral, 🔴 = bearish, 💀 = crashing.   │
│                                                │
│  VOLUME SPIKE → % above 20-day average.       │
│  >300% = 🔥 strong signal. Confirms news is   │
│  actually moving the stock.                   │
│                                                │
│  PRICE CHANGE → Day change %.                 │
│  Combined with sentiment to detect divergence │
│  (e.g., bullish news but price still flat =   │
│   potential entry opportunity).               │
│                                                │
│  NEWS/24H → Article count. Shows how much     │
│  attention the stock is getting. >30 = viral. │
│                                                │
│  SCORE → Composite 0-100. Weighted:           │
│  Sentiment(40%) + Volume(30%) +               │
│  News count(20%) + Price(10%).                │
│                                                │
│  [See Example]                                │
└──────────────────────────────────────────────┘
```

### 2.4 Building a Custom Screen
```
┌──────────────────────────────────────────────┐
│  🔧 Custom Screen Builder                     │
│                                                │
│  Step 1: Choose Market                         │
│  [US ▼] [HK] [Crypto] [All]                   │
│                                                │
│  Step 2: Set Sentiment Range                   │
│  [🟢 Bullish ───●── 🔴 Bearish]              │
│  Only show: Neutral to Surging Bullish         │
│                                                │
│  Step 3: Set Volume Filter                     │
│  Min volume spike: [>200% ▼]                  │
│                                                │
│  Step 4: Set Market Cap                        │
│  [☑ Mega] [☑ Large] [☐ Mid] [☐ Small]      │
│                                                │
│  Step 5: Set Sector (Optional)                 │
│  [Tech ▼] or leave blank for all              │
│                                                │
│  Step 6: Set News Age                          │
│  [● <6h] [○ <24h] [○ <7d]                   │
│                                                │
│  [Run Screen] [Save as Preset] [Share]         │
└──────────────────────────────────────────────┘
```

### 2.5 Screener Strategy Tips
```
┌──────────────────────────────────────────────┐
│  💡 Pro Tips for News Screening               │
│                                                │
│  TIP 1: Combine sentiment + price divergence  │
│  Bullish news + flat price = possible entry.  │
│  Bearish news + flat price = possible trap.   │
│                                                │
│  TIP 2: Watch sentiment trend, not just level │
│  Sentiment swinging from -50 to +30 in 6h     │
│  matters more than steady +60 for 3 days.     │
│                                                │
│  TIP 3: Cross-reference with fundamentals     │
│  A stock with bullish news but terrible       │
│  financials may be a short-term pump.         │
│                                                │
│  TIP 4: Use time decay to your advantage      │
│  News older than 6h is already priced in.     │
│  Focus on <2h for actionable signals.         │
│                                                │
│  TIP 5: Don't ignore the score breakdown      │
│  A 90/100 score driven entirely by news count │
│  is less reliable than 85/100 from balance.   │
│                                                │
│  [Start Screening]                            │
└──────────────────────────────────────────────┘
```

---

## 3. i18n KEY LIST (60 entries)

### 3.1 Risk Scanner Education (25 keys)
| Key | EN |
|-----|-----|
| `riskedu_intro_title` | "Let AI Watch Your Portfolio 24/7" |
| `riskedu_intro_body` | "Every 30 minutes, AI scans 23+ sources and alerts you if breaking news threatens your holdings." |
| `riskedu_intro_cta` | "Scan My Portfolio" |
| `riskedu_intro_sample` | "See Sample Scan" |
| `riskedu_intro_price` | "1 USDT per scan. First scan free." |
| `riskedu_level_severe_title` | "Severe — Act Now" |
| `riskedu_level_severe_body` | "P0 news directly hits your holding. Estimated loss >5%. Reduce, stop-loss, or hedge immediately." |
| `riskedu_level_high_title` | "High — Act Soon" |
| `riskedu_level_high_body` | "P1 news with direct impact. Estimated loss 3-5%. Tighten stop-loss, consider hedging." |
| `riskedu_level_moderate_title` | "Moderate — Monitor" |
| `riskedu_level_moderate_body` | "Sector-level news, indirect impact. Estimated loss 1-3%. Check sizing, stay alert." |
| `riskedu_level_low_title` | "Low — No Action" |
| `riskedu_level_low_body` | "P2 news, minor impact. <1% estimated loss. Informational only." |
| `riskedu_level_info_title` | "Info — Context Only" |
| `riskedu_level_info_body` | "Neutral news mentioning your holding. No price impact expected." |
| `riskedu_reading_title` | "How to Read a Risk Alert" |
| `riskedu_reading_step1` | "Severity color: Red=Act Now, Orange=Act Soon, Yellow=Monitor" |
| `riskedu_reading_step2` | "Impact range: AI's best estimate of potential price movement" |
| `riskedu_reading_step3` | "Confidence %: How many sources confirm. >80% = high reliability" |
| `riskedu_reading_step4` | "Suggested actions: Click to execute. Always verify before trading." |
| `riskedu_reading_disclaimer` | "Always verify AI suggestions with your own analysis before trading." |
| `riskedu_autoscan_title` | "Auto-Scan Settings" |
| `riskedu_autoscan_frequency` | "Scan Frequency" |
| `riskedu_autoscan_channels` | "Alert Channels" |
| `riskedu_autoscan_severity` | "Minimum Severity for Alert" |

### 3.2 Stock Screener Education (25 keys)
| Key | EN |
|-----|-----|
| `screenedu_intro_title` | "Find Stocks Before They Move" |
| `screenedu_intro_body` | "Most screeners use price and volume. We add NEWS SENTIMENT. AI reads 23+ sources, scores every stock, then you filter for opportunities." |
| `screenedu_intro_free` | "Free to use. No subscription needed." |
| `screenedu_presets_title` | "6 Preset Screens Explained" |
| `screenedu_preset_momentum_desc` | "Surging bullish + volume spike + price up. For finding strong trending stocks." |
| `screenedu_preset_panic_desc` | "Crashing bearish + high volume + >5% drop. For dip-buying on overreaction." |
| `screenedu_preset_catalyst_desc` | "Exploding news + pre-move. For early discovery before the crowd." |
| `screenedu_preset_underradar_desc` | "Bullish sentiment + still low volume. For finding hidden gems." |
| `screenedu_preset_value_desc` | "Bearish + large cap + price drop. For buying quality on bad news." |
| `screenedu_preset_sector_desc` | "Same-sector + bullish trend. For catching sector-wide moves." |
| `screenedu_reading_title` | "How to Read Results" |
| `screenedu_reading_sentiment` | "AI score -100 to +100. Fire= surging, Green= bullish, Gray= neutral, Red= bearish." |
| `screenedu_reading_volume` | "% above 20-day avg. >300% = strong signal confirming news impact." |
| `screenedu_reading_price` | "Day change %. Watch for sentiment-price divergence." |
| `screenedu_reading_news_count` | "Article count in 24h. >30 = viral attention." |
| `screenedu_reading_score` | "Composite 0-100. Weighted: Sentiment 40% + Volume 30% + News 20% + Price 10%." |
| `screenedu_custom_title` | "Custom Screen Builder" |
| `screenedu_custom_step_market` | "Choose market" |
| `screenedu_custom_step_sentiment` | "Set sentiment range" |
| `screenedu_custom_step_volume` | "Set volume filter" |
| `screenedu_custom_step_cap` | "Set market cap" |
| `screenedu_custom_step_sector` | "Set sector (optional)" |
| `screenedu_custom_step_age` | "Set news age" |
| `screenedu_custom_run` | "Run Screen" |
| `screenedu_custom_save` | "Save as Preset" |

### 3.3 Pro Tips (10 keys)
| Key | EN |
|-----|-----|
| `screenedu_tip1` | "Combine sentiment + price: Bullish news + flat price = possible entry." |
| `screenedu_tip2` | "Watch sentiment trend, not level: Swinging from -50 to +30 matters more than steady +60." |
| `screenedu_tip3` | "Cross-reference fundamentals: Bullish news + bad financials = potential short-term pump." |
| `screenedu_tip4` | "Use time decay: News >6h is priced in. Focus on <2h for signals." |
| `screenedu_tip5` | "Check score breakdown: 90/100 from news count alone is less reliable than 85/100 balanced." |
| `screenedu_tip_title` | "Pro Tips for News Screening" |
| `screenedu_pick_preset` | "Pick a Preset" |
| `screenedu_try_preset` | "Try a Preset" |
| `screenedu_build_custom` | "Build Custom Screen" |
| `screenedu_start_screening` | "Start Screening" |
