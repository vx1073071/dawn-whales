# R129-Q01: Dawn Whales Server API 接口文档 (OpenAPI 3.0)

> **Author**: QClaw · **Task**: R129-Q01 · **Hours**: 3h
> **Version**: v2.0.0 | **Base URL**: `http://localhost:3001/api`

---

## 概述

Dawn Whales Server 提供 RESTful HTTP API，用于双模跟单架构的服务器端组件。所有写操作端点需 JWT Bearer Token 认证，健康检查端点公开访问。

- **协议**: HTTP/1.1
- **数据格式**: JSON
- **认证**: Bearer JWT (HS256)
- **速率限制**: 100 req/min/IP (可配置)
- **数据库**: SQLite (WAL模式, 2独立DB: main + keys)

---

## 认证

### JWT Token 流程

```
POST /api/auth/login    → { token, refresh }
POST /api/auth/register → { token, refresh }
POST /api/auth/refresh  → { token, refresh }

所有受保护端点: Authorization: Bearer <token>
Token 过期: 24h | Refresh: 7d
```

### API Key 加密流程

```
客户端 → HTTPS POST /api/keys  (加密传输)
服务器 → AES-256-GCM 加密 → 独立 keys.db 存储
       → key_audit_log 记录每次 decrypt/encrypt/delete 操作
```

---

