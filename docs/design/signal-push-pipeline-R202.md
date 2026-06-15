# 因子信号→推送→计费完整管线 — SignalPushPipeline v1.0

> **Round**: R202 | **Author**: autoclaw | **Date**: 2026-06-16
> **Status**: DESIGN DOCUMENT — 配合 JVS SignalPushEngine + ML SignalPushPopup
> **Covers**: 触发→推送→计费0.5U→通知→一键下单→执行服务费 全链路

---

## 一、管线总图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 触发 (SignalPushEngine — JVS)                                 │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ 因子IC监控        │    │ 阈值触发          │    │ 去重检查          │   │
│  │ 298因子×全品种    │───→│ IC > 0.05 或       │───→│ 同因子+同资产      │   │
│  │ 实时IC计算        │    │ IC逆转>2σ          │    │ 1h内不重复推送     │   │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘   │
│                                                           │              │
│                                      ┌────────────────────┘              │
│                                      │ ✅ 未去重                         │
│                                      ▼                                   │
│  Phase 2: 推送队列 ──────────────────────────────────────────────────   │
│                                      │                                   │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │ 优先级排序        │    │ 限频控制          │                           │
│  │ IC绝对值排序      │───→│ 100条/秒上限       │                           │
│  │ 同一个用户≤3条/min│    │ Token Bucket      │                           │
│  └──────────────────┘    └────────┬─────────┘                           │
│                                   │                                      │
│  Phase 3: 计费 (计费管线 — 本节) ────────────────────────────────────   │
│                                   │                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ 扣费0.5U          │    │ 审计日志          │    │ 余额不足→跳过     │   │
│  │ attemptAccess(#26)│───→│ writeAudit        │───→│ 不下发通知        │   │
│  │ touchpoint=       │    │ {signal,user,     │    │ 不占推送配额      │   │
│  │ AI_SIGNAL_PUSH    │    │  factorId,amount} │    │                  │   │
│  └────────┬─────────┘    └──────────────────┘    └──────────────────┘   │
│           │ ✅ 扣费成功                                                  │
│           ▼                                                              │
│  Phase 4: 通知 (SignalPushPopup — ML) ───────────────────────────────   │
│           │                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │ 实时弹窗          │    │ 一键下单按钮      │                           │
│  │ "TSLA动量因子亮红灯"│───→│ "立即跟单→"      │                           │
│  │ 0.5U标签          │    │ 显示执行服务费    │                           │
│  └──────────────────┘    └────────┬─────────┘                           │
│                                   │                                      │
│  Phase 5: 执行 ──────────────────────────────────────────────────────  │
│                                   │                                      │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ 一键下单          │    │ 执行费预估        │    │ 发送交易所订单     │   │
│  │ 解析信号          │───→│ estimateFee()     │───→│ via API Key       │   │
│  │ 构造订单参数      │    │ 股票0.1%min2U等   │    │ 成交→扣执行费     │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘   │
│                                                                          │
│  总计费用: 信号0.5U (推送) + 执行服务费 (下单) = 用户总支出              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、触发阶段: 因子IC阈值模型

### 2.1 触发条件 (3种)

| 触发类型 | 条件 | 优先级 | 示例 |
|---------|------|:-----:|------|
| **强信号** | 最新IC > 0.05 | 🔴 高 | MOMENTUM_12M 在 NVDA 上 IC=0.07 → 触发 |
| **逆转信号** | IC方向切换>2σ | 🔴 高 | 连续5天IC<0 → 今天IC>+0.03 → 触发 |
| **衰退预警** | IC衰减率>1σ | 🟡 中 | 30天前IC=0.06 → 今天IC=0.01 → "动量在减弱" |

### 2.2 去重规则

```
Key = SHA256("signal:" + factorId + ":" + symbol + ":" + triggerType)
TTL = 1小时

示例:
  "signal:MOMENTUM_12M:NVDA:strong"  → 08:00触发推送 → 写入去重表
  "signal:MOMENTUM_12M:NVDA:strong"  → 08:30再次触发 → 命中去重表 → 跳过
  "signal:MOMENTUM_12M:NVDA:strong"  → 09:01 TTL过期 → 再次触发 → 推送
```

### 2.3 限频控制

```typescript
// Token Bucket: 100条/秒全局上限
const GLOBAL_RATE_LIMIT = 100; // tokens per second
const PER_USER_LIMIT = 3;      // max signals per user per minute

// 超出时的行为:
// - 全局超限 → 入延迟队列 (FIFO, 最多缓存60秒)
// - 用户超限 → 聚合为1条 "你有3条新信号, 0.5U查看全部"
```

---

## 三、计费阶段: 0.5U 推送计费

### 3.1 计费模型

| 属性 | 值 |
|------|-----|
| Touchpoint ID | #26 `AI_SIGNAL_PUSH` |
| 单价 | **0.5U** (50 USDT cents) |
| 扣费模式 | 推送前扣 (静默,不弹窗) |
| 退费条件 | 推送失败 (网络断开/客户端离线) |
| 不退费条件 | 推送成功 (即使用户不看) |
| 免费额度 | 0条 |
| 幂等键 | `SHA256("signal_push:" + signalId)` |

### 3.2 扣费时序

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│ Signal  │────→│ Billing      │────→│ Push         │────→│ Client   │
│ Trigger │     │ Gateway      │     │ Service      │     │ Popup    │
└─────────┘     └──────────────┘     └─────────────┘     └──────────┘
                     │                      │
                     │ attemptAccess(#26)   │
                     │ amount: 50 cents     │
                     │                      │
                ┌────▼────┐                 │
                │ Success? │──No──→ 跳过推送 │
                └────┬────┘    不扣费不通知  │
                     │Yes                   │
                     ▼                      │
                ┌──────────┐                │
                │ hold 50  │                │
                │ cents    │                │
                └────┬─────┘                │
                     │──────────────────────┘
                     │        推送成功
                     ▼
                ┌──────────┐
                │ settle() │
                │ 写审计日志│
                └──────────┘
```

### 3.3 计费API

```typescript
// 1. 发起扣费
const billing = await factorBillingGateway.attemptAccess(
  userId,
  BillingTouchpoint.AI_SIGNAL_PUSH,
  { signalId, factorId, symbol, triggerType, icValue }
);
// → { sessionId, granted: true, costUSDT: 0.5 }

// 2. 推送成功后结算
await factorBillingGateway.settle(sessionId, {
  pushChannel: 'ws',        // websocket push
  pushSuccess: true,
  deliveredAt: new Date(),
});

// 3. 推送失败退费
await factorBillingGateway.refund(sessionId, {
  reason: 'PUSH_FAILED',
  detail: 'client_offline | ws_disconnect | timeout_10s',
});

// 4. 余额不足跳过
if (!billing.granted) {
  // 不入推送队列，不扣费，不通知
  // 记录: skip_reason=INSUFFICIENT_BALANCE
}
```

---

## 四、通知阶段: 弹窗→一键下单

### 4.1 弹窗数据结构

```typescript
interface SignalPushNotification {
  signalId: string;
  factorId: string;          // "MOMENTUM_12M"
  factorName: string;        // "12月价格动量"
  symbol: string;            // "NVDA"
  assetClass: AssetClass;    // STOCK | FUTURES | OPTIONS | CRYPTO_SPOT | CRYPTO_PERP
  triggerType: 'strong' | 'reversal' | 'decay';
  icValue: number;           // 0.07
  direction: 'bullish' | 'bearish';
  signalLight: 'green' | 'red' | 'yellow';
  
  // 下单建议
  suggestedAction: 'buy' | 'sell';
  suggestedQty?: number;     // 基于凯利公式仓位建议
  confidence: number;        // 0-1, 基于IC*信号强度
  
  // 费用
  signalCost: 0.5;           // 本次信号已扣
  estimatedExecFee: number;  // 预估执行服务费 (基于建议仓位)
  
  // UI
  humanSummary: string;      // "NVDA 12月动量 IC=0.07 🔥 强烈看涨"
  detailUrl: string;         // 因子详情页链接
}
```

### 4.2 一键下单集成

```
用户点击"立即跟单→"
    │
    ├─ 1. 解析信号 → 构造订单参数
    │    { symbol: "NVDA", side: "buy", qty: 10,
    │      orderType: "limit", price: markPrice * 1.002 }
    │
    ├─ 2. 执行费预估 (ExecutionFeeEngine)
    │    assetClass = STOCK → rate = 0.1%, minFee = 200 cents
    │    orderValue = $5,000 → estimatedFee = MAX(5000*0.001, 200) = 500 cents = 5U
    │    显示: "执行服务费: ~5积分"
    │
    ├─ 3. 确认弹窗
    │    "NVDA 买入 10股 @ ~$500 | 信号费 0.5U(已扣) + 执行费 ~5U"
    │    [确认下单] [取消]
    │
    └─ 4. 确认后 → executionFeeEngine.attemptAccess()
         → 发送订单到交易所 → 成交 → settle() / 撤单 → refund()
```

---

## 五、每日简报管线 (DailyBriefingEngine)

### 5.1 管线概览

```
┌───────────────────────────────────────────────────────────────┐
│  DailyBriefingEngine (JVS) — 每日触发一次                      │
│                                                                 │
│  每日 09:00 (市场开盘前)                                        │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────────────┐                                          │
│  │ 1. 全因子IC计算   │  298因子×全市场×昨日数据                  │
│  │    computeAllIC() │                                          │
│  └────────┬─────────┘                                          │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ 2. Top5 排序      │  IC绝对值排名                             │
│  │    选最强5个      │  + 异常检测 (IC单日变化>2σ)               │
│  └────────┬─────────┘                                          │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ 3. 扣费1U         │  attemptAccess(AI_DAILY_BRIEFING)        │
│  │   静默扣款        │  每日自动扣                              │
│  └────────┬─────────┘                                          │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ 4. DeepSeek生成   │  将Top5+异常数据输入DeepSeek              │
│  │    市场解读       │  生成: 市场情绪+板块轮动+风险提示          │
│  └────────┬─────────┘                                          │
│           ▼                                                     │
│  ┌──────────────────┐                                          │
│  │ 5. 推送BriefingCard│  settle() → 推送到订阅用户              │
│  │    DailyBriefing  │  未订阅用户: 预览Top5免费, 全文1U          │
│  └──────────────────┘                                          │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 简报数据结构

```typescript
interface DailyBriefing {
  date: string;                    // "2026-06-16"
  generatedAt: string;             // ISO timestamp
  
  topFactors: Array<{
    rank: number;                  // 1-5
    factorId: string;
    factorName: string;
    icValue: number;
    icChange: number;              // 较昨日变化
    market: string;                // "US" | "HK" | "Crypto" | ...
    direction: 'bullish' | 'bearish';
    signalLight: string;           // 🟢🟡🔴
  }>;
  
  anomalies: Array<{
    factorId: string;
    factorName: string;
    anomalyType: 'ic_spike' | 'momentum_crash' | 'volatility_surge';
    severity: 'warning' | 'alert';
    description: string;
  }>;
  
  aiCommentary: {
    marketSentiment: string;       // AI生成: 市场情绪概述
    sectorRotation: string;        // AI生成: 板块轮动观察
    riskAlert: string;             // AI生成: 当日风险提示
    strategyTip: string;           // AI生成: 当日策略建议
  };
  
  billing: {
    costUSDT: 1.0;
    touchpointId: 24;              // AI_DAILY_BRIEFING
    subscriptionAvailable: true;   // 是否支持自动订阅
    trialAvailable: false;         // 无免费试用
  };
}
```

### 5.3 订阅模式 vs 按次模式

```
┌──────────────────────────────────────────────────────┐
│  订阅模式 (自动扣费)                                   │
│                                                       │
│  用户开启订阅 → 每日09:00自动扣1U → 推送简报          │
│  余额不足 → 跳过当日 → 次日重试                        │
│  取消订阅 → 立即停止 (不退当日已扣)                    │
│                                                       │
│  按次模式 (手动触发)                                   │
│                                                       │
│  用户点击"今日简报" → 扣1U → 生成+推送                 │
│  当日已订阅用户 → 不再额外扣费 (幂等: date+userId)     │
└──────────────────────────────────────────────────────┘
```

---

## 六、管线集成契约

### 6.1 模块间接口

```
SignalPushEngine (JVS)          ←→  FactorBillingGateway (计费)
        │                                    │
        │ 触发信号                           │ attemptAccess(#26, 0.5U)
        │ signalId, factorId, symbol         │ settle/refund
        │                                    │
        ▼                                    ▼
   PushQueue (IPC)                AuditLedger (审计)
        │                                    │
        │ websocket push                    │ writeAudit
        ▼                                    ▼
SignalPushPopup (ML)           SQLite: audit_billing_entries
        │
        │ 用户点击"立即跟单→"
        ▼
ExecutionFeeEngine (执行费)
        │
        │ attemptAccess(#23, variable)
        ▼
   Exchange Order
```

### 6.2 数据流向总表

| 阶段 | 引擎 | 输入 | 输出 | 费用 |
|------|------|------|------|:----:|
| 1.触发 | SignalPushEngine | 因子IC实时数据 | 触发信号列表 | — |
| 2.去重 | DedupCache | signalId | passthrough/drop | — |
| 3.限频 | RateLimiter | 信号队列 | 限频后队列 | — |
| 4.**计费** | FactorBillingGateway | userId + signalId | sessionId + hold | **0.5U** |
| 5.推送 | WSPushService | notification | 客户端弹窗 | — |
| 6.通知 | SignalPushPopup | SignalPushNotification | UI渲染 | — |
| 7.**下单** | ExecutionFeeEngine | order params | 交易所订单 | **可变** |
| 8.**执行费** | FactorBillingGateway | fill report | settle/refund | **可变** |

---

## 七、错误处理与降级

### 7.1 各阶段故障处理

| 阶段 | 故障 | 处理 | 用户感知 |
|------|------|------|---------|
| 触发 | IC计算超时 | 跳过该因子,继续下一个 | 无 |
| 去重 | Redis/SQLite不可用 | 内存LRU降级 (1000条) | 可能重复推送(低概率) |
| 限频 | Token Bucket耗尽 | FIFO延迟队列 (60s) | 延迟数秒收到 |
| **计费** | 扣费失败 | 跳过后序,不推送 | 无通知 (余额不足未知) |
| 推送 | WS断开 | 重试3次,间隔1s | 可能收不到 |
| 通知 | 客户端崩溃 | 下次重连时补推 (最多3条) | 延迟收到 |
| **下单** | 执行费扣除失败 | 不下单,保留信号 | "余额不足"弹窗 |
| 下单 | 交易所拒绝 | 退执行费,不退信号费 | 信号费0.5U已消费 |

### 7.2 降级链 (推送专用)

```
信号推送的DeepSeek调用:
  V4Pro折 → V4Flash → MiniMax-M3 (推送只用3层,pro原价跳过)
  
理由: 推送场景不需要pro原价的token质量,Flash已足够生成一句话信号描述
```

---

## 八、计费总结

| 费项 | 触发点 | 单价 | 退费条件 | 计费方 |
|------|--------|:----:|---------|--------|
| 信号推送 | 因子IC突破阈值 | **0.5U** | 推送失败 | autoclaw管线 |
| 每日简报 | 每日09:00 / 手动 | **1U** | 生成失败 | autoclaw管线 |
| 执行服务费 | 一键下单 | **0.02-0.1%** | 撤单/拒绝 | ExecutionFeeEngine |

**用户一句话**: "花0.5U收到信号, 花0.1%跟单 — 信号费是信息费, 执行费是服务费。"

---

> **维护**: 与 `server/services/ai-billing.ts` + `electron/engine/factors/factor-billing-gateway.ts` 同步。
> **下一版**: R203→R207 逐步新增剩余 AI 触点 (#25 套利扫描 / #27 压力测试 / #28 持仓归因)。
