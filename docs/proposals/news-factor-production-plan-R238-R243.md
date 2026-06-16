# 🦐 消息因子生产化方案 — R238-R243

> **PM**: 🦞 Claw | **日期**: 2026-06-16 | **背景**: R232发现消息因子系统为空壳
> **前置**: v2.6.0 QUANTUM R230-R237 | **独立项目**: 6轮完整重建

---

## 一、现状诊断

```
当前状态                          →  目标状态
══════════════════════════════════════════════════════
东方财富 API   →  🔴 Mock         →  🔵 真实 REST API
新浪财经 API   →  🔴 Mock         →  🔵 真实 RSS/API
雪球 API       →  🔴 Mock         →  🔵 真实 JSON API
NewsAPI.org    →  🔴 Key未配置    →  🔵 配Key+真实调用
Reddit JSON    →  🟡 真实但仅2sub  →  🔵 扩展6sub+StockTwits
──缺失──        →  ❌             →  🔵 财联社电报 API
──缺失──        →  ❌             →  🔵 Alpha Vantage N&S
──缺失──        →  ❌             →  🔵 Polyglot/Benzinga Lite
──缺失──        →  ❌             →  🔵 Twitter/X API (加密情绪)
──缺失──        →  ❌             →  🔵 WeChat 公众号采集

情绪分析       →  🔴 关键词匹配   →  🟢 DeepSeek V4 Pro NLP
因子管线       →  🔴 sentiment未注册 →  🔵 全10源注册+fallback
```

---

## 二、深度学习研究摘要

### 2.1 行业最佳实践 (2026)

| 来源 | 关键发现 |
|------|---------|
| APITube 2026对比 | 交易级新闻API分5档: Benzinga(编辑策展 / 25ms WS) > Polygon > Alpha Vantage N&S > Marketaux > APITube |
| ACM DeepSeek论文 | DeepSeek + LoRA微调在金融情绪分析上超越BERT，F1达0.91 |
| 生产平台架构 | 分层架构: 摄入→评分→聚合→信号→回测，可插拔提供者模式 |
| 中文市场 | 财联社(电报API) + 东方财富(数据中心) + 新浪(财经RSS) 是中文核心源 |

### 2.2 关键设计原则 (基于人类使用习惯)

1. **延迟分级**: 交易信号<500ms / 因子计算<5s / 日报摘要<1h
2. **可解释性**: 每条情绪评分附带原文+来源+置信度，不可黑箱
3. **噪声过滤**: 同标题去重 + 来源权重(编辑策展>NER>关键词)
4. **渐进加载**: 先显示标题+情绪标签，点击展开原文+详细评分
5. **AI计费透明**: 每次DeepSeek分析显示费用(0.001U/条)，月度账单可查

---

## 三、生产级数据源矩阵 (12源)

### 中文源 (5)

| # | 源 | 类型 | 接入方式 | 延迟 | 覆盖 |
|---|------|------|------|:---:|------|
| 1 | **东方财富数据中心** | 财经新闻 | REST `datacenter.eastmoney.com` | ~1s | A股/港股 |
| 2 | **新浪财经 RSS** | 快讯/深度 | RSS `feed.mix.sina.com.cn` | ~2s | A股/全球 |
| 3 | **雪球热帖** | 社交投资 | REST `xueqiu.com/statuses` | ~3s | A股/港美股 |
| 4 | **财联社电报** | 实时快讯 | REST(阿里云市场) | ~500ms | A股/宏观 |
| 5 | **微信公众号** | 深度分析 | WeChat采集(需合规) | ~5min | 精选公众号 |

### 英文源 (5)

| # | 源 | 类型 | 接入方式 | 延迟 | 覆盖 |
|---|------|------|------|:---:|------|
| 6 | **Alpha Vantage N&S** | AI情绪新闻 | REST API Key | ~2s | 全球200K+股票 |
| 7 | **NewsAPI.org** | 综合新闻 | REST API Key | ~2s | 英文80K源 |
| 8 | **Polygon.io Lite** | 实时新闻WS | WebSocket | ~50ms | 美股 |
| 9 | **Reddit r/WSB+6sub** | 社交情绪 | JSON API(免认证) | ~3s | 美股/加密 |
| 10 | **Twitter/X API** | 加密KOL情绪 | REST OAuth | ~5s | 加密货币 |

### 备选源 (2)

| # | 源 | 场景 |
|---|------|------|
| 11 | StockTwits | 美股社交(衰退时备用Reddit) |
| 12 | Marketaux | 多语言国际(覆盖EU/JP/KR) |

---

## 四、AI情绪分析引擎

### 4.1 DeepSeek V4 Pro NLP 管线

