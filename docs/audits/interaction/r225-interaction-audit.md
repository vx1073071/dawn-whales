# R225 全量组件交互一致性终审报告

> **审计时间**: 2026-06-15T21:11:49.774Z
> **审计范围**: 453 组件 (src/components/)
> **审计引擎**: interaction-audit.ts (10维自动检测)
> **审计人**: ML (R225-ML#1)

---

## 📊 总体评分

| 指标 | 值 |
|------|-----|
| 审计组件数 | 453 |
| 平均得分 | **77/100** |
| 优秀 (≥80) | 150 (33%) |
| 警告 (60-79) | 291 (64%) |
| 不合格 (<60) | 12 (3%) |

## 📈 10维度合规率

| 维度 | 合规率 | 状态 |
|------|--------|:--:|
| Loading状态 | 32% | 🔴 |
| Error处理 | 62% | ⚠️ |
| Empty状态 | 16% | 🔴 |
| 键盘支持 | 6% | 🔴 |
| ARIA标签 | 2% | 🔴 |
| Tooltip提示 | 43% | 🔴 |
| 确认Modal | 18% | 🔴 |
| 操作反馈 | 14% | 🔴 |
| 过渡动画 | 77% | ⚠️ |
| i18n国际化 | 90% | ✅ |

## 🎯 综合评级: **B (良好)**

---

## 📋 全部组件审计明细

| # | 组件 | 得分 | L | E | Em | K | A | T | C | F | An | I | 问题 |
|---|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|------|
| 1 | IndicatorTemplates | 49 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 2 | CopyTradeOnboarding | 59 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 3 | CopyTradeStatusPanel | 59 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 4 | PnLOverview | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 5 | DataTrustBadge | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 6 | FactorHealthLight | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 7 | AdvancedFactorCard | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 8 | EntryFactorGallery | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 9 | FactorFullPipeline | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 10 | FactorHealthAlert | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 11 | MarketSpecificFactorCard | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 12 | SeasonalityCalendar | 59 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 13 | DesktopCleanupShell | 62 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含异步fetch但无Loading状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 14 | InstallPrompt | 62 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含异步操作但无Error处理, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 15 | AIHistorySearch | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 16 | BacktestComparisonPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 17 | AIBillingPanel | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 18 | HelpCenter | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 19 | MarketPanel | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 20 | P2PTransferRecords | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 21 | PointsTopUpPage | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含异步fetch但无Loading状态, 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 22 | SettlementTimeline | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 23 | FractionalShareControls | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 24 | RealTimeOrderPanel | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 25 | P2PBlacklistPanel | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 26 | CopyTradeSettings | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含硬编码中文但未用i18n |
| 27 | OrderConfirmModal | 64 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含异步操作但无Error处理, 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 28 | KLineChartPro | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 29 | LanguageSwitcher | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 30 | ParamChangeHistory | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 31 | FactorWeightSlider | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 32 | LiveBacktestBias | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 33 | MultiAccountSwitcher | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 34 | BrokerSelector | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 35 | MultiPanelLayout | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 36 | CapitalFlowPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 37 | ConsumerDashboard | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 38 | MarginDashboard | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 39 | SectorRotationPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 40 | MarketplaceSearch | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 41 | MobileResponsive | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 42 | AlertCenterPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 43 | AnomalyAlertPanel | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 44 | PortfolioStressTest | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 45 | PriceAlertPanel | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 46 | TradingJournal | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 47 | RoadmapPage | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 48 | TimezoneSelector | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 49 | DecayCurveChart | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 50 | FactorCompareDashboard | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 51 | FactorDiscoveryWizard | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 52 | FactorLabWorkbench | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 53 | LongShortChart | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 54 | StrategyImportExportUI | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 55 | StrategyDetail | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 56 | TemplateBrowser | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 57 | DataExportPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 58 | FactorWeightPanel | 64 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 59 | LeaderboardPage | 64 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 60 | WeeklyRankingPage | 64 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 61 | ArbitragePanel | 67 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 62 | CopyTradeBrokerSelector | 67 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 63 | SignalProviderDashboard | 67 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 64 | ChartStates | 67 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 65 | AIPriceBadge | 67 | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 66 | DataClassificationBadge | 67 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal, 含硬编码中文但未用i18n |
| 67 | FreemiumUpgrade | 67 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message), 含硬编码中文但未用i18n |
| 68 | BrokerStatusBar | 69 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含异步fetch但无Loading状态, 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 69 | SignalProviderManage | 69 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 70 | ChartInteractionEnhancements | 69 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 71 | FactorOnboardingWizard | 69 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 多处按钮无Tooltip, 含用户操作但无反馈(Toast/Message) |
| 72 | NotificationToast | 69 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 73 | StrategyExpiryBanner | 69 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含异步操作但无Error处理, 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 74 | SignalPushPopupV2 | 69 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 多处按钮无Tooltip, 含用户操作但无反馈(Toast/Message) |
| 75 | useMobileDetect | 72 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 76 | FactorSearchBarV2 | 72 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 77 | KeyboardShortcutsPanel | 72 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 78 | LiveMonitorPage | 72 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 79 | NewsDashboardPage | 72 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 80 | StockOverviewPage | 72 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 81 | StrategyPublishForm | 72 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 82 | WatchlistManager | 72 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 83 | ServerConnectionStatus | 72 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 84 | UpdatePanel | 72 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 85 | FactorDecayDashboard | 72 | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含异步操作但无Error处理, 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 86 | SensitivityHeatmap | 72 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 87 | DataQualityPage | 72 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 88 | PositionMonitorPanel | 72 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含异步fetch但无Loading状态, 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 89 | AICostDashboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 90 | AIFeedbackRating | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 91 | CreatorLLMConfigPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 92 | LLMCreatorConfigPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 93 | MultiTurnMemory | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 94 | StrategySignalPreview | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 95 | BacktestReportPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 96 | WalkForwardPanel | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 97 | AgentDataSourcePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 98 | AIDrawingPatternPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 99 | PineScriptEditor | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 100 | CreatorLeaderboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 101 | GrowthPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 102 | SignalPerformancePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 103 | SignalSquare | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 104 | StrategyMarketplace | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 105 | CopyPolish | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 106 | DesktopShell | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 107 | DownloadPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 108 | GAFinalPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 109 | LandingPageV18 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 110 | CreditsHistoryPage | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 111 | AdvancedKLineChart | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 112 | BacktestPerformancePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 113 | FactorAnalysisPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 114 | PortfolioOptimizationPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 115 | SignalBacktestNewsPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 116 | AchievementOnboarding | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 117 | OnboardingFullKit | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 118 | DataSourcePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 119 | FractionalTradePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 120 | IBKRBrokerPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 121 | LiveExecutionConsole | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 122 | MultiMarketExecutionPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 123 | RiskControlDashboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 124 | TransactionMonitor | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 125 | AdminDashboardV2 | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 126 | DisputeCenter | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 127 | P2PTransferPage | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 128 | SecurityCenter | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 129 | USDTPaymentPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 130 | BrokerConnectionIndicator | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 131 | BrokerE2E | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 132 | EnhancedPanels | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 133 | SignalDashboard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 134 | TradeHistoryPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 135 | AggregatedOrderBook | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 136 | AlertAndFundFlow | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 137 | ArbitrageMonitor | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 138 | CBBOPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 139 | DrawingToolbar | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 140 | HeatmapTreemap | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 141 | IndicatorPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 142 | MarketScanner | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 143 | ReplayAndMicrostructure | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 144 | TickTimeline | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 145 | TradeEssentials | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 146 | VolumeProfileSpread | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 147 | SmartContextPrefill | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 148 | StrategyVisibilityControl | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 149 | AIDailyDigestPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 150 | LiveTradingPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 151 | MultiTimeframePanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 152 | PerformanceDashboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 153 | PerformanceMonitorPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 154 | Phase5SummaryPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 155 | PortfolioAnalyticsPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 156 | SystemHealthPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 157 | MultiSourceDataPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 158 | AIParameterOptimizer | 74 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 159 | CommodityFactorCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 160 | CommodityLeaderboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 161 | CommodityOnboarding | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 162 | COTTrackerPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 163 | DeepDiagnosisPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 164 | FactorCrowdingAlert | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 165 | FactorFinalHub | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 166 | FactorFriendCircle | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 167 | FactorLevelSelector | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 168 | FactorMarketSwitch | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 169 | FactorOnboarding | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 170 | FactorParameterHeatmap | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 171 | FactorPK | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 172 | FactorRollingIC | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 173 | FactorSandbox | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 174 | FactorWeeklyLeaderboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 175 | INEUFactorCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 176 | JPTWFactorCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 177 | KRSAMarketFactorCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 178 | MarketFlag | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 179 | MarketLeaderboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 180 | MarketSelectorV2 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 181 | MarketSelectorV3 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 182 | MarketSelectorV4 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 183 | ProModeSwitch | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 184 | RatioCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 185 | ScenarioPackSelector | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 186 | StrategyHealthRadar | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 187 | FeatureGuideV2 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 188 | FeeScheduleModal | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 189 | LaunchHeroV2 | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 190 | Sidebar | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 191 | GreeksPanel | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 192 | CachedDataExplorer | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 193 | DailyReportPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 194 | DataQualityMonitorPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 195 | DragonTigerPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 196 | MacroDashboardPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 197 | MarketHeatmapPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 198 | QuoteSourceBadge | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 199 | SentimentStreamDashboard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 200 | SmartPickerPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 201 | MarketplaceDetail | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 202 | MarketplaceEnhanced | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 203 | MobileNavigation | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 204 | OnboardingModal | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 205 | OnboardingWizard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 多处按钮无Tooltip |
| 206 | OrdersPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 207 | TradingDeskPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 208 | PortfolioPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 209 | PortfolioRebalancerPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 210 | EconomicCalendar | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 211 | MarketHeatmap | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 212 | MarketMovers | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 213 | PositionDetailPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 214 | RiskDashboardPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 215 | RiskVisualizer | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 216 | SentimentGauge | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 217 | SignalTimeline | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 218 | SystemLog | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 219 | CurrencySelector | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 220 | SettingsPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 221 | SignalShareComponents | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 222 | AdaptiveParamPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 223 | ClosedLoopConfigPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 224 | ContextualAITrigger | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 225 | FactorExposurePage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 226 | FactorLeaderboard | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 227 | FactorListingPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 228 | FactorStylePicker | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 229 | ICUncertaintyIndicator | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 230 | LiveVsBacktestPanel | 74 | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含危险操作但无确认Modal |
| 231 | MiniBacktest | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 232 | PerformanceAttributionPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 233 | ProgressiveDisclosure | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 234 | SignalTimeline | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 235 | StrategyCompareModal | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 236 | StrategyComparer | 74 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 237 | StrategyExplainCard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 238 | StrategyOptimizerPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 239 | AICreator | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 240 | AITotalCostCard | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 241 | BacktestPanel | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 242 | FormCreator | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 243 | ModeSelector | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 244 | StrategyActivationFlow | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 多处按钮无Tooltip |
| 245 | TemplateBrowser | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 246 | AccountSummary | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 247 | AutomationPanel | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 248 | BrokerConfigSelector | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 249 | BrokerStatusBar | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 250 | ConditionRulePanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 251 | PositionMonitor | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 252 | TradeAlertPanel | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 253 | TradeDashboardPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 254 | TradeExecutionPanel | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 255 | TradeHistoryPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 256 | TradingCalendarView | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 257 | BillingCard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 258 | BillingDashboard | 74 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 259 | BlindBoxCard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 260 | CreatorUpload | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 261 | DataChannelToggle | 74 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 262 | ExchangeConnect | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 263 | InsuranceCard | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 264 | MarketFilterTab | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 265 | ParamSensitivityHeatmap | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 266 | ScenarioPackV2 | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 267 | TemplateDetailPage | 74 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 268 | TemplateOverview | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 269 | WeightSlider | 74 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 270 | AutoAnalysisScheduler | 77 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 271 | FeePreview | 77 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | 含列表渲染但无Empty状态, 含硬编码中文但未用i18n |
| 272 | CopyTradeNotifications | 77 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 273 | DeploymentConnectionTester | 77 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 274 | ChartContextMenu | 77 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 275 | DepthAnalyzerPanel | 77 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含硬编码中文但未用i18n |
| 276 | PanelDetach | 77 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 277 | ConfidenceVisualizer | 77 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态, 含硬编码中文但未用i18n |
| 278 | OfflineIndicator | 77 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含危险操作但无确认Modal |
| 279 | HyperbolicDecayModel | 77 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | 含列表渲染但无Empty状态, 含硬编码中文但未用i18n |
| 280 | TemplateCompareView | 77 | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 多处按钮无Tooltip, 含用户操作但无反馈(Toast/Message) |
| 281 | useFactorChineseNames | 77 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 含列表渲染但无Empty状态, 含硬编码中文但未用i18n |
| 282 | WalletFullPage | 77 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含异步操作但无Error处理, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 283 | WalletPage | 77 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含异步操作但无Error处理, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 284 | ProfileActivityPage | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 285 | FeeDeductionToast | 79 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 286 | AutoUpdatePanel | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 287 | MonitoringAlertPanel | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 288 | NotificationHistoryPanel | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 289 | NotificationSettings | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 290 | OAuth2Flow | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 291 | PauseRulesPanel | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 292 | USBrokerPanel | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 293 | BrokerReconnectGuide | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 294 | ChartToolbarCustom | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 295 | ColorBlindToggle | 79 | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含用户操作但无反馈(Toast/Message) |
| 296 | DesktopNotificationPanel | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 297 | UpdateModalV2 | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 298 | NotificationCenter | 79 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 299 | APIKeyConfigPanel | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 300 | CryptoAPIKeyPanel | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 301 | AIAdvisorPage | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 302 | OptimizerAdoptButton | 79 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 303 | StrategyShareCard | 79 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 304 | EthRealDataDemo | 80 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含异步fetch但无Loading状态, 含异步操作但无Error处理 |
| 305 | FactorSearch | 80 | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含交互div但无ARIA属性, 含危险操作但无确认Modal, 含用户操作但无反馈(Toast/Message) |
| 306 | AgentCollaborationPanel | 82 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 307 | AIAssistantPanel | 82 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 308 | LiveSignalDashboard | 82 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 309 | ModelArenaPage | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 310 | MonteCarloPage | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 311 | StrategyCommunityPanel | 82 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 312 | GuestModeShell | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 313 | ThemeLangPanel | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 314 | UIAuditPanel | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 315 | USDTWalletPage | 82 | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 316 | BrokerManagerAndPortfolio | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 317 | OrderPreviewCancelModal | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 318 | WatchlistV2 | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 319 | ChartErrorBoundary | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 320 | AIResponseSanitizer | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 321 | ErrorBoundary | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 322 | ErrorFallback | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 323 | KeyboardShortcuts | 82 | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 324 | DashboardPage | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 325 | CrossMarketFactorCompare | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 326 | FactorMarketIntegration | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 327 | FactorUniverseHub | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 328 | MarketAutoRecommend | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 329 | MarketFactorNavigator | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 330 | CreditsBalance | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 331 | FundHoldingsPage | 82 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 332 | KLineChart | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 333 | MarketplacePublishPanel | 82 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 334 | OnboardingGuide | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 335 | EquityChart | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 336 | PortfolioAllocationChart | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 337 | QuickTrade | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 338 | RiskConfigEditor | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 339 | SentimentDashboardPage | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 340 | BrokerPriority | 82 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 341 | ErrorBoundary | 82 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 342 | FactorCard | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 343 | MonthlyHeatmap | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 344 | ParamChartMapping | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 345 | RadarIndustry | 82 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含危险操作但无确认Modal |
| 346 | CostPreviewCard | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 347 | MyStrategies | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 348 | RiskDisclosureModal | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 349 | PnLPanel | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 350 | QuickOrderPanel | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 351 | SignalFeedAndCopyPanel | 82 | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 352 | TraderProfilePage | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 353 | AITemplateCard | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 354 | ArbitrageHeatmap | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 355 | ArbitrageScanPanel | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 356 | AttributionPanel | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 357 | DailyBriefingCard | 82 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 358 | StressTestPanel | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 359 | TemplateBrowserV2 | 82 | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 360 | TemplateMeta | 82 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 361 | TemplateSearch | 82 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 362 | TradingFinalPanel | 82 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 363 | WalletBalanceBar | 82 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 364 | FullPipelineUI | 84 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持 |
| 365 | DemoCasePage | 84 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持 |
| 366 | PreferencesPage | 84 | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含可点击元素但无键盘支持 |
| 367 | AggregatedPortfolio | 85 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | 含硬编码中文但未用i18n |
| 368 | DOMLadder | 85 | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含硬编码中文但未用i18n |
| 369 | InteractionSuite | 85 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 含硬编码中文但未用i18n |
| 370 | PriceDisplay | 85 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 含硬编码中文但未用i18n |
| 371 | FactorSignalLight | 85 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | 含硬编码中文但未用i18n |
| 372 | StrategyColorAccessible | 85 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | 含硬编码中文但未用i18n |
| 373 | VisualPolishFix | 85 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 含硬编码中文但未用i18n |
| 374 | CopyTradeHub | 87 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 375 | CopyTradeLog | 87 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 376 | OpenDOfflineAlert | 87 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 377 | OpenDSignalPanel | 87 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 378 | SkeletonWatermark | 87 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 379 | EmptyState | 87 | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 380 | Header | 87 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 381 | MarketPage | 87 | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性 |
| 382 | MarketplacePage | 87 | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含列表渲染但无Empty状态, 含交互div但无ARIA属性 |
| 383 | MarketplaceWidgets | 87 | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 384 | ServerConnectionPanel | 87 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 385 | BacktestComparison | 87 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 386 | TimingConfigPanel | 87 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 387 | UIPolish | 87 | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 388 | AIStrategyPanel | 87 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 389 | DailyBriefingPage | 87 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 390 | DepositAndFeePage | 87 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 391 | FeeDeductionToastV3 | 87 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 392 | MarketplaceHub | 87 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 393 | SignalPushPopup | 87 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持, 含交互div但无ARIA属性 |
| 394 | TopUpConfirmModal | 90 | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 395 | ChartEnhancements | 90 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含危险操作但无确认Modal |
| 396 | GlobalSearch | 90 | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 397 | StockScreenerPage | 90 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含交互div但无ARIA属性, 含用户操作但无反馈(Toast/Message) |
| 398 | R58UIPolish | 92 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 399 | DrawdownChart | 92 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 400 | MonthlyReturnsHeatmap | 92 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 401 | ParamScanPanel | 92 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 402 | TradeTimeline | 92 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 403 | CreditsDashboard | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 404 | ProfitSplitVisualizer | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 405 | FootprintChart | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 406 | MicrostructureTooltip | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态 |
| 407 | PatternOverlay | 92 | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 408 | TradingSessionBar | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 409 | AIProgressIndicator | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 410 | AssetClassSelector | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 411 | FactorCalendarHeatmap | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 412 | LoadingExperience | 92 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 413 | RealTimeMarketDashboard | 92 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 414 | AgentDashboard | 92 | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 415 | DailyPnLSummary | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 416 | MarketClock | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 417 | SkeletonScreen | 92 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | 含列表渲染但无Empty状态 |
| 418 | RegimeMonitorPage | 92 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 419 | ScoreAnimation | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 420 | StrategyProfileCard | 92 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 421 | OrderBookPanel | 92 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | 含列表渲染但无Empty状态 |
| 422 | UIAnimations | 92 | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | 含列表渲染但无Empty状态 |
| 423 | AIDrawPanel | 92 | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 含可点击元素但无键盘支持 |
| 424 | UIPolishKit | 95 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 含用户操作但无反馈(Toast/Message) |
| 425 | SymbolLink | 95 | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | 含用户操作但无反馈(Toast/Message) |
| 426 | SymbolSearch | 95 | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含交互div但无ARIA属性 |
| 427 | ServerConnectionGuide | 95 | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | 含交互div但无ARIA属性 |
| 428 | AdminDashboard | 100 | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 429 | PrivateBankingUI | 100 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 430 | ResponsiveUtils | 100 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |
| 431 | FeeDeductionToastV2 | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | — |
| 432 | BrokerHealthScore | 100 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 433 | BrokerPanoramicPanel | 100 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | — |
| 434 | CopyTradeDashboard | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | — |
| 435 | CopyTradeStatusBar | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 436 | CreatorProfitPanel | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 437 | FinalUIWalkthrough | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | — |
| 438 | SignalDedupAndPriority | 100 | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 439 | DataFreshnessIndicator | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | — |
| 440 | OrderBookWaterfall | 100 | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 441 | GlobalLoading | 100 | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 442 | LoadingSpinner | 100 | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | — |
| 443 | MarketBadge | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |
| 444 | MetricHumanizer | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | — |
| 445 | SkeletonLoader | 100 | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 446 | StockCodeDisplay | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| 447 | TradingStatusIndicator | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 448 | StatusBar | 100 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| 449 | MarketBreadth | 100 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| 450 | CorrelationPanel | 100 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | — |
| 451 | StrategyPage | 100 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | — |
| 452 | TradingDesk | 100 | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| 453 | CreatorDashboard | 100 | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ | — |

---

## 🔴 Top 20 需修复组件

### 1. `chart/IndicatorTemplates.tsx` — 得分 49/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 2. `broker/CopyTradeOnboarding.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 3. `broker/CopyTradeStatusPanel.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 4. `broker/PnLOverview.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 5. `common/DataTrustBadge.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 6. `common/FactorHealthLight.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 7. `factor/AdvancedFactorCard.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 8. `factor/EntryFactorGallery.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 9. `factor/FactorFullPipeline.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 10. `factor/FactorHealthAlert.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 11. `factor/MarketSpecificFactorCard.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 12. `factor/SeasonalityCalendar.tsx` — 得分 59/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含用户操作但无反馈(Toast/Message)
- [i18n] 含硬编码中文但未用i18n

### 13. `billing/core/DesktopCleanupShell.tsx` — 得分 62/100

- [Loading] 含异步fetch但无Loading状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 14. `pwa/InstallPrompt.tsx` — 得分 62/100

- [Error] 含异步操作但无Error处理
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 15. `ai/AIHistorySearch.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 16. `backtest/BacktestComparisonPage.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 17. `billing/ai/AIBillingPanel.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 18. `billing/core/HelpCenter.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 19. `billing/market/MarketPanel.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)

### 20. `billing/P2PTransferRecords.tsx` — 得分 64/100

- [Empty] 含列表渲染但无Empty状态
- [A11y] 含可点击元素但无键盘支持
- [A11y] 含交互div但无ARIA属性
- [UX] 含危险操作但无确认Modal
- [UX] 含用户操作但无反馈(Toast/Message)


---

## 💡 改进建议

### P0 紧急 (得分<60, 12个组件)
- 全部添加 Loading/Error/Empty 三态覆盖
- 清理硬编码中文, 接入 i18n
- 危险操作添加确认 Modal

### P1 重要 (警告, 291个组件)
- 补齐 ARIA 属性和键盘导航
- 为纯图标按钮添加 Tooltip
- 添加操作成功/失败的 Toast 反馈

### P2 优化 (得分≥80但可提升)
- 为状态切换添加 CSS transition
- 统一使用 EmptyState 组件而非内联空状态
- 统一 ErrorBoundary 包裹策略

---

## ✅ 审计结论

- 审计覆盖率: **100%** (453/453 组件)
- 本次为 v2.3.0 CRYSTAL 最终交互终审
- 整体交互质量: **需修复后发布**
- 建议: 修复P0问题后再发布v2.3.0
