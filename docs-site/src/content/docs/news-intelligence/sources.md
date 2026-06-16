---
title: 数据源接入指南
description: DAWN WHALES 消息智能平台 40+ 数据源完整接入说明 — RSS 配置、API 密钥、多语言支持
---

# 📡 数据源接入指南

> 版本: v2.7.0 | 最后更新: 2026-06-16

## 总览

消息智能平台接入 **40+ 数据源**，覆盖 **12 个全球市场** 和 **11 种语言**。所有源均采用零费用方案（免费 RSS + 免费 API 层）。

---

## 中文源 (3)

### 雪球 (Xueqiu)
- **模块**: `electron/engine/data/xueqiu-fetcher.ts`
- **接入方式**: HTTP API (无需认证)
- **端点**: 热门帖子 + 个股搜索
- **更新频率**: 60s
- **限制**: 无官方 API，通过公开接口抓取

```typescript
import { getXueqiuFetcher } from './electron/engine/data';

const fetcher = getXueqiuFetcher();
const posts = await fetcher.fetchHotPosts(20); // 获取热门帖子
const tickerNews = await fetcher.searchByTicker('AAPL');
```

### 财联社电报 (CLS Telegraph)
- **模块**: `electron/engine/data/cls-telegraph-fetcher.ts`
- **接入方式**: CLS API + RSS fallback
- **端点**: 实时电报流
- **更新频率**: 30s
- **特点**: 7×24 滚动快讯，财经突发首选

```typescript
import { getCLSTelegraphFetcher } from './electron/engine/data';

const fetcher = getCLSTelegraphFetcher();
const telegraphs = await fetcher.fetchLatest(50);
```

### 华尔街见闻 / 金十数据 / 新浪财经
- **模块**: `electron/engine/data/CNSources.ts`
- **接入方式**: RSS
- **语言**: 中文

---

## 英文综合源 (10+)

### NewsAPI.org
- **模块**: `electron/engine/data/newsapi-manager.ts`
- **接入方式**: REST API (需密钥)
- **免费层**: 100 请求/天，付费层: 500 请求/天
- **安全**: AES-256-GCM 密钥加密存储，72h 轮换宽限期
- **覆盖**: 100+ 新闻源聚合

```typescript
import { getNewsAPIKeyManager, NewsAPIFetcher } from './electron/engine/data';

const manager = getNewsAPIKeyManager();
manager.addKey('your-api-key');

const fetcher = new NewsAPIFetcher(manager);
const articles = await fetcher.search({ q: 'AAPL', language: 'en', pageSize: 20 });
```

### Reuters / CNBC / Yahoo Finance / MarketWatch / Seeking Alpha
- **接入方式**: RSS
- **特点**: 无密钥，零成本
- **更新频率**: 60-120s

---

## 加密源 (5)

| 源 | RSS URL | 更新 |
|------|------|:---:|
| CoinDesk | `coindesk.com/arc/outboundfeeds/rss` | 60s |
| CoinTelegraph | `cointelegraph.com/rss` | 60s |
| Decrypt | `decrypt.co/feed` | 120s |
| The Block | `theblock.co/rss.xml` | 120s |
| CryptoFeedr | `cryptofeedr.com` | 120s |

**模块**: `electron/engine/data/crypto-feeds.ts`

```typescript
import { getCryptoFeedsFetcher } from './electron/engine/data';

const fetcher = getCryptoFeedsFetcher();
fetcher.setSymbols(['BTC', 'ETH', 'SOL']);
const news = await fetcher.fetch();
```

**覆盖币种**: 30+ 加密货币关键词，10+ 行业标签，7 种事件标签

---

## 社交源 (7)

### Reddit (6 Subreddits)
- **模块**: `electron/engine/data/social-feeds.ts`
- **Subreddits**: r/wallstreetbets, r/stocks, r/investing, r/StockMarket, r/CryptoCurrency, r/weedstocks
- **接入方式**: Reddit JSON API (无需认证)
- **特点**: WSB 情绪 x1.5 放大器，upvote/comment 影响评分
- **限制**: 1s 请求间隔

### StockTwits
- **接入方式**: Per-ticker RSS
- **特点**: 实时社交媒体股票讨论

---

## 区域源 (3)

| 区域 | 源 | 模块 |
|------|------|------|
| 🇯🇵 日本 | Nikkei Asia RDF | `regional-feeds.ts` |
| 🇮🇳 印度 | Investing.com India RSS | `regional-feeds.ts` |
| 🇦🇺 澳洲 | Investing.com Australia RSS | `regional-feeds.ts` |

**时区感知**: 自动处理 UTC+5.5 (印度)、UTC+9 (日本)、UTC+10 (澳洲)

---

## 去重引擎

所有源都经过统一的去重管线：

```
URL 完全匹配 → Jaccard 标题相似度 (>0.9) → Levenshtein 距离 → SHA-256 指纹
```

**模块**: `electron/engine/data/dedup-engine.ts`
**去重率**: > 85%

---

## 源健康检查

每个源都有独立健康状态追踪：

| 状态 | 说明 |
|------|------|
| 🟢 healthy | 最近一次拉取成功 |
| 🟡 degraded | 连续 3 次失败，切换 fallback |
| 🔴 down | 连续 10 次失败，标记不可用 |

系统自动重试和降级，确保整体可用性。

---

## 添加新数据源

1. 实现 `NewsFetcher` 接口 (定义于 `news-types.ts`)
2. 添加源类型到 `NewsSource` 联合类型
3. 在 `index.ts` 中注册导出
4. 编写集成测试验证拉取和解析

```typescript
export interface NewsFetcher {
  id: string;
  name: string;
  fetch(): Promise<NewsItem[]>;
  health?(): Promise<boolean>;
  getStats?(): { lastFetch: number; errorRate: number };
}
```
