# R240: P1 News Intelligence — Risk, Supply Chain, Regulation & Screener Design
## Dawn Whales v2.7.0 NEWS INTELLIGENCE · R240 (QClaw Design)

---

## 1. POSITION RISK SCANNER (持仓风险扫描)

### 1.1 Risk Classification Matrix

| Risk | Trigger | Impact | Action | Color | Icon |
|------|---------|--------|--------|-------|------|
| 🔴 **Severe** | P0 breaking neg + direct ticker match | >5% est loss | Reduce/Sell | `#ef4444` | 🚨 |
| 🟠 **High** | P1 negative + direct ticker match | 3-5% est loss | Hedge/Stop-loss | `#f97316` | ⚠️ |
| 🟡 **Moderate** | P1 negative + sector match | 1-3% est loss | Monitor | `#eab308` | 📌 |
| 🟢 **Low** | P2 negative + sector/broad match | <1% est loss | No action | `#22c55e` | ✅ |
| ⚪ **Info** | Neutral news mentioning holding | No impact est. | Informational | `#94a3b8` | ℹ️ |

### 1.2 Risk Scanner Result Card
```
┌──────────────────────────────────────────────┐
│ 🔴 SEVERE RISK — TSLA                        │
│                                                │
│ 📰 EU announces 20% tariff on Chinese EVs,     │
│   effective July 1. Tesla Shanghai exports     │
│   face significant margin compression.         │
│                                                │
│ 📊 Estimated Impact: -4.8% to -7.2%           │
│ 🎯 Confidence: 88%  (4 sources: Reuters/CNBC/ │
│    Bloomberg/FT — 15 min ago)                  │
│                                                │
│ 💡 SUGGESTED ACTIONS:                         │
│   1. Reduce position by 30%                    │
│   2. Set stop-loss at $215                     │
│   3. Buy protective puts (June 28 expiry)      │
│                                                │
│ [Execute Action 1] [Trade Options] [Dismiss]   │
└──────────────────────────────────────────────┘
```

### 1.3 Risk Scan Dashboard Layout
```
┌──────────────────────────────────────────────┐
│ 🔍 Position Risk Scanner    Last scan: 2m ago │
│                                                │
│ ┌─ Summary Bar ──────────────────────────────┐│
│ │ 🔴 1 Severe  🟠 2 High  🟡 4 Moderate     ││
│ │ 🟢 12 Low    ⚪ 5 Info                     ││
│ └────────────────────────────────────────────┘│
│                                                │
│ ┌─ Risk List (sorted by severity) ───────────┐│
│ │ 🔴 TSLA  -6.2%  tariff impact    [Actions] ││
│ │ 🟠 AAPL  -3.8%  supply warning   [Actions] ││
│ │ 🟠 META  -3.2%  EU fine          [Actions] ││
│ │ 🟡 NVDA   1.6%  sector rotation  [Monitor] ││
│ │ ...                                         ││
│ └────────────────────────────────────────────┘│
│                                                │
│ [Scan All Holdings]  (💰 1 USDT per scan)      │
│ [Auto-Scan: Every 30 min]  [⚙️ Settings]       │
└──────────────────────────────────────────────┘
```

---

## 2. SUPPLY CHAIN IMPACT (供应链传导)

### 2.1 Knowledge Graph Structure
```
                    ┌─────────┐
                    │ TSMC 🔴 │ ← Direct hit: fire at fab
                    └────┬────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ AAPL 🟠  │  │ NVDA 🟠  │  │ AMD 🟠  │ ← Tier 1 suppliers
    │ iPhone   │  │ GPU chips│  │ CPU chips│
    └──────────┘  └──────────┘  └──────────┘
         │              │              │
         ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Foxconn  │  │ Samsung🟡 │  │ ASML 🟡  │ ← Tier 2
    │ assembly │  │ memory   │  │ equipment│
    └──────────┘  └──────────┘  └──────────┘
```

