# Changelog — QUANT MOO v2.7.0 "NEWS INTELLIGENCE"
## 2026-06-16 · Final Release

---

## BREAKING CHANGES

### Fee Model v17.10 Final
- **2 new P2 billing items**: News backtest (1.5U/scan), Event-driven strategy (1.5U/generation)
- **5 P1 billing items**: Morning briefing (1U/day), Position risk scan (1U/scan), Supply chain (1U/scan), Sentiment heatmap (free), Screener (free)
- **API tier pricing**: Free(10req/min)→Basic(5U/mo)→Pro(20U/mo)→Unlimited(50U/mo)
- **Total v2.7.0 revenue items**: 6 (estimated ~3,250U/mo at 1,000 users)

---

## NEW FEATURES

### 📰 News Intelligence Core
| Feature | Round | Description |
|---------|-------|-------------|
| **News Classification** | R238 | 12 market label system (emoji+color+CSS var), 23 sources in 4 tiers, auto-categorization |
| **News Sentiment Factor** | R242 | NEWS_SENTIMENT -100 to +100, 7-tone color scale, market/sector/time 3D |
| **Breaking News Pipeline** | R238 | 60+ P0 keywords, 40+ P1, 20+ P2, push/desktop/sound routing matrix |
| **News Intelligence API** | R242 | 8 endpoints, 4-tier rate limits, unified interface |
| **40+ Global Sources** | R241 | 🇺🇸Reuters/Bloomberg/SEC · 🇨🇳华尔街见闻/金十/新浪 · 🇯🇵Nikkei · 🇮🇳Investing India · 🛢️OilPrice/CommodityTV · 💬Reddit6/StockTwits |
| **Source Health** | R243 | 40-source monitor, latency/uptime tracking, 3-tier alert rules |

### 📊 Visualization
| Feature | Round | Description |
|---------|-------|-------------|
| **Sentiment Heatmap** | R242 | 3D grid (Market×Sector×Time), 7-tone color scale, cell drill-down |
| **Fear & Greed Dashboard** | R242 | 6-component index (News25%+Momentum25%+Breadth15%+PCR15%+VIX10%+SafeHaven10%), interpretive insights |
| **Social Compare Panel** | R241 | Reddit vs StockTwits vs 华尔街见闻 side-by-side |

### 🔴 Risk & Analysis
| Feature | Round | Description |
|---------|-------|-------------|
| **Position Risk Scanner** | R240 | 5-level matrix (Severe/High/Moderate/Low/Info), estimated impact, auto-scan |
| **Supply Chain Impact** | R240 | 4-tier knowledge graph, TSMC example, sector impact cascading |
| **Regulatory Tracker** | R240 | 17 bodies across 6 regions, 5 impact categories, portfolio assessment |

### 📈 Backtest & Strategy
| Feature | Round | Description |
|---------|-------|-------------|
| **News Backtest Engine** | R242 | 12 event types, 3-year data, return distribution, by-market/by-window, 1.5U/scan |
| **Event Strategy Generator** | R242 | 7 templates, AI-suggested parameters, one-click apply, 1.5U/generation |
| **AI Morning Briefing** | R239 | 3-tab (Holdings/Watchlist/Market), sentiment columns, 1U/day, first 3 free |

### 🔍 Discovery
| Feature | Round | Description |
|---------|-------|-------------|
| **News Stock Screener** | R240 | 8 filter dimensions, 6 presets, composite scoring (Sentiment40%+Vol30%+News20%+Price10%) |
| **Screener Custom Builder** | R241 | 6-step wizard, save/share presets |
| **Event Strategy Panel** | R242 | Event select→AI analysis→parameter preview→apply |

### 💬 Social & Community
| Feature | Round | Description |
|---------|-------|-------------|
| **Strategy Discussion** | R243 | Threads, nested replies (3 levels), 4 sort modes, creator reply badge, pinning |
| **Creator Materials** | R243 | Strategy editor sidebar, AI-suggested citations, 6 filter dimensions |
| **Copytrade News** | R243 | Confirmation modal with WHY context, historical stats, feed badges |
| **Social Sentiment** | R241 | Reddit (6 subs: r/wallstreetbets, r/stocks, r/investing, r/cryptocurrency, r/options, r/trading) + StockTwits |

