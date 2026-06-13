# SymbolQuoteRouter — 行情路由设计文档

> **版本**: v1.0 | **日期**: 2026-06-13 | **作者**: QClaw (文档虾)
> **源码**: `server/services/quote-router.ts` | **状态**: Draft → PM 审阅

---

## 一、概述

SymbolQuoteRouter 是多券商行情聚合的核心路由层。每个标的在任意时刻**绑定唯一行情源**，按优先级选择，源故障时自动切换。

### 核心原则
```
一标的 = 一行情源 = 一券商
不混源，不复用，不合并
```

### 为什么不混源？
- 不同券商对同一标的的报价精度不同 (Futu 细到 0.001，eToro 可能到 0.01)
- 不同券商的时间同步偏移不同 (Futu 误差 ~10ms，IBKR ~50ms)
- 合并多个源会产生「价格抖动」— 来回跳 0.01 误导用户
- 单一源 = 确定性 = 可追溯 = 可审计

---

## 二、三级路由策略

```
Level 1: 按市场+资产类型匹配 → 选出候选券商列表
Level 2: 按优先级排序       → 高优先级优先
Level 3: 健康度筛选         → 剔除延迟>500ms 或断开
```

### 2.1 Level 1 — 市场+资产类型匹配

每个标的按 `detectMarket(symbol)` 确定市场，然后查**券商市场映射表**获取候选券商。

| 市场 | 资产类型 | 候选券商 (优先级排序) |
|------|---------|---------------------|
| **HK** (港股) | Stock | 富途 > 华盛 > 盈立 > Tiger > IBKR |
| **HK** | Futures | 富途 > IBKR |
| **HK** | Options | 富途 > IBKR |
| **US** (美股) | Stock | IBKR > E*TRADE > Webull > eToro > 富途 > Tiger > 盈立 |
| **US** | Futures | IBKR > E*TRADE |
| **US** | Options | IBKR > E*TRADE |
| **CRYPTO** | Spot | Binance > OKX > eToro |
| **CRYPTO** | Contract | Binance > OKX |
| **CN** (A股) | Stock | 富途 > 华盛 > 盈立 > Tiger |
| **SG** (新加坡) | Stock | IBKR > Tiger |
| **JP** (日本) | Stock | IBKR |
| **EU** (欧洲) | Stock | IBKR > eToro |

### 2.2 Level 2 — 优先级排序

优先级基于三要素加权:

| 要素 | 权重 | 说明 |
|------|------|------|
| 数据质量 | 50% | 精确度 (小数位数) + tick 密度 + 历史数据深度 |
| 延迟 | 30% | 平均 RTT 越低越好 |
| 稳定性 | 20% | 断连频率 + 恢复时间 |

每券商预设默认优先级 (见上表)。同一市场的券商按此顺序排列。

### 2.3 Level 3 — 健康度筛选

```
主源 (rank 0):
  延迟 < 500ms & 连接已建立 → 选中
  
  延迟 > 500ms 或 连接断开:
    → 切换到备选 (rank 1)
    → 每 30s 尝试切回主源
    → 主源恢复 → 自动切回
```

**延迟阈值**:
| 市场 | 主源超时 | 备选切换触发 |
|------|---------|-------------|
| HK | 300ms | > 500ms |
| US | 500ms | > 800ms |
| CRYPTO | 200ms | > 500ms |
| CN (A股) | 300ms | > 600ms |

---

## 三、故障切换 (Failover)

### 3.1 切换流程
```
┌──────────────────────────────────────┐
│  SymbolQuoteRouter.getQuote(symbol)   │
│                                      │
│  1. detectMarket(symbol)             │
│  2. getCandidateBrokers(market)       │
│  3. for each broker (sorted by prio):│
│     if healthCheck(broker) == OK:    │
│       return broker.getQuote(symbol) │
│  4. throw NoQuoteSourceAvailable      │
└──────────────────────────────────────┘
```

### 3.2 切换规则
- **切换是瞬时的**: 一旦检测到主源不健康，立即使用备选
- **切回是延迟的**: 主源恢复后等待 30s 连续健康才切回，防止抖动
- **中断不重试**: 备选上不重试主源的失败请求 (防止超过用户等待时间)
- **用户可见状态**: UI 显示当前行情源 (如 "行情源: 华盛")

