# 🔬 QuantDesk Pro — 策略因子全链路独立审计报告
**审计日期**: 2026-06-14 | **审计人**: ML(lobster) | **项目版本**: v1.12.0 | **总建议数**: 32项

---

## 一、审计范围与现状总览

### 1.1 审计覆盖

| 层级 | 引擎/模块 | 文件数 | 代码行数 | 评级 |
|------|----------|--------|---------|:--:|
| **因子定义** | FactorCompatibilityEngine | 1 | ~380L | 🟢 A |
| **多因子选股** | MultiFactorModel (Q15) | 1 | ~350L | 🟡 B+ |
| **因子筛选** | MultiFactorSelector (JVS-56) | 1 | ~350L | 🟡 B+ |
| **因子研究** | FactorResearchEngine (J-72) | 1 | ~280L | 🟢 A- |
| **因子暴露** | FactorExposureAnalyzer (Q23) | 1 | ~320L | 🟡 B |
| **因子风险** | FactorRiskModel (Q35) | 1 | ~260L | 🟡 B |
| **因子云端** | FactorCloudServer (J-64) | 1 | ~150L | 🟢 A |
| **策略模板** | StrategyTemplates | 1 | ~320L | 🟢 A- |
| **策略信号** | SignalGenerator+Aggregator | 4 | ~600L | 🟡 B |
| **策略市场** | Marketplace+Export | 4 | ~400L | 🟡 B+ |
| **前端Store** | strategyStore | 1 | ~40L | 🔴 C |

**总计**: ~3,450L factor/strategy代码, 30+因子, 8个策略模板, 7个引擎

---

## 二、🔴 关键缺陷 (P0 — 立即修复, 影响核心体验)

### 2.1 因子权重0交互 — 用户看不到也改不了

**问题**: 
- `MultiFactorModel` 写死5因子权重 (sentiment 0.25 / capitalFlow 0.25 / dragonTiger 0.15 / fundHolding 0.20 / diagnosis 0.15)
- `MultiFactorSelector` 写死5因子权重 (momentum 0.25 / value 0.25 / quality 0.25 / volatility 0.15 / liquidity 0.10)
- **前端无任何UI可以调整这些权重** → 对用户来说这就是个黑盒
- strategyStore 只存策略列表, 不存权重配置

**人类使用习惯对照**:
> 散户想"最近市场情绪不好, 我想把sentiment权重调低, 让资本流向占主导" → 做不到  
> 机构用户想"我们是价值投资, value因子应该占40%" → 做不到

**建议**: 
```
P0-01: 权重可视化滑块 (P1轮 | 6h)
  - 因子权重组: 5个滑块, 总和自动归一化 (实时显示当前比例饼图)
  - "恢复默认"按钮 + "自适应"按钮 (=50$全部因子, 告诉用户"无偏好")
  - 预设方案: 动量型/价值型/均衡型/防御型 (一键切换权重配置)
  - 存储: localStorage 'dw-factor-weights' + strategyStore持久化
```

### 2.2 两套因子体系完全独立, 无法联动

**问题**:
- `MultiFactorModel` (Q15): 用 sentiment/capitalFlow/dragonTiger/fundHolding/diagnosis 打分
- `MultiFactorSelector` (JVS-56): 用 momentum/value/quality/volatility/liquidity 打分
- 它们是**两个完全独立、互不知道存在**的评分系统
- 同一个股票在两个系统中可能得到完全矛盾的评分

**人类使用习惯对照**:
> 用户看到"MultiFactor评分85分, 强烈推荐AAPL" → 去另一个页面看到"MultiFactorSelector评分42分, SELL" → 用户困惑: 到底信哪个?

**建议**:
```
P0-02: 统一因子框架 (P2轮 | 12h)
  - 合并两个引擎为 UnifiedFactorEngine
  - 引入 FactorCategory 枚举, 每个因子有唯一category
  - 前端显示: "基本面因子:76 + 技术因子:58 + 情绪因子:82 → 综合:72"
  - 子分数透明化: 总评分下展示每类因子的分数和方向
  - 废弃MultiFactorModel/MultiFactorSelector独立API, 统一为 factor:score
```

