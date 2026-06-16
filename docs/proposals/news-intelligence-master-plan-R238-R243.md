# 🦐 消息智能完整方案 v3 — 消息因子+12增值功能 (R238-R243)

> **PM**: 🦞 Claw | **日期**: 2026-06-16 | **原则**: 零费用/零KYC/全RSS
> **前置**: v2.6.0 QUANTUM | **目标**: 消息因子+12项增值功能, 预估月收入 ~2750U

---

## 一、方案总览

| 指标 | v2(消息因子) | v3(消息智能) |
|------|:---:|:---:|
| 数据源 | 23+ | 23+ (不变) |
| 交付模块 | 因子+可视化 | 因子 + **12增值功能** |
| 可收费项 | 0 | **6项** (~2750U/月) |
| 总工时 | ~165h | **~290h** |
| 轮数 | 6 | **6** (扩展每轮) |

---

## 二、12项增值功能总览

### 🔴 P0 — 基础粘性 (R238-R240)

| # | 功能 | 说明 | 定价 | 核心用户价值 |
|:---:|------|------|:---:|------|
| 1 | **📰 价格异动归因** | 股票涨跌>5% → AI总结关联新闻 → 一句话"为什么" | 免费 | 消除信息不对称 |
| 2 | **⚡ 突发新闻警报** | 自选/持仓突发新闻 → 桌面推送，P0黑天鹅/P1财报/P2一般 | 免费 | 不再错过关键消息 |
| 3 | **🤖 AI每日早报** | 持仓+自选隔夜新闻摘要，情绪+影响评估一句话 | 1U/天 | 每天3分钟了解全局 |

### 🟡 P1 — 付费增值 (R241-R242)

| # | 功能 | 说明 | 定价 | 月调用预估 |
|:---:|------|------|:---:|:---:|
| 4 | **🛡️ 持仓风险扫描** | 突发利空→评估对持仓影响→建议减仓/对冲 | 1U/次 | 500 |
| 5 | **🏭 供应链传导** | "台积电火灾"→列出受影响上下游(AAPL/NVDA/AMD...) | 1U/次 | 200 |
| 6 | **🔍 新闻选股器** | "情绪连续3天改善+成交量放大"条件筛选 | 免费 | — |
| 7 | **📋 监管政策追踪** | SEC/PBOC新规→匹配受影响持仓 | 免费 | — |

### 🟢 P2 — 生态与进阶 (R242-R243)

| # | 功能 | 说明 | 定价 | 月调用预估 |
|:---:|------|------|:---:|:---:|
| 8 | **📊 新闻回测** | "过去3年, 当COIN出现'ETF否决'新闻后30天走势?" | 1.5U/次 | 300 |
| 9 | **🎯 事件驱动策略** | 财报/并购/分红→AI建议参数调整 | 1.5U/次 | 400 |
| 10 | **💬 新闻讨论区** | 每条策略关联新闻下自动生成讨论 | 免费 | — |
| 11 | **📝 创作者素材** | 写分析时AI推荐相关新闻作论据 | 免费 | — |
| 12 | **👥 跟单增强** | 高手调仓自动附"相关新闻: XXX" | 免费 | — |

---

## 三、月收入预估

| 功能 | 定价 | 月调用 | 月收入 |
|------|:---:|:---:|:---:|
| AI每日早报 | 1U | 1,000 | 1,000U |
| 持仓风险扫描 | 1U | 500 | 500U |
| 供应链传导 | 1U | 200 | 200U |
| 新闻回测 | 1.5U | 300 | 450U |
| 事件驱动策略 | 1.5U | 400 | 600U |
| AI成本(DeepSeek) | -0.0005U/条×5万条 | — | -25U |
| **净月收入** | | | **~2,725U** |

---

## 四、6轮执行计划 (~290h)

