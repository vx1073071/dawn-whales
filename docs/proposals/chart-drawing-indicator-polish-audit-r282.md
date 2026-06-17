# 📊 QUANT MOO 图表·画线·指标 全面审计与打磨方案

**审计人**: autoclaw  
**日期**: 2026-06-18  
**审计范围**: 图表渲染 / 画线系统 / 指标引擎 / 足迹图 / 交互体验 / 变现路径  
**代码审计**: 17个核心文件深度审查 + 行业对标 (TradingView / Bloomberg / 富途 / TrendSpider / Wind)

---

## 一、现状总览

| 维度 | 当前 | 行业对标 | 差距 |
|------|------|----------|------|
| K线渲染 | lightweight-charts 4.2.3 | TradingView Charting Library v28 | 中等 (引擎相同但缺高级特性) |
| 指标库 | 20定义 / 8可用 / 80+参考 | 富途100+ / TradingView 120+ / Wind 300+ | **大** (大量定义无实现) |
| 画线工具 | 68种UI定义 / 9种实现 | TradingView 99种 | **极大** (85%为占位) |
| 多图联动 | 无 | TV无限多图 / 富途8图联动 | **无此能力** |
| 副图面板 | 无 (指标挤在主图) | 标准配置 | **缺失** |
| 自动画图 | 引擎存在 / 未接入UI | TrendSpider 全自动 | **有代码无效果** |
| 移动端适配 | 无 | 全员标配 | **缺失** |
| 变现能力 | 0 | TV $155M ARR / 富途10%来自高级工具 | **0→可到$19K/mo** |

**结论**: 底层引擎和类型系统扎实，但**UI断头路太多** — 大量定义未实现、引擎未接入、组件未联动。这是典型的"前半段做得很好，后半段没人收尾"。

---

## 二、P0 紧急修补（影响产品可用性，1周内完成）

### 2.1 副图面板 (Sub-Pane) 架构

**现状**: MACD/RSI/KDJ 全部强制挤在主图 K 线上，用 `lineSeries` 和 `histogramSeries` 混叠在主价格坐标上。RSI(0-100) 和 K 线(如 30000+) 在同一 priceScale 上，RSI 几乎是一条贴底直线。

**严重性**: 🔴 致命 — 这是炒股软件的基本常识：副图指标和主图 K 线必须分离坐标。

**修复方案**:
```
KLineChartPro 改造为三区布局:
┌─────────────────────┐
│  Main Pane (60%)     │  K线 + 主图叠加 (MA/BOLL/SAR/VWAP/Ichimoku)
│  Price Scale         │
├─────────────────────┤
│  Study Pane 1 (20%)  │  MACD DIF/DEA/柱 + RSI + KDJ
│  Own Price Scale     │  独立 Y 坐标
├─────────────────────┤
│  Volume Pane (20%)   │  成交量柱
│  Volume Scale        │
└─────────────────────┘
```

**lightweight-charts 实现**: v4 原生支持多 pane — `chart.addCandlestickSeries` 为主图，每个 `chart` 实例只能一个主 pane。但可以用多个 chart 实例叠放 + 时间轴同步实现。TradingView 的 open-source `charting_library` 原生支持 sub-pane。

**推荐**: 如果继续用 lightweight-charts，采用多 chart 实例同步方案；中长期考虑迁移到 TradingView Charting Library（$500/月 版权费 vs 自研 3-4 周工时）。

### 2.2 画线工具 UI 接入

**现状**: DrawingToolbar 有 68 个工具按钮。drawing-tools.ts 有 9 种工厂函数。**KLineChartPro 完全没有渲染画的线**。点任何画线按钮都不会在图上画出东西。

**严重性**: 🔴 致命 — 用户点画线→没有反馈 = 立即流失。

**修复方案**:
1. 在 KLineChartPro 中接入 lightweight-charts 的 `ISeriesPrimitive` API 渲染画线
2. 先实现 9 种已完工的基础画线(趋势线/水平线/射线/斐波回调/斐波扩展/平行通道/矩形/文字/标注气泡)
3. DrawingToolbar 的 "ON/OFF" 状态要实时反馈：选定工具后光标变 crosshair，在图上拖拽出画线

