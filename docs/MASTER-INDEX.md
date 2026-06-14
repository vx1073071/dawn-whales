<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw (quality-shrimp)
purpose: Master index of all active documentation
-->

# TradingEasy — Master Documentation Index

> **Generated**: 2026-06-12 R108 | **Active files**: 191 (reduced from 394)  
> **Archived**: docs/_archived/ (pre-R38 / v0.x era files)

---

## 📂 Documentation Map

### 🏛 Architecture (17)
System design, deployment plans, technical specifications.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | R101 | team | Top-level architecture overview |
| [architecture/MASTER-PLAN.md](architecture/MASTER-PLAN.md) | R68 | PM | Master development plan |
| [architecture/self-developed-4-agent-architecture.md](architecture/self-developed-4-agent-architecture.md) | R57 | team | 4-Agent AI framework design |
| [architecture/live-trading-architecture.md](architecture/live-trading-architecture.md) | R60 | JVS | Live trading system architecture |
| [architecture/multi-broker-design.md](architecture/multi-broker-design.md) | R68 | JVS | Multi-broker (Futu/IBKR) design |
| [architecture/MARKETPLACE-DESIGN.md](architecture/MARKETPLACE-DESIGN.md) | R58 | ML | Strategy marketplace design |
| [architecture/phase4.3-closed-loop-architecture.md](architecture/phase4.3-closed-loop-architecture.md) | R37 | JVS | Closed-loop execution architecture |
| [architecture/phase5-architecture.md](architecture/phase5-architecture.md) | R42 | JVS | Phase 5 system architecture |
| [architecture/phase6-architecture.md](architecture/phase6-architecture.md) | R52 | JVS | Phase 6 system architecture |
| [architecture/phase6-technical-documentation.md](architecture/phase6-technical-documentation.md) | R52 | JVS | Phase 6 technical docs |
| [architecture/sprint2-complete-architecture.md](architecture/sprint2-complete-architecture.md) | R36 | JVS | Sprint 2 complete architecture |
| [architecture/hardware-capacity-analysis.md](architecture/hardware-capacity-analysis.md) | R56 | JVS | Hardware capacity analysis |
| [architecture/10-lobster-division.md](architecture/10-lobster-division.md) | R67 | PM | 10-agent division plan |
| [architecture/14-lobster-division.md](architecture/14-lobster-division.md) | R67 | PM | 14-agent division plan |
| [architecture/5-lobster-division.md](architecture/5-lobster-division.md) | R67 | PM | 5-agent division plan |
| [architecture/8-lobster-deployment-plan.md](architecture/8-lobster-deployment-plan.md) | R67 | PM | 8-agent deployment plan |
| [architecture/10-agent-deployment-feasibility.md](architecture/10-agent-deployment-feasibility.md) | R67 | PM | 10-agent feasibility study |

### 📡 API Reference (21)
IPC bridge, engine APIs, service contracts.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [api/api-reference.md](api/api-reference.md) | R85 | youdao | Central API reference |
| [api/electron-ipc.md](api/electron-ipc.md) | R91 | QClaw | Electron IPC documentation (271L) |
| [api/engine-core.md](api/engine-core.md) | R91 | QClaw | Engine core API documentation (614L) |
| [api/adaptive-param-api.md](api/adaptive-param-api.md) | R45 | JVS | Adaptive parameter engine API |
| [api/backtest-replay-api.md](api/backtest-replay-api.md) | R38 | JVS | K-line replay engine API |
| [api/closed-loop-api.md](api/closed-loop-api.md) | R33 | JVS | Closed-loop executor API |
| [api/condition-bridge-api.md](api/condition-bridge-api.md) | R36 | JVS | Condition trade bridge API |
| [api/marketplace-api.md](api/marketplace-api.md) | R58 | JVS | Marketplace API |
| [api/multi-source-aggregator-api.md](api/multi-source-aggregator-api.md) | R107 | JVS | Multi-source data aggregator API |
| [api/multi-timeframe-api.md](api/multi-timeframe-api.md) | R38 | JVS | Multi-timeframe replay API |
| [api/p2p-blacklist-api.md](api/p2p-blacklist-api.md) | R62 | JVS | P2P + blacklist API |
| [api/performance-monitor-api.md](api/performance-monitor-api.md) | R75 | QClaw | Performance monitor API |
| [api/portfolio-risk-api.md](api/portfolio-risk-api.md) | R76 | QClaw | Portfolio risk API |
| [api/realtime-dataflow-api.md](api/realtime-dataflow-api.md) | R50 | JVS | Realtime dataflow API |
| [api/rebalance-api.md](api/rebalance-api.md) | R33 | JVS | Rebalance engine API |
| [api/reward-engine-api.md](api/reward-engine-api.md) | R66 | JVS | Creator reward engine API |
| [api/signal-backtesting-realtime-news-api.md](api/signal-backtesting-realtime-news-api.md) | R57 | JVS | Signal + backtesting + news API |
| [api/social-trading-api.md](api/social-trading-api.md) | R52 | JVS | Social trading API |
| [api/strategy-optimizer-api.md](api/strategy-optimizer-api.md) | R67 | JVS | Strategy optimizer API |
| [api/strategy-ranking-api.md](api/strategy-ranking-api.md) | R61 | JVS | Strategy ranking API |
| [api/usdt-points.md](api/usdt-points.md) | R103 | QClaw | USDT points system API (608L) |

