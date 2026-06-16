# R243: Community & Release — Discussion, Creator, Copytrade, Source Health
## QUANT MOO v2.7.0 NEWS INTELLIGENCE · R243 FINAL (QClaw Design)

---

## 1. NEWS DISCUSSION (策略新闻讨论区)

### 1.1 Discussion Thread Card
```
┌──────────────────────────────────────────────┐
│ 💬 NVDA Earnings Beat — What's Your Play?     │
│                                                  │
│ 📰 Associated News:                              │
│  NVIDIA Q1 FY2025: Revenue $26B, +262% YoY       │
│  Source: Bloomberg · 2h ago                      │
│                                                  │
│ 📊 Linked Strategy: Nifty50 Momentum             │
│  (strategy uses NVDA as core holding)            │
│                                                  │
│ 💬 47 comments  ·  ❤️ 128 likes  ·  📌 Pinned    │
│  Created by: @TraderMike (L2 Creator)            │
│                                                  │
│ ┌──────────────────────────────────────────────┐│
│ │ @CryptoKing L3:                              ││
│ │ "Data center revenue up 427%. GPU demand      ││
│ │  far exceeds supply. Bullish through Q3."     ││
│ │ 👍 23  💬 Reply  📌 Pin  🚩 Report          ││
│ │   └─ @QuantGal L1:                           ││
│ │      "Agree. But watch China export controls  ││
│ │       as risk factor."                        ││
│ │      👍 8  💬 Reply                           ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ [Sort: 🔥 Hot] [💬 New] [⭐ Top] [⏰ Recent]      │
│ [Write Comment...]                               │
└──────────────────────────────────────────────┘
```

### 1.2 Discussion Features

| Feature | Description | UX |
|---------|-------------|-----|
| Thread Creation | Auto-linked or manual. Each thread associates 1 news + 0-3 strategies | Create button on news card |
| Comments | Nested replies (max 3 levels). Creator badge on name | Standard reply UI |
| Votes | Upvote/downvote (no totals shown to prevent herd) | 👍 👎 |
| Pinning | Thread creator can pin 1 comment. PM can pin threads | 📌 icon |
| Sorting | Hot (engagement-weighted), New (chronological), Top (most upvoted), Recent | Segmented control |
| Creator Reply | Strategy author gets "Creator Reply" badge. Highlighted with 🟡 border | Badge + highlight |
| Reporting | 3 reasons: Spam/Harassment/Misinformation → PM review queue | 🚩 → dialog |
| Moderation | PM can hide threads/comments. Warning → Temp mute → Ban | Admin panel |

### 1.3 Comment Composition
```
┌──────────────────────────────────────────────┐
│ 💬 Join the Discussion                        │
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ Write your analysis or question...          ││
│ │                                              ││
│ │ 🖼️  📊  🔗  📈  😀                         ││
│ │                                              ││
│ │ Attach: [Strategy ▼] [Chart] [Factor]       ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Guidelines:                                    │
│ ✅ Data-backed analysis                       │
│ ✅ Respectful disagreement                    │
│ ✅ Specific entry/exit levels                 │
│ ❌ No price manipulation talk                 │
│ ❌ No personal attacks                        │
│ ❌ No unsolicited promotions                  │
│                                                │
│ [Post Comment]                                 │
└──────────────────────────────────────────────┘
```

---

## 2. CREATOR MATERIALS (创作者素材引擎)

### 2.1 Creator Workspace Integration
```
┌─ Strategy Editor ───────┬─ Material Sidebar ───────┐
│                          │                          │
│  # My New Strategy      │  📰 Related News         │
│                          │                          │
│  ## Thesis              │  ┌────────────────────┐  │
│  NVIDIA will continue   │  │ NVDA Q1 Beat       │  │
│  its earnings beat      │  │ Revenue $26B       │  │
│  streak through 2025.   │  │ Source: Bloomberg  │  │
│  [cursor]               │  │ [Insert as Citation]│  │
│                          │  └────────────────────┘  │
│  ## Factor Selection    │                          │
│  - Earnings Momentum    │  ┌────────────────────┐  │
│  - Revenue Growth       │  │ SMH Sector Rally   │  │
│  - RSI(14)              │  │ Semi index +8.2%   │  │
│                          │  │ Source: CNBC       │  │
│  ## Risk Management      │  │ [Insert as Citation]│  │
│  Stop-loss: -8%         │  └────────────────────┘  │
│                          │                          │
│                          │  ┌────────────────────┐  │
│                          │  │ Goldman Upgrades   │  │
│                          │  │ PT $1,200 → $1,350 │  │
│                          │  │ Source: Reuters    │  │
│                          │  │ [Insert as Citation]│  │
│                          │  └────────────────────┘  │
│                          │                          │
│                          │  🔍 Search: [NVDA ▾]    │
│                          │  📅 Last: [7 days ▾]    │
│                          │  🏷️ Filter: [All ▾]     │
│                          │  [AI Suggest Sources]    │
└──────────────────────────────────────────────────────┘
```

