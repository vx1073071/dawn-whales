# R189: 深度服务基础 + 🟡交互完善 | Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 2 关键轮 | v2.6.0-alpha
> 前置: R188(市场专属34因子)✅ | 本轮: 回测引擎+诊断+热力图+龙虎榜+搜索升级
> 💰 首轮收费功能落地: 多因子回测1U / 因子诊断1U

---

## 🎯 Round目标

1. **多因子组合回测引擎**: 最多5因子→分层回测→多空收益→换手成本 (💰 1U/次)
2. **单因子回测引擎**: 分5组→多空→IC趋势 (🟡免费，秒级)
3. **因子深度诊断**: 全因子Top5信号+综合诊断 (💰 1U/次)
4. **FactorCalendarHeatmap**: 月度因子收益热力图
5. **FactorWeeklyLeaderboard**: 本周赚钱因子龙虎榜
6. **FactorSearchBar升级**: 自然语言+ID+标签三模式
7. **计费管线**: hold→settle/refund 完整闭环

---

## 💰 收费设计 (v17.7 #25-#26)

```
┌─────────────────────────────────────────────────────────────┐
│                    深度服务收费漏斗                           │
│                                                             │
│  [免费层]  单因子回测(秒级) + 信号灯 + 基础IC              │
│         ↓                                                   │
│  [预览层]  单因子回测完整结果(IC趋势/分组收益)              │
│         ↓  点击"查看多因子回测"                              │
│  [付费层]  多因子组合回测 💰 1U/次                           │
│         ↓  点击"一键诊断"                                    │
│  [付费层]  因子深度诊断 💰 1U/次                              │
│                                                             │
│  扣费流程: hold USDT → compute → settle/refund              │
│  失败退费: DeepSeek API失败/计算超时/数据不足                │
│  24h缓存: 相同参数组合不重复扣费                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎) — 回测引擎核心

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | 多因子组合回测引擎 | `electron/engine/factors/backtest/multi-factor-backtest.ts` | ≥400行 | 最多5因子+分层+多空+换手 |
| J2 | 单因子回测引擎 | `electron/engine/factors/backtest/single-factor-backtest.ts` | ≥250行 | 5组多空+IC趋势+秒级 |
| J3 | 回测结果缓存 | `electron/engine/factors/backtest/backtest-cache.ts` | ≥150行 | 24h缓存+同参不重复扣费 |
| J4 | 回测输出标准化 | `electron/engine/factors/backtest/backtest-result.ts` | ≥100行 | IC/CAGR/夏普/回撤/换手5维 |

**多因子回测引擎规格**:
- 因子数: 2-5个
- 分层: 5组(等分)
- 多空: 买Top组+卖Bottom组
- 换手成本: 股票0.1%/加密0.02%
- 输出: 年化收益/CAGR/夏普比率/最大回撤/胜率/IC序列/因子相关性
- 性能: 多因子<30s / 单因子<5s

**单因子回测引擎规格**:
- 分层: 5组(等分)
- 多空: Top - Bottom
- IC: 逐期IC+均值+IR
- 输出: IC趋势图数据+分组收益+CAGR+夏普
- 性能: <5s (缓存<1s)
- 💰: 免费 (引导多因子付费入口)

### 🦐 ML (前端) — 交互组件升级

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorCalendarHeatmap | `src/components/strategy/FactorCalendarHeatmap.tsx` | ≥200行 | 月度收益热力图(GitHub风格) |
| M2 | FactorWeeklyLeaderboard | `src/components/strategy/FactorWeeklyLeaderboard.tsx` | ≥150行 | Top10+排名动画+IC排序 |
| M3 | FactorSearchBar v2 | `src/components/strategy/FactorSearchBar.tsx` | ≥200行 | 自然语言+ID+标签三模式 |

**FactorCalendarHeatmap**:
- 12个月×5组因子收益
- 🟢绿色=正收益 🔴红色=负收益
- 鼠标悬浮→月收益+IC值
- 点击某月→展示该月详细分组

**FactorWeeklyLeaderboard**:
- 本周IC Top10因子排行榜
- 排名变化↑↓动画
- 点击因子→跳转FactorSandbox单因子回测

**FactorSearchBar v2**:
| 模式 | 输入示例 | 匹配因子 |
|------|----------|----------|
| 自然语言 | "便宜的好公司" | BOOK_TO_PRICE/EARNINGS_YIELD/ROA/ROIC/PIOTROSKI_F |
| 因子ID | "ROA" | 精确匹配ROA |
| 标签 | "价值" | 所有A1价值类因子 |

### 🦐 autoclaw (全栈) — 计费管线+API

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | 深度服务计费管线 | `electron/engine/factors/backtest/billing-pipeline.ts` | ≥250行 | hold→compute→settle/refund |
| A2 | POST /api/factor/backtest | `electron/api/factor-backtest.ts` | ≥200行 | 接收因子组合→回测→计费→返回 |
| A3 | POST /api/factor/diagnosis | `electron/api/factor-diagnosis.ts` | ≥200行 | 接收股票→全因子→Top5→计费→返回 |
| A4 | 回测结果格式化器 | `electron/engine/factors/backtest/result-formatter.ts` | ≥100行 | 5维标准输出结构 |

**计费管线流程**:
```
1. 接收请求(params + user_id)
2. 检查余额 ≥ costUSDT
3. hold USDT (预扣)
4. 执行回测/诊断计算
5. 成功 → settle (确认扣款) + 写缓存
6. 失败 → refund (退还预扣) + 记录失败原因
7. 缓存命中 → 跳过计费，直接返回
```

**回测结果格式**:
```typescript
{
  ic: { series: number[], mean: number, ir: number },
  returns: { annualized: number, cagr: number, sharpe: number, maxDrawdown: number, winRate: number },
  attribution: { factorId: string, weight: number, contribution: number }[],
  turnover: { avg: number, cost: number },
  risk: { volatility: number, var95: number, tailRatio: number }
}
```

### 🦐 QClaw (设计) — 付费UX+社交

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 一键诊断模式UX | `docs/design/one-click-diagnosis-ux.md` | ≥150行 | 输入→等待→Top5结果流程 |
| Q2 | 付费引导设计 | `docs/design/paid-service-onboarding.md` | ≥150行 | 免费预览→付费解锁完整结果 |
| Q3 | 因子朋友圈设计 | `docs/design/factor-social-proof.md` | ≥100行 | "N人正在使用"+评分+评价入口 |

**一键诊断模式UX流程**:
```
输入: 股票代码/名称 → 自动搜索3市场
加载: "正在分析HK.00700的31个因子..."
结果: Top5因子信号灯+IC+一句话解释
付费: "查看完整68因子诊断" → 1U/次
```

**付费引导设计原则**:
- 首屏展示免费结果(单因子回测/基础信号灯)
- 底部卡片: "解锁多因子回测 1U/次 →"
- 不弹窗、不强制、不诱导恐慌
- 首次使用展示"怎么用"3步引导

### 🦐 youdao (测试) — 回测+计费验证

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 多因子回测引擎测试 | `tests/unit/multi-factor-backtest.test.ts` | ≥200行 | 2/3/5因子+边界+极端行情 |
| Y2 | 深度服务计费测试 | `tests/integration/billing-pipeline.test.ts` | ≥200行 | 7场景全覆盖 |
| Y3 | 回测结果正确性验证 | `tests/unit/backtest-correctness.test.ts` | ≥100行 | 误差<1% |

**计费7场景**:
| # | 场景 | 预期结果 |
|---|------|----------|
| 1 | 余额充足+计算成功 | hold→settle，余额扣1U |
| 2 | 余额不足 | 拒绝，返回"余额不足" |
| 3 | 计算失败(API超时) | refund，余额不变 |
| 4 | 计算失败(数据不足) | refund，余额不变 |
| 5 | 缓存命中(24h) | 免扣费，直接返回缓存 |
| 6 | 并发2次相同请求 | 第1次扣费，第2次缓存命中 |
| 7 | 余额0 | 拒绝，引导"如何充值" |

### 🦐 Claw (PM)

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R189 | 广播消息 | — | 6虾确认 |
| C2 | R189 Round计划(本文档) | 验收标准+分工 | ≥400行 | 完整 |
| C3 | 深度服务计费安全审计 | 计费管道7场景审核 | ≥200行 | 无扣费漏洞 |
| C4 | Phase 2中期检查 | 进度+质量+商业 | ≥100行 | 中期报告 |

---

## ✅ 验收标准

### P0 必过 (14项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | 多因子回测引擎 | 2-5因子组合可回测+5维输出 | JVS |
| V03 | 单因子回测引擎 | <5s+分5组+IC趋势 | JVS |
| V04 | 回测缓存 | 24h缓存+同参不重复扣费 | JVS |
| V05 | FactorCalendarHeatmap | 12月热力图渲染+点击交互 | ML |
| V06 | FactorWeeklyLeaderboard | Top10排序+排名变化动画 | ML |
| V07 | FactorSearchBar v2 | 自然语言/ID/标签三模式 | ML |
| V08 | 计费管线 | hold→settle/refund完整闭环 | autoclaw |
| V09 | POST /api/factor/backtest | 接收因子列表→回测→计费→5维结果 | autoclaw |
| V10 | POST /api/factor/diagnosis | 接收股票→全因子→Top5→计费 | autoclaw |
| V11 | 回测引擎测试 | 2/3/5因子+边界覆盖 | youdao |
| V12 | 计费管线测试 | 7场景全部pass | youdao |
| V13 | 回测正确性验证 | 与已知结果误差<1% | youdao |
| V14 | 扣费安全审计 | 无hold→crash不refund等漏洞 | Claw |

### P1 建议 (4项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V15 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |
| V16 | 单因子<3s | 优化后预期 | JVS |
| V17 | 付费引导UX | 预览→付费流程自然 | QClaw |
| V18 | 因子朋友圈设计 | 社交证明可信 | QClaw |

---

## 🔐 计费安全审计清单 (PM专项)

| # | 风险 | 防范措施 | 状态 |
|---|------|----------|------|
| S1 | hold后crash不refund | try/finally ensure refund | ☐ |
| S2 | 缓存绕过计费 | 缓存key=user+params+timestamp | ☐ |
| S3 | 并发重复扣费 | 悲观行锁(user_id, params) | ☐ |
| S4 | 免费回测→付费回测过渡无提示 | 多因子回测前显示"将扣除1U" | ☐ |
| S5 | 余额显示不一致 | 单写源+HMAC校验和(v17.6) | ☐ |
| S6 | 24h缓存≠日历日 | 精确到秒，跨天自然过期 | ☐ |
| S7 | 回测失败但部分扣费 | 失败=全退，不部分扣 | ☐ |

---

## 🔗 R189 架构全景

```
┌─────────────────────────────────────────────────────────────┐
│                    R189 深度服务架构                          │
│                                                             │
│  [用户侧]                                                    │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ 选因子/股票 │→│ 免费预览结果  │→│ 点击"解锁完整回测"    │  │
│  │ FactorSandbox│ │ 单因子秒级   │ │ 💰 1U/次            │  │
│  └────────────┘ └──────────────┘ └──────┬───────────────┘  │
│                                        │                    │
│  [计费层]                               ▼                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Billing Pipeline: hold→compute→settle/refund        │   │
│  │ - 检查余额 ≥ 1U                                       │   │
│  │ - hold (预扣) → 写wallet_txns (status=PENDING)       │   │
│  │ - compute → 回测/诊断引擎                             │   │
│  │ - success → settle (status=CONFIRMED)                │   │
│  │ - failure → refund (status=REFUNDED)                 │   │
│  │ - 24h内相同参数 → cache hit (免扣)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                        │                    │
│  [计算层]                               ▼                    │
│  ┌─────────────────┐  ┌──────────────────────────────┐     │
│  │ Single-Backtest │  │ Multi-Backtest                │     │
│  │ 1因子5组<5s     │  │ 2-5因子5组<30s                │     │
│  │ 💰免费          │  │ 💰1U/次                       │     │
│  └─────────────────┘  └──────────────────────────────┘     │
│                                                             │
│  [展示层]                                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │ 热力图       │ │ 龙虎榜       │ │ 搜索v2           │   │
│  │ 月度收益     │ │ 周IC Top10   │ │ NL/ID/Tag 3模式  │   │
│  └──────────────┘ └──────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Phase 2 进度追踪