```
新闻文本 ──→ 预处理(去HTML+截断500字) ──→ DeepSeek Prompt ──→ 结构化输出
                                                              │
                                          ┌─────────────────────┤
                                          │  sentiment: -1~+1   │
                                          │  confidence: 0~1    │
                                          │  entities: [ticker] │
                                          │  keywords: [5]      │
                                          │  category: enum      │
                                          │  impact: 1-10        │
                                          │  reasoning: str      │
                                          └─────────────────────┘
```

### 4.2 Prompt 模板

```json
{
  "system": "你是Dawn Whales金融情绪分析专家。分析以下财经新闻，返回JSON。",
  "user": "标题: {title}\n正文: {body}\n\n分析要求: 1)情绪 -1到1 2)置信度0-1 3)关联股票代码 4)关键词5个 5)类别(财报/政策/行业/公司/宏观/技术) 6)影响度1-10 7)一句话理由",
  "output": {"sentiment": 0.7, "confidence": 0.92, "tickers": ["AAPL"], "keywords": ["iPhone", "record", "revenue"], "category": "earnings", "impact": 8, "reasoning": "超预期财报，营收创新高"}
}
```

### 4.3 计费模型

| 层级 | 模型 | 每条费用 | 延迟 | 适用 |
|------|------|:---:|:---:|------|
| P2信息级 | DeepSeek Flash | 0.0005U | <300ms | 普通新闻/社交帖子 |
| P1重要级 | DeepSeek V4 Pro | 0.001U | <1s | 财报/政策/分析师 |
| P0紧急级 | DeepSeek V4 Pro | 0.001U | <500ms | 黑天鹅/停牌/崩盘 |
| 降级 | 本地关键词 | 0 | 即时 | API不可用时 |

> 月均成本估算: 10万条×30%AI分析×0.001U = **30U/月** (可控)

---

## 五、因子管线重建

### 5.1 全10源注册

```
FactorDataProvider.registerSource('sentiment',            sentimentFetcher)       ← 修复
FactorDataProvider.registerSource('capital_flow',          capitalFlowFetcher)      ← 已有
FactorDataProvider.registerSource('institutional_flow',    instFlowFetcher)         ← 新建
FactorDataProvider.registerSource('fund_holdings',         fundHoldingsFetcher)     ← 新建
FactorDataProvider.registerSource('stock_diagnosis',       stockDiagFetcher)        ← 新建
FactorDataProvider.registerSource('factor_research',       factorResearchFetcher)   ← 新建
FactorDataProvider.registerSource('factor_exposure',       factorExposureFetcher)   ← 新建
FactorDataProvider.registerSource('factor_compatibility',  compatFetcher)           ← 新建
FactorDataProvider.registerSource('factor_cloud',          cloudFetcher)            ← 新建
FactorDataProvider.registerSource('factor_asset_registry', assetRegFetcher)         ← 新建
```

### 5.2 消息因子→源映射(扩展)

```typescript
const NEWS_FACTOR_SOURCE_MAP = {
  NEWS_SENTIMENT:   ['eastmoney', 'sina', 'cls_telegraph', 'alphavantage_ns'],
  SOCIAL_SENTIMENT: ['xueqiu', 'reddit', 'stocktwits', 'twitter'],
  CRYPTO_SOCIAL:    ['reddit_crypto', 'twitter', 'xueqiu'],
  FEAR_GREED:       ['alphavantage_ns', 'newsapi'],  // 综合恐贪指数
  INSIDER_BUYING:   ['cls_telegraph', 'eastmoney'],  // 内部人增减持
  ANALYST_CONSENSUS:['alphavantage_ns', 'eastmoney'],// 分析师共识
};
```

---

## 六、6轮执行计划 (R238-R243)

### 总计: 6轮 / 26天 / ~210h

| 轮 | 主题 | 天 | 工时 | 核心交付 |
|---|------|:---:|:---:|------|
| **R238** | 🔴 中文源真实接入 | 4 | 38h | 东方财富+新浪+雪球+财联社 4源真实API |
| **R239** | 🔴 英文源+AI引擎 | 4 | 42h | AlphaVantage+NewsAPI+Polygon+Reddit 4源 + DeepSeek情绪引擎 |
| **R240** | 🔴 AI情绪+管线重建 | 5 | 46h | DeepSeek Prompt优化+10源全注册+降级链+计费管线 |
| **R241** | 🟡 社交情绪+加密 | 4 | 34h | Twitter/X+微信公众号+加密KOL+跨境情绪联动 |
| **R242** | 🟡 因子值+可视化 | 5 | 36h | 情绪热力图+恐贪仪表盘+新闻时间线+AI摘要 |
| **R243** | 🎯 全量验收+发布 | 4 | 38h | E2E 12源全绿+渗透测试+延迟基准+**v2.6.5发布** |

---

## 七、6虾详细分工

