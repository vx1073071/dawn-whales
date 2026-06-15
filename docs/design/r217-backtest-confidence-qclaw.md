# R217-QClaw#2: 回测置信区间用户说明 + 过拟合科普文案

> **作者**: QClaw | **日期**: 2026-06-16 | **轮次**: R217 | **工时**: 2h

---

## 一、回测置信区间 — 人话版解释

### 1.1 核心概念翻译

| 专业术语 | 人话 | 用途 |
|---------|------|------|
| 95% Confidence Interval | "95%的把握，真实收益在X到Y之间" | 让用户知道回测不是精确预测 |
| In-Sample (IS) | "用历史数据训练出来的效果" | 这是"最好情况" |
| Out-of-Sample (OOS) | "用没见过的数据测试出来的效果" | 这是"真实能力" |
| Overfitting Score | "过拟合风险分" | 0-100，越高越危险 |
| IS/OOS Ratio | "训练效果 ÷ 真实能力" | >1.5说明过拟合 |

### 1.2 回测结果展示文案

```
┌────────────────────────────────────────┐
│  📊 回测结果                            │
│                                        │
│  年化收益: +18.5%                       │
│  └ 95%区间: +11.2% ~ +25.8%            │
│     (有95%把握真实收益在此范围)          │
│                                        │
│  📈 训练数据(IS): +22.3%                │
│  📉 真实测试(OOS): +14.7%               │
│  ⚠️ IS/OOS比: 1.52 (过拟合风险⚠️)       │
│                                        │
│  🎯 过拟合评分: 72/100                  │
│     状态: ⚠️ 警告 — 策略可能在历史数据   │
│     上表现很好，但实盘可能不及预期        │
└────────────────────────────────────────┘
```

### 1.3 置信区间解读指南

| 场景 | CI范围 | 解读 | 建议 |
|------|--------|------|------|
| 窄区间 | ±5%以内 | 回测结果稳定可靠 | ✅ 可参考 |
| 中等区间 | ±5%-15% | 回测有一定不确定性 | ⚠️ 谨慎参考 |
| 宽区间 | ±15%以上 | 回测结果波动大 | 🔴 仅作参考 |

### 1.4 过拟合三级警报

```
🟢 安全 (0-40分):
  "策略在不同数据上都表现稳定，过拟合风险低。"
  "Strategy performs consistently across different data periods."

🟡 警告 (41-70分):
  "策略在训练数据上表现明显好于测试数据。实盘可能不及预期，建议简化策略参数。"
  "Strategy performs much better on training data than test data. Live results may disappoint. Consider simplifying."

🔴 危险 (71-100分):
  "严重过拟合！策略在历史数据上过度优化，实际交易大概率亏损。建议重新设计策略，减少参数数量。"
  "SEVERE overfitting! Strategy is over-optimized on historical data. High probability of real trading losses. Redesign with fewer parameters."
```

---

## 二、过拟合 — 人话科普

### 2.1 "什么叫过拟合？"

> 💬 **一句话**: "就像考试前把答案背下来了，考试满分但不代表你真会。"

```
比喻1 — 考试背答案:
  你背下了去年真题的所有答案→模拟考满分(IS +22%)
  但今年换新题了→真实考试不及格(OOS -5%)
  这就是过拟合。

比喻2 — 刻舟求剑:
  你在船上刻了个记号说"剑是从这里掉下去的"
  但船在动，水在流，你按记号去找什么都找不到
  策略用历史数据雕刻出来的"记号"可能早就失效了。

比喻3 — 天气预报:
  你说"根据过去30天天气，明天一定下雨"
  但季节变了，这个预测毫无意义。
```

### 2.2 为什么回测好≠实盘好？

```
三个原因:
1. 市场在变: 2020牛市策略可能在2022熊市失效
2. 数据太少: 回测100笔交易，统计意义有限
3. 过度优化: 参数调太多，每调一次都在"投机取巧"
```

### 2.3 怎么降低过拟合风险？

| 方法 | 解释 | 我们帮你做了吗 |
|------|------|-------------|
| IS/OOS分割 | 用前70%数据训练，后30%测试 | ✅ 自动执行 |
| 减少参数 | 参数越多越容易过拟合 | ⚠️ 需手动简化 |
| 跨市场验证 | 同策略跑不同市场 | ✅ 信号推送检测 |
| 样本外时长 | OOS至少1年数据 | ✅ 自动检查 |
| 敏感性分析 | 参数微调看结果是否剧变 | ⚠️ 需JVS#1实现 |

