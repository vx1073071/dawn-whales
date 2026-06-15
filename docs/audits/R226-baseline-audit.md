# 🦐 R226 审计基线报告 — v2.5.0-alpha 启动前状态

> **日期**: 2026-06-16 06:45 | **PM**: 🦐 Claw
> **目的**: 建立R226启动前的精确基线，为验收提供对比基准

---

## 一、TSC基线

| 指标 | 数值 | 说明 |
|------|------|------|
| 全项目TSC errors | 695 | 预存(Admin/其他非因子区) |
| **R226域TSC errors** | **0** ✅ | factors/strategies/i18n/broker/workers 0 error |

---

## 二、因子i18n覆盖率基线

| 指标 | 数值 |
|------|------|
| 注册表因子总数 | 240 |
| i18n-map因子条目 | 304 (含196幽灵) |
| 注册表有i18n | 108 (45%) |
| 注册表缺i18n | 132 (55%) |
| i18n-map有但注册表无(幽灵) | 196 |
| **目标** | **240/240 (100%)** |

---

## 三、Calculator映射基线

| 文件 | 声称覆盖 | 确认匹配注册表 | 状态 |
|------|----------|----------------|------|
| pro-factor-calculators.ts | ~30 | 2 | ⚠️ |
| final-red-factors.ts | ~31 | 1 | ⚠️ |
| market-red-factors.ts | ~30 | 1 | ⚠️ |
| green-factor-calculators.ts | ~30 | 0 | ❌ |
| yellow-factor-calculators.ts | ~40 | 1 | ⚠️ |
| market-yellow-calculators.ts | ~36 | 0 | ❌ |
| **合计** | ~197 | **5** (2.5%) | 🔴 |

> 仅有5个确认映射: `F_FAMA_FRENCH`, `F_FAMA_FRENCH_5F`, `F_CARRY`, `F_MOM`, `F_LIQUIDITY`

---

## 四、5条数据断链基线

| # | 链路 | 状态 | 说明 |
|---|------|------|------|
| 1 | broker→IPC | 🔴 断 | 适配器代码存在但消息管道未接 |
| 2 | IPC→bridge | 🔴 断 | bridge进程启动但无路由 |
| 3 | bridge→engine | 🔴 断 | engine接收端存在但无注册 |
| 4 | engine→UI | 🔴 断 | 计算完成但事件未emit到renderer |
| 5 | UI→渲染 | 🔴 断 | ChartContext/IndicatorWorker代码存在但0引用 |

---

## 五、ErrorBoundary基线

| 版本 | 位置 | 状态 |
|------|------|------|
| v1 | `src/components/ErrorBoundary.tsx` | 存在，0处引用 |
| v2 | `src/components/common/ErrorBoundary.tsx` | 存在，0处引用 |
| v3 | `src/components/shared/ErrorBoundary.tsx` | 存在，0处引用 |
| **应用状态** | | 🔴 0/3个被应用到因子页面 |

---

## 六、R226成功标准 (对比基线)

| 指标 | 基线 | 目标 | 验证方法 |
|------|------|------|----------|
| 因子i18n | 108/240 (45%) | 240/240 (100%) | grep验证+CI校验 |
| Calculator映射 | 5/240 (2.5%) | 240/240 (100%) | 校验脚本+youdao验证 |
| 数据链路 | 0/5 (0%) | 5/5 (100%) | 端到端测试 |
| ErrorBoundary | 3版本0应用 | 1版本应用到因子页 | 代码审查 |
| R226域TSC | 0 errors | 0 errors | tsc --noEmit |

---

## 七、5虾任务进度追踪

| 虾 | 任务数 | 工时 | 状态 | 上次报告 |
|----|--------|------|------|----------|
| 🦐 ML | 4 | 16h | ⏳ 待启动 | — |
| 🦐 JVS | 4 | 18h | ⏳ 待启动 | — |
| 🦐 autoclaw | 3 | 16h | ⏳ 待启动 | — |
| 🦐 QClaw | 2 | 10h | ⏳ 待启动 | — |
| 🦐 youdao | 2 | 6h | ⏳ 待启动 | — |

---

*基线报告完成: 2026-06-16 06:45 | 🦐 Claw (PM)*