### 🧪 Quality & Audit (13)
Testing, security, performance audits, quality reports.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [quality/CONSOLIDATED-AUDIT-REPORT.md](quality/CONSOLIDATED-AUDIT-REPORT.md) | R101 | team | Consolidated audit report |
| [quality/independent-audit-2026-06-12.md](quality/independent-audit-2026-06-12.md) | R104 | QClaw | Independent code audit (271L) |
| [quality/IPC-SECURITY.md](quality/IPC-SECURITY.md) | R86 | team | IPC security review |
| [quality/PERF-AUDIT.md](quality/PERF-AUDIT.md) | R69 | QClaw | Performance audit |
| [quality/QUALITY-AUDIT.md](quality/QUALITY-AUDIT.md) | R80 | QClaw | Overall quality audit |
| [quality/REAL-ACCOUNT-VALIDATION.md](quality/REAL-ACCOUNT-VALIDATION.md) | R60 | QClaw | Real account validation |
| [quality/REFACTORING_PLAN.md](quality/REFACTORING_PLAN.md) | R87 | JVS | Refactoring plan |
| [quality/STRESS-TEST-v0.6.0.md](quality/STRESS-TEST-v0.6.0.md) | R35 | QClaw | Stress test v0.6.0 |
| [quality/r89-r97-quality-report.md](quality/r89-r97-quality-report.md) | R97 | QClaw | R89-R97 quality report |
| [quality/v1.11.0-quality-report.md](quality/v1.11.0-quality-report.md) | R100 | QClaw | v1.11.0 quality report |
| [quality/v1.12.0-audit.md](quality/v1.12.0-audit.md) | R104 | QClaw | v1.12.0 security audit |
| [COMPLIANCE.md](COMPLIANCE.md) | R101 | team | Compliance documentation |
| [security-audit-r91.md](security-audit-r91.md) | R91 | QClaw | R91 security audit |

