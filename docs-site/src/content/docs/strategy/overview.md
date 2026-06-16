---
title: 策略开发指南
description: DAWN WHALES 策略体系与因子框架开发指南
---

# 策略开发指南

DAWN WHALES v2.6 拥有 **240 个因子** 和 **196 个策略模板**, 覆盖 4 大类资产市场。

## 策略体系

```
策略 = 因子组合 + 参数配置 + 风控规则
```

### 三层结构

| 层级 | 说明 | 文件 |
|------|------|------|
| **因子层** | 240 个可组合基础指标 | `electron/engine/factors/` |
| **模板层** | 196 个预设策略模板 | `electron/engine/strategies/template-definitions-*.ts` |
| **策略层** | 用户定制策略实例 | 运行时动态生成 |

## 因子体系

### 因子分类 (12 类)

```
MKT (市场)     — 13 个因子 | 价格动量、成交量、波动率
RSK (风险)     — 20 个因子 | Beta、VaR、回撤、波动率锥
FAM (基本面)   — 30 个因子 | PE、PB、ROE、营收增长
TEC (技术)     — 46 个因子 | 均线、MACD、RSI、布林带
SEN (情绪)     — 18 个因子 | 新闻情感、社交媒体、恐慌指数
SIZ (规模)     — 8 个因子  | 市值、流通量、换手率
QUA (质量)     — 16 个因子 | 利润率、负债率、现金流
MAC (宏观)     — 15 个因子 | 利率、CPI、PMI、GDP
CRY (加密)     — 14 个因子 | 链上数据、资金费率、矿工指数
ALT (另类)     — 20 个因子 | 波动率曲面、偏度、基差
PLC (Placebo)  — 7 个因子  | 安慰剂对照组 (用于A/B实验)
COM (商品)     — 33 个因子 | 期货持仓、库存、供给需求
```

### 因子生命周期

```
注册 → 初始化 → 数据订阅 → 计算 → 信号生成 → 缓存 → 清理
```

```typescript
// 因子定义示例
export const RSIFactor: FactorDefinition = {
  id: 'TEC-RSI-v1',
  category: 'TEC',
  name: '相对强弱指标',
  nameEn: 'RSI',
  params: { period: 14, overbought: 70, oversold: 30 },
  compute(data: KLine[]): number {
    // RSI 计算
  }
};
```

### 因子注册

1. 在 `electron/engine/factors/factor-id-registry.ts` 注册 ID
2. 在 `electron/engine/factors/factor-i18n-map.ts` 添加 11 语言翻译
3. 数据处理在 `factor-data-provider.ts` 中实现

## 策略模板

### 模板文件分布

| 市场 | 文件 | 模板数 |
|------|------|--------|
| 🇺🇸 美股 | `template-definitions-au.ts` | 46 |
| 🇪🇺 欧股 | `template-definitions-eu.ts` | 36 |
| 🇭🇰 港股 | `template-definitions-hk.ts` | 42 |
| 🇯🇵 日股 | `template-definitions-jp.ts` | 14 |
| 🇰🇷 韩股 | `template-definitions-kr.ts` | 8 |
| 🇹🇼 台股 | `template-definitions-tw.ts` | 12 |
| 🇮🇳 印股 | `template-definitions-in.ts` | 6 |
| 🇸🇬 新加坡 | `template-definitions-sg.ts` | 8 |

### 模板参数

每个模板包含 3-5 个可调参数 (共 210 个参数):

```typescript
// 参数类型工厂 (来自 template-param-human-labels.ts)
P.FACTOR_WEIGHT()   // 因子权重: slider 0-100%
P.STOP_LOSS()       // 止损比例: slider 0-20%
P.TAKE_PROFIT()     // 止盈比例: slider 0-50%
P.HOLDING_DAYS()    // 持有天数: number 1-30
P.POSITION_SIZE()   // 仓位大小: slider 0-100%
P.REBALANCE_FREQ()  // 调仓频率: select daily/weekly/monthly
// ... 还有更多
```

每个参数有 3 种语言标签 (zh-CN / en / ja), 共 630 个翻译字符串。

### 自定义模板

```typescript
import { registerTemplate } from '@/engine/strategies';

registerTemplate({
  id: 'CUSTOM-MY-STRAT-v1',
  market: 'US',
  name: '我的自定义策略',
  description: '结合RSI+MACD+Bollinger的多因子策略',
  factors: [
    { id: 'TEC-RSI-v1', weight: 40 },
    { id: 'TEC-MACD-v1', weight: 35 },
    { id: 'TEC-Bollinger-v1', weight: 25 },
  ],
  params: {
    stopLoss: 5,
    takeProfit: 15,
    holdingDays: 7,
    rebalanceFreq: 'weekly',
  },
  version: '1.0.0',
});
```

## 因子信号管线

```
FactorSignalPipeline → FactorSignalIPCBridge → Renderer → Chart Annotation
         ↓
  FactorHeatmapEngine → 热力图可视化
```

### 信号流

1. **计算**: 240 因子在 `factor-data-provider.ts` 中并行计算
2. **管线**: `factor-signal-pipeline.ts` 处理信号排序和合并
3. **IPC**: `factor-signal-ipc-bridge.ts` 通过 4 通道传输到渲染端
4. **可视化**: `indicator-worker-integration.ts` 生成 K线叠加
5. **热力图**: `factor-heatmap-engine.ts` 12市场×18类别热力图

## 回测框架

### 命令

```bash
# 单策略回测
npm run backtest -- --template US-MOM-v1 --from 2024-01-01 --to 2024-12-31

# 基准测试
npm run benchmark -- --factors 240 --templates 112

# 步进前移验证
npm run walk-forward -- --template US-MOM-v1 --windows 12
```

### 关键指标

| 指标 | 说明 |
|------|------|
| 夏普比率 | 风险调整后收益 |
| 最大回撤 | 峰值到谷底的最大损失 |
| 胜率 | 盈利交易比例 |
| 盈亏比 | 平均盈利/平均亏损 |
| 年化收益 | 归一化年化收益率 |

## 最佳实践

1. **因子组合不超过 5 个** — 超过后边际收益递减
2. **使用 `factor-compatibility-engine.ts`** 检查因子共线性
3. **启用 `live-vs-backtest-engine.ts`** 监控实盘偏离
4. **模板版本化管理** — `template-versioning.ts` 自动管理升级
5. **小仓位验证** — 新策略先用 `paper-copy-trade-engine.ts` 模拟
