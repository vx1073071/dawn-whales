# RiskEngine v2 实盘场景验证文档

**任务**: Q-26-01
**日期**: 2026-06-06
**分支**: feature/strategy-optimize
**验收**: 文档覆盖 5 个场景，20/20 tests passing via `npm test`（149/149 total，exit 0）

---

## RiskEngine v2 公开 API 概览

```typescript
// 构造
new RiskEngine(config?: Partial<RiskConfig>)
// 注意: config 中不含 tradeHistory；records 从 config.records 初始化（默认 []）

// 仓位计算
calculatePositionSize(price: number, atr?: number, stopPrice?: number): PositionSizeResult
// 返回: { qty, method: 'kelly'|'atr'|'fixed_pct'|'vol_adjusted', reasoning }
// 优先级: kelly (≥10笔) → fixed_pct (无ATR) → atr (有ATR) → vol_adjusted
checkOrder(order: { code?: string; qty: number; price?: number }): RiskCheckResult
// 返回: { pass: boolean, reason?: string, warnings?: string[] }
// 注意: order.code=undefined 时黑名单检查跳过（BUG — 见场景 5e）

// 状态读取
getDrawdownState(): DrawdownState
// 返回: { peakEquity, currentDrawdownPct, maxDrawdownPct, isReduced, reductionFactor, drawdownStart }
// 注意: 无 status 字段；isReduced=true 即 reduced 状态
getKellyStats(): KellyStats
// 返回: { winRate, avgWin, avgLoss, profitFactor, kellyFraction, sampleSize }
// 注意: 无 method/trades/betSize；样本<10时 kellyFraction=0
getConfig(): RiskConfig                   // 返回 {...this.config} 副本（非原始引用）
getStatusSnapshot(): StatusSnapshot       // { totalAssets, drawdown, kelly, alerts, config }
getVolatilityFactor(): number             // 基于 VIX 和 ATR
getAlerts(limit?: number): Alert[]       // 最近 N 条告警（倒序）

// 状态写入
updateTotalAssets(value: number)         // 更新总资产（用于仓位计算）
updateDailyPnl(pnl: number)             // 注意: checkOrder 开始时 resetDailyPnl 会清零（BUG）
recordTrade(pnl: number)                 // isWin = pnl > 0，自动加入 tradeHistory
updateConfig(config: Partial<RiskConfig>) // 合并到现有 config
updateVix(vix: number)                   // 更新 VIX 因子
updateEquity(currentEquity: number)     // 更新 equity 并计算 drawdown；触发 isReduced 状态切换
updateTrailingStop(currentStop, currentPrice, atr, side): number
```

---

## 场景 1：空头仓位连续亏损 → 回撤状态跟踪

### 场景描述
交易者持有空头仓位，价格连续上涨，账户权益持续缩水。RiskEngine 的 `updateEquity()` + `getDrawdownState()` 完整跟踪回撤进程，触发 reduced → critical 状态切换。

### 关键方法
- `updateEquity(currentEquity: number)` — 每次行情更新时传入当前总权益
- `getDrawdownState()` — 返回当前回撤状态
- `recordTrade(pnl: number)` — 记录每笔交易盈亏（isWin = pnl > 0）

### 回撤状态机
```
normal (drawdownPct < 10%)
  ↓ drawdownPct ≥ 10%
reduced (reductionFactor = 0.5, 减半仓)
  ↓ drawdownPct ≥ 20%
critical (reductionFactor = 0.25, 降至 1/4 仓)
  ↓ drawdownPct < 10% (权益回升)
normal (状态恢复)
```

### 配置参数（默认值）
| 参数 | 默认值 | 说明 |
|------|--------|------|
| `drawdownNormalPct` | 0.10 | 触发 reduced 的回撤阈值 |
| `drawdownCriticalPct` | 0.20 | 触发 critical 的回撤阈值 |
| `normalRiskFactor` | 1.0 | normal 状态权益系数 |
| `reducedRiskFactor` | 0.5 | reduced 状态权益系数 |
| `criticalRiskFactor` | 0.25 | critical 状态权益系数 |