### 2.2 Impact Levels
| Level | Label | Color | Description |
|-------|-------|-------|-------------|
| 🔴 **Direct** | Target | `#ef4444` | The company directly in the news |
| 🟠 **Tier 1** | Critical Supply | `#f97316` | Direct supplier/customer of the target |
| 🟡 **Tier 2** | Secondary Impact | `#eab308` | Supplier to a Tier 1 company |
| 🟢 **Tier 3** | Ripple Effect | `#22c55e` | Distant supply chain impact |

### 2.3 Supply Chain Result Card
```
┌──────────────────────────────────────────────┐
│ 🔗 Supply Chain Impact Analysis                │
│                                                │
│ TRIGGER: TSMC Fab 14 fire — 3-month shutdown   │
│                                                │
│ ┌─ Impacted Stocks ──────────────────────────┐│
│ │ 🟠 AAPL     -2.4%  A17 chip delayed        ││
│ │ 🟠 NVDA     -3.1%  H100 supply constrained  ││
│ │ 🟠 AMD      -2.8%  MI300 wafer allocation   ││
│ │ 🟡 Samsung  -0.9%  Memory affected          ││
│ │ 🟡 ASML     -0.6%  Equipment orders delayed  ││
│ └────────────────────────────────────────────┘│
│                                                │
│ 💡 SUGGESTION: TSMC supply-constrained stocks  │
│    may experience rally if alternative         │
│    suppliers (SMIC, UMC) benefit.               │
│                                                │
│ [View Full Graph] [Trade] [Add to Watchlist]    │
└──────────────────────────────────────────────┘
```

---

## 3. REGULATORY TRACKER (监管政策追踪)

### 3.1 Regulatory Bodies Taxonomy

| Region | Body | Abbr | Keywords | Color |
|--------|------|------|----------|-------|
| 🇺🇸 US | Securities & Exchange Commission | SEC | SEC, Gensler, 10-K, 8-K, S-1, enforcement | `#3b82f6` |
| 🇺🇸 US | Federal Reserve | Fed | FOMC, Powell, rate decision, taper, QE, QT | `#3b82f6` |
| 🇺🇸 US | CFTC | CFTC | CFTC, commodity, derivatives, futures | `#3b82f6` |
| 🇺🇸 US | DOJ Antitrust | DOJ | antitrust, monopoly, merger, breakup | `#3b82f6` |
| 🇪🇺 EU | European Securities & Markets Authority | ESMA | ESMA, MiFID, MiCA, DORA, SFDR | `#8b5cf6` |
| 🇪🇺 EU | European Central Bank | ECB | ECB, Lagarde, rate, APP, PEPP | `#8b5cf6` |
| 🇪🇺 EU | European Commission | EC | antitrust, DMA, DSA, GDPR, fine | `#8b5cf6` |
| 🇨🇳 CN | People's Bank of China | PBOC | PBOC, 央行, RRR, LPR, MLF, SLF | `#eab308` |
| 🇨🇳 CN | China Securities Regulatory Commission | CSRC | CSRC, 证监会, IPO, delisting | `#eab308` |
| 🇨🇳 CN | National Financial Regulatory Admin | NFRA | NFRA, 金监局, insurance, bank | `#eab308` |
| 🇭🇰 HK | Securities & Futures Commission | SFC | SFC, 證監會, licensing, insider | `#ef4444` |
| 🇭🇰 HK | Hong Kong Monetary Authority | HKMA | HKMA, 金管局, HIBOR, linked rate | `#ef4444` |
| 🇯🇵 JP | Financial Services Agency | FSA | FSA, 金融庁, banking, insurance | `#dc2626` |
| 🇯🇵 JP | Bank of Japan | BOJ | BOJ, 日銀, Ueda, YCC, ETF purchase | `#dc2626` |
| 🇰🇷 KR | Financial Services Commission | FSC | FSC, 금융위, short selling, regulation | `#6366f1` |
| 🌐 Global | Bank for International Settlements | BIS | BIS, Basel, capital requirements | `#6b7280` |
| 🌐 Global | Financial Stability Board | FSB | FSB, systemic risk, too-big-to-fail | `#6b7280` |

### 3.2 Regulatory Impact Categories

