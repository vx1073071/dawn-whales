<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# Electron IPC API Reference

> quant-moo — Main Process ↔ Renderer Process Communication API
> Generated: 2026-06-11 | Version: 1.10.0-alpha.1

---

## Overview

quant-moo uses Electron's `ipcMain.handle()` / `ipcRenderer.invoke()` pattern for all
main↔renderer communication. Every IPC channel follows the request-response model with
structured error handling via `EngineError`.

**Architecture**:
```
Renderer (React)  ──invoke──►  Main Process (ipc-setup.ts)  ──►  Engine/Broker/DB
                  ◄──result──                              ◄──result──
```

**File Structure**:
| File | Purpose |
|------|---------|
| `electron/main/ipc-setup.ts` | Central IPC handler registration (~120 channels) |
| `electron/main/ipc-handlers-condition.ts` | Condition-specific handlers |
| `electron/preload.ts` | contextBridge exposure |
| `src/bridge-api.ts` | TypeScript Window.api interface |

---

## Channel Groups

### 1. Broker (`broker:*`)

券商连接与交易操作。支持多券商管理（Futu/IBKR）。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `broker:connect` | `{host, port, brokerId?}` | `ConnectionResult` | 连接到券商 OpenD Gateway |
| `broker:disconnect` | — | `void` | 断开当前券商连接 |
| `broker:getAccounts` | — | `Account[]` | 获取所有交易账户 |
| `broker:getFunds` | `accountId: string` | `FundInfo` | 获取账户资金信息 |
| `broker:getPositions` | `accountId: string` | `Position[]` | 获取持仓列表 |
| `broker:getQuotes` | `codes: string[]` | `Quote[]` | 批量获取实时报价 |
| `broker:subscribe` | `codes: string[]` | `void` | 订阅行情推送 |
| `broker:unsubscribe` | `codes: string[]` | `void` | 取消行情订阅 |
| `broker:getKlines` | `code, period, count` | `Kline[]` | 获取 K 线数据 |
| `broker:placeOrder` | `order: OrderRequest` | `OrderResult` | 下单（支持碎股） |
| `broker:cancelOrder` | `orderId, accountId, code` | `CancelResult` | 撤单 |
| `broker:getOrders` | `accountId: string` | `Order[]` | 获取订单列表 |
| `broker:list` | — | `BrokerConfig[]` | 列出已配置券商 |
| `broker:add` | `cfg: BrokerConfig` | `BrokerConfig` | 添加券商配置 |
| `broker:remove` | `id: string` | `void` | 删除券商配置 |
| `broker:setActive` | `id: string` | `void` | 设为活跃券商 |
| `broker:switch` | `id: string` | `void` | 切换券商（断旧连新） |
| `broker:getStatus` | — | `BrokerStatus` | 获取连接状态 |

**代码格式**:
- 港股: `HK.00700` (腾讯)
- 美股: `US.AAPL` (苹果)
- A 股沪: `SH.600519` (贵州茅台)
- A 股深: `SZ.000001` (平安银行)
- 加密货币: `CC.BTCUSD`

---

### 2. Strategy (`strategy:*`)

策略 CRUD + 回测 + 实盘管理。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `strategy:create` | `dsl: StrategyDSL` | `Strategy` | 创建策略（含 DSL 验证） |
| `strategy:getAll` | — | `Strategy[]` | 获取所有策略 |
| `strategy:get` | `id: string` | `Strategy` | 获取单个策略详情 |
| `strategy:update` | `id, updates` | `Strategy` | 更新策略配置 |
| `strategy:delete` | `id: string` | `void` | 删除策略 |
| `strategy:backtest` | `config: BacktestConfig` | `BacktestResult` | 运行回测 |
| `strategy:startLive` | `strategyId: string` | `LiveSession` | 启动实盘交易 |
| `strategy:stopLive` | `strategyId: string` | `void` | 停止实盘交易 |
| `strategy:explain` | `strategy: StrategyDSL` | `Explanation` | AI 解释策略逻辑 |
| `strategy:compare` | `s1, s2` | `Comparison` | 对比两个策略 |
| `strategy:optimize` | `config: OptimizeConfig` | `OptimizeResult` | 参数优化 |