### 2.2 Material Search & Filters
| Filter | Options | Description |
|--------|---------|-------------|
| Ticker | Single or comma-separated | MANDATORY. Maps to strategy holdings |
| Date | Last 24h / 7d / 30d / 90d | Default: 7d |
| Source | All / Tier1 only / Tier1+Tier2 | Default: All |
| Sentiment | All / Bullish / Bearish / Neutral | For directional strategies |
| Type | All / Earnings / M&A / Regulatory / Product / Analyst | Event type filter |
| Sort by | Relevance / Recency / Impact Score | Default: Relevance |

### 2.3 Citation Format
When creator clicks "Insert as Citation", the following is inserted:

```markdown
> **Source:** Bloomberg (2025-01-15)
> "NVIDIA Q1 FY2025 revenue reaches $26B, exceeding consensus by 18%."
> 📊 Historical impact: +3.2% avg 5-day return after beat (68% win rate, n=147)
> [🔗 Full Article] [📊 Backtest This Event]
```

---

## 3. COPYTRADE NEWS ENHANCER (跟单新闻增强)

### 3.1 Copytrade Confirmation with News Context
```
┌──────────────────────────────────────────────┐
│ 🔔 @TraderPro just adjusted their portfolio    │
│                                                │
│ 📈 Bought more NVDA (+15% position)            │
│                                                │
│ 📰 WHY? (AI-detected context)                  │
│ ┌────────────────────────────────────────────┐│
│ │ 🟢 NVIDIA Q1 FY2025: Revenue $26B          ││
│ │    (+262% YoY). Data center revenue         ││
│ │    $22.6B (+427% YoY). CEO Jensen:         ││
│ │    "Next industrial revolution has begun."  ││
│ │                                             ││
│ │ 📊 Historical: 82% of NVDA beats →          ││
│ │    +3% avg 5-day return.                    ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Amount to Copy: [15% of balance ▼]             │
│ Stop Loss: -8%  (from strategy)                │
│                                                │
│ ☑ I understand this trade is based on news     │
│    catalyst. News-driven trades carry event     │
│    risk (e.g., reversal on profit-taking).      │
│                                                │
│ [📋 Copy This Trade]  [📰 View All News]        │
└──────────────────────────────────────────────┘
```

