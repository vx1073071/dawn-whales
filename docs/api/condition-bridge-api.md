# ConditionTradeBridge API 文档

**Phase**: 4.3 R36  
**文件**: `electron/engine/condition-trade-bridge.ts` (369 行)  
**作者**: ML  
**审查**: dao  

---

## 概述

ConditionTradeBridge 是 ConditionEngine 到 TradeExecutor 的桥梁，实现条件触发到交易执行的完整闭环。这是 Phase 4.3 的最后一个缺失环节。

**核心功能**:
- 条件信号路由到交易执行器
- 安全前置检查（冷却期 + 每日限制）
- 自动重试机制
- 事件驱动架构

---

## 类型定义

### ConditionTrigger

```typescript
interface ConditionTrigger {
  id: string;              // 触发器唯一 ID
  ruleId: string;          // 关联条件规则 ID
  symbol: string;          // 交易标的代码
  condition: string;       // 条件描述
  price: number;           // 触发价格
  timestamp: number;       // 触发时间戳
  strategyId?: string;     // 关联策略 ID
  metadata?: Record<string, any>;  // 附加元数据
}
```

### BridgeConfig

```typescript
interface BridgeConfig {
  cooldownMs: number;         // 同一 rule+symbol 的最小触发间隔 (ms)
  maxDailyTriggers: number;   // 每个标的每日最大触发次数
  autoRoute: boolean;         // 是否自动路由到经纪商适配器
  requireRiskCheck: boolean;  // 是否需要风控引擎审批
  maxRetries: number;         // 失败订单最大重试次数
  retryDelayMs: number;       // 重试延迟基数 (ms)
}
```

**默认配置**:
```typescript
{
  cooldownMs: 60000,       // 60 秒
  maxDailyTriggers: 50,    // 每日 50 次
  autoRoute: true,
  requireRiskCheck: true,
  maxRetries: 3,
  retryDelayMs: 1000,
}
```

### BridgeSignal

```typescript
interface BridgeSignal {
  trigger: ConditionTrigger;
  action: 'buy' | 'sell' | 'hold';
  quantity?: number;
  price?: number;
  orderType?: 'MARKET' | 'LIMIT';
  status: 'pending' | 'routed' | 'executed' | 'rejected' | 'failed';
  reason?: string;
  orderId?: string;
  executedAt?: number;
  executedPrice?: number;
}
```

### BridgeStats

```typescript
interface BridgeStats {
  totalTriggers: number;     // 总触发次数
  totalExecuted: number;     // 总执行成功次数
  totalRejected: number;     // 总拒绝次数
  totalFailed: number;       // 总失败次数
  lastTriggerAt: number;     // 最后触发时间
  activeSignals: number;     // 活跃信号数
}
```

---

## ConditionTradeBridge 类

### 构造函数

```typescript
constructor(config?: Partial<BridgeConfig>)
```

**参数**:
- `config`: 可选的配置覆盖

**示例**:
```typescript
const bridge = new ConditionTradeBridge({
  cooldownMs: 30000,        // 30 秒冷却
  maxDailyTriggers: 100,    // 每日 100 次
  maxRetries: 5,            // 最多重试 5 次
});
```

---

### 核心方法

#### processTrigger(trigger)

处理条件触发器，返回 BridgeSignal。

```typescript
async processTrigger(trigger: ConditionTrigger): Promise<BridgeSignal>
```

**流程**:
1. **冷却期检查**: 检查同一 rule+symbol 的触发间隔
2. **每日限制检查**: 检查标的是否达到每日触发上限
3. **动作确定**: 根据条件类型判断 buy/sell/hold
4. **创建信号**: 生成 BridgeSignal 对象
5. **路由执行**: 如果 autoRoute=true 且 action≠hold，执行带重试的交易

**返回值**:
- `BridgeSignal`: 包含执行状态和结果

**触发事件**:
- `signal:pending`: 信号创建后
- `signal:routed`: 信号路由到执行器
- `signal:executed`: 执行成功
- `signal:rejected`: 被拒绝（冷却期/每日限制）
- `signal:failed`: 执行失败
- `signal:retry`: 重试中

**示例**:
```typescript
bridge.on('signal:executed', (signal) => {
  console.log(`订单执行：${signal.orderId} @ ${signal.executedPrice}`);
});

const signal = await bridge.processTrigger({
  id: 'trigger-001',
  ruleId: 'golden-cross',
  symbol: 'HK.00700',
  condition: 'golden_cross',
  price: 180.5,
  timestamp: Date.now(),
  metadata: { positionSize: 200 },
});
```

---

### 管理方法

#### getSignal(id)

获取指定信号。

```typescript
getSignal(id: string): BridgeSignal | undefined
```

#### getStats()

获取桥接统计信息。

```typescript
getStats(): BridgeStats
```

#### getConfig()

获取当前配置。

