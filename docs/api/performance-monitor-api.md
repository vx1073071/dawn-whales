# PerformanceMonitor API 文档

**Phase**: 6.1 R43  
**文件**: `electron/engine/performance-monitor.ts` (874 行)  
**作者**: JVS  
**审查**: dao (94%)  

---

## 概述

PerformanceMonitor 实时性能监控引擎，支持 CPU/内存/网络/数据库/WebSocket 五大维度指标采集、多账户性能对比、可配置告警规则引擎、性能趋势分析。

---

## 类型定义

### PerformanceMetrics

```typescript
interface PerformanceMetrics {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  database: DatabaseMetrics;
  websocket: WebSocketMetrics;
}
```

### RealtimeMetrics

```typescript
interface RealtimeMetrics {
  timestamp: number;
  cpuUsage: number;        // 0-100 (%)
  memoryUsage: number;     // 0-1000 (MB)
  latencyMs: number;       // 0-500 (ms)
  qps: number;             // queries per second
}
```

### AccountMetrics

```typescript
interface AccountMetrics {
  accountId: string;
  cpuUsage: number;
  memoryUsage: number;
  latencyMs: number;
  qps: number;
  timestamp: number;
}
```

### AccountComparisonResult

```typescript
interface AccountComparisonResult {
  accounts: AccountMetrics[];
  averages: {
    cpuUsage: number;
    memoryUsage: number;
    latencyMs: number;
    qps: number;
  };
  best: {
    cpuUsage: string;      // accountId with lowest CPU
    memoryUsage: string;   // accountId with lowest memory
    latencyMs: string;     // accountId with lowest latency
    qps: string;           // accountId with highest QPS
  };
  worst: {
    cpuUsage: string;      // accountId with highest CPU
    memoryUsage: string;   // accountId with highest memory
    latencyMs: string;     // accountId with highest latency
    qps: string;           // accountId with lowest QPS
  };
  timestamp: number;
}
```

### AlertRule

```typescript
interface AlertRule {
  type: AlertType;
  metric: 'cpuUsage' | 'memoryUsage' | 'latencyMs' | 'qps';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
}

type AlertType = 'CPU_HIGH' | 'MEMORY_HIGH' | 'LATENCY_HIGH' | 'QPS_LOW';
type AlertSeverity = 'info' | 'warning' | 'critical';
```

### TrendResult

```typescript
interface TrendResult {
  metricName: string;
  direction: TrendDirection;  // increasing/decreasing/stable
  slope: number;
  dataPoints: number[];
  windowSize: number;
  average: number;
  min: number;
  max: number;
  timestamp: number;
}
```

---

## PerformanceMonitor 类

### 构造函数

```typescript
constructor(maxHistorySize?: number)
```

**参数**:
- `maxHistorySize`: 历史记录最大条数（默认 100）

### 核心方法

#### getMetrics()
获取当前性能指标。

```typescript
getMetrics(): PerformanceMetrics
```

#### getRealtimeMetrics()
获取实时性能指标快照。

```typescript
getRealtimeMetrics(): RealtimeMetrics
```

#### recordAccountMetrics(metrics)
记录账户性能指标。

```typescript
recordAccountMetrics(metrics: AccountMetrics): void
```

#### compareAccounts(accountIds)
比较多账户性能。

```typescript
compareAccounts(accountIds: string[]): AccountComparisonResult
```

### 告警管理

#### addAlertRule(rule)
添加告警规则。

```typescript
addAlertRule(rule: AlertRule): void
```

#### removeAlertRule(type)
移除告警规则。

```typescript
removeAlertRule(type: AlertType): void
```

#### getAlerts()
获取当前告警列表。

```typescript
getAlerts(): Alert[]
```

#### clearAlerts()
清除所有告警。

```typescript
clearAlerts(): void
```

### 趋势分析

#### analyzeTrend(metricName, windowSize?)
分析指标趋势。

```typescript
analyzeTrend(metricName: string, windowSize?: number): TrendResult
```

**参数**:
- `metricName`: 指标名称（cpuUsage/memoryUsage/latencyMs/qps）
- `windowSize`: 滑动窗口大小（默认 10）

### 历史管理

#### getHistory()
获取性能历史。

```typescript
getHistory(): RealtimeMetrics[]
```

#### clearHistory()
清除历史记录。

```typescript
clearHistory(): void
```

---

## 告警类型说明

| 类型 | 说明 | 默认阈值 |
|-----|------|---------|
| CPU_HIGH | CPU 使用率过高 | > 80% |
| MEMORY_HIGH | 内存使用过高 | > 800MB |
| LATENCY_HIGH | 延迟过高 | > 200ms |
| QPS_LOW | QPS 过低 | < 10 |

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `metrics:update` | 指标更新 | `PerformanceMetrics` |
| `alert:triggered` | 告警触发 | `Alert` |
| `alert:cleared` | 告警清除 | `Alert` |
| `trend:change` | 趋势变化 | `TrendResult` |

---

**文档生成**: dao  
**时间**: 2026-06-07T07:27:00+08:00
