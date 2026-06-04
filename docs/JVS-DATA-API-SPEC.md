# JVS 数据层 API 规范文档 (JVS-36)

> 版本: 1.0.0  
> 更新日期: 2026-06-05  
> 模块数: 60+ 个数据模块  
> IPC 接口数: 100+

---

## 目录

1. [数据模块总览](#数据模块总览)
2. [IPC 接口规范](#ipc-接口规范)
3. [错误码规范](#错误码规范)
4. [数据格式规范](#数据格式规范)
5. [缓存策略](#缓存策略)
6. [WebSocket 实时数据](#websocket-实时数据)
7. [前端调用示例](#前端调用示例)

---

## 数据模块总览

### 核心数据模块

| 模块 | IPC 前缀 | 功能 | 状态 |
|------|---------|------|------|
| Sector Heatmap | `em:get-heatmap` | 板块热力图数据 | ✅ |
| Macro Data | `em:get-macro` | 宏观经济数据 (GDP/CPI/PMI/PPI) | ✅ |
| Sentiment Index | `em:get-sentiment` | 市场情绪指数 | ✅ |
| Stock Screener | `em:get-screener` | 多因子选股 | ✅ |
| News Aggregator | `em:get-news` | 新闻聚合 | ✅ |
| Sector Rotation | `em:get-sector-rotation` | 板块轮动 | ✅ |
| Anomaly Detector | `em:get-anomaly` | 异动检测 | ✅ |
| Market Hotspot | `em:get-hotspot` | 热点发现 | ✅ |
| Options Pricing | `em:get-options` | 期权定价 | ✅ |
| Risk Metrics | `em:get-risk` | 风险指标 | ✅ |
| Performance Attribution | `em:get-attribution` | 业绩归因 | ✅ |
| Correlation Matrix | `em:get-correlation` | 相关性矩阵 | ✅ |
| Multi-Factor Selector | `em:get-multi-factor` | 多因子选股 | ✅ |
| Portfolio Optimizer | `em:get-portfolio-opt` | 组合优化 | ✅ |
| Options Chain | `em:get-options-chain` | 期权链分析 | ✅ |
| WebSocket Enhancer | `em:get-ws-*` | WebSocket 增强 | ✅ |
| Backfill Service | `em:get-backfill` | 数据回填 | ✅ |
| Realtime Indicators | `em:get-realtime-ind` | 实时技术指标 | ✅ |

### 实时数据模块

| 模块 | IPC 前缀 | 功能 | 状态 |
|------|---------|------|------|
| Realtime Sentiment | `sentiment:realtime-*` | 实时情绪推送 | ✅ |
| Capital Flow RT | `capital:rt-*` | 资金流向实时 | ✅ |
| OpenD Health | `opd:health-*` | OpenD 健康监控 | ✅ |
| Realtime Indicators | `indicator:realtime-*` | 实时技术指标 | ✅ |

---

## IPC 接口规范

### 通用响应格式

```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  timestamp?: number;
}
```

### 核心数据接口

#### `em:get-heatmap`

获取板块热力图数据。

**参数:**
```typescript
{
  type?: 'industry' | 'concept' | 'region';  // 默认 'industry'
  limit?: number;  // 默认 50
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    sectors: Array<{
      code: string;
      name: string;
      changePct: number;
      changeAmt: number;
      volume: number;
      leadingStock: string;
      leadingStockChangePct: number;
    }>;
    total: number;
    timestamp: number;
  }
}
```

**错误码:**
- `HEATMAP_FETCH_FAILED`: 数据获取失败
- `HEATMAP_PARSE_ERROR`: 数据解析错误

---

#### `em:get-macro`

获取宏观经济数据。

**参数:**
```typescript
{
  indicator?: 'GDP' | 'CPI' | 'PMI' | 'PPI';  // 默认 'GDP'
  limit?: number;  // 默认 10
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    indicator: string;
    dataPoints: Array<{
      date: string;
      value: number;
      change?: number;
    }>;
    latest: {
      value: number;
      date: string;
      change?: number;
    };
  }
}
```

---

#### `em:get-sentiment`

获取市场情绪指数。

**参数:**
```typescript
{
  symbol?: string;  // 股票代码（可选）
  timeframe?: '1h' | '4h' | '1d';  // 默认 '1h'
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    score: number;  // 0-100
    level: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
    components: {
      momentum: number;
      volatility: number;
      breadth: number;
      volume: number;
    };
    timestamp: number;
  }
}
```

---

#### `em:get-screener`

多因子选股。

**参数:**
```typescript
{
  factors: Array<{
    name: string;
    weight: number;
    direction: 'asc' | 'desc';
  }>;
  filters?: {
    marketCap?: { min?: number; max?: number };
    pe?: { min?: number; max?: number };
    pb?: { min?: number; max?: number };
  };
  limit?: number;  // 默认 50
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    stocks: Array<{
      code: string;
      name: string;
      score: number;
      factorScores: Record<string, number>;
      price: number;
      changePct: number;
      marketCap: number;
      pe: number;
      pb: number;
    }>;
    total: number;
    timestamp: number;
  }
}
```

---

#### `em:get-options`

期权定价计算。

**参数:**
```typescript
{
  method: 'black-scholes';
  params: {
    underlyingPrice: number;
    strikePrice: number;
    timeToExpiry: number;  // 年
    riskFreeRate: number;
    volatility: number;
    optionType: 'call' | 'put';
  };
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    price: number;
    greeks: {
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
      rho: number;
    };
    iv: number;
    timestamp: number;
  }
}
```

---

#### `em:get-risk`

风险指标计算。

**参数:**
```typescript
{
  returns: number[];
  riskFreeRate?: number;  // 默认 0.02
  confidenceLevel?: number;  // 默认 0.95
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    volatility: number;
    var: number;  // Value at Risk
    cvar: number;  // Conditional VaR
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    timestamp: number;
  }
}
```

---

#### `em:get-attribution`

业绩归因分析。

**参数:**
```typescript
{
  method: 'brinson';
  portfolioReturns: number[];
  benchmarkReturns: number[];
  sectorWeights?: Record<string, number>;
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    allocationEffect: number;
    selectionEffect: number;
    interactionEffect: number;
    totalEffect: number;
    sectorAttribution: Record<string, number>;
    timestamp: number;
  }
}
```

---

#### `em:get-correlation`

相关性矩阵计算。

**参数:**
```typescript
{
  symbols: string[];
  returns: Record<string, number[]>;
  method?: 'pearson' | 'spearman';  // 默认 'pearson'
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    symbols: string[];
    matrix: number[][];
    timestamp: number;
  }
}
```

---

#### `em:get-multi-factor`

多因子选股引擎。

**参数:**
```typescript
{
  symbols: string[];
  factors: string[];  // ['momentum', 'value', 'quality', 'volatility', 'liquidity']
  weights?: Record<string, number>;
  limit?: number;  // 默认 50
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    stocks: Array<{
      symbol: string;
      score: number;
      factorScores: Record<string, number>;
      rank: number;
    }>;
    timestamp: number;
  }
}
```

---

#### `em:get-portfolio-opt`

组合优化。

**参数:**
```typescript
{
  method: 'markowitz' | 'black-litterman' | 'risk-parity';
  symbols: string[];
  returns: Record<string, number[]>;
  constraints?: {
    minWeight?: number;
    maxWeight?: number;
    targetReturn?: number;
  };
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    weights: Record<string, number>;
    expectedReturn: number;
    expectedVolatility: number;
    sharpe: number;
    timestamp: number;
  }
}
```

---

#### `em:get-options-chain`

期权链分析。

**参数:**
```typescript
{
  symbol: string;
  expiry?: string;  // ISO date string
}
```

**响应:**
```typescript
{
  success: true,
  data: {
    calls: Array<{
      strike: number;
      price: number;
      iv: number;
      volume: number;
      openInterest: number;
      greeks: { delta: number; gamma: number; theta: number; vega: number };
    }>;
    puts: Array<{ /* same structure */ }>;
    timestamp: number;
  }
}
```

---

## 实时数据接口

### WebSocket 连接

```typescript
// 连接
await window.api.websocketEnhancer.connect({
  url: 'wss://...',
  symbols: ['600519.SH', '000858.SZ']
});

// 监听实时数据
window.api.websocketEnhancer.onQuote((data) => {
  console.log(data);
});

// 断开连接
await window.api.websocketEnhancer.disconnect();
```

### 实时技术指标

```typescript
// 添加 K 线数据
await window.api.realtimeIndicators.addKLine(symbol, kline);

// 获取指标
const indicators = await window.api.realtimeIndicators.getIndicators(symbol);
```

---

## 错误码规范

| 错误码 | 描述 | 建议处理 |
|--------|------|----------|
| `FETCH_FAILED` | 数据获取失败 | 重试或显示缓存数据 |
| `PARSE_ERROR` | 数据解析错误 | 显示错误提示 |
| `TIMEOUT` | 请求超时 | 重试或显示超时提示 |
| `INVALID_PARAMS` | 参数错误 | 检查输入参数 |
| `NO_DATA` | 无数据 | 显示空状态 |
| `CACHE_EXPIRED` | 缓存过期 | 重新获取数据 |
| `WS_DISCONNECTED` | WebSocket 断开 | 自动重连或提示用户 |

---

## 缓存策略

| 数据类型 | 缓存时间 | 更新策略 |
|----------|----------|----------|
| 板块热力图 | 5 分钟 | 自动刷新 |
| 宏观数据 | 1 小时 | 手动刷新 |
| 情绪指数 | 1 分钟 | 实时推送 |
| 选股结果 | 10 分钟 | 手动刷新 |
| 新闻聚合 | 5 分钟 | 自动刷新 |
| 期权定价 | 实时 | 实时计算 |
| 风险指标 | 实时 | 实时计算 |

---

## 前端调用示例

### React Hook 示例

```typescript
import { useQuery } from '@tanstack/react-query';
import { getSectorHeatmap } from '@/lib/bridge-api';

export function useSectorHeatmap(type: 'industry' | 'concept' = 'industry') {
  return useQuery({
    queryKey: ['sector-heatmap', type],
    queryFn: () => getSectorHeatmap(type),
    refetchInterval: 5 * 60 * 1000,  // 5 分钟自动刷新
  });
}

export function useMacroData(indicator: string) {
  return useQuery({
    queryKey: ['macro', indicator],
    queryFn: () => getMacroData(indicator),
    refetchInterval: 60 * 60 * 1000,  // 1 小时自动刷新
  });
}

export function useSentiment(symbol?: string) {
  return useQuery({
    queryKey: ['sentiment', symbol],
    queryFn: () => getSentiment(symbol),
    refetchInterval: 60 * 1000,  // 1 分钟自动刷新
  });
}
```

### WebSocket 实时数据示例

```typescript
import { useEffect } from 'react';
import { connectWebSocket, disconnectWebSocket } from '@/lib/bridge-api';

export function useRealtimeQuotes(symbols: string[]) {
  useEffect(() => {
    // 连接 WebSocket
    connectWebSocket({ symbols });

    // 监听实时数据
    const unsubscribe = window.api.websocketEnhancer.onQuote((data) => {
      // 更新 UI
      console.log('Realtime quote:', data);
    });

    return () => {
      unsubscribe();
      disconnectWebSocket();
    };
  }, [symbols]);
}
```

---

## 附录：完整 IPC 接口列表

<details>
<summary>点击展开完整列表 (100+ 接口)</summary>

### 核心数据 (em:*)
- `em:get-heatmap`
- `em:get-macro`
- `em:get-sentiment`
- `em:get-screener`
- `em:get-news`
- `em:get-sector-rotation`
- `em:get-anomaly`
- `em:get-hotspot`
- `em:get-options`
- `em:get-risk`
- `em:get-attribution`
- `em:get-correlation`
- `em:get-multi-factor`
- `em:get-portfolio-opt`
- `em:get-options-chain`

### WebSocket 增强 (em:get-ws-*)
- `em:get-ws-connect`
- `em:get-ws-disconnect`
- `em:get-ws-subscribe`
- `em:get-ws-unsubscribe`
- `em:get-ws-status`

### 数据回填 (em:get-backfill-*)
- `em:get-backfill-start`
- `em:get-backfill-stop`
- `em:get-backfill-status`
- `em:get-backfill-progress`

### 实时指标 (em:get-realtime-*)
- `em:get-realtime-indicators`
- `em:get-realtime-add-kline`
- `em:get-realtime-clear`

### 实时情绪 (sentiment:realtime-*)
- `sentiment:realtime-start`
- `sentiment:realtime-stop`
- `sentiment:realtime-subscribe`

### 资金流向实时 (capital:rt-*)
- `capital:rt-start`
- `capital:rt-stop`
- `capital:rt-subscribe`

### OpenD 健康监控 (opd:health-*)
- `opd:health-status`
- `opd:health-latency`
- `opd:health-ping`

</details>

---

> **注意:** 所有接口返回 `success: false` 时，前端应显示错误提示并提供重试按钮。  
> **缓存策略:** 所有数据都有本地缓存，网络失败时自动降级到缓存数据。  
> **实时数据:** WebSocket 连接断开时自动重连，最多重试 5 次。

---

**文档维护:** JVS (jvs@dawn-whales.dev)  
**最后更新:** 2026-06-05 03:12