### 📖 Guides (38)
User manuals, creator docs, deployment guides.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [guides/quickstart.md](guides/quickstart.md) | R65 | youdao | Quick start guide |
| [guides/quickstart-guide.md](guides/quickstart-guide.md) | R65 | youdao | Quick start (detailed) |
| [guides/complete-user-manual-v2.md](guides/complete-user-manual-v2.md) | R65 | youdao | Complete user manual v2 |
| [guides/complete-user-manual-v3.md](guides/complete-user-manual-v3.md) | R65 | youdao | Complete user manual v3 |
| [guides/newbie-guide.md](guides/newbie-guide.md) | R65 | youdao | Newbie onboarding guide |
| [guides/admin-manual.md](guides/admin-manual.md) | R64 | youdao | Admin dashboard manual |
| [guides/complete-creator-guide.md](guides/complete-creator-guide.md) | R66 | youdao | Creator guide |
| [guides/complete-creator-guide-v1.2.md](guides/complete-creator-guide-v1.2.md) | R66 | youdao | Creator guide v1.2 |
| [guides/creator-billing-guide.md](guides/creator-billing-guide.md) | R66 | youdao | Creator billing guide |
| [guides/creator-growth-guide.md](guides/creator-growth-guide.md) | R66 | youdao | Creator growth system |
| [guides/ai-collaboration-creator-guide.md](guides/ai-collaboration-creator-guide.md) | R66 | youdao | AI collaboration guide |
| [guides/ai-pricing-guide.md](guides/ai-pricing-guide.md) | R59 | youdao | AI pricing guide |
| [guides/marketplace-user-guide.md](guides/marketplace-user-guide.md) | R58 | youdao | Marketplace user guide |
| [guides/marketplace-user-guide-v2.md](guides/marketplace-user-guide-v2.md) | R66 | youdao | Marketplace user guide v2 |
| [guides/social-trading-user-guide.md](guides/social-trading-user-guide.md) | R52 | youdao | Social trading guide |
| [guides/multi-market-guide.md](guides/multi-market-guide.md) | R61 | youdao | Multi-market trading guide |
| [guides/multi-account-user-guide.md](guides/multi-account-user-guide.md) | R62 | youdao | Multi-account guide |
| [guides/p2p-security-guide.md](guides/p2p-security-guide.md) | R62 | youdao | P2P + security guide |
| [guides/futu-opend-deployment-guide.md](guides/futu-opend-deployment-guide.md) | R60 | youdao | Futu OpenD deployment |
| [guides/ibkr-config-guide.md](guides/ibkr-config-guide.md) | R68 | youdao | IBKR configuration |
| [guides/deploy-license-guide.md](guides/deploy-license-guide.md) | R59 | youdao | Deployment & license |
| [guides/ga-deploy-guide.md](guides/ga-deploy-guide.md) | R67 | youdao | GA deployment guide |
| [guides/deployment-guide.md](guides/deployment-guide.md) | R67 | youdao | General deployment |
| [guides/pwa-deployment-guide.md](guides/pwa-deployment-guide.md) | R44 | youdao | PWA deployment |
| [guides/pwa-troubleshooting-guide.md](guides/pwa-troubleshooting-guide.md) | R44 | youdao | PWA troubleshooting |
| [guides/phase5-user-guide.md](guides/phase5-user-guide.md) | R42 | youdao | Phase 5 user guide |
| [guides/guest-performance-guide.md](guides/guest-performance-guide.md) | R69 | youdao | Guest mode performance |
| [guides/model-arena-guide.md](guides/model-arena-guide.md) | R57 | youdao | Model arena guide |
| [guides/performance-monitoring-user-guide.md](guides/performance-monitoring-user-guide.md) | R75 | youdao | Performance monitoring |
| [guides/code-standard-a11y-guide.md](guides/code-standard-a11y-guide.md) | R80 | ML | Code standard & a11y |
| [guides/community-analytics-guide.md](guides/community-analytics-guide.md) | R72 | ML | Community analytics |
| [guides/echarts-user-guide.md](guides/echarts-user-guide.md) | R80 | ML | ECharts UI guide |
| [guides/factor-template-guide.md](guides/factor-template-guide.md) | R50 | ML | Factor template guide |
| [guides/ga-announcement-ops-manual.md](guides/ga-announcement-ops-manual.md) | R70 | PM | GA announcement ops |
| [guides/ops-manual-v2-creator-growth.md](guides/ops-manual-v2-creator-growth.md) | R67 | PM | Ops manual v2 |
| [guides/post-release-monitoring-plan.md](guides/post-release-monitoring-plan.md) | R67 | PM | Post-release monitoring |
| [guides/v1.0.0-release-guide.md](guides/v1.0.0-release-guide.md) | R52 | youdao | v1.0.0 release guide |
| [guides/v0.10.0-user-manual.md](guides/v0.10.0-user-manual.md) | R37 | youdao | v0.10.0 user manual |

