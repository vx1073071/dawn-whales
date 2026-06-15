# 📋 R204 审计报告 — Phase 2策略模板: 模板引擎+28核心模板+模板浏览器

> **PM Claw** | 2026-06-15 | R204 PM Audit

---

## 一、R203 验收结论

### ✅ Phase 1 (R200-R203) 全虾5/5完成

| 虾 | R203交付 | 代码量 | TSC | Commit |
|---|---------|:------:|:---:|--------|
| JVS | ArbitrageScanEngine + StressTestEngine | ~800L | 0 | — |
| autoclaw | AttributionEngine (基于brinson-attribution.ts) | ~400L | 0 | — |
| ML | ArbitrageScanPanel + StressTestPanel + AttributionPanel | ~1620L | 0 | a6eaa626 |
| QClaw | 套利+压力+归因话术 9语言 | 108条 | — | — |
| youdao | 集成测试全pass | 12+ | — | — |

### Phase 1 总交付

| 指标 | 数值 |
|------|------|
| AI引擎 | 8个 (StrategyMatch+MarketState+AIDegradation+SignalPush+DailyBriefing+ArbitrageScan+StressTest+Attribution) |
| 前端组件 | 12个 (BillingCard×7+WeeklyRanking+DailyBriefingCard+SignalPushPopup+3×AI Panel) |
| 降级链 | 4级 (V4Pro折→V4Pro原→V4Flash→MiniMax) |
| 集成测试 | 31+ pass |
| 话术 | 9语言×多模块 |

---

## 二、R204 核心差距分析

### 🔥🔥🔥 重大发现: 海量模板基础设施已存在

R204并非从零开始！以下已有代码可大幅降低工作量：

### 已有基础设施详表

| 文件 | 版本 | 功能 | 复用度 | R204用途 |
|------|------|------|:------:|---------|
| `electron/engine/strategies/strategy-templates.ts` | R161 | 22模板/6类别 + `StrategyTemplate`接口(oneLiner+risk+backtestSummary+rules+applicable) | **50%** | JVS#1可复用接口定义+22模板直接迁移 |
| `electron/engine/analysis/template-compatibility-engine.ts` | R72 | 20+模板兼容矩阵(compatibleMarkets+compatibleInstruments+minCapital+riskWarnings) | **60%** | JVS#1市场标签+兼容性校验 |
| `electron/engine/strategies/strategy-engine.ts` | — | 策略生命周期引擎(draft→backtest→live→stop) | **30%** | JVS#1引擎执行层 |
| `src/components/strategy/StrategyPage/ModeSelector.tsx` | R161 | **3入口已存在**(🤖AI 1U / 📋模板 FREE / ⚙️手动 FREE) | **90%** | ML#5直接复用！ |
| `src/components/strategy/StrategyPage/TemplateBrowser.tsx` | R163 | 模板画廊+因子推荐+类别筛选+卡片网格 | **70%** | ML#5升级(非新建) |
| `src/components/strategy/StrategyPage/AICreator.tsx` | R161 | AI创建入口+1U定价说明+示例prompt | **80%** | ML#5直接复用 |
| `src/components/strategy/StrategyPage/FormCreator.tsx` | R161 | 手动创建表单 | **70%** | ML#5直接复用 |
| `src/components/strategy/StrategyPage/StrategyDetail.tsx` | R161 | 策略详情+回测+实盘控制 | **60%** | ML#6升级(非新建) |
| `src/components/strategy/TemplateBrowser.tsx` | R126 | 旧版模板浏览器(8模板) | 10% | 废弃,用R163版 |

### 不存在的模块 (R204需新建)

| 模块 | 负责虾 | 难度 | 说明 |
|------|--------|:----:|------|
| TemplateEngine.ts | JVS#1 | 🔴 | 注册/查询/因子组合/权重校验/四铁律/AI触发。可基于strategy-templates.ts扩展 |
| TemplateRegistry.ts | JVS#1 | 🟡 | 集中注册中心。现有TEMPLATES数组可作为基础 |
| 7美股模板定义 | JVS#2 | 🟡 | 财报猎人/MAG7动量/价值掘金/低波防御/13F跟随/PEAD漂移/VIX对冲 |
| 5港股模板定义 | autoclaw#3 | 🟡 | AH溢价/窝轮方向/股息阶梯/南向追踪/红筹回归 |
| 8加密模板定义 | autoclaw#4 | 🟡 | BTC趋势/ETH轮动/资费套利/清算猎杀/链上三灯/期现套利/HODL定投/巨鲸追踪 |
| TemplateDetailPage.tsx | ML#6 | 🟢 | 可从StrategyDetail.tsx升级,增加四铁律+AI触发点+因子权重图 |