### 2.3 因子IC值全是硬编码常量, 不随市场变化

**问题**:
- `FactorCompatibilityEngine` 中30+因子都有 `typicalIC` 字段
- 这些IC值硬编码为常量 (如 MOM_12M: 0.045, VOL_60D: -0.042)
- **从不更新** — 过去牛市IC和现在熊市IC完全不同
- `FactorResearchEngine.computeIC()` 有计算逻辑但**没有被任何地方调用**

**人类使用习惯对照**:
> 动量因子过去一年IC=0.045, 但最近3个月IC已经变成-0.01了 → 用户还在用历史数据做决策 → 回撤

**建议**:
```
P0-03: 实时IC计算+指数移动平均 (P2轮 | 8h)
  - 每次回测/调仓时, 用最近252个交易日计算实际IC
  - 前端展示: "动量因子 IC: 当前0.032 | 历史0.045 | 趋势↓"
  - 因子失效警告: IC绝对值<0.01持续20天 → 黄牌警告
  - 因子拥挤度实时监控 (已有crowding字段但从未使用)
```

### 2.4 因子暴露引擎用随机数生成 factor returns

**问题**:
- `FactorExposureAnalyzer.estimateFactorReturns()` 内部:
```typescript
market: (0.08 / 252) * (1 + (Math.random() - 0.5) * 0.5)  // ← 随机数!
```
- `FactorRiskModel` 也有类似 `STANDARD_FACTOR_RETURNS` 用固定常量
- 这意味着**每次跑归因分析, 同样的持仓得出不同的结果**

**人类使用习惯对照**:
> 用户跑两次归因分析, 第一次说"Momentum主导, 贡献42%" → 第二次说"Market主导, 贡献38%" → 用户以为软件坏了

**建议**:
```
P0-04: 因子收益用真实数据计算 (P2轮 | 10h)
  - 从K线数据库获取 benchmark returns (QQQ/SPY/HSI)
  - SMB = 小盘指数 - 大盘指数 (如 IWM - SPY)
  - HML = 价值ETF - 成长ETF (如 IWD - IWF)
  - Momentum = MOM ETF - 基准
  - 用真实ETF价格计算每日因子收益, 零随机数
  - 没有ETF的市场 → Fama-French官网下载日频因子数据
```

### 2.5 策略模板与因子引擎零连接

**问题**:
- StrategyTemplates 定义了8个策略模板, 带有 `category: 'multi_factor'`
- 但 multi_factor 策略模板的参数只有 `preset/ minScore/ universeSize/ rebalanceFreq/ useSentiment` 5个
- **没有任何地方调用 FactorCompatibilityEngine.suggestFactors() 来推荐因子**
- 用户选"多因子量化"策略 → 得到的是一个空壳

**人类使用习惯对照**:
> 用户选择"量化多因子策略" → 期望看到"当前推荐: MOM_12M + HML + QUAL + LIQ, 这些因子在当前市场IC最高" → 实际什么也没有

**建议**:
```
P0-05: 策略模板关联因子推荐 (P2轮 | 8h)
  - 创建策略时: 根据市场+instrument类型 → FactorCompatibilityEngine.suggestFactors()
  - 策略详情页: 显示当前启用的因子列表 (来自FactorCompatibilityEngine)
  - 策略回测时: 因子暴露归因自动嵌入回测报告
  - 策略优化器: 自动扫参数空间 (因子权重+技术指标参数)
```

---

## 三、🟡 打磨缺口 (P1 — 体验不完整)

### 3.1 因子对比功能闲置

**现状**: `FactorResearchEngine.compareFactors()` 能排序因子IC, 但从未被前端调用  
**建议**: `P1-01: 因子对比仪表板 (6h)` — 雷达图+IC热力图+因子排名+历史IC曲线

### 3.2 因子兼容性引擎利用率极低

**现状**: `FactorCompatibilityEngine` 有 `suggestFactors()` / `getMarketCoverage()` / `checkCompatibility()` 全部逻辑  
**但前端从未调用任何一个方法** — 用户添加因子时不知道哪个因子适合当前市场  
**建议**: `P1-02: 添加因子时的智能筛选 (4h)` — 只显示兼容因子 + 不兼容因子灰显+原因提示

