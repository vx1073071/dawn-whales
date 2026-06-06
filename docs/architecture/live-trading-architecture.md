# Live Trading 架构文档

**作者**: dao  
**时间**: 2026-06-07T04:49:00+08:00  
**版本**: v0.9.0-alpha  

---

## 1. 概述

Live Trading 模块实现从模拟交易到实盘交易的无缝桥接，支持安全的风控机制和完整的审计追踪。

### 1.1 设计目标

1. **安全第一**: 双重确认 + 资金上限 + 异常熔断
2. **无缝切换**: 模拟盘 → 实盘一键切换
3. **完整审计**: 所有操作可追溯
4. **风控前置**: 订单前置风控检查
5. **多券商支持**: 适配器模式支持多券商

### 1.2 核心原则

- **Dry-run 优先**: 默认模拟模式，需显式启用实盘
- **最小权限**: 仅暴露必要的交易接口
- **失败安全**: 任何异常自动回退模拟盘
- **透明可观测**: 实时状态 + 完整日志

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Live Trading 架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                                              │
│  │ StrategyEngine│  策略引擎 (信号生成)                         │
│  └──────┬───────┘                                              │
│         │ signal                                               │
│         ↓                                                       │
│  ┌──────────────┐                                              │
│  │ RiskGateway  │  风控网关 (前置检查)                          │
│  │              │  - 持仓限制                                   │
│  │              │  - 资金限制                                   │
│  │              │  - 频率限制                                   │
│  │              │  - 黑名单检查                                 │
│  └──────┬───────┘                                              │
│         │ approved signal                                      │
│         ↓                                                       │
│  ┌──────────────┐                                              │
│  │LiveTradeBridge│  实盘桥接                                    │
│  │              │  - 模式切换 (paper/live)                      │
│  │              │  - 订单路由                                   │
│  │              │  - 状态同步                                   │
│  │              │  - 审计日志                                   │
│  └──────┬───────┘                                              │
│         │ order                                                │
│         ↓                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ FutuAdapter  │  │MoomooAdapter │  │SimAdapter    │         │
│  │ (富途)       │  │ (Moomoo)     │  │ (模拟盘)     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 组件职责

| 组件 | 职责 | 行数 |
|-----|------|------|
| RiskGateway | 风控前置检查 | ~300L |
| LiveTradeBridge | 模式切换 + 订单路由 | ~500L |
| FutuAdapter | 富途 API 适配 | ~400L |
| MoomooAdapter | Moomoo API 适配 | ~400L |
| SimAdapter | 模拟盘适配 | ~200L |

---

## 3. LiveTradeBridge 详细设计

### 3.1 核心接口

```typescript
interface LiveTradeBridge {
  // 模式管理
  setMode(mode: 'paper' | 'live'): void;
  getMode(): 'paper' | 'live';
  
  // 订单管理
  submitOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOrderStatus(orderId: string): OrderStatus;
  
  // 仓位管理
  getPositions(): Position[];
  reconcilePositions(): ReconcileResult;
  
  // 审计
  getAuditLog(filter?: AuditFilter): AuditEntry[];
  
  // 配置
  setConfig(config: LiveTradeConfig): void;
  getConfig(): LiveTradeConfig;
}
```

### 3.2 模式切换

```typescript
type TradingMode = 'paper' | 'live';

interface ModeTransition {
  from: TradingMode;
  to: TradingMode;
  requiresConfirmation: boolean;
  preChecks: PreCheck[];
}

// 切换流程
paper → live:
  1. 用户确认 (双重确认)
  2. 风控检查 (资金/持仓/频率)
  3. 券商连接验证
  4. 模拟仓位对账
  5. 切换模式
  6. 记录审计日志

live → paper:
  1. 用户确认
  2. 取消所有挂单
  3. 记录审计日志
  4. 切换模式
```

### 3.3 订单路由

```typescript
interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: 'DAY' | 'GTC' | 'IOC';
  strategyId?: string;
  metadata?: Record<string, any>;
}

interface OrderResult {
  orderId: string;
  status: 'submitted' | 'rejected' | 'pending';
  message?: string;
  adapter: string;
  timestamp: number;
}
```

### 3.4 状态同步

```typescript
interface OrderStatus {
  orderId: string;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  filledPrice: number;
  remainingQuantity: number;
  lastUpdate: number;
  adapter: string;
}

// 同步机制
- 轮询: 每 5 秒查询订单状态
- 推送: WebSocket 实时推送 (如支持)
- 对账: 每 1 分钟对账仓位
```