| 轮 | 主题 | 工时 | 核心交付 | 新增功能 |
|---|------|:---:|------|:---:|
| **R238** | RSS框架+聚合器 | **36h** | 23源全部接入+新闻Feed UI+警报基础 | ⚡基础 |
| **R239** | AI情绪+归因+早报 | **54h** | DeepSeek情绪引擎+异动归因+AI早报+管线重建 | 📰🤖 |
| **R240** | P1风险+传导+政策 | **52h** | 持仓扫描+供应链传导+政策追踪+新闻选股器 | 🛡️🏭📋🔍 |
| **R241** | 中文+商品+社交全覆盖 | **48h** | 中文3源+商品3源+社交2源+区域2源 | 数据补全 |
| **R242** | 可视化+回测+事件策略 | **56h** | 热力图+恐贪+时间线+新闻回测+事件策略+API | 📊🎯 |
| **R243** | 社区+创作者+验收发布 | **44h** | 讨论区+创作者素材+跟单增强+全量验收+**v2.7.0发布** | 💬📝👥 |

---

## 五、6虾详细分工

### R238: RSS框架+聚合器+新闻Feed (3天/36h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R238-JVS#1 | RSS调度引擎(rss-parser+node-cron+去重+缓存) | JVS | 6h | RSSScheduler.ts |
| R238-JVS#2 | Investing.com 30feed接入+分类映射(按12市场) | JVS | 5h | InvestingComFeeds.ts |
| R238-JVS#3 | 突发新闻检测(黑天鹅关键词库+分级P0/P1/P2) | JVS | 3h | BreakingNewsDetector.ts |
| R238-auto#1 | ActuallyFreeAPI适配器+OmniFolio fallback | autoclaw | 5h | FreeAPIFetcher.ts |
| R238-auto#2 | Reuters+CNBC+Yahoo+MarketWatch RSS接入 | autoclaw | 6h | MajorFeeds.ts |
| R238-auto#3 | 去重引擎v2(跨源hash+标题相似度>90%) | autoclaw | 4h | DedupEngineV2.ts |
| R238-ML#1 | 新闻Feed UI(按市场/品种/情绪过滤+实时刷新+无限滚动) | ML | 6h | NewsFeedPanelV2.tsx |
| R238-ML#2 | 突发新闻弹窗(桌面推送+分级颜色+点击跳详情) | ML | 4h | BreakingNewsToast.tsx |
| R238-youdao#1 | 聚合器+英文源验证(覆盖率+延迟+去重) | youdao | 4h | feeds-validation-r238.test.ts |
| R238-QClaw#1 | 新闻分类设计(12市场标签+来源标识+分级配色) | QClaw | 3h | 新闻分类设计稿 |
| R238-PM#1 | 基线审计 | Claw | 2h | baseline-audit.md |

### R239: AI情绪+异动归因+AI早报 (4天/54h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R239-JVS#1 | DeepSeek情绪引擎(Prompt设计+A/B优化+批量+24h缓存) | JVS | 6h | AISentimentEngine.ts |
| R239-JVS#2 | FactorDataProvider 10源全注册+fetcher注入 | JVS | 5h | 全10源fetcher就绪 |
| R239-JVS#3 | 情绪聚合引擎(多源加权+噪声过滤+时间衰减) | JVS | 4h | SentimentAggregator.ts |
| R239-auto#1 | **价格异动归因引擎**(股价>5%→关联新闻→AI总结原因) | autoclaw | 8h | PriceMoveAttribution.ts |
| R239-auto#2 | **AI每日早报生成器**(持仓+自选新闻摘要→邮件/弹窗) | autoclaw | 8h | DailyBriefingGenerator.ts |
| R239-auto#3 | 降级链+AI计费管线(DeepSeek→关键词→中性, 用量追踪) | autoclaw | 4h | DegradationChain.ts + AIUsageTracker.ts |
| R239-ML#1 | 异动归因展示(涨跌箭头+一句话原因+来源链接) | ML | 5h | PriceAttributionBadge.tsx |
| R239-ML#2 | AI早报面板(持仓/自选/市场 三tab, 摘要+情绪条) | ML | 5h | DailyBriefingPanel.tsx |
| R239-youdao#1 | AI情绪准确率测试(100条人工标注 vs DeepSeek, F1>0.85) | youdao | 6h | sentiment-accuracy-report.md |
| R239-QClaw#1 | 早报+归因用户教育文案(3步指南+i18n 50条) | QClaw | 3h | 教育文案 |
| R239-PM#1 | R238验收+基线审计 | Claw | 2h | baseline-audit.md |

