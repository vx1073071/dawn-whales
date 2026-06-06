# DAWN WHALES Changelog

## [0.8.1-alpha] - 2026-06-07

### Sprint 2 Phase 5.0 Complete (R41) — 性能/市场/数据收尾

**Tests**: 2076 passed / 0 failed / 9 skipped (134 files) — 8.5× growth from v0.7.0
**Build**: 0 errors, 0 warnings
**TSC**: 0 errors
**Stability**: 5 轮 0 fail 验证 (R41 重点目标)

### R41 (JVS)
- **MultiSourceAggregator** (1668L, 50 tests, 4 源聚合: 东方财富/新浪/腾讯/雪球)
- **StrategyRankingEngine** (577L, 多维度评分, 排名)
- **NotificationEngine** (增强, 渠道/模板/事件类型, 18+ tests)

### R41 (ML)
- **MarketplacePublishPanel** (414L, 策略发布流程)
- **MultiSourceDataPanel** (272L, 4 源对比 UI)
- **Phase5SummaryPanel** (250L, 6 引擎 KPI 看板)

### R41 (dao)
- **Phase 5.0 用户指南** (695L, docs/guides/phase5-user-guide.md)
- **R40 Code Review** (371L, docs/reviews/r40-code-review.md)
- **MultiSource / StrategyRanking API** (466L 总, docs/api/)

### PM 修复
- multi-source-aggregator.test.ts best→bestData / consensus / dataPoints→allSources

## [0.8.0] - 2026-06-07

### Sprint 2 Phase 4 Complete (R29-R40)

**Tests**: 1775 passed / 0 failed / 9 skipped (125 files) — 7.5× growth from v0.7.0
**Build**: 0 errors, 0 warnings
**TSC**: 0 errors
**Brokers**: 3 brokers + Phase 4.4/5.0 决策引擎

### Phase 4.1-4.2 (R29-R33) — ClosedLoop + Risk
- **ClosedLoopExecutor** (620L, paper→live 桥接)
- **RebalanceEngine** (400L, 组合再平衡)
- **Risk Engine v2** (10 检查, VaR/CVaR)
- **PerformanceDashboard** (KPI 实时)
- **TradingCalendar** (节假日 + 交易日)

### Phase 4.3 (R34-R36) — 边界修复
- 5 模式集成: ClosedLoop + Rebalance + Risk + Calendar + Executor
- 测试扩量: 487 → 1484 (+997, 3× 增长)
- 守护循环 487/487 (3 轮稳定)

### Phase 4.4 (R37-R38) — 自主决策引擎
- **AdaptiveParamEngine** (1296L, 15+ tests, 在线学习)
- **RewardEngine** (655L, 10+ tests, PnL+Sharpe)
- **BacktestReplayEngine** (745L, 23+ tests, K线回放)
- **SystemHealthPanel** (Dashboard 实时, 10 引擎监控)
- **AdaptiveParamPanel** (>=400L, 4 strategy types)
- simulationFailureRate 可配置 (deterministic default 0)

### Phase 5.0 (R39-R40) — 智能决策 + Live Trading
- **StrategyOptimizer** (814L, 27+ tests, 网格/随机/贝叶斯 3 模式)
- **MultiTimeframeEngine** (656L, 37+ tests, 7 周期聚合)
- **PortfolioRiskEngine** (695L, 27+ tests, VaR/CVaR/相关性/压力)
- **LiveTradeBridge** (731L, sim→live 桥接, dry-run 模式)
- **StrategyOptimizerPanel** + **PortfolioAnalyticsPanel** + **MultiTimeframePanel** (3 UI)

### 5 虾协作模式 (R37-R40)
- 主副双岗制: ML (UI) / JVS (引擎) / QClaw (测试) / PM (守护+发布) / dao (审查+文档)
- v0.8.0 三轮欠账在 R40 启动 P0 第一优先级
- 互备规则避免单点故障

### 性能改进
- 引擎总代码: 4865L (3 R40 + 3 R39 + 3 R38)
- 测试稳定性: 5 轮 0 fail (random 失败根因修复)
- 1-based → 0-based cursor 统一语义

## [0.7.0] - 2026-06-06

### Sprint 2 Phase 3 Complete (R28 Release)
- **Tests**: 259/259 pass (11 files), exit 0
- **Build**: 0 errors, 0 warnings
- **.exe**: DAWN WHALES Setup 0.7.0.exe
- **TSC**: 0 errors
- **Brokers**: Futu (real) + Moomoo (TCP real, 1185L) + IB (mock, 1768L)

### R28 (ML)
- v0.7.0 Release packaging (version bump + dist:win)
- Full pipeline E2E tests: NL→Strategy→Order→Broker→Risk (15+ tests, 3 brokers)
- README multi-broker architecture + Quickstart guide

### R28 (JVS)
- Moomoo live validation doc (5 API samples)
- UnifiedAccountManager (connect 3 brokers simultaneously)
- OpenDBaseAdapter refactor design doc

