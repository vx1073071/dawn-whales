<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# Dawn Whales USDT 积分 API 文档

> 版本: v1.11.0 | 发布日期: 2026-06-12 | 维护: QClaw (文档虾)
> 基于项目实际源文件: `electron/engine/data/usdt-points-manager.ts`, `electron/engine/data/trade-fee-hook.ts`, `electron/engine/data/exchange-rate-engine.ts`, `electron/engine/data/fee-calculator.ts`, `electron/engine/core/engine-error.ts`

---

## 一、概述

Dawn Whales USDT 积分系统提供原子化的积分余额管理、自动交易扣费钩子和实时汇率查询。积分作为平台内部计费单位，不涉及用户券商资金。

### 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `USDTPointsManager` | `usdt-points-manager.ts` | 余额管理 (增/扣/查/账本) |
| `TradeFeeHook` | `trade-fee-hook.ts` | 交易完成自动扣费钩子 |
| `ExchangeRateEngine` | `exchange-rate-engine.ts` | 6货币→USDT 汇率引擎 |
| `FeeCalculator` | `fee-calculator.ts` | 费率计算 (交易/P2P/提现) |

### 架构图

```
Renderer (React)                    Main (Electron)                  Engine Layer
─────────────────                  ────────────────                  ────────────
window.api.points                   ipcMain.handle                   USDTPointsManager
  .getBalance()  ──IPC invoke──→    points:getBalance  ──→  getBalance(userId)
  .deduct()      ──IPC invoke──→    points:deduct      ──→  deduct(userId, amt, ...)
  .deposit()     ──IPC invoke──→    points:deposit     ──→  deposit(userId, amt, ...)
  .getLedger()   ──IPC invoke──→    points:getLedger   ──→  getLedger(userId, ...)
  .getRates()    ──IPC invoke──→    points:getRates    ──→  ExchangeRateEngine
  .getBalance()  ──IPC invoke──→    points:getBalance  ──→  getBalance(userId)
  .canDeduct()   ──IPC invoke──→    points:canDeduct   ──→  canDeduct(userId, amt)

交易完成 ─────────────────────→  TradeFeeHook.onTradeComplete()
                                   ├─ calcTradeFee() → FeeCalculator
                                   ├─ deduct() → USDTPointsManager (retry 3x)
                                   └─ fail → dead letter queue
```

---

## 二、IPC Channel 定义

### 2.1 Preload 暴露 (Renderer → Main)

```typescript
// electron/preload.ts — window.api.points

window.api.points = {
  getBalance:     (userId: string)                 → ipcRenderer.invoke('points:getBalance', userId),
  deduct:         (userId: string, amount: number,
                   reason: string, tradeId?: string) → ipcRenderer.invoke('points:deduct', { userId, amount, reason, tradeId }),
  deposit:        (userId: string, amount: number,
                   source: string)                 → ipcRenderer.invoke('points:deposit', { userId, amount, source }),
  getLedger:      (userId: string, limit?: number,
                   offset?: number)                → ipcRenderer.invoke('points:getLedger', { userId, limit, offset }),
  canDeduct:      (userId: string, amount: number) → ipcRenderer.invoke('points:canDeduct', { userId, amount }),
  getRates:       ()                               → ipcRenderer.invoke('points:getRates'),
  getRate:        (currency: FiatCurrency)         → ipcRenderer.invoke('points:getRate', currency),
  refreshRates:   ()                               → ipcRenderer.invoke('points:refreshRates'),
  getDeadLetters: ()                               → ipcRenderer.invoke('points:getDeadLetters'),
}
```

### 2.2 Channel 速查表