| Category | Icon | Color | Scope |
|----------|------|-------|-------|
| Enforcement Action | ⚖️ | `#ef4444` | Specific company targeted |
| New Regulation | 📜 | `#f97316` | Industry-wide new rules |
| Policy Change | 🔄 | `#eab308` | Central bank or government policy |
| Investigation | 🔍 | `#f59e0b` | Ongoing probe (pre-enforcement) |
| Guidance/Statement | 📢 | `#94a3b8` | Regulatory guidance, non-binding |

### 3.3 Regulatory Alert Card
```
┌──────────────────────────────────────────────┐
│ ⚖️ SEC ENFORCEMENT — CRYPTO                  │
│                                                │
│ 🇺🇸 SEC files lawsuit against Binance for      │
│    unregistered securities offering.           │
│    Affected tokens: BNB, SOL, ADA, MATIC.      │
│                                                │
│ 📊 IMPACT ON YOUR PORTFOLIO:                  │
│    🟡 SOL  holding — moderate exposure        │
│       (SOL is listed but not Binance-exclusive)│
│    ✅ Other holdings not affected              │
│                                                │
│ 📅 Published: 2 hours ago                     │
│ 🔗 Source: SEC.gov + 3 news outlets           │
│                                                │
│ [View Full Filing] [Assess Impact (1 USDT)]   │
└──────────────────────────────────────────────┘
```

---

## 4. NEWS STOCK SCREENER (新闻选股器)

### 4.1 Screener Dimensions

| Dimension | Options | Example |
|-----------|---------|---------|
| **Sentiment Trend** | Surging Bullish / Bullish / Neutral / Bearish / Crashing Bearish | Last 48h sentiment shift |
| **News Volume** | Exploding (>50/day) / High (20-50) / Moderate (10-20) / Low (<10) | Articles mentioning ticker |
| **Volume Spike** | >500% / 300-500% / 100-300% / Normal | vs 20-day avg volume |
| **Price Movement** | >10% / 5-10% / 2-5% / <2% | Day change |
| **Market** | 12 markets | US/HK/Crypto... |
| **Sector** | Tech/Finance/Healthcare/Energy... | Industry filter |
| **Market Cap** | Mega (>200B) / Large (10-200B) / Mid (2-10B) / Small (<2B) | Size filter |
| **News Age** | <1h / <6h / <24h / <7d | Freshness |

### 4.2 Preset Screens

| Preset | Conditions | Use Case |
|--------|------------|----------|
| 🚀 **Momentum Breakout** | Surging Bullish + Volume >300% + Price >5% | Find stocks breaking out on positive news |
| 📉 **Panic Sell** | Crashing Bearish + News >30/day + Price <-5% | Find oversold opportunities |
| 📰 **News Catalyst** | News Volume Exploding + Neutral Market Cap | Find stocks in the news but not yet moved |
| 🔍 **Under the Radar** | Bullish Sentiment + Low Volume + <6h | Early discovery before crowd |
| 💎 **Value Alert** | Bearish Sentiment + Mega/Large Cap + Price <-5% | Find blue chips on sale |
| 🌊 **Sector Rotation** | Same Sector + Bullish Trend + High Volume | Spot sector-wide moves |

### 4.3 Screener Result Table
```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 News Stock Screener    Preset: [Momentum Breakout ▼]      │
│                                                               │
│ Ticker  │ Sentiment  │ Volume  │ Price  │ News/24h  │ Score  │
│─────────┼────────────┼─────────┼────────┼───────────┼────────│
│ PLTR    │ 🟢🔥 +92%  │ +520%   │ +8.4%  │ 47 🔥     │ 94/100 │
│ SOFI    │ 🟢 +78%    │ +380%   │ +6.1%  │ 32        │ 87/100 │
│ RKLB    │ 🟢 +71%    │ +420%   │ +5.9%  │ 28        │ 84/100 │
│ IONQ    │ 🟢 +65%    │ +310%   │ +7.2%  │ 22        │ 81/100 │
│ ...                                                           │
│                                                               │
│ Filters: US Stocks · Tech · All Caps · <24h · Sort: Score ↓ │
│ [Customize] [Save Screen] [Export CSV]                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. COLOR SYSTEM EXTENSION (v2.7.0 P1)

### 5.1 New CSS Variables

```css
/* Risk Scanner */
--risk-severe: #ef4444;
--risk-high: #f97316;
--risk-moderate: #eab308;
--risk-low: #22c55e;
--risk-info: #94a3b8;