### 3.3 降级状态机
```
[主源健康] ──(主源>500ms)──> [备选激活] ──(主源30s内恢复)──> [主源健康]
     ▲                          │                                 │
     │                          └──(主源30s未恢复)──> [备选稳定] ──┤
     │                                                        │
     └──────────────(主源连续30s健康)──────────────────────────┘
```

---

## 四、SymbolQuoteRouter API

### 4.1 获取报价
```
GET /api/quote/:symbol

Request:
  symbol: "HK.00700" | "US.AAPL" | "CC.BTCUSD"

Response:
{
  symbol: "HK.00700",
  normalizedCode: "HK.00700",
  market: "HK",
  source: "futu",          // 当前行情源
  sourcePriority: 0,       // 0=主源 1=备选 ...
  lastPrice: 385.60,
  bid: 385.40,
  ask: 385.80,
  timestamp: 1718276400000,
  health: "healthy"        // healthy | degraded | failed
}
```

### 4.2 获取行情源状态
```
GET /api/quote/sources?symbol=HK.00700

Response:
{
  symbol: "HK.00700",
  activeSource: "futu",
  sources: [
    { broker: "futu",      status: "healthy", latency: 45 },
    { broker: "huasheng",  status: "healthy", latency: 120 },
    { broker: "yingli",    status: "healthy", latency: 200 },
    { broker: "tiger",     status: "healthy", latency: 350 },
    { broker: "ibkr",      status: "degraded", latency: 650 }
  ]
}
```

### 4.3 强制切换
```
POST /api/quote/switch
Body: { symbol: "HK.00700", forceSource: "huasheng" }

Response:
{
  symbol: "HK.00700",
  source: "huasheng",
  forced: true,
  autoRevertIn: 300  // seconds, 0 = permanent
}
```

---

## 五、与代码标准化器的集成

### 5.1 输入→输出管道
```
用户输入 "腾讯" / "0700" / "00700" / "700"
       ↓
   code-normalizer.ts
       ↓
   "HK.00700"  ← 标准化代码
       ↓
   detectMarket("HK.00700") → "HK"
       ↓
   quote-router.ts → 富途 (优先级 0, 延迟 45ms)
```

### 5.2 标准化容错
| 输入 | 标准化结果 | 检测市场 |
|------|-----------|---------|
| `0700` | `HK.00700` | HK |
| `00700` | `HK.00700` | HK |
| `700` | `HK.00700` | HK |
| `腾讯` | `HK.00700` | HK |
| `AAPL` | `US.AAPL` | US |
| `BTC` | `CC.BTCUSD` | CRYPTO |
| `600519` | `SH.600519` | CN |
| `000001` | `SZ.000001` | CN |

---

## 六、性能指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 搜索响应 | < 200ms | GET /api/symbol/search 端到端 |
| 报价查询 | < 100ms (缓存命中) | quote-router internal |
| 报价查询 | < 500ms (缓存未命中) | broker WS/HTTP round trip |
| 故障切换 | < 50ms (检测+切换到备选) | health check 间隔 |
| 并发 | 100 并发报价 < 500ms | 压力测试 |

### 缓存策略
```
quoteCache:
  TTL: 100ms (市场 tick)
  ica: 单个 symbol → 最多一个源
  失效条件: 源切换 / 新 tick 到达 / TTL 过期
```

---

## 七、错误处理

| 场景 | 行为 | 用户看到 |
|------|------|---------|
| 所有源断开 | `NoQuoteSourceAvailable` | "该标的暂无可用行情源" + 重试按钮 |
| 主源降级 | 自动切备选 | 行情正常显示 + 源标识变黄 |
| 备选也断开 | 取最后缓存价格 | 价格灰显 + "延迟数据" 标签 |
| 代码无法标准化 | `InvalidSymbol` | "无法识别该代码" + 市场参考列表 |
| 券商无该标的 | 跳过该券商 | 不报错，试下一个候选 |

---

## 八、监控与日志

```
日志格式:
[quote-router] {symbol} → {source} ({latency}ms) [priority: {n}]

告警条件:
- 主源 > 10 秒不健康 → ⚠️ 通知 PM
- 所有源断开 > 30 秒 → 🔴 紧急告警
- 30 秒内 > 50 次源切换 → ⚠️ 抖动告警
```

---

> **设计审查**: 待 PM 确认优先级排序权重 (50/30/20)
> **下一轮**: 券商市场映射表细化 (每家券商的精确市场支持列表)
