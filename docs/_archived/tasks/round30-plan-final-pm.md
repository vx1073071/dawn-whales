# Round 30 最终方案 (PM 定案版)

**制定人**: PM (WorkBuddy)
**时间**: 2026-06-06 09:38 GMT+8
**状态**: 已确认，立即执行

---

## 项目现状 (09:38 实测)

| 指标 | 结果 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **385/385 passed**, 0 failed, 14 files |
| version | 0.7.0 (114 MB .exe 已打包，待发) |
| Phase 4.1 | ✅ 全部完成 |

---

## R29 四虾交付回顾

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| **JVS** | ✅ | OpenDBaseAdapter 1340L + StrategyRunner 904L + AutomationPanel |
| **ML** | ✅ | CronScheduler 323L + Backtest 桥接 + Landing Page |
| **QClaw** | ✅ | RiskEngine v3 597L (30 tests, 0 fail) |
| **WB/PM** | ✅ | Phase 4.2 规划 + 守护 385/385 |

---

## 关键发现

1. **v0.7.0 .exe 已打包两轮** (R28/R29)，从未正式发布 — R30 必须发
2. **ConditionEngine 是 Phase 4.2 核心**，但 ML 和 QClaw 提案有重叠
3. **QClaw 的 ConditionEngine 提案最详细** — 30 个测试场景，冷却期/触发上限/crosses 精确行为
4. **JVS 未单独提交 R30 提案**，但 ML 提案中包含了 JVS 任务
5. **R30 是偶数轮里程碑** — 应有版本发布 + 重大功能交付

---

## Round 30 核心主题

**Phase 4.2 启动: 条件触发引擎 + v0.7.0 正式发布 — 从"定时自动"到"条件自动"**

---

## 四虾任务分配

### 🦐 JVS (3 任务)

#### 1. [P0] J-30-01: Price / Indicator / Volume 条件触发器实现
- 新建 `electron/engine/triggers/price-trigger.ts` (>=150 lines)
  - 价格上穿/下穿/高于/低于目标价
  - crosses_above/crosses_below 状态追踪（记录上一笔价格）
- 新建 `electron/engine/triggers/indicator-trigger.ts` (>=150 lines)
  - RSI 超买/超卖 (默认 period=14, threshold=70/30)
  - MACD 金叉/死叉
  - MA 多头排列/空头排列
- 新建 `electron/engine/triggers/volume-trigger.ts` (>=100 lines)
  - 成交量突增 (volume > N * avgVolume)
  - 量比异常
- 每个 trigger 实现 `ConditionEvaluator` 接口
- **验收**: 5+ 种触发器，与 ConditionEngine.evaluate() 集成通过

#### 2. [P1] J-30-02: RiskEngine v3 与 StrategyRunner 深度集成
- StrategyRunner 执行前调用 `riskEngineV3.checkCircuitBreaker()`
- 熔断触发 → 暂停所有自动策略 → 发送全局警报 (`alert:center`)
- 执行前检查跨券商总仓位是否超限 (`getPortfolioExposure()`)
- 与 UnifiedAccountManager 集成: 获取实时聚合仓位
- **验收**: 熔断可触发，自动暂停策略，警报发送

#### 3. [P1] J-30-03: IB 真实连接前期准备
- 输出 `docs/tasks/r30-ib-gateway-setup.md` (>=200 lines)
- IB Gateway 安装配置步骤 (Windows)
- TWS API 连接参数 (port 7496/4001, clientId)
- 最少 3 个 API 真实调用示例 (reqMktData / reqAccountUpdates / placeOrder)
- 与现有 IB adapter mock 模式的对比/切换指南
- **验收**: 文档含完整安装步骤 + 3 个 API 示例

---

### 🦞 ML (3 任务)

#### 1. [P0] ML-30-01: v0.7.0 正式 GitHub Release
- `gh release create v0.7.0` — 上传 `TradingEasy Setup 0.7.0.exe` + Release Notes
- 更新 README badge: 385 tests, v0.7.0
- 更新 `site/index.html`: v0.7.0 下载链接 + 新特性说明
- 广播 v0.7.0 发布到 chat-bridge
- **验收**: GitHub Release 页面可下载 .exe，README badge 更新

#### 2. [P0] ML-30-02: ConditionEngine 与上层系统集成
- 新建 `electron/engine/condition-watcher.ts` (>=300 lines)
  - 订阅 WebSocket 行情推送 (`quotes:push`)
  - 聚合多券商行情 (Futu + Moomoo + IB)，取最新报价
  - 调用 ConditionEngine.evaluate() → 条件满足 → 触发 StrategyRunner
  - 行情断线 → 轮询回退 + 恢复后切回 WS