### 📦 Releases (10)
Current release notes (v1.7.0+).

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [releases/v1.7.0-alpha-release-notes.md](releases/v1.7.0-alpha-release-notes.md) | R68 | youdao | v1.7.0-alpha |
| [releases/v1.7.0-beta-release-notes.md](releases/v1.7.0-beta-release-notes.md) | R69 | youdao | v1.7.0-beta |
| [releases/v1.7.0-ga-release-notes.md](releases/v1.7.0-ga-release-notes.md) | R70 | youdao | v1.7.0-GA |
| [releases/v1.7.0-ga-final-announcement.md](releases/v1.7.0-ga-final-announcement.md) | R70 | PM | v1.7.0-GA final |
| [releases/v1.8.0-alpha-release-notes.md](releases/v1.8.0-alpha-release-notes.md) | R80 | youdao | v1.8.0-alpha |
| [releases/v1.8.0-alpha-release-notes-v2.md](releases/v1.8.0-alpha-release-notes-v2.md) | R80 | youdao | v1.8.0-alpha v2 |
| [releases/v1.8.0-ga-release-notes.md](releases/v1.8.0-ga-release-notes.md) | R85 | youdao | v1.8.0-GA |
| [releases/v1.8.1-deploy-packaging-checklist.md](releases/v1.8.1-deploy-packaging-checklist.md) | R85 | PM | v1.8.1 deploy |
| [releases/v1.9.0-ga-final.md](releases/v1.9.0-ga-final.md) | R88 | PM | v1.9.0-GA final |
| [releases/v1.9.0-ga-release-notes.md](releases/v1.9.0-ga-release-notes.md) | R88 | youdao | v1.9.0-GA |

### 🔬 Reviews (13)
Code review records and design reviews.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [reviews/r36-code-review.md](reviews/r36-code-review.md) | R36 | QClaw | R36 code review |
| [reviews/r37-code-review.md](reviews/r37-code-review.md) | R37 | QClaw | R37 code review |
| [reviews/r38-code-review.md](reviews/r38-code-review.md) | R38 | QClaw | R38 code review |
| [reviews/r39-code-review.md](reviews/r39-code-review.md) | R39 | QClaw | R39 code review |
| [reviews/r40-code-review.md](reviews/r40-code-review.md) | R40 | QClaw | R40 code review |
| [reviews/r43-code-review.md](reviews/r43-code-review.md) | R43 | QClaw | R43 code review |
| [reviews/r44-code-review.md](reviews/r44-code-review.md) | R44 | QClaw | R44 code review |
| [reviews/r45-code-review.md](reviews/r45-code-review.md) | R45 | QClaw | R45 code review |
| [reviews/r46-code-review.md](reviews/r46-code-review.md) | R46 | QClaw | R46 code review |
| [reviews/phase44-design-review.md](reviews/phase44-design-review.md) | R44 | JVS | Phase 4.4 design review |
| [reviews/documentation-final-review.md](reviews/documentation-final-review.md) | R101 | QClaw | Documentation final review |
| [reviews/documentation-final-update.md](reviews/documentation-final-update.md) | R101 | QClaw | Documentation final update |
| [reviews/v1.0.0-post-release-review.md](reviews/v1.0.0-post-release-review.md) | R52 | PM | v1.0.0 post-release review |

