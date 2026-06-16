# R238-QClaw#1: News Classification System Design
## Dawn Whales v2.7.0 NEWS INTELLIGENCE · R238

---

## 1. OVERVIEW

Design a complete news classification taxonomy and visual system for the v2.7.0 News Intelligence module. The system classifies every news item across 3 dimensions: **Market** (where), **Source** (who), and **Impact** (how important).

---

## 2. MARKET TAG SYSTEM (12 Tags)

### 2.1 Primary Markets
| Tag | ID | Emoji | Color | Hex | CSS Var |
|-----|-----|-------|-------|-----|---------|
| US Stocks | `us` | 🇺🇸 | Blue | `#3b82f6` | `--tag-us` |
| Hong Kong | `hk` | 🇭🇰 | Red | `#ef4444` | `--tag-hk` |
| Crypto | `crypto` | 🪙 | Orange | `#f97316` | `--tag-crypto` |
| Japan | `jp` | 🇯🇵 | Crimson | `#dc2626` | `--tag-jp` |
| China A-Shares | `cn` | 🇨🇳 | Gold | `#eab308` | `--tag-cn` |
| Taiwan | `tw` | 🇹🇼 | Cyan | `#06b6d4` | `--tag-tw` |

### 2.2 Secondary Markets
| Tag | ID | Emoji | Color | Hex | CSS Var |
|-----|-----|-------|-------|-----|---------|
| South Korea | `kr` | 🇰🇷 | Indigo | `#6366f1` | `--tag-kr` |
| Singapore | `sg` | 🇸🇬 | Teal | `#14b8a6` | `--tag-sg` |
| Australia | `au` | 🇦🇺 | Green | `#22c55e` | `--tag-au` |
| India | `in` | 🇮🇳 | Amber | `#f59e0b` | `--tag-in` |
| Europe | `eu` | 🇪🇺 | Violet | `#8b5cf6` | `--tag-eu` |
| Commodities | `commodity` | 🛢️ | Brown | `#a16207` | `--tag-commodity` |

### 2.3 Market Assignment Logic
```typescript
function classifyMarket(headline: string, source: string, tickers: string[]): MarketTag[] {
  const tags: MarketTag[] = [];
  
  // Rule 1: Ticker-based (highest confidence)
  for (const ticker of tickers) {
    if (ticker.startsWith('US.') || ticker.match(/^[A-Z]{1,5}$/)) tags.push('us');
    else if (ticker.startsWith('HK.')) tags.push('hk');
    else if (ticker.startsWith('SH.') || ticker.startsWith('SZ.')) tags.push('cn');
    else if (ticker.startsWith('JP.')) tags.push('jp');
    // ... etc
  }
  
  // Rule 2: Keyword detection
  const keywordMap: Record<string, MarketTag[]> = {
    's&p 500|nasdaq|dow jones|wall street|fed|sec': ['us'],
    'hang seng|hsi|hong kong|hkex': ['hk'],
    'bitcoin|ethereum|crypto|defi|nft': ['crypto'],
    'nikkei|tse|boj|tokyo': ['jp'],
    'shanghai|shenzhen|csi 300|pboc': ['cn'],
    'kospi|south korea': ['kr'],
    'sti|singapore|mas': ['sg'],
    'asx 200|rba|sydney': ['au'],
    'nifty|sensex|rbi|mumbai': ['in'],
    'dax|cac|ftse|ecb|europe': ['eu'],
    'crude oil|gold|copper|opec': ['commodity'],
  };
  
  // Rule 3: Source default market
  if (tags.length === 0) {
    tags.push(sourceDefaultMarket(source));
  }
  
  return [...new Set(tags)]; // dedup
}
```

---

## 3. SOURCE IDENTIFICATION SYSTEM

### 3.1 Source Categories (4 tiers)

| Tier | Label | Description | Examples |
|------|-------|-------------|----------|
| 🥇 **Primary** | Direct Feed | Official paid data feeds | Reuters, Bloomberg, Dow Jones |
| 🥈 **Premier** | Major Publisher | Established financial media | CNBC, Yahoo Finance, MarketWatch |
| 🥉 **Aggregator** | News Aggregator | Scraped/aggregated from multiple sources | Investing.com, Benzinga, Seeking Alpha |
| 🔹 **Community** | Social/Community | User-generated or social sources | Reddit, StockTwits, Twitter(X) |

