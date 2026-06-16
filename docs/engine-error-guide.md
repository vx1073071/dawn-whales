<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# EngineError 使用指南 — quant-moo 开发者迁移文档

> 最后更新: R89 (2026-06-11) | 版本: v1.0 | 作者: youdao (文档虾)

## 目录

1. [概述](#概述)
2. [为什么要用 EngineError](#为什么要用-engineerror)
3. [快速开始](#快速开始)
4. [ErrorDomain — 错误域](#errordomain--错误域)
5. [ErrorCode — 错误码](#errorcode--错误码)
6. [构造方式](#构造方式)
7. [静态工厂方法](#静态工厂方法)
8. [错误处理最佳实践](#错误处理最佳实践)
9. [迁移步骤](#迁移步骤)
10. [常见模式](#常见模式)
11. [HTTP 状态码映射](#http-状态码映射)
12. [序列化与日志](#序列化与日志)
13. [Legacy 兼容](#legacy-兼容)
14. [FAQ](#faq)

---

## 概述

`EngineError` 是 quant-moo 项目的统一错误类型，定义在 `electron/engine/core/engine-error.ts`。
它为所有引擎错误提供结构化的域 (Domain)、码 (Code)、上下文 (Context) 和时间戳 (Timestamp)，
替代了之前散落在各处的 `throw new Error('...')` 模式。

**核心优势**:
- 结构化错误信息（机器可解析）
- 域分类（监控、告警、仪表盘可按域筛选）
- 上下文传递（错误发生时保留关键参数）
- 自动 HTTP 状态码映射
- Legacy 兼容（平滑迁移）

---

## 为什么要用 EngineError

**之前的方式** (`throw new Error`):
\`\`\`typescript
// 不好: 没有结构化信息，难以监控和分类
throw new Error('Order rejected: insufficient balance');
\`\`\`

问题:
- 错误类型都是 `Error`，无法区分是交易错误还是数据错误
- 消息是纯文本，无法机器解析
- 没有上下文信息（哪个订单？什么余额？）
- 监控系统只能做字符串匹配

**EngineError 方式**:
\`\`\`typescript
// 好: 结构化、可监控、有上下文
throw new EngineError(
  ErrorDomain.TRADE,
  ErrorCode.INSUFFICIENT_BALANCE,
  'Order rejected: insufficient balance',
  { context: { orderId: '12345', required: 10000, available: 5000 } }
);
\`\`\`

优势:
- 域: TRADE（监控系统可按域告警）
- 码: INSUFFICIENT_BALANCE（精确定位问题类型）
- 上下文: orderId、金额等（排障时有完整信息）
- 自动 HTTP 402（API 层无需手动映射）

---

## 快速开始

### 1. 导入

\`\`\`typescript
import { EngineError, ErrorDomain, ErrorCode } from '../../electron/engine/core/engine-error';
\`\`\`

### 2. 抛出错误

\`\`\`typescript
// 标准方式 (推荐)
throw new EngineError(ErrorDomain.DATA, ErrorCode.DATA_UNAVAILABLE, 'Stock data not found', {
  context: { symbol: 'AAPL', market: 'US' }
});

// 静态工厂方式 (简洁)
throw EngineError.data(ErrorCode.DATA_UNAVAILABLE, 'Stock data not found', {
  symbol: 'AAPL', market: 'US'
});

// Legacy 方式 (兼容旧代码, @deprecated since R89)
throw new EngineError('Something went wrong');  // 自动映射到 SYSTEM/INTERNAL_ERROR
\`\`\`

### 3. 捕获错误

\`\`\`typescript
try {
  await placeOrder(order);
} catch (error) {
  if (error instanceof EngineError) {
    console.error(`[${error.domain}:${error.code}] ${error.message}`);
    console.error('Context:', error.context);
    console.error('HTTP Status:', error.statusCode);
  } else {
    console.error('Unexpected error:', error);
  }
}
\`\`\`

---

## ErrorDomain — 错误域

7 个域覆盖所有业务场景：

| 域 | 用途 | 典型场景 |
|---|------|---------|
| `TRADE` | 交易操作 | 下单失败、撤单超时、余额不足、仓位限制 |
| `DATA` | 数据操作 | 行情不可用、数据过期、数据损坏 |
| `AI` | AI 引擎 | 模型超时、解析错误、限流 |
| `AUTH` | 认证授权 | 未授权、Token 过期、License 无效 |
| `NETWORK` | 网络通信 | 连接失败、WebSocket 关闭 |
| `VALIDATION` | 参数校验 | 参数无效、字段缺失 |
| `SYSTEM` | 系统内部 | 内部错误、系统关停 |

**选择规则**:
- 用户操作导致的错误 -> 按操作类型选域 (TRADE/DATA)
- 基础设施问题 -> NETWORK/SYSTEM
- 输入问题 -> VALIDATION
- 第三方服务 -> AI/DATA (取决于服务类型)

---

## ErrorCode — 错误码

19 个标准码，按域分组：

### TRADE 域
| 码 | 用途 |
|---|------|
| `ORDER_REJECTED` | 订单被拒绝（交易所/风控） |
| `ORDER_TIMEOUT` | 订单超时未成交 |
| `INSUFFICIENT_BALANCE` | 余额不足 |
| `POSITION_LIMIT` | 超过仓位限制 |

### DATA 域
| 码 | 用途 |
|---|------|
| `DATA_UNAVAILABLE` | 数据不可用（未订阅/服务停止） |
| `DATA_STALE` | 数据过期（超过刷新阈值） |
| `DATA_CORRUPT` | 数据损坏（格式异常/校验失败） |

### AI 域
| 码 | 用途 |
|---|------|
| `AI_TIMEOUT` | AI 模型响应超时 |
| `AI_PARSE_ERROR` | AI 输出解析失败 |
| `AI_RATE_LIMIT` | AI 调用限流 |

### AUTH 域
| 码 | 用途 |
|---|------|
| `UNAUTHORIZED` | 未授权访问 |
| `TOKEN_EXPIRED` | Token 过期 |
| `LICENSE_INVALID` | License 无效 |

### NETWORK 域
| 码 | 用途 |
|---|------|
| `CONNECTION_FAILED` | 连接失败 |
| `WEBSOCKET_CLOSED` | WebSocket 意外关闭 |

### VALIDATION 域
| 码 | 用途 |
|---|------|
| `INVALID_PARAM` | 参数值无效 |
| `MISSING_FIELD` | 必填字段缺失 |

### SYSTEM 域
| 码 | 用途 |
|---|------|
| `INTERNAL_ERROR` | 内部错误（兜底） |
| `SHUTDOWN` | 系统正在关停 |

---

## 构造方式

### 标准 3-arg 构造 (推荐)

\`\`\`typescript
new EngineError(
  domain: ErrorDomain,
  code: ErrorCode,
  message: string,
  options?: {
    context?: Record<string, unknown>;  // 错误上下文
    cause?: Error;                        // 原始错误 (error chain)
  }
)
\`\`\`

示例:
\`\`\`typescript
throw new EngineError(
  ErrorDomain.TRADE,
  ErrorCode.ORDER_REJECTED,
  'Limit order rejected by exchange',
  {
    context: { symbol: 'AAPL', side: 'BUY', quantity: 100, price: 185.50 },
    cause: originalError
  }
);
\`\`\`

### Legacy 2-arg 构造 (@deprecated, 仅兼容旧代码)

\`\`\`typescript
new EngineError(
  message: string,
  options?: {
    code?: string;                          // 字符串错误码 (自动映射)
    statusCode?: number;                    // HTTP 状态码
    context?: Record<string, unknown>;
    cause?: Error;
  }
)
\`\`\`

**注意**: Legacy 方式自动映射到 `ErrorDomain.SYSTEM` / `ErrorCode.INTERNAL_ERROR`。
建议迁移到标准方式。

---

## 静态工厂方法

简洁的工厂方法，减少样板代码：

\`\`\`typescript
// 等价于 new EngineError(ErrorDomain.DATA, code, msg, { context })
EngineError.data(ErrorCode.DATA_UNAVAILABLE, 'Stock not found', { symbol: 'XYZ' });

// 等价于 new EngineError(ErrorDomain.TRADE, code, msg, { context })
EngineError.trade(ErrorCode.ORDER_REJECTED, 'Order failed', { orderId: '123' });

// 等价于 new EngineError(ErrorDomain.AI, code, msg, { context })
EngineError.ai(ErrorCode.AI_TIMEOUT, 'Model took too long', { model: 'gpt-4' });

// 等价于 new EngineError(ErrorDomain.AUTH, code, msg, { context })
EngineError.auth(ErrorCode.UNAUTHORIZED, 'Invalid token');

// 等价于 new EngineError(ErrorDomain.SYSTEM, code, msg, { context })
EngineError.system(ErrorCode.INTERNAL_ERROR, 'Unexpected crash');

// 等价于 new EngineError(ErrorDomain.VALIDATION, code, msg, { context })
EngineError.validation(ErrorCode.MISSING_FIELD, 'symbol is required');
\`\`\`

---

## 错误处理最佳实践

### 1. 使用 error chain (cause)

\`\`\`typescript
try {
  const data = await fetchMarketData(symbol);
} catch (err) {
  // 保留原始错误作为 cause
  throw new EngineError(
    ErrorDomain.DATA,
    ErrorCode.DATA_UNAVAILABLE,
    `Failed to fetch market data for ${symbol}`,
    { context: { symbol }, cause: err instanceof Error ? err : new Error(String(err)) }
  );
}
\`\`\`

### 2. 提供丰富的 context

\`\`\`typescript
// 不好: 没有上下文
throw new EngineError(ErrorDomain.TRADE, ErrorCode.ORDER_REJECTED, 'Order rejected');

// 好: 有完整上下文
throw new EngineError(ErrorDomain.TRADE, ErrorCode.ORDER_REJECTED, 'Order rejected', {
  context: {
    orderId: order.id,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    price: order.price,
    rejectionReason: 'PRICE_TOO_FAR_FROM_MARKET'
  }
});
\`\`\`

### 3. 按域分层处理

\`\`\`typescript
function handleEngineError(error: EngineError): void {
  switch (error.domain) {
    case ErrorDomain.TRADE:
      notifyUser(error.message);
      tradeLog.error(error.toJSON());
      break;
    case ErrorDomain.DATA:
      tryFallbackDataSource();
      monitor.alert(error);
      break;
    case ErrorDomain.AI:
      fallbackToRuleEngine();
      trackAICost(error.context);
      break;
    case ErrorDomain.AUTH:
      clearSession();
      redirectToLogin();
      break;
    default:
      systemLog.error(error.toJSON());
      alertOps(error);
  }
}
\`\`\`

### 4. IPC 层序列化

\`\`\`typescript
// Electron main process
try {
  const result = await engine.analyze(params);
  return { success: true, data: result };
} catch (error) {
  if (error instanceof EngineError) {
    return { success: false, error: error.toJSON() };
  }
  return { success: false, error: { name: 'Error', message: String(error) } };
}
\`\`\`

### 5. 不要吞掉错误

\`\`\`typescript
// 不好: 吞掉错误
catch (e) {
  // 什么都不做
}

// 不好: 只打印不处理
catch (e) {
  console.error(e);
}

// 好: 转换为 EngineError 并传播
catch (e) {
  throw new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'Operation failed', {
    cause: e instanceof Error ? e : undefined,
    context: { operation: 'analyze', params }
  });
}
\`\`\`

---

## 迁移步骤

将 `throw new Error` 迁移到 `EngineError` 的标准流程：

### Step 1: 添加 import

\`\`\`typescript
import { EngineError, ErrorDomain, ErrorCode } from '../../electron/engine/core/engine-error';
\`\`\`

### Step 2: 识别错误域和码

查看错误消息，确定：
- 这是什么类型的错误？ -> 选 ErrorDomain
- 具体的错误原因？ -> 选 ErrorCode

### Step 3: 替换 throw

\`\`\`typescript
// 之前
throw new Error('Cannot connect to market data feed');

// 之后
throw new EngineError(
  ErrorDomain.NETWORK,
  ErrorCode.CONNECTION_FAILED,
  'Cannot connect to market data feed',
  { context: { provider: 'futu', endpoint: '127.0.0.1:11111' } }
);
\`\`\`

### Step 4: 验证

- `npx tsc --noEmit` — 类型检查通过
- 运行相关测试 — 确保行为不变

---

## 常见模式

### 模式 1: 数据获取失败

\`\`\`typescript
async function getStockData(symbol: string): Promise<StockData> {
  const data = await dataSource.fetch(symbol);
  if (!data) {
    throw EngineError.data(ErrorCode.DATA_UNAVAILABLE, `No data for ${symbol}`, { symbol });
  }
  if (Date.now() - data.timestamp > STALE_THRESHOLD) {
    throw EngineError.data(ErrorCode.DATA_STALE, `Stale data for ${symbol}`, {
      symbol, age: Date.now() - data.timestamp
    });
  }
  return data;
}
\`\`\`

### 模式 2: 参数校验

\`\`\`typescript
function validateOrder(order: NewOrder): void {
  if (!order.symbol) {
    throw EngineError.validation(ErrorCode.MISSING_FIELD, 'symbol is required');
  }
  if (order.quantity <= 0) {
    throw EngineError.validation(ErrorCode.INVALID_PARAM, 'quantity must be positive', {
      value: order.quantity
    });
  }
}
\`\`\`

### 模式 3: 外部 API 调用

\`\`\`typescript
async function callAI(prompt: string): Promise<string> {
  const start = Date.now();
  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      if (response.status === 429) {
        throw EngineError.ai(ErrorCode.AI_RATE_LIMIT, 'AI rate limited');
      }
      throw EngineError.ai(ErrorCode.AI_PARSE_ERROR, `AI API error: ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    if (err instanceof EngineError) throw err;
    if (Date.now() - start > AI_TIMEOUT) {
      throw EngineError.ai(ErrorCode.AI_TIMEOUT, 'AI request timed out', {
        duration: Date.now() - start
      });
    }
    throw EngineError.ai(ErrorCode.AI_PARSE_ERROR, 'AI request failed', {
      cause: err instanceof Error ? err : undefined
    });
  }
}
\`\`\`

### 模式 4: 交易操作

\`\`\`typescript
async function placeOrder(order: NewOrder): Promise<OrderResult> {
  const balance = await getAvailableBalance();
  if (balance < order.price * order.quantity) {
    throw EngineError.trade(ErrorCode.INSUFFICIENT_BALANCE, 'Not enough funds', {
      required: order.price * order.quantity, available: balance
    });
  }
  try {
    const result = await broker.submitOrder(order);
    if (result.status === 'REJECTED') {
      throw EngineError.trade(ErrorCode.ORDER_REJECTED, 'Exchange rejected order', {
        orderId: result.id, reason: result.rejectReason
      });
    }
    return result;
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw EngineError.trade(ErrorCode.ORDER_TIMEOUT, 'Order submission failed', {
      cause: err instanceof Error ? err : undefined,
      context: { symbol: order.symbol, side: order.side }
    });
  }
}
\`\`\`

---

## HTTP 状态码映射

EngineError 自动根据域映射 HTTP 状态码：

| ErrorDomain | HTTP Status | 说明 |
|---|---|---|
| AUTH | 401 Unauthorized | 认证失败 |
| VALIDATION | 400 Bad Request | 参数校验失败 |
| DATA | 404 Not Found | 数据不可用 |
| TRADE | 402 Payment Required | 交易类错误 |
| AI | 502 Bad Gateway | AI 服务错误 |
| NETWORK | 503 Service Unavailable | 网络不可用 |
| SYSTEM | 500 Internal Server Error | 系统内部错误 |

---

## 序列化与日志

`toJSON()` 输出结构化 JSON，适合日志和 IPC 传输：

\`\`\`typescript
const error = new EngineError(
  ErrorDomain.DATA,
  ErrorCode.DATA_UNAVAILABLE,
  'Stock not found',
  { context: { symbol: 'XYZ' } }
);

console.log(JSON.stringify(error.toJSON(), null, 2));
// 输出:
// {
//   "name": "EngineError",
//   "domain": "DATA",
//   "code": "DATA_UNAVAILABLE",
//   "message": "Stock not found",
//   "context": { "symbol": "XYZ" },
//   "causeMessage": undefined,
//   "timestamp": "2026-06-11T00:00:00.000Z"
// }
\`\`\`

---

## Legacy 兼容

### 字符串错误码自动映射

旧代码中使用的字符串错误码会自动映射到标准 ErrorCode：

| 旧字符串码 | 映射到 |
|---|---|
| `ENGINE_VALIDATION_ERROR` | `ErrorCode.INVALID_PARAM` |
| `ENGINE_AI_ERROR` | `ErrorCode.AI_PARSE_ERROR` |
| `ENGINE_INTERNAL_ERROR` | `ErrorCode.INTERNAL_ERROR` |
| `ENGINE_DATA_ERROR` | `ErrorCode.DATA_UNAVAILABLE` |
| `ENGINE_AUTH_ERROR` | `ErrorCode.UNAUTHORIZED` |
| `ENGINE_CONNECTION_ERROR` | `ErrorCode.CONNECTION_FAILED` |
| `ENGINE_ORDER_ERROR` | `ErrorCode.ORDER_REJECTED` |
| `ENGINE_SYSTEM_ERROR` | `ErrorCode.INTERNAL_ERROR` |
| `NOT_FOUND` | `ErrorCode.DATA_UNAVAILABLE` |
| `TIMEOUT` | `ErrorCode.AI_TIMEOUT` |
| `PARSE_ERROR` | `ErrorCode.AI_PARSE_ERROR` |
| `NETWORK_ERROR` | `ErrorCode.CONNECTION_FAILED` |

### 兼容层

`electron/errors.ts` 提供 re-export，78+ 个文件通过此兼容层自动标准化：

\`\`\`typescript
// electron/errors.ts
export { ErrorDomain } from './engine/core/engine-error';
\`\`\`

---

## FAQ

### Q: 什么时候用 EngineError，什么时候用 Error？

**用 EngineError**: 所有业务逻辑错误（交易、数据、AI、认证、网络、校验、系统）。

**用 Error**: 仅限 React 框架要求的场景：
- `ErrorBoundary.tsx`: React 错误边界要求 throw Error
- `I18nProvider.tsx`: i18n 框架要求

**不用任何 Error**: `engine-error.ts` 文件自身的注释示例。

### Q: 如何处理不确定域的错误？

使用 `ErrorDomain.SYSTEM` + `ErrorCode.INTERNAL_ERROR` 作为兜底。后续可以根据实际场景细化。

### Q: context 里可以放什么？

任意 `Record<string, unknown>`。建议放：
- 关键业务参数（orderId, symbol, quantity）
- 环境信息（provider, endpoint, timestamp）
- 诊断信息（duration, retryCount, attemptNumber）

不要放：敏感信息（密码、Token、密钥）。

### Q: 新增 ErrorCode 需要改哪里？

1. `electron/engine/core/engine-error.ts` — 添加枚举值
2. `mapLegacyCodeToErrorCode()` — 添加旧码映射（如果有旧码）
3. 本指南 — 更新 ErrorCode 表

### Q: 覆盖率目标是多少？

R89 基线: 12.9% (93/723 files)。R90 目标: >=35%。R91-R92 目标: 50%+。

---

## 附录: 项目当前 EngineError 使用统计 (R89)

- **总文件数**: 723
- **使用 EngineError 的文件**: 93 (12.9%)
- **raw throw new Error**: 3 处（全部合理保留）
- **ErrorDomain 引用**: 93 文件
- **ErrorCode 引用**: 93 文件

目标: R92 达到 50%+ 覆盖率。
