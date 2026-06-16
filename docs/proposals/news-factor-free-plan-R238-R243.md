# 🦐 消息因子白嫖方案 v2 — 全市场覆盖 (R238-R243)

> **PM**: 🦞 Claw | **日期**: 2026-06-16 | **原则**: 零费用/零实名/全RSS+免费API
> **前置**: v2.6.0 QUANTUM 完成 | **独立项目**: 6轮/~155h

---

## 一、方案总览

| 指标 | 付费版(旧) | 白嫖版(新) |
|------|:---:|:---:|
| 数据源 | 12(5付费) | **23+** (全免费) |
| 月费 | ~$150 | **$0** |
| 接入方式 | REST API Key | RSS + 免费JSON API |
| 覆盖市场 | 11 | **11+商品+加密** |
| KYC/实名 | 需要 | **不需要** |
| 工时 | 244h | **~155h** |

---

## 二、23+ 免费数据源矩阵

### A. 聚合器 (一站式覆盖全市场) — 3个

| # | 源 | 类型 | 覆盖 | URL |
|---|------|------|------|------|
| A1 | **Investing.com RSS** | RSS(30+分类) | 全球股票/外汇/商品/加密/债券/指数 | `cn.investing.com/rss/news.rss` 等30+feed |
| A2 | **ActuallyFreeAPI** | REST API(NLP) | 24个RSS聚合+自动ticker | `actually-free-api.vercel.app/api/news` |
| A3 | **OmniFolio** | RSS聚合 | 50+源聚合 | `omnifolio.app/news` |

> Investing.com 是主力: 一个站覆盖股票/外汇/商品(金属/能源/农业)/加密/债券/经济指标, 中英文版。

### B. 英文主流财经 — 5个

| # | 源 | RSS URL | 覆盖 |
|---|------|------|------|
| B1 | **Reuters** | `reuters.com` 多分类RSS | 全球综合 |
| B2 | **CNBC** | `cnbc.com/id/.../device/rss/rss.html` | 美股/全球 |
| B3 | **Yahoo Finance** | `finance.yahoo.com/news/rssindex` | 美股快讯 |
| B4 | **MarketWatch** | `marketwatch.com/rss` | 美股/宏观 |
| B5 | **Seeking Alpha** | `seekingalpha.com/market_currents.xml` | 美股分析 |

### C. 加密货币 — 5个

| # | 源 | RSS URL | 覆盖 |
|---|------|------|------|
| C1 | **CoinDesk** | `coindesk.com/arc/outboundfeeds/rss` | 加密综合 |
| C2 | **CoinTelegraph** | `cointelegraph.com/rss` | 加密综合 |
| C3 | **Decrypt** | `decrypt.co/feed` | 加密+Web3 |
| C4 | **The Block** | `theblock.co/rss.xml` | 加密深度 |
| C5 | **CryptoFeedr** | `cryptofeedr.com` 聚合 | 加密多源 |

### D. 大宗商品 — 3个

| # | 源 | RSS URL | 覆盖 |
|---|------|------|------|
| D1 | **OilPrice.com** | `oilprice.com/rss/main` | 原油/能源 |
| D2 | **Investing.com商品** | `cn.investing.com/rss/commodities.rss` | 金属/能源/农业(3种子feed) |
| D3 | **Commodity-TV** | `commodity-tv.com/api/feeds/rss` | 商品综合 |

### E. 中文市场 — 3个

| # | 源 | 方式 | 覆盖 |
|---|------|------|------|
| E1 | **Investing.com中文版** | RSS(30+分类) | A股/港股/外汇/商品/加密 |
| E2 | **华尔街见闻** | RSS | A股/宏观 |
| E3 | **金十数据** | RSS | 宏观/快讯 |

### F. 社交情绪 — 2个

| # | 源 | 方式 | 覆盖 |
|---|------|------|------|
| F1 | **Reddit JSON** | 免费API(免认证) | r/WSB+stocks+investing+crypto |
| F2 | **StockTwits** | RSS per ticker | 美股社交 |

### G. 区域市场补充 — 2个