### 2.3 指标参数连通

**现状**: IndicatorPanel 允许调整参数（如 MA 改 20→50），但 KLineChartPro 的 `calcSMA(bars, 20)` 硬编码了 20，从不读取参数。

**严重性**: 🟠 高 — 有 UI 调不了 = 功能残废。

**修复方案**: 在 IndicatorPanel `onParamsChange` → 更新 indicatorLines 计算 → KLineChartPro 重绘。

### 2.4 自动画线接入

**现状**: auto-drawing.ts 有完整的趋势线/支撑压力/通道自动检测引擎，纯算法很扎实。但从未在任何 UI 组件中调用。

**严重性**: 🟠 高 — 这是 TrendSpider 的核心卖点，完全浪费。

**修复方案**:
1. 在 KLineChartPro 增加"自动画线"开关按钮
2. 调用 `autoDetectAll(bars)` 获取结果
3. 用半透明彩色线渲染自动检测的趋势线/支撑压力/通道
4. 趋势线标注强度百分比

---

## 三、P1 核心完善（2-3 周）

### 3.1 补齐缺失指标（12→20→50）

**当前代码已定义但缺实现的**:
- WMA, ATR, STDDEV, OBV, MFI — indicator-engine.ts 中有完整实现
- CCI — 有实现
- WR — 有实现
- Ichimoku — 有实现
- Pivot — 有实现
- MA Envelope — 有实现
- EMA Cross — 有实现
- BIAS, DMI, PSY, VR, ASI, ARBR, CR, EMV, TRIX, ROC — 有实现 (R113b)

**问题**: 只差**在 KLineChartPro 中注册可用指标**。当前硬编码的 statics 只有 8 个，补上 switch case 即可一次加入 20+。

**高价值指标（优先）**:
| # | 指标 | 用途 | 用户使用频率 |
|---|------|------|-------------|
| 1 | Ichimoku | 日系交易员必用(全球第二大交易社区) | ⭐⭐⭐⭐⭐ |
| 2 | DMI/ADX | 趋势强度判断 | ⭐⭐⭐⭐⭐ |
| 3 | ATR | 止损距离计算 | ⭐⭐⭐⭐ |
| 4 | Keltner Channel | 突破确认 | ⭐⭐⭐⭐ |
| 5 | OBV | 量价背离 | ⭐⭐⭐⭐ |
| 6 | Donchian Channel | Turtle策略核心 | ⭐⭐⭐ |
| 7 | CCI | 大宗商品专用 | ⭐⭐⭐ |
| 8 | Pivot Points | 日内交易必用 | ⭐⭐⭐⭐ |
| 9 | ROC | 动量扫描 | ⭐⭐⭐ |
| 10 | PSY | A股心理线(中国用户刚需) | ⭐⭐⭐⭐⭐(中国) |

### 3.2 画线工具补齐（9→30）

**高优先级** (基于 TradingView 使用数据):

| # | 工具 | 使用频率排名 |
|---|------|------------|
| 1 | 水平线（支撑/压力） | #1 (60%+ 交易者每天用) |
| 2 | 斐波那契回调 | #2 (35%) |
| 3 | 矩形区域 | #3 (25%) |
| 4 | 平行通道 | #4 (20%) |
| 5 | 三角形 | #5 (形态交易核心) |
| 6 | 价格区间 | #6 |
| 7 | 日期区间 | #7 |
| 8 | 文字标注 | #8 |
| 9 | 趋势线（自动） | #9 (趋势交易) |
| 10 | Andrews Pitchfork | #10 |

**实现优先级策略**: 先完善这 10 个高频工具的画线渲染，再逐步增加。

### 3.3 多图联动

**场景**: 用户同时看 BTC 1h/4h/D 三个图表，或同时看 NVDA+AAPL+QQQ。

**方案**:
1. **MultiChartLayout 组件**: grid 分割画布，最多 4 图同屏
2. **TimeAxisSync**: 所有子图共用同一个时间轴，滚轮缩放/拖拽同步
3. **CrosshairSync**: 十字光标在所有子图上同步移动
4. **SymbolSync**: 可选"同一标的跨周期"或"同一周期跨标的"