---

### 3. Backtest (`backtest:*`)

高级回测功能：多周期、参数扫描、风险指标。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `backtest:multiPeriod` | `config: MultiPeriodConfig` | `MultiPeriodResult` | 多周期回测 |
| `backtest:paramSweep` | `config: ParamSweepConfig` | `SweepResult[]` | 参数网格搜索 |
| `backtest:riskMetrics` | `equityCurve: number[], riskFreeRate?` | `RiskMetrics` | 风险指标计算 |

**RiskMetrics 返回字段**:
- `sharpe` — 夏普比率
- `sortino` — 索提诺比率
- `calmar` — 卡玛比率
- `maxDrawdown` — 最大回撤
- `profitFactor` — 盈亏比
- `winRate` — 胜率
- `avgWin/avgLoss` — 平均盈亏

---

### 4. Natural Language (`nl:*`)

自然语言→交易指令解析。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `nl:parse` | `text: string` | `NLResult` | 中文/英文自然语言→结构化交易指令 |
| `nl:templates` | — | `Template[]` | 获取预设模板列表 |

**示例**:
```
输入: "买入腾讯100股限价350"
输出: { action: "BUY", code: "HK.00700", qty: 100, price: 350, type: "LIMIT" }
```

---

### 5. Risk Management (`risk:*`)

风控引擎接口。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `risk:getConfig` | — | `RiskConfig` | 获取风控配置 |
| `risk:updateConfig` | `config: RiskConfig` | `RiskConfig` | 更新风控配置 |
| `risk:getAlerts` | — | `Alert[]` | 获取风控告警列表 |
| `risk:getStatusSnapshot` | — | `RiskSnapshot` | 获取当前风控状态快照 |
| `risk:getKellyStats` | — | `KellyStats` | Kelly 仓位统计 |
| `risk:getDrawdownState` | — | `DrawdownState` | 回撤状态 |
| `risk:updateVix` | `vix: number` | `void` | 更新 VIX 波动率 |

**RiskConfig 关键字段**:
- `dailyLossLimit` — 单日亏损上限
- `positionLimit` — 单票仓位上限
- `stopLossPct` — 止损百分比
- `maxDrawdownPct` — 最大回撤限制

---

### 6. Database (`db:*`)

SQLite 持久化操作。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `db:getStrategies` | — | `Strategy[]` | 查询所有策略 |
| `db:saveStrategy` | `strategy: Strategy` | `Strategy` | 保存/更新策略 |
| `db:getSettings` | — | `Settings` | 获取用户设置 |
| `db:saveSettings` | `settings: Settings` | `Settings` | 保存设置 |
| `db:getTrades` | `strategyId?: string` | `Trade[]` | 获取交易记录 |
| `db:getBacktestResults` | `strategyId: string` | `BacktestResult[]` | 获取回测历史 |
| `db:getWatchlist` | — | `string[]` | 获取自选股列表 |
| `db:saveWatchlist` | `codes: string[]` | `void` | 保存自选股 |
| `db:getSignals` | `strategyId?: string` | `Signal[]` | 获取交易信号 |

---

### 7. App (`app:*`)

应用生命周期管理。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `app:getInfo` | — | `AppInfo` | 应用基本信息 |
| `app:getMemoryUsage` | — | `MemoryInfo` | 内存使用统计 |
| `app:emergencyStop` | — | `void` | 紧急停止所有实盘交易 |
| `app:openExternal` | `rawUrl: string` | `void` | 安全打开外部链接 |
| `app:getVersion` | — | `string` | 当前版本号 |
| `app:getPlatform` | — | `string` | 操作系统平台 |
| `app:checkUpdate` | — | `UpdateInfo` | 检查更新 |
| `app:downloadUpdate` | — | `void` | 下载更新 |
| `app:installUpdate` | — | `void` | 安装更新并重启 |

---

### 8. Options Greeks (`greeks:*`)

Black-Scholes 期权定价与 Greeks 计算。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `greeks:calculate` | `{spot, strike, rate, vol, days, type}` | `Greeks` | 计算单个期权 Greeks |
| `greeks:portfolio` | `positions: GreeksPosition[]` | `PortfolioGreeks` | 组合 Greeks 聚合 |