| # | 源 | RSS | 覆盖 |
|---|------|------|------|
| G1 | **Nikkei Asia** | `asia.nikkei.com/rss` | 日本/亚太 |
| G2 | **Investing.com India** | `in.investing.com/rss/...` | 印度 |

---

## 三、全市场覆盖矩阵

| 市场 | Investing.com | 其他RSS | 社交 | AI情绪 |
|------|:---:|:---:|:---:|:---:|
| 🇺🇸 美股 | ✅ stock.rss | Reuters+CNBC+Yahoo+MarketWatch+SeekingAlpha | Reddit+StockTwits | DeepSeek |
| 🇭🇰 港股 | ✅ cn版stock | Reuters Asia | — | DeepSeek |
| 🇨🇳 A股 | ✅ cn版stock | 华尔街见闻+金十 | — | DeepSeek |
| 🇯🇵 日本 | ✅ 指数分析 | Nikkei Asia | — | DeepSeek |
| 🇪🇺 欧洲 | ✅ 指数分析 | Reuters Europe | — | DeepSeek |
| 🇮🇳 印度 | ✅ in版 | — | — | DeepSeek |
| 🇰🇷 韩国 | ✅ 指数分析 | — | — | DeepSeek |
| 🇹🇼 台湾 | ✅ 指数分析 | — | — | DeepSeek |
| 🇸🇬 新加坡 | ✅ 指数分析 | — | — | DeepSeek |
| 🇦🇺 澳洲 | ✅ 指数分析 | — | — | DeepSeek |
| 🪙 加密 | ✅ crypto专版 | CoinDesk+CoinTelegraph+Decrypt+TheBlock | Reddit crypto | DeepSeek |
| 🛢️ 商品 | ✅ 金属/能源/农业3版 | OilPrice+CommodityTV | — | DeepSeek |

> **关键洞察**: Investing.com 的30+RSS feed 几乎覆盖了所有品种。作为主力源+其他免费RSS做冗余, 不需要爬虫。

---

## 四、架构设计

```
                        RSS 调度器 (node-cron)
                       /    |    |    |    \
           Investing.com   Reuters  CNBC  CryptoFeeds  SocialFeeds
           (30+ feeds)     (5)     (3)    (5)          (2)
                 \          |      |      |            /
                  \         V      V      V           /
                   ┌─────────────────────────────────┐
                   │     RSS Parser (rss-parser)      │
                   │  · 标题+摘要+URL+时间            │
                   │  · 去重(hash)                    │
                   │  · 来源权重                      │
                   └─────────────┬───────────────────┘
                                 │
                   ┌─────────────▼───────────────────┐
                   │     DeepSeek V4 Pro NLP          │
                   │  · 情绪评分 (-1~+1)             │
                   │  · 置信度 (0~1)                 │
                   │  · 实体提取 (ticker/商品/指数)   │
                   │  · 影响度 (1-10)                │
                   │  · 批量缓存 (同标题24h)          │
                   └─────────────┬───────────────────┘
                                 │
                   ┌─────────────▼───────────────────┐
                   │     NewsSentimentFactor          │
                   │  · 多源融合 (加权平均)           │
                   │  · 按市场/板块聚合               │
                   │  · 因子值输出 → FactorDataProvider│
                   └─────────────────────────────────┘
```

---

## 五、6轮执行计划 (R238-R243)

### 总计: 6轮 / ~155h / 23+源 / 零费用

| 轮 | 主题 | 天 | 工时 | 核心交付 |
|---|------|:---:|:---:|------|
| **R238** | RSS框架+聚合器接入 | 3 | 30h | RSS调度引擎+Investing.com 30feed+ActuallyFreeAPI |
| **R239** | 英文主流+加密源 | 3 | 32h | Reuters+CNBC+Yahoo+MarketWatch+5加密源 |
| **R240** | DeepSeek AI情绪+管线 | 4 | 34h | AI情绪引擎+10源全注册+降级链+计费管线 |
| **R241** | 中文+商品+社交 | 3 | 28h | 华尔街见闻+商品3源+Reddit+StockTwits |
| **R242** | 情绪可视化 | 3 | 22h | 热力图+恐贪仪表盘+时间线+日报 |
| **R243** | 全量验收+发布 | 2 | 20h | 23源全绿+安全审计+**v2.6.5发布** |

