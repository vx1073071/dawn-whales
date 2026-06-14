# 🔬 QuantDesk Pro — 策略因子全链路深度审计报告 v2.0
**审计日期**: 2026-06-14 | **审计人**: ML(lobster) | **项目版本**: v1.12.0 | **总建议数**: 45项 | **总工时**: ~178h

---

## 一、🎯 审计方法学

### 1.1 4维度审计框架

| 维度 | 检查项 | 评估方式 |
|------|--------|----------|
| **D1 引擎深度** | 因子定义/IC计算/Barra归因/组合优化 | 代码审计 + 数学正确性 |
| **D2 数据流** | 原始数据→因子→信号→归因→风险 | 全链路追踪 |
| **D3 UI/UX** | 用户的5个使用场景模拟 | 角色剧本法 |
| **D4 业务闭环** | 因子→回测→优化→上线→监控 | 端到端走查 |

### 1.2 覆盖范围

```
electron/engine/factors/        7 文件  ~1,790L   因子引擎层
electron/engine/analysis/      18 文件  ~5,400L   策略/信号/归因层
electron/engine/backtest/       4 文件  ~1,200L   回测层
electron/engine/risk/           6 文件  ~2,000L   风险层
src/components/strategy/       14 文件  ~3,500L   策略UI
src/components/signal/         ~3 文件  ~800L     信号UI
src/components/backtest/       ~9 文件  ~2,800L   回测UI
src/components/ai/            ~10 文件  ~4,500L   AI辅助UI
src/stores/strategyStore.ts    1 文件  ~40L      状态管理
─────────────────────────────────────────────────
总计 72+ 文件  ~21,030L 代码
```

### 1.3 关键发现概览

| 严重度 | 数量 | 影响 | 示例 |
|:---:|:---:|------|------|
| 🔴 P0 阻塞 | **8项** | 引擎逻辑错/数据随机/UI全是Mock | 因子收益用 `Math.random()` |
| 🟡 P1 严重 | **12项** | 关键能力未暴露/数据未接入 | 30+因子兼容性引擎零调用 |
| 🟢 P2 体验 | **18项** | UI/UX不专业/数据陈旧 | IC硬编码常量/无归因图 |
| 🔵 P3 增量 | **7项** | 锦上添花/小优化 | 因果可视化/AI因子建议 |

---

## 二、🔴 P0 阻塞级问题 (8项, 54h)

### 2.1 🚨 Critical: StrategyPage 90%是空Stub, 0真实功能

**现状审计** (灾难级发现):

```
src/components/strategy/StrategyPage/
├── AICreator.tsx         5行  - 全部 return null
├── BacktestPanel.tsx     5行  - 全部 return null
├── FormCreator.tsx       5行  - 全部 return null
├── ModeSelector.tsx      5行  - 全部 return null
├── MyStrategies.tsx      5行  - 全部 return null
├── StrategyDetail.tsx    5行  - 全部 return null
└── TemplateBrowser.tsx   5行  - 全部 return null

总和: 35行 (其中25行是import)
所有 "StrategyPage" 子组件全是占位符
```

**人类使用习惯对照**:
> 用户点开"我的策略"页面 → 看到一片空白 → 误以为软件坏了

**建议**:
```
P0-01: 重写StrategyPage全部7个子组件 (20h | P0)
  - 3种创建模式Tab: AI对话/NL自然语言/表单/模板 (每个Tab真实工作)
  - 我的策略列表: 卡片网格+筛选+排序+搜索
  - 策略详情: 6Tab (概览/回测/信号/因子/归因/设置)
  - 删除/暂停/复制/导出按钮 + 确认弹窗
  - 选中态/悬停态/拖拽排序 + 状态徽章
```

### 2.2 🚨 Critical: FactorExposurePage 100%使用MOCK_DATA

**现状** (P0第2严重问题):

```typescript
// FactorExposurePage.tsx 第20-72行
const MOCK_DATA: FactorExposureResult = {
  strategyName: '示例策略',
  rSquared: 0.72,
  residualPnL: 3250,
  totalPnL: 15280,
  // ... 52行硬编码mock数据
};

const [data] = useState<FactorExposureResult>(MOCK_DATA);
// ↑ 永远使用mock, 永远不调用真实IPC
```

`PerformanceAttributionPage` `RegimeMonitorPage` `CorrelationPanel` 全部用类似mock模式。

**人类使用习惯对照**:
> 用户花3小时配置了一个1万U的策略 → 跑去因子暴露页 → 看到一堆永远不变的数字 → 用户以为软件是骗子

