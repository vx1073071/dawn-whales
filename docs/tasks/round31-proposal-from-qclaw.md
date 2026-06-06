# Round 31 提案 — QClaw

**日期：** 2026-06-06
**现状：** 487/487 tests ✅，18 files，0 fail，0 TSC errors
**分支：** `feature/strategy-optimize`

---

## 背景

Phase 4.2（条件触发引擎）R30 交付：
- **Q-30：** ConditionEngine 核心（45 tests）+ NL PriceCondition（24 tests）✅
- **J-30：** Price/Indicator/Volume triggers + Risk-Strategy integrator ✅
- **M-30：** ConditionWatcher + E2E tests + Release prep ✅

**未完成项（阻塞 Phase 4.2 闭环）：**
1. ConditionEngine 尚未连接到交易执行流程（condition 触发 → signal → order）
2. 触发历史未持久化（recordTrigger 无 IPC 端点）
3. NL Parser 缺少 TimeCondition（"9:30 买入"类时间条件）
4. ConditionRulePanel 未集成到任何页面
5. ConditionEngine 压力测试空白（并发触发、cooldown 边界、跨 condition OR/AND）

---

## R31 任务分配建议

### Q-31：ConditionEngine 压测 + 触发历史 + TimeCondition（QClaw）

**Q-31-01 [P0] — ConditionEngine 压测扩展**
- 并发触发：同时满足多个 condition，验证 cooldown 正确隔离
- maxTriggersPerDay 强制执行
- cross-condition OR/AND 逻辑（两个条件都满足 / 任一满足）
- condition 更新（enable/disable/clear）在触发过程中的行为
- 目标：+20 tests → 总计 65+ tests

**Q-31-02 [P0] — 触发历史 IPC**
- `condition:getHistory` IPC handler：`ConditionEngine.getTriggerHistory(days?)` → 返回触发记录
- `condition:clearHistory` IPC handler
- 扩展 condition-engine-integration.test.ts 覆盖历史查询
- 目标：+8 tests

**Q-31-03 [P1] — NL Parser TimeCondition**
- 支持模式：`9:30 买入`、`14:00 止损`、`开盘买入`、`尾盘平仓`
- `TimeCondition { type: 'time', hour, minute, session: 'open'|'close'|'custom' }`
- 目标：+10 tests

---

### J-31：ConditionEngine → TradeExecutor 集成（JVS）

**目标：** condition 触发 → emit signal → 执行订单，全链路打通
- ConditionEngine 触发时通过 EventEmitter 发出 `trigger` 事件
- `ConditionWatcher` 监听 `trigger` → 调用 `nlParser.parseNaturalLanguage` → 生成 signal
- Signal → `TradeExecutor.placeOrder()` 完成闭环
- 集成测试：真实 condition → order 完整流程
- JVS 已有 Price/Indicator/Volume trigger 底层实现 → 补全 action 层

---

### M-31：ConditionWatcher 增强 + 实时监控（ML）

**目标：** 多 condition 同时监听 + 实时状态面板
- `ConditionWatcher.watch(conditions[])` 批量监听
- 触发时持久化到 trigger history（通过 IPC）
- 前端实时 condition 状态 dashboard（哪些活跃/触发/冷却中）
- 与 J-31 的 EventEmitter 链路对接

---

### W-31：ConditionRulePanel 集成 + Sprint 规划（WorkBuddy / PM）

**目标：** UI 可用 + Phase 4.3 规划
- ConditionRulePanel 集成到 `StrategyPage` 或独立 `ConditionsPage`
- 条件 CRUD（create/update/delete/enable/disable）UI 完整
- Phase 4.3 规划文档：Phase 5（Portfolio Analytics / Backtesting / Multi-timeframe）待办
- Sprint 2 总结文档（Phase 4.1 + 4.2 交付物清单）

---

## 优先级矩阵

| Task | 重要性 | 紧急度 | 依赖 |
|------|--------|--------|------|
| Q-31-01 ConditionEngine 压测 | P0 | 高 | 无 |
| Q-31-02 触发历史 IPC | P0 | 高 | J-31 EventEmitter |
| J-31 Condition→Trade集成 | P0 | 最高 | Q-31-02 |
| M-31 ConditionWatcher 增强 | P0 | 高 | J-31 |
| Q-31-03 TimeCondition | P1 | 中 | 无 |
| W-31 UI 集成 | P1 | 高 | J-31+M-31 |
| Phase 4.3 规划 | P2 | 低 | Phase 4.2 完成 |

---

## 成功标准

- ConditionEngine test suite: 73+ tests, 0 fail
- Full integration test: condition 触发 → signal → order 全链路 pass
- TSC: 0 errors
- `npm test` 全量: 500+ tests, 0 fail
