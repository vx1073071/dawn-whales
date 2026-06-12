# Dawn Whales 行情系统深度学习建议 v1.0

> 2026-06-12 | 作者: youdao | 提交: PM(Claw/64001)

---

## 摘要

当前 dawn-whales 行情系统基于 `QuoteAggregator` + `CodeNormalizer` + `BrokerEventBus` 实现了多券商行情聚合基础。通过深度学习行业最佳实践，建议在以下 6 个方向深化：

---

## 一、订单簿深度分析 (Order Book Depth Analytics)

### 1.1 现状
当前仅有 `getDepth()` 接口定义（`IBrokerAdapterV2`），返回 Bid/Ask 列表，未做深度分析。

### 1.2 建议新增模块: `DepthAnalyzer`

```
electron/engine/market/depth-analyzer.ts
```

**核心功能**:

| 功能 | 说明 | 实现要点 |
|------|------|---------|
| **Imbalance Ratio** | 买卖盘失衡度 | `(sum(bids) - sum(asks)) / (sum(bids) + sum(asks))`，阈值>0.3预警 |
| **Wall Detection** | 大单墙识别 | 单档挂单量超过前5档均值3x以上标记为"墙" |
| **Spoofing Detection** | 虚假挂单检测 | 大单频繁挂撤（挂单量>均值5x且在5s内撤单）标记可疑 |
| **Liquidity Score** | 流动性评分 | 基于深度衰减系数 + 买卖价差 + 挂单密度综合评分 0-100 |
| **Slippage Estimate** | 滑点预估 | 给定订单量，模拟吃单深度，计算加权均价vs最优价的偏离 |
| **Depth Heatmap** | 深度热力图 | 时间维度上各档位挂单量的变化热力，发现支撑/阻力位 |

### 1.3 数据来源
- 币安: `GET /api/v3/depth?limit=100` (100档，可到5000档)
- OKX: `GET /market/books?sz=400` (400档)
- Bybit: `GET /v5/market/orderbook?category=spot&limit=200`
- 富途: 摆盘推送 (10档)

### 1.4 价值
- 重大单预警 → 跟单/止损
- 流动性评分 → 自动选择最优交易所执行
- 滑点预估 → 大单拆分策略

---

## 二、实时行情推送优化

### 2.1 现状
当前 `QuoteAggregator.onBrokerQuote()` 逐条接收→Tagged→缓存→分发。存在以下问题：
- 无去重机制：同一标的来自多券商时，重复推送
- 无节流控制：高频币种每秒数百条ticker，前端渲染压力大
- 无优先级：低价股票和BTC同样频率推送

### 2.2 建议优化

**A. Smart Throttling (智能节流)**

```
electron/engine/market/quote-throttler.ts
```

- 基于价格的动态节流:
  - BTC/ETH: 最多 10条/秒 (高流动性可承受)
  - 中小市值: 最多 4条/秒
  - 低价penny stock: 最多 1条/秒 (过快变动无意义)
- 基于变动幅度的过滤: 价格变化 < 0.01% 且量变化 < 1% → 不推送
- 聚合窗口: 100ms窗口内同一标的取最新值

**B. Differential Push (增量推送)**

- 仅推送变化的字段，而非全量TaggedQuoteInfo
- 前端维护本地缓存，只更新变化字段
- 减少IPC带宽 70%+

**C. Priority Queue (优先级队列)**

- Level 1 (实时): 持仓标的、watchlist、当前策略依赖
- Level 2 (较慢): 关注的但非持仓
- Level 3 (最慢): 市场概览指数

### 2.3 价值
- 前端渲染帧率提升 3-5x
- IPC带宽节省 50-70%
- 降低CPU占用，尤其15+券商同时推送时

---

## 三、跨交易所套利增强

### 3.1 现状
`QuoteAggregator.scanArbitrageOpportunities(thresholdPct)` 基础实现。