| Channel | 方向 | Payload | 返回 | 引擎调用 |
|---------|------|---------|------|----------|
| `points:getBalance` | renderer→main | `userId: string` | `number` (6dp) | `USDTPointsManager.getBalance()` |
| `points:deduct` | renderer→main | `{ userId, amount, reason, tradeId? }` | `DeductResult` | `USDTPointsManager.deduct()` |
| `points:deposit` | renderer→main | `{ userId, amount, source }` | `PointsResult` | `USDTPointsManager.deposit()` |
| `points:getLedger` | renderer→main | `{ userId, limit=20, offset=0 }` | `LedgerEntry[]` | `USDTPointsManager.getLedger()` |
| `points:canDeduct` | renderer→main | `{ userId, amount }` | `boolean` | `USDTPointsManager.canDeduct()` |
| `points:getRates` | renderer→main | (无) | `ExchangeRates` | `ExchangeRateEngine.getAllRates()` |
| `points:getRate` | renderer→main | `currency: FiatCurrency` | `number` | `ExchangeRateEngine.getRate()` |
| `points:refreshRates` | renderer→main | (无) | `ExchangeRates` | `ExchangeRateEngine.refresh()` |
| `points:getDeadLetters` | renderer→main | (无) | `DeadLetterEntry[]` | `TradeFeeHook.getDeadLetters()` |

### 2.3 IPC Handler 注册 (Main Process)

所有 IPC handler 必须在 `electron/ipc/` 或 `electron/main/ipc-setup.ts` 中注册:

```typescript
// 示例: points-ipc.ts (待创建)
import { ipcMain } from 'electron';
import { getUSDTPointsManager } from '../engine/data/usdt-points-manager';
import { getExchangeRateEngine } from '../engine/data/exchange-rate-engine';
import { getTradeFeeHook } from '../engine/data/trade-fee-hook';

export function registerPointsIPC() {
  const manager = getUSDTPointsManager();
  const rateEngine = getExchangeRateEngine();
  const feeHook = getTradeFeeHook();

  ipcMain.handle('points:getBalance', async (_e, userId: string) => {
    return manager.getBalance(userId);
  });

  ipcMain.handle('points:deduct', async (_e, params) => {
    const { userId, amount, reason, tradeId } = params;
    return manager.deduct(userId, amount, reason, tradeId);
  });

  ipcMain.handle('points:deposit', async (_e, params) => {
    const { userId, amount, source } = params;
    return manager.deposit(userId, amount, source);
  });

  ipcMain.handle('points:getLedger', async (_e, params) => {
    const { userId, limit = 20, offset = 0 } = params;
    return manager.getLedger(userId, limit, offset);
  });

  ipcMain.handle('points:canDeduct', async (_e, params) => {
    const { userId, amount } = params;
    return manager.canDeduct(userId, amount);
  });

  ipcMain.handle('points:getRates', async () => {
    return rateEngine.getAllRates();
  });

  ipcMain.handle('points:getRate', async (_e, currency) => {
    return rateEngine.getRate(currency);
  });

  ipcMain.handle('points:refreshRates', async () => {
    return rateEngine.refresh();
  });

  ipcMain.handle('points:getDeadLetters', async () => {
    return feeHook.getDeadLetters();
  });
}
```

---

## 三、API 类型定义

### 3.1 FiatCurrency

```typescript
type FiatCurrency = 'HKD' | 'CNY' | 'USD' | 'JPY' | 'EUR' | 'GBP';
```

### 3.2 TxType

```typescript
type TxType = 'charge' | 'trade_fee' | 'p2p_fee' | 'withdraw';
```

### 3.3 LedgerEntry (账本记录)

```typescript
interface LedgerEntry {
  id: string;              // 流水号, 格式: L000001, L000002, ...
  userId: string;          // 用户 ID
  amount: number;          // 变动金额, 正=充值, 负=扣费 (6位小数)
  type: TxType;            // 操作类型
  reason: string;          // 操作原因 (source / trade_fee / p2p / withdraw)
  tradeId?: string;        // 关联交易 ID (仅 type=trade_fee)
  balanceAfter: number;    // 变动后余额 (6位小数)
  timestamp: number;       // Unix timestamp (ms)
}
```