---

## 4. 安全机制

### 4.1 双重确认

```typescript
interface ConfirmationFlow {
  step1: {
    action: string;
    details: Record<string, any>;
    requiresPassword: boolean;
  };
  step2: {
    code: string; // 6位验证码
    expiresAt: number;
  };
}

// 实盘订单确认
1. 用户提交订单
2. 显示订单详情 + 风险提示
3. 用户输入交易密码
4. 发送验证码到手机/邮箱
5. 用户输入验证码
6. 执行订单
```

### 4.2 资金限制

```typescript
interface FundLimits {
  maxOrderAmount: number;      // 单笔最大金额
  maxDailyAmount: number;      // 单日最大金额
  maxPositionValue: number;    // 单标的最大持仓
  maxTotalPosition: number;    // 总持仓上限
  minCashReserve: number;      // 最低现金储备
}

// 默认限制
{
  maxOrderAmount: 100000,      // 10 万
  maxDailyAmount: 500000,      // 50 万
  maxPositionValue: 200000,    // 20 万
  maxTotalPosition: 1000000,   // 100 万
  minCashReserve: 50000,       // 5 万
}
```

### 4.3 频率限制

```typescript
interface RateLimits {
  maxOrdersPerMinute: number;  // 每分钟最大订单数
  maxOrdersPerHour: number;    // 每小时最大订单数
  maxCancelsPerMinute: number; // 每分钟最大撤单数
  cooldownMs: number;          // 订单间隔冷却
}

// 默认限制
{
  maxOrdersPerMinute: 10,
  maxOrdersPerHour: 100,
  maxCancelsPerMinute: 20,
  cooldownMs: 1000,            // 1 秒
}
```

### 4.4 异常熔断

```typescript
interface CircuitBreaker {
  enabled: boolean;
  maxConsecutiveFailures: number;  // 连续失败次数
  maxDailyLoss: number;            // 单日最大亏损
  maxDrawdown: number;             // 最大回撤
  cooldownMinutes: number;         // 熔断冷却时间
}

// 熔断触发条件
1. 连续 5 次订单失败
2. 单日亏损超过 3%
3. 最大回撤超过 10%

// 熔断动作
1. 自动切换到模拟盘
2. 取消所有挂单
3. 发送告警通知
4. 记录审计日志
5. 等待人工介入
```

### 4.5 黑名单检查

```typescript
interface Blacklist {
  symbols: string[];        // 禁止交易的标的
  strategies: string[];     // 禁止使用的策略
  accounts: string[];       // 禁止使用的账户
}

// 检查流程
1. 订单提交前检查标的黑名单
2. 检查策略黑名单
3. 检查账户黑名单
4. 命中则拒绝订单
```

---

## 5. 审计日志

### 5.1 日志结构

```typescript
interface AuditEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  mode: TradingMode;
  user: string;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'rejected';
  reason?: string;
  ipAddress?: string;
  sessionId?: string;
}

type AuditAction =
  | 'mode_switch'
  | 'order_submit'
  | 'order_cancel'
  | 'order_fill'
  | 'position_reconcile'
  | 'circuit_breaker_trigger'
  | 'config_change'
  | 'login'
  | 'logout';
```

### 5.2 日志存储

```typescript
// 存储策略
- 内存: 最近 1000 条
- 文件: 按天滚动 (audit-YYYY-MM-DD.jsonl)
- 数据库: 持久化存储 (可选)

// 保留策略
- 内存: 1000 条
- 文件: 90 天
- 数据库: 永久
```

### 5.3 日志查询

```typescript
interface AuditFilter {
  startTime?: number;
  endTime?: number;
  actions?: AuditAction[];
  modes?: TradingMode[];
  results?: ('success' | 'failure' | 'rejected')[];
  user?: string;
  symbol?: string;
}

// 查询示例
bridge.getAuditLog({
  startTime: Date.now() - 86400000, // 最近 24 小时
  actions: ['order_submit', 'order_fill'],
  result: 'success',
});
```

---

## 6. 适配器设计

### 6.1 适配器接口

```typescript
interface BrokerAdapter {
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // 订单管理
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
  
  // 仓位查询
  getPositions(): Promise<Position[]>;
  getBalance(): Promise<Balance>;
  
  // 行情查询
  getQuote(symbol: string): Promise<Quote>;
  
  // 事件
  on(event: 'order:update', handler: (status: OrderStatus) => void): void;
  on(event: 'position:update', handler: (positions: Position[]) => void): void;
  on(event: 'connection:change', handler: (connected: boolean) => void): void;
}
```