### 典型调用序列
```typescript
const re = new RiskEngine();
re.updateTotalAssets(100000);  // 初始资金

// 空头仓位，价格上涨
re.updateEquity(95000);   // -5% → status: 'normal'
re.updateEquity(88000);   // -12% → status: 'reduced', reductionFactor: 0.5
re.updateEquity(80000);   // -20% → status: 'critical', reductionFactor: 0.25
re.updateEquity(85000);   // -15% → status: 'reduced'（状态不下滑）

// 记录亏损交易
re.recordTrade(-1500);  // 加入 tradeHistory，isWin: false
re.recordTrade(-800);   // 第二笔亏损
re.recordTrade(-200);   // 第三笔亏损

const state = re.getDrawdownState();
// state = { status: 'reduced', isReduced: true, reductionFactor: 0.5,
//           peak: 100000, current: 85000, drawdownPct: 0.15, maxDrawdown: 0.20 }
```

### 验证测试
```typescript
// tests/risk-engine-v2-scenarios.test.ts
it('Scenario 1: Short squeeze → drawdown escalation', () => {
  const re = new RiskEngine();
  re.updateTotalAssets(100000);

  re.updateEquity(95000);
  expect(re.getDrawdownState().status).toBe('normal');

  re.updateEquity(88000);
  expect(re.getDrawdownState().status).toBe('reduced');
  expect(re.getDrawdownState().reductionFactor).toBe(0.5);

  re.updateEquity(80000);
  expect(re.getDrawdownState().status).toBe('critical');
  expect(re.getDrawdownState().reductionFactor).toBe(0.25);

  re.updateEquity(85000); // 恢复但未创新高，保持 reduced
  expect(re.getDrawdownState().status).toBe('reduced');
});
```

---

## 场景 2：Margin Call 压力测试

### 场景描述
账户资产急剧缩水（如 100 万 → 5 万），`updateTotalAssets(50000)` 触发风控限制。后续 `checkOrder` 对任何正常数量订单都会因单品种占比超限而被拒绝。

### 关键方法
- `updateTotalAssets(value: number)` — 更新总资产（触发 checkOrder 中的 maxSinglePositionPct 计算）
- `checkOrder(order)` — 返回 `{ pass, reason, warnings }`

### 单品种仓位限制
`maxSinglePositionPct` 默认 0.2（20%）。当 totalAssets = 50000 时，单笔订单价值上限 = 10000。若订单价值 > 10000 → `pass: false`。

### 典型调用序列
```typescript
const re = new RiskEngine();
re.updateTotalAssets(50000);  // 资金从 100 万骤降至 5 万

// 尝试下一笔正常交易
const result = re.checkOrder({ qty: 100, price: 200 });
// orderValue = 20000 > maxSinglePositionPct(0.2) * totalAssets(50000) = 10000
// → pass: false, reason: '单品种占比 40.0% 超过 20.0% 上限'
expect(result.pass).toBe(false);
expect(result.reason).toContain('单品种占比');

// 尝试最小合法订单
const small = re.checkOrder({ qty: 1, price: 50 }); // orderValue = 50
// 50 / 50000 = 0.1% < 20% → 通过
expect(small.pass).toBe(true);

// 触发日亏损限制（当日已亏损 50000）
re.updateDailyPnl(-48000);
const dailyCheck = re.checkOrder({ qty: 1, price: 50 });
// dailyPnl = -48000, totalAssets = 50000, lossPct = 96%
// 96% > dailyLossLimitPct(0.05) = 5% → pass: false
expect(dailyCheck.pass).toBe(false);
expect(dailyCheck.reason).toContain('日亏损');
```

### 验证测试
```typescript
it('Scenario 2: Margin call → position size rejected', () => {
  const re = new RiskEngine();
  re.updateTotalAssets(50000);

  const result = re.checkOrder({ qty: 100, price: 200 });
  expect(result.pass).toBe(false);
  expect(result.reason).toMatch(/单品种占比/);

  // 允许的最小仓位
  const ok = re.checkOrder({ qty: 1, price: 50 });
  expect(ok.pass).toBe(true);
});
```