### 3.4 PointsResult (操作结果)

```typescript
interface PointsResult {
  success: boolean;        // true = 操作成功
  newBalance: number;      // 操作后余额
}

interface DeductResult extends PointsResult {
  error?: string;          // 失败原因
}
```

### 3.5 ExchangeRates (汇率)

```typescript
type ExchangeRates = Record<FiatCurrency, number>;
// 示例: { HKD: 0.1277, CNY: 0.1381, USD: 1.0, JPY: 0.00643, EUR: 1.089, GBP: 1.273 }
```

所有汇率表示 **1 单位法币 = n USDT**。

### 3.6 FeeDeductionResult (扣费钩子结果)

```typescript
interface FeeDeductionResult {
  success: boolean;
  tradeId: string;
  feeUSDT: number;          // 手续费 (6位小数)
  newBalance?: number;      // 扣费后余额
  retries?: number;         // 重试次数
  error?: string;           // 失败原因
  deadLetter?: boolean;     // 是否进入死信队列
}
```

### 3.7 DeadLetterEntry (死信条目)

```typescript
interface DeadLetterEntry {
  tradeId: string;
  userId: string;
  feeUSDT: number;
  reason: string;
  retries: number;
  timestamp: number;
}
```

---

## 四、错误码表

### 4.1 积分系统错误

| 错误码 | 异常类 | 触发条件 | HTTP 类比 |
|--------|--------|----------|----------|
| `INSUFFICIENT_BALANCE` | `PointsInsufficientError` | 余额不足, deduct() 拒绝 | 402 Payment Required |
| `INVALID_AMOUNT` | `PointsInvalidAmountError` | amount ≤ 0 | 400 Bad Request |
| `RETRY_EXHAUSTED` | (TradeFeeHook) | 扣费重试 3 次耗尽→死信 | 503 Service Unavailable |

### 4.2 引擎通用错误

| 错误码 | 域 | 场景 |
|--------|-----|------|
| `INSUFFICIENT_BALANCE` | TRADE | 交易时余额不足 |
| `DATA_STALE` | DATA | 汇率缓存超过 5 分钟未刷新 |
| `DATA_UNAVAILABLE` | DATA | CoinGecko + Binance 均不可用，回退到静态汇率 |
| `INVALID_PARAM` | VALIDATION | IPC 参数校验失败 |
| `INTERNAL_ERROR` | SYSTEM | 系统内部错误 |

### 4.3 错误处理模式

```typescript
// Renderer 侧
try {
  const result = await window.api.points.deduct(userId, amount, reason, tradeId);
  if (!result.success) {
    if (result.error?.includes('Insufficient balance')) {
      // 展示余额不足提示，引导充值
    }
  }
} catch (err) {
  if (err instanceof PointsInsufficientError) {
    // 余额不足，不可重试
  }
  // 其他错误可能可重试
}
```

---

## 五、API 方法详细说明

### 5.1 getBalance(userId)

获取用户积分余额。

| 参数 | 类型 | 说明 |
|------|------|------|
| `userId` | `string` | 用户唯一标识 |

| 返回 | 类型 | 说明 |
|------|------|------|
| balance | `number` | 当前余额, 6位小数。新用户返回 0 |

```
调用: window.api.points.getBalance("creator_123")
返回: 150.500000
```

### 5.2 deduct(userId, amount, reason, tradeId?)

原子扣费。检查余额 → 扣除 → 写账本。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | `string` | ✅ | 用户 ID |
| `amount` | `number` | ✅ | 扣费金额, 自动 round 到 6 位 |
| `reason` | `string` | ✅ | 扣费原因描述 |
| `tradeId` | `string` | ❌ | 关联交易 ID |