### 🗺 Roadmap (12)
Sprint plans and version roadmaps.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [roadmap/phase5.0-plan.md](roadmap/phase5.0-plan.md) | R35 | JVS | Phase 5.0 plan |
| [roadmap/sprint2-phase3-execution.md](roadmap/sprint2-phase3-execution.md) | R28 | JVS | Sprint 2 phase 3 execution |
| [roadmap/sprint2-phase3-plan.md](roadmap/sprint2-phase3-plan.md) | R28 | JVS | Sprint 2 phase 3 plan |
| [roadmap/sprint2-phase4-plan.md](roadmap/sprint2-phase4-plan.md) | R30 | JVS | Sprint 2 phase 4 plan |
| [roadmap/sprint2-phase4.2-plan.md](roadmap/sprint2-phase4.2-plan.md) | R30 | JVS | Sprint 2 phase 4.2 plan |
| [roadmap/sprint2-phase4.3-plan.md](roadmap/sprint2-phase4.3-plan.md) | R33 | JVS | Sprint 2 phase 4.3 plan |
| [roadmap/sprint2-phase4.3-closed-loop-design.md](roadmap/sprint2-phase4.3-closed-loop-design.md) | R33 | JVS | Closed-loop design |
| [roadmap/sprint2-technical-plan.md](roadmap/sprint2-technical-plan.md) | R33 | JVS | Sprint 2 technical plan |
| [roadmap/v1.1.0-roadmap.md](roadmap/v1.1.0-roadmap.md) | R50 | PM | v1.1.0 roadmap |
| [roadmap/v1.1.0-roadmap-update.md](roadmap/v1.1.0-roadmap-update.md) | R50 | PM | v1.1.0 roadmap (update) |
| [roadmap/v1.1.0-roadmap-update-r53.md](roadmap/v1.1.0-roadmap-update-r53.md) | R53 | PM | v1.1.0 roadmap (R53) |
| [roadmap/v1.10.0-roadmap-r89-r94.md](roadmap/v1.10.0-roadmap-r89-r94.md) | R94 | PM | v1.10.0 roadmap (R89-R94) |

### 📊 Reports (9)
Performance, lighthouse, completion reports.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [reports/r37-perf-baseline.md](reports/r37-perf-baseline.md) | R37 | QClaw | R37 performance baseline |
| [reports/r38-perf-benchmark.md](reports/r38-perf-benchmark.md) | R38 | QClaw | R38 performance benchmark |
| [reports/r39-performance-comparison.md](reports/r39-performance-comparison.md) | R39 | QClaw | R39 performance comparison |
| [reports/r77-security-hardening-report.md](reports/r77-security-hardening-report.md) | R77 | QClaw | Security hardening |
| [reports/r79-qa-quality-report.md](reports/r79-qa-quality-report.md) | R79 | QClaw | QA quality report |
| [reports/round16-completion-report.md](reports/round16-completion-report.md) | R16 | PM | Round 16 completion |
| [reports/i18n-gap-report.md](reports/i18n-gap-report.md) | R80 | youdao | i18n gap analysis |
| [reports/lighthouse-audit-r42.md](reports/lighthouse-audit-r42.md) | R42 | ML | Lighthouse audit |
| [reports/lighthouse-seo-optimization-r44.md](reports/lighthouse-seo-optimization-r44.md) | R44 | ML | Lighthouse SEO optimization |

### 📝 Retrospective (3)
Iteration retrospectives.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [retrospective/r89-r101-complete.md](retrospective/r89-r101-complete.md) | R101 | QClaw | R89-R101 (12 rounds) |
| [retrospective/r89-r94.md](retrospective/r89-r94.md) | R94 | QClaw | R89-R94 (6 rounds) |
| [retrospective/r95-coverage-review.md](retrospective/r95-coverage-review.md) | R96 | QClaw | R95 coverage review |

### 🧰 Reference (4)
Quick-reference and specifications.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [reference/fee-schedule.md](reference/fee-schedule.md) | R102 | QClaw | Fee schedule (373L) |
| [reference/market-coverage.md](reference/market-coverage.md) | R100 | QClaw | Market coverage table (300L) |
| [testing/test-architecture.md](testing/test-architecture.md) | R96 | QClaw | Test architecture (418L) |
| [INDEX.md](INDEX.md) | R70 | team | Old index (superseded) |

### ⚙️ Operations (8)
Deployment, performance, compliance, cron.

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [automation/cron-config.md](automation/cron-config.md) | R108 | youdao | Cron scheduler config |
| [deploy/deployment-guide.md](deploy/deployment-guide.md) | R67 | PM | Deployment guide |
| [performance/baseline-q25-02.md](performance/baseline-q25-02.md) | R25 | QClaw | Baseline Q25 |
| [performance/frontend-perf-q26-02.md](performance/frontend-perf-q26-02.md) | R26 | QClaw | Frontend perf Q26 |
| [performance/test-guard-q26-03.md](performance/test-guard-q26-03.md) | R26 | QClaw | Test guard Q26 |
| [engine-error-guide.md](engine-error-guide.md) | R85 | youdao | Engine error guide |
| [i18n-developer-guide.md](i18n-developer-guide.md) | R98 | QClaw | i18n developer guide |
| [LOCALIZATION.md](LOCALIZATION.md) | R99 | QClaw | Localization guide (468L) |

