# 📋 R203 PM 审计报告

> **Claw(PM)** | 2026-06-15 | Phase 1 收官轮

---

## 一、R202 验收结论

| 虾 | 交付物 | 行数 | TSC | Commit | 状态 |
|---|--------|:----:|:---:|--------|:----:|
| JVS | SignalPushEngine + DailyBriefingEngine | 861L | 0 | 2917c41b | ✅ |
| ML | DailyBriefingCard + SignalPushPopup | ~630L | 0 | e832636f | ✅ |
| autoclaw | signal-push-pipeline-R202.md | 14.4KB | — | — | ✅ |
| QClaw | 108条话术(9语言×18组) | — | — | c57e4772 | ✅ |
| youdao | 31个集成测试 | 31 pass | — | — | ✅ |

**R202 验收标准全达标** ✅

---

## 二、R203 核心差距

**5个新模块不存在**：

| 模块 | 负责虾 | 状态 | 可复用基础 |
|------|--------|:----:|-----------|
| ArbitrageScanEngine.ts | JVS#1 | ❌ 不存在 | SignalPushEngine(推送模式) + MarketStateEngine(市场数据) |
| StressTestEngine.ts | JVS#2 | ❌ 不存在 | **stress-test-v2.ts**已有场景+蒙特卡洛基础 |
| AttributionEngine.ts | autoclaw#3 | ❌ 不存在 | **brinson-attribution.ts**已有完整Brinson归因! |
| StressTestReport.tsx | ML#4 | ❌ 不存在 | **PortfolioStressTest.tsx**已有场景+echarts图! |
| AttributionReport.tsx | ML#5 | ❌ 不存在 | **PerformanceAttributionPage.tsx**已有饼图+归因数据! |

---

## 三、关键发现 — 大量可复用基础设施 🎯

### 3.1 引擎层已有代码

| 现有文件 | 功能 | R203用途 | 复用度 |
|---------|------|---------|:------:|
| `electron/engine/risk/stress-test-v2.ts` | 场景压力测试+相关性冲击+流动性冲击 | JVS#2 StressTestEngine基础 | **80%** |
| `electron/engine/portfolio/brinson-attribution.ts` | Brinson-Fachler完整归因(配置+选择+交互效应) | autoclaw#3 AttributionEngine核心 | **90%** |
| `electron/engine/portfolio/performance-attribution.ts` | 绩效归因+因子贡献 | autoclaw#3 因子归因补充 | **70%** |
| `electron/engine/portfolio/performance-analytics.ts` | 绩效分析 | autoclaw#3 数据源 | **50%** |

### 3.2 前端层已有代码

| 现有文件 | 功能 | R203用途 | 复用度 |
|---------|------|---------|:------:|
| `src/components/risk/PortfolioStressTest.tsx` | 场景选择+echarts损失分布图+6场景 | ML#4 StressTestReport基础 | **70%** |
| `src/components/strategy/PerformanceAttributionPage.tsx` | 归因饼图+月度归因+行业归因 | ML#5 AttributionReport基础 | **75%** |

### 3.3 计费层

| 层级 | 状态 | 说明 |
|------|:----:|------|
| factor-billing-gateway.ts (23触点) | ✅ 已含3个R203触点 | AI_ARBITRAGE_SCAN(2U) + AI_STRESS_TEST(2U) + AI_PORTFOLIO_ATTRIBUTION(1.5U) |
| ai-billing.ts (AIServiceType) | ⚠️ 仍4个 | 需+3个: ARBITRAGE_SCAN/STRESS_TEST/ATTRIBUTION |
| AIDegradationChain.ts (4级) | ✅ R201完成 | 3引擎直接复用 |

---

## 四、ai-billing.ts 差距

**当前**: 4个 AIServiceType (DRAW_LINES/CHAT/PARAM_FILL/PATTERN_RECOG)

**R203需新增3个**:
```typescript
| 'AI_ARBITRAGE_SCAN'     // 2U/次
| 'AI_STRESS_TEST'        // 2U/次
| 'AI_PORTFOLIO_ATTRIBUTION' // 1.5U/次
```

**AI_PRICE_TABLE 需新增**:
```typescript
AI_ARBITRAGE_SCAN:        { priceUSDT: 2,   label: 'AI Arbitrage Scan' },
AI_STRESS_TEST:           { priceUSDT: 2,   label: 'AI Stress Test' },
AI_PORTFOLIO_ATTRIBUTION: { priceUSDT: 1.5, label: 'AI Portfolio Attribution' },
```

---

## 五、各虾详细差距与建议

### JVS#1: ArbitrageScanEngine (8h)