### 3.2 Copytrade Feed with News Badges
```
┌──────────────────────────────────────────────┐
│ 📋 Copy Trade Feed                            │
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ @TraderPro  ◆ Just Now                     ││
│ │ Action: BUY NVDA · +15% position            ││
│ │ 📰 Earnings Beat (+262% YoY)                ││
│ │ 📊 82% historical win rate on NVDA beats    ││
│ │ [Copy Now]                                  ││
│ └────────────────────────────────────────────┘│
│ ┌────────────────────────────────────────────┐│
│ │ @ValueWhale  ◆ 32 min ago                  ││
│ │ Action: SELL AAPL · -20% position           ││
│ │ 📰 EU Antitrust Fine (€1.8B)               ││
│ │ 📊 Apple fines historically -4.2% avg       ││
│ │ 45 people copied · 💰 Avg: $320             ││
│ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

---

## 4. SOURCE HEALTH DASHBOARD (数据源健康)

### 4.1 Health Monitor Layout
```
┌──────────────────────────────────────────────┐
│ 🏥 Source Health Monitor     Overall: 🟢 95%  │
│                                                │
│ Source             │ Status  │ Latency │ Uptime│
│────────────────────┼─────────┼─────────┼───────│
│ 🇺🇸 Reuters          │ 🟢 OK   │ 120ms   │ 99.9% │
│ 🇺🇸 Bloomberg        │ 🟢 OK   │ 85ms    │ 99.8% │
│ 🇺🇸 SEC.gov          │ 🟢 OK   │ 340ms   │ 99.5% │
│ 🇺🇸 CNBC             │ 🟢 OK   │ 210ms   │ 99.7% │
│ 🇺🇸 Yahoo Finance    │ 🟢 OK   │ 180ms   │ 99.6% │
│ 🇺🇸 Reddit(6 subs)   │ 🟡 DEGR  │ 890ms   │ 97.2% │
│ 🇪🇺 Reuters EU        │ 🟢 OK   │ 150ms   │ 99.8% │
│ 🇨🇳 华尔街见闻        │ 🟡 SLOW  │ 1,240ms │ 98.1% │
│ 🇨🇳 金十数据          │ 🟢 OK   │ 340ms   │ 99.3% │
│ 🇯🇵 Nikkei Asia       │ 🟢 OK   │ 420ms   │ 99.1% │
│ 🇮🇳 Investing India   │ 🔴 DOWN  │ --      │ 94.5% │
│ 💬 StockTwits         │ 🟢 OK   │ 160ms   │ 99.4% │
│ 🛢️ OilPrice           │ 🟢 OK   │ 290ms   │ 99.2% │
│ ...                                                │
│                                                │
│ Legend: 🟢 OK(<500ms) 🟡 Degraded(500-1500ms)  │
│          🔴 Down    ⚪ Not Monitored             │
│                                                │
│ ⏱️ Last full check: 2 min ago                  │
│ 🔄 Auto-check: Every 5 min                      │
└──────────────────────────────────────────────┘
```

### 4.2 Alert Rules
| Condition | Action | Recipient |
|-----------|--------|-----------|
| Single source down >5 min | Log + badge | PM only |
| 2+ Tier1 sources down | Alert + email | PM + Dev |
| Any source latency >2s for >10 min | Degrade to polling | Auto |
| Tier1 uptime <95% (30-day) | Review recommendation | PM |

---

## 5. i18n KEY LIST (55 entries)

### 5.1 News Discussion (15 keys)
| Key | EN |
|-----|-----|
| `discussion_title` | Strategy Discussion |
| `discussion_associated_news` | Associated News |
| `discussion_linked_strategy` | Linked Strategy |
| `discussion_comments_count` | {count} comments |
| `discussion_likes_count` | {count} likes |
| `discussion_pinned` | Pinned |
| `discussion_sort_hot` | Hot |
| `discussion_sort_new` | New |
| `discussion_sort_top` | Top |
| `discussion_sort_recent` | Recent |
| `discussion_write_comment` | Write your analysis or question... |
| `discussion_post_comment` | Post Comment |
| `discussion_reply` | Reply |
| `discussion_report` | Report |
| `discussion_creator_reply` | Creator Reply |

### 5.2 Creator Materials (12 keys)
| Key | EN |
|-----|-----|
| `creator_material_title` | Research Materials |
| `creator_material_related` | Related News |
| `creator_material_insert` | Insert as Citation |
| `creator_material_search` | Search ticker |
| `creator_material_filter_all` | All |
| `creator_material_ai_suggest` | AI Suggest Sources |
| `creator_material_no_results` | No related news found |
| `creator_material_cited` | Source |
| `creator_material_historical` | Historical impact |
| `creator_material_backtest` | Backtest This Event |
| `creator_material_full_article` | Full Article |
| `creator_material_searching` | Searching for relevant news... |

### 5.3 Copytrade News (10 keys)
| Key | EN |
|-----|-----|
| `copytrade_news_title` | Trade Rationale |
| `copytrade_news_why` | WHY? (AI-detected context) |
| `copytrade_news_historical` | Historical |
| `copytrade_news_disclaimer` | I understand this trade is based on news. News-driven trades carry event risk. |
| `copytrade_news_copy` | Copy This Trade |
| `copytrade_news_view_all` | View All News |
| `copytrade_news_badge_earnings` | Earnings |
| `copytrade_news_badge_ma` | M&A |
| `copytrade_news_badge_regulatory` | Regulatory |
| `copytrade_news_copied_by` | {count} copied |

### 5.4 Source Health (8 keys)
| Key | EN |
|-----|-----|
| `source_health_title` | Source Health Monitor |
| `source_health_status_ok` | OK |
| `source_health_status_degraded` | Degraded |
| `source_health_status_slow` | Slow |
| `source_health_status_down` | Down |
| `source_health_last_check` | Last check: {time} |
| `source_health_auto_check` | Auto-check: Every {interval} |
| `source_health_uptime` | Uptime |

### 5.5 Release (10 keys)
| Key | EN |
|-----|-----|
| `release_v270_title` | v2.7.0 NEWS INTELLIGENCE |
| `release_v270_subtitle` | AI-Powered News Integration for Smarter Trading |
| `release_v270_highlight_1` | 40+ global news sources in 9 languages |
| `release_v270_highlight_2` | Real-time sentiment scoring (-100 to +100) |
| `release_v270_highlight_3` | Position risk scanner with automated alerts |
| `release_v270_highlight_4` | News event backtesting with historical data |
| `release_v270_highlight_5` | Event-driven strategy generator |
| `release_v270_highlight_6` | Social sentiment from Reddit & StockTwits |
| `release_v270_highlight_7` | Supply chain impact analysis |
| `release_v270_highlight_8` | Regulatory tracker across 6 regions |