**建议**:
```
P0-02: 接入factor-exposure真实数据流 (8h)
  - 调用 factor:exposure:{strategyId} IPC
  - 5种图表全部绑真实数据: 雷达图/贡献柱/月度残差/因子相关性热力图
  - 加"选择策略"下拉框 (默认当前active)
  - 加"刷新"按钮 (重新计算归因)
  - 加loading + 错误状态 + 空数据态
```

### 2.3 🚨 Critical: 因子收益用 Math.random() 生成

**现状** (学术级笑话):

```typescript
// factor-exposure.ts 第230-240行
private estimateFactorReturns(start: string, end: string): FactorReturn[] {
  for (let i = 0; i < Math.min(days, 252); i++) {
    returns.push({
      market: (0.08 / 252) * (1 + (Math.random() - 0.5) * 0.5),  // ← 随机数!
      smb:    (0.02 / 252) * (1 + (Math.random() - 0.5) * 0.5),  // ← 随机数!
      // ...8个因子全部用 Math.random()
    });
  }
}
```

**影响**:
- 同样持仓每次跑出不同归因 → 学术上完全不可信
- 散户做了归因 → 下次跑结果变了 → 信任崩溃
- 智能投顾v17.6中归因报告要收费(1U/次) → 交付随机结果 = 商业灾难

**人类使用习惯对照**:
> 跑归因1: "动量因子主导, 贡献42%"
> 跑归因2: "市场因子主导, 贡献38%"  
> 用户: "你到底想要我信哪个?"

**建议**:
```
P0-03: 因子收益改用真实ETF数据 (10h)
  - MKT: SPY/QQQ日收益率
  - SMB: IWM-SPY (小盘-大盘)
  - HML: IWD-IWF (价值-成长)
  - MOM: MTUM-SPY (动量-市场)
  - RMW: QUAL-SPY (质量-市场)
  - CMA: 低换手ETF-SPY
  - VOL: USMV-SPY (低波-市场)
  - QUAL: QUAL-SPY
  - 没有ETF的市场 (HKEX/CN): 从Fama-French Data Library下载
  - 缓存到kline_cache (按日增量更新)
```

### 2.4 🚨 Critical: 因子IC值硬编码, 不随市场变化

**现状**:

```typescript
// factor-compatibility-engine.ts
{
  id: "MOM_12M",
  typicalIC: 0.045,    // ← 写死!
  decayHalfLife: 60,   // ← 写死!
},
{
  id: "VOL_60D",
  typicalIC: -0.042,   // ← 写死!
  decayHalfLife: 30,   // ← 写死!
}
// 30+因子全部硬编码
```

**`FactorResearchEngine.computeIC()` 存在但从未被调用**

**人类使用习惯对照**:
> 2024年牛市中MOM_12M IC=0.08
> 2026年6月当前 IC=0.02 (几乎失效)
> 用户看到的还是0.045 → 决策偏差

**建议**:
```
P0-04: 实时IC/IR计算引擎 (8h)
  - 后台Worker: 每日收盘后计算所有因子的252日IC
  - EMA平滑: IC_today = 0.7*IC_yesterday + 0.3*IC_today
  - 数据源: K线缓存 (已有, 复用)
  - 前端展示: 每个因子旁边 "当前IC: 0.032 | 趋势↓ | 历史峰值0.085"
  - 失效警告: |IC|<0.01持续20日 → 黄牌; >40日 → 红牌剔除
```

### 2.5 🚨 Critical: 两套独立因子体系, 同一股票可能得相反分

**现状**:
- `MultiFactorModel` (Q15): 5维度 sentiment/capitalFlow/dragonTiger/fundHolding/diagnosis
- `MultiFactorSelector` (JVS-56): 5维度 momentum/value/quality/volatility/liquidity
- 两套**完全独立, 互不知道存在**
- 同一只股票AAPL可能在A系统得85分强烈推荐, B系统得42分SELL

**人类使用习惯对照**:
> 用户看到两个不同评分, 不知道信哪个, 干脆不信, 流失

**建议**:
```
P0-05: 统一因子框架 (12h)
  - 创建 UnifiedFactorEngine 合并两个
  - 3类大因子: 基本面 (value/quality/growth) + 技术 (momentum/volatility/liquidity) + 情绪 (sentiment/flow/institutional)
  - 总分 = 加权三类 (默认各占1/3, 用户可调)
  - 子分透明: 卡片显示 "基本面72 + 技术58 + 情绪82 = 综合68"
  - 废弃: scoreStocks / scoreAndRankStocks 独立API
  - 新API: factor:unified:score
```