### 3.2 建议新增

**A. Triangular Arbitrage (三角套利)**

```
electron/engine/market/triangular-arbitrage.ts
```

- 同一交易所内: BTC→ETH→USDT→BTC 的环形套利
- 跨交易所: Binance BTC/USDT → OKX ETH/BTC → Bybit ETH/USDT
- 需要汇率换算 + 手续费建模

**B. Statistical Arbitrage (统计套利)**

```
electron/engine/market/stat-arbitrage.ts
```

- 配对交易: 计算两只相关标的价格比率的Z-score
- 跨交易所价差建模: 历史价差均值±2σ作为入场/出场信号
- 协整检验 (Johansen test): 确认套利对的长期均衡关系

**C. Latency Arbitrage Monitor (延迟套利监控)**

- 测量各交易所ticker到达时间的差异（相对延迟）
- 标记"迟到"的交易所（>100ms延迟），其价格可能过时
- 前端显示各交易所实时延迟热力

### 3.3 价格建模

```
实际可用套利 = (ask_binance - bid_okx) - (fee_binance + fee_okx) - (slippage_binance + slippage_okx) - transfer_cost
```

- fee: 0.1% (maker/taker因交易所而异)
- slippage: 基于DepthAnalyzer预估
- transfer_cost: 跨交易所转账gas费/提币费

---

## 四、市场微观结构分析 (Market Microstructure)

### 4.1 建议新增模块: `MicrostructureEngine`

```
electron/engine/market/microstructure-engine.ts
```

| 指标 | 说明 | 公式/来源 |
|------|------|----------|
| **Effective Spread** | 有效价差 | `2 * |price - mid| / mid`，比 quoted spread 更精准 |
| **Realized Spread** | 已实现价差 | 成交后价格的回退幅度，反映信息不对称 |
| **Amihud Illiquidity** | Amihud非流动性 | `|return| / volume`，越高 = 越不流动 |
| **VPIN** | Volume-synchronized PIN | 成交量同步的信息不对称概率，预警闪崩 |
| **Order Flow Toxicity** | 订单流毒性 | VPIN扩展，Maker/Taker量比，>0.8 = 撤退信号 |
| **Kyle's Lambda** | 价格冲击系数 | 单位成交量引起的价格变化，大单影响预估 |
| **HFT Detection** | 高频交易检测 | 极短时间窗口内order/trade量比 > 10 |

### 4.2 价值

- **闪崩预警**: VPIN > 0.8 → 自动暂停该标的下单
- **执行优化**: Kyle's Lambda 帮助大单拆分策略选择最优交易所
- **交易所质量评分**: 综合 spread/impact/liquidity 对各交易所打分

---

## 五、历史行情回放与分析

### 5.1 建议新增模块: `MarketReplayEngine`

```
electron/engine/market/market-replay-engine.ts
```

**功能**:
- 行情录制 (Record): 所有券商实盘ticker/trade定时写入本地SQLite
- 回放 (Replay): 选择时间段/券商/标的，倍速回放历史行情
- 事件标记 (Tag): 标注重要事件（暴跌/财报/新闻）
- 策略回测 (Backtest): 基于历史行情数据回放运行策略

**存储估算** (单券商全市场):
- 实时ticker: ~2KB/s * 86400 = ~170MB/day
- 深度数据: ~50KB/s (压缩) * 86400 = ~4.3GB/day
- 建议: Ticker全录, 深度按需录, 压缩+按日清理

---

## 六、行情可视化增强

### 6.1 建议新增前端组件