---

## 六、6虾详细分工

### R238: RSS框架+聚合器 (3天/30h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R238-JVS#1 | RSS调度引擎(rss-parser+node-cron+去重+缓存) | JVS | 6h | RSSScheduler.ts |
| R238-JVS#2 | Investing.com 30feed接入+分类映射 | JVS | 5h | InvestingComFeeds.ts |
| R238-auto#1 | ActuallyFreeAPI适配器+OmniFolio fallback | autoclaw | 5h | FreeAPIFetcher.ts |
| R238-auto#2 | RSS源注册表+健康检查+权重配置 | autoclaw | 4h | RSSSourceRegistry.ts |
| R238-ML#1 | 新闻Feed UI(按市场/品种过滤+实时刷新) | ML | 5h | NewsFeedPanelV2.tsx |
| R238-QClaw#1 | 新闻分类设计(12市场标签+来源标识) | QClaw | 3h | 新闻分类设计稿 |
| R238-PM#1 | 基线审计 | Claw | 2h | baseline-audit.md |

### R239: 英文主流+加密源 (3天/32h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R239-JVS#1 | Reuters+CNBC+Yahoo+MarketWatch RSS接入 | JVS | 6h | MajorFeeds.ts |
| R239-JVS#2 | SeekingAlpha+FT RSS接入 | JVS | 4h | AnalysisFeeds.ts |
| R239-auto#1 | CoinDesk+CoinTelegraph+Decrypt+TheBlock+CryptoFeedr | autoclaw | 6h | CryptoFeeds.ts |
| R239-auto#2 | 去重引擎v2(跨源标题hash+内容相似度) | autoclaw | 4h | DedupEngineV2.ts |
| R239-ML#1 | 加密情绪面板(CoinDesk恐惧贪婪+社交热词) | ML | 5h | CryptoSentimentPanel.tsx |
| R239-youdao#1 | 英文源数据验证(覆盖率+延迟+双语对照) | youdao | 5h | en-feeds-validation.test.ts |
| R239-PM#1 | R238验收+基线审计 | Claw | 2h | baseline-audit.md |

### R240: DeepSeek AI情绪+管线重建 (4天/34h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R240-JVS#1 | DeepSeek情绪引擎(Prompt+调用+批量+缓存) | JVS | 6h | AISentimentEngine.ts |
| R240-JVS#2 | FactorDataProvider 10源全注册+fetcher注入 | JVS | 5h | 全10源fetcher就绪 |
| R240-JVS#3 | 情绪聚合引擎(多源加权+噪声过滤+时间衰减) | JVS | 4h | SentimentAggregator.ts |
| R240-auto#1 | 降级链(DeepSeek→关键词→中性默认) | autoclaw | 4h | SentimentDegradationChain.ts |
| R240-auto#2 | AI计费管线(用量/费用/余额) | autoclaw | 3h | AIUsageTracker.ts |
| R240-youdao#1 | AI情绪准确率测试(100条人工标注 vs AI) | youdao | 6h | sentiment-accuracy-report.md |
| R240-QClaw#1 | 情绪因子用户教育(5步指南+i18n) | QClaw | 4h | 40条教育文案 |
| R240-PM#1 | R239验收+基线审计 | Claw | 2h | baseline-audit.md |

### R241: 中文+商品+社交 (3天/28h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R241-JVS#1 | 华尔街见闻+金十数据 RSS接入 | JVS | 4h | CNSources.ts |
| R241-JVS#2 | OilPrice+CommodityTV RSS接入 | JVS | 3h | CommodityFeeds.ts |
| R241-auto#1 | Reddit扩展6sub+StockTwits RSS | autoclaw | 5h | SocialFeeds.ts |
| R241-auto#2 | Nikkei Asia+Investing India RSS | autoclaw | 4h | RegionalFeeds.ts |
| R241-ML#1 | 社交情绪对比面板(Reddit vs StockTwits vs 华尔街) | ML | 5h | SocialComparePanel.tsx |
| R241-youdao#1 | 中文+商品+社交源验证 | youdao | 4h | multi-source-validation.test.ts |
| R241-PM#1 | R240验收+基线审计 | Claw | 2h | baseline-audit.md |