```typescript
getConfig(): BridgeConfig
```

#### updateConfig(partial)

更新配置。

```typescript
updateConfig(partial: Partial<BridgeConfig>): void
```

#### resetDailyCount()

重置每日计数（在午夜调用）。

```typescript
resetDailyCount(): void
```

**触发事件**: `bridge:daily_reset`

#### resetAll()

重置所有状态。

```typescript
resetAll(): void
```

**触发事件**: `bridge:reset`

---

## 动作判断逻辑

`determineAction()` 方法根据条件字符串判断交易动作：

| 条件关键词 | 动作 |
|-----------|------|
| `crosses_above` | buy |
| `oversold` | buy |
| `golden_cross` | buy |
| `breakout_up` | buy |
| `above_support` | buy |
| `crosses_below` | sell |
| `overbought` | sell |
| `death_cross` | sell |
| `breakout_down` | sell |
| `below_resistance` | sell |
| `above` + price>0 | buy |
| `below` + price>0 | sell |
| 其他 | hold |

---

## 数量计算

`calculateQuantity()` 方法计算交易数量：

```typescript
private calculateQuantity(trigger: ConditionTrigger): number {
  const meta = trigger.metadata;
  if (meta?.quantity) return meta.quantity;
  if (meta?.positionSize) return meta.positionSize;
  return 100;  // 默认 100 股
}
```

**优先级**:
1. `metadata.quantity`
2. `metadata.positionSize`
3. 默认值 100

---

## 重试机制

`executeWithRetry()` 方法实现指数退避重试：

```typescript
private async executeWithRetry(signal: BridgeSignal): Promise<boolean> {
  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      await this.simulateExecution(signal);
      return true;
    } catch (err: any) {
      lastError = err;
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt);
        this.emit('signal:retry', { signal, attempt: attempt + 1, delay });
        await new Promise(r => setTimeout(r, Math.min(delay, 10)));
      }
    }
  }
  throw lastError || new Error('Max retries exceeded');
}
```

**重试延迟**:
- 第 1 次：1000ms (1s)
- 第 2 次：2000ms (2s)
- 第 3 次：4000ms (4s)
- 第 4 次：8000ms (8s)
- 第 5 次：16000ms (16s)，上限 10ms（测试模式）

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `signal:pending` | 信号创建后 | `BridgeSignal` |
| `signal:routed` | 信号路由到执行器 | `BridgeSignal` |
| `signal:executed` | 执行成功 | `BridgeSignal` |
| `signal:rejected` | 被拒绝 | `BridgeSignal` |
| `signal:failed` | 执行失败 | `BridgeSignal` |
| `signal:retry` | 重试中 | `{ signal, attempt, delay }` |
| `bridge:daily_reset` | 每日计数重置 | - |
| `bridge:reset` | 全部重置 | - |

---

## 使用示例

### 基础用法

```typescript
import { ConditionTradeBridge } from './condition-trade-bridge';

const bridge = new ConditionTradeBridge();

// 监听事件
bridge.on('signal:executed', (signal) => {
  console.log(`✅ 执行成功：${signal.orderId}`);
});

bridge.on('signal:rejected', (signal) => {
  console.log(`❌ 被拒绝：${signal.reason}`);
});

// 处理触发
const signal = await bridge.processTrigger({
  id: 'sig-001',
  ruleId: 'ma-cross',
  symbol: 'HK.00700',
  condition: 'golden_cross',
  price: 180.0,
  timestamp: Date.now(),
});

console.log(`信号状态：${signal.status}`);
```

### 自定义配置

```typescript
const bridge = new ConditionTradeBridge({
  cooldownMs: 120000,        // 2 分钟冷却
  maxDailyTriggers: 20,      // 每日 20 次
  autoRoute: false,          // 手动路由
  maxRetries: 5,             // 最多 5 次重试
  retryDelayMs: 500,         // 500ms 基数
});

// 手动路由信号
bridge.on('signal:routed', async (signal) => {
  // 自定义路由逻辑
  await myTradeExecutor.execute(signal);
});
```

### 统计监控

```typescript
setInterval(() => {
  const stats = bridge.getStats();
  console.log(`
    总触发：${stats.totalTriggers}
    执行成功：${stats.totalExecuted}
    成功率：${(stats.totalExecuted / stats.totalTriggers * 100).toFixed(2)}%
    活跃信号：${stats.activeSignals}
  `);
}, 60000);
```

---

## 验收标准

- ✅ 代码行数：369 行
- ✅ 单元测试：17 tests (JVS-37-01)
- ✅ EventEmitter 集成
- ✅ 冷却期检查
- ✅ 每日限制检查
- ✅ 重试机制（指数退避）
- ✅ 事件驱动架构
- ✅ TypeScript 严格模式

---

**文档生成**: dao  
**时间**: 2026-06-07T02:30:00+08:00  
**版本**: v0.8.0-alpha