### 3.2 Source Badge Design
```
┌──────────────────────────────────────┐
│ Tier    │ Badge Style                │
├─────────┼────────────────────────────┤
│ 🥇 Direct│ Solid gold border, "REUTERS"│
│ 🥈 Premier│ Dashed blue border, "CNBC" │
│ 🥉 Agg    │ Dotted gray border, "Inv." │
│ 🔹 Social │ Thin dashed,  "Reddit"     │
└──────────────────────────────────────┘
```

### 3.3 News Source Catalog (23 sources)

| # | Source | Tier | Default Market | Category | Feed Type |
|---|--------|------|---------------|----------|-----------|
| 1 | Reuters | 🥇 Primary | Global | General | RSS |
| 2 | Bloomberg | 🥇 Primary | Global | General | RSS |
| 3 | CNBC | 🥈 Premier | US | Business | RSS |
| 4 | Yahoo Finance | 🥈 Premier | US | Markets | RSS |
| 5 | MarketWatch | 🥈 Premier | US | Markets | RSS |
| 6 | Investing.com | 🥉 Aggregator | Global | Multi | Scrape |
| 7 | Seeking Alpha | 🥉 Aggregator | US | Analysis | RSS |
| 8 | Benzinga | 🥉 Aggregator | US | News | RSS |
| 9 | The Wall Street Journal | 🥈 Premier | US | Business | RSS |
| 10 | Financial Times | 🥈 Premier | Global | Business | RSS |
| 11 | Nikkei Asia | 🥈 Premier | JP | Business | RSS |
| 12 | SCMP | 🥈 Premier | HK/CN | Business | RSS |
| 13 | Coindesk | 🥈 Premier | Crypto | Crypto | RSS |
| 14 | Cointelegraph | 🥈 Premier | Crypto | Crypto | RSS |
| 15 | The Block | 🥉 Aggregator | Crypto | Crypto | RSS |
| 16 | FXStreet | 🥉 Aggregator | Global | Forex | RSS |
| 17 | ZeroHedge | 🔹 Community | Global | Opinion | RSS |
| 18 | Reddit r/wallstreetbets | 🔹 Community | US | Social | Reddit API |
| 19 | Reddit r/cryptocurrency | 🔹 Community | Crypto | Social | Reddit API |
| 20 | StockTwits | 🔹 Community | US | Social | API |
| 21 | Whale Alert | 🥉 Aggregator | Crypto | On-chain | API |
| 22 | SEC EDGAR | 🥇 Primary | US | Regulatory | RSS |
| 23 | HKEX News | 🥇 Primary | HK | Regulatory | RSS |

---

## 4. IMPACT CLASSIFICATION (P0/P1/P2)

### 4.1 Breaking News Tiers

| Tier | Label | Color | Hex | Icon | Push? | Desktop? | Sound? |
|------|-------|-------|-----|------|-------|----------|--------|
| **P0** | Critical | 🔴 Red | `#ef4444` | 🚨 | Yes (immediate) | Yes (toast) | Yes |
| **P1** | Important | 🟠 Orange | `#f97316` | ⚡ | Yes (batched 5min) | Yes (toast) | Optional |
| **P2** | Notable | 🟡 Yellow | `#eab308` | 📌 | No | No | No |

### 4.2 P0 Trigger Keywords (Black Swan)

```
# Central Bank
emergency rate cut, emergency rate hike, unprecedented, QE, quantitative easing, taper, FOMC emergency, PBOC cut RRR, BOJ yield curve control, ECB emergency meeting

# Geopolitical
declared war, invasion, sanctions, oil embargo, SWIFT ban, capital controls, sovereign default, coup, martial law

# Market Crash
circuit breaker, trading halted, flash crash, -10%, crash, freefall, contagion, liquidity crisis, margin call cascade

# Crypto
exchange hack, bridge exploit, stablecoin depeg, exchange insolvent, rug pull, 51% attack, wallet drain, ~$100M+, protocol frozen

# Regulatory
SEC lawsuit, SEC approval, ban, ban crypto, ban short selling, delist, trading suspension, investigation, enforcement action, CFTC, DOJ crypto

# Corporate
bankruptcy, Chapter 11, accounting fraud, CEO arrested, data breach, ransomware
```

