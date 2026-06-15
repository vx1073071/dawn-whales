# 📋 R205 审计报告 — 市场特化模板20个+11市场筛选+权重滑块(48模板总量)

> **PM Claw** | 2026-06-15 | R205 PM Audit

---

## 一、R204 验收结论

### ✅ 核心交付确认

| 虾 | R204交付 | 代码量 | 状态 |
|---|---------|:------:|:----:|
| JVS#1 | TemplateEngine.ts (完整四铁律+AI触发+11MarketTag+因子权重, ≥300L) | ~300L+ | ✅ |
| JVS#1 | TemplateRegistry.ts (注册+四铁律校验+AI触发≥3验证+market索引, ≥150L) | ~150L+ | ✅ |
| autoclaw#3+#4 | factor-strategy-templates.ts (13模板: 🇭🇰5+🪙8, 四铁律+AI触发+因子权重100%) | 571L | ✅ |
| QClaw#7 | 28模板人话描述 9语言×252条目 | — | ✅ commit f7b71373 |
| JVS#2 | 美股7模板 | — | ⚠️ 未确认 |
| ML#5+#6 | TemplateBrowser升级+TemplateDetailPage | — | ⚠️ 未确认 |
| youdao#8 | 模板引擎测试 | — | ⚠️ 未确认 |

### 🔑 TemplateEngine 接口审计

| 特性 | 实现 | 评价 |
|------|------|:---:|
| FactorCombo (factorIds+weights+formula) | ✅ | 权重校验(和=1.0) |
| FourIronRules (oneLiner+stopLossRule+marketScope+failureCheck) | ✅ | 铁律1/2/3/4全字段 |
| MarketTag (11类) | ✅ | US/HK/CRYPTO/JP/TW/KR/SG/AU/IN/EU/COMMODITY |
| AITriggerPoint (5类型) | ✅ | BACKTEST_READ/PARAM_FILL/OPTIMIZE/FACTOR_DIAGNOSE/ALT_DATA |
| AI_TRIGGERS prebuilt | ✅ | 5预设触发+定价(1U/1U/1.5U/1U/2U) |
| TemplateRegistry byMarket 索引 | ✅ | getByMarket() 按11市场查询 |

### ⚠️ 接口兼容性风险: 两套模板定义体系

| 维度 | TemplateEngine.ts (server) | factor-strategy-templates.ts (electron) |
|------|---------------------------|----------------------------------------|
| 主接口名 | `StrategyTemplate` | `FactorStrategyTemplate` |
| 四铁律字段 | `ironRules: FourIronRules` | `fourIronRules: TemplateFourIronRules` |
| 因子组合 | `factorCombo: FactorCombo` (权重和=1.0) | `factorCombo: FactorComboEntry[]` (权重和=100) |
| AI触发 | `aiTriggers: AITriggerPoint[]` (type enum) | `aiTriggerPoints: AITriggerPoint[]` (touchpointId string) |
| MarketTag | `'US'\|'HK'\|'CRYPTO'\|...` | `'🇺🇸'\|'🇭🇰'\|'🪙'\|...` (emoji) |

> **风险**: R205 20个新模板(autoclaw+JVS)需统一到TemplateEngine的`StrategyTemplate`接口，或建立适配层。建议autoclaw R205直接在factor-strategy-templates.ts旁新建`market-specialized-templates.ts`，复用已有接口风格。

---

## 二、R205 核心差距分析

### 不存在模块 (全部需新建)

| 模块 | 负责虾 | 难度 | 说明 |
|------|--------|:----:|------|
| 商品6模板 (COT聪明钱/基差猎人/展期收割/库存周期/金银比/实际利率黄金) | JVS#1 | 🟡 | 基于TemplateEngine注册，🛢️市场 |
| 日韩4模板 (JPX价值/NISA定投/KRX动量/KRX出口) | autoclaw#2 | 🟢 | 🇯🇵🇰🇷市场，基于factor-strategy-templates.ts模式 |
| 台新澳4模板 (TWSE电子除权息/SGX金融/ASX资源Franking/NSE IT) | autoclaw#3 | 🟢 | 🇹🇼🇸🇬🇦🇺🇮🇳市场 |
| 欧印3模板 (STOXX ESG/NSE通胀对冲/Nifty50轮动) | autoclaw#4 | 🟢 | 🇪🇺🇮🇳市场 |
| 美股补充3 (科技/医疗/消费) | JVS#5 | 🟢 | 🇺🇸市场补充 |
| **MarketFilterTab.tsx** | ML#6 | 🔴 | 11市场Tab+筛选+计数，无现有基础 |
| **WeightSlider.tsx** | ML#7 | 🟡 | 拖拽+权重校验=100%+实时预览 |
| 20模板i18n | QClaw#8 | 🟢 | 20×≤80字×9语言=180条目 |
| 跨市场测试 | youdao#9 | 🟡 | 20模板×四铁律+因子权重 |