### 🎓 Education
| Feature | Round | Description |
|---------|-------|-------------|
| **Risk Scanner Guide** | R241 | What/Levels/Reading/Auto-Scan 4 sections, 5-level education cards |
| **Screener Guide** | R241 | What/Presets/Reading/Custom/ProTips 5 sections, 6 preset tradeoffs |
| **Daily Briefing Guide** | R239 | 3-step onboarding, 5-term glossary, 6 contextual help triggers |
| **Attribution Education** | R239 | 5 badge states, 4 confidence levels, NVDA example card |

### 🌍 Internationalization
- **9 languages**: EN, ZH-CN, ZH-HK, ZH-TW, JA, KO, DE, FR, ES — maintained across all R238-R243
- **~2,500 total i18n keys** (v2.7.0 contribution: ~315 new keys ≈ ~2,835 entries)
- R238 (45 keys) + R239 (50) + R240 (52) + R241 (60) + R242 (55) + R243 (55) = **317 keys**

### 🧪 Quality
- **TSC**: 0 errors (13 consecutive rounds: R231-R243)
- **Build**: <700ms (stable)
- **E2E**: All 40+ sources validated, 6 AI functions regression-passed

---

## ARCHITECTURE

### News Pipeline
```
23+ Sources → NewsParser → SentimentAnalyzer → NewsRouter →
  ├─ HeatmapGrid (market×sector)
  ├─ FearGreedIndex (6 components)
  ├─ RiskScanner (portfolio match)
  ├─ SupplyChainGraph (tier propagation)
  ├─ RegulatoryTracker (17 bodies)
  ├─ StockScreener (8 dimensions)
  ├─ BacktestEngine (12 event types×3yr)
  ├─ EventStrategy (7 templates)
  ├─ DailyBriefing (3-tab)
  ├─ Discussion (threaded)
  ├─ CreatorMaterials (editor sidebar)
  └─ CopytradeNews (confirmation context)
```

### Key Engines
- `NewsSentimentFactor.ts` — factor value calculation
- `NewsBacktestEngine.ts` — event→forward window analysis
- `EventStrategyGenerator.ts` — earning/M&A/dividend→strategy
- `NewsIntelligenceAPI.ts` — public unified interface
- `NewsDiscussionAPI.ts` — threaded comments + moderation
- `CreatorMaterialEngine.ts` — AI-news matching for analysts
- `CopytradeNewsEnhancer.ts` — trade rationale context
- `SourceHealthDashboard.ts` — 40-source monitor

---

## METRICS

| Metric | v2.6.0 | v2.7.0 | Change |
|--------|--------|--------|--------|
| News Sources | 0 | 40+ | NEW |
| Markets Covered (news) | 0 | 12 | NEW |
| AI News Services | 0 | 6 | NEW |
| News API Endpoints | 0 | 8 | NEW |
| Event Types (backtest) | 0 | 12 | NEW |
| Strategy Templates (event) | 0 | 7 | NEW |
| Regulatory Bodies Tracked | 0 | 17 | NEW |
| i18n Keys (total) | ~2,500 | ~2,800 | +12% |
| TSC Errors | 0 (7 rounds) | 0 (13 rounds) | — |
| @ts-nocheck Remaining | 0 (core) | 0 (core) | — |
| Build Time | 669ms | ~694ms | stable |

---

## ROUND SUMMARY (v2.7.0)

| Round | Focus | Key Deliverables |
|-------|-------|-----------------|
| **R238** | News Classification | 12 markets, 23 sources, 4 tiers, 405 i18n |
| **R239** | AI Sentiment + Briefing | Attribution engine, morning briefing, 450 i18n |
| **R240** | P1 Risk Features | Position risk, supply chain, regulatory, screener, 468 i18n |
| **R241** | Data Sources + Education | CN 3-sources, social 2-sources, risk/screener education, 540 i18n |
| **R242** | P2 Visualization + Backtest | Heatmap, fear-greed, news backtest, event strategy, API, 495 i18n |
| **R243** | Community + Release | Discussion, creator materials, copytrade news, source health, 495 i18n |

**Total**: 6 rounds, ~162 hours across 5-6 agents

---

## UPGRADE GUIDE

### From v2.6.0
1. **Fee model**: v17.10 adds 2 P2 items. `ai-billing.ts` must register `news-backtest` and `event-strategy` as `AIServiceType`.
2. **News sources**: All 40+ sources configured in `CNSources.ts`, `CommodityFeeds.ts`, `SocialFeeds.ts`, `RegionalFeeds.ts`.
3. **Database**: No new tables needed (discussion uses existing comments table).
4. **i18n**: Run R238-R243 i18n scripts to sync ~317 new keys.
5. **API keys**: BrokerConnect Wizard now includes API key encryption (AES-256-GCM). Existing keys auto-migrated.