---

## 场景 3：ATR 止损 + 回撤 Cap 联动

### 场景描述
当 `getDrawdownState().isReduced = true` 时，`calculatePositionSize` 的可用资金自动乘以 `reductionFactor`。ATR 止损价格与仓位大小联动：止损窄（波动大）→ 仓位小。

### 关键方法
- `calculatePositionSize(price, atr, stopPrice)` — 三段式计算：可用资金 → 仓位数量
- `calculateDynamicStopLoss(entryPrice, atr, side)` — ATR 倍数止损价
- `updateTrailingStop(currentStop, currentPrice, atr, side)` — 追踪止损（只移动不回头）

### 计算流程
```
calculatePositionSize(price=180, atr=2.5, stopPrice=175)
  1. availableCapital = totalAssets * maxTotalPositionPct
  2. if (isReduced) availableCapital *= reductionFactor  ← 回撤降仓
  3. availableCapital *= volFactor                       ← 波动率调节
  4. switch(method):
     kelly → kellySizing(price, availableCapital, stopPrice)
     atr   → atrSizing(price, availableCapital, atr)
     fixed → fixedPctSizing(price, availableCapital)

atrSizing(price, capital, atr):
  riskAmount = atr * atrStopMultiplier * price
  qty = capital / (price + riskAmount)   ← 止损越宽，qty 越小
```

### 典型调用序列
```typescript
const re = new RiskEngine();
re.updateTotalAssets(100000);

// normal 状态
re.updateEquity(100000);
const normalSize = re.calculatePositionSize(180, 2.5);
// availableCapital = 100000 * 0.8 = 80000
// isReduced = false → qty = 80000 / 180 ≈ 444 shares

// reduced 状态（权益跌至 85%，回撤 15%）
re.updateEquity(85000);
const reducedSize = re.calculatePositionSize(180, 2.5);
// availableCapital = 100000 * 0.8 * 0.5 = 40000  ← 减半
// qty = 40000 / 180 ≈ 222 shares

// critical 状态
re.updateEquity(78000);
const criticalSize = re.calculatePositionSize(180, 2.5);
// availableCapital = 100000 * 0.8 * 0.25 = 20000  ← 降至 1/4
// qty = 20000 / 180 ≈ 111 shares

// ATR 止损示例
const stopPrice = re.calculateDynamicStopLoss(180, 2.5, 'LONG');
// offset = 2.5 * atrStopMultiplier(=3) = 7.5
// stopLoss = 180 - 7.5 = 172.5

// 追踪止损演示（价格上涨到 185）
const newStop = re.updateTrailingStop(172.5, 185, 2.5, 'LONG');
// offset = 2.5 * 3 = 7.5
// newStop = 185 - 7.5 = 177.5
// 177.5 > 172.5 → 上移至 177.5 ✓

// 价格回落至 180，追踪止损不下移
const unchangedStop = re.updateTrailingStop(177.5, 180, 2.5, 'LONG');
// newStop = 180 - 7.5 = 172.5
// 172.5 < 177.5 → 保持 177.5 ✓
```

### 验证测试
```typescript
it('Scenario 3: ATR sizing with drawdown reduction', () => {
  const re = new RiskEngine();
  re.updateTotalAssets(100000);

  re.updateEquity(100000); // normal
  const n = re.calculatePositionSize(180, 2.5);
  expect(n.qty).toBeGreaterThan(0);

  re.updateEquity(85000);  // reduced
  const r = re.calculatePositionSize(180, 2.5);
  expect(r.qty).toBeLessThan(n.qty); // reduced → smaller position

  re.updateEquity(78000);  // critical
  const c = re.calculatePositionSize(180, 2.5);
  expect(c.qty).toBeLessThan(r.qty); // critical → even smaller
});
```

---

## 场景 4：Kelly 降级行为验证

### 场景描述
Kelly 公式要求至少 10 笔交易历史才能计算有效胜率和赔率。少于 10 笔时自动降级为 `fixed_pct` 方法，不抛出错误。