| 返回字段 | 类型 | 说明 |
|----------|------|------|
| `success` | `boolean` | 是否扣费成功 |
| `newBalance` | `number` | 扣费后余额 |
| `error` | `string?` | 失败原因 (仅 success=false) |

**异常**: `PointsInsufficientError` (余额不足), `PointsInvalidAmountError` (amount ≤ 0)

```
调用: window.api.points.deduct("creator_123", 1.50, "trade_fee", "T2026001")
返回: { success: true, newBalance: 148.999999 }
```

**注意**: 扣费仅限**扣自己的余额**。系统硬性要求 `userId` 必须与当前登录用户一致，否则被 ipc-sanitizer 拦截。

### 5.3 deposit(userId, amount, source)

充值积分。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | `string` | ✅ | 目标用户 ID |
| `amount` | `number` | ✅ | 充值金额 (>0) |
| `source` | `string` | ✅ | 充值来源 (e.g., "trc20_topup") |

**异常**: `PointsInvalidAmountError` (amount ≤ 0)

```
调用: window.api.points.deposit("creator_123", 100, "trc20_topup")
返回: { success: true, newBalance: 250.500000 }
```

### 5.4 getLedger(userId, limit?, offset?)

分页查询账本流水。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `userId` | `string` | — | 必填 |
| `limit` | `number` | 20 | 每页条数 |
| `offset` | `number` | 0 | 偏移量 |

| 返回 | 说明 |
|------|------|
| `LedgerEntry[]` | 按时间倒序排列, newest-first |

```
调用: window.api.points.getLedger("creator_123", 10, 0)
返回: [{ id: "L000042", userId: "creator_123", amount: -1.50, type: "trade_fee",
         reason: "trade_fee", tradeId: "T2026001", balanceAfter: 148.50,
         timestamp: 1755312000000 }, ...]
```

### 5.5 canDeduct(userId, amount)

预检查是否可扣费 (不实际扣费)。

```
调用: window.api.points.canDeduct("creator_123", 100)
返回: true | false
```

### 5.6 getRate(currency)

获取单一货币对 USDT 汇率。

```
调用: window.api.points.getRate("HKD")
返回: 0.1277   // 1 HKD = 0.1277 USDT
```

### 5.7 getRates()

获取全部 6 种货币对 USDT 汇率。

```
返回: { HKD: 0.1277, CNY: 0.1381, USD: 1.0, JPY: 0.00643, EUR: 1.089, GBP: 1.273 }
```

### 5.8 refreshRates()

强制刷新汇率 (跳过缓存)。返回最新汇率。

### 5.9 getDeadLetters()

管理员查看死信队列 (扣费失败但无法自动恢复的条目)。

---

## 六、自动交易扣费钩子

### 6.1 触发时机

```
交易执行器 → TradeFeeHook.onTradeComplete(event)
  ├─ Step 1: FeeCalculator.calcTradeFee() → feeUSDT
  ├─ Step 2: PointsManager.deduct() 
  │    ├─ Success → 返回 { success: true, newBalance }
  │    ├─ INSUFFICIENT_BALANCE → 立即返回失败 (不重试)
  │    └─ 其他错误 → 重试 (最多3次)
  │         ├─ 100ms → 200ms → 400ms (指数-ish退避)
  │         └─ 3次耗尽 → Step 3
  └─ Step 3: Dead Letter Queue (需管理员手动处理)
```

### 6.2 重试策略

| 重试 | 延迟 | 后条件 |
|------|------|--------|
| 1st | 0ms | 首次尝试 |
| 2nd | 100ms | 首次失败 |
| 3rd | 200ms | 二次失败 |
| 耗尽 | 400ms | → dead letter |

**不可重试**: `PointsInsufficientError` — 余额不足立即返回, 不重试。

### 6.3 死信队列

管理员可通过 `getDeadLetters()` 查看死信队列，通过 `retryDeadLetter(tradeId)` 手动重试。

