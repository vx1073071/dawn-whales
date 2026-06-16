# R242: P2 News Intelligence — Heatmap, Backtest, Event Strategy Design
## QUANT MOO v2.7.0 NEWS INTELLIGENCE · R242 (QClaw Design)

---

## 1. SENTIMENT HEATMAP (情绪热力图)

### 1.1 Heatmap Grid Layout (3D: Market × Sector × Time)
```
┌──────────────────────────────────────────────────────────────┐
│ 🔥 Sentiment Heatmap           Time: ○ Live  ● 24h  ○ 7d    │
│                                                               │
│           US    HK   Crypto  JP    CN    TW    KR    SG   ... │
│ ─────────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─── │
│ Tech         │ 🟢  │ 🟡  │ 🟢  │ 🟡  │ 🟢  │ 🟡  │ 🟡  │ ...│
│ Finance      │ 🟡  │ 🟢  │ 🟢  │ 🟡  │ 🟡  │ 🟢  │ 🟡  │ ...│
│ Healthcare   │ 🟢  │ 🟡  │ 🟢  │ 🟢  │ 🟡  │ 🟡  │ 🟢  │ ...│
│ Energy       │ 🔴  │ 🟡  │ 🟡  │ 🔴  │ 🟡  │ 🟡  │ 🟡  │ ...│
│ Consumer     │ 🟢  │ 🟢  │ 🟢  │ 🟡  │ 🟢  │ 🟡  │ 🟢  │ ...│
│ Real Estate  │ 🔴  │ 🔴  │ 🟡  │ 🔴  │ 🔴  │ 🟡  │ 🟡  │ ...│
│ Materials    │ 🟡  │ 🟡  │ 🟡  │ 🟡  │ 🟢  │ 🟡  │ 🟡  │ ...│
│ Comm         │ 🟢  │ 🟡  │ 🟡  │ 🟢  │ 🟡  │ 🟢  │ 🟡  │ ...│
│ Utilities    │ 🟡  │ 🟢  │ 🟡  │ 🟡  │ 🟢  │ 🟡  │ 🟢  │ ...│
│ Transport    │ 🟡  │ 🟡  │ 🟡  │ 🟡  │ 🟡  │ 🟡  │ 🟡  │ ...│
│ ─────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─── │
│                                                               │
│ Legend: 🟢 Bullish(>+30)  🟡 Neutral(-30~+30)  🔴 Bearish(<-30)
│                                                               │
│ Click any cell to drill down → sector stocks with scores      │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Heatmap Color Scale
```
-100 ←────────────────── 0 ──────────────────→ +100
  🔴🔴🟠🟠🟡🟡🟡🟢🟢🟢🟢🟢🟢

| Score Range | Color  | Hex       | Label         |
|-------------|--------|-----------|---------------|
| +70 ~ +100  | 🔥🟢  | `#16a34a` | Surging Bullish|
| +30 ~ +70   | 🟢    | `#22c55e` | Bullish       |
| +10 ~ +30   | 🟩    | `#86efac` | Mild Bullish  |
| -10 ~ +10   | ⚪    | `#94a3b8` | Neutral       |
| -30 ~ -10   | 🟥    | `#fca5a5` | Mild Bearish  |
| -70 ~ -30   | 🔴    | `#ef4444` | Bearish       |
| -100 ~ -70  | 💀🔴 | `#b91c1c` | Crashing Bearish |

