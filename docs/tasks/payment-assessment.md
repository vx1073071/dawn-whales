# T-ML-WB-04: 支付模块 TODO 评估

> 日期: 2026-06-05 07:00 | 评估者: 主龙虾

## 当前状态

`src/lib/payment.ts` 存在但仅有骨架代码，4个 TODO 均未实现。

## TODO 评估

| # | TODO内容 | v0.7.0必需? | 优先级 | 负责人 |
|---|----------|:--:|:--:|------|
| 1 | Stripe 支付集成 | 否 | P2 (v0.8.0) | JVS |
| 2 | 微信支付集成 | 否 | P2 (v0.8.0) | JVS |
| 3 | 授权服务器 | 否 | P3 (v0.9.0) | — |
| 4 | 订阅管理 | 否 | P2 (v0.8.0) | JVS |

## 结论

**v0.7.0 无需任何支付功能。** 
- 当前版本为免费桌面应用
- 支付/SaaS 收费为 v0.8.0+ 计划
- 建议在 v0.7.0 中移除 payment.ts 以避免混淆

## 建议

```typescript
// @deferred v0.8.0 — Stripe/WeChat/Subscription
export async function initPayment() {
  // Payment integration deferred to v0.8.0
  return { enabled: false, reason: 'deferred to v0.8.0' };
}
```

