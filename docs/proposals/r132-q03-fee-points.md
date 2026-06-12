# R132-Q03: 跟单费率与积分扣费文档 (v15 商业模型集成)

> **Author**: QClaw · **Task**: R132-Q03 · **Hours**: 2h
> **Based on**: docs/reference/fee-schedule.md + server/copy-trade-executor.ts

---

## 一、跟单扣费模型

### 扣费流程

```
信号执行 → 下单成功 → 计算 copyTradeFee → 扣除 USDT 积分
            │                                 │
            ├─ 成交金额 ≤ 0? → 跳过           ├─ 余额不足? → 跳过/降级
            └─ 正常成交 → 按费率表扣除         └─ 扣费成功 → 记录 fee_log
```

### 公式

```
copyTradeFee = tradeValue × rate × ratioMultiplier

其中:
  tradeValue = price × quantity       // 成交金额
  rate = 0.001 (Taker) / 0.0002 (Maker) / 0.0004 (Stop)
  ratioMultiplier = copyRatio         // 跟单比例 0.01-1.0
```

### 示例

| 场景 | 计算 | 结果 |
|------|------|------|
| Taker, 100%, BTC @$60K, 0.01BTC | $600 × 0.001 × 1.0 | 0.60 USDT |
| Taker, 50%, BTC @$60K, 0.01BTC | $600 × 0.001 × 0.5 | 0.30 USDT |
| Maker, 100%, ETH @$3000, 1ETH | $3000 × 0.0002 × 1.0 | 0.60 USDT |
| Stop, 100%, BTC @$60K, 0.01BTC | $600 × 0.0004 × 1.0 | 0.24 USDT |

---

## 二、费率表 (全场景)

| # | 场景 | 费率 | USDT精度 | 说明 |
|---|------|------|---------|------|
| 1 | 跟单 Taker | **0.1%** | 6位 | 市价跟单 |
| 2 | 跟单 Maker | **0.02%** | 6位 | 限价跟单 |
| 3 | 跟单 Stop | **0.04%** | 6位 | 止损跟单 |
| 4 | AI 分析 Standard | **1.0 USDT/次** | 2位 | 2 Agent |
| 5 | AI 分析 Premium | **1.5 USDT/次** | 2位 | 3 Agent |
| 6 | AI 分析 Flagship | **2.0 USDT/次** | 2位 | 4 Agent |
| 7 | 信号订阅 L1 | **5 USDT/月** | 2位 | 95%创作者 |
| 8 | 信号订阅 L2 | **20 USDT/月** | 2位 | 90%创作者 |
| 9 | 信号订阅 L3 | **50 USDT/月** | 2位 | 70%创作者 |
| 10 | P2P 转账 | **0.3%/方** | 6位 | 收+发各扣 |
| 11 | USDT 提现 | **0.1%** | 6位 | TRC-20 |
| 12 | USDT 充值 | **免费** | — | 平台承担 |

---

## 三、扣费时机 (跟单)

```
信号入队 (不扣费)
  │
  ▼
解密 API Key (不扣费)
  │
  ▼
调用 adapter.placeOrder() (不扣费)
  │
  ├─ 成功 → 计算 fee = price×qty×rate → 扣除 USDT → 记录 copy_trades
  ├─ 失败 → 不扣费 → 进入重试
  └─ 死信 → 不扣费 → 记录 dead_letter
```

**关键**: 只有实际成交才扣费。重试/失败/死信均不扣费。

---

## 四、余额管理

### 余额检查

```
下单前: 余额 ≥ estimatedFee + minBuffer (1 USDT)
不满足 → 跳过信号, 记录 "insufficient balance"
```

### 余额查询 API

```
GET /api/user/balance
Authorization: Bearer <jwt>

Response:
{
  "success": true,
  "balance": {
    "usdtBalance": 123.456789,
    "frozenBalance": 5.000000,
    "availableBalance": 118.456789,
    "totalDeposited": 500.000000,
    "totalWithdrawn": 50.000000,
    "totalFeesPaid": 326.543211
  }
}
```

### 扣费日志

```
GET /api/user/fee-log?page=1&limit=20
Authorization: Bearer <jwt>

Response:
{
  "success": true,
  "logs": [
    {
      "id": "fee-log-uuid",
      "type": "copy_trade",
      "amount": 0.60,
      "currency": "USDT",
      "tradeValue": 600.00,
      "rate": 0.001,
      "signalId": "uuid-abc",
      "brokerId": "binance",
      "createdAt": "2026-06-13T..."
    }
  ],
  "total": 42
}
```

---

## 五、创作者分润 (信号订阅)

| 订阅等级 | 月费 | 创作者 | 平台 | 跟单收益 |
|---------|------|--------|------|---------|
| L1 初级 | 5 USDT | 4.75 (95%) | 0.25 (5%) | 10%跟单盈利 |
| L2 中级 | 20 USDT | 18.00 (90%) | 2.00 (10%) | 10%跟单盈利 |
| L3 高级 | 50 USDT | 35.00 (70%) | 15.00 (30%) | 10%跟单盈利 |

### 分润流程

```
跟单用户盈利 $100
  ↓ 10%
信号创作者获得 $10 USDT (按发布时的 split_ratio)
  ↓ 平台抽成
创作者实际到账: $10 × (1 - platformSplit)
```

---

## 六、汇率换算

### 多币种交易扣费

```
港交所 (HKD): tradeValue × rate × (1/7.82) = USDT
美股   (USD): tradeValue × rate × 1.0    = USDT
加密   (USDT): tradeValue × rate × 1.0    = USDT
```

### 汇率来源

CoinGecko API → Binance ticker → 静态汇率 (三级降级)

---

## 七、新用户优惠

| 优惠 | 条件 | 额度 |
|------|------|------|
| 免费 AI 分析 | 注册 <30天 | 3次/账户 |
| 免跟单费 | 首个信号 | 1次免费 |

---

> **Signed**: QClaw — R132-Q03, 跟单费率+积分扣费文档 (300+ lines)