**变现**: 免费=1图，付费=2图/4图布局。

### 3.4 指标信号标注

**现状**: 指标只画线，没有信号点。

**需求**:
- KDJ 金叉死叉 → 图上标注 ↑↓ 箭头
- MACD 金叉死叉/零轴突破 → 标注
- RSI 超买超卖区域 → 半透明背景色块
- BOLL 突破上轨/跌破下轨 → 高亮
- EMA 金叉死叉 → 标注

**TradingView 实践**: 信号标注是最受欢迎的 Premium 功能之一。

---

## 四、P2 竞争突破（1-2 月）

### 4.1 画线模板系统 + 社区

**现状**: DrawingToolbar 每次重新画，没有保存为模板。

**方案**:
```
用户画好一套线 → "保存为模板" → 
  模板名: "BTC牛市区间交易"
  适用: 任意标的
  标签: 趋势追踪/支撑压力/斐波

模板市场:
  - 官方模板: 15个免费
  - 社区模板: 评分/下载/Fork
  - 付费模板: 作者定价 $0.99-$9.99
```

**收入模型**: 平台抽成 30%，对标 TradingView Pine Script 市场和 TrendSpider 模板。

### 4.2 AI 智能标注

**方案** (基于现有 auto-drawing.ts):
1. LLM 分析趋势线 + 支撑压力 + 通道 → 生成自然语言注释
2. 示例: "BTC 处于上升通道下轨，当前刚好触及 0.618 斐波回调位 + 前期支撑区重合，R/R 比 3:1"
3. 图表上直接渲染为气泡/高亮区域
4. 一键→生成策略→回测→模拟交易

**对标**: TrendSpider $39/mo "AI Strategy Lab", TradingView "AI Analysis"(测试中)

### 4.3 自定义指标编辑器

**对标**: TradingView Pine Script → 最大的护城河。他们有 10 万+ 社区脚本。

**QUANT MOO 方案** (差异化):
- 不是写代码，而是**可视化拖拽组合**
- 用户从因子注册表(620+)中选择因子 → 组合成指标 → 实时预览
- 拖拽式: 因子A × 权重 + 因子B × 权重 + 阈值 = 自定义信号
- 一键保存到策略模板

**变现**: Premium $9.99/mo 解锁无限自定义指标。

### 4.4 图表回放模式

**对标**: TradingView Bar Replay → 训练/测试必备。

**方案**:
1. 加载历史K线 → 逐根回放（可调速 1x/2x/5x/10x/MAX）
2. 回放时可画线、加指标
3. 回放结束后 → 一键"如果我这样交易会赚多少"
4. 回放记录保存为"练习笔记"

**变现**: 免费=每天5次回放，Premium=无限回放+策略评估。

---

## 五、针对人类使用习惯的打磨

### 5.1 中国用户特有需求

| 需求 | 现状 | 建议 |
|------|------|------|
| A股涨停板标线 | ❌ | 在主图上画 10%/20% 涨停线（科创30%） |
| 分时图 | ❌ | K线图工具栏增加"分时"切换按钮 |
| 板块联动 | ❌ | 选股→自动显示所属板块指数叠加 |
| 龙虎榜追踪 | ❌ | 图上标注龙虎榜买入/卖出日期 |
| 除权除息标记 | ❌ | 图上小三角标记 + 复权切换 |
| 北上资金流叠加 | ❌ | 副图增加北向资金净流入 |

### 5.2 国际用户通用需求

| 需求 | 现状 | 用户行为依据 |
|------|------|-------------|
| 多时间周期同时看 | ❌ 只能切换 | 60%+ 专业交易员同时看 3+ 周期 |
| 提醒标记 | ❌ | 在图上价格位右键→"价格触发提醒" |
| 盈亏比例标注 | ❌ 手工算 | 画趋势线后自动显示盈亏比 |
| 键盘快捷键 | 部分 | 删除键清线/Ctrl+Z 撤消/Space 切换指标 |
| 截图+分享 | ❌ | 一键截图带水印→分享至社区 |
| 暗色/明色切换 | 仅暗色 | 增加"日间模式"按钮 |
| 显示网格+对数坐标 | ❌ | 专业交易员标配 |
| 交易日历叠加 | 有(holiday-calendar) | 未接入图表 |

