# R131-Q01: 信号协议文档 — Signal Schema + JSON Schema

> **Author**: QClaw · **Task**: R131-Q01 · **Hours**: 2h
> **Version**: v2.0.0 | **Based on**: server/routes/signal.ts + server/db/database.ts

---

## 一、信号架构

```
信号源 (4Agent/External) → POST /api/signal → signals table
                                                │
                    ┌───────────────────────────┤
                    ▼                           ▼
           cloud signals                  opend signals
           (服务器执行)                   (桌面端OpenD拉取)
                    │                           │
                    ▼                           ▼
           Binance/OKX/etc            GET /api/signal/pending
           placeOrder()               → 桌面端本地下单
                    │                           │
                    ▼                           ▼
           copy_trades记录              POST /:id/execute
                                       回传结果
```

---

## 二、信号生命周期

```
pending → executing → executed  ✅ 成功
                    → failed     ⚠️ 失败 (可重试)
                             → executing → executed
                             → dead      ❌ 超过 max_retries

任何状态 → cancelled  (用户取消)
```

---

## 三、信号 Schema (数据库)

### signals 表

```sql
CREATE TABLE signals (
  id          TEXT PRIMARY KEY,          -- UUID
  provider_id TEXT NOT NULL,             -- 信号提供者 userId
  symbol      TEXT NOT NULL,             -- HK.00700 / US.AAPL / BTC/USDT
  direction   TEXT NOT NULL              -- BUY / SELL
    CHECK(direction IN ('BUY','SELL')),
  price       REAL,                      -- 建议价格 (null = 市价)
  confidence  REAL DEFAULT 0,            -- 置信度 0.0-1.0
  broker_type TEXT NOT NULL              -- cloud / opend
    CHECK(broker_type IN ('cloud','opend')),
  status      TEXT DEFAULT 'pending'     -- pending/executing/executed/failed/dead/cancelled
    CHECK(status IN ('pending','executing','executed','failed','dead','cancelled')),
  priority    TEXT DEFAULT 'P1'          -- P0/P1/P2
    CHECK(priority IN ('P0','P1','P2')),
  retry_count INTEGER DEFAULT 0,        -- 当前重试次数
  max_retries INTEGER DEFAULT 3,        -- 最大重试次数
  error_message TEXT,                   -- 失败原因
  created_at  TEXT DEFAULT (datetime('now')),
  executed_at TEXT                      -- 执行完成时间
);
```

### copy_trades 表 (执行记录)

```sql
CREATE TABLE copy_trades (
  id          TEXT PRIMARY KEY,
  signal_id   TEXT NOT NULL REFERENCES signals(id),
  user_id     TEXT NOT NULL,
  broker_id   TEXT NOT NULL,
  order_id    TEXT,
  symbol      TEXT NOT NULL,
  side        TEXT NOT NULL,
  quantity    REAL NOT NULL,
  price       REAL,
  fee         REAL,
  fee_currency TEXT DEFAULT 'USDT',
  status      TEXT DEFAULT 'pending',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

---

## 四、API 协议

### 4.1 提交信号

```
POST /api/signal
Authorization: Bearer <jwt>
Content-Type: application/json

Request:
{
  "symbol": "BTC/USDT",        // required
  "direction": "BUY",          // required: BUY | SELL
  "price": 60000.00,           // optional, omit for market
  "confidence": 0.85,          // optional, 0.0-1.0
  "brokerType": "cloud",       // optional, default "cloud"
  "stopLoss": false,           // optional
  "emergency": false           // optional
}

Response 201:
{
  "success": true,
  "signal": {
    "id": "uuid-here",
    "symbol": "BTC/USDT",
    "direction": "BUY",
    "brokerType": "cloud",
    "status": "pending",
    "priority": "P1"
  }
}
```

### 4.2 查询信号

```
GET /api/signal?brokerType=cloud&status=executed&limit=20
Authorization: Bearer <jwt>

Response 200:
{
  "success": true,
  "signals": [...],
  "total": 5
}
```

### 4.3 拉取待执行 (OpenD)

```
GET /api/signal/pending
Authorization: Bearer <jwt>

