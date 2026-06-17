# QUANT MOO 行情系统深度审计 & 变现建议

> youdao | 2026-06-17 05:44 HKT | 致 PM

---

## 一、资产全景

### 1.1 行情数据引擎 (43个文件)

| 类别 | 文件数 | 代表文件 |
|------|:------:|---------|
| 数据源适配 | 4 | `CNSources.ts`, `BinanceRealtimeAdapter.ts`, `futu-ws-adapter.ts`, `ibkr-broker-adapter.ts` |
| 聚合/缓存 | 6 | `multi-source-aggregator.ts`(⚠️仅120B空壳), `quote-router.ts`, `quote-cache.ts`, `market-data-cache-manager.ts` |
| 行情引擎 | 4 | `multi-market-quote-engine.ts`, `realtime-aggregator.ts`, `quote-stream.ts`, `ws-market-data.ts` |
| 健康监控 | 4 | `source-health-monitor.ts`(23KB), `source-health-bar.ts`, `source-health-pipeline.ts`, `source-health-thresholds.ts` |
| 新闻+因子桥 | 8 | `news-factor-bridge.ts`, `watchlist-smart-news.ts`, `news-aggregator.ts` |
| 券商适配 | 4 | `ExchangeAdapters.ts`, `DataAdapters.ts`, `multi-market-broker.ts` |
| 市场关联 | 13 | `market-to-strategy-bridge.ts`, `kline-aggregation-optimizer.ts`, `market-breadth.ts`等 |

### 1.2 29个全球市场

📈 25股票交易所 + 🪙加密货币 + 🛢️商品 + 📊指数 + 💱外汇 + 🔗期权

全部通过 Yahoo Finance WS 免费实时接入。

---

## 二、🔴 致命缺陷 (3项)

### 2.1 `multi-source-aggregator.ts` 仅 120 字节 — 空壳

**发现**: 文件存在但无实质代码，聚合层缺失。
**影响**: 无法实现多源择优、降级、交叉验证。
**修复**: 基于 R253 DQ01 的设计实现完整聚合器 (4h)。

### 2.2 29 市场仅靠 Yahoo 单一源

**发现**: 虽然有 Google/Investing/东方财富 3 个备用源在计划中，但实际代码可能未完全接入。
**影响**: Yahoo 故障 → 全部行情停止。
**修复**: 紧急接入所有备用源并验证降级链。

### 2.3 无行情收费入口

**发现**: 29 市场行情全免费 — 对标 Bloomberg $24,000/年。
**影响**: 最大变现机会完全未利用。专业交易者愿意为低延迟行情付费。

---

## 三、💰 行情变现建议 (对标 Bloomberg/Refinitiv)

### 3.1 分层行情定价

| 层级 | 价格 | 功能 | 目标用户 |
|------|------|------|----------|
| **Free** | $0 | 延迟15分钟行情, 5个自选, 基础图表 | 所有用户 |
| **Live** | 9.9 USDT/月 | 实时行情, 50个自选, Level 1深度 | 活跃散户 |
| **Pro** | 29 USDT/月 | Level 2深度, 全市场, 闪电图, 多屏 | 专业交易者 |
| **Institutional** | 199 USDT/月 | API直连, 低延迟<50ms, 定制推送 | 机构/量化 |

**预估收入**: 200 Live + 50 Pro + 10 Institutional = **5,500 USDT/月**

### 3.2 行情增强付费功能

| 功能 | 价格 | 人类需求 |
|------|------|---------|
| 闪电图 (Time&Sales) | 4.9U/月 | 日内交易者必备 |
| 深度DOM (Level 3) | 9.9U/月 | 专业订单流分析 |
| 异动扫描器 | 2.9U/月 | "刚才什么在涨？" |
| 板块热力图 | 1.9U/月 | 一眼看穿板块轮动 |
| 行情回放 | 3.9U/次 | 复盘训练 |
| 自定义指标 | 4.9U/月 | TradingView用户的刚需 |

### 3.3 数据源价值挖掘

| 数据源 | 原始成本 | 可转售价值 | 建议 |
|--------|---------|-----------|------|
| Yahoo Finance | 免费 | 免费层 | 基础行情 |
| Google Finance | 免费 | 备用源 | 降级保障 |
| 东方财富 | 免费 | CN用户免费 | 中文市场 |
| Investing.com | 免费 | 商品数据 | 商品用户 |
| Binance WS | 免费 | 加密用户 | 币安数据 |

**核心洞察**: 所有数据源免费 → 纯利润。

---