### R242: 情绪可视化 (3天/22h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R242-JVS#1 | 消息因子值计算(NEWS_SENTIMENT→-100~+100) | JVS | 4h | NewsSentimentFactor.ts |
| R242-JVS#2 | 因子回测(12个月情绪 vs 股价相关性) | JVS | 4h | SentimentBacktest.ts |
| R242-ML#1 | 情绪热力图(按板块/市场/时间) | ML | 5h | SentimentHeatmap.tsx |
| R242-ML#2 | 新闻时间线+恐贪仪表盘 | ML | 4h | NewsTimeline+VixDashboard.tsx |
| R242-auto#1 | AI日报摘要(每日top10情绪事件) | autoclaw | 3h | DailySentimentDigest.ts |
| R242-PM#1 | R241验收+基线审计 | Claw | 2h | baseline-audit.md |

### R243: 全量验收+发布 (2天/20h)

| # | 任务 | 虾 | h | 交付 |
|---|------|:---:|:---:|------|
| R243-JVS#1 | 全源健康检查+延迟基准+性能优化 | JVS | 5h | SourceHealthDashboard.ts |
| R243-youdao#1 | 全23源E2E(每源生产+降级) | youdao | 6h | 23-sources-e2e.test.ts |
| R243-youdao#2 | AI安全渗透(prompt注入+Key泄露) | youdao | 2h | ai-security-pentest.md |
| R243-auto#1 | 消息因子文档(源接入指南+AI原理) | autoclaw | 3h | 文档站章节 |
| R243-QClaw#1 | CHANGELOG+发布公告 | QClaw | 2h | 发布材料 |
| R243-PM#1 | 全量验收+发布决策 | Claw | 2h | **v2.6.5 RELEASE** |

---

## 七、6虾工时

| 虾 | R238 | R239 | R240 | R241 | R242 | R243 | **合计** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 🔧 JVS | 11h | 10h | 15h | 7h | 8h | 5h | **56h** |
| 🔧 autoclaw | 9h | 10h | 7h | 9h | 3h | 3h | **41h** |
| 🎨 ML | 5h | 5h | — | 5h | 9h | — | **24h** |
| 🧪 youdao | — | 5h | 6h | 4h | — | 8h | **23h** |
| 📝 QClaw | 3h | — | 4h | — | — | 2h | **9h** |
| 🦞 Claw | 2h | 2h | 2h | 2h | 2h | 2h | **12h** |
| | | | | | | **总计** | **~165h** |

---

## 八、vs 爬虫方案

| 对比维度 | RSS方案 | 爬虫方案 |
|------|:---:|:---:|
| 开发成本 | 低(rss-parser标准库) | 高(cheerio+puppeteer+反爬) |
| 维护成本 | **零**(RSS标准) | 高(HTML变更即挂) |
| 合规风险 | **零**(RSS公开) | 中(robots.txt+法律) |
| 稳定性 | **高**(RSS协议稳定) | 低(反爬升级) |
| 延迟 | 1-30s | 1-30s |
| 费用 | **$0** | **$0** |
| 源数量 | **23+** | 5-8 |

> **结论**: RSS方案完胜。23+免费RSS源覆盖所有市场, 零维护零费用零合规风险。

---

## 九、里程碑

```
R238 → RSS框架+Investing.com 30feed+ActuallyFreeAPI ✅
R239 → 5英文源+5加密源 全接入 ✅
R240 → DeepSeek AI情绪+10源注册+降级+计费 ✅
R241 → 中文+商品+社交 全覆盖 ✅
R242 → 情绪热力图+恐贪+时间线+日报 ✅
R243 → 🎯 23源全绿 → v2.6.5 消息因子生产化 发布
```

---

*方案制定: 2026-06-16 | 🦞 Claw (PM) | 零费用/零KYC/全RSS*
