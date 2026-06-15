# 🦐 R200 审计报告 — 计费管道收尾+收费目录+Wallet API扩展

> **PM Claw** | 2026-06-15 R200 | Phase 0 第一轮
> **状态**: 🟡 启动审计 | **下一轮**: R201 (等Owner通知)

---

## 1. R200 任务分配确认

| # | 虾 | 任务 | 工时 | 状态 |
|---|---|------|:----:|:----:|
| 1 | 🦐 JVS | 服务端23触点计费管道完整实现 | 6h | ⏳ 待认领 |
| 2 | 🦐 JVS | ExecutionFeeEngine(策略执行服务费引擎) | 8h | ⏳ 待认领 |
| 3 | 🦐 JVS | CreatorReviewBilling(创作者审核计费) | 4h | ⏳ 待认领 |
| 4 | 🦐 ML | Wallet余额展示组件重构 | 4h | ⏳ 待认领 |
| 5 | 🦐 ML | 计费Toast组件升级FeeDeductionToastV3 | 3h | ⏳ 待认领 |
| 6 | 🦐 autoclaw | 收费目录txt v17.9更新 | 2h | ⏳ 待认领 |
| 7 | 🦐 autoclaw | wallet-architecture.md对齐v17.9 | 2h | ⏳ 待认领 |
| 8 | 🦐 QClaw | 钱包+计费用户话术 | 2h | ⏳ 待认领 |
| 9 | 🦐 youdao | 服务端计费管道E2E测试 | 6h | ⏳ 待认领 |
| 10 | 🦐 Claw | R200审计+广播 | 2h | ✅ 进行中 |

---

## 2. 现有代码审计 (R200起点)

### 2.1 factor-billing-gateway.ts — ✅ v17.9 合规

