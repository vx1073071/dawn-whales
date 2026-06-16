---
title: 因子体系参考
description: 240因子的完整ID列表、分类和说明
---

# 因子体系参考

## 因子ID命名规范

```
{类别}-{名称缩写}-v{版本}
```

示例: `TEC-RSI-v1` = 技术类 · RSI指标 · 版本1

## 因子清单

### MKT — 市场因子 (13个)

| ID | 名称 | 说明 |
|----|------|------|
| MKT-PRICE-v1 | 价格动量 | N日价格变化率 |
| MKT-VOL-v1 | 成交量 | 标准化成交量 |
| MKT-VOLATILITY-v1 | 波动率 | 历史波动率 |
| MKT-TURNOVER-v1 | 换手率 | 日均换手率 |
| MKT-AMPLITUDE-v1 | 振幅 | 日内价格振幅 |
| MKT-MOM-v1 | 动量 | 多周期动量组合 |
| MKT-REV-v1 | 反转 | 短期反转效应 |
| MKT-TREND-v1 | 趋势强度 | ADX趋势指标 |
| MKT-BREAKOUT-v1 | 突破 | 价格突破检测 |
| MKT-CORREL-v1 | 相关性 | 板块相关性 |
| MKT-LIQUIDITY-v1 | 流动性 | 综合流动性指标 |
| MKT-SPREAD-v1 | 价差 | 买卖价差分析 |
| MKT-VWAP-v1 | 均价偏差 | VWAP偏离度 |

### TEC — 技术因子 (46个)

| 类别 | 数量 | 典型因子 |
|------|:---:|------|
| 均线类 | 8 | SMA, EMA, WMA, HMA, KAMA |
| 震荡类 | 12 | RSI, Stoch, CCI, Williams %R, MFI |
| 趋势类 | 8 | MACD, DMI, ADX, Parabolic SAR |
| 波动类 | 6 | Bollinger, ATR, Keltner, Donchian |
| 形态类 | 6 | 头肩顶, 双底, 三角形 |
| 量价类 | 6 | OBV, VWAP, 资金流量, 大单 |

### FAM — 基本面因子 (30个)

- PE / PB / PS / PEG
- ROE / ROA / ROIC
- 营收增长率 / 利润增长率
- 负债率 / 流动比率 / 速动比率
- 自由现金流 / 股息率

### RISK — 风险因子 (20个)

- Beta / Alpha
- VaR / CVaR
- 最大回撤 / 回撤持续时间
- 下行标准差 / Sortino比率
- 波动率锥 / 波动率曲面

### SEN — 情绪因子 (18个)

- 新闻情感得分
- 社交媒体热度
- 恐惧与贪婪指数
- 期权Put/Call比率
- 分析师评级变化

### MAC — 宏观因子 (15个)

- 利率变化 / 收益率曲线
- CPI / PPI / PMI
- GDP增速
- 失业率
- 货币供应量

### CRY — 加密因子 (14个)

- 链上交易量 / 活跃地址
- 资金费率
- 矿工持仓指数
- 交易所流入/流出
- 稳定币供应

### COM — 商品因子 (33个)

- 期货期限结构 / 基差
- 库存水平
- 持仓量变化
- 供给/需求预测
- 季节性模式

### ALT — 另类因子 (20个)

- 波动率偏度 / 峰度
- 期权Gamma敞口
- 跨市场套利
- 统计套利信号

### QUA — 质量因子 (16个)

- 利润质量 / 应计项目
- 盈利稳定性 / 可预测性
- 管理层质量指标
- ESG评分

### SIZ — 规模因子 (8个)

- 市值 / 流通市值
- 总资产 / 净资产
- 雇员数量

### PLC — 安慰剂因子 (7个)

用于A/B实验对照组的随机信号。

## 因子兼容性

使用 `factor-compatibility-engine.ts` 检查因子组合的共线性。

## 因子注册指南

1. 在 `factor-id-registry.ts` 注册 ID
2. 在 `factor-i18n-map.ts` 添加 11 语言名称
3. 在 `factor-data-provider.ts` 实现计算逻辑
4. 在 `factor-signal-pipeline.ts` 注册信号处理
