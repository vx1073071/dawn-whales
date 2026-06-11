# Round 30 提案 — QClaw

**日期**: 2026-06-06
**基于**: Phase 4.2 条件触发引擎（R30 路线图）
**分支**: `feature/strategy-optimize`

---

## R30 背景

Phase 4.2 目标：从"定时自动"升级到"条件自动"。
R30 聚焦：**ConditionEngine 骨架 + PriceCondition 实现**（4 种条件类型的第 1 种）。

---

## Q-30-01 [P0] — ConditionEngine 核心 + PriceCondition 评估逻辑

**交付物**:
- `electron/engine/condition-engine.ts` — ConditionEngine 核心类
- `electron/types/condition.ts` — 统一类型定义
- `tests/condition-engine.test.ts` — 30+ 测试

### ConditionEngine 核心方法

```typescript
class ConditionEngine {
  private rules: Map<string, ConditionRule> = new Map();

  createRule(rule: Omit<ConditionRule, 'id' | 'createdAt' | 'lastTriggeredAt' | 'triggerCount'>): ConditionRule
  deleteRule(ruleId: string): boolean
  updateRule(ruleId: string, patch: Partial<ConditionRule>): ConditionRule | null
  enableRule(ruleId: string): boolean
  disableRule(ruleId: string): boolean
  listRules(filter?: { symbol?: string; enabled?: boolean; type?: string }): ConditionRule[]
  evaluate(symbol: string, data: MarketSnapshot): TriggerResult[]
  clearAll(): void
}
```

### PriceCondition 评估

```typescript
interface PriceCondition {
  type: 'price';
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  reference?: 'open' | 'high' | 'low' | 'close' | 'vwap'; // default: 'close'
}
```

**crosses_above/below 状态追踪**：
- ConditionEngine 内部维护 `lastPrice: Map<string, number>`（每个 symbol 的上一笔价格）
- crosses_above: `prev <= target AND cur > target`
- crosses_below: `prev >= target AND cur < target`
- 价格精度：统一用 `close` 字段，若无则用 `open`

### 测试场景（30 tests）

| # | 场景 | 操作 | 预期 |
|---|------|------|------|
| 1 | above: 满足 | price=210, target=200 | `triggered: true` |
| 2 | above: 不满足 | price=190, target=200 | `triggered: false` |
| 3 | below: 满足 | price=35, target=40 | `triggered: true` |
| 4 | below: 不满足 | price=45, target=40 | `triggered: false` |
| 5 | crosses_above: 满足（新上穿） | prev=195→cur=205, target=200 | `triggered: true` |
| 6 | crosses_above: 不满足（持续高于） | prev=205→cur=210, target=200 | `triggered: false` |
| 7 | crosses_below: 满足（新下穿） | prev=210→cur=195, target=200 | `triggered: true` |
| 8 | crosses_below: 不满足（持续低于） | prev=195→cur=190, target=200 | `triggered: false` |
| 9 | cooldown: 5s内重复触发 | 触发后1s再评佔 | `cooldown: true` |
| 10 | cooldown: 5s后重置 | 触发后6s再评佔 | `cooldown: false` |
| 11 | maxTriggersPerDay: 限制 | 触发10次后 | `triggered: false` |
| 12 | disabled rule | rule.enabled=false | `triggered: false` |
| 13 | unknown symbol | evaluate('XXX', snapshot) | 无匹配规则，empty |
| 14 | reference=open | open=100, others ignored | 正确使用 open |
| 15 | reference=high | high=105 | 正确使用 high |
| 16 | reference=low | low=98 | 正确使用 low |
| 17 | reference=vwap | vwap=102 | 正确使用 vwap |
| 18 | 多规则同一 symbol | 2个规则同时满足 | 2个 TriggerResult |
| 19 | 多 symbol 隔离 | symbol A满足，B不满足 | 只返回A的触发 |
| 20 | deleteRule | 创建后删除 | rule消失，不触发 |
| 21 | updateRule | 修改 targetPrice | 新值生效 |
| 22 | listRules: 过滤 enabled | listRules({enabled:true}) | 只返回启用的 |
| 23 | listRules: 过滤 symbol | listRules({symbol:'US.AAPL'}) | 只返回该 symbol |
| 24 | enable/disable | 切换 enabled | 状态正确翻转 |
| 25 | edge: price===target（above） | price=200, target=200 | `triggered: false`（不算高于） |
| 26 | edge: price===target（below） | price=200, target=200 | `triggered: false`（不算低于） |
| 27 | edge: crosses_from_exact | prev=200→cur=200 | `triggered: false`（无变化） |
| 28 | createRule: 自动生成 id | 传入无 id 规则 | 返回含 uuid id 的规则 |
| 29 | clearAll | 创建多条规则后清除 | rules 空 |
| 30 | concurrent evaluates | 同一 symbol 并发评佔 | cooldown 正确（防雪崩） |

### 验收标准
- `tsc --noEmit`: 0 errors
- 30/30 tests pass
- `crosses_*` 行为精确（仅边界穿越触发一次）

---

## Q-30-02 [P1] — ConditionEngine + StrategyRunner 集成 + IPC 层