Dark mode: all colors adjusted +10 lightness for contrast on dark bg
```

### 1.3 Fear & Greed Dashboard
```
┌──────────────────────────────────────────────┐
│ 😱 Fear & Greed Index        Last: 65/100    │
│                                                │
│  Extreme Fear     Fear    Neutral   Greed    Extreme Greed │
│  0────●────25─────50─────75─────100           │
│                      ▲ 65 (Greed)             │
│                                                │
│ ┌─ Components ──────────────────────────────┐ │
│ │ 📰 News Sentiment          72/100  🟢     │ │
│ │ 📊 Market Momentum         58/100  🟡     │ │
│ │ 📈 Stock Price Breadth     63/100  🟢     │ │
│ │ 💪 Put/Call Ratio          55/100  🟡     │ │
│ │ 🔄 Market Volatility (VIX) 68/100  🟢     │ │
│ │ 💰 Safe Haven Demand       51/100  🟡     │ │
│ └────────────────────────────────────────────┘│
│                                                │
│ 💡 Current market is GREEDY. Historically,     │
│   extreme greed precedes corrections.          │
│   Consider reducing leverage.                  │
└──────────────────────────────────────────────┘
```

### 1.4 Fear & Greed Component Definitions

| Component | Weight | Data Source | Interpretation |
|-----------|--------|-------------|----------------|
| News Sentiment | 25% | AI sentiment aggregate | High = bullish news flood |
| Market Momentum | 25% | Price vs 125-day MA | High = above moving avg |
| Stock Breadth | 15% | Advancing/Declining ratio | High = broad rally |
| Put/Call Ratio | 15% | Options market | Low = greed (too much call buying) |
| Volatility (VIX) | 10% | Inverse VIX | Low VIX = greed (complacency) |
| Safe Haven | 10% | Bond/Stock relative | High stock vs bond = greed |

---

## 2. NEWS BACKTEST ENGINE (新闻回测)

### 2.1 Backtest Flow
```
Step 1: Choose Event Type
  [Earnings Beat ▼] [Earnings Miss] [M&A Announce] 
  [Product Launch] [Regulatory Action] [CEO Change]
  [Dividend Change] [Stock Split] [Analyst Upgrade/Downgrade]

Step 2: Configure Parameters
  Lookback Period: [3 Years ▼] (2018-2021 available)
  Forward Window:  [5 Days ▼]  (1/3/5/10/20/30 days)
  Markets:         [☑ US] [☑ HK] [☐ Crypto] [☐ JP]
  Min Confidence:  [70% ▼]

Step 3: Run Backtest (1.5 USDT)

Step 4: View Results
```

### 2.2 Backtest Result Dashboard
```
┌──────────────────────────────────────────────────────────────┐
│ 📊 News Backtest: "Earnings Beat" Event                       │
│ 3yr · US+HK · 5-day forward           💰 1.5 USDT            │
│                                                               │
│ ┌─ Summary Stats ──────────────────────────────────────────┐ │
│ │ 📈 Avg Return:     +2.3%                                 │ │
│ │ 📉 Max Drawdown:   -4.1%                                 │ │
│ │ ✅ Win Rate:       68%  (842 / 1,238 events)             │ │
│ │ 🎯 Win/Loss Ratio: 2.1x                                  │ │
│ │ 📊 Sharpe Ratio:   1.42                                   │ │
│ │ 🔢 Sample Size:    1,238 events across 847 tickers       │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ Return Distribution ────────────────────────────────────┐ │
│ │        ████                                              │ │
│ │       ██████                                             │ │
│ │      ████████     ██                                     │ │
│ │    ██████████    ████    ██                               │ │
│ │  █████████████  ██████  ████                              │ │
│ │ ├───┼───┼───┼───┼───┼───┼───┼───┤                        │ │
│ │ -15% -10% -5%  0% +5% +10% +15% +20%                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ By Market ──────────────────────────────────────────────┐ │
│ │ US:  +2.5% avg, 71% win, 1,012 events  [View Detail]    │ │
│ │ HK:  +1.4% avg, 56% win,   226 events  [View Detail]    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ By Time Window ─────────────────────────────────────────┐ │
│ │ 1d:  +0.8% │ 3d: +1.6% │ 5d: +2.3% │ 10d: +3.1%        │ │
│ │ 20d: +4.2% │ 30d: +4.8% (but wider variance)            │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                               │
│ ⚠️ Past performance does not guarantee future results.       │
│ [Export CSV] [Save Report] [Share]                            │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Backtest Event Types Catalog