| Round | 状态 | 🟡因子数 | 核心 | 累计总因子 |
|-------|------|---------|------|-----------|
| R187 | ✅ 已启动 | 34 (通用) | 因子+PK+权重 | 73+34=107 |
| R188 | ✅ 已启动 | 34 (市场) | 链上+期权+健康 | 107+34=141 |
| **R189** | 🟢 启动 | **0** | **💰回测+诊断** | 141 |
| R190 | ⏳ 待通知 | 0 (收尾) | 集成+v2.6.0 | 141 |

---

## 🔑 关键规则 (R189)

1. **💰 回测1U/次 + 诊断1U/次** — v17.7 #25-#26
2. **扣费管道: hold→settle/refund** — 失败退费(含API超时)
3. **24h缓存** — 同参不重复扣费
4. **单因子免费** — 秒级回测 = 导流入口
5. **搜索3模式** — NL/ID/Tag，自然语言匹配≥3因子
6. **龙虎榜** — IC排序Top10，周更新
7. **安全7检** — hold不crash/缓存不绕过/并发不重复/失败全退

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
- 费率体系: `docs/reference/fee-schedule.md`
- R141扣费管道: `electron/engine/factors/factor-billing-gateway.ts` (15 touchpoints)
- AI扣费规则: `docs/design/ai-billing-rules.md`