### R238: 中文源真实接入 (4天/38h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R238-JVS#1 | 东方财富API真实接入(行情+新闻) | JVS | 5h | EastMoneyNewsFetcher.ts |
| R238-JVS#2 | 新浪财经RSS接入+HTML解析 | JVS | 4h | SinaNewsFetcher.ts |
| R238-ML#1 | 新闻列表UI重建(标题+情绪标签+原文展开) | ML | 6h | NewsFeedPanel.tsx |
| R238-ML#2 | 新闻详情页(来源/时间/关联股票/AI按钮) | ML | 4h | NewsDetailModal.tsx |
| R238-youdao#1 | 中文源数据验证(4源覆盖+延迟+准确性) | youdao | 5h | cn-news-validation.test.ts |
| R238-auto#1 | 雪球API接入+去重引擎 | autoclaw | 6h | XueqiuFetcher.ts + DedupEngine.ts |
| R238-auto#2 | 财联社电报API接入(阿里云市场) | autoclaw | 4h | CLSTelegraphFetcher.ts |
| R238-QClaw#1 | 新闻源选择+展示策略设计(5场景) | QClaw | 4h | 新闻展示策略设计稿 |
| R238-PM#1 | R237验收+R238基线审计 | Claw | 2h | baseline-audit.md |

### R239: 英文源+AI引擎 (4天/42h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R239-JVS#1 | Alpha Vantage N&S接入(200K+股票) | JVS | 5h | AlphaVantageNSAdapter.ts |
| R239-JVS#2 | Polygon.io Lite WS接入(25ms延迟) | JVS | 6h | PolygonNewsWS.ts |
| R239-ML#1 | 情绪标签动画+渐变(正面绿/负面红/中性灰) | ML | 4h | SentimentBadge.tsx |
| R239-ML#2 | 新闻筛选器(来源/市场/情绪/时间) | ML | 5h | NewsFilterBar.tsx |
| R239-youdao#1 | 英文源数据验证(延迟+覆盖率+双语对照) | youdao | 5h | en-news-validation.test.ts |
| R239-auto#1 | NewsAPI.org接入+API Key管理 | autoclaw | 4h | NewsAPIKeyManager.ts |
| R239-auto#2 | **DeepSeek情绪分析引擎**(Prompt+调用+缓存) | autoclaw | 8h | AISentimentEngine.ts + Prompt模板 |
| R239-QClaw#1 | 情绪分析结果展示设计(AI评分可解释) | QClaw | 5h | 情绪分析UI设计稿 |
| R239-PM#1 | R238验收+R239基线审计 | Claw | 2h | baseline-audit.md |

### R240: AI情绪+管线重建 (5天/46h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R240-JVS#1 | 情绪聚合引擎(窗口加权+多源融合+噪声过滤) | JVS | 6h | SentimentAggregator.ts |
| R240-JVS#2 | FactorDataProvider 10源全注册+fetcher注入 | JVS | 6h | 全10源fetcher就绪 |
| R240-ML#1 | 情绪仪表盘(恐贪指数+情绪趋势图+分布饼图) | ML | 6h | SentimentDashboard.tsx |
| R240-ML#2 | AI计费透明UI(用量/费用/余额) | ML | 4h | AIUsagePanel.tsx |
| R240-youdao#1 | AI情绪准确率测试(100条人工标注 vs AI) | youdao | 8h | sentiment-accuracy-report.md |
| R240-auto#1 | DeepSeek Prompt优化(A/B test + 批量缓存) | autoclaw | 6h | PromptOptimizer.ts + 批量缓存 |
| R240-auto#2 | 降级链(DeepSeek→关键词→中性默认) | autoclaw | 4h | SentimentDegradationChain.ts |
| R240-QClaw#1 | 情绪因子用户教育(5步理解指南+i18n) | QClaw | 6h | 情绪因子教育设计+60条文案 |
| R240-PM#1 | R239验收+R240基线审计 | Claw | 2h | baseline-audit.md |

### R241: 社交情绪+加密 (4天/34h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R241-JVS#1 | Twitter/X API接入(加密KOL情绪) | JVS | 5h | TwitterSentimentFetcher.ts |
| R241-JVS#2 | Reddit扩展6sub + StockTwits | JVS | 4h | RedditExtendedFetcher.ts |
| R241-ML#1 | 社交情绪对比面板(Reddit vs Twitter vs 雪球) | ML | 5h | SocialComparePanel.tsx |
| R241-youdao#1 | 社交源数据验证(覆盖+延迟+噪声率) | youdao | 4h | social-validation.test.ts |
| R241-auto#1 | 微信公众号采集器(合规版) | autoclaw | 6h | WechatPublicFetcher.ts |
| R241-auto#2 | 跨境情绪联动(美股情绪→港股→A股传导) | autoclaw | 4h | CrossMarketSentiment.ts |
| R241-QClaw#1 | 社交情绪用户教育+i18n | QClaw | 4h | 社交情绪教育设计+40条文案 |
| R241-PM#1 | R240验收+R241基线审计 | Claw | 2h | baseline-audit.md |

