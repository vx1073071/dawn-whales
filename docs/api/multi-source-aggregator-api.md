<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# MultiSourceAggregator API 文档

**Phase**: 5.0 R41  
**文件**: `electron/engine/multi-source-aggregator.ts` (888 行)  
**作者**: JVS  
**审查**: 待审查  

---

## 概述

MultiSourceAggregator 多源数据聚合引擎，支持 4 个金融数据源（东方财富/新浪/腾讯/雪球），提供优先级降级、健康监控和共识评分。

---

## 类型定义

### DataSourceId

```typescript
type DataSourceId = 'eastmoney' | 'sina' | 'tencent' | 'xueqiu';
```

### DataQuality

```typescript
type DataQuality = 'high' | 'medium' | 'low' | 'unavailable';
```

### DataSourceConfig

```typescript
interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  priority: number;           // lower = higher priority
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  healthCheckIntervalMs: number;
}
```

### DataPoint

```typescript
interface DataPoint {
  symbol: string;
  source: DataSourceId;
  price: number;
  volume: number;
  timestamp: number;
  quality: DataQuality;
  confidence: number;         // 0-1
}
```

### SourceHealth

```typescript
interface SourceHealth {
  id: DataSourceId;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: number;
  latencyMs: number;
  successRate: number;        // 0-1
  errorCount: number;
  lastError?: string;
}
```

### AggregatedData

```typescript
interface AggregatedData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  sources: DataPoint[];
  consensusScore: number;     // 0-1
  quality: DataQuality;
  spread: number;             // price spread across sources
}
```

---

## MultiSourceAggregator 类

### 构造函数

```typescript
constructor(config?: Partial<AggregatorConfig>)
```

### 数据获取

#### getData(symbol)
获取聚合数据。

```typescript
async getData(symbol: string): Promise<AggregatedData>
```

#### getDataBatch(symbols)
批量获取聚合数据。

```typescript
async getDataBatch(symbols: string[]): Promise<Map<string, AggregatedData>>
```

### 源管理

#### getSourceHealth(sourceId?)
获取数据源健康状态。

```typescript
getSourceHealth(sourceId?: DataSourceId): SourceHealth | SourceHealth[]
```

#### enableSource(sourceId, enabled)
启用/禁用数据源。

```typescript
enableSource(sourceId: DataSourceId, enabled: boolean): void
```

#### setSourcePriority(sourceId, priority)
设置数据源优先级。

```typescript
setSourcePriority(sourceId: DataSourceId, priority: number): void
```

### 配置方法

#### setConfig(config)
更新聚合器配置。

```typescript
setConfig(config: Partial<AggregatorConfig>): void
```

#### getConfig()
获取当前配置。

```typescript
getConfig(): AggregatorConfig
```

### 管理方法

#### startHealthChecks()
启动健康检查。

```typescript
startHealthChecks(): void
```

#### stopHealthChecks()
停止健康检查。

```typescript
stopHealthChecks(): void
```

#### reset()
重置引擎状态。

```typescript
reset(): void
```

---

## 数据源优先级

```typescript
// 默认优先级（lower = higher priority）
eastmoney: 1    // 最高优先级
sina:      2
tencent:   3
xueqiu:    4    // 最低优先级
```

---

## 降级策略

```
1. 尝试最高优先级源
2. 如果失败/超时，尝试下一个优先级
3. 如果所有源失败，返回错误
4. 记录失败原因和降级路径
```

---

## 共识评分

```typescript
// 共识评分计算
consensusScore = 1 - (priceSpread / avgPrice)
// priceSpread: 各源价格标准差
// avgPrice: 各源平均价格
```

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `data:received` | 数据接收 | `AggregatedData` |
| `source:healthy` | 源健康 | `SourceHealth` |
| `source:degraded` | 源降级 | `SourceHealth` |
| `source:down` | 源宕机 | `SourceHealth` |
| `source:fallback` | 源降级切换 | `{ from, to, reason }` |
| `health:check` | 健康检查完成 | `SourceHealth[]` |

---

**文档生成**: dao  
**时间**: 2026-06-07T05:36:00+08:00