| Event Type | Category | Typical Impact | Sample Size (US, 3yr) |
|------------|----------|---------------|----------------------|
| Earnings Beat >20% | Earnings | +3-8% in 5d | ~1,200 |
| Earnings Miss >20% | Earnings | -5-12% in 5d | ~800 |
| M&A Announcement | Corporate | Acquiree +15-30% | ~600 |
| Product Launch | Corporate | +2-5% in 10d | ~900 |
| Regulatory Action | Regulatory | -3-15% in 5d | ~400 |
| CEO Change | Corporate | ±5% in 30d | ~200 |
| Dividend Increase >20% | Income | +1-3% in 5d | ~300 |
| Dividend Cut | Income | -3-8% in 5d | ~150 |
| Analyst Upgrade (2+ notches) | Analyst | +2-6% in 5d | ~2,500 |
| Analyst Downgrade (2+ notches) | Analyst | -3-8% in 5d | ~1,800 |
| Stock Split Announcement | Corporate | +2-5% in 10d | ~200 |
| FDA Approval (Pharma) | Regulatory | +20-50% in 1d | ~150 |

---

## 3. EVENT STRATEGY GENERATOR (事件驱动策略)

### 3.1 Event Strategy Flow
```
Step 1: Select Event Type
  [📊 Earnings] [🤝 M&A] [📜 Dividend] [⚖️ Regulatory]
  [🔄 Index Reconstitution] [🏭 Sector Event]

Step 2: AI Analysis
  → AI scans current events matching your selection
  → Identifies trading opportunities
  → Generates parameter suggestions

Step 3: Parameter Preview
  → Review AI-suggested strategy parameters
  → Adjust if needed

Step 4: Apply to Strategy
  → One-click apply to your existing strategy
  → Or create new strategy from template

💰 1.5 USDT per generation
```

### 3.2 Event Strategy Result Card
```
┌──────────────────────────────────────────────┐
│ 📊 Earnings Season Strategy                   │
│   AI-Generated · Confidence: 82%              │
│                                                │
│ 📰 Trigger Event:                              │
│   AAPL reports earnings Jul 27 after close.    │
│   Consensus: $1.42 EPS. Options imply ±4.2%.   │
│                                                │
│ 🎯 AI RECOMMENDS:                             │
│   Strategy: Long Straddle (buy ATM call+put)   │
│   Rationale: High IV, binary event.             │
│   Entry: Day before earnings (Jul 26 close).   │
│   Strike: $ATMC (current price).              │
│   Expiry: Jul 28 (weekly).                    │
│   Max Risk: Premium paid ($4.20).             │
│   Target: IV crush post-earnings.             │
│                                                │
│ 📊 BACKTEST CONTEXT:                           │
│   AAPL earnings straddles (last 12): 8/12 won. │
│   Avg return: +18% on winners, -100% on losers.│
│   Win/Loss: 2.4:1. EV: +$1.80 per $1 risked.  │
│                                                │
│ [Apply Parameters] [Modify] [Save as Template] │
└──────────────────────────────────────────────┘
```

### 3.3 Event Strategy Templates

| Event Type | Default Strategy | Risk Level | Typical Holding |
|------------|-----------------|------------|----------------|
| Earnings (high IV) | Long Straddle | 🔴 High | 1-3 days |
| Earnings (low IV) | Directional Call/Put | 🟠 Medium-High | 5-10 days |
| M&A Announcement | Long Acquiree | 🟡 Medium | 30-90 days |
| Dividend Capture | Buy-Write | 🟢 Low | Ex-div ± 1 day |
| FDA Approval | Binary Call | 🔴 Very High | 1 day |
| Index Reconstitution | Pre-inclusion Buy | 🟡 Medium | 10-20 days |
| Sector Regulation | Sector Rotation | 🟠 Medium-High | 10-30 days |

---

## 4. NEWS INTELLIGENCE PUBLIC API