| 组件 | 说明 | 数据来源 |
|------|------|---------|
| **Footprint Chart** | 成交量分布图（每价格档位bid/ask量） | DepthAnalyzer |
| **Order Flow Heatmap** | 订单流热力，delta divergence识别 | Time & Sales数据 |
| **Spread Monitor** | 跨券商spread对比雷达图 | QuoteAggregator |
| **DOM Ladder** | 实时订单簿梯形图（类似TradingView DOM） | getDepth() |
| **Volume Profile** | 固定时间段的成交量分布直方图 | Kline数据聚合 |
| **Correlation Matrix** | 跨币种/跨市场相关性热力图 | 历史价格计算 |
| **Liquidity Map** | 各交易所各币种流动性热力地图 | DepthAnalyzer汇总 |

### 6.2 技术实现

- Canvas/WebGL 渲染大量DOM数据（避免React重渲染瓶颈）
- Web Worker 处理行情数据聚合计算
- Virtual scrolling 处理多标的展示

---

## 七、建议优先级与工时估算

| 优先级 | 模块 | 预估工时 | 理由 |
|--------|------|---------|------|
| **P0** | Smart Throttling + Differential Push | 8h | 直接提升15+券商并发稳定性 |
| **P0** | DepthAnalyzer (Imbalance + Wall + Liquidity) | 12h | 差异化核心功能 |
| **P1** | Order Flow Toxicity (闪崩预警) | 8h | 风控刚需 |
| **P1** | Cross-Venue Statistical Arbitrage | 12h | 套利增强，直接用户价值 |
| **P2** | Spread Monitor UI + DOM Ladder | 10h | 专业交易者必需 |
| **P2** | MarketReplayEngine | 16h | 策略回测基础设施 |
| **P2** | Triangular Arbitrage | 8h | 加密货币特色套利 |
| **P3** | VPIN + Kyle's Lambda | 10h | 学术级分析 |
| **P3** | Volume Profile + Footprint Chart | 12h | 高级可视化 |
| **总计** | 10 个模块 | **96h** | 可分多轮实施 |

---

## 八、与现有多券商架构的集成

```
                    QuoteAggregator (现有)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                   │
   DepthAnalyzer    QuoteThrottler    MicrostructureEngine
   (新增 P0)        (新增 P0)         (新增 P1)
        │                  │                   │
        └──────────────────┼──────────────────┘
                           │
                   BrokerEventBus (现有)
                           │
               ┌───────────┼───────────┐
               │           │           │
        ArbitragePanel  DOM Ladder  Spread Monitor
        (增强)          (新增 P2)    (新增 P1)
```

所有新模块通过 `BrokerEventBus` 订阅行情数据，不破坏现有架构。

---

## 九、外部参考

| 主题 | 参考资源 |
|------|---------|
| Market Microstructure | "Empirical Market Microstructure" — Joel Hasbrouck |
| VPIN | "The Volume Clock" — Easley, Lopez de Prado, O'Hara |
| Order Book Imbalance | "Order Imbalance Based Strategy" — Cont, Kukanov, Stoikov |
| Triangular Arbitrage | Binance/OKX/Bybit API @rate limits |
| Smart Order Routing | "Optimal Execution" — Almgren & Chriss |
| Websocket Optimization | Binance Combined Streams, OKX WS public channel |
| Visualization | TradingView Charting Library, lightweight-charts |

---

## 十、建议决策

**给 PM 的建议**:

1. **P0 优先 (32h)**: Smart Throttling + DepthAnalyzer → 直接解决 15+ 券商并发稳定性和功能深度
2. **P1 其次 (20h)**: MicrostructureEngine + StatArbitrage → 风控+套利双核心
3. **可考虑设立"行情专项 Round"**，由 youdao 或 ML 主导实施
4. **部分功能可复用现有代码**:
   - `QuoteAggregator` 已处理多券商行情数据流 → 新模块直接订阅 BrokerEventBus
   - `DepthAnalyzer` 可基于已定义的 `IbrokerAdapterV2.getDepth()` 接口
   - `QuoteThrottler` 可作为 `QuoteAggregator` 的中间层插入
5. **考虑跨轮次分配**: JVS(DepthAnalyzer + Throttler) + ML(Microstructure能) + youdao(测试+文档)