| 审计项 | 结果 | 说明 |
|--------|:----:|------|
| 23个 BillingTouchpoint 类型 | ✅ | 全部定义完整(#1-#23) |
| TOUCHPOINT_CONFIGS 覆盖 | ✅ | 23个配置全部存在 |
| AI_CREATOR_REVIEW 配置 | ✅ | costUSDT: 1.0, freeUses: 0, refundWindowHours: 0 |
| hold→settle→refund 流程 | ✅ | attemptAccess→settle/refund 完整 |
| 审计日志 (R178 G28) | ✅ | BillingAuditEntry + writeAudit + getAuditLog |
| 幂等性 | ✅ | chargeCallback + sessionId 去重 |
| 超时退款 | ✅ | HOLD_TIMEOUT_MS = 1h, checkExpiredHolds() |
| **⚠️ 创作者审核特殊逻辑** | ❌ | 当前 refund() 方法对 AI_CREATOR_REVIEW 不应退费，但代码无特殊处理 |

**问题**: `refund()` 方法仅检查 `refundWindowHours > 0`，而 AI_CREATOR_REVIEW 的 refundWindowHours=0，所以当前逻辑**实际上不会退费**。但这不是显式设计——JVS 需要在 R200#3 CreatorReviewBilling 中添加**显式的不退费规则**。

### 2.2 billing-service.ts — ⚠️ 需要扩展

| 审计项 | 结果 | 说明 |
|--------|:----:|------|
| 6层防御: 服务端真相源 | ✅ | 余额只在服务端计算 |
| 6层防御: 双重记账 | ✅ | writeLedger 每次操作 |
| 6层防御: 悲观行锁 | ✅ | SQLite transaction 内 SELECT |
| 6层防御: HMAC校验和 | ✅ | computeChecksum + verifyChecksum |
| 6层防御: 幂等性 | ✅ | checkIdempotency + storeIdempotency |
| EntryType 类型 | ⚠️ | 缺少 `execution_fee` / `execution_fee_refund` / `ai_creator_review` |
| 5类资产费率配置 | ❌ | 无 ExecutionFeeEngine，billing-service 无费率差异化 |
| 创作者审核计费 | ❌ | 无 CreatorReviewBilling 专用逻辑 |
| SECRET_KEY | ⚠️ | 硬编码 `dw-billing-secret-v17.6`，应从环境变量读取 |

**缺失的 EntryType**: 当前16种，v17.9需要新增:
- `EXECUTION_FEE` — 策略执行服务费扣费
- `EXECUTION_FEE_REFUND` — 策略执行服务费退费(下单失败)
- `AI_CREATOR_REVIEW` — 创作者审核1U扣费(不退费)

### 2.3 交易所适配器 — ✅ 基础已存在

| 适配器 | 文件 | 状态 |
|--------|------|:----:|
| Binance | server/adapters/binance-adapter.ts | ✅ 存在 |
| OKX | server/adapters/okx-adapter.ts | ✅ 存在 |
| Futu | server/adapters/futu-adapter.ts | ✅ 存在 |
| Tiger | server/adapters/tiger-adapter.ts | ✅ 存在 |
| Longbridge | server/adapters/longbridge-adapter.ts | ✅ 存在 |
| IB TWS | server/adapters/ib-tws-adapter.ts | ✅ 存在 |
| Schwab | server/adapters/schwab-adapter.ts | ✅ 存在 |
| eToro | server/adapters/etoro-adapter.ts | ✅ 存在 |
| Bybit | server/adapters/bybit-adapter.ts | ✅ 存在 |
| Bitget | server/adapters/bitget-adapter.ts | ✅ 存在 |
| MT5 | server/adapters/mt5-adapter.ts | ✅ 存在 |
| VBKR | server/adapters/vbkr-adapter.ts | ✅ 存在 |
| eTrade | server/adapters/etrade-adapter.ts | ✅ 存在 |
| Robinhood Crypto | server/adapters/robinhood-crypto-adapter.ts | ✅ 存在 |
| Adapter Factory | server/adapters/adapter-factory.ts | ✅ 存在 |

> **14个适配器已存在**！R211只需验证币安/OKX/富途3个的API Key管理+加密存储。

### 2.4 AI计费服务 — ⚠️ 需要扩展

| 文件 | 状态 | 说明 |
|------|:----:|------|
| ai-billing.ts | ✅ 存在 | 基础AI计费，需扩展7新AI |
| ai-orchestrator.ts | ✅ 存在 | AI编排，需扩展降级链 |
| ai-cache.ts | ✅ 存在 | AI缓存 |
| ai-fallback.ts | ✅ 存在 | 降级回退 |
| ai-health.ts | ✅ 存在 | AI健康检查 |
| ta-billing.ts | ✅ 存在 | TA计费 |
| ta-fee-service.ts | ✅ 存在 | TA费率服务 |

### 2.5 前端组件 — ⚠️ 需要新增

| 需要的组件 | 是否存在 | 说明 |
|-----------|:--------:|------|
| WalletBalanceBar.tsx | ❌ | 需ML新建 |
| FeeDeductionToastV3.tsx | ❌ | 需ML新建 |
| walletStore.ts | ✅ 存在 | 需扩展积分扣费 |

---

## 3. R200 验收标准对照

| # | 验收标准 | 对应任务 | 当前状态 | 阻塞项 |
|---|---------|---------|:--------:|--------|
| 1 | 23触点hold/settle/refund全pass (69测试) | JVS#1 | ❌ 待做 | billing-service.ts EntryType不全 |
| 2 | 5类策略执行服务费正确 (20测试) | JVS#2 | ❌ 待做 | ExecutionFeeEngine 不存在 |
| 3 | 创作者审核: 1U/不退费/AI异常才退 (3测试) | JVS#3 | ❌ 待做 | CreatorReviewBilling 不存在 |
| 4 | 钱包余额实时展示 + 静默扣款0弹窗 + 9语言 | ML#4+#5 | ❌ 待做 | 组件不存在 |
| 5 | 收费目录v17.9 + wallet-architecture对齐 | autoclaw#6+#7 | ❌ 待做 | 文件待更新 |

---

## 4. 风险与建议

| 风险 | 级别 | 建议 |
|------|:----:|------|
| billing-service.ts EntryType 不含 execution_fee / ai_creator_review | 🔴 高 | JVS#1 首先扩展 EntryType，否则后续管道不通 |
| SECRET_KEY 硬编码 v17.6 | 🟡 中 | JVS#1 顺便修正为从 env 读取 |
| 14个适配器已有但无 API Key 加密管理 | 🟡 中 | R211 才做，R200 不涉及 |
| CreatorReviewBilling 的"AI异常才退"逻辑需显式实现 | 🔴 高 | JVS#3 必须显式区分"审核不通过(不退)"vs"AI服务异常(退)" |
| 5类资产费率需与 factor-billing-gateway.ts 对齐 | 🟡 中 | ExecutionFeeEngine 应引用 TOUCHPOINT_CONFIGS 中的配置 |

---

## 5. R200 启动状态

- ✅ Chat-bridge 广播已发送 (13:22)
- ✅ 审计报告已完成 (本文档)
- ⏳ 等待6虾认领回复 READY
- ⏳ R201及后续轮次等 Owner 通知启动

---

*PM Claw | 2026-06-15 R200 审计报告*