### 3.3 策略信号重复计算

**现状**: `StrategySignalGenerator` + `StrategySignalAggregator` + `SignalCorrelator` 三个独立模块  
但信号数据流不是管道式 — 同一个K线数据被三个模块各自独立拉取  
**建议**: `P1-03: 信号管道统一 (8h)` — QuoteFeed → FactorEngine → SignalPipeline → Aggregator (一次计算, 多个消费者)

### 3.4 回测结果无因子归因

**现状**: 回测引擎输出 sharpe/maxDD/年化收益, 但不输出因子暴露  
`FactorExposureAnalyzer.analyzeAttribution()` 有完整逻辑但**不在回测管道中**  
**建议**: `P1-04: 回测嵌入因子归因 (6h)` — 每个回测结果自动附带 factor attribution + 主导因子标注 + R²解释度

### 3.5 因子市场无社交信号

**现状**: `FactorCloudServer` 只有签名验证, 没有策略共享/订阅/回测验证的社交功能  
**建议**: `P1-05: 因子市场 + 策略市场合并 (10h)` — 统一marketplace, 因子/策略/信号三合一 (在v17.6收费模型中因子市场本身就是核心收入)

### 3.6 策略优化器只调技术参数, 不调因子权重

**现状**: `StrategyOptimizer` 遍历 MACD快慢线/RSI周期等参数  
**但不调整因子权重** — momentum/value/quality/volatility/liquidity 全都是写死的  
**建议**: `P1-06: 优化器加入因子权重扫描 (6h)` — 多目标优化: max(Sharpe, |IC|×weight) 同步调整

### 3.7 因子衰减从未可视化

**现状**: `FactorResearchEngine.computeDecay()` 有 decayCurve + halfLife  
**前端零展示** — 用户不知道动量因子还能用多久  
**建议**: `P1-07: 因子衰减曲线图 (4h)` — 折线图: IC × lag days, 标注半衰期, 颜色按衰减速度

### 3.8 多空收益不可视

**现状**: `FactorResearchEngine.computeFactorReturn()` 有 longReturn/shortReturn/longShortSpread  
**前端零图表** — 用户不知道做多高因子分 vs 做空低因子分能赚多少  
**建议**: `P1-08: 多空组合收益图 (4h)` — 累计收益曲线 + 每月多空收益柱状图

---

## 四、🔵 体验优化 (P2 — 人类使用习惯)

### 4.1 用户不懂因子是什么意思

**现状**: 因子名全是英文缩写 (MOM_12M, HML, RMW, CMA, SMB)  
**问题**: 散户用户看到这些缩写一脸茫然  
**建议**: `P2-01: 因子百科卡片 (3h)` — hover因子名 → popover: 中文名 + 一句话解释 + 当前IC + "这个因子就像XXX"

### 4.2 没有因子组合健康检查

**建议**: `P2-02: 因子组合诊断 (4h)` — 检查: 相关性过高(>0.7)/因子拥挤/风格漂移/暴露过度

### 4.3 因子得分不变色

**建议**: `P2-03: 视觉反馈 (2h)` — 绿色→红色渐变, 分数变化↑↓箭头, 排名变化动画

### 4.4 无因子绩效追踪

**建议**: `P2-04: 因子绩效仪表板 (6h)` — 每个因子的: 月度IC/累计收益/最大回撤/胜率/换手率

### 4.5 策略回测对比无因子维度

**建议**: `P2-05: 多策略因子对比 (4h)` — 3个策略并排: 各因子暴露雷达图 + 主导因子标注

### 4.6 没有"我的因子偏好"保存

**建议**: `P2-06: 个人因子画像 (4h)` — 保存: 常选市场/偏好策略类型/常用因子权重 → 新策略自动预填

### 4.7 AI辅助因子选择缺失

