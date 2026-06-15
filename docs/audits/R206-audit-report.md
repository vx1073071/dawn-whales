# 📋 R206 审计报告 — 跨市场+AI专属模板23个+场景包+AI模板卡片(71模板总量)

> **PM Claw** | 2026-06-16 | R206 PM Audit

---

## 一、R205 验收结论

### ✅ 确认交付

| 虾 | R205交付 | 代码量 | 状态 |
|---|---------|:------:|:----:|
| autoclaw#2+#3+#4 | factor-strategy-templates.ts (日韩4+台新澳4+欧印3=11模板, 总量944行/24模板) | +373L | ✅ TSC 0 |
| JVS#1 | 商品6模板 | — | ⚠️ 未确认 |
| JVS#5 | 美股补充3 | — | ⚠️ 未确认 |
| ML#6+#7 | MarketFilterTab+WeightSlider | — | ⚠️ 未确认 |
| QClaw#8 | 20模板i18n | — | ⚠️ 未确认 |
| youdao#9 | 跨市场测试 | — | ⚠️ 未确认 |

### autoclaw R205 交付详情

| 市场 | 模板数 | 模板ID |
|------|:----:|------|
| 🇯🇵🇰🇷 日韩 | 4 | JPX价值修复/NISA定投/KRX动量/KRX出口周期 |
| 🇹🇼🇸🇬🇦🇺 台新澳 | 4 | TWSE电子除权息/SGX金融高息/ASX资源Franking/NSE IT外包 |
| 🇪🇺🇮🇳 欧印 | 3 | STOXX ESG溢价/NSE通胀对冲/Nifty50轮动 |
| **合计** | **11** | 全部四铁律+因子权重100%+3-5 AI触发 |

**模板总量**: autoclaw侧 **24/88 (27%)** (13 R204 + 11 R205)

---

## 二、R206 核心差距分析

### 🔥🔥 重大发现: ScenarioPackSelector 已存在！

| 模块 | R206需求 | 现有资产 | 差距 |
|------|---------|---------|------|
| **ScenarioPack.tsx** | 8场景(牛市/熊市/震荡/加密/价值/成长/港股窝轮/美股财报) | ✅ `ScenarioPackSelector.tsx` (R185, 8场景+L1/L2/L3分级+故事+一键应用) | ⚠️ 需调整为R206场景名, 增量港股窝轮+美股财报 |

**现有8场景 vs R206需求**:

| 现有(R185) | R206需求 | 匹配 |
|------|------|:---:|
| 🐂 牛市进攻 | 牛市进攻 | ✅ |
| 🛡️ 稳健防守 | 熊市防御 | ⚠️ 需重命名/调整 |
| 🔄 震荡轮动 | 震荡轮动 | ✅ |
| 📈 加密趋势 | 加密趋势 | ✅ |
| ⛏️ 价值掘金 | 价值掘金 | ✅ |
| 🦅 成长猎手 | 成长猎手 | ✅ |
| 🌈 全天候均衡 | — | 可保留或替换 |
| ⚡ 衍生品信号 | — | 可保留或替换 |
| — | **港股窝轮** | ❌ 需新增 |
| — | **美股财报** | ❌ 需新增 |

> **ML#5 ScenarioPack工作量降级**: 6/8场景已存在, 仅需新增2个+MarketStateEngine联动+DeepSeek计费 → **4h即可** (原6h)

### 不存在模块 (需新建)

| 模块 | 负责虾 | 难度 | 说明 |
|------|--------|:----:|------|
| 跨市场8模板 | JVS#1 | 🔴 | 全天候/风险平价/全球配置/多资产/对冲/套利/通胀/衰退 — 全新模板类型 |
| AI专属10模板 | autoclaw#2 | 🔴 | AI动量/价值/套利/择时/风控/组合/选股/行业/事件/调仓 — 每个含DeepSeek对话触发 |
| 美股补充5模板 | JVS#3 | 🟢 | 小盘/大盘/期权覆盖/分红贵族/ESG |
| **AITemplateCard.tsx** | ML#4 | 🔴 | AI触发按钮+DeepSeek对话面板+计费+降级链 — 全新组件, 无现有基础 |
| ScenarioPack升级 | ML#5 | 🟡 | 从6h→4h, 基于ScenarioPackSelector.tsx增量 |
| 23模板i18n | QClaw#6 | 🟢 | 23×≤80字×9语言 |
| AI扣费测试 | youdao#7 | 🟡 | 触发→1U/1.5U→失败退费 |

### 可复用基础设施