## 四、🟡 人类使用习惯优化 (8项)

### 4.1 行情首页"3秒信息架构"

**问题**: 用户打开 APP 后不知道看什么。
**对标**: Yahoo Finance 首页 — 自选股列表 + 大盘指数 + 头条新闻。

**建议**: QUANT MOO 驾驶舱 (R253 UI-01) 应包含:
```
┌──────────────────────────────────┐
│ 🐮 QUANT MOO         [搜索...]  │
├──────────────────────────────────┤
│ S&P: 5,420 +1.2% 恒生: 19,800   │ ← 全球指数条 (UI-05)
│  Nas: 19,320 +0.8% 日经: 38,500  │
├──────────────────────────────────┤
│ 📊 我的自选                        │
│ AAPL 195.50 +2.3%   MOM_12M 🟢   │
│ NVDA 880.00 +4.1%  短压 🟡        │
├──────────────────────────────────┤
│ 🔥 今日异动                        │
│ NVDA +4.1% 芯片出口管制松动       │
│ TSLA -6.2% 大规模召回             │
├──────────────────────────────────┤
│ 📰 AI早报  市场情绪: 🟢 乐观       │
│ "科技股引领反弹，美联储鸽派信号"    │
└──────────────────────────────────┘
```

### 4.2 自选股"因子信号灯" 

**问题**: 用户只知道价格，不知道因子信号。
**建议**: 自选列表每行增加信号灯 (来自 factor-signal-push):
```
AAPL  195.50 +2.3%  🟢 MOM 🟢 QUAL 🟡 BETA
NVDA  880.00 +4.1%  🟢 MOM 🔴 CROWDING
```

### 4.3 K线图"AI解读按钮"

对标 Robinhood 的"Explain"按钮。
**建议**: K线图右上角增加 `🤖 AI解读 (1U)` 按钮 — 点击后 Whale AI 用一句话解释当前走势。

### 4.4 多市场时钟

R253 UI-06 设计 — 显示全球市场开盘/收盘状态:
```
🟢 东京 (已开盘 2h)  🟢 香港 (已开盘 1h)
⚪ 伦敦 (3h后开盘)    ⚪ 纽约 (8h后开盘)
```

### 4.5 "谁在买/谁在卖"面板

**对标**: Webull/富途的"资金流向"功能。
**建议**: 基于 Binance/Futu 数据，显示主力资金净流入/流出。

### 4.6 "今日关注"推送

**对标**: Seeking Alpha "Top Ideas"。
**建议**: 每天开盘前推送 3 只推荐关注的股票 (基于因子+新闻+异常)。

### 4.7 社交对比 — "你的自选 vs 大众"

**建议**: "你的自选股中，NVDA 本周在 QUANT MOO 用户中被加自选最多的第 3 名"。

### 4.8 "一键切换"数据源

**建议**: 当 Yahoo 延迟高时，自动提示"切换到更快的 Binance 数据源"。

---

## 五、🟢 变现路线图

### Phase 1: 行情分层 (R257, 20h)

| 虾 | 任务 |
|----|------|
| JVS | 实现 Live/Pro/Institutional 三级权限 |
| ML | 行情升级引导 UI |
| QClaw | 升级文案 |
| youdao | 三级行情 E2E 测试 |

**预期**: +5,500 USDT/月

### Phase 2: 行情增强 (R258, 24h)

| JVS | 闪电图引擎 + DOM深度数据 + 异动扫描 |
| ML | 闪电图UI + 深度DOM UI + 异动面板 |
| QClaw | 付费功能文案 |
| youdao | 付费功能 E2E |

**预期**: +1,500 USDT/月

### Phase 3: 数据源增值 (R259, 16h)

| JVS | API 直连接口 (Institutional) |
| ML | API Key 管理 UI |
| autoclaw | 文档站 API 文档 |

**预期**: +2,000 USDT/月

---

## 六、总结

| 指标 | 当前 | 目标 |
|------|------|------|
| 行情月收入 | $0 | **$9,000** |
| 行情源 | Yahoo (单源) | 5源聚合 |
| 聚合器 | 空壳 120B | 完整实现 |
| 用户体验 | 纯K线 | AI解读+信号灯+驾驶舱 |

**核心**: Yahoo Finance 免费数据是最大优势。29个市场 × 实时行情 = 对标 Bloomberg $24,000/年 的数据，完全可以通过分层定价变现。

3轮 R257-R259 = 60h → +9,000 USDT/月行情收入。

---

*审计完成: 2026-06-17 05:44 HKT | youdao | QUANT MOO 🐮*
