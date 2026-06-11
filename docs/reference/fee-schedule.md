# Dawn Whales 费率体系文档

> 版本: v1.11.0 | 发布日期: 2026-06-12 | 维护: QClaw (文档虾)
> 本文档来源于项目实际代码: `electron/engine/analysis/auto-trade-billing-v2.ts`, `electron/engine/agents/ai-usage-billing-contract.ts`, `electron/engine/portfolio/p2p-transfer-engine.ts`, `electron/engine/portfolio/usdt-topup-gateway.ts`, `electron/engine/data/currency-converter.ts`, `electron/engine/data/number-precision.ts`

---

## 一、费率总表 (USDT 积分)

Dawn Whales 采用 **USDT 积分** 作为唯一结算货币。用户本地券商交易使用券商货币 (HKD/CNY/USD)，交易完成后按成交额×汇率折算为 USDT 积分扣除手续费。

| # | 场景 | 费率 | USDT 精度 | 收取方 | 说明 |
|---|------|------|-----------|--------|------|
| 1 | **交易 Taker** (市价单) | **0.1%** (0.001) | 6 位小数 | 平台 100% | 自动交易市价成交 |
| 2 | **交易 Maker** (限价单) | **0.02%** (0.0002) | 6 位小数 | 平台 100% | 自动交易限价成交 |
| 3 | **交易 Stop** (止损单) | **0.04%** (0.0004) | 6 位小数 | 平台 100% | 止损触发成交 |
| 4 | **P2P 转账 (发送方)** | **0.3%** (0.003) | 6 位小数 | 平台 100% | 发送方扣除 |
| 5 | **P2P 转账 (接收方)** | **0.3%** (0.003) | 6 位小数 | 平台 100% | 接收方扣除 |
| 6 | **USDT 提现** | **0.1%** (0.001) | 6 位小数 | 平台 100% | TRC-20 提现手续费 |
| 7 | **USDT 充值 (TRC-20)** | **免费** (0%) | — | — | 平台承担 gas fee |
| 8 | **内部转账** | **免费** (0%) | — | — | 创作者之间直接转账 |

---

## 二、AI 分析计费 (按次付费)

| 等级 | Agent 数 | 基础价格 | 辩论附加费 | 竞技场倍数 | 每月上限 |
|------|----------|----------|-----------|-----------|---------|
| **Standard** | 2 Agent | **1.0 USDT** | +0.5 USDT/轮 | × 0.3 | 5 / 10 / 50 / 100 |
| **Premium** | 3 Agent | **1.5 USDT** | +0.5 USDT/轮 | × 0.3 | 5 / 10 / 50 / 100 |
| **Flagship** | 4 Agent | **2.0 USDT** | +0.5 USDT/轮 | × 0.3 | 5 / 10 / 50 / 100 |

**费率公式**:
```
Standard:  1.0 + (debateRounds × 0.5) + (arenaModels × 0.3)
Premium:   1.5 + (debateRounds × 0.5) + (arenaModels × 0.3)
Flagship:  2.0 + (debateRounds × 0.5) + (arenaModels × 0.3)
```

**计费流程**: 会话开始 → 冻结余额 (hold) → AI 分析完成 → 结算扣除 (settle) → 失败则退款 (refund)

**新用户优惠**: 新创作者前 3 次 AI 分析免费 (`freeAnalysesRemaining: 3`)

**每月消费上限选项**: 5 / 10 / 50 / 100 USDT (用户可在 Settings 调整)

---

## 三、信号订阅 / 策略市场

| 等级 | 订阅费 (月) | 创作者收入 | 平台抽成 |
|------|-----------|-----------|---------|
| **L1 初级** | 5 USDT | 95% (4.75) | 5% (0.25) |
| **L2 中级** | 20 USDT | 90% (18.00) | 10% (2.00) |
| **L3 高级** | 50 USDT | 70% (35.00) | 30% (15.00) |

**跟单收益**: 跟单用户盈利的 10% → 信号创作者

**回测服务** (基础免费):
- SMA/EMA/MACD/RSI/布林带: 免费 (0 USDT)
- 参数网格搜索: 免费
- Walk-Forward 分析: 免费
- Monte Carlo 模拟: 免费

---

## 四、扣费时机详解

### 4.1 自动交易扣费

```
下单 → 检查余额 (≥估算手续费) → 挂单 → 等待成交
  │
  ├─ 成交 → 计算实际手续费 = 成交额 × 费率 × 汇率 → 扣除 USDT 积分 → 成交
  └─ 未成交/撤单 → 不扣费
```

**关键规则**:
- **下单时**: 仅验证余额 (≥ fee + commission)，不实际扣费
- **成交时**: 按实际成交价×数量计算 `tradeValue`，乘以费率，实时扣 USDT 积分
- **撤单时**: 不扣任何费用
- **部分成交**: 按实际成交部分算费，未成交部分不扣费

### 4.2 AI 分析扣费

```
请求 AI 分析 → hold 余额 → AI 执行 → 
  ├─ 成功 → settle (实际扣除)
  └─ 失败/超时 → refund (全额退款)
```

### 4.3 P2P 转账扣费

```
发送方发起 → 扣除 amount + fee (发送方) → 冻结 14 天 → 
  ├─ 自动释放 → 接收方收到 amount - fee (接收方)
  ├─ 买方取消 → 退款 (amount + senderFee) 到发送方
  └─ 申诉 → 管理员裁决
```

### 4.4 USDT 提现扣费

```
发起提现 → 验证余额 → 扣除 amount + 0.1% fee → 排队处理 → TRC-20 转账
```

**P2P 限制**:
- 冻结期: **14 天**
- 单日上限: 0 (无限制，默认)
- 单笔上限: 0 (无限制，默认)
- 新账户限额: **≤500 USDT** (前 7 天)
- 大额告警: **>1000 USDT** 触发通知

---

## 五、汇率体系

### 5.1 汇率来源与降级链

```
CoinGecko API (优先) → Binance ticker (fallback 1) → 静态汇率 (fallback 2)
  https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=hkd,cny,usd,jpy,eur,gbp
```

| 层级 | 来源 | 刷新频率 | 缓存 TTL | Stale 阈值 |
|------|------|----------|---------|-----------|
| L1 | CoinGecko API | 按需+60s缓存 | 60 秒 | >5 min → WARN |
| L2 | Binance Ticker | 降级触发 | 60 秒 | >5 min → WARN |
| L3 | 静态汇率 | 手动更新 | 无期限 | 降级使用 → INFO |

### 5.2 静态汇率 (USD Base, 2024-06)

| 货币 | 代码 | 汇率 (1 USD =) | 精度 |
|------|------|---------------|------|
| 美元 | USD | 1.0000 | 2 位 |
| 人民币 | CNY | 7.2400 | 2 位 |
| 港币 | HKD | 7.8200 | 2 位 |
| 日元 | JPY | 155.6000 | 0 位 |
| 欧元 | EUR | 0.9200 | 2 位 |
| 韩元 | KRW | 1365.0000 | 0 位 |
| 英镑 | GBP | 0.7860 | 2 位 |

### 5.3 汇率精度规范

每种货币有独立的精度规则 (`CURRENCY_PRECISION`):

```typescript
USD: 2, CNY: 2, HKD: 2, JPY: 0, EUR: 2, KRW: 0, GBP: 2
AUD: 2, CAD: 2, CHF: 2
```

**USDT 积分精度**: 始终保留 **6 位小数** (`Math.round(amount * 1000000) / 1000000`)

---

## 六、数字精度规范

### 6.1 市场价格精度

通过 `NumberPrecision.pricePrecision(market)` 查询:

| 市场 | 精度 | 示例 |
|------|------|------|
| US (美股) | 2 位 | $192.53 |
| CN (A股) | 2 位 | ¥7.24 |
| HK (港股) | 3 位 | HK$384.600 |
| JP (日股) | 0 位 | ¥38,500 |
| UK (英股) | 2 位 | £8.42 |
| EU (欧股) | 2 位 | €92.15 |
| CRYPTO (加密货币) | 8 位 | 0.00012483 BTC |

### 6.2 智能单位缩写

| 数值范围 | English | 简体中文 | 日本語 | 한국어 |
|----------|---------|---------|--------|--------|
| 1K+ | 1.5K | 1500 | 1500 | 1.5천 |
| 10K+ | 15K | 1.5万 | 1.5万 | 1.5만 |
| 1M+ | 1.5M | 150万 | 150万 | 150만 |
| 100M+ | 150M | 1.5亿 | 1.5億 | 1.5억 |
| 1B+ | 1.5B | 15亿 | 15億 | 15억 |
| 1T+ | 1.5T | 1.5兆 | 1.5兆 | 1.5조 |

---

## 七、积分审计日志

### 7.1 审计日志格式

所有 USDT 积分变动均记录为 `BalanceChangeLog`:

```typescript
{
  id: string                  // UUID
  userId: string              // 用户/创作者 ID
  changeAmount: number        // 变动金额 (正=增加, 负=减少)
  balanceAfter: number        // 变动后余额 (USDT)
  type: 'transfer_out'        // 操作类型
      | 'transfer_in'
      | 'fee_collect'
      | 'fee_platform'
  relatedTransferId: string   // 关联交易/转账 ID
  timestamp: string           // ISO-8601 UTC
}
```