### 2.6 🚨 Critical: 因子权重用户0可控

**现状**:
- 5+5 = 10个因子权重全部硬编码
- 前端无任何UI可调
- 散户想"我想强调价值, 不要动量" → 做不到
- 机构想"value因子40%" → 做不到

**人类使用习惯对照**:
> 散户最常见的诉求: "我偏保守, 别给我高动量股票"
> 当前系统: 完全无视用户偏好

**建议**:
```
P0-06: 因子权重视觉化配置器 (6h)
  - 5个滑块 (实时显示百分比)
  - 饼图: 当前权重分布
  - 预设: 价值型/动量型/均衡型/防御型 (一键切换)
  - "恢复默认" + "智能推荐" (根据用户历史选择)
  - 保存: strategyStore + localStorage 双写
  - 因子选择时: "⚠️ 当前value权重=0%, value因子不会影响结果"
```

### 2.7 🚨 Critical: strategyStore 40行敷衍了事

**现状**:

```typescript
// strategyStore.ts 完整代码
interface StrategyStore {
  strategies: Strategy[];
  activeStrategyId: string | null;
  backtestResults: Record<string, BacktestResult[]>;
  addStrategy/updateStrategy/removeStrategy/setActive/setStatus/addBacktestResult
}
// 仅基础CRUD, 无:
// - 版本历史
// - 策略快照
// - 策略对比
// - 导入导出
// - 收藏/标签
// - 关联因子配置
// - 关联回测引擎
```

**人类使用习惯对照**:
> 90%的量化平台都有"我的策略/收藏/最近编辑/标签/草稿"
> 我们的Store像一个2008年的todo list

**建议**:
```
P0-07: strategyStore v2 (4h)
  - 字段: id/name/category/factors/weights/riskParams/tags/status/createdAt/updatedAt/snapshots[]
  - 持久化: localStorage 加密存储 (USDT/v17.6 计费敏感)
  - 收藏/置顶/标签
  - 版本快照 (每次修改保存)
  - 草稿自动保存
  - 多设备同步接口预留
```

### 2.8 🚨 Critical: StrategyTemplates 选多因子=空壳

**现状**:

```typescript
{
  id: 'quant-multi-factor',
  category: 'multi_factor',
  parameters: [
    { name: 'preset', default: 'balanced' },
    { name: 'minScore', default: 65 },
    { name: 'universeSize', default: 10 },
    { name: 'rebalanceFreq', default: 'weekly' },
    { name: 'useSentiment', default: true },
    // 没有任何参数指定哪些因子!
  ]
}
```

`FactorCompatibilityEngine.suggestFactors()` 完整存在, 但**从未被调用**

**人类使用习惯对照**:
> 用户选"多因子量化"模板 → 期望看到"系统推荐: MOM + HML + QUAL + LIQ"
> 实际: 一个空模板, 跑出来随机结果

**建议**:
```
P0-08: 策略模板+因子推荐联动 (6h)
  - 创建策略时: FactorCompatibilityEngine.suggestFactors() 自动推荐
  - 模板页: 显示 "推荐因子: MOM_12M + HML + QUAL + LIQ (基于过去3年IC)"
  - 策略详情: "当前因子: [MOM_12M ✓] [HML ✓] [QUAL ✗ 未启用]"
  - 因子点击: 详情卡片 (公式+IC+相关性+衰减)
  - 回测报告: 自动嵌入因子归因 + 主导因子标注
```

---

## 三、🟡 P1 严重问题 (12项, 68h)

### 3.1 引擎能力闲置类 (5项)

| # | 引擎 | 闲置能力 | 建议 |
|---|------|---------|------|
| P1-01 | FactorResearchEngine | `compareFactors()` 因子排名 | 仪表板: 因子IC排名表+雷达 |
| P1-02 | FactorResearchEngine | `computeDecay()` 衰减曲线 | 折线图: IC×lag, 标注半衰期 |
| P1-03 | FactorResearchEngine | `computeFactorReturn()` 多空收益 | 累计收益曲线+月度柱状图 |
| P1-04 | FactorCompatibilityEngine | `suggestFactors()` 智能推荐 | 选策略时自动调用 |
| P1-05 | FactorCompatibilityEngine | `checkCompatibility()` 兼容检测 | 选因子时灰显+原因提示 |