### R242: 因子值+可视化 (5天/36h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R242-JVS#1 | 消息因子值计算(NEWS_SENTIMENT→-100~+100) | JVS | 5h | NewsSentimentFactor.ts |
| R242-JVS#2 | 消息因子回测(12个月情绪 vs 股价相关性) | JVS | 6h | SentimentBacktest.ts |
| R242-ML#1 | 情绪热力图(按板块/市场/时间) | ML | 6h | SentimentHeatmap.tsx |
| R242-ML#2 | 新闻时间线(可拖拽+缩放+点击详情) | ML | 5h | NewsTimeline.tsx |
| R242-youdao#1 | 因子值准确率验证(情绪→股价滞后相关性) | youdao | 6h | factor-correlation-report.md |
| R242-auto#1 | AI日报摘要(每日top10情绪事件) | autoclaw | 4h | DailySentimentDigest.ts |
| R242-QClaw#1 | 可视化用户指南(热力图+时间线+恐贪) | QClaw | 4h | 可视化教育设计+50条文案 |
| R242-PM#1 | R241验收+R242基线审计 | Claw | 2h | baseline-audit.md |

### R243: 全量验收+发布 (4天/38h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R243-JVS#1 | 全12源健康检查+延迟基准 | JVS | 4h | SourceHealthDashboard.ts |
| R243-JVS#2 | 性能优化(批量处理+WS连接池) | JVS | 5h | 延迟<100ms目标 |
| R243-ML#1 | 全部UI打通(新闻→情绪→因子值→策略) | ML | 6h | 全链路UI就绪 |
| R243-ML#2 | 移动端适配(新闻卡片+滑动+推送) | ML | 4h | 响应式新闻UI |
| R243-youdao#1 | 全12源E2E测试(每一源的生产+降级) | youdao | 8h | 12-sources-e2e.test.ts |
| R243-youdao#2 | 安全渗透(AI prompt注入+API Key泄露) | youdao | 3h | ai-security-pentest.md |
| R243-auto#1 | 文档 (数据源接入指南+AI情绪原理) | autoclaw | 4h | 消息因子文档站章节 |
| R243-QClaw#1 | 发布公告+更新日志+社交媒体 | QClaw | 4h | 发布材料+9语言changelog |
| R243-PM#1 | 全量验收+发布决策 | Claw | 2h | **v2.6.5 RELEASE** |

---

## 八、6虾工时总览

| 虾 | R238 | R239 | R240 | R241 | R242 | R243 | **合计** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🔧 JVS | 9h | 11h | 12h | 9h | 11h | 9h | **61h** |
| 🎨 ML | 10h | 9h | 10h | 5h | 11h | 10h | **55h** |
| 🧪 youdao | 5h | 5h | 8h | 4h | 6h | 11h | **39h** |
| 🔧 autoclaw | 10h | 12h | 10h | 10h | 4h | 4h | **50h** |
| 📝 QClaw | 4h | 5h | 6h | 4h | 4h | 4h | **27h** |
| 🦞 Claw | 2h | 2h | 2h | 2h | 2h | 2h | **12h** |
| | | | | | | **总计** | **244h** |

---

## 九、里程碑

```
R238 → 中文4源真实API ✅ (东方财富/新浪/雪球/财联社)
R239 → 英文4源+DeepSeek情绪引擎 ✅ (AlphaVantage/NewsAPI/Polygon/Reddit + AI)
R240 → 10源全注册+AI计费透明 ✅ (管线重建完成)
R241 → 社交情绪全覆盖 ✅ (Twitter/微信/StockTwits/跨境)
R242 → 情绪可视化全维度 ✅ (热力图/仪表盘/时间线/日报)
R243 → 🎯 v2.6.5 消息因子生产化 发布
```

---

## 十、风险与缓解

| 风险 | 缓解 |
|------|------|
| 东方财富API无官方文档 | 用AKShare抓取模式+逆向HTTP |
| 财联社电报需付费 | 阿里云市场~¥100/月, 先试用免费层 |
| DeepSeek情绪准确率不够 | 100条人工标注基准+R240 A/B优化 |
| Twitter API X付费贵($100/月) | 先Reddit+雪球免费社交, Twitter v2.7+ |
| 微信公众号采集合规风险 | 只采集公开文章, 不采集用户数据 |
| 12源并发延迟高 | WS优先+降级轮询+缓存TTL分级 |

---

*方案制定: 2026-06-16 | 🦞 Claw (PM)*