```
// 管理员: 查看死信
window.api.points.getDeadLetters()
→ [{ tradeId: "T2026005", userId: "creator_456", feeUSDT: 2.34,
     reason: "Retry exhausted after 3 attempts", retries: 3, timestamp: 1755312000 }]

// 管理员: 手动重试
window.api.points.retryDeadLetter("T2026005")
```

---

## 七、安全规则

### 7.1 操作权限矩阵

| 操作 | 用户 (self) | 管理员 (admin) | 系统 (auto) |
|------|-------------|----------------|-------------|
| `getBalance` | ✅ 只查自己 | ✅ 查任何人 | ✅ |
| `deduct` | ⚠️ 只扣自己 | ❌ | ✅ TradeFeeHook |
| `deposit` | ❌ | ✅ 唯一充值入口 | ❌ |
| `getLedger` | ✅ 只查自己 | ✅ 查任何人 | ✅ |
| `canDeduct` | ✅ 只查自己 | ✅ | ✅ |
| `getRates` | ✅ | ✅ | ✅ |
| `getDeadLetters` | ❌ | ✅ | ✅ |

### 7.2 硬性规则

1. **只扣自己**: `deduct()` 的 `userId` 必须等于 `session.userId`，由 `ipc-input-sanitizer.ts` 在 IPC 层拦截跨用户扣费请求。
2. **管理员充值**: `deposit()` 仅管理员可调用。普通用户充值必须通过 TRC-20 网关 (`usdt-topup-gateway.ts`)。
3. **操作幂等**: `deduct/deposit` 不做去重(由 tradeId 关联的上游模块保证)。重复调用会导致重复扣费/充值。
4. **精度锁**: 所有 balance 值自动 round 到 6 位小数，防止浮点误差累积。
5. **原子性**: `deduct()` 内部 check → modify → ledger 是同步操作，在单线程 Node.js 环境下保证原子性 (无并发竞争)。

### 7.3 IPC 输入净化

`electron/main/ipc-input-sanitizer.ts` 对所有 IPC 输入进行:
- `userId`: 必须与当前 session 一致 (deduct/getBalance/getLedger/canDeduct)
- `amount`: 必须为 number, 且 > 0 (deduct/deposit)
- `tradeId`: 可选 string, max 64 字符
- `reason`: 必填 string, max 200 字符, 仅允许字母数字_中文_-

---

## 八、集成示例

### 8.1 充值流程

```typescript
// Renderer: 用户充值页面
async function handleTopUp(amountUSD: number) {
  const rates = await window.api.points.getRates();
  const rate = rates.CNY;
  const cnyAmount = (amountUSD / rate).toFixed(2);
  
  // 展示确认弹窗: 100 USDT = 724.00 CNY (rate: 0.1381)
  if (await confirm(`支付 ¥${cnyAmount} 获得 ${amountUSD} USDT?`)) {
    // TRC-20 转账 (由 usdt-topup-gateway 处理)
    const result = await window.api.points.deposit(userId, amountUSD, 'trc20_topup');
    showToast(`充值成功! 余额: ${result.newBalance} USDT`);
  }
}
```

### 8.2 自动交易扣费 (引擎侧)

```typescript
// Engine: 交易完成后自动调用
import { getTradeFeeHook } from '../engine/data/trade-fee-hook';
import { getUSDTPointsManager } from '../engine/data/usdt-points-manager';
import { getFeeCalculator } from '../engine/data/fee-calculator';

const hook = getTradeFeeHook(
  getUSDTPointsManager(),
  getFeeCalculator()
);

// 非阻塞调用
const result = await hook.onTradeComplete({
  id: trade.id,
  userId: trade.creator,
  amount: trade.quantity * trade.price,  // 成交额
  currency: trade.market === 'HK' ? 'HKD' : 
            trade.market === 'US' ? 'USD' : 'CNY',
  tier: user.creatorTier,
});

if (!result.success) {
  log.warn(`Fee deduction failed for trade ${trade.id}: ${result.error}`);
  if (result.deadLetter) {
    log.error(`Trade ${trade.id} sent to dead letter queue`);
  }
}
```