**交付物**:
- `electron/engine/condition-engine.ts` 补充 IPC handlers
- `src/components/trading/ConditionRulePanel.tsx` — 条件规则管理面板
- 集成测试：`tests/condition-engine-integration.test.ts`（15 tests）

### IPC Handlers

```typescript
// electron/main/ipc-handlers.ts 新增
'condition:create' → engine.createRule()
'condition:delete' → engine.deleteRule()
'condition:update' → engine.updateRule()
'condition:list'   → engine.listRules()
'condition:enable' → engine.enableRule()
'condition:disable' → engine.disableRule()
'condition:clear'  → engine.clearAll()

// MarketDataWatcher → ConditionEngine 事件流
// quotes:push (WS行情推送)
//   → MarketDataWatcher 分发
//   → ConditionEngine.evaluate()
//   → StrategyRunner.trigger() [Phase 4.1]
//   → RiskEngine.checkOrder() [Phase 4.1]
//   → Broker order
```

### ConditionRulePanel UI

| 区域 | 内容 |
|------|------|
| 规则列表 | 规则卡片：symbol / 条件类型 / target / cooldown / enabled 开关 |
| 创建规则 | 表单：symbol 输入 + operator 下拉 + target price + reference + cooldown |
| 操作 | 删除 / 启用/禁用 / 查看触发统计 |
| 状态指示 | 绿色=触发中 / 灰色=禁用 / 红色=今日已达上限 |

### 集成测试场景

1. 行情推送 → 触发 PriceCondition → StrategyRunner dry-run
2. cooldown 期间同规则不重复触发
3. 多 symbol 并发推送，各走各的条件
4. disabled 规则不触发
5. WebSocket 断线 → 自动重连 → 行情恢复后继续评估
6. Rule 创建 → 立即生效（无需重启）
7. Rule 删除 → 立即失效（已在评估队列中的也取消）
8. 多券商同一 symbol（富途+微牛） → 去重，只触发一次

---

## Q-30-03 [P2] — 触发历史 + NL Parser 增强

**交付物**:
- `electron/engine/condition-engine.ts` 补充触发历史
- `electron/types/condition.ts` 补充 TriggerHistory 记录
- `tests/trigger-history.test.ts`（10 tests）
- NL Parser 增强：自然语言解析 PriceCondition（扩展已有 v2 解析器）

### TriggerHistory 记录

```typescript
interface TriggerEvent {
  ruleId: string;
  symbol: string;
  condition: Condition;
  triggeredAt: Date;
  priceAtTrigger: number;
  cooldownEndsAt?: Date;
}

class ConditionEngine {
  private history: TriggerEvent[] = [];
  getHistory(filter?: { ruleId?: string; since?: Date }): TriggerEvent[]
}
```

### NL Parser 扩展（已有 v2 基础）

已有自然语言解析能力，扩展 PriceCondition 语法：

| 用户输入 | 解析结果 |
|---------|---------|
| "AAPL 跌破 200 块时" | `{type:'price',operator:'below',targetPrice:200}` |
| "腾讯涨过 400 买入" | `{type:'price',operator:'crosses_above',targetPrice:400}` |
| "RSI 超过 70" | → IndicatorCondition（R31 范围，R30 提前设计） |
| "当 TQQQ 价格低于 35 块时通知我" | `{type:'price',operator:'below',targetPrice:35,notify:true}` |

### NL Parser 测试扩展（10 tests）

1. "AAPL 跌破 200" → above/below/crosses 正确识别
2. "crosses above 500" → crosses_above
3. "价格下穿 100" → crosses_below
4. "above 50"（无 symbol）→ error（含糊）
5. "AAPL > 150" → above
6. "腾讯 400 以下" → below
7. "AAPL 涨过 200" → crosses_above
8. "AAPL 跌过 200" → crosses_below
9. "above"（无数字）→ error
10. "AAPL 跌破 200 买入" → `{condition,action:'buy'}`（带 action 的复合语义）

---

## R30 目标汇总

| 任务 | 优先级 | 测试数 | 目标 |
|------|-------|-------|------|
| Q-30-01: ConditionEngine + PriceCondition | P0 | 30 | 核心骨架 + 4 种操作符 |
| Q-30-02: 集成 + IPC + UI | P1 | 15 | 完整链路可运行 |
| Q-30-03: 触发历史 + NL 增强 | P2 | 10 | 可追溯 + 自然语言 |

**目标测试总数**: 55+（R29: 385 → R30 目标: 440+）

---

## 技术约束

- ConditionEngine **不直接下单**，只触发 StrategyRunner（保持解耦）
- crosses_* 状态用 `Map<symbol, lastPrice>` 追踪（内存，非持久化）
- cooldown 检查：`Date.now() - lastTriggeredAt < cooldownMs`
- maxTriggersPerDay：`history.filter(e => isToday(e.triggeredAt)).length >= maxTriggersPerDay`
- IPC 层走已有 `ipcHandlers` 通道（不新建 channel）

---

## R30 后的依赖

- R31: IndicatorCondition（MACD/RSI/KDJ/Bollinger）→ 复用 ConditionEngine.evaluate()
- R31: MarketDataWatcher（WS 行情路由）→ 替换 MockMarketData
- R32: VolatilityCondition（IV Rank/HV Spike/VIX Level）→ 复用 PriceCondition 结构
- R33: 集成测试 + UI 完善