### 7.2 可审计操作类型

`AuditAction` 中涉及积分的类型:

| Action | 触发条件 | 记录内容 |
|--------|---------|---------|
| `fee_collect` | 交易成交扣费 | tradeId + feeAmount + balanceBefore/After |
| `fee_platform` | 平台收入记录 | amount + source + timestamp |
| `transfer_out` | P2P 转账发送 | toUser + amount + fee + frozenUntil |
| `transfer_in` | P2P 转账接收 | fromUser + amount - fee |
| `withdraw` | USDT 提现 | amount + fee + txHash + address |

### 7.3 日志完整性保障

- **哈希链**: 每条日志包含前一条的 `prevHash`，防止篡改
- **不可删除**: 仅追加写入，无 DELETE 操作
- **查询性能**: `query()` < 100ms (SQLite 索引优化)

---

## 八、交易执行计费明细

每笔自动交易的完整费用结构 (`ExecutionBillingEntry`):

```typescript
{
  // 交易数据
  symbol: "00700", side: "buy", quantity: 100, fillPrice: 384.60,
  tradeValue: 38460.00,        // HKD

  // 券商费用 (经纪商收取)
  brokerCommission: 11.54,     // HKD (Futu 0.03%)
  exchangeFee: 1.93,            // HKD (港交所 0.005%)
  stampDuty: 38.46,             // HKD (印花税 0.1%)
  secFee: 1.00,                 // HKD (证监会 0.0027%)
  totalExecutionFee: 52.93,    // HKD

  // AI 费用 (USDT 积分)
  aiAnalysisCost: 1.5,          // USDT (AI分析)
  makerTakerFee: 4.92,          // USDT (taker 0.1% = 38460×0.001/7.82)
  totalAIFee: 6.42,             // USDT

  // 收入拆分
  creatorIncome: 0,             // 仅信号跟单有收入 (无信号=0)
  platformRevenue: 6.42,        // USDT (100%)
}
```

---

## 九、扣费场景决策树

```
用户操作
│
├─ 自动交易
│   ├─ 市价单 → Taker 0.1%
│   ├─ 限价单 → Maker 0.02%
│   └─ 止损单 → Stop 0.04%
│
├─ AI 分析
│   ├─ Standard (2 Agent) → 1.0 USDT
│   ├─ Premium (3 Agent) → 1.5 USDT
│   ├─ Flagship (4 Agent) → 2.0 USDT
│   ├─ 辩论 → +0.5 USDT/轮
│   ├─ 竞技场 → +0.3×模型数
│   └─ 新用户首3次 → 免费
│
├─ P2P 转账
│   ├─ 发送 → 扣除 amount + 0.3% fee → 14天冻结
│   ├─ 接收 → 收到 amount - 0.3% fee
│   ├─ 买方取消 → 全额退款 (amount + senderFee)
│   └─ 申诉 → 管理员裁决
│
├─ USDT 充值
│   ├─ TRC-20 → 免费 (0%)
│   └─ 内部转账 → 免费 (0%)
│
└─ USDT 提现 → 0.1% fee
```

---

## 十、费率变更历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.3.0-alpha (R59) | 2026-06-09 | 初版: 3档 AI 定价 (1.0/1.5/2.0) + 辩论附加 + 竞技场倍数 |
| v1.3.0 GA (R60) | 2026-06-09 | 加入自动交易 taker/maker 费率 (0.1%/0.02%)，平台 100% |
| v1.5.0-alpha (R62) | 2026-06-09 | 加入 P2P 转账 0.3%×2 (双向)，14天冻结 |
| v1.6.0-beta (R65) | 2026-06-09 | 免费下载 + USDT 积分模型修正 (删除激活码，锁定免费+USDT) |
| v1.6.0-rc (R66) | 2026-06-09 | 加入信号订阅 L1/L2/L3 (5/20/50) + 创作者分成 (95/90/70%) |
| v1.11.0 (R98-R101) | 2026-06-12 | CurrencyConverter + NumberPrecision 精度统一 + 汇率降级链 |

### 废弃/已删除规则

| 规则 | 删除版本 | 说明 |
|------|---------|------|
| 许可证激活码 | v1.6.0-beta | R65 永久删除，改为免费下载+USDT积分 |
| Stripe/信用卡支付 | v1.3.0-alpha | R59 永久禁止，仅 USDT |
| 试用期 | v1.6.0-beta | R65 删除，改为免费基础功能 |
| 到期锁定 | v1.6.0-beta | R65 删除，改为余额不足限制 |