### R28 (QClaw)
- Multi-broker performance regression (5 metrics, <15% degradation)
- Test expansion to 280+
- GitHub Actions CI/CD configuration

### R28 (WB/PM)
- Sprint 1 Final Demo published (11 GIFs)
- v0.7.0 Release Announcement
- Sprint 2 Phase 4 roadmap

### R27 (ML)
- BrokerSelector + AccountSummary integration into App Shell
- Multi-Broker E2E tests (13 tests)
- DashboardPage BrokerStatusBar enhancement

### R27 (JVS)
- IB Adapter (1768L, 12 contract mappings)
- StrategyBrokerSelector component (309L)
- Strategy → Broker binding

### R27 (QClaw)
- nl-parser.ts full-scenario tests (42 tests)
- strategy-engine.ts core logic tests (29 tests)
- Multi-Broker IPC integration tests

### R27 (WB/PM)
- Sprint 1 Demo recording checklist
- Build + Test guardian (259 pass)
- Sprint 2 Phase 3 mid-review

### R26 (ML)
- v0.6.0 installer verification checklist
- Sprint 1 retrospective
- R26 Demo script (11 scenes)
- Logo white corners removed + system tray icon fixed

### R26 (JVS)
- Moomoo adapter real TCP connection
- BrokerSelector + BrokerStatusBar components
- AccountAggregator + AccountSummary

### R26 (QClaw)
- RiskEngine v2 5-scenario validation
- Frontend performance analysis
- Test gatekeeper

### R26 (WB/PM)
- Sprint 1 final demo recording
- Sprint 2 Phase 3 roadmap

## [0.6.0] - 2026-06-06

### R26 (ML)
- v0.6.0 installer verification checklist (docs/demo/r26-installer-checklist.md)
- Sprint 1 retrospective (docs/sprints/sprint1-retrospective.md)
- R26 Demo script — 11 scenes (docs/demo/r26-demo-script.md)
- CHANGELOG update to R26
- Logo white corners removed (PNG transparency)
- System tray icon + window icon from logo (was code-drawn diamond)

### R26 (JVS)
- Moomoo adapter real TCP connection (mock → real)
- BrokerSelector component (dropdown + status indicator)
- Cross-broker account asset aggregation

### R26 (QClaw)
- RiskEngine v2 5-scenario validation doc
- Frontend performance analysis (bundle size + cold start + IPC latency)
- Test gatekeeper (129+ maintained)

### R26 (WB/PM)
- Sprint 1 final demo recording (11 scenes)
- Sprint 1 close-out broadcast
- Sprint 2 Phase 3 roadmap (5 milestones: R26–R30)

### R24 (ML)
- Electron .exe packaging (dist:win) verified
- DashboardPage WebSocket real-time quote integration
- package.json test script standardized (vitest run)
- vite.config.ts excludes legacy main() tests

### R24 (JVS)
- preload.ts trade(16) + ws(10) API bridge
- RiskDashboardPage (541 lines) + AlertCenterPage (473 lines)
- WS-Trade bridge engine

### R24 (QClaw)
- TradeExecutor expanded tests (48/48 pass)
- RiskEngine v2 validation

### R25 (JVS)
- WS-Trade E2E: 21 tests pass
- Risk/Alert realtime data integration
- Moomoo Adapter (412 lines, IBrokerAdapter implementation)
- Multi-Broker Design doc (277 lines)

### R25 (ML)
- E2E core scenarios expanded: 30/30 pass
- Trade Dashboard route + Sidebar navigation
- TradeDashboard IPC integration (real broker data)
- Logo white corners removed (PNG transparency)
- System tray icon + window icon from logo (was code-drawn diamond)

### R22-R23
- TradeDashboardPage UI (360 lines)
- Strategy Backtest Pipeline tests (10/10)
- useWebSocketQuotes hook
- Trade Execution Engine (1638 lines)

### v0.5.0 (R20-R21)
- Electron startup fixed (CJS interop patch)
- AlertCenter IPC stubs (8 monitor functions)
- Test coverage: 92.9% → 97.9%

### v0.4.0 (R18-R19)
- Strategy Engine + NL Parser integration
- strategy:execute IPC handler (NL → Strategy → Backtest)
- 38/38 integration tests

### v0.3.0 (R16-R17)
- Notification system
- K-line period selector
- Asset allocation bar charts
- Strategy marketplace publish
- Sidebar balance display
- 15 strategy templates
- Custom app icon

### v0.2.0 (R14-R15)
- Backtest engine (6 indicators, 5 strategies)
- Strategy engine (real-time signals, stop-loss/take-profit)
- NL parser (5 pattern matches, 8 templates)
- Risk engine (7 checks, daily loss limit, alerts)
- Database (7 tables, K-line cache)
- IPC layer (25 handlers, event push)
- CI/CD (GitHub Actions build + release)
- Auto-updater (electron-updater, 4h check)

### v0.1.0 (R1-R13)
- Initial Electron + React + TypeScript scaffold
- Landing page (dawnwhales.io)
- GitHub Pages deployment
- Project architecture docs