### Breaking Changes Checklist
- [ ] Register `news-backtest` and `event-strategy` in `ai-billing.ts`
- [ ] Sync i18n with R238-R243 locale additions
- [ ] Verify 40+ source connectivity
- [ ] Verify TSC=0 after all merges
- [ ] Run news E2E test suite

---

# Changelog — QUANT MOO v2.6.0 "QUANTUM"
## 2026-06-16 · Final Release

---

## BREAKING CHANGES

### Fee Model v17.9 Locked
- **NO REFUND iron law**: All purchases final. Only AI analysis failures auto-refund.
- **Revenue model v17.6 → v17.9**: 24 billing touchpoints fully defined and coded.
- **Creator upgrade**: Pure sales count (≥100→L2/20%, ≥1000→L3/10%). Removed subscriber/follower conditions.
- **Transfer ≠ Tipping**: Independent pipelines — transfer 0.3%×2, tipping by creator level.

---

## NEW FEATURES

### 🧠 AI & Strategy System
| Feature | Round | Description |
|---------|-------|-------------|
| **88 Strategy Templates** | R204-R207 | 11 markets (HK/US/Crypto/JP/KR/TW/SG/AU/IN/EU/Commodities), 4 iron rules, factor weights |
| **StrategyWizard 3-Step** | R226 | Market→AI recommend→Preview&tune, 11 entry points |
| **DeepSeekChat Config** | R216 | 44 template conversation starters, 1 USDT/round, 4-tier fallback |
| **AI Services Matrix** | R201-R203 | 7 AI functions: match(1U)/market(1U)/brief(1U)/arbitrage(2U)/signal(0.5U)/stress(2U)/attribution(1.5U) |
| **Notification System** | R232 | 3-tier (urgent/important/info), push+desktop+email+in-app, do-not-disturb |
| **User Profile & Personalization** | R235 | 3 trading styles (Analyst/Tactician/Hunter), 6-question quiz, adaptive evolution |