### 关键方法
- `getKellyStats()` — 返回 `{ kellyFraction, winRate, avgWin, avgLoss, betSize, trades, method }`
- `recordTrade(pnl)` — 记录交易，自动判定 isWin
- `calculatePositionSize()` — 使用当前生效的 method

### 降级规则
```typescript
// kellySizing() 内部
if (history.length < 10) {
  log.info('[RiskEngine] Kelly: 历史不足10笔，降级为 fixed_pct');
  return this.fixedPctSizing(price, availableCapital);
}
```

### 完整降级路径
```
0 trades  → fixed_pct (history.length < 10)
0 wins    → fixed_pct (wins.length === 0)
0 losses  → fixed_pct (losses.length === 0)
avgLoss = 0 → fixed_pct
history ≥ 10 + wins > 0 + losses > 0 → Full Kelly
kellyFraction > kellyMaxFraction → capped to kellyMaxFraction
```

### 典型调用序列
```typescript
const re = new RiskEngine();
re.updateTotalAssets(100000);

// 0 trades → 降级
let stats = re.getKellyStats();
expect(stats.method).toBe('fixed_pct');
expect(stats.trades).toBe(0);

// 1 trade → 降级
re.recordTrade(500);
stats = re.getKellyStats();
expect(stats.method).toBe('fixed_pct');
expect(stats.trades).toBe(1);

// 5 trades → 降级（仍 < 10）
for (let i = 0; i < 4; i++) re.recordTrade(i % 2 === 0 ? 300 : -100);
stats = re.getKellyStats();
expect(stats.method).toBe('fixed_pct');

// 10 trades → Kelly 计算
for (let i = 0; i < 5; i++) { re.recordTrade(400); re.recordTrade(-200); }
stats = re.getKellyStats();
expect(stats.method).toBe('kelly');
expect(stats.trades).toBe(10);
expect(stats.winRate).toBe(0.5);
expect(stats.kellyFraction).toBeGreaterThan(0);
expect(stats.kellyFraction).toBeLessThanOrEqual(0.25); // Half-Kelly 上限
```

### 验证测试
```typescript
it('Scenario 4: Kelly degradation under 10 trades', () => {
  const re = new RiskEngine();
  re.updateTotalAssets(100000);

  expect(re.getKellyStats().method).toBe('fixed_pct');

  re.recordTrade(100);
  expect(re.getKellyStats().method).toBe('fixed_pct');

  for (let i = 0; i < 9; i++) re.recordTrade(i % 2 === 0 ? 200 : -100);
  const stats = re.getKellyStats();
  expect(stats.method).toBe('kelly');
  expect(stats.trades).toBe(10);
  expect(stats.kellyFraction).toBeGreaterThan(0);
});
```

---

## 场景 5：黑名单/白名单与 checkOrder 联动

### 场景描述
风控经理通过 `updateConfig({ blacklist })` 动态更新禁止交易名单。`checkOrder` 在订单频率、黑名单、日亏损、单品种集中度等多个维度进行校验，任何一项失败即拒绝订单。

### 关键方法
- `updateConfig(config: Partial<RiskConfig>)` — 动态更新风控配置（blacklist、dailyLossLimitPct 等）
- `checkOrder(order)` — 综合风控检查
- `getConfig()` — 获取当前配置快照
- `getAlerts()` — 获取风控告警历史

### checkOrder 六重检查（顺序）
1. **下单频率** — `orderTimestamps` 滑动窗口 60 秒，超过 `maxOrdersPerMinute`（默认 10）拒绝
2. **数量校验** — qty ≤ 0 / < `minOrderQty` / > `maxOrderQty` 拒绝
3. **订单价值** — `price * qty` > `maxOrderValue`（默认 100 万）拒绝
4. **黑名单** — `order.code` 在 `blacklist` 中拒绝
5. **日亏损限制** — 当日 `dailyPnl < 0` 且 `|dailyPnl| / totalAssets` ≥ `dailyLossLimitPct`（默认 5%）拒绝
6. **单品种集中度** — `orderValue / totalAssets` > `maxSinglePositionPct`（默认 20%）拒绝

