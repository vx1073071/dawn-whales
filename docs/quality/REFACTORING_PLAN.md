<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: QClaw
purpose: (auto-generated, needs review)
-->

# DAWN WHALES · main.ts 模块化重构方案

> 状态：骨架已预建 | 等待主龙虾拆分后合并
> 创建者：QClaw | 2026-06-04

---

## 目标

将 `electron/main.ts`（1353 行，78 个 handler）拆分为模块化结构，消除巨大的一体化文件。

---

## 目标结构

```
electron/
├── main.ts                     ← 精简版（~200行）：导入 + 启动 + 全局错误处理
├── ipc-handlers/
│   ├── _import-shared.ts      ← 共享 import（futu-client, db, risk, 引擎等）
│   ├── broker-handlers.ts      ← 19 个 broker:* handler
│   ├── strategy-handlers.ts   ← 13 个 strategy:* + backtest:* handler
│   ├── nl-handlers.ts         ← 2 个 nl:* handler
│   ├── risk-handlers.ts       ← 7 个 risk:* handler
│   ├── db-handlers.ts         ← 9 个 db:* handler
│   ├── marketplace-handlers.ts← 12 个 marketplace:* + data:* handler
│   ├── greeks-handlers.ts     ← 2 个 greeks:* handler
│   └── app-handlers.ts        ← 7 个 app:* handler
└── ipc-schemas.ts             ← 50 个 Zod schema（已存在）
```

---

## 模块分组

### broker-handlers.ts（19个）
```
broker:connect, broker:disconnect, broker:getAccounts,
broker:getFunds, broker:getPositions, broker:getQuotes,
broker:subscribe, broker:unsubscribe, broker:getKlines,
broker:placeOrder, broker:cancelOrder, broker:getOrders,
broker:list, broker:add, broker:remove, broker:setActive,
broker:switch, broker:getStatus
```

### strategy-handlers.ts（13个）
```
strategy:create, strategy:getAll, strategy:get, strategy:update,
strategy:delete, strategy:backtest, strategy:startLive,
strategy:stopLive, backtest:multiPeriod, backtest:paramSweep,
backtest:riskMetrics, strategy:explain, strategy:compare
```

### nl-handlers.ts（2个）
```
nl:parse, nl:templates
```

### risk-handlers.ts（7个）
```
risk:getConfig, risk:updateConfig, risk:getAlerts,
risk:getStatusSnapshot, risk:getKellyStats,
risk:getDrawdownState, risk:updateVix
```

### db-handlers.ts（9个）
```
db:getStrategies, db:saveStrategy, db:getSettings,
db:saveSettings, db:getTrades, db:getBacktestResults,
db:getWatchlist, db:saveWatchlist, db:getSignals
```

### marketplace-handlers.ts（12个 marketplace + 12个 data）
```
marketplace:rate, marketplace:getRating, marketplace:comment,
marketplace:getComments, marketplace:savePerformance,
marketplace:getPerformance, marketplace:list, marketplace:score,
marketplace:verify, marketplace:updateAllScores
data:fundamental, data:capital-flow, data:regime,
data:anomalies, data:news, data:composite-score,
data:save-fundamental, data:save-capital-flow, data:save-regime,
data:compute-regime, data:save-anomaly, data:save-news,
data:clear-cache, backtest:walk-forward, backtest:param-scan,
backtest:multi-timeframe
```

### greeks-handlers.ts（2个）
```
greeks:calculate, greeks:portfolio
```

### app-handlers.ts（7个）
```
app:getInfo, app:getMemoryUsage, app:emergencyStop,
app:openExternal, app:getVersion, app:getPlatform,
app:checkUpdate, app:downloadUpdate, app:installUpdate
```

---

## 合并流程

1. **主龙虾** 完成 `main.ts` 拆分（手动或借助工具）
2. **QClaw** 将拆分出的 handler bodies 移动到对应 `ipc-handlers/*.ts`
3. **主龙虾** 将 `main.ts` 精简为纯启动文件（导入所有 registerHandlers）
4. 运行 `npx tsx tests/engine.test.ts` 验证 38 测试全绿
5. commit + push

---

## 注意事项

- 所有 handler 共享 `_import-shared.ts` 中的 import
- Zod schemas 已集中在 `ipc-schemas.ts`，无需重复导入
- 现有的 `ipcMain.handle()` 调用顺序不重要，Electron 按名注册
- `preload.ts` 和 `bridge-api.ts` 无需改动（IPC 通道名不变）