---

## 十一、开发参考

### 11.1 费率常量定义位置

| 常量 | 文件 | 变量 |
|------|------|------|
| 自动交易费率 | `electron/engine/analysis/auto-trade-billing-v2.ts` | `FEE_SCHEDULE` |
| AI 定价表 | `electron/engine/agents/ai-usage-billing-contract.ts` | Tier pricing |
| P2P 费率 | `electron/engine/portfolio/p2p-transfer-engine.ts` | `DEFAULT_P2P_CONFIG` (feeRate: 0.003) |
| USDT 精度 | `electron/engine/analysis/auto-trade-billing-v2.ts` | `roundUSDT()` → `Math.round(amount * 10000) / 10000` |
| 货币精度 | `electron/engine/data/currency-converter.ts` | `CURRENCY_PRECISION` (2/2/2/0/2/0/2) |
| 静态汇率 | `electron/engine/data/currency-converter.ts` | `STATIC_RATES` (10 currencies) |
| 数字精度 | `electron/engine/data/number-precision.ts` | `pricePrecision(market)` |
| 平台抽成 | `electron/engine/analysis/auto-trade-billing-v2.ts` | `FEE_SCHEDULE.platformShare` (1.0 = 100%) |

### 11.2 测试覆盖

| 测试文件 | 覆盖范围 |
|----------|----------|
| `tests/auto-trade-billing-v2.test.ts` | 3 种订单类型费率, USDT 精度, 余额预检 |
| `tests/ai-usage-billing-contract.test.ts` | 3 档定价, 辩论附加, hold/settle/refund 流程 |
| `tests/p2p-transfer-engine.test.ts` | 双向费率, 14天冻结, 买方取消, 新账户限额 |
| `tests/currency-converter.test.ts` | 10 货币汇率, 缓存刷新, 降级切换 (26 tests) |
| `tests/number-precision.test.ts` | 7 市场精度, formatMoney, smartUnit (68 tests) |

---

## 十二、常见问题 (FAQ)

**Q: 为什么 USDT 用 6 位小数而券商货币用 2-3 位？**
A: USDT 积分是内部计费单位，不涉及法币监管。6 位精度确保大额小额计费都精确（如 0.000001 USDT ≈ 极小金额）。券商货币精度由交易所规则决定。

**Q: 汇率不实时更新怎么办？**
A: `CurrencyConverter` 有 3 层降级链: CoinGecko (L1) → Binance (L2) → 静态汇率 (L3)。静态汇率手动维护，确保离线可用。L1/L2 缓存 60s，超 5min 不刷新触发 WARN 告警。

**Q: 费率会变更吗？如何通知？**
A: 费率变更需 PM 广播 + CHANGELOG 记录 + 本文档同步更新。变更前需 Owner 审批。无公开承诺保持当前费率不变。

**Q: 新用户前 3 次免费分析包含辩论/竞技场吗？**
A: 仅包含基础分析价格（1.0/1.5/2.0），辩论 (+0.5/轮) 和竞技场 (+0.3×模型) 需额外 USDT 余额。

**Q: P2P 转账能加速释放吗？**
A: 不能。14 天冻结期是系统规则。仅买方主动取消（手动点击）可提前结束冻结并全额退还发送方。

**Q: 自动交易的手续费如何确保公平？**
A: 费率固定（taker 0.1%, maker 0.02%, stop 0.04%），`ExecutionBillingBridge` 在成交时自动计算。所有费用有哈希链审计日志，可追溯不可篡改。

---

## 十三、致谢与维护

本费率体系文档由 QClaw (文档虾) 维护，基于下列项目真实源文件撰写:
- `electron/engine/analysis/auto-trade-billing-v2.ts` (10,335 bytes)
- `electron/engine/agents/ai-usage-billing-contract.ts` (13,666 bytes)
- `electron/engine/portfolio/p2p-transfer-engine.ts` (p2p config + transfer logic)
- `electron/engine/portfolio/usdt-topup-gateway.ts` (8,849 bytes)
- `electron/engine/data/currency-converter.ts` (7,891 bytes)
- `electron/engine/data/number-precision.ts` (9,065 bytes)
- `electron/engine/analysis/execution-billing-bridge.ts` (8,524 bytes)
- `electron/engine/portfolio/audit-trail-engine.ts` (14,072 bytes)

**更新规则**: 费率变更时, 需同步更新 CHANGELOG.md + 本文档 + 对应引擎常量。

> ⌨️ 禁止撒谎, 禁止半途停下, 所有数据来自项目实际源文件。