/* Supply Chain */
--supplychain-direct: #ef4444;
--supplychain-tier1: #f97316;
--supplychain-tier2: #eab308;
--supplychain-tier3: #22c55e;

/* Regulatory */
--regulatory-enforcement: #ef4444;
--regulatory-regulation: #f97316;
--regulatory-policy: #eab308;
--regulatory-investigation: #f59e0b;
--regulatory-guidance: #94a3b8;

/* Screener */
--screener-surging: #22c55e;
--screener-bullish: #4ade80;
--screener-neutral: #94a3b8;
--screener-bearish: #f87171;
--screener-crashing: #ef4444;
```

---

## 6. i18n KEY LIST (52 entries)

### 6.1 Position Risk Scanner (12 keys)
| Key | EN |
|-----|-----|
| `risk_scanner_title` | Position Risk Scanner |
| `risk_scanner_severe` | Severe |
| `risk_scanner_high` | High |
| `risk_scanner_moderate` | Moderate |
| `risk_scanner_low` | Low |
| `risk_scanner_info` | Informational |
| `risk_scanner_impact` | Estimated Impact |
| `risk_scanner_actions` | Suggested Actions |
| `risk_scanner_reduce` | Reduce position |
| `risk_scanner_stoploss` | Set stop-loss |
| `risk_scanner_hedge` | Buy protective puts |
| `risk_scanner_scan_cta` | Scan All Holdings (1 USDT) |

### 6.2 Supply Chain Impact (12 keys)
| Key | EN |
|-----|-----|
| `supply_chain_title` | Supply Chain Impact |
| `supply_chain_direct` | Direct Impact |
| `supply_chain_tier1` | Critical Supply |
| `supply_chain_tier2` | Secondary Impact |
| `supply_chain_tier3` | Ripple Effect |
| `supply_chain_trigger` | Trigger Event |
| `supply_chain_impacted` | Impacted Stocks |
| `supply_chain_suggestion` | Suggestion |
| `supply_chain_view_graph` | View Full Graph |
| `supply_chain_affected` | affected |
| `supply_chain_no_exposure` | No supply chain exposure found |
| `supply_chain_analyze_cta` | Analyze Supply Chain (1 USDT) |

### 6.3 Regulatory Tracker (13 keys)
| Key | EN |
|-----|-----|
| `regulatory_title` | Regulatory Tracker |
| `regulatory_enforcement` | Enforcement Action |
| `regulatory_regulation` | New Regulation |
| `regulatory_policy` | Policy Change |
| `regulatory_investigation` | Investigation |
| `regulatory_guidance` | Guidance |
| `regulatory_impact_portfolio` | Impact on Your Portfolio |
| `regulatory_no_exposure` | No regulatory exposure found |
| `regulatory_view_filing` | View Full Filing |
| `regulatory_assess_impact` | Assess Impact (1 USDT) |
| `regulatory_body_sec` | U.S. SEC |
| `regulatory_body_pboc` | PBOC (China) |
| `regulatory_body_ecb` | ECB (Europe) |

### 6.4 News Stock Screener (10 keys)
| Key | EN |
|-----|-----|
| `screener_title` | News Stock Screener |
| `screener_preset_momentum` | Momentum Breakout |
| `screener_preset_panic` | Panic Sell |
| `screener_preset_catalyst` | News Catalyst |
| `screener_preset_under_radar` | Under the Radar |
| `screener_preset_value` | Value Alert |
| `screener_preset_sector` | Sector Rotation |
| `screener_sentiment_surging` | Surging Bullish |
| `screener_sentiment_crashing` | Crashing Bearish |
| `screener_save_screen` | Save Screen |

### 6.5 Shared (5 keys)
| Key | EN |
|-----|-----|
| `news_no_results` | No results match your criteria |
| `news_adjust_filters` | Adjust Filters |
| `news_last_scan` | Last scan: {time} |
| `news_auto_scan` | Auto-Scan |
| `news_scan_now` | Scan Now |