**Greeks 返回值**: `{price, delta, gamma, theta, vega, rho}`

---

### 9. Marketplace (`marketplace:*`)

策略市场：评分、评论、性能。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `marketplace:rate` | `strategyId, rating` | `void` | 为策略评分 (1-5) |
| `marketplace:getRating` | `strategyId` | `RatingInfo` | 获取评分统计 |
| `marketplace:comment` | `strategyId, content, parentId?` | `Comment` | 发表评论/回复 |
| `marketplace:getComments` | `strategyId` | `Comment[]` | 获取评论列表 |
| `marketplace:savePerformance` | `data` | `void` | 保存策略性能数据 |
| `marketplace:getPerformance` | `strategyId` | `Performance` | 获取性能数据 |
| `marketplace:list` | `sortBy?, limit?` | `MarketItem[]` | 策略列表（支持排序） |
| `marketplace:score` | `strategyId` | `ScoreDetail` | 五维评分详情 |
| `marketplace:verify` | `strategyId` | `VerifyResult` | 验证策略完整性 |
| `marketplace:updateAllScores` | — | `void` | 批量更新所有评分 |

---

### 10. Data (`data:*`)

市场数据服务：基本面、资金流、市场状态、异常检测。

| Channel | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `data:fundamental` | `symbol: string` | `Fundamental` | 基本面数据 |
| `data:capital-flow` | `symbol: string` | `CapitalFlow` | 资金流向 |
| `data:regime` | — | `Regime` | 当前市场状态 (Bull/Bear/Sideways) |
| `data:anomalies` | `symbol: string` | `Anomaly[]` | 异常检测信号 |
| `data:news` | `symbol, limit?` | `News[]` | 相关新闻 |
| `data:composite-score` | `symbol: string` | `CompositeScore` | 综合评分 |
| `data:save-fundamental` | `data` | `void` | 保存基本面数据 |
| `data:save-capital-flow` | `data` | `void` | 保存资金流数据 |
| `data:save-regime` | `regime` | `void` | 保存市场状态 |

---

### 11. Lazy-Registered Modules

以下模块通过延迟注册机制加载，在首次调用时自动初始化：

| Module | Channels | Description |
|--------|----------|-------------|
| `monitor` | `monitor:start/stop/status` | 实时监控面板 |
| `export` | `export:csv/json/pdf` | 数据导出 |
| `shell` | `shell:open/dialog` | 系统 Shell 操作 |
| `trade` | `trade:execute/simulate` | 交易执行与模拟 |
| `monteCarlo` | `monteCarlo:run` | 蒙特卡洛模拟 |
| `ws` | `ws:connect/disconnect` | WebSocket 实时推送 |
| `automation` | `automation:create/list/delete` | 定时任务管理 |

---

## Error Handling

所有 IPC handler 统一使用 `EngineError` 错误格式：

```typescript
interface EngineError {
  code: string;        // e.g. "BROKER_CONNECT_FAILED"
  domain: ErrorDomain; // e.g. "broker", "strategy", "risk"
  message: string;     // Human-readable message
  details?: unknown;   // Additional context
}
```

Renderer 侧统一捕获：
```typescript
try {
  const result = await window.api.invoke('broker:connect', config);
} catch (err: EngineError) {
  console.error(`[${err.domain}] ${err.code}: ${err.message}`);
}
```

---

## Rate Limiting

IPC 通道内置速率限制（通过 `rate-limiter.ts`）：

| Group | Rate | Window |
|-------|------|--------|
| `broker:*` | 10 req | 1 second |
| `data:*` | 20 req | 1 second |
| `strategy:backtest` | 5 req | 10 seconds |
| `app:*` | Unlimited | — |

---

## Security

- **Input Validation**: 所有 handler 对输入参数进行 Zod schema 校验
- **URL Filtering**: `app:openExternal` 仅允许 http/https 协议
- **Emergency Stop**: `app:emergencyStop` 立即终止所有实盘交易会话
- **No Secret Exposure**: API keys 存储在 main process，不通过 IPC 传递