### 6.2 FutuAdapter

```typescript
// 富途 OpenD 连接
interface FutuConfig {
  host: string;          // OpenD 地址
  port: number;          // OpenD 端口
  market: 'HK' | 'US' | 'CN';
  accId: number;         // 账户 ID
  trdEnv: 'REAL' | 'SIMULATE';
}

// 支持功能
- 港股/美股/A股交易
- 实时行情
- 历史 K 线
- 账户查询
```

### 6.3 MoomooAdapter

```typescript
// Moomoo OpenD 连接
interface MoomooConfig {
  host: string;
  port: number;
  market: 'HK' | 'US' | 'CN' | 'SG';
  accId: number;
  trdEnv: 'REAL' | 'SIMULATE';
}

// 支持功能
- 港股/美股/A股/新加坡股交易
- 实时行情
- 历史 K 线
- 账户查询
```

### 6.4 SimAdapter

```typescript
// 模拟盘适配器
interface SimConfig {
  initialCash: number;
  commission: number;     // 手续费率
  slippage: number;       // 滑点
  latency: number;        // 延迟 (ms)
}

// 模拟逻辑
- 订单立即成交 (市价单)
- 限价单等待触发
- 计算手续费和滑点
- 更新仓位和余额
```

---

## 7. 部署方案

### 7.1 开发环境

```
- 仅 SimAdapter
- 无资金限制
- 无双重确认
- 审计日志输出到控制台
```

### 7.2 测试环境

```
- SimAdapter + FutuAdapter (模拟盘)
- 严格资金限制
- 双重确认开启
- 审计日志输出到文件
```

### 7.3 生产环境

```
- FutuAdapter + MoomooAdapter (实盘)
- 完整安全机制
- 双重确认 + 验证码
- 审计日志持久化
- 熔断机制开启
- 告警通知开启
```

---

## 8. 监控告警

### 8.1 监控指标

```typescript
interface LiveTradingMetrics {
  // 订单指标
  ordersSubmitted: number;
  ordersFilled: number;
  ordersRejected: number;
  orderFillRate: number;
  avgOrderLatency: number;
  
  // 仓位指标
  totalPositionValue: number;
  cashBalance: number;
  dailyPnl: number;
  dailyPnlPct: number;
  
  // 风险指标
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number;
  
  // 系统指标
  adapterConnected: boolean;
  lastHeartbeat: number;
  circuitBreakerTripped: boolean;
}
```

### 8.2 告警规则

```typescript
interface AlertRule {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  action: 'log' | 'email' | 'sms' | 'webhook';
  cooldownMinutes: number;
}

// 默认告警规则
[
  {
    name: '订单失败率过高',
    condition: 'orderFillRate < 0.8',
    severity: 'warning',
    action: 'email',
  },
  {
    name: '单日亏损过大',
    condition: 'dailyPnlPct < -0.03',
    severity: 'critical',
    action: 'sms',
  },
  {
    name: '适配器断开',
    condition: '!adapterConnected',
    severity: 'critical',
    action: 'sms',
  },
  {
    name: '熔断触发',
    condition: 'circuitBreakerTripped',
    severity: 'critical',
    action: 'sms',
  },
]
```

---

## 9. 实施计划

### R40: LiveTradeBridge 骨架

- [x] LiveTradeBridge 核心接口
- [x] 模式切换 (paper/live)
- [x] 订单路由
- [x] 审计日志
- [x] SimAdapter

### R41: 券商适配器

- [ ] FutuAdapter
- [ ] MoomooAdapter
- [ ] 双重确认 UI
- [ ] 告警通知

### R42: 生产就绪

- [ ] 完整安全机制
- [ ] 监控仪表盘
- [ ] 压力测试
- [ ] 文档完善

---

## 10. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 券商 API 不稳定 | 中 | 高 | 自动重连 + 降级到模拟盘 |
| 订单执行延迟 | 中 | 中 | 异步处理 + 超时机制 |
| 资金损失 | 低 | 高 | 多重风控 + 熔断机制 |
| 审计日志丢失 | 低 | 高 | 多重备份 + 持久化存储 |
| 安全漏洞 | 低 | 高 | 代码审查 + 渗透测试 |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:50:00+08:00  
**版本**: v0.9.0-alpha  
**状态**: 架构设计完成，R40 开始实施