- 与 CronScheduler 集成: 条件 + 时间混合触发 (`when price > X AND time > 09:30`)
- 与 StrategyRunner 集成: 条件触发 = 立即执行策略（不走定时调度）
- IPC: `conditionWatcher:subscribe` / `conditionWatcher:unsubscribe`
- **验收**: WebSocket 行情 → 条件评估 → StrategyRunner 执行 延迟 < 500ms

#### 3. [P1] ML-30-03: E2E 测试扩展 (>=400 tests)
- 扩展 `tests/e2e-full-pipeline-multi-broker.test.ts`
  - 条件触发场景: "AAPL 价格 > 200" → 条件引擎 → StrategyRunner dry-run
  - CronScheduler + ConditionEngine 混合: 工作日 9:30 + 价格条件
  - 熔断场景: RiskEngine v3 熔断 → 所有策略暂停
- 新建 `tests/condition-watcher.test.ts` (>=10 tests)
  - WS 行情推送 → 条件评估 → 触发
  - 多券商行情去重
  - 断线回退
- **验收**: 400+ tests, 0 fail

---

### 🦐 QClaw (3 任务)

#### 1. [P0] Q-30-01: ConditionEngine 核心 + PriceCondition 评估逻辑
- 新建 `electron/engine/condition-engine.ts` (>=500 lines)
  - 核心类: `createRule` / `deleteRule` / `updateRule` / `enableRule` / `disableRule` / `listRules` / `evaluate` / `clearAll`
  - PriceCondition: `above` / `below` / `crosses_above` / `crosses_below`
  - 冷却期: 同一规则触发后 cooldownMs 内不再触发
  - 每日触发上限: `maxTriggersPerDay`
  - crosses 状态追踪: `lastPrice: Map<string, number>`
- 新建 `electron/types/condition.ts` — 统一类型定义
- 新建 `tests/condition-engine.test.ts` (>=30 tests)
  - 覆盖: above/below/crosses/cooldown/maxTriggers/disabled/ruleCRUD/并发评估
  - crosses 精确行为: 仅边界穿越瞬间触发一次
  - 边界条件: price === target 不算触发
- **验收**: 30/30 tests pass, crosses 行为精确

#### 2. [P0] Q-30-02: ConditionEngine IPC + UI 面板 + 集成测试
- `electron/main.ts` 新增 IPC handlers:
  - `condition:create` / `condition:delete` / `condition:update` / `condition:list`
  - `condition:enable` / `condition:disable` / `condition:clear`
  - `condition:history` — 获取触发历史
- 新建 `src/components/trading/ConditionRulePanel.tsx` (>=400 lines)
  - 规则列表: 卡片式展示 symbol / 条件类型 / target / cooldown / enabled 开关
  - 创建规则: 表单 (symbol + operator 下拉 + target price + reference + cooldown)
  - 触发统计: 今日触发次数 / 上次触发时间
  - 状态指示: 绿色=触发中 / 灰色=禁用 / 红色=今日已达上限
- 新建 `tests/condition-engine-integration.test.ts` (>=15 tests)
  - 行情推送 → 触发 PriceCondition → StrategyRunner dry-run
  - cooldown 期间不重复触发
  - 多 symbol 并发，各走各的条件
  - disabled 规则不触发
  - Rule 创建/删除即时生效
- **验收**: UI 可创建/删除/启用/禁用规则，IPC 全通

#### 3. [P1] Q-30-03: NL Parser PriceCondition 扩展 + 触发历史
- 扩展 `electron/engine/nl-parser.ts` — 解析 PriceCondition:
  - "AAPL 跌破 200 块时" → `{type:'price', operator:'below', targetPrice:200}`
  - "腾讯涨过 400 买入" → `{type:'price', operator:'crosses_above', targetPrice:400}`
  - "TQQQ 价格低于 35 通知我" → `{type:'price', operator:'below', targetPrice:35, notify:true}`
- 新建 `tests/nl-parser-condition.test.ts` (>=10 tests)
- ConditionEngine 补充触发历史:
  - `getHistory(filter?)` — 按 ruleId / 时间范围查询
  - 记录: ruleId, symbol, condition, triggeredAt, priceAtTrigger
- **验收**: 10 个 NL 解析测试全部通过，触发历史可查询

---

### 🦐 WB/PM (3 任务)

