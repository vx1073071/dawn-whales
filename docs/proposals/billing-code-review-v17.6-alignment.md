# TradingEasy 盈利模型独立审查 — 代码与v17.6对齐 + 人类UX

> 审查人: youdao | 2026-06-13 10:09 HKT | 面向 PM

---

## 审查范围

- `electron/engine/analysis/auto-trade-billing-v2.ts` (286L) — 旧版交易扣费
- `electron/engine/data/fee-calculator.ts` (233L) — 旧版费率计算
- `electron/engine/data/trade-fee-hook.ts` (237L) — 旧版扣费hook
- `docs/reference/fee-schedule.md` — 旧版v15费率文档
- `docs/proposals/r132-q03-fee-points.md` — 跟单费文档
- PM v17.6 终版广播 (msg 7-11)

---

## 一、🔴 致命问题 — 代码与v17.6完全矛盾

### 1.1 fee-calculator.ts 的 CreatorTier 含义完全错误

**当前代码** (`electron/engine/data/fee-calculator.ts` L71-74):
```typescript
const FEE_RATES: Record<CreatorTier, number> = {
  L1: 0.001,   // 0.1%
  L2: 0.0002,  // 0.02%
  L3: 0.0004,  // 0.04%
};
```

**v17.6 规则**:
- 交易费率是 **资产类型** 决定（不是创作者等级）: 股票0.1% / 加密合约0.02%
- 创作者等级是 **市场抽成**（不是交易费率）: L1:30% / L2:20% / L3:10%

**人类影响**: 如果代码今天运行，L2 用户交易只收 0.02%（应为0.1%），L3 用户收 0.04%（应为0.1%）。收入严重缩水。

**建议**: 立即修复 `FEE_RATES` 为资产类型映射，移出 `CreatorTier`：
```typescript
const FEE_RATES: Record<string, { rate: number; min: number }> = {
  stock:          { rate: 0.001, min: 2 },
  futures:        { rate: 0.001, min: 2 },
  options:        { rate: 0.001, min: 2 },
  crypto_spot:    { rate: 0.001, min: 2 },
  crypto_contract:{ rate: 0.0002, min: 0.5 },
};
```

### 1.2 auto-trade-billing-v2.ts 费率表过时

**当前代码**:
```
taker: 0.1% / maker: 0.02% / stop: 0.04%
```

**v17.6 规则**: 不区分 taker/maker/stop。统一按资产类型，下单前扣费。

**人类影响**: maker 用户被多收（0.02% vs 0.1%），stop 用户被多收（0.04% vs 0.1%）。混乱。

### 1.3 缺少最低手续费 ($2 / $0.5)

**当前代码**: 无 `Math.max(fee, minFee)` 逻辑。$1,000 交易 → $1 手续费。

**v17.6 规则**: 股票/期货/期权/加密现货最低 2USDT，加密合约最低 0.5USDT。

**人类影响**: 小额交易手续费过低，$500 股票交易只收 $0.5，平台亏。

### 1.4 精度不一致: 4位 vs 6位

- `auto-trade-billing-v2.ts`: `USDT, 4 decimals`
- `fee-calculator.ts`: `6 decimal places`
- v17.6: USDT 精度统一 6 位小数

### 1.5 旧版文档未同步

`docs/reference/fee-schedule.md` 包含大量已废弃内容:
- 辩论模式 +0.5U/轮 ❌ (v17.6 已删除)
- AI 新用户免费 3 次 ❌ (v17.6 无免费)
- 信号订阅月费 L1 5U/L2 20U/L3 50U ❌ (v17.6 改为创作者市场 ≥9.9U)
- SaaS 相关所有规则 ❌

---

## 二、🟡 人类UX问题

### 2.1 下单前扣费 — 但用户不知道

**当前**: `trade-fee-hook.ts` 在 `onTradeComplete` 后扣费。

**v17.6**: "下单前扣费，余额不足拒绝，失败退费"。

**人类问题**: 用户看到下单成功 → 然后被拒绝（余额不足）。心理落差大。

**建议**: 下单前检查余额 → 不足时按钮灰掉 + 提示 "余额不足，需充值 X USDT"。

### 2.2 扣费静默 — 但用户想看到明细

