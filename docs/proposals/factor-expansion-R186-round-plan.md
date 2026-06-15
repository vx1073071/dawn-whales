# R186: 🟢入门因子集成+场景包落地 — Round计划

> PM(Claw) 制定 | 2026-06-15 | Phase 1 收尾 | v2.5.0-alpha
> 前置: R184(基础设施)✅ + R185(35因子实现)✅ | 本轮: 全链路集成+场景包落地+Phase 1验收

---

## 🎯 Round目标

1. **因子→信号→UI全链路跑通** — factor计算 → IC → 信号灯 → FactorCard渲染
2. **3市场数据适配** — 港股/美股/加密统一FactorDataProvider接口
3. **8场景包一键选择器落地** — 牛市进攻/熊市防御/震荡轮动/加密趋势/价值掘金/成长猎手/港股窝轮/美股财报
4. **因子市场自动切换** — 选港股→只显示港股相关因子+通用因子
5. **因子搜索(说人话)** — 自然语言→因子映射
6. **Phase 1 集成验收** — v2.5.0-alpha 发布确认

---

## 🔗 Phase 1 全链路架构

```
┌─────────────────────────────────────────────────────────────┐
│                      R186 集成目标架构                        │
│                                                             │
│  [数据源层]                   [计算层]              [展示层]  │
│  FactorDataProvider         FactorCalculator      UI组件    │
│  ┌──────────────┐          ┌──────────────┐    ┌────────┐  │
│  │ HK Adapter   │──┐       │ 去极值(MAD)  │    │ 信号灯  │  │
│  │ US Adapter   │──┤  ───▶ │ 标准化(z)    │───▶│ 场景包  │  │
│  │ CC Adapter   │──┘       │ 缓存层       │    │ 市场切换│  │
│  └──────────────┘          └──────────────┘    │ 说人话  │  │
│                                                │ 向导3步 │  │
│                                                └────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ 6虾分工

### 🦐 JVS (引擎) — 数据适配+预处理+缓存

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| J1 | FactorDataProvider接口: 统一3市场数据适配 | `electron/engine/factors/data-provider.ts` | ≥250行 | 3市场getFactorData()可调用 |
| J2 | 港股数据适配器: 接入富途OpenD(127.0.0.1:11111) | `electron/engine/factors/adapters/hk-adapter.ts` | ≥200行 | 获取35🟢因子所需数据 |
| J3 | 美股数据适配器: Yahoo Finance/Alpha Vantage | `electron/engine/factors/adapters/us-adapter.ts` | ≥200行 | 获取35🟢因子所需数据 |
| J4 | 加密数据适配器: CoinGecko/Glassnode API | `electron/engine/factors/adapters/cc-adapter.ts` | ≥200行 | 获取6个加密🟢因子数据 |
| J5 | 预处理管线v1: 去极值(MAD)+标准化(z-score) | `electron/engine/factors/preprocess-pipeline.ts` | ≥150行 | MAD去极值+z-score 标准化 |
| J6 | 因子缓存层: 内存LRU+命中率监控 | `electron/engine/factors/factor-cache.ts` | ≥150行 | 缓存命中率>90% |

### 🦐 ML (前端) — 市场切换+搜索+向导

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| M1 | FactorMarketSwitch组件: 港股/美股/加密3市场切换 | `src/components/strategy/FactorMarketSwitch.tsx` | ≥200行 | 切换市场→因子列表过滤 |
| M2 | FactorSearch(说人话): 自然语言→因子映射引擎 | `src/components/strategy/FactorSearchBar.tsx` | ≥250行 | "便宜好公司"→3+因子 |
| M3 | FactorOnboarding 3步向导UI | `src/components/strategy/FactorOnboarding.tsx` | ≥200行 | 3步流畅+退出可继续 |

### 🦐 autoclaw (全栈) — 管线集成+数据接入

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| A1 | Factor→Signal管线: 计算→IC→信号灯→UI全链路 | `electron/engine/factors/factor-pipeline.ts` | ≥250行 | 选因子→计算→信号灯渲染 |
| A2 | 35🟢因子→FactorDataProvider适配 | `electron/engine/factors/adapters/index.ts` | ≥250行 | 各市场数据可达 |
| A3 | 管线性能监控: 端到端延迟+各环节耗时 | `electron/engine/factors/pipeline-metrics.ts` | ≥100行 | 端到端<3s |

### 🦐 QClaw (设计) — 推荐引擎+UX+文案

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Q1 | 因材施教推荐引擎设计: 用户画像→场景包推荐 | `docs/design/factor-recommendation-engine.md` | ≥200行 | 3档画像→场景包映射 |
| Q2 | 食材超市+菜包模式UX设计 | `docs/design/factor-supermarket-vs-combo.md` | ≥150行 | 自选vs一键包交互流程 |
| Q3 | 因子故事完整文案: 中英日3语主版本 | `docs/design/factor-stories-trilingual.md` | ≥200行 | 35因子×3语言=105条 |
| Q4 | 8场景包最终UX规范: 卡片+选择+动画 | `docs/design/scenario-pack-ux-final.md` | ≥150行 | 8场景包UX规范完整 |

### 🦐 youdao (测试) — 集成测试+E2E+缓存

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| Y1 | 因子数据适配集成测试: 3市场×35因子×信号灯 | `tests/integration/factor-data-adapter.test.ts` | ≥250行 | 105个适配测试pass |
| Y2 | 场景包端到端测试: 选场景→加载→IC→信号灯→UI | `tests/e2e/scenario-pack-flow.test.ts` | ≥150行 | E2E全流程pass |
| Y3 | 缓存命中率测试: 冷启动+热数据+过期 | `tests/unit/factor-cache.test.ts` | ≥100行 | 命中率>90% |
| Y4 | 3市场切换集成测试 | `tests/integration/market-switch.test.ts` | ≥100行 | 切换→因子过滤正确 |

### 🦐 Claw (PM) — Phase 1审计+验收+发布

| # | 任务 | 交付物 | 代码量 | 验收 |
|---|------|--------|--------|------|
| C1 | ✅ chat-bridge广播R186 | 广播消息 | — | 6虾确认 |
| C2 | R186 Round计划(本文档) | 验收标准+分工 | ≥300行 | 完整 |
| C3 | Phase 1全面审计报告 | R186-phase1-audit-report.md | ≥400行 | 35因子+信号灯+场景包全验收 |
| C4 | v2.5.0-alpha发布确认 | 发布确认文档 | ≥100行 | 里程碑确认 |

---

## ✅ 验收标准

### P0 必过 (14项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V01 | TSC | 0新增类型错误 | JVS/ML/autoclaw |
| V02 | FactorDataProvider | 3市场getFactorData()可调用 | JVS |
| V03 | 港股适配器 | 获取35🟢因子港股数据 | JVS |
| V04 | 美股适配器 | 获取35🟢因子美股数据 | JVS |
| V05 | 加密适配器 | 获取6个加密🟢因子数据 | JVS |
| V06 | 预处理管线 | MAD去极值+z-score 标准化可用 | JVS |
| V07 | 因子缓存 | 命中率>90% | JVS |
| V08 | 市场自动切换 | 选港股→过滤至港股+通用因子 | ML |
| V09 | 因子搜索(说人话) | "便宜好公司"→匹配3+因子 | ML |
| V10 | Onboarding 3步向导 | 3步流畅+各步可退出 | ML |
| V11 | Factor→Signal全链路 | 选因子→计算→IC→信号灯→UI | autoclaw |
| V12 | 35🟢因子数据适配 | 3市场数据源全部可达 | autoclaw |
| V13 | 集成测试 | 105个数据适配测试pass | youdao |
| V14 | 场景包E2E | 选场景→加载→信号灯→UI全流程 | youdao |

### P1 建议 (6项)

| ID | 验收项 | 标准 | 负责虾 |
|----|--------|------|--------|
| V15 | 管线性能 | 端到端<3s(含计算+渲染) | autoclaw |
| V16 | 缓存热数据 | 命中率>95% | JVS |
| V17 | 缓存冷启动 | <5s完成40因子预计算 | JVS |
| V18 | 因材施教推荐 | 3档画像→场景包映射完整 | QClaw |
| V19 | 食材超市vs菜包UX | 自选/一键包切换流畅 | QClaw |
| V20 | Build 0 error | 整体编译通过 | JVS/ML/autoclaw |

### Phase 1 总验收 (Meta)

| ID | 验收项 | 标准 |
|----|--------|------|
| M01 | 35🟢因子全部可计算+可渲染 | R185+R186联合验证 |
| M02 | 8场景包可选+因子组合正确 | 选场景→5-8因子加载 |
| M03 | 信号灯🟢🟡🔴⚪ 4色渲染 | IC→颜色映射正确 |
| M04 | 三级分类UI切换 | 🟢默认/🟡切换/🔴切换，无门槛 |
| M05 | 3市场数据适配 | 港股/美股/加密数据可达 |
| M06 | 8语言i18n | 35因子×8=280条无缺译 |
| M07 | TSC=0 + Build=0 | 无类型错误+编译通过 |
| M08 | ≥280测试pass | R185(175)+R186(105) |

---

## 🔑 关键规则 (R186)

1. **因子本身免费** — 信号灯/名称/基础IC = 免费
2. **深度服务按次收费** — 回测1U/诊断1U/优化1.5U/替代数据2U (v17.7)
3. **三级分类无门槛** — 纯信息分级，不限制使用
4. **不做A股** — KDJ除外(港美股加密通用)
5. **搜索必须支持说人话** — "便宜好公司" / "庄家吃货" / "跌太多了" → 因子映射
6. **8场景包命名**:
   - 牛市进攻(Bull Charge) / 熊市防御(Bear Shield) / 震荡轮动(Range Swing)
   - 加密趋势(Crypto Trend) / 价值掘金(Value Hunt) / 成长猎手(Growth Scout)
   - 港股窝轮(HK Warrant) / 美股财报(US Earnings)

---

## 🎯 v2.5.0-alpha 发布检查清单

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | 35🟢因子可计算(3市场) | ☐ |
| 2 | 信号灯4色渲染 | ☐ |
| 3 | 8场景包可选 | ☐ |
| 4 | 三级分类UI无门槛 | ☐ |
| 5 | 市场自动切换 | ☐ |
| 6 | 因子搜索(说人话) | ☐ |
| 7 | 8语言i18n 280条 | ☐ |
| 8 | TSC=0 | ☐ |
| 9 | Build=0 | ☐ |
| 10 | ≥280测试pass | ☐ |
| 11 | Phase 1审计报告 | ☐ |
| 12 | v2.5.0-alpha发布确认 | ☐ |

---

## 📎 参考文件

- Master Plan: `docs/proposals/factor-expansion-R184-R193-master-plan.md`
- 因子清单v2: `docs/proposals/factor-expansion-12shrimp-consolidated-checklist-v2.md`
- R184 Round计划: `docs/proposals/factor-expansion-R184-round-plan.md`
- R185 Round计划: `docs/proposals/factor-expansion-R185-round-plan.md`
- R185 验收报告: `docs/proposals/factor-expansion-R185-verification-report.md`
- 收费目录v17.7: `Desktop/TradingEasy-收费目录-v17.7.txt`
- 费率体系: `docs/reference/fee-schedule.md`
