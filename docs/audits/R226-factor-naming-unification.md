# R226 因子命名统一映射表

**生成时间**: 2026-06-15T22:49:11.263Z
**总因子数**: 240
**命名一致**: 233
**命名不一致**: 7

## 命名警告

| 因子ID | 中文名 | 警告数 | 详情 |
|--------|--------|--------|------|
| CASH_FLOW_YIELD | 自由现金流收益率 | 2 | Inconsistent: "CASHFLOW_YIELD" in electron/engine/factors/yellow-factor-calculators.ts — should be "CASH_FLOW_YIELD"; Inconsistent: "CASHFLOW_YIELD" in src/components/factor/FactorOnboardingWizard.tsx — should be "CASH_FLOW_YIELD" |
| MA_20_60 | 均线交叉 | 1 | Inconsistent: "MA2060" in electron/engine/factors/factor-id-registry.ts — should be "MA_20_60" |
| EMA_12_26 | MACD | 1 | Inconsistent: "EMA1226" in electron/engine/factors/factor-id-registry.ts — should be "EMA_12_26" |
| RSI_14 | 相对强弱 | 3 | Inconsistent: "RSI14" in electron/engine/factors/factor-id-registry.ts — should be "RSI_14"; Inconsistent: "RSI14" in src/hooks/useIndicatorWorker.ts — should be "RSI_14"; Inconsistent: "RSI14" in src/lib/chart/indicator-worker-bridge.ts — should be "RSI_14" |
| ATR_14 | 真实波幅 | 1 | Inconsistent: "ATR14" in electron/engine/factors/factor-id-registry.ts — should be "ATR_14" |
| OBV | 能量潮 | 1 | Inconsistent: "OBV_" in electron/engine/factors/factor-compatibility-engine.ts — should be "OBV" |
| CRYPTO_HASH_RATE | 哈希率 | 1 | Inconsistent: "CRYPTO_HASHRATE" in electron/engine/factors/market-yellow-calculators.ts — should be "CRYPTO_HASH_RATE" |

## i18n Key规范

所有因子的i18n key遵循统一格式:
```
factor.{canonicalId_lowercase}.name   // 因子名称
factor.{canonicalId_lowercase}.desc   // 因子描述
factor.{canonicalId_lowercase}.stub   // 数据不可用提示
```

## DB Column规范

所有因子的数据库列名遵循统一格式:
```
factor_{canonicalId_lowercase}
```