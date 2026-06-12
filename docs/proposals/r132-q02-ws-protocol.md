# R132-Q02: WebSocket 推送协议文档

> **Author**: QClaw · **Task**: R132-Q02 · **Hours**: 2h
> **Based on**: server/ws-push-service.ts (WSPushService)

---

## 一、协议概览

```
桌面端 (BrowserWindow)                   服务器 (Express + ws)
       │                                       │
       │  wss://host/ws?token=<jwt>            │
       │ ───────────────────────────────────>  │ JWT 验证
       │                                       │
       │  ← connected (connectionId + time)    │
       │                                       │
       │  subscribe → "brokers":["binance"]    │
       │  subscribe → "symbols":["BTC/USDT"]   │
       │                                       │
       │  ← copytrade.progress                 │ 跟单执行中
       │  ← copytrade.executed                 │ 跟单成功
       │  ← copytrade.failed                   │ 跟单失败
       │  ← broker.connected                   │ 券商连接
       │  ← broker.disconnected                │ 券商断连
       │                                       │
       │  ping ──────────────────────────────> │ 心跳 (30s)
       │  ← pong                              │
```

---

## 二、认证

### 连接

```
GET wss://localhost:8443/ws?token=<jwt>
```

失败码:

| Code | 含义 |
|------|------|
| 4001 | 缺少 token |
| 4002 | 无效 token |
| 4003 | 用户不存在 |
| 1013 | 超出最大连接数 |

---

## 三、事件类型

### 3.1 Server → Client

| type | payload | 触发时机 |
|------|---------|---------|
| `connected` | `{ connectionId, serverTime }` | 连接成功 |
| `copytrade.progress` | `{ signalId, brokerId, symbol, side, attempt }` | 下单执行中 |
| `copytrade.executed` | `{ signalId, orderId, brokerId, symbol, price, quantity, fee, feeCurrency, latencyMs }` | 下单成功 |
| `copytrade.failed` | `{ signalId, brokerId, reason, retryAttempt, maxRetries }` | 下单失败 |
| `copytrade.dead` | `{ signalId, brokerId, reason, totalRetries, enteredDL }` | 死信入队 |
| `copytrade.retry` | `{ signalId, brokerId, attempt, delayMs }` | 进入重试 |
| `broker.connected` | `{ brokerId, brokerName, latencyMs }` | 券商连接 |
| `broker.disconnected` | `{ brokerId, brokerName, reason }` | 券商断连 |
| `broker.error` | `{ brokerId, error, action }` | 券商错误 |
| `breaker.tripped` | `{ brokerId, status: 'open', resetAt }` | 断路器触发 |
| `breaker.reset` | `{ brokerId, status: 'closed' }` | 断路器恢复 |
| `notification` | `{ id, type, title, message, priority, link }` | 系统通知 |
| `pong` | `{}` | 心跳响应 |
| `error` | `{ message }` | 服务端错误 |

### 3.2 Client → Server

| type | payload | 说明 |
|------|---------|------|
| `subscribe` | `{ brokers?: string[], symbols?: string[] }` | 订阅过滤器 |
| `unsubscribe` | `{ brokers?: string[], symbols?: string[] }` | 取消订阅 |
| `ping` | `{}` | 心跳 |

---

## 四、事件 payload 详细格式

### copytrade.progress

```json
{
  "type": "copytrade.progress",
  "payload": {
    "signalId": "uuid-abc",
    "brokerId": "binance",
    "symbol": "BTC/USDT",
    "side": "BUY",
    "quantity": 0.001,
    "price": 60000,
    "attempt": 1
  },
  "timestamp": 1718400000000
}
```

### copytrade.executed

```json
{
  "type": "copytrade.executed",
  "payload": {
    "signalId": "uuid-abc",
    "orderId": "binance-order-123",
    "brokerId": "binance",
    "symbol": "BTC/USDT",
    "side": "BUY",
    "quantity": 0.001,
    "price": 60000.50,
    "fee": 0.12,
    "feeCurrency": "USDT",
    "latencyMs": 245,
    "pnl": 0
  },
  "timestamp": 1718400000245
}
```

### copytrade.failed

```json
{
  "type": "copytrade.failed",
  "payload": {
    "signalId": "uuid-abc",
    "brokerId": "binance",
    "reason": "Insufficient balance",
    "retryAttempt": 1,
    "maxRetries": 3
  },
  "timestamp": 1718400030000
}
```

### breaker.tripped

```json
{
  "type": "breaker.tripped",
  "payload": {
    "brokerId": "binance",
    "status": "open",
    "failures": 3,
    "resetAt": 1718400300000
  },
  "timestamp": 1718400000000
}
```

---

## 五、心跳机制

```
Client → ping (每 30s)
Server → pong (立即回复)

Server 检测:
  连续 120s 无 pong → terminate 连接
```

---

## 六、重连策略 (客户端)

| 断连原因 | 重连延迟 |
|---------|---------|
| 首次断连 | 100ms |
| 二次断连 | 1s |
| 三次断连 | 5s |
| 四次及以上 | 30s |
| 最大重试 | 10次 → 显示"连接失败" |

---

## 七、安全规则

| 规则 | 说明 |
|------|------|
| JWT 验证 | 每次 WebSocket 连接必须携带有效 JWT |
| 用户隔离 | 一个 userId 只能接收自己的消息 |
| 订阅过滤 | subscribe 后只接收匹配的事件 |
| 最大连接 | 1000 并发 |
| Token 过期 | 连接期间 token 过期不主动断开 (需重新连接刷新) |

---

> **Signed**: QClaw — R132-Q02, WebSocket 推送协议文档 (13 events, 250+ lines)