| 资产 | R206用途 | 复用度 |
|------|---------|:------:|
| **ScenarioPackSelector.tsx** (R185) | ML#5直接升级, 6/8场景已存在 | **75%** |
| FactorMarketIntegration.tsx | ML#5已集成ScenarioPackSelector | **50%** |
| factor-strategy-templates.ts (24模板) | autoclaw#2 AI模板复用Pattern+接口风格 | **80%** |
| TemplateEngine.ts + TemplateRegistry.ts | JVS#1+#3注册跨市场+美股模板 | **90%** |
| AIDegradationChain.ts (4级) | ML#4 降级链集成 | **100%** |
| ai-orchestrator.ts | ML#4 计费+AI执行管线 | **80%** |
| MarketStateEngine.ts (4态) | ML#5 场景推荐(市场状态→场景包) | **100%** |
| AICreator.tsx (R161) | ML#4复用AI对话UI模式 | **60%** |
| ModeSelector.tsx (R161) | ML#4复用3入口模式 | **40%** |

---

## 三、模板进度

| 阶段 | 轮次 | 新增 | 累计 | 占比 | 市场覆盖 |
|------|:----:|:----:|:----:|:---:|---------|
| R204 | 28 | 28 | 28 | 32% | 🇺🇸🇭🇰🪙+跨市场 |
| R205 | 20 | 20 | 48 | 55% | +🛢️🇯🇵🇰🇷🇹🇼🇸🇬🇦🇺🇮🇳🇪🇺 → **11市场全解锁** |
| **R206** | **23** | **23** | **71** | **81%** | +AI专属+美股扩展 |
| R207 | 17 | 17 | **88** | **100%** | 全量收官 |

---

## 四、关键风险与建议

### 🔴 风险1: AI模板DeepSeek对话触发链路复杂

**问题**: autoclaw#2需在模板定义中嵌入DeepSeek对话触发字段, ML#4需渲染对话面板并接入ai-orchestrator管线。两虾需协调接口协议
**建议**: autoclaw#2先定义AITemplate接口(含`deepseekTrigger`字段), ML#4基于此mock开发。接口约定: `{ templateId, triggerType, userInput?, maxTokens?, targetParams }`

### 🔴 风险2: AITemplateCard.tsx 无现有基础

**问题**: ML#4是全新组件(6h), 需DeepSeek流式对话+扣费+降级链+一键应用参数, 复杂度高
**建议**: 分2步——
- 先做AITemplateCard外壳+扣费标签+触发按钮 (3h)
- 再做DeepSeek对话面板(流式)+降级链+一键应用 (3h)

### 🟡 风险3: 跨市场模板因子覆盖

**问题**: 全天候/风险平价等跨市场模板需要多资产大类因子(股票+债券+商品+REIT+货币), 因子池可能覆盖不全
**建议**: JVS#1先确认258因子池中多资产因子可用性, 缺口因子用"占位(因子ID: placeholder_xxx)"标注

### 🟡 风险4: ScenarioPack为升级非新建

**问题**: ScenarioPackSelector.tsx已有8场景(R185, 以因子组合为主), R206需要MarketStateEngine联动+DeepSeek计费
**建议**: ML#5在ScenarioPackSelector基础上增加: ① MarketStateEngine hook(市场→推荐场景) ② DeepSeek trigger按钮 ③ 2个新场景(港股窝轮/美股财报)。工时4h

---

## 五、依赖顺序建议

```
🥇 JVS#1 跨市场8模板 (基于TemplateEngine, 7h)
🥇 autoclaw#2 AI专属10模板 (基于factor-strategy-templates.ts模式, 8h)
🥇 QClaw#6 23模板i18n (独立, 2h)
🥇 ML#5 ScenarioPack升级 (基于ScenarioPackSelector.tsx, 4h)
🥈 JVS#3 美股补充5 (等#1完成, 4h)
🥈 ML#4 AITemplateCard (全新, 6h, 可先mock UI后接IPC)
🏁 youdao#7 AI扣费测试 (等autoclaw#2 AI模板注册, 4h)
```

---

## 六、R206关键参数速查

| 参数 | 值 |
|------|-----|
| 目标模板数 | 23 (跨市场8+AI专属10+美股5) |
| R205后总量 | 48 (实际确认: autoclaw 24 + 待确认) |
| R206后总量 | 71/88 (81%) |
| AI专属模板 | 10个 (每个含DeepSeek对话触发) |
| 场景包 | 8个 (6已有+2新增) |
| 扣费链路 | AI触发→1U/1.5U→AIDegradationChain(4级)→失败退费 |
| 四铁律 | 23×4=92项 |
| AI触发点 | 23×3-5=69-115个 |
| i18n | 23×9语言=207条 |
| 总工时 | 35h |

---

*PM Claw | 2026-06-16 | R206 Audit — Phase 2跨市场+AI模板审计*