**v17.6**: "静默扣款，不弹窗"。

**人类期望**: 不弹窗 ≠ 完全看不见。应有轻量反馈：
- 扣费成功 → 顶部轻提示 "已扣 2 USDT"（2秒消失）
- 失败退费 → 轻提示 "退费 2 USDT"
- 可点击查看历史 → 跳转交易明细

**当前**: 无任何前端反馈，用户钱少了都不知道怎么回事。

### 2.3 费率不可见

**人类期望**: 下单前看到 "预估手续费: $5.00 (0.1%)"

**当前**: 费率硬编码在引擎层，前端无展示。

**建议**: 统一 `FeePreview` 组件，所有下单入口 (策略/跟单/手动) 共用。

### 2.4 余额不足时的补救路径

**当前**: 余额不足 → 拒绝 → 用户不知道怎么办。

**人类期望**: "余额不足，还差 15 USDT" → 点击 "充值" 按钮 → 跳转充值页。

**建议**: 拒绝弹窗含精确差额 + 一键充值按钮。

### 2.5 冷热钱包对用户不可见

**人类期望**: 提现时看到 "本笔将通过热钱包自动处理" 或 "本笔将进入冷钱包审核队列（预计1-2小时）"。

**当前**: 用户不知道提现进度。

---

## 三、🟢 代码质量+架构

### 3.1 三套计费系统并存

| 系统 | 文件 | 状态 |
|------|------|------|
| v1 Billing | auto-trade-billing.ts (旧) | 未删除 |
| v2 Billing | auto-trade-billing-v2.ts | 运行中但费率过时 |
| v17.6 新系统 | server/services/billing-service.ts (待建) | 未实现 |

**建议**: 统一到 v17.6 billing-service，删除 v1。

### 3.2 无统一扣费管道

所有 AI/交易/转账/提现/订阅的扣费逻辑分散在不同文件中。

**v17.6 要求**: 统一扣费管道 `billAIService(userId, type, amount, idempotencyKey)`。

**建议**: 实现通用 `BillingPipeline`，所有扣费调用同一入口。

### 3.3 测试覆盖缺口

| 模块 | 测试文件 | 问题 |
|------|---------|------|
| auto-trade-billing-v2.ts | ❌ 无 | 核心扣费无测试 |
| trade-fee-hook.ts | ✅ 有 | 需更新为v17.6费率 |
| fee-calculator.ts | ✅ 有 | 费率值错误，测试会fail |

---

## 四、优先级排序

| 优先级 | 项目 | 预估 | 人类影响 |
|--------|------|------|---------|
| 🔴 P0 | fee-calculator.ts 费率修复 | 2h | 收费错误 |
| 🔴 P0 | 加最低手续费 floor | 1h | 小额交易亏损 |
| 🔴 P0 | 统一精度为6位 | 1h | 精度不一致 |
| 🟡 P1 | 下单前扣费 + 余额检查前置 | 3h | 用户心理落差 |
| 🟡 P1 | 轻量扣费反馈 (Toast) | 2h | 钱少了不知道 |
| 🟡 P1 | FeePreview 组件 | 2h | 费率不可见 |
| 🟡 P1 | 余额不足补救路径 | 1h | 用户卡住 |
| 🟡 P1 | 删除 auto-trade-billing-v1 | 0.5h | 代码整洁 |
| 🟢 P2 | 统一扣费管道 BillingPipeline | 4h | 架构统一 |
| 🟢 P2 | 冷热钱包状态提示 | 1h | 提现体验 |
| 🟢 P2 | 旧文档标注 [DEPRECATED] | 1h | 误导 |
| **总计** | | **18.5h** | |

---

## 五、给 PM 的建议

1. **P0 立即修复 (4h)**: 费率值 + 最低费 + 精度。这是钱的正确性，不能等。
2. **P1 尽快 (8.5h)**: 前置余额检查 + Toast反馈 + FeePreview + 补救路径。让用户"钱花得明白"。
3. **P2 架构 (6h)**: 统一扣费管道 + 旧代码清理。
4. **核心原则**: 用户每笔钱都要看到"扣了多少、为什么扣、还剩多少"——静默扣款 ≠ 不可见。

---

*审查完成: 2026-06-13 10:09 HKT | 审查人: youdao*