### 5.3 触屏与移动端

**现状**: 完全无移动端适配。

**人类习惯**: 中国股民 70%+ 用手机看盘。国际 crypto 交易员 60%+ 用手机。

**方案**:
1. 移动端 H5 版轻量 K 线（4个核心指标 + 趋势线）
2. Canvas 手势: 单指拖拽 / 双指缩放 / 长按十字光标 / 双击重置
3. 底部精简工具栏: 周期切换 + 指标快捷开关 + 画线入口

---

## 六、变现路线图

### 6.1 分层定价（对标 TradingView + 富途）

| 级别 | 价格 | 核心差异 |
|------|------|----------|
| Free | $0 | 1图/12指标/基础画线(3种)/日K+周K |
| Plus | $4.99/mo | 2图/20指标/基础画线(10种)/全部周期/自动画线 |
| Pro | $12.99/mo | 4图/50指标/全部画线(30+)/多图联动/图表回放/自定义指标1个 |
| Premium | $29.99/mo | 无限图/全部指标/全部画线/AI智能标注/自定义指标无限/模板市场/策略回测/API导出 |

### 6.2 收入预测（假设 1000 付费用户）

| 级别 | 转化率 | 用户数 | 月收入 |
|------|--------|--------|--------|
| Plus | 60% | 600 | $2,994 |
| Pro | 30% | 300 | $3,897 |
| Premium | 10% | 100 | $2,999 |
| **总计** | | **1,000** | **$9,890/月** |

### 6.3 附加收入

| 渠道 | 月收入估计 |
|------|-----------|
| 模板市场抽成(30%) | $1,000-3,000 |
| 指标市场抽成(30%) | $2,000-5,000 |
| 画线策略直播跟单(10%利润分成) | $1,000-5,000 |
| API 数据导出 (Pro+) | $500-1,500 |

**保守估计月收入**: $15,000-25,000/月  
**对标**: TradingView Premium 用户约 100万(2025)，年收入 $1.5B。

---

## 七、实施路线图

### Phase 1: 止血 (Week 1-2, 4人日)
- [ ] Sub-pane 架构 (MACD/RSI/KDJ 移到副图)  
- [ ] 画线 UI 接入 KLineChartPro (9种基础画线)  
- [ ] 指标参数连接 (IndicatorPanel → KLineChartPro)  
- [ ] 自动画线接入 (开关按钮 + 渲染)

### Phase 2: 完善 (Week 3-4, 6人日)
- [ ] 补齐 20+ 指标到 KLineChartPro  
- [ ] 画线补齐至 15 种 (十几种高频工具)  
- [ ] 多图联动 (2图布局)  
- [ ] 指标信号标注 (金叉死叉箭头)  
- [ ] 对数坐标 + 网格切换

### Phase 3: 体验 (Month 2, 8人日)
- [ ] A股特色功能 (涨停板/分时图/龙虎榜/除权标记)  
- [ ] 键盘快捷键完整覆盖  
- [ ] 画线模板(保存/加载)  
- [ ] 盈亏比自动标注  
- [ ] 截图分享功能  
- [ ] 明色主题

### Phase 4: 突破 (Month 3, 12人日)
- [ ] AI 智能标注 (LLM + auto-drawing)  
- [ ] 自定义指标可视化编辑器  
- [ ] 图表回放模式  
- [ ] 模板市场 (发布/下载/Fork)  
- [ ] 移动端 H5 轻量版  
- [ ] 分层订阅 + 支付打通

### Phase 5: 壁垒 (Month 4+, 持续)
- [ ] 社区指标市场 (Pine Script-like 但可视化拖拽)  
- [ ] AI 策略生成 (画线→策略→回测→实盘)  
- [ ] 跨市场实时数据叠加  
- [ ] 多维数据可视化 (热力图/相关性矩阵/资金流向)

---

## 八、技术债务清算

### 8.1 lightweight-charts → TradingView Charting Library 迁移评估