**不存在，需新建**。建议架构:
- 输入: 跨市场比价数据(AH溢价/ADR折价/ETF折溢价)
- 核心: 实时溢价计算 + 阈值触发(>3%) + DeepSeek解读
- 计费: 2U/次 via AIDegradationChain
- 推送: 可复用SignalPushEngine的推送模式

**可参考**: SignalPushEngine.ts的推送模式 + MarketStateEngine.ts的市场数据读取

### JVS#2: StressTestEngine (8h)

**不存在，但stress-test-v2.ts已有80%基础**。关键差距:
- stress-test-v2.ts: 场景定义+冲击计算+相关性冲击 ✅
- 缺失: 蒙特卡洛模拟(N次随机路径) + 损失分布直方图 + 历史场景库(2008/2020/2022) + AI解读
- 缺失: 2U计费集成 + AIDegradationChain调用
- 缺失: IPC暴露给前端

**建议**: 基于stress-test-v2.ts封装StressTestEngine，新增蒙特卡洛+AI解读+计费

### autoclaw#3: AttributionEngine (6h)

**不存在，但brinson-attribution.ts已有90%核心逻辑**。关键差距:
- brinson-attribution.ts: Brinson分解(配置+选择+交互) ✅
- performance-attribution.ts: 因子贡献+行业归因 ✅
- 缺失: 因子归因(哪些因子驱动了收益) + 残差分析 + AI解读
- 缺失: 1.5U计费集成 + AIDegradationChain调用
- 缺失: server/services/层独立引擎(现有在electron/engine/)

**建议**: 封装brinson-attribution + performance-attribution为AttributionEngine，新增因子归因+残差+AI+计费

### ML#4: StressTestReport (4h)

**不存在，但PortfolioStressTest.tsx已有70%**。关键差距:
- PortfolioStressTest.tsx: 场景选择+echarts图+6场景 ✅
- 缺失: 2U计费标签 + AI建议区 + 蒙特卡洛分布图 + IPC对接
- 缺失: 与StressTestEngine的IPC桥接

**建议**: 基于PortfolioStressTest.tsx改造，新增2U标签+AI建议+分布图

### ML#5: AttributionReport (4h)

**不存在，但PerformanceAttributionPage.tsx已有75%**。关键差距:
- PerformanceAttributionPage.tsx: 归因饼图+月度+行业 ✅
- 缺失: 1.5U计费标签 + 因子贡献饼图 + 残差展示 + IPC对接

**建议**: 基于PerformanceAttributionPage.tsx改造，新增1.5U标签+因子饼图+残差

---

## 六、依赖顺序(建议)

| 优先级 | 虾 | 任务 | 理由 |
|:------:|---|------|------|
| 🥇 | JVS#1+#2 | 双引擎(基于已有代码增量) | 无外部依赖，可立即开始 |
| 🥇 | autoclaw#3 | 归因引擎(基于brinson增量) | 无外部依赖 |
| 🥇 | QClaw#6 | 3功能话术 | 独立 |
| 🥈 | ML#4+#5 | 2个前端(基于已有组件改造) | 可先mock后接IPC |
| 🏁 | youdao#7 | 集成测试 | 等JVS+autoclaw全部完成 |

---

## 七、风险

| 风险 | 概率 | 影响 | 缓解 |
|------|:----:|:----:|------|
| 套利扫描引擎需跨市场实时数据 | 中 | 高 | JVS#1先用模拟数据，R208接入VIP数据通道 |
| 蒙特卡洛模拟计算量大 | 低 | 中 | 限定模拟次数(1000-5000)+异步计算+进度条 |
| 已有归因/压力测试代码风格/接口不一致 | 中 | 中 | JVS/autoclaw新建Engine统一封装，旧代码仅作参考 |
| ai-billing.ts扩展4→7个AIServiceType | 低 | 低 | 3个新增简单，直接加type+price |

---

## 八、Phase 1 进度总结

| 轮次 | 状态 | 核心交付 |
|:----:|:----:|---------|
| R200 | ✅ | v17.9计费23触点+执行服务费5类+创作者审核1U |
| R201 | ✅ | StrategyMatch+MarketState+AIDegradationChain 3引擎 |
| R202 | ✅ | SignalPush+DailyBriefing 2引擎+2前端 |
| R203 | 🔄 | ArbitrageScan+StressTest+Attribution 3引擎+2前端(Phase 1收官) |

**R203完成后Phase 1全部完成**，进入Phase 2: 88策略模板(R204-R208)

---

*Claw(PM) | 2026-06-15 | R203 审计报告*