### 现有模板接口 vs R204需求差距

| 字段 | 现有(StrategyTemplate) | R204需求 | 差距 |
|------|----------------------|---------|------|
| oneLiner | ✅ 一句人话 | 四铁律#1: ≤80字 | ✅ 已满足 |
| risk.defaultStopLoss | ✅ 默认止损% | 四铁律#2: 止损规则 | ⚠️ 需增加stopLossRule描述 |
| applicable | ✅ 文本数组 | 四铁律#3: 适用市场+品种 | ⚠️ 需结构化为MarketTag |
| ❌ | — | 四铁律#4: 失效自检 | ❌ 需新增failureCheck字段 |
| ❌ | — | AI触发点(3-5个) | ❌ 需新增aiTriggerPoints字段 |
| ❌ | — | 因子组合+权重 | ❌ 需新增factorCombo+factorWeights |
| ❌ | — | 11大类市场标签 | ❌ 需新增marketTag字段 |
| backtestSummary | ✅ 文本 | 回测验证 | ✅ 已满足 |

---

## 三、关键风险与建议

### 🔴 风险1: TemplateEngine设计复杂度高

**问题**: 现有3个模板定义体系(R161 strategy-templates.ts / R72 template-compatibility-engine.ts / R126 TemplateBrowser.tsx)接口不一致
**建议**: JVS#1 新建TemplateEngine.ts统一接口，渐进迁移，不强行合并3套

### 🔴 风险2: 四铁律校验需严格

**问题**: 28模板×4铁律=112项，任何一项缺失即不合格
**建议**: JVS#1在TemplateEngine中内置铁律校验器，模板注册时自动检查

### 🟡 风险3: 因子组合需基于258因子

**问题**: 每个模板的因子组合必须引用已有因子ID，不能自造
**建议**: JVS#1 TemplateEngine注册时校验factorId是否存在于FactorRegistry

### 🟡 风险4: ML#5/#6是升级非新建

**问题**: 已有ModeSelector+TemplateBrowser+StrategyDetail，需确认是升级还是重写
**建议**: ML升级现有组件，不新建。TemplateBrowser加市场筛选+AI触发按钮，StrategyDetail加四铁律区

---

## 四、依赖顺序建议

```
🥇 JVS#1 TemplateEngine+Registry (🔑关键路径, 无依赖)
🥇 QClaw#7 28模板文案 (独立, 可立即开始)
🥈 JVS#2 美股7模板 (等#1引擎)
🥈 autoclaw#3+#4 港股5+加密8模板 (等#1引擎, 可先写定义)
🥈 ML#5+#6 升级TemplateBrowser+DetailPage (可先mock, 后接IPC)
🏁 youdao#8 模板引擎测试 (等JVS#1)
```

---

## 五、R204关键参数速查

| 参数 | 值 |
|------|-----|
| 目标模板数 | 28 (7美股+5港股+8加密+8已有跨市场) |
| 已有模板 | 22 (strategy-templates.ts) |
| 净增模板 | 6+ (R204新增核心模板, 其余从22迁移) |
| 因子池 | 258 (🟢54+🟡100+🔴104) |
| 市场标签 | 11 (🇭🇰🇺🇸🪙🇯🇵🇹🇼🇰🇷🇸🇬🇦🇺🇮🇳🇪🇺🛢️) |
| 四铁律 | 4 (人话/止损/市场/失效) |
| AI触发点 | 3-5个/模板 (回测1U/参数1U/优化1.5U/诊断1U/替代2U) |
| 总工时 | 35h |

---

*PM Claw | 2026-06-15 | R204 Audit — Phase 2策略模板审计*