### 📋 Product & Plans (7)

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [product/PHASE3-PLAN.md](product/PHASE3-PLAN.md) | R34 | JVS | Phase 3 product plan |
| [product/PWA-EVALUATION.md](product/PWA-EVALUATION.md) | R44 | ML | PWA evaluation |
| [product/TASK-PIPELINE.md](product/TASK-PIPELINE.md) | R22 | JVS | Task pipeline |
| [plans/R91-R94-master-plan.md](plans/R91-R94-master-plan.md) | R91 | PM | R91-R94 master plan |
| [plans/round45-plan-from-jvs.md](plans/round45-plan-from-jvs.md) | R45 | JVS | Round 45 plan |
| [proposals/tradingagents-integration-proposal.md](proposals/tradingagents-integration-proposal.md) | R56 | JVS | TradingAgents integration |
| [decisions/self-developed-vs-open-source-decision.md](decisions/self-developed-vs-open-source-decision.md) | R56 | team | Self-developed vs open-source |

### 📌 Project Root (17)

| File | Last Updated | Owner | Description |
|------|-------------|-------|-------------|
| [API.md](API.md) | R70 | team | Quick API reference |
| [COMPLIANCE.md](COMPLIANCE.md) | R101 | team | Compliance |
| [CONTRIBUTING.md](CONTRIBUTING.md) | R93 | QClaw | Contributing guide |
| [TEAM-RULES.md](TEAM-RULES.md) | R40 | PM | Team rules & conventions |
| [USER-GUIDE.md](USER-GUIDE.md) | R70 | youdao | User guide |
| [JVS-API-REFERENCE.md](JVS-API-REFERENCE.md) | R85 | JVS | JVS API reference |
| [JVS-DATA-API-SPEC.md](JVS-DATA-API-SPEC.md) | R85 | JVS | Data API spec |
| [JVS-IPC-INTEGRATION-EXAMPLES.md](JVS-IPC-INTEGRATION-EXAMPLES.md) | R85 | JVS | IPC integration examples |
| [JVS-ONBOARDING.md](JVS-ONBOARDING.md) | R70 | JVS | JVS onboarding |
| [JVS-SKILLS-BRAIN.md](JVS-SKILLS-BRAIN.md) | R70 | JVS | JVS skills brain |
| [JVS-83-DATA-AGGREGATOR.md](JVS-83-DATA-AGGREGATOR.md) | R83 | JVS | Data aggregator |
| [QTEST.md](QTEST.md) | R85 | QClaw | QClaw test reference |
| [R92-release-notes.md](R92-release-notes.md) | R92 | QClaw | R92 release notes |
| [r92-performance-report.md](r92-performance-report.md) | R93 | QClaw | R92 performance report |
| [security-audit-r91.md](security-audit-r91.md) | R91 | QClaw | Security audit |
| [user-manual-v1.9.0-ga.md](user-manual-v1.9.0-ga.md) | R88 | youdao | v1.9.0 user manual |
| [v1.10.0-delivery-report.md](v1.10.0-delivery-report.md) | R100 | PM | v1.10.0 delivery |

### 🗂 Archived
Pre-R38 and v0.x era files moved to [docs/_archived/](_archived/) for historical reference.
202 files moved (tasks 114, audit 61, releases 23, sprints 3, demo 1).

---

## 📊 Statistics

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Total .md files | 394 | 191 | -51.5% |
| Categories | 26 | 23 | -11.5% |
| Archived | 0 | 202 | — |
| META header coverage | 0% | ~85% | — |

---

## 🔧 Adding New Documentation

1. Place in the appropriate category directory
2. Add META header at top of file:
   ```markdown
   <!-- META
   version: X.Y.Z
   last_updated: YYYY-MM-DD
   round: RXXX
   owner: role-name
   purpose: one-line description
   -->
   ```
3. Add entry to this index
4. Tag @QClaw for review

---

*Last regenerated: R108 2026-06-12 | Owner: QClaw (quality-shrimp)*