### R240: P1风险+传导+监管+选股 (4天/52h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R240-JVS#1 | **持仓风险扫描引擎**(突发新闻→匹配持仓→影响评估→建议) | JVS | 8h | PositionRiskScanner.ts |
| R240-JVS#2 | **供应链传导引擎**(公司事件→知识图谱→上下游→受影响的股票) | JVS | 8h | SupplyChainImpact.ts |
| R240-JVS#3 | **监管政策追踪器**(SEC/PBOC/ESMA关键词检测→匹配行业) | JVS | 5h | RegulatoryTracker.ts |
| R240-auto#1 | **新闻选股器**(情绪趋势+成交量+新闻量 组合条件筛选) | autoclaw | 7h | NewsStockScreener.ts |
| R240-auto#2 | CoinDesk+CoinTelegraph+Decrypt+TheBlock+CryptoFeedr | autoclaw | 5h | CryptoFeeds.ts |
| R240-ML#1 | 风险扫描结果面板(持仓列表+风险等级+建议操作+一键执行) | ML | 6h | RiskScanPanel.tsx |
| R240-ML#2 | 供应链传导可视化(节点关系图+受影响股票列表) | ML | 5h | SupplyChainGraph.tsx |
| R240-youdao#1 | 风险扫描+供应链准确率测试(10个真实案例) | youdao | 6h | risk-scan-validation.test.ts |
| R240-PM#1 | R239验收+基线审计 | Claw | 2h | baseline-audit.md |

### R241: 中文+商品+社交全覆盖 (3天/48h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R241-JVS#1 | 华尔街见闻+金十数据 RSS接入 | JVS | 4h | CNSources.ts |
| R241-JVS#2 | OilPrice+CommodityTV+Investing.com商品3版 RSS | JVS | 4h | CommodityFeeds.ts |
| R241-JVS#3 | 监管追踪扩展(中文政策源+加密监管+商品监管) | JVS | 3h | RegulatoryTrackerV2.ts |
| R241-auto#1 | Reddit扩展6sub+StockTwits RSS | autoclaw | 5h | SocialFeeds.ts |
| R241-auto#2 | Nikkei Asia+Investing India RSS | autoclaw | 4h | RegionalFeeds.ts |
| R241-auto#3 | 新闻选股器v2(跨市场+加密+商品条件) | autoclaw | 4h | StockScreenerV2.ts |
| R241-ML#1 | 社交情绪对比面板(Reddit vs StockTwits vs 华尔街见闻) | ML | 5h | SocialComparePanel.tsx |
| R241-ML#2 | 持仓风险扫描+供应链 响应式移动适配 | ML | 4h | RiskMobileAdapter.tsx |
| R241-ML#3 | 选股器UI(条件builder+回测预览+结果表格) | ML | 5h | StockScreenerUI.tsx |
| R241-youdao#1 | 中文+商品+社交+区域源全量验证 | youdao | 6h | all-sources-validation.test.ts |
| R241-QClaw#1 | 风险扫描+选股器用户教育(i18n 60条) | QClaw | 4h | 教育文案 |
| R241-PM#1 | R240验收+基线审计 | Claw | 2h | baseline-audit.md |

### R242: 可视化+回测+事件策略+API (4天/56h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R242-JVS#1 | 消息因子值计算(NEWS_SENTIMENT→-100~+100, 全市场) | JVS | 5h | NewsSentimentFactor.ts |
| R242-JVS#2 | **新闻回测引擎**(关键词事件→N天后股价表现→统计分布) | JVS | 8h | NewsBacktestEngine.ts |
| R242-JVS#3 | **事件驱动策略生成器**(财报/并购/分红→AI建议参数) | JVS | 6h | EventStrategyGenerator.ts |
| R242-JVS#4 | 消息智能 Public API(供桌面前端调用的统一接口) | JVS | 4h | NewsIntelligenceAPI.ts |
| R242-auto#1 | 新闻回测数据准备(3年历史新闻+股价对齐) | autoclaw | 5h | NewsBacktestDataPrep.ts |
| R242-auto#2 | AI日报摘要引擎v2(含归因/风险/策略建议) | autoclaw | 4h | DailyDigestV2.ts |
| R242-ML#1 | 情绪热力图(全市场/板块/时间 三维) | ML | 6h | SentimentHeatmap.tsx |
| R242-ML#2 | 新闻回测UI(事件选择→参数配置→回测结果图表) | ML | 5h | NewsBacktestUI.tsx |
| R242-ML#3 | 事件策略面板(事件类型→AI建议→一键应用参数) | ML | 5h | EventStrategyPanel.tsx |
| R242-youdao#1 | 回测准确率+事件策略回测验证 | youdao | 6h | backtest-strategy-validation.test.ts |
| R242-PM#1 | R241验收+基线审计 | Claw | 2h | baseline-audit.md |

