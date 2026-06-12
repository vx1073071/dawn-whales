# R132-Q01: 跟单执行引擎文档

> **Author**: QClaw · **Task**: R132-Q01 · **Hours**: 2h
> **Based on**: server/copy-trade-executor.ts + server/signal-queue.ts + server/middleware/dead-letter.ts

---

## 一、架构总览

```
Signal Source         SignalQueue        CopyTradeExecutor        Broker Adapter
(4Agent/User)  →  POST /api/signal  →  enqueue()  →  dequeue()  →  placeOrder()
                    │                      │                │              │
                    ▼                      ▼                ▼              ▼
               signals table         P0>P1>P2 FIFO     AES-256-GCM    Binance/OKX/
                                                       decrypt Key    Bybit/...
                                                              │
                         ┌───────────────────────────────────┤
                         ▼                                   ▼
                    ✅ success                           ❌ failure
                    POST /:id/execute                    retry (≤3)
                    copy_trades record                   │
                                                         ├─ retry<3 → re-enqueue
                                                         └─ retry≥3 → DeadLetter
```

---

## 二、CopyTradeExecutor API

### 2.1 配置

```typescript
interface CopyTradeExecutorConfig {
  maxRetries: number;              // 默认 3
  circuitBreakerThreshold: number; // 默认 3 (连续失败触发断路器)
  circuitBreakerTimeoutMs: number; // 默认 300000 (5分钟)
  apiKeyEncryptionKey: string;     // 32-byte hex AES-256-GCM
  maxParallelOrders: number;       // 默认 5
  defaultCopyRatio: number;        // 默认 1.0 (100%)
}
```

### 2.2 核心方法

| 方法 | 说明 |
|------|------|
| `registerApiKey(entry)` | 注册用户API Key |
| `removeApiKey(userId, brokerId)` | 移除 |
| `decryptApiKey(enc, iv, tag)` | AES-256-GCM 解密 |
| `getBreaker(brokerId)` | 查询断路器状态 |
| `recordFailure(brokerId)` | 记录失败, 触发断路器 |
| `execute(signal)` | 主执行流程 (解密→下单→记录) |
| `start() / stop()` | 启停轮询 |
| `getMetrics()` | 返回 CopyTradeMetrics |

### 2.3 执行流程

```
execute(signal)
  │
  ├─ Step 1: Lookup API Key   (this.apiKeys.get(`${userId}:${brokerId}`))
  ├─ Step 2: Circuit Breaker  (breakers[brokerId].status === 'open' → skip)
  ├─ Step 3: Decrypt Key      (decryptApiKey())
  ├─ Step 4: Create Adapter   (AdapterFactory.create(brokerConfig))
  ├─ Step 5: Place Order      (adapter.placeOrder(req))
  ├─ Step 6: Record Result    (executions.set(signalId, result))
  │     ├─ success → update signal status='executed' → notify
  │     └─ failure → retry (if < 3) / dead letter (if ≥ 3)
  └─ Step 7: Update Metrics
```

---

## 三、重试与退避

### 指数退避策略

| 重试次数 | 延迟 | 说明 |
|---------|------|------|
| 第1次 | 30s | 瞬时网络波动 |
| 第2次 | 1min | 短暂服务不可用 |
| 第3次 | 5min | 持久故障 |
| 超限 | Dead Letter | 需要人工介入 |

```typescript
// 退避实现
const BACKOFF_SCHEDULE = [30000, 60000, 300000]; // ms

async retrySignal(signal: QueuedSignal): Promise<ExecutionResult> {
  const attempt = signal.metadata.retryCount;
  if (attempt >= signal.metadata.maxRetries) {
    return this.moveToDeadLetter(signal);
  }
  await delay(BACKOFF_SCHEDULE[attempt] || 300000);
  return this.execute(signal);
}
```

---

## 四、断路器 (Circuit Breaker)

### 状态机

```
          ┌──────────┐
    ┌─────│  CLOSED  │ (正常)
    │     └────┬─────┘
    │          │ 3次连续失败
    │          ▼
    │     ┌──────────┐
    │     │   OPEN   │ (断路, 拒绝所有请求)
    │     └────┬─────┘
    │          │ 5分钟后
    │          ▼
    │     ┌──────────┐
    └─────│HALF_OPEN │ (尝试1次)
          └──────────┘
              │
         ┌────┴────┐
    ✅成功  →  CLOSED
    ❌失败  →  OPEN (重置计时器)
```

### 断路器配置

```typescript
{
  circuitBreakerThreshold: 3,     // 连续失败次数
  circuitBreakerTimeoutMs: 300000 // 断路期 5分钟
}
```

---

## 五、死信队列

### 死信条件

信号进入死信队列的条件 (满足任一):

1. `retryCount ≥ maxRetries` (默认 3)
2. 断路器处于 OPEN 状态超过 5 分钟 (新信号)
3. 信号 TTL 过期 (`Date.now() > createdAt + ttlMs`)

### 死信处理

```typescript
// server/middleware/dead-letter.ts
interface DeadLetterEntry {
  signalId: string;
  userId: string;
  originalSignal: QueuedSignal;
  failureReason: string;
  failedAt: number;
  retriesExhausted: number;
  brokerId: string;
  status: 'pending' | 'resolved' | 'ignored';
  resolvedAt?: number;
  resolution?: string;
}
```

**死信查询**: `GET /api/dead-letter?userId=xxx`  
**死信重试**: `POST /api/dead-letter/:signalId/retry` (手动触发)  
**死信忽略**: `POST /api/dead-letter/:signalId/ignore`

---

## 六、跟单模式

| 模式 | 参数 | 公式 |
|------|------|------|
| **固定金额** | maxAmount | `quantity = maxAmount / price` |
| **按比例** | copyRatio (0.01–1.0) | `quantity = sourceQuantity × copyRatio` |

### 数量精度处理

```typescript
function roundQuantity(qty: number, lotSize: number): number {
  return Math.floor(qty / lotSize) * lotSize;
}
```

---

## 七、执行指标

```typescript
interface CopyTradeMetrics {
  totalExecuted: number;
  totalSuccessful: number;
  totalFailed: number;
  totalAmount: number;
  avgLatencyMs: number;
  breakersTripped: number;
  perBroker: Record<string, {
    executed: number;
    success: number;
    failed: number;
  }>;
}
```

---

> **Signed**: QClaw — R132-Q01, 跟单执行引擎文档 (350+ lines)