### 🏪 Creator Marketplace
| Feature | Round | Description |
|---------|-------|-------------|
| **Creator Studio** | R233 | 5-page full design: Manager/Editor/Analytics/Revenue/Profile |
| **Trust Badge System** | R236 | 8 badges (Verified/Low Refund/High Rating/Consistent/Whale/Fast Responder/Top Seller/Editor's Pick) |
| **Strategy Comments** | R236 | Threaded (depth 2), star ratings, moderation, verified purchase badge |
| **Creator Homepage** | R236 | Hero banner + TrustBar + featured carousel + follow |
| **Follow Feed** | R236 | 6 feed types, 4 filters, infinite scroll, follow suggestions |
| **Creator Levels L1-L3** | R233 | Novice(30% fee)→Advanced(20%)→Flagship(10%), auto-upgrade by sales |

### 🎨 UX & Design
| Feature | Round | Description |
|---------|-------|-------------|
| **Dark Mode** | R229 | WCAG 2.1 AA compliant, 10 color categories, colorblind-safe (6 types), triple encoding |
| **Skeleton Loading** | R235-ML | 12 skeleton types, 100% loading coverage |
| **Strategy Compare** | R235-ML | 3-strategy side-by-side, factor radar, return overlay, risk comparison |
| **Hotkey System** | R232-ML | 24 bindable shortcuts, F1-F12, Ctrl combos, ARIA navigation |
| **BrokerConnect Wizard** | R228 | 5-step: select→scan/input→verify→test→done, 13 brokers |
| **Onboarding Flow** | R231 | 5-step guided: Connect→Discover→Configure→Paper→First Trade |
| **FactorStore Browser** | R227 | L1 16 categories→L2 55 groups→L3 factor cards with IC/win rate |
| **Finance Glossary** | R227 | 50 core terms × 11 languages, market-localized |

### 🔒 Security & Trust
| Feature | Round | Description |
|---------|-------|-------------|
| **API Key Encryption** | R228 | AES-256-GCM, local-only, no cloud upload |
| **Sandbox Mode** | R216 | 4-step wizard, risk disclosure, parameter guardrails |
| **Error Boundaries** | R232-ML | Crash reporting with Sentry integration |
| **Audit Logger** | R232-auto | Full operation chain tracking, log level management |
| **USDT Wallet** | R141 | Deposit(0% fee) + withdraw(0.1%) + transfer(0.3%×2) + tipping(10-30%) |

### ⚡ Performance
| Feature | Round | Description |
|---------|-------|-------------|
| **WASM Factor Acceleration** | R236-JVS | 25,000× speedup, Rust→WASM hot paths |
| **Factor Cache Layer** | R232-JVS | LRU cache, pre-compute popular factors |
| **WebSocket Push** | R232-JVS | 13 broker adapters, <100ms push latency |
| **Multi-Account Aggregation** | R235-JVS | Unified order + allocation + risk across brokers |

### 🌍 Internationalization
- **9 languages**: EN, ZH-CN, ZH-HK, ZH-TW, JA, KO, DE, FR, ES
- **~2,500 total i18n keys** across the application
- Market-localized terms: HK (止蝕/沽空), TW (選擇權), JP (空売り/損切り), KR (잉여현금흐름)

### 🧪 Quality
- **Regression**: 120 E2E test cases, 100% pass rate
- **TSC**: 0 errors (7 consecutive rounds)
- **Build**: <700ms
- **Security audit**: 0 high-severity findings

---

## ARCHITECTURE

### Plugin System (R236-auto)
- PluginManager + lifecycle hooks + sandbox isolation
- Plugin marketplace with install/uninstall/update
- 2 example plugins: custom factor + data source
- 8 permission types with runtime enforcement

### Database (SQLite, WAL mode)
- 7 tables: users, signals, copy_trades, dead_letters, wallets, ledger_entries, idempotency_keys
- HMAC-SHA256 checksum protection
- Pessimistic row locks + ACID transactions

### IPC Layer
- 463 unique IPC channels registered
- Zod schema validation on all channels
- @ts-nocheck reduced from 251→0 in core paths

---

## METRICS

| Metric | v2.5.0 | v2.6.0 | Change |
|--------|--------|--------|--------|
| Strategy Templates | 44 | 88 | +100% |
| Markets Covered | 11 | 11 | — |
| AI Services | 0 | 7 | NEW |
| Creator Levels | 0 | 3 (L1-L3) | NEW |
| Trust Badges | 0 | 8 | NEW |
| Test Cases | ~5,500 | 6,200+ | +13% |
| E2E Regression | 0 | 120 (100%) | NEW |
| i18n Keys | ~1,600 | ~2,500 | +56% |
| WASM Speed | — | 25,000× | NEW |
| TSC Errors | 1,473 (R85) | 0 | -100% |
| @ts-nocheck | 292 | 0 (core) | -100% |
| Build Time | ~800ms | 669ms | -16% |

---

## ROUND SUMMARY (v2.6.0)

| Phase | Rounds | Focus |
|-------|--------|-------|
| **Phase 0** | R200-R203 | AI billing + strategy matching + arbitrage/stress/attribution |
| **Phase 1** | R204-R207 | 88 strategy templates, 11 markets |
| **Phase 2** | R208-R212 | VIP data + leaderboard + blind box + insurance |
| **Phase 3** | R214-R225 | NO REFUND + @ts-nocheck cleanup + visual polish + CRYSTAL release |
| **Phase 4** | R226-R229 | StrategyWizard + FactorStore + BrokerConnect + Dark Mode |
| **Phase 5** | R231-R236 | Onboarding + Notifications + Creator Studio + Social + Personalization |

**Total**: ~37 rounds, ~500 hours across 5-6 agents

---

## UPGRADE GUIDE

### From v2.5.0
1. **Fee model**: v17.9 replaces v17.6. All billing uses `BillingTouchpoint` (23 types). Old `auto-trade-billing-v2` deprecated.
2. **Creator levels**: Pure sales now. Remove old `creator-level.ts` (subscriber-based).
3. **AI billing**: `fee-calculator-v2.ts` AI call fee removed. Use `ai-billing.ts` with correct 1-2 USDT rates.
4. **i18n**: 900+ new keys added. Run `gen_r*_i18n.py` scripts to sync.
5. **Database**: Run `migration-v3.sql` to add `strategy_comments`, `user_follows`, `feed_events`, `creator_badges` tables.

### Breaking Changes Checklist
- [ ] Update `fee-calculator-v2.ts`: remove $0.009 AI fee
- [ ] Update `tip.ts`: use sales count, not subscribers
- [ ] Delete `creator-level.ts` (conflicting logic)
- [ ] Run `migration-v3.sql` (4 new tables)
- [ ] Sync i18n with latest locale JSONs
- [ ] Verify TSC=0 after migration
- [ ] Run 120 E2E regression