### R243: 社区+创作者+跟单+验收发布 (3天/44h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R243-JVS#1 | **新闻讨论区后端**(策略关联新闻→讨论线程+点赞+置顶) | JVS | 5h | NewsDiscussionAPI.ts |
| R243-JVS#2 | **创作者素材引擎**(策略分析→AI推荐相关新闻作论据) | JVS | 4h | CreatorMaterialEngine.ts |
| R243-JVS#3 | 全源健康检查+延迟基准+性能优化 | JVS | 4h | SourceHealthDashboard.ts |
| R243-auto#1 | **跟单增强**(高手调仓→自动关联新闻→跟单者看到理由) | autoclaw | 5h | CopytradeNewsEnhancer.ts |
| R243-auto#2 | 消息智能完整文档(源接入+AI原理+API+用户指南) | autoclaw | 4h | 文档站: news-intelligence章节 |
| R243-ML#1 | 新闻讨论区UI(线程+评论+点赞+排序+创建者回复) | ML | 6h | NewsDiscussionUI.tsx |
| R243-ML#2 | 创作者素材侧边栏(写分析时右侧推荐新闻) | ML | 4h | CreatorMaterialPanel.tsx |
| R243-ML#3 | 跟单新闻提示(跟单确认弹窗底部显示关联新闻) | ML | 3h | CopytradeNewsBanner.tsx |
| R243-youdao#1 | 全23源E2E + 6项AI功能E2E | youdao | 6h | news-intelligence-e2e.test.ts |
| R243-youdao#2 | AI安全渗透(prompt注入+Key泄露+虚假新闻对抗) | youdao | 3h | ai-security-final.md |
| R243-QClaw#1 | 全部i18n补全(新增12功能×9语言~500条) + CHANGELOG | QClaw | 6h | i18n补全 + 发布材料 |
| R243-PM#1 | v2.7.0 全量验收+发布决策 | Claw | 4h | **v2.7.0 NEWS INTELLIGENCE 发布** |

---

## 六、6虾工时

| 虾 | R238 | R239 | R240 | R241 | R242 | R243 | **合计** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🔧 JVS | 14h | 15h | 21h | 11h | 23h | 13h | **97h** |
| 🔧 autoclaw | 15h | 20h | 12h | 13h | 9h | 9h | **78h** |
| 🎨 ML | 10h | 10h | 11h | 14h | 16h | 13h | **74h** |
| 🧪 youdao | 4h | 6h | 6h | 6h | 6h | 9h | **37h** |
| 📝 QClaw | 3h | 3h | — | 4h | — | 6h | **16h** |
| 🦞 Claw | 2h | 2h | 2h | 2h | 2h | 4h | **14h** |
| | | | | | | **总计** | **~316h** |

---

## 七、里程碑

```
R238 → 23源全接入 + 新闻Feed + 突发警报基础 ✅
R239 → DeepSeek AI情绪 + 异动归因 + AI早报 + 管线 ✅  ← P0完成
R240 → 持仓扫描 + 供应链 + 政策 + 新闻选股器 ✅         ← P1完成
R241 → 中文+商品+社交+区域 全覆盖 ✅                    ← 数据补全
R242 → 热力图+恐贪+回测+事件策略+API ✅                 ← P2+可视
R243 → 社区+创作者+跟单+验收 → 🎯 v2.7.0 NEWS INTELLIGENCE
```

---

## 八、版本命名

```
v2.6.0 QUANTUM   → 安全+实时+专业+生态 (R230-R237, 已完成)
v2.7.0 NEWS INTELLIGENCE → 消息智能化 (R238-R243, 本方案)
```

---

*方案制定: 2026-06-16 | 🦞 Claw (PM) | 零费用/零KYC/全RSS | 预估月收 ~2,725U*
