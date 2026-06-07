# RealtimeDataFlow API 文档

**Phase**: 6.1 R43  
**文件**: `electron/engine/realtime-data-flow.ts` (1008 行)  
**作者**: JVS  
**审查**: dao (96%)  

---

## 概述

RealtimeDataFlow 实时数据流引擎，统一处理 WebSocket 数据流优化、实时数据聚合、数据质量监控、异常检测四大功能。

---

## 类型定义

### WSConnectionConfig

```typescript
interface WSConnectionConfig {
  id: string;
  url: string;
  protocols?: string[];
  reconnectEnabled?: boolean;
  maxRetries?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
  pingIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}
```

### WSConnectionStatus

```typescript
type WSConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';
```

### WSConnectionState

```typescript
interface WSConnectionState {
  id: string;
  url: string;
  status: WSConnectionStatus;
  retryCount: number;
  lastPingTime: number;
  lastPongTime: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  connectedAt: number;
  disconnectedAt: number;
}
```

### DataQualityScore

```typescript
interface DataQualityScore {
  freshness: number;      // 0-100
  completeness: number;   // 0-100
  consistency: number;    // 0-100
  accuracy: number;       // 0-100
  reliability: number;    // 0-100
  overall: number;        // 0-100
  timestamp: number;
}
```

### AnomalyDetectionConfig

```typescript
interface AnomalyDetectionConfig {
  method: 'z-score' | 'iqr' | 'percentile';
  threshold: number;
  windowSize: number;
  enabled: boolean;
}
```

### AnomalyEvent

```typescript
interface AnomalyEvent {
  id: string;
  type: string;
  value: number;
  expected: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  metadata: Record<string, any>;
}
```

---

## RealtimeDataFlow 类

### 构造函数

```typescript
constructor(config?: Partial<RealtimeDataFlowConfig>)
```

### WebSocket 连接管理

#### addConnection(config)
添加 WebSocket 连接。

```typescript
addConnection(config: WSConnectionConfig): void
```

#### removeConnection(id)
移除 WebSocket 连接。

```typescript
removeConnection(id: string): void
```

#### getConnectionState(id)
获取连接状态。

```typescript
getConnectionState(id: string): WSConnectionState | null
```

#### getAllConnectionStates()
获取所有连接状态。

```typescript
getAllConnectionStates(): WSConnectionState[]
```

#### connect(id)
连接指定 WebSocket。

```typescript
connect(id: string): Promise<void>
```

#### disconnect(id)
断开指定 WebSocket。

```typescript
disconnect(id: string): void
```

### 数据聚合

#### subscribe(symbol, callback)
订阅数据。

```typescript
subscribe(symbol: string, callback: (data: any) => void): string
```

#### unsubscribe(subscriptionId)
取消订阅。

```typescript
unsubscribe(subscriptionId: string): void
```

#### setConflictResolution(strategy)
设置冲突解决策略。

```typescript
setConflictResolution(strategy: 'priority' | 'majority' | 'average'): void
```

### 数据质量监控

#### getDataQualityScore(symbol?)
获取数据质量评分。

```typescript
getDataQualityScore(symbol?: string): DataQualityScore
```

#### setQualityThresholds(thresholds)
设置质量阈值。

```typescript
setQualityThresholds(thresholds: Partial<DataQualityScore>): void
```

### 异常检测

#### configureAnomalyDetection(config)
配置异常检测。

```typescript
configureAnomalyDetection(config: AnomalyDetectionConfig): void
```

#### getAnomalyEvents(limit?)
获取异常事件。

```typescript
getAnomalyEvents(limit?: number): AnomalyEvent[]
```

#### clearAnomalyEvents()
清除异常事件。

```typescript
clearAnomalyEvents(): void
```

---

## 冲突解决策略

| 策略 | 说明 | 适用场景 |
|-----|------|---------|
| priority | 优先级高的源获胜 | 有明确数据源优先级 |
| majority | 多数投票 | 多个源数据一致性高 |
| average | 平均值 | 多个源数据都有价值 |

---

## 异常检测方法

| 方法 | 说明 | 适用场景 |
|-----|------|---------|
| z-score | 标准分数检测 | 正态分布数据 |
| IQR | 四分位距检测 | 偏态分布数据 |
| percentile | 百分位数检测 | 非参数分布 |

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `connection:state` | 连接状态变化 | `WSConnectionState` |
| `data:received` | 数据接收 | `{ symbol, data, source }` |
| `data:aggregated` | 数据聚合完成 | `{ symbol, aggregated }` |
| `quality:update` | 质量评分更新 | `DataQualityScore` |
| `anomaly:detected` | 异常检测 | `AnomalyEvent` |

---

**文档生成**: dao  
**时间**: 2026-06-07T07:28:00+08:00