### 4.1 API Endpoints
```
GET  /api/v2/news/sentiment/:ticker     → { score, trend, confidence }
GET  /api/v2/news/heatmap               → { grid: Market×Sector matrix }
GET  /api/v2/news/fear-greed            → { index, components[] }
GET  /api/v2/news/backtest              → { events[], stats }
POST /api/v2/news/backtest              → { params, results }
GET  /api/v2/news/event-strategy/:type  → { suggestions[], confidence }
GET  /api/v2/news/breaking              → { alerts[], last24h }
GET  /api/v2/news/daily-briefing        → { portfolio, watchlist, market }
```

### 4.2 Rate Limits
| Tier | Requests/min | Requests/day | Cost |
|------|-------------|-------------|------|
| Free | 10 | 100 | 0 USDT |
| Basic | 30 | 500 | 5 USDT/mo |
| Pro | 100 | 5,000 | 20 USDT/mo |
| Unlimited | ∞ | ∞ | 50 USDT/mo |

---

## 5. i18n KEY LIST (55 entries)

### 5.1 Sentiment Heatmap (12 keys)
| Key | EN |
|-----|-----|
| `heatmap_title` | Sentiment Heatmap |
| `heatmap_live` | Live |
| `heatmap_24h` | 24 Hours |
| `heatmap_7d` | 7 Days |
| `heatmap_click_cell` | Click any cell to drill down |
| `heatmap_bullish` | Bullish |
| `heatmap_bearish` | Bearish |
| `heatmap_neutral` | Neutral |
| `heatmap_surging` | Surging |
| `heatmap_crashing` | Crashing |
| `heatmap_sector_tech` | Technology |
| `heatmap_sector_finance` | Financials |

### 5.2 Fear & Greed (8 keys)
| Key | EN |
|-----|-----|
| `fear_greed_title` | Fear & Greed Index |
| `fear_greed_extreme_fear` | Extreme Fear |
| `fear_greed_fear` | Fear |
| `fear_greed_neutral` | Neutral |
| `fear_greed_greed` | Greed |
| `fear_greed_extreme_greed` | Extreme Greed |
| `fear_greed_components` | Index Components |
| `fear_greed_insight` | Current market sentiment insight |

### 5.3 News Backtest (15 keys)
| Key | EN |
|-----|-----|
| `backtest_title` | News Event Backtest |
| `backtest_event_type` | Event Type |
| `backtest_lookback` | Lookback Period |
| `backtest_forward` | Forward Window |
| `backtest_markets` | Markets |
| `backtest_confidence` | Min Confidence |
| `backtest_run` | Run Backtest (1.5 USDT) |
| `backtest_avg_return` | Average Return |
| `backtest_win_rate` | Win Rate |
| `backtest_sharpe` | Sharpe Ratio |
| `backtest_sample_size` | Sample Size |
| `backtest_by_market` | By Market |
| `backtest_by_window` | By Time Window |
| `backtest_distribution` | Return Distribution |
| `backtest_disclaimer` | Past performance does not guarantee future results |

### 5.4 Event Strategy (12 keys)
| Key | EN |
|-----|-----|
| `event_strategy_title` | Event-Driven Strategy |
| `event_strategy_select` | Select Event Type |
| `event_strategy_ai_analyze` | AI Analysis |
| `event_strategy_preview` | Strategy Preview |
| `event_strategy_apply` | Apply Parameters |
| `event_strategy_generate` | Generate Strategy (1.5 USDT) |
| `event_strategy_trigger` | Trigger Event |
| `event_strategy_recommends` | AI Recommends |
| `event_strategy_backtest_context` | Backtest Context |
| `event_strategy_apply_btn` | Apply Parameters |
| `event_strategy_modify` | Modify |
| `event_strategy_save_template` | Save as Template |

### 5.5 Public API (8 keys)
| Key | EN |
|-----|-----|
| `api_title` | News Intelligence API |
| `api_endpoints` | API Endpoints |
| `api_rate_limits` | Rate Limits |
| `api_tier_free` | Free Tier |
| `api_tier_basic` | Basic Tier |
| `api_tier_pro` | Pro Tier |
| `api_tier_unlimited` | Unlimited Tier |
| `api_get_key` | Get API Key |