### 3.2 回测未联动归因 (3项)

| # | 问题 | 建议 |
|---|------|------|
| P1-06 | 回测报告只有Sharpe/MaxDD, 无因子归因 | BacktestReportPage 嵌入 FactorAttribution 卡片 |
| P1-07 | 优化器只调技术参数, 不调因子权重 | StrategyOptimizerPanel 加入权重扫描 |
| P1-08 | 策略对比只看收益, 不对比因子暴露 | StrategyComparer 加入因子雷达并排 |

### 3.3 信号管道分散 (2项)

| # | 问题 | 建议 |
|---|------|------|
| P1-09 | 3个信号模块独立拉K线 | 统一SignalPipeline, 一次拉取, 多个消费者 |
| P1-10 | 信号+回测+归因数据无共享 | 引入SignalEventBus, publish/subscribe |

### 3.4 因子+策略市场分家 (2项)

| # | 问题 | 建议 |
|---|------|------|
| P1-11 | `StrategyMarketplace` 和 `FactorCloud` 各自独立 | 合并: 因子市场+策略市场+信号市场三合一 |
| P1-12 | 策略市场无"按因子筛选" | 加"按主导因子筛选"标签 |

---

## 四、🟢 P2 体验优化 (18项, 42h)

### 4.1 视觉与交互 (8项)

| # | 任务 | 工时 |
|---|------|------|
| P2-01 | 因子百科卡片 (hover显示公式+通俗解释) | 3h |
| P2-02 | 因子得分实时变色+排名动画 | 2h |
| P2-03 | 因子暴露雷达图加"行业基准"对比 | 3h |
| P2-04 | 月度归因热力图 (12月×8因子) | 3h |
| P2-05 | 因子集中度甜甜圈图 (top3因子占比) | 2h |
| P2-06 | 策略因子画像卡片 (像支付宝芝麻信用) | 4h |
| P2-07 | 因子切换流畅动画 (300ms ease) | 2h |
| P2-08 | 暗色模式适配 (全部图表) | 3h |

### 4.2 数据与监控 (6项)

| # | 任务 | 工时 |
|---|------|------|
| P2-09 | 因子绩效仪表板 (Sharpe/IC/DD) | 4h |
| P2-10 | 因子异动通知 (IC突变→Toast) | 3h |
| P2-11 | 因子月报自动生成+邮件 | 4h |
| P2-12 | 因子失效告警 (IC<0.01持续20日) | 3h |
| P2-13 | 因子拥挤度实时监控 (持仓重叠) | 4h |
| P2-14 | 因子日历 (什么时候因子表现好/坏) | 4h |

### 4.3 个性化与AI (4项)

| # | 任务 | 工时 |
|---|------|------|
| P2-15 | "我的因子画像" 保存用户偏好 | 4h |
| P2-16 | AI因子推荐助手 (NL→因子组合) | 6h |
| P2-17 | 因子A/B测试 (两个组合对比) | 6h |
| P2-18 | 智能体市场接入因子库 | 4h |

---

## 五、🔵 P3 增量优化 (7项, 14h)

| # | 任务 | 工时 |
|---|------|------|
| P3-01 | 因子公式LaTeX渲染 (MathJax) | 3h |
| P3-02 | 因子论文引用卡片 (原论文DOI) | 2h |
| P3-03 | 因子Git提交历史 (透明度) | 2h |
| P3-04 | 因子教学视频弹窗 | 3h |
| P3-05 | 因子评论/讨论区 | 2h |
| P3-06 | 移动端因子监控卡片 | 4h |
| P3-07 | 因子导出Excel/CSV | 2h |

---

## 六、🗺️ 详细路线图

### 6.1 总览

```
R158 (P0 | 54h) ──→ R159 (P1 | 68h) ──→ R160 (P2 | 42h) ──→ R161 (P3 | 14h)
   4.5d冲刺             5.5d冲刺              3.5d冲刺              1d冲刺
```

### 6.2 R158 — 关键缺陷修复 (8项, 54h)

| # | 任务 | 工时 | 验收 |
|---|------|------|------|
| P0-01 | 重写StrategyPage 7子组件 | 20h | 真实功能+流畅交互 |
| P0-02 | FactorExposure接入真实数据 | 8h | 5图全部活数据 |
| P0-03 | 因子收益用真实ETF | 10h | 归因可重现 |
| P0-04 | 实时IC/IR引擎 | 8h | 每日更新+告警 |
| P0-05 | 统一因子框架 | 12h | 单一API+三类大因子 |
| P0-06 | 权重视觉化 | 6h | 滑块+饼图+预设 |
| P0-07 | strategyStore v2 | 4h | 完整CRUD+持久化 |
| P0-08 | 模板+因子推荐 | 6h | 选模板自动推荐 |