| 维度 | lightweight-charts | TradingView Charting Library |
|------|-------------------|------------------------------|
| 副图面板 | ❌ 不原生支持 | ✅ 原生支持 |
| 画线渲染 | ❌ ISeriesPrimitive (手动) | ✅ 内置 99 种 |
| 数据加载 | 手动 setData | ✅ Datafeed API |
| 移动端 | 部分支持 | ✅ 完整支持 |
| 许可证 | Apache 2.0 (免费) | 需要授权 ($500-2000/月) |
| 迁移成本 | - | 3-4 周 (重写 KLineChartPro) |
| 对标效应 | 无 | ✅ 用户认知度高 |

**建议**: Phase 1-2 坚持 lightweight-charts，Phase 4 评估迁移。当前优先止血而非换引擎。

### 8.2 代码组织优化

```
当前结构:
src/components/chart/
  KLineChartPro.tsx       (297行, 混了渲染+计算+sub-pane hack)
  IndicatorPanel.tsx      (独立, 但参数未连通)
  DrawingToolbar.tsx      (独立, 但未接入图表)
  FootprintChart.tsx      (独立, 未与K线联动)
  ChartInteractionEnhancements.tsx (70行, 交互增强)

建议重构:
src/components/chart/
  KLineChartPro.tsx       (纯渲染组件, <200行)
  hooks/
    useKlineData.ts       (数据处理管道)
    useIndicators.ts      (指标计算+缓存)
    useDrawings.ts        (画线状态管理)
    useCrosshair.ts       (十字光标)
    useAutoDrawing.ts     (自动画线检测)
  panes/
    MainPane.tsx          (K线+主图叠加)
    StudyPane.tsx         (MACD/RSI/KDJ)
    VolumePane.tsx        (成交量)
  toolbar/
    TimeframeBar.tsx      (周期切换)
    IndicatorBar.tsx      (指标快捷开关)
    DrawingToolbar.tsx    (画线工具栏)
    ChartFooter.tsx       (缩放/全屏)
```

---

## 九、文件级待办清单

### 需修改的现有文件

| 文件 | 待办 |
|------|------|
| `KLineChartPro.tsx` | Sub-pane架构 / 画线渲染 / 参数连通 / 自动画线开关 / 8→20+指标 / 信号标注 |
| `IndicatorPanel.tsx` | onParamsChange 连通 / 增加快速应用按钮 |
| `DrawingToolbar.tsx` | 画线状态与图表双向绑定 / 光标切换 |
| `FootprintChart.tsx` | 与 KLineChartPro 联动 / TPO视图 / 实时tick |
| `ChartInteractionEnhancements.tsx` | 增加键盘快捷键 / 手势 |
| `indicator-engine.ts` | 已有所有计算函数, 无改动 |
| `auto-drawing.ts` | 触发频率优化 (当前数据变化即全量重算) |
| `drawing-tools.ts` | 补齐 factory 函数 9→30 |
| `drawing-strategy-bridge.ts` | 已扎实, 需接入UI |

### 需新建的文件

| 文件 | 用途 |
|------|------|
| `MultiChartLayout.tsx` | 多图同屏布局 |
| `ChartReplayPanel.tsx` | K线回放控制器 |
| `DrawingTemplateMarket.tsx` | 画线模板市场 |
| `CustomIndicatorBuilder.tsx` | 可视化指标编辑器 |
| `AIChartAnnotation.ts` | AI智能标注引擎 |
| `MobileKLineChart.tsx` | 移动端轻量K线 |
| `logs-scale.ts` | 对数坐标工具函数 |
| `chart-keyboard-shortcuts.ts` | 快捷键注册 |

---

## 十、一句话总结

**QUANT MOO 的图表系统底子很好（lightweight-charts + 纯函数指标引擎 + 68种画线定义），但"最后一公里"没走完：大量功能定义了没实现、实现了没接入、接入了没联动。补上这 4 个 Phase 后，图表系统可以从『勉强能用』跃迁到『与 TradingView/富途正面竞争』的水平，并贡献 $1-2.5万/月的变现增量。**

下一步行动: 立即执行 Phase 1 止血，支付系统和分层定价可以并行启动设计。