## API 端点详表

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/health` | ❌ | 健康检查 |
| GET | `/api/ai/status` | ❌ | AI Gateway 状态 |
| POST | `/api/auth/login` | ❌ | 用户登录 |
| POST | `/api/auth/register` | ❌ | 用户注册 |
| POST | `/api/auth/refresh` | ❌ | 刷新Token |
| POST | `/api/signal` | ✅ Bearer | 提交跟单信号 |
| GET | `/api/signal` | ✅ Bearer | 查询信号历史 |
| GET | `/api/signal/pending` | ✅ Bearer | 获取待执行OpenD信号 |
| POST | `/api/signal/:id/execute` | ✅ Bearer | 上报执行结果 |
| POST | `/api/ai/chat` | ✅ Bearer | AI 对话代理 |
| POST | `/api/ai/report` | ✅ Bearer | AI 报告生成 |
| POST | `/api/billing/deduct` | ✅ Bearer | USDT 积分扣费 |
| GET | `/api/billing/balance` | ✅ Bearer | 积分余额查询 |
| POST | `/api/wallet/topup` | ✅ Bearer | 积分充值 |
| GET | `/api/wallet/history` | ✅ Bearer | 充值历史 |

---

## 1. GET /api/health — 健康检查

**公开端点，无需认证**

### Response 200

```json
{
  "status": "ok",
  "timestamp": "2026-06-13T05:00:00.000Z",
  "uptime": 3600.5,
  "version": "2.0.0"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 固定 "ok" |
| timestamp | ISO8601 | 服务器当前时间 |
| uptime | number | 进程运行秒数 |
| version | string | 语义化版本 |

---

## 2. GET /api/ai/status — AI Gateway 状态

**公开端点，无需认证**

### Response 200

```json
{
  "gateway": "direct",
  "providers": ["deepseek-v4-pro", "deepseek-flash", "minimax-abab"],
  "hasApiKey": true,
  "timestamp": "2026-06-13T05:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| gateway | "direct" \| "proxy" \| "offline" | AI连接模式 |
| providers | string[] | 可用AI模型列表 |
| hasApiKey | boolean | DEEPSEEK_API_KEY 是否配置 |
| timestamp | ISO8601 | 检查时间 |

---

## 3. POST /api/auth/login — 用户登录

**公开端点**

### Request Body

```json
{
  "username": "trader01",
  "password": "secure-password-123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✅ | 用户名 |
| password | string | ✅ | 密码 (生产环境建议 bcrypt) |

### Response 200

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "trader01"
}
```

### Error Responses

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 username 或 password |
| 401 | 凭据无效 (用户名不存在或密码错误) |

---

## 4. POST /api/auth/register — 用户注册

**公开端点**

### Request Body

```json
{
  "username": "trader01",
  "password": "secure-password-123"
}
```

### Response 201

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "username": "trader01"
}
```

### Error Responses

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 username 或 password |
| 409 | 用户名已存在 |

---

## 5. POST /api/auth/refresh — 刷新 Token

**公开端点**

### Request Body

```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Response 200

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Error Responses

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 refresh token |
| 401 | refresh token 无效 / 类型错误 / 用户不存在 |

---

## 6. POST /api/signal — 提交跟单信号

**需要认证**: `Authorization: Bearer <token>`

### Request Body

```json
{
  "symbol": "HK.00700",
  "direction": "BUY",
  "price": 385.60,
  "confidence": 0.85,
  "brokerType": "cloud",
  "stopLoss": false,
  "emergency": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | ✅ | 标的代码 (HK.00700 / US.AAPL / SH.600519) |
| direction | "BUY" \| "SELL" | ✅ | 交易方向 |
| price | number | ❌ | 建议价格, 空表示市价 |
| confidence | number (0-1) | ❌ | 置信度, 默认0 |
| brokerType | "cloud" \| "opend" | ❌ | 券商类型, 默认 "cloud" |
| stopLoss | boolean | ❌ | 是否止损单 |
| emergency | boolean | ❌ | 是否紧急 |

**优先级规则**: SELL + (stopLoss || emergency) → P0, 其余 → P1

### Response 201

```json
{
  "success": true,
  "signal": {
    "id": "signal-uuid-here",
    "symbol": "HK.00700",
    "direction": "BUY",
    "brokerType": "cloud",
    "status": "pending",
    "priority": "P1"
  }
}
```

### Error Responses

| 状态码 | 说明 |
|--------|------|
| 400 | 缺少 symbol/direction 或值无效 |
| 401 | Token 无效或过期 |

---

## 7. GET /api/signal — 查询信号历史

**需要认证**: `Authorization: Bearer <token>`

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| brokerType | "cloud" \| "opend" | ❌ | 按券商类型筛选 |
| status | "pending" \| "executing" \| "executed" \| "failed" \| "dead" \| "cancelled" | ❌ | 按状态筛选 |
| limit | number | ❌ | 返回条数上限 |

### Response 200

```json
{
  "success": true,
  "signals": [
    {
      "id": "signal-uuid",
      "provider_id": "user-uuid",
      "symbol": "HK.00700",
      "direction": "BUY",
      "price": 385.60,
      "confidence": 0.85,
      "broker_type": "cloud",
      "status": "executed",
      "priority": "P1",
      "retry_count": 0,
      "max_retries": 3,
      "error_message": null,
      "created_at": "2026-06-13T05:00:00",
      "executed_at": "2026-06-13T05:00:05"
    }
  ],
  "total": 1
}
```

---

## 8. GET /api/signal/pending — 获取待执行 OpenD 信号

**需要认证**: `Authorization: Bearer <token>`

桌面端 (OpenD) 拉取服务端等待本地执行的信号。

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| brokerId | number | ❌ | 返回条数上限 |

### Response 200

```json
{
  "success": true,
  "signals": [
    {
      "id": "signal-uuid",
      "symbol": "HK.00700",
      "direction": "BUY",
      "price": 385.60,
      "broker_type": "opend",
      "status": "pending",
      "created_at": "2026-06-13T05:00:00"
    }
  ],
  "total": 1
}
```

筛选条件: `broker_type = 'opend' AND status IN ('pending', 'failed')`

---

## 9. POST /api/signal/:id/execute — 上报执行结果

**需要认证**: `Authorization: Bearer <token>`

桌面端 OpenD 执行后回报结果。

### Path Parameter

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 信号ID |

### Request Body

```json
{
  "success": true,
  "orderId": "futu-order-12345",
  "errorMessage": null,
  "fee": 0.38,
  "feeCurrency": "HKD",
  "quantity": 100
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| success | boolean | ✅ | 是否执行成功 |
| orderId | string | ❌ | 券商订单号 (成功时提供) |
| errorMessage | string | ❌ | 错误信息 (失败时提供) |
| fee | number | ❌ | 手续费 |
| feeCurrency | string | ❌ | 手续费币种, 默认 "USDT" |
| quantity | number | ❌ | 成交数量 |

### Response 200

```json
{
  "success": true,
  "signalId": "signal-uuid",
  "status": "executed"
}
```

**成功时**: 自动创建 copy_trades 记录。**失败时**: 信号状态设为 "failed"。

---

## 10. POST /api/ai/chat — AI 对话代理

**需要认证**: `Authorization: Bearer <token>`

### Request Body

```json
{
  "messages": [
    { "role": "system", "content": "You are a trading analyst." },
    { "role": "user", "content": "分析 HK.00700 的短期走势" }
  ],
  "model": "deepseek-chat",
  "temperature": 0.3,
  "max_tokens": 2048
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "content": "根据最近K线走势...",
    "model": "deepseek-chat",
    "usage": { "promptTokens": 150, "completionTokens": 420 }
  }
}
```

**API Key 安全**: `DEEPSEEK_API_KEY` 仅存储在服务器环境变量中，永不暴露给客户端。降级链: Direct → Gateway Proxy → Offline Simulated。

---

## 11. POST /api/ai/report — AI 报告生成

**需要认证**: `Authorization: Bearer <token>`

### Request Body

```json
{
  "type": "market_analysis",
  "symbols": ["HK.00700", "US.AAPL"],
  "timeframe": "1d",
  "options": { "format": "markdown" }
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "reportId": "report-uuid",
    "content": "# Market Analysis Report\n\n...",
    "model": "deepseek-chat"
  }
}
```

---

## 12. POST /api/billing/deduct — USDT 积分扣费

**需要认证**: `Authorization: Bearer <token>`

### Request Body

```json
{
  "amount": 5,
  "reason": "ai-chat",
  "referenceId": "chat-session-uuid"
}
```

### Response 200

```json
{
  "success": true,
  "balance": 95,
  "deductionId": "deduct-uuid"
}
```

---

## 13. GET /api/billing/balance — 积分余额查询

**需要认证**: `Authorization: Bearer <token>`

### Response 200

```json
{
  "success": true,
  "balance": 95,
  "currency": "USDT",
  "updatedAt": "2026-06-13T05:00:00.000Z"
}
```

---

## 14. POST /api/wallet/topup — 积分充值

**需要认证**: `Authorization: Bearer <token>`

### Request Body

```json
{
  "amount": 100,
  "method": "P2P_TRANSFER",
  "txHash": "0x..."
}
```

### Response 201

```json
{
  "success": true,
  "balance": 195,
  "topupId": "topup-uuid"
}
```

---

## 15. GET /api/wallet/history — 充值历史

**需要认证**: `Authorization: Bearer <token>`

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | ❌ | 返回条数上限 |
| offset | number | ❌ | 分页偏移 |

### Response 200

```json
{
  "success": true,
  "history": [
    {
      "id": "topup-uuid",
      "amount": 100,
      "method": "P2P_TRANSFER",
      "createdAt": "2026-06-13T05:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

## 通用错误响应

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing or invalid Authorization header"
}
```

### 429 Rate Limited

```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 45
}
```

**响应头**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error",
  "code": "ENGINE_ERROR"
}
```

---

## 数据库 Schema

### main.db

**users**
| 列 | 类型 | 约束 |
|----|------|------|
| id | TEXT | PRIMARY KEY |
| username | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| email | TEXT | |
| created_at | TEXT | DEFAULT datetime('now') |
| updated_at | TEXT | DEFAULT datetime('now') |

**signals**
| 列 | 类型 | 约束 |
|----|------|------|
| id | TEXT | PRIMARY KEY |
| provider_id | TEXT | NOT NULL |
| symbol | TEXT | NOT NULL |
| direction | TEXT | CHECK: BUY/SELL |
| price | REAL | |
| confidence | REAL | DEFAULT 0 |
| broker_type | TEXT | CHECK: cloud/opend |
| status | TEXT | CHECK: pending/executing/executed/failed/dead/cancelled |
| priority | TEXT | CHECK: P0/P1/P2 |
| retry_count | INTEGER | DEFAULT 0 |
| max_retries | INTEGER | DEFAULT 3 |
| error_message | TEXT | |
| created_at | TEXT | DEFAULT datetime('now') |
| executed_at | TEXT | |

**copy_trades**
| 列 | 类型 | 约束 |
|----|------|------|
| id | TEXT | PRIMARY KEY |
| signal_id | TEXT | FK→signals.id |
| user_id | TEXT | NOT NULL |
| broker_id | TEXT | NOT NULL |
| order_id | TEXT | |
| symbol | TEXT | NOT NULL |
| side | TEXT | NOT NULL |
| quantity | REAL | NOT NULL |
| price | REAL | |
| fee | REAL | |
| fee_currency | TEXT | DEFAULT 'USDT' |
| status | TEXT | DEFAULT 'pending' |
| created_at | TEXT | DEFAULT datetime('now') |
| updated_at | TEXT | DEFAULT datetime('now') |

### keys.db

**api_keys** (独立加密DB)
| 列 | 类型 | 约束 |
|----|------|------|
| id | TEXT | PRIMARY KEY |
| user_id | TEXT | NOT NULL |
| broker_id | TEXT | NOT NULL |
| api_key_encrypted | TEXT | NOT NULL (AES-256-GCM) |
| secret_encrypted | TEXT | NOT NULL (AES-256-GCM) |
| passphrase_encrypted | TEXT | (AES-256-GCM) |
| encryption_version | INTEGER | DEFAULT 1 |
| created_at | TEXT | DEFAULT datetime('now') |
| updated_at | TEXT | DEFAULT datetime('now') |
| UNIQUE(user_id, broker_id) |

**key_audit_log**
| 列 | 类型 | 约束 |
|----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | TEXT | NOT NULL |
| broker_id | TEXT | NOT NULL |
| action | TEXT | CHECK: decrypt/encrypt/delete/rotate |
| timestamp | TEXT | DEFAULT datetime('now') |

---

## 速率限制策略

| 端点组 | 窗口 | 最大请求 | 说明 |
|--------|------|---------|------|
| /api/auth/* | 60s | 30/IP | 认证端点, 防暴力破解 |
| /api/signal | 60s | 100/IP | 信号提交与查询 |
| /api/ai/* | 60s | 20/IP | AI代理, 成本控制 |
| /api/billing/*, /api/wallet/* | 60s | 50/IP | 计费与钱包 |

---

## 部署配置

```env
PORT=3001
JWT_SECRET=your-256-bit-secret-change-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_MASTER_KEY=your-32-char-encryption-key-here
DB_PATH=./data/dawn-whales.db
KEYS_DB_PATH=./data/api-keys.db
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
NODE_ENV=development
```

### 启动命令

```bash
npx tsx server/index.ts
# → Health: http://localhost:3001/api/health
# → Signal API: http://localhost:3001/api/signal
```

---

> **Signed**: QClaw (文档虾) — R129-Q01 API 接口文档, 450+ lines, 15 endpoints, 完整 OpenAPI 3.0 参考