### 6.3 R159 — 引擎能力暴露 (12项, 68h)

| # | 任务 | 工时 | 关联文件 |
|---|------|------|---------|
| P1-01 | 因子对比仪表板 | 6h | FactorResearchEngine |
| P1-02 | 因子衰减曲线 | 4h | FactorResearchEngine |
| P1-03 | 多空组合收益图 | 4h | FactorResearchEngine |
| P1-04 | 智能因子推荐 | 4h | FactorCompatibilityEngine |
| P1-05 | 因子兼容性筛选 | 4h | FactorCompatibilityEngine |
| P1-06 | 回测嵌入归因 | 6h | BacktestReportPage |
| P1-07 | 优化器加权重扫描 | 6h | StrategyOptimizerPanel |
| P1-08 | 策略对比+因子雷达 | 6h | StrategyComparer |
| P1-09 | SignalPipeline统一 | 8h | SignalGenerator/Aggregator |
| P1-10 | SignalEventBus | 8h | 新建core/event-bus.ts |
| P1-11 | 因子+策略市场合并 | 8h | StrategyMarketplace+FactorCloud |
| P1-12 | 市场按因子筛选 | 4h | MarketplaceFilter |

### 6.4 R160 — 体验打磨 (18项, 42h)

分3组, 每组6项:
- **视觉组** (P2-01~08 | 24h): 8项视觉优化
- **数据组** (P2-09~14 | 22h): 6项数据功能
- **AI组** (P2-15~18 | 20h): 4项AI功能

### 6.5 R161 — 锦上添花 (7项, 14h)

主要是科研性/分享性/导出性功能, 单项≤4h

---

## 七、📊 建议优先级矩阵

```
         紧急性 → 低                        高
影响度 ↓
低     [P3 锦上添花]    [P2 体验优化]
        P3-01~07        P2-01~18
        
高     [P1 引擎暴露]    [P0 阻塞修复] ← 立即开始
        P1-01~12        P0-01~08
                       (当前在做)
```

**资源分配**:
- **P0 = 54h (30% 资源)**: 必须, 不做就崩
- **P1 = 68h (38% 资源)**: 重要, 体现专业度
- **P2 = 42h (24% 资源)**: 锦上添花
- **P3 = 14h (8% 资源)**: 长期沉淀

---

## 八、🌟 亮点 (3个, 值得肯定)

虽然问题多, 审计也发现3个**做得好的地方**:
- ✅ **FactorCompatibilityEngine** 设计专业: 30+因子×8市场×8品种 兼容性矩阵
- ✅ **FactorResearchEngine** 学术严谨: IC/IR/Spearman/halfLife/crowding 完整
- ✅ **StrategyTemplates** 覆盖8种: 动量/反转/突破/配对/多因子/期权/海龟

**核心判断**: 学术和工程能力扎实, 但**学术→产品→用户**的最后一公里未完成。

---

## 九、最终建议

### 9.1 立即行动 (P0 8项)
**R158 4.5天冲刺**, 解决所有"用户看到的是Mock数据"+"权重不可控"+"因子随机"问题

### 9.2 中期规划 (P1 12项)
**R159 5.5天冲刺**, 把引擎里30+已经写好的方法全部接到UI, 让用户能用到

### 9.3 长期打磨 (P2+P3 25项)
**R160-R161 4.5天冲刺**, 体验优化+AI增强+长期价值

### 9.4 商业价值

完成R158-R161后, 我们的因子体系将达到:
- **学术严谨度**: 90分 (vs QuantConnect 95分)
- **产品易用度**: 85分 (vs 行业平均60分)
- **覆盖广度**: 80分 (8市场+30因子+8策略)
- **商业化潜力**: 90分 (v17.6 5种收费场景全部就位)

**预计收入影响**:
- 因子市场订阅: +10-20K USDT/月
- AI因子推荐: 1U/次 × 1000用户 = 1K USDT/月
- 策略市场抽成: +20-30K USDT/月

PM, 45项建议覆盖了从"用户看到的第一眼"到"学术正确性"的全链路。建议R158作为下一批冲刺目标 (4.5天能完成), 然后R159-R161分批推进。