### 8.3 积分明细页 (Renderer)

```typescript
// React: Settings → Credits History
function CreditsHistoryPage() {
  const [txs, setTxs] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    window.api.points.getLedger(userId, PAGE_SIZE, page * PAGE_SIZE)
      .then(setTxs);
  }, [page]);

  return (
    <table>
      {txs.map(tx => (
        <tr key={tx.id}>
          <td>{formatTime(tx.timestamp)}</td>
          <td className={tx.amount > 0 ? 'text-green' : 'text-red'}>
            {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(6)}
          </td>
          <td>{tx.reason}</td>
          <td>{tx.balanceAfter.toFixed(6)}</td>
        </tr>
      ))}
    </table>
  );
}
```

---

## 九、测试覆盖

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/usdt-points-manager.test.ts` | getBalance/deduct/deposit/getLedger/canDeduct |
| `tests/trade-fee-hook.test.ts` | onTradeComplete/retry/deadLetter/batch |
| `tests/exchange-rate-engine.test.ts` | 6 currencies/cache/refresh/fallback chain |
| `tests/fee-calculator.test.ts` | 3 tiers × 6 markets/P2P/withdraw/boundaries |

---

## 十、开发参考

### 10.1 文件位置

| 功能 | 文件 |
|------|------|
| 积分管理 | `electron/engine/data/usdt-points-manager.ts` |
| 扣费钩子 | `electron/engine/data/trade-fee-hook.ts` |
| 汇率引擎 | `electron/engine/data/exchange-rate-engine.ts` |
| 费率计算 | `electron/engine/data/fee-calculator.ts` |
| 错误定义 | `electron/engine/core/engine-error.ts` |
| IPC 净化 | `electron/main/ipc-input-sanitizer.ts` |
| IPC Schema | `electron/ipc-schemas.ts` |
| Preload | `electron/preload.ts` |

### 10.2 单例获取

```typescript
import { getUSDTPointsManager } from '../engine/data/usdt-points-manager';
import { getTradeFeeHook } from '../engine/data/trade-fee-hook';
import { getExchangeRateEngine } from '../engine/data/exchange-rate-engine';
import { getFeeCalculator } from '../engine/data/fee-calculator';

const manager = getUSDTPointsManager();
const hook = getTradeFeeHook(manager, getFeeCalculator());
const rateEngine = getExchangeRateEngine();
```

### 10.3 测试清理

```typescript
// 测试中使用
manager.setBalance('test_user', 1000);
manager.reset();  // 清理所有数据

hook.clearDeadLetters();
resetTradeFeeHook();
```

---

## 十一、FAQ

**Q: 扣费失败了，用户的订单会怎么样？**
A: 订单正常成交不受影响。扣费失败走死信队列，管理员会手动处理。用户的券商资金和我们平台积分是独立的。

**Q: 并发扣费会超扣吗？**
A: 不会。`deduct()` 是同步操作（check→modify→ledger 在一个 tick 内完成），Node.js 单线程确保了原子性。

**Q: 汇率多久刷新一次？**
A: 60 秒 TTL 缓存。超过 5 分钟未刷新触发 STALE 告警。CoinGecko→Binance→Static 三级降级保证汇率可用。

**Q: 怎么充值？**
A: 管理员 `deposit()` 手动充值 + TRC-20 网关自动充值。TRC-20 充值费率 0%，平台承担 gas fee。

**Q: 账本记录能删除吗？**
A: 不能。`writeLedger()` 仅追加写入，无 DELETE 操作。每条记录包含 `balanceAfter` 可完整追溯余额变动。

> ⌨️ 禁止撒谎, 禁止半途停下, 所有数据来自项目实际源文件。