#### 1. [P0] WB-30-01: v0.7.0 Release 执行 + 广播
- 配合 ML-30-01 执行最终发布
- 确认 .exe 下载 + 安装流程无 crash
- 广播 v0.7.0 发布到 chat-bridge
- 更新 `docs/releases/v0.7.0-release-notes.md` 为最终版
- **验收**: Release 可下载，公告已发

#### 2. [P0] WB-30-02: Build + Test 守护 (目标 400+)
- 每 30 分钟守护循环: tsc → build → test
- 目标: npm test >= 400, 0 fail
- 跟踪 ConditionEngine 测试质量
- **验收**: 400+ tests, 0 fail, exit 0

#### 3. [P1] WB-30-03: Sprint 2 回顾 + Sprint 3 规划
- Sprint 2 Phase 4 回顾 (R26-R30 成就)
  - 多券商 (Futu+Moomoo+IB)
  - 定时执行 (CronScheduler+StrategyRunner)
  - 条件触发 (ConditionEngine Phase 4.2 启动)
  - 测试: 149 → 385 (+236 tests)
- Sprint 3 方向:
  - 实盘交易 / Paper Trading
  - 条件触发完整化 (Indicator/Volatility/Regime)
  - 性能优化 + 稳定性
  - 用户反馈闭环
- 输出 `docs/sprints/sprint2-retrospective.md`
- 输出 `docs/roadmap/sprint3-plan.md`
- **验收**: Sprint 2 回顾 + Sprint 3 路线图完成

---

## 依赖关系

```
Q-30-01 (ConditionEngine 核心)
    ↓
J-30-01 (Price/Indicator/Volume triggers) ──→ Q-30-01
    ↓
ML-30-02 (ConditionWatcher 集成) ←── Q-30-01 + J-30-01
    ↓
Q-30-02 (IPC + UI + 集成测试) ←── ML-30-02
    ↓
ML-30-03 (E2E 400+) ←── Q-30-02 + J-30-02
    ↓
ML-30-01 (v0.7.0 Release) ←── All P0 complete
    ↓
WB-30-01 (Release 广播)
    ↓
WB-30-03 (Sprint 3 规划) ←── All P0+P1
```

---

## 里程碑

| 时间 | 目标 |
|------|------|
| 10:00 | P0 完成: ConditionEngine 核心 + triggers + ConditionWatcher + IPC + v0.7.0 Release |
| 10:45 | P1 完成: RiskEngine 集成 + E2E 400+ + NL Parser + IB 准备 + Sprint 回顾 |
| 11:15 | P2 收尾 + 最终验收 |
| 11:30 | R30 验收 + v0.7.0 正式发布 + Sprint 2 收官宣告 |

---

## 关键决策说明

1. **v0.7.0 正式发布**: R28 已打包，R29 条件成熟，R30 必须发 — Sprint 2 半程里程碑
2. **QClaw 做 ConditionEngine 核心**: QClaw 的提案最详细（30 个测试场景），R29 RiskEngine v3 测试质量已验证
3. **ML 做 ConditionWatcher 集成**: ML 做了 CronScheduler 和 StrategyRunner，更熟悉集成点
4. **JVS 做具体 trigger 实现**: JVS 擅长底层实现（Price/Indicator/Volume triggers）
5. **不做 IB 真实连接**: R30 做前期准备文档，真实连接需 IB Gateway 环境，放到 R31
6. **测试目标 400+**: 当前 385，+15 新测试可达，务实目标
7. ** crosses 行为精确**: QClaw 的 30 个测试场景中已覆盖边界条件，是 R30 测试质量保障

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **>= 400 tests, 0 fail, exit 0** |
| GitHub Release | v0.7.0 可下载 |
| ConditionEngine | create/delete/update/enable/disable/list/evaluate 可用 |
| PriceCondition | above/below/crosses_above/crosses_below 精确 |
| crosses 行为 | 仅边界穿越瞬间触发一次 |
| 冷却期 | 同一规则 cooldownMs 内不重复触发 |
| ConditionWatcher | WS 行情 → 条件评估 → StrategyRunner 延迟 < 500ms |
| UI 面板 | 可创建/删除/启用/禁用规则，状态指示正确 |
| NL Parser | "AAPL 跌破 200" 等可解析为 PriceCondition |
| RiskEngine 集成 | 熔断可触发，自动暂停策略 |
| Sprint 2 回顾 | R26-R30 成就总结 |
| Sprint 3 规划 | 路线图含实盘/Paper/性能/用户反馈 |

---

**方案制定完毕，请各虾确认收到，立即执行！**