Response 200:
{
  "success": true,
  "signals": [...],   // broker_type='opend' AND status IN('pending','failed')
  "total": 3
}
```

### 4.4 上报执行结果

```
POST /api/signal/:id/execute
Authorization: Bearer <jwt>

Request:
{
  "success": true,
  "orderId": "broker-order-123",
  "errorMessage": null,
  "fee": 0.38,
  "feeCurrency": "HKD",
  "quantity": 100
}

Response 200:
{
  "success": true,
  "signalId": "uuid-here",
  "status": "executed"
}
```

---

## 五、优先级规则

| 条件 | 优先级 | 说明 |
|------|--------|------|
| SELL + stopLoss | P0 | 止损单, 最高优先级, 跳过冷却 |
| SELL + emergency | P0 | 紧急平仓 |
| 其他所有 | P1 | 正常跟单信号 |
| 暂未使用 | P2 | 预留: 系统自动调整仓位 |

---

## 六、信号状态机

```
                    ┌─────────┐
                    │ pending │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌───────┐ ┌──────────┐
        │ executing│ │cancelled│ │dead     │
        └────┬─────┘ └───────┘ └──────────┘
             │
        ┌────┴────┐
        ▼         ▼
   ┌────────┐ ┌──────┐
   │executed│ │failed│
   └────────┘ └──┬───┘
                 │
        ┌────────┴────────┐
        ▼ (retry<3)       ▼ (retry≥3)
   ┌──────────┐      ┌──────┐
   │ executing│      │ dead │
   └──────────┘      └──────┘
```

---

## 七、JSON Schema (标准格式)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://quant-moo.com/schemas/signal-v1.json",
  "title": "quant-moo Copy Trading Signal",
  "type": "object",
  "required": ["symbol", "direction", "providerId"],
  "properties": {
    "symbol": {
      "type": "string",
      "description": "Trading symbol (HK.00700 / US.AAPL / BTC/USDT)",
      "pattern": "^[A-Z]+(\\.[A-Z]+|[A-Z]{0,3}/[A-Z]{2,5})$"
    },
    "direction": {
      "type": "string",
      "enum": ["BUY", "SELL"]
    },
    "providerId": {
      "type": "string",
      "format": "uuid",
      "description": "Signal provider user ID"
    },
    "price": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Suggested price, omit for market order"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0,
      "description": "Signal confidence score"
    },
    "brokerType": {
      "type": "string",
      "enum": ["cloud", "opend"],
      "default": "cloud"
    },
    "priority": {
      "type": "string",
      "enum": ["P0", "P1", "P2"],
      "default": "P1"
    },
    "stopLoss": {
      "type": "boolean",
      "default": false
    },
    "emergency": {
      "type": "boolean",
      "default": false
    },
    "maxRetries": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10,
      "default": 3
    },
    "expiresInMs": {
      "type": "integer",
      "minimum": 0,
      "description": "Signal expiration in ms (0 = no expiry)"
    }
  }
}
```

### JSON Schema 验证示例

```typescript
import Ajv from 'ajv';
const ajv = new Ajv();
const validate = ajv.compile(signalSchema);

const signal = {
  symbol: "BTC/USDT",
  direction: "BUY",
  providerId: "user-uuid",
  confidence: 0.85,
  brokerType: "cloud"
};

if (!validate(signal)) {
  console.error(validate.errors);
  throw new Error('Invalid signal');
}
```

---

## 八、批量信号 (R131 新增)

```json
POST /api/signal/batch
Authorization: Bearer <jwt>

Request:
{
  "signals": [
    { "symbol": "BTC/USDT", "direction": "BUY", "confidence": 0.85 },
    { "symbol": "ETH/USDT", "direction": "SELL", "confidence": 0.72 }
  ]
}

Response 201:
{
  "success": true,
  "accepted": 2,
  "rejected": 0,
  "signals": [...]
}
```

---

## 九、信号冷却与去重

| 规则 | 参数 | 说明 |
|------|------|------|
| 同symbol冷却 | 30s | 30秒内同一标的只能发1条信号 |
| 同provider去重 | 60s | 同提供者同symbol同方向去重 |
| 风控单日上限 | 100/用户 | 超过上限降级为P2 |

---

> **Signed**: QClaw — R131-Q01, 信号协议文档 (JSON Schema + 状态机 + API, 300+ lines)