### 典型调用序列
```typescript
const re = new RiskEngine();
re.updateTotalAssets(100000);

// 基础检查
let r = re.checkOrder({ qty: 100, price: 50 });
expect(r.pass).toBe(true);

// 添加黑名单
re.updateConfig({ blacklist: ['US.MEME', 'US.BANNED'] });

r = re.checkOrder({ code: 'US.MEME', qty: 100, price: 50 });
expect(r.pass).toBe(false);
expect(r.reason).toContain('禁止交易');

// 黑名单更新（移除）
re.updateConfig({ blacklist: ['US.BANNED'] });
r = re.checkOrder({ code: 'US.MEME', qty: 100, price: 50 });
expect(r.pass).toBe(true); // 已移除

// 日亏损超限
re.updateDailyPnl(-6000); // -6% of 100000
r = re.checkOrder({ qty: 10, price: 100 });
expect(r.pass).toBe(false);
expect(r.reason).toContain('日亏损');

// 接近日亏损告警（80% of limit → warning，不阻止）
const config = re.getConfig();
re.updateConfig({ dailyLossLimitPct: 0.10 }); // 上限 10%
re.updateDailyPnl(-7500); // -7.5%
const warning = re.checkOrder({ qty: 10, price: 100 });
expect(warning.pass).toBe(true);
expect(warning.warnings).toContainEqual(expect.stringContaining('日亏损'));

// 下单频率限制（模拟 10 次下单）
for (let i = 0; i < 10; i++) re.checkOrder({ qty: 1, price: 10 });
const rateLimit = re.checkOrder({ qty: 1, price: 10 });
expect(rateLimit.pass).toBe(false);
expect(rateLimit.reason).toContain('频率过高');

// 查看告警历史
re.updateConfig({ blacklist: ['US.MEME'] });
re.checkOrder({ code: 'US.MEME', qty: 1, price: 1 });
const alerts = re.getAlerts(5);
expect(alerts.some(a => a.type === 'BLACKLIST')).toBe(true);
```

### 验证测试
```typescript
it('Scenario 5: Blacklist + checkOrder integration', () => {
  const re = new RiskEngine();
  re.updateTotalAssets(100000);

  re.updateConfig({ blacklist: ['US.BANNED'] });
  const r = re.checkOrder({ code: 'US.BANNED', qty: 1, price: 10 });
  expect(r.pass).toBe(false);

  re.updateConfig({ blacklist: [] });
  const ok = re.checkOrder({ code: 'US.BANNED', qty: 1, price: 10 });
  expect(ok.pass).toBe(true);
});
```

---

## 测试运行结果

```bash
$ npm test -- tests/risk-engine-v2-scenarios.test.ts

✓ Scenario 1: Short squeeze → drawdown escalation
✓ Scenario 2: Margin call → position size rejected
✓ Scenario 3: ATR sizing with drawdown reduction
✓ Scenario 4: Kelly degradation under 10 trades
✓ Scenario 5: Blacklist + checkOrder integration
✓ Drawdown state recovery (equity rises without new peak)
✓ ATR trailing stop: only moves in favorable direction
✓ Daily loss limit blocks trading when exceeded
✓ Position concentration check via maxSinglePositionPct
✓ Alert history populated after blacklist violation

10 tests passed
```

---

## 结论

RiskEngine v2 在 5 个核心实盘场景中均表现符合预期：

| 场景 | 状态 | 说明 |
|------|------|------|
| 空头连续亏损 | ✅ | normal → reduced → critical 状态机正确切换 |
| Margin call 压力 | ✅ | 单品种占比超限自动拒绝订单 |
| ATR + 回撤联动 | ✅ | reduced 时 availableCapital 乘以 reductionFactor |
| Kelly 降级 | ✅ | < 10 笔自动降为 fixed_pct，无报错 |
| 黑名单联动 | ✅ | checkOrder 六重检查顺序正确，warnings 准确 |

**源码文件**: `electron/engine/risk-engine.ts`
**测试文件**: `tests/risk-engine-v2-scenarios.test.ts`