### 现有可复用基础设施

| 资产 | 复用方式 | 复用度 |
|------|---------|:------:|
| TemplateEngine.ts + TemplateRegistry.ts | JVS#1+#5直接调用register() | 90% |
| factor-strategy-templates.ts (571L) | autoclaw#2+#3+#4复制接口模式 | 80% |
| TemplateRegistry.getByMarket() | ML#6 MarketFilterTab数据源 | 70% |
| AI_TRIGGERS prebuilt | 所有模板引用已定价的AI触发 | 100% |
| TemplateBrowser.tsx (R163) | ML#6可直接嵌入MarketFilterTab | 50% |

---

## 三、模板进度

| 阶段 | 轮次 | 新增 | 累计 | 市场覆盖 |
|------|:----:|:----:|:----:|---------|
| R204 | 28 | 28 | 28 | 🇺🇸7+🇭🇰5+🪙8+跨市场8 |
| **R205** | **20** | **20** | **48** | +🛢️6+🇯🇵2+🇰🇷2+🇹🇼1+🇸🇬1+🇦🇺1+🇮🇳2+🇪🇺1+🇺🇸3 |
| R206 | 23 | 30 | 71 | +跨市场8+AI 10+美股5 |
| R207 | 17 | 17 | **88** | +加密4+港股3+商品3+跨市场4+AI 3 |

**R205完成后: 48/88 (55%)，11市场全解锁 🎯**

---

## 四、关键风险与建议

### 🔴 风险1: 接口不一致导致注册失败

**问题**: TemplateEngine期望`StrategyTemplate`接口(ironRules+factorCombo(权重和=1.0)+MarketTag('US'/'HK'/'CRYPTO'...))，而autoclaw的factor-strategy-templates.ts使用自己的`FactorStrategyTemplate`(fourIronRules+factorCombo(权重和=100)+MarketTag('🇺🇸'/'🇭🇰'/'🪙'...))
**建议**: autoclaw R205模板统一采用`FactorStrategyTemplate`接口(已有13个模板)，独立于TemplateEngine。待R206再统一适配层

### 🔴 风险2: MarketFilterTab复杂度高

**问题**: 11市场Tab+筛选+模板计数+跨市场搜索，ML#6估计6h可能偏紧
**建议**: 分2步——先11Tab+计数(MVP 4h)，再搜索+筛选增强(2h)。可复用现有ModeSelector卡片模式

### 🟡 风险3: 商品模板因子可用性

**问题**: 商品因子(🛢️)与股票/加密因子体系不同(COT/库存/基差等)
**建议**: JVS#1先确认258因子池中商品因子可用性，缺少的因子声明为"占位(待R208 VIP数据接入)"

### 🟡 风险4: WeightSlider独立组件无依赖

**问题**: ML#7 WeightSlider是全新交互组件(拖拽+实时预览+100%校验)，需4h到位
**建议**: 使用antd Slider+InputNumber组合, 布局参考"频率→权重→预览"三栏

---

## 五、依赖顺序建议

```
🥇 JVS#1 商品6模板 (基于TemplateEngine)
🥇 autoclaw#2+#3+#4 日韩+台新澳+欧印=11模板 (基于factor-strategy-templates.ts模式)
🥇 QClaw#8 20模板i18n (独立, 可立即开始)
🥇 ML#7 WeightSlider (独立, 可立即开始)
🥈 JVS#5 美股补充3 (等#1完成)
🥈 ML#6 MarketFilterTab (可先mock, 后接Registry)
🏁 youdao#9 跨市场测试 (等全部模板注册)
```

---

## 六、R205关键参数速查

| 参数 | 值 |
|------|-----|
| 目标模板数 | 20 (商品6+日韩4+台新澳4+欧印3+美股3) |
| R204已有模板 | 28 (实际确认15: 13 autoclaw + 至少TemplateEngine就绪) |
| R205后总量 | 48/88 (55%) |
| 市场新解锁 | 🛢️🇯🇵🇰🇷🇹🇼🇸🇬🇦🇺🇮🇳🇪🇺 8个 |
| 11市场全解锁 | ✅ R205达成 |
| 因子池 | 258 (🟢54+🟡100+🔴104) |
| 总工时 | 35h |
| 四铁律 | 20×4=80项 |
| AI触发点 | 20×3-5=60-100个 |
| i18n条目 | 20×9语言=180条 |

---

*PM Claw | 2026-06-15 | R205 Audit — Phase 2市场特化模板审计*
