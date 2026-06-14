# TradingEasy v2.4.0 Changelog

> Release Date: 2026-06-15
> From: TradingEasy v2.3.0 → v2.4.0
> 6 shrimp · 14 rounds (R170-R183)

---

## 🚀 v2.4.0 New Features (R181-R183)

### AI Experience Upgrade
- **AI price transparency**: Every AI action button now shows price (1.0U/1.5U/3.0U) or "free" label. Insufficient balance auto-greys out.
- **Two-phase AI progress bar**: 6-step visual progress (connect→IC→compatibility→optimize→backtest→format) with remaining time
- **Confidence visualization**: Star ratings (★) + color-coded badges replacing bare numbers. IC/IR/Sharpe all get visual confidence levels.
- **Personalized freemium upgrade**: Lock icons replaced with personalized reasons ("You have 3 momentum factors — unlock to see decay trends")
- **Smart context prefill**: Auto-detects portfolio composition and style (momentum/value/defensive) and pre-fills AI recommendations
- **AI conversation history search**: Search past 50 AI Q&A pairs with keyword highlighting and category filters
- **Multi-turn dialogue memory**: Remembers user preferences across sessions. "Welcome back" summary on return.
- **Thumbs up/down feedback**: Rate each AI response. Downvotes trigger reason picker (5 categories). Feeds into trust score.

---

## 📊 Cumulative Stats (R170-R183)

| Metric | v2.3.0 | v2.4.0 |
|--------|--------|--------|
| Frontend components | 395 tsx | 402 tsx |
| ML components delivered | 37 | 46 |
| AI security modules | 17 | 22 |
| AI UX components | — | 12 |
| Total rounds | 10 | 14 |
| ML code written | ~12,000 lines | ~16,000 lines |

---

## 🔒 Security (R178-R180 + R181-R183)
- Electron: 11/11 security checks PASS
- AI output: financial data masking + disclaimer injection
- Six-ministry compliance: C1/C2/C3 data classification
- Strategy visibility: private/shared/public modes
- Model names: cleaned from 4 agent files
- Prompt injection guard: active on all AI call paths
- Rate limiter: 5 req/min per user
- Audit anomaly detector: auto-block on suspicious patterns
- IPC permission: 41 handlers tiered (tier1/2/3)

---

## 🎨 AI UX Components (R181-R183)

| Component | Lines | Feature |
|-----------|-------|---------|
| AIPriceBadge | 200 | 12 AI features pricing + auto-grey |
| MetricHumanizer | 300 | 7 metrics → human analogies |
| AIProgressIndicator | 180 | 6-step two-phase progress |
| ConfidenceVisualizer | 250 | Star ratings + color badges |
| FreemiumUpgrade | 160 | Personalized upgrade reasons |
| SmartContextPrefill | 200 | Portfolio-aware auto-fill |
| AIHistorySearch | 260 | Searchable conversation history |
| MultiTurnMemory | 230 | Cross-session preference memory |
| AIFeedbackRating | 200 | Thumbs up/down + reason picker |

---

## 🏁 Final Status

- **TSC errors**: 0 (ML files)
- **Tests**: 3,648 passed
- **Brand**: TradingEasy (283 files renamed)
- **Rounds completed**: 14 (R170-R183)
- **Total shrimp**: 6 (ML 46 components, autoclaw pipelines, JVS engine, QClaw design, youdao testing, Claw PM)
- **Lines of ML code**: ~16,000

---

## 👥 Contributors

- **ML** (frontend): 46 components across 14 rounds
- **autoclaw** (fullstack): 3 pipelines + billing gateway + marketplace + AI output guard
- **JVS** (engine): 14 intents + GRS + optimizer + security lockdown + prompt guard
- **QClaw** (design): UX specs + i18n copy + brand guide + adversarial testing
- **youdao** (testing): 88h security testing + regression + E2E
- **Claw** (PM): 14 rounds architecture + audit + acceptance

---

_Made with 🦐 by 6 shrimp. TradingEasy v2.4.0 — your AI-powered trading companion._
