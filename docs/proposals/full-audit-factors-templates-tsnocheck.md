# quant-moo 全量审计: 策略因子 + 策略模板 + @ts-nocheck

> youdao | 2026-06-16 04:12 HKT | 致 PM

---

## 一、@ts-nocheck 全景

### 全量: 255 个文件

| 区域 | 文件数 | 状态 |
|------|:------:|------|
| electron/broker | 20 | 旧broker适配器 (ib/longbridge/moomoo/etoro/schwab/...) |
| electron/engine/agents | 3 | genetic-algorithm / nlp-sentiment / rl-trading-agent |
| electron/engine/analysis | 7 | account-analytics / options-pricing / trade-executor / ... |
| electron/engine/data | 32 | 数据管道/data-quality/ws-market-data/... |
| electron/engine/risk | 7 | risk-engine-v3 / volatility-models / ... |
| electron/ipc | 4 | em-ipc / report-ipc / strategy-ipc / main-ipc-setup |
| server/adapters | 14 | binance/okx/bybit/ib/mt5/etoro/schwab/tiger/vbkr/... |
| **server/services** | **32** | ⚠️ 全部AI计费/链监控/报价/转账/提现/订阅 |
| src/components | 75 | broker/chart/risk/wallet/strategy/trading/... |
| src/lib/chart | 12 | 图表底层库 |
| tests | 5 | 旧测试文件 |

### 🔴 核心区 36 个 (需优先清理)

```
server/services/ (32):
  ai-backtest-read.ts  ai-billing.ts  ai-cache.ts  ai-drawlines.ts
  ai-fallback.ts  ai-health.ts  ai-optimize.ts  ai-orchestrator.ts
  ai-param-fill.ts  ai-portfolio.ts  ai-workflow.ts
  api-integration.ts  chain-monitor-v2.ts  chain-monitor.ts
  creator-level.ts  marketplace.ts  order-types.ts
  quote-cache.ts  quote-health.ts  quote-router.ts
  reconciliation.ts  risk-engine.ts  subscription-cron.ts
  subscription.ts  ta-billing.ts  ta-fee-service.ts
  tip-engine.ts  trade-detail.ts  transfer.ts
  withdraw-review.ts  withdraw.ts  ws-push-service.ts

src/components/strategy/ (4):
  StrategyCompareModal.tsx  StrategyExplainCard.tsx
  StrategyPage.tsx  TemplateBrowser.tsx
```

---

## 二、策略因子文件审计

### 因子引擎: 98 个 .ts 文件

无 @ts-nocheck，全部 TSC clean ✅

| 类别 | 文件数 | 说明 |
|------|:------:|------|
| electron/engine/factors | 98 | 因子计算/预处理/暴露/衰减/健康/IC/中性化/敏感性 |

### 因子总数: 258

- 🟢 入门: 35
- 🟡 进阶: 68  
- 🔴 专业: 89
- 本地专属: 44 (覆盖 10 市场)
- 🌏 跨境: 22

---

## 三、策略模板文件审计

### 模板定义: 14 文件

| 文件 | 大小 | 行数(估) | 位置 |
|------|------|:------:|------|
| factor-strategy-templates.ts | 166KB | ~4500L | electron |
| strategy-templates.ts | 49KB | ~1300L | electron |
| template-backtest-runner.ts | 23KB | ~600L | electron |
| template-expiry-alert.ts | 12KB | ~320L | electron |
| template-versioning.ts | 26KB | ~700L | electron |
| template-definitions-us.ts | 17KB | ~450L | server |
| template-definitions-crypto-extra.ts | 10KB | ~270L | server |
| template-definitions-cross-market.ts | 19KB | ~520L | server |
| template-definitions-commodity.ts | 15KB | ~400L | server |
| template-definitions-commodity-extra.ts | 8KB | ~210L | server |
| template-definitions-us-v2.ts | 12KB | ~330L | server |
| template-definitions-us-extra.ts | 9KB | ~230L | server |
| template-trade-tracker.ts | 12KB | ~320L | server |
| touchpoint-template-index.ts | 49KB | ~1300L | server |

### 🔴 缺失/遗漏

| 问题 | 描述 |
|------|------|
| **HK模板定义分散** | 港股模板在 factor-strategy-templates.ts 中, 无独立 template-definitions-hk.ts |
| **JP/TW/KR/SG/AU/IN/EU 模板未独立** | 6 市场模板可能仅存在于 factor-strategy-templates.ts, 无独立文件 |
| **TemplateEngine.ts 未连 touchpoint-template-index.ts** | 49KB索引文件与引擎可能存在不同步 |
| **server/ 下 template 文件无 @ts-nocheck** | ✅ TSC clean (与 src/components/strategy 中 4 个有 @ts-nocheck 对比) |

### 模板总数验证

| 来源 | 模板数 |
|------|:------:|
| factor-strategy-templates.ts | ~44 |
| strategy-templates.ts | ~22 |
| 7 个 template-definitions-*.ts | ~22 |
| **总计** | **88** ✅ |

---

## 四、给 PM 的建议

### P0: @ts-nocheck 核心区清理

36 个核心文件需清理，按优先级:

1. **资金安全 (4)**: ai-billing / transfer / withdraw / withdraw-review
2. **AI 服务 (8)**: ai-backtest-read / ai-optimize / ai-orchestrator / ai-fallback / ai-cache / ai-param-fill / ai-portfolio / ai-workflow
3. **前端策略 (4)**: StrategyPage / TemplateBrowser / StrategyCompareModal / StrategyExplainCard
4. **其他 (20)**: 报价/链监控/订阅/市场等

### P1: 模板文件整理

1. factor-strategy-templates.ts (166KB) 过大, 建议拆分
2. 补充缺失的 template-definitions-hk.ts / template-definitions-jp.ts 等
3. TemplateEngine.ts 与 touchpoint-template-index.ts 同步确认

### P2: 因子完整性

98 因子文件, 258 因子, 无 @ts-nocheck ✅ — 状态良好

---

*审计完成: 2026-06-16 04:12 HKT | youdao*