### 4.3 P1 Trigger Keywords (Market Moving)

```
rate hike, rate cut, inflation CPI, PPI, GDP, nonfarm payroll, unemployment, jobless claims, ISM PMI, consumer confidence, trade deficit, oil inventory, natural gas storage, OPEC decision, earnings beat, earnings miss, guidance raised, guidance cut, layoff, restructuring, merger, acquisition, IPO, SPAC, stock split, dividend cut, dividend increase, buyback, analyst upgrade, analyst downgrade, price target raised, ETF launch, ETF approval, futures expiration, options expiration, reconstitution, rebalancing
```

### 4.4 P2 Trigger Keywords (Informational)

```
partnership, product launch, new feature, conference, interview, opinion, analysis, Cramer, whale alert (non-P0), large transaction, insider trading (positive/negative), sector rotation, fund flow, short interest, put/call ratio, VIX spike, analyst note, preview, outlook
```

---

## 5. SENTIMENT COLOR CODING

| Sentiment | Color | Hex | CSS Var | Usage |
|-----------|-------|-----|---------|-------|
| **Bullish** 🟢 | Green | `#22c55e` | `--sentiment-bullish` | Positive news, upgrades, beats |
| **Bearish** 🔴 | Red | `#ef4444` | `--sentiment-bearish` | Negative news, downgrades, misses |
| **Neutral** ⚪ | Gray | `#94a3b8` | `--sentiment-neutral` | Informational, routine |
| **Mixed** 🟡 | Amber | `#f59e0b` | `--sentiment-mixed` | Contradictory signals |

---

## 6. NEWS CARD LAYOUT DESIGN

### 6.1 Full News Card
```
┌──────────────────────────────────────────────┐
│ 🔴 P0 · 3 min ago          🇺🇸 US  🥇 Reuters │
│                                                │
│ 📰 Fed Announces Emergency Rate Cut of 50bps   │
│    The Federal Reserve cut interest rates...   │
│                                                │
│ 🏷️ #Fed #RateCut #Monetary #USD                │
│ 💬 24 comments   📊 +2.3% S&P related          │
│ [Read More →]      [Save] [Share] [Filter ↓]   │
└──────────────────────────────────────────────┘
```

### 6.2 Compact News Card (Feed View)
```
┌──────────────────────────────────────┐
│ 🟠 P1 · 15m  🇭🇰HK  🥉SCMP          │
│ 📰 Hang Seng opens 2% higher on      │
│   China stimulus hopes               │
│ #HangSeng #China #Stimulus           │
└──────────────────────────────────────┘
```

### 6.3 Breaking News Toast (Desktop)
```
┌─────────────────────────────────────────────┐
│ 🚨 BREAKING — P0 CRITICAL                   │
│                                               │
│ Fed Announces Emergency Rate Cut of 50bps     │
│ Impact: US Markets · SPX Futures +1.8%        │
│                                               │
│ [View Details] [Dismiss] [Snooze 30m]         │
└─────────────────────────────────────────────┘
```

---

## 7. FILTER TAXONOMY

### 7.1 Filter Dimensions
```
NewsFilterBar
├── Market Filter     (multi-select dropdown, 12 options)
├── Source Filter     (multi-select, grouped by tier: Primary/Premier/Agg/Community)
├── Impact Filter     (radio: All / P0+P1 / P0 only / Custom)
├── Sentiment Filter  (radio: All / Bullish / Bearish)
├── Asset Filter      (searchable autocomplete, ticker symbol)
├── Time Range        (All / Last Hour / Today / This Week)
└── Sort              (Latest / Most Impactful / Most Discussed)
```

### 7.2 Default Configuration
```
Market:    All markets (user's preferred markets highlighted)
Source:    All sources (no filter)
Impact:    P0 + P1 (hide P2)
Sentiment: All
Time:      Today
Sort:      Latest
```

---

## 8. COLOR SYSTEM SUMMARY

### 8.1 Complete Palette

| Category | Key | Hex | Dark Mode Hex | Usage |
|----------|-----|-----|---------------|-------|
| P0 Critical | `--news-p0` | `#ef4444` | `#f87171` | Breaking news badge, toast border |
| P1 Important | `--news-p1` | `#f97316` | `#fb923c` | Important news badge |
| P2 Notable | `--news-p2` | `#eab308` | `#facc15` | Informational badge |
| Bullish | `--sentiment-bullish` | `#22c55e` | `#4ade80` | Positive sentiment indicators |
| Bearish | `--sentiment-bearish` | `#ef4444` | `#f87171` | Negative sentiment indicators |
| Neutral | `--sentiment-neutral` | `#94a3b8` | `#cbd5e1` | Neutral/uncategorized |
| Primary Source | `--source-primary` | `#d4a574` | `#d4a574` | Gold (Primary tier badge) |
| Premier Source | `--source-premier` | `#3b82f6` | `#60a5fa` | Blue (Premier tier badge) |
| Agg Source | `--source-agg` | `#6b7280` | `#9ca3af` | Gray (Aggregator badge) |
| Comm Source | `--source-comm` | `#a855f7` | `#c084fc` | Purple (Community badge) |
| Market US | `--tag-us` | `#3b82f6` | `#60a5fa` | Blue |
| Market HK | `--tag-hk` | `#ef4444` | `#f87171` | Red |
| Market Crypto | `--tag-crypto` | `#f97316` | `#fb923c` | Orange |
| Market EU | `--tag-eu` | `#8b5cf6` | `#a78bfa` | Violet |
| Market CN | `--tag-cn` | `#eab308` | `#facc15` | Gold |
| Market JP | `--tag-jp` | `#dc2626` | `#ef4444` | Crimson |
| Market KR | `--tag-kr` | `#6366f1` | `#818cf8` | Indigo |

### 8.2 WCAG Compliance
All text-on-tag combinations pass WCAG 2.1 AA (contrast ≥4.5:1). Dark mode variants are lightened for sufficient contrast against dark backgrounds.

---

## 9. IMPLEMENTATION SPEC

### 9.1 Type Definitions
```typescript
type MarketTag = 'us' | 'hk' | 'crypto' | 'jp' | 'cn' | 'tw' | 'kr' | 'sg' | 'au' | 'in' | 'eu' | 'commodity';
type SourceTier = 'primary' | 'premier' | 'aggregator' | 'community';
type ImpactLevel = 'P0' | 'P1' | 'P2';
type Sentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed';

interface NewsClassification {
  id: string;
  markets: MarketTag[];
  sourceId: string;
  sourceTier: SourceTier;
  impact: ImpactLevel;
  sentiment: Sentiment;
  tickers: string[];
  hashtags: string[];
  classifiedAt: number;
  confidence: number; // 0-1
}

interface NewsFilter {
  markets: MarketTag[];
  sources: string[];
  sourceTiers: SourceTier[];
  impactMin: ImpactLevel | 'all';
  sentiment: Sentiment[];
  assetTicker?: string;
  timeRange: '1h' | 'today' | 'week' | 'all';
  sort: 'latest' | 'impact' | 'discussed';
}
```

### 9.2 File Map
```
electron/engine/news/
├── news-classifier.ts          # Market + impact + sentiment
├── rss-scheduler.ts            # RSS fetch cron (JVS)
├── breaking-detector.ts        # P0/P1/P2 keyword match (JVS)
├── dedup-engine-v2.ts          # Cross-source dedup (autoclaw)
└── types.ts                    # Shared types

src/components/news/
├── NewsFeedPanelV2.tsx         # Main feed (ML)
├── NewsCard.tsx                # Individual card
├── NewsFilterBar.tsx           # Filter controls
├── BreakingNewsToast.tsx       # Desktop notification (ML)
├── MarketTag.tsx               # Reusable tag component
├── SourceBadge.tsx             # Source tier badge
├── ImpactBadge.tsx             # P0/P1/P2 badge
└── SentimentDot.tsx            # Color dot

src/i18n/locales/
└── *.json (add news_* keys)
```