**现状**: 项目有 `ai-signal-bridge.ts` 和 `strategy-explainer.ts`  
**但AI不参与因子推荐**  
**建议**: `P2-07: AI因子助手 (6h)` — "我想要高成长低波动" → AI推荐因子组合 + 解释为什么 + 回测预览

### 4.8 因子更新通知缺失

**建议**: `P2-08: 因子异动通知 (3h)` — IC突变/因子失效/新因子上线 → toast通知

### 4.9 无移动端因子监控

**建议**: `P2-09: 移动端因子卡片 (4h)` — 手机推送: "今日动量因子Top3: AAPL(+15%) MSFT(+12%) NVDA(+10%)"

### 4.10 因子文档不完整

**现状**: 30+因子公式在 `calculation` 字符串里, 但前端看不到  
**建议**: `P2-10: 因子公式浏览器 (3h)` — 因子详情页: 公式+论文引用+历史IC+适用市场+使用建议

### 4.11 策略状态管理过于简单

**建议**: `P2-11: strategyStore v2 (4h)` — 持久化+版本历史+策略快照+策略对比+导入导出

### 4.12 无A/B测试框架

**建议**: `P2-12: 策略A/B测试 (6h)` — 两个因子组合同时跑回测→对比: 谁Sharpe更高/DD更小

---

## 五、📊 建议路线图

### Round 136: 关键缺陷修复 (P0 | 44h)
| # | 任务 | 工时 |
|---|------|------|
| P0-01 | 权重可视化滑块 | 6h |
| P0-02 | 统一因子框架 | 12h |
| P0-03 | 实时IC计算 | 8h |
| P0-04 | 真实数据替代随机数 | 10h |
| P0-05 | 策略模板关联因子推荐 | 8h |

### Round 137: 打磨缺口 (P1 | 48h)
| # | 任务 | 工时 |
|---|------|------|
| P1-01 | 因子对比仪表板 | 6h |
| P1-02 | 智能因子筛选 | 4h |
| P1-03 | 信号管道统一 | 8h |
| P1-04 | 回测嵌入因子归因 | 6h |
| P1-05 | 因子+策略市场合并 | 10h |
| P1-06 | 优化器加入因子权重 | 6h |
| P1-07 | 因子衰减曲线 | 4h |
| P1-08 | 多空组合收益图 | 4h |

### Round 138: 体验优化 (P2 | 49h)
| # | 任务 | 工时 |
|---|------|------|
| P2-01~12 | 12项体验优化 | 49h |

**总计**: **3轮 · 141h** (约18天)

---

## 六、最终评价

```
┌──────────────────────────────────────────┐
│          策略因子全链路评分卡             │
├──────────────┬───────┬──────────────────┤
│ 维度          │ 评分   │ 说明            │
├──────────────┼───────┼──────────────────┤
│ 因子覆盖      │ A  92 │ 30+因子×8市场   │
│ 因子定义      │ A  90 │ 公式/IC/兼容性全│
│ 打分引擎      │ B  72 │ 两套独立需整合  │
│ 因子研究      │ A- 85 │ IC/IR/衰减完整  │
│ 因子暴露      │ B  68 │ 用随机数严重    │
│ 因子风险      │ B  70 │ Barra框架对   │
│ 策略模板      │ A- 82 │ 8模板完整      │
│ 前端交互      │ C  55 │ 权重0暴露      │
│ 数据鲜活      │ D  40 │ IC硬编码+随机数 │
│ UI/UX完整     │ D  38 │ 大量引擎未接UI │
├──────────────┼───────┼──────────────────┤
│ 综合          │ B- 65 │ 引擎扎实→缺最后一公里│
└──────────────┴───────┴──────────────────┘
```

**核心判断**: 因子引擎的底层能力扎实 (30+因子/IC计算/Barra模型/Fama-French), 但**引擎→用户之间的桥梁断了**:

1. 权重不可调 — 最严重的体验断层
2. 两套打分体系独立 — 结构性问题
3. 因子收益用随机数 — 学术级笑话
4. 大量引擎功能未暴露到UI — 买了法拉利只开了收音机

PM, 这32项建议覆盖从底层引擎修复到前端体验优化的全链路。建议R136-R138作为下一批冲刺目标。
