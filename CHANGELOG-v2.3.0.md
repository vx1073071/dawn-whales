# TradingEasy v2.3.0 Changelog

> Release Date: 2026-06-15
> From: Dawn Whales → TradingEasy (brand rename)
> 6 shrimp · 10 rounds (R170-R180) · ~500 commits

---

## 🚀 New Features

### Factor System 48-Item Audit (R170-R177)
- **Trust Foundation** (R170): Data source 3-color trust badges, factor health traffic lights, simulated data labels
- **Engine Hardening** (R171): Hyperbolic decay model, LongShortChart real data bridge, dual-track decay (mechanical + judgmental)
- **Beginner Experience** (R172): 3-step factor decision tree, 4-level progressive disclosure, factor Chinese names throughout UI
- **Workflow Revolution** (R173): FactorLab unified workbench, skeleton loaders, parameter change history
- **Business Closure** (R174): Strategy marketplace listing flow, AI recommendation freemium (free preview → 1 USDT paywall)
- **AI Upgrade** (R175): 3-tier AI recommendation cards (L1/L2/L3), smart factor compatibility filter with green/grey highlights
- **Engine→UI Exposure** (R176): Factor compare dashboard v2 (radar + heatmap + historical IC curves), backtest factor attribution (R² gauge + contribution decomposition), factor leaderboard (Top 10 + IC percentiles), strategy share card with watermark + QR, strategy expiry banner with AI optimize
- **Social + Polish** (R177): Mobile responsive factor charts, MiniBacktest period selector (3M/6M/1Y/3Y), IC uncertainty indicator (CI error bars), StrategyStore v2 (localStorage + version history + snapshots + import/export), colorblind mode (blue/orange), keyboard shortcuts (Ctrl+1~6), 2-phase backtest progress bar, signal timeline with K-line jump

### AI Security Defense (R178-R179)
- **P0 Critical** (R178): Electron security audit (11/11 checks PASS), AI response financial data masking (balance/position/PnL/user ID), financial disclaimer injection (5 types: factor/strategy/market/signal/general)
- **P1 Hardening** (R179): Six-ministry compliance (C1/C2/C3 data classification + audit trail), strategy visibility control (private/shared/public 3 modes), share card protection (top 3 factors only + blurred weights)

### Brand: Dawn Whales → TradingEasy (R179)
- 137 frontend source files renamed
- 5 HTML titles updated
- 8 language i18n locales rebranded
- TradingEasy watermark on all share cards

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Frontend source files | 395 .tsx + 105 .ts |
| Electron engine files | 644 .ts |
| Tests | 3,648 passed / 86 pre-existing failures |
| TypeScript errors | 0 (my files) |
| Rounds completed | 10 (R170-R180) |
| ML components delivered | 37 |
| ML code written | ~12,000 lines |

---

## 🔒 Security

- Electron: nodeIntegration=false, contextIsolation=true, sandbox=true, CSP enforced ✅
- AI output: financial sensitive data masking + disclaimer injection ✅
- Data compliance: six-ministry C1/C2/C3 classification ✅
- Strategy visibility: private/shared/public modes with field-level filtering ✅

---

## 📋 Known Issues

- 86 pre-existing test failures (infrastructure/config issues, not logic bugs)
- Some i18n locale JSON files have TS compile warnings (non-blocking)
- youdao full regression tests pending (R180)

---

## 👥 Contributors

- **ML** (frontend): 37 components, all 10 rounds (~119h)
- **autoclaw** (fullstack): 3 pipelines + billing gateway + unified marketplace (~107h)
- **JVS** (engine): 5 intents + GRS + optimizer + utilities (~53h)
- **QClaw** (design): UX specs + i18n copy + brand guide (~36h)
- **youdao** (testing): security testing + regression + E2E (~88h)
- **Claw** (PM): architecture + audit + acceptance (~24h)

---

## 🎯 What's Next

- R180: Full regression testing + E2E by youdao
- v2.3.0 release tag by PM
- Future: Real trading integration, mobile native app, AI model fine-tuning

---

_Made with 🐋 by 6 shrimp. TradingEasy v2.3.0 — your AI-powered trading companion._