---

## 三、UI文案设计

### 3.1 回测结果卡片

```
backtestConfidence.cardTitle = "Backtest Confidence"
  zh-CN: "回测可信度"

backtestConfidence.annualReturn = "Annual Return: {value}%"
  zh-CN: "年化收益：{value}%"

backtestConfidence.ci95Range = "95% range: {low}% ~ {high}%"
  zh-CN: "95%区间：{low}% ~ {high}%"

backtestConfidence.isLabel = "In-Sample (training)"
  zh-CN: "样本内（训练）"

backtestConfidence.oosLabel = "Out-of-Sample (test)"
  zh-CN: "样本外（测试）"

backtestConfidence.isOosRatio = "IS/OOS Ratio: {ratio}"
  zh-CN: "训练/测试比：{ratio}"

backtestConfidence.ratioWarning = "Ratio > 1.5 indicates overfitting risk"
  zh-CN: "比率>1.5提示过拟合风险"

backtestConfidence.overfitScore = "Overfit Risk Score: {score}/100"
  zh-CN: "过拟合风险评分：{score}/100"

backtestConfidence.safeStatus = "Stable — Low overfitting risk"
  zh-CN: "稳定——过拟合风险低"

backtestConfidence.warnStatus = "Warning — May underperform in live trading"
  zh-CN: "警告——实盘可能不及预期"

backtestConfidence.dangerStatus = "Danger — Severe overfitting! Redesign recommended."
  zh-CN: "危险——严重过拟合！建议重新设计。"
```

### 3.2 过拟合科普弹窗

```
overfittingExplain.title = "What is Overfitting?"
  zh-CN: "什么是过拟合？"

overfittingExplain.oneLiner = "Like memorizing exam answers — great score on old tests, fail on new ones."
  zh-CN: "就像背下考试答案——旧题满分，新题不及格。"

overfittingExplain.analogy = "You optimized your strategy for 2023 data. But 2024 is a different market. What worked then may not work now."
  zh-CN: "你的策略在2023年数据上优化到了极致。但2024年是不同的市场。过去有效的，现在未必有效。"

overfittingExplain.prevention = "We split data into training (70%) and testing (30%). Good strategies perform well on BOTH."
  zh-CN: "我们把数据分成训练集（70%）和测试集（30%）。好的策略在两者上都表现良好。"

overfittingExplain.gotIt = "Got it"
  zh-CN: "我知道了"
```

### 3.3 IS/OOS对比可视化说明

```
backtestIsOosCompare.title = "Training vs Real Test"
  zh-CN: "训练效果 vs 真实能力"

backtestIsOosCompare.isLine = "Training (what could have been)"
  zh-CN: "训练（最好情况）"

backtestIsOosCompare.oosLine = "Real test (what to expect)"
  zh-CN: "测试（真实预期）"

backtestIsOosCompare.gapWarning = "Large gap = overfitting. The bigger the gap, the less reliable."
  zh-CN: "差距大=过拟合。差距越大，回测越不可信。"
```

---

## 四、验收标准对照

| PM验收标准 | QClaw覆盖 | 状态 |
|-----------|----------|------|
| 回测95%CI显示 | ci95Range文案+解读指南 | ✅ |
| 过拟合分数显示 | overfitScore三级+IS/OOS ratio | ✅ |
| IS/OOS对比 | IS/OOS标签+ratio+warning | ✅ |
| 人话解释 | 3个比喻+科普弹窗 | ✅ |

---

## 五、与JVS#1引擎对接指南

### 5.1 backtest-confidence.ts 输出 → UI 映射

| 引擎输出 | UI字段 | 格式 |
|---------|--------|------|
| `annualReturn` | 年化收益 | `+18.5%` |
| `ci95.lower` | CI下限 | `+11.2%` |
| `ci95.upper` | CI上限 | `+25.8%` |
| `isReturn` | IS收益 | `+22.3%` |
| `oosReturn` | OOS收益 | `+14.7%` |
| `overfitScore` | 过拟合分 | `72/100` |
| `overfitLevel` | 等级 | `safe`/`warn`/`danger` |

### 5.2 过拟合等级计算建议

```typescript
function getOverfitLevel(score: number): 'safe' | 'warn' | 'danger' {
  if (score <= 40) return 'safe';
  if (score <= 70) return 'warn';
  return 'danger';
}
```
