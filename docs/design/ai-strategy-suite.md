# TradingEasy AI Strategy Suite v1.0

> **Round**: R146 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: USER GUIDE — Production Ready
> **Covers**: Portfolio generation, backtest reading, optimization, health check

---

## Overview

The AI Strategy Suite provides **4 advanced AI features** that work together as a closed loop for strategy development. Each feature is pay-per-use with silent deduction.

### Pricing

| # | Feature | Price | Category |
|---|---------|-------|----------|
| 1 | Generate Strategy Portfolio | **2 USDT** | `ai_generate_portfolio` |
| 2 | Backtest Interpretation | **1 USDT** | `ai_backtest_read` |
| 3 | Strategy Optimization | **1.5 USDT** | `ai_optimize` |
| 4 | Strategy Health Check | **1 USDT** | `ai_health_check` |

---

## 1. AI Generate Strategy Portfolio (2 USDT)

### What It Does
Given a user's **natural language description** of their trading goals, AI selects strategies from the existing strategy library and allocates weights to form a diversified portfolio. **It does NOT generate new strategy code** — it combines existing strategies.

### Input

```
User describes their goal:
"I want a conservative portfolio with 60% trend following and 40% mean reversion.
I trade US stocks, prefer low drawdown, and want monthly rebalancing."

AI receives:
  - User's description (natural language)
  - Available strategies in user's library (or marketplace)
  - Strategy metadata (category, win rate, Sharpe, max drawdown)
```

### Output

```json
{
  "portfolioId": "pf_abc123",
  "name": "Conservative Trend-Mean Revert Mix",
  "description": "AI-generated: 60% trend + 40% mean reversion for US stocks",
  "createdAt": "2026-06-13T10:00:00Z",
  "strategies": [
    {
      "strategyId": "tpl_golden_cross",
      "name": "Golden Cross Momentum",
      "allocation": 0.35,
      "reason": "Core trend-following engine, strong Sharpe 1.45"
    },
    {
      "strategyId": "tpl_macd_divergence",
      "name": "MACD Divergence Hunter",
      "allocation": 0.25,
      "reason": "Captures trend reversals, complements Golden Cross"
    },
    {
      "strategyId": "tpl_bollinger_reversal",
      "name": "Bollinger Band Reversal",
      "allocation": 0.20,
      "reason": "Mean reversion on oversold/overbought extremes"
    },
    {
      "strategyId": "tpl_rsi_mean_revert",
      "name": "RSI Mean Reversion",
      "allocation": 0.20,
      "reason": "Pairs with BB Reversal for double-confirmation entries"
    }
  ],
  "projected": {
    "expectedReturn": 0.18,
    "expectedSharpe": 1.32,
    "expectedMaxDrawdown": 0.12,
    "correlationMatrix": "Low cross-correlation (<0.3) between trend and mean-reversion pairs"
  },
  "rebalancing": {
    "frequency": "monthly",
    "threshold": 0.05,
    "method": "equal-drift"
  }
}
```

### Rules
- Strategies selected from **existing library only** (user's + marketplace)
- Each strategy in the portfolio must exist (validated before saving)
- Allocation must sum to **1.0 (100%)** within 0.01 tolerance
- Minimum 2 strategies, maximum 8 in a portfolio
- Each strategy weight ≥ 5% (no dust allocations)
- Strategies must be from **compatible asset classes** (can't mix crypto futures with US stocks)

### UI Flow

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 AI Portfolio Generator                     Cost: 2 USDT  │
│                                                             │
│  Describe your goal:                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ I want a conservative portfolio for US stocks...         ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Generate Portfolio]  Balance: 45.00 USDT                  │
│                                                             │
│  ── After generation: ──                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📊 Generated: Conservative Trend-Mean Revert Mix        ││
│  │                                                         ││
│  │   35% Golden Cross Momentum                             ││
│  │   25% MACD Divergence Hunter                            ││
│  │   20% Bollinger Band Reversal                           ││
│  │   20% RSI Mean Reversion                                ││
│  │                                                         ││
│  │   Projected Sharpe: 1.32 | Max DD: 12%                 ││
│  │                                                         ││
│  │  [Save Portfolio]  [Regenerate]  [Edit Weights]         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI Backtest Interpretation (1 USDT)

### What It Does
Takes raw backtest results (win rate, Sharpe, drawdown, equity curve, trade log) and provides **human-readable analysis** of what worked, what didn't, and why.

### Input

```json
{
  "strategyName": "Golden Cross Momentum",
  "period": { "from": "2024-01-01", "to": "2025-12-31" },
  "results": {
    "totalReturn": 0.42,
    "winRate": 0.58,
    "sharpeRatio": 1.45,
    "maxDrawdown": 0.15,
    "totalTrades": 234,
    "avgWin": 0.032,
    "avgLoss": -0.018,
    "profitFactor": 1.78
  },
  "equityCurve": [
    { "date": "2024-01-05", "equity": 10000 },
    { "date": "2024-01-12", "equity": 10200 },
    ...
  ],
  "monthlyReturns": [
    { "month": "2024-01", "return": 0.032 },
    { "month": "2024-02", "return": -0.015 },
    ...
  ]
}
```

### Output (Human-Readable)

```
📊 Backtest Interpretation — Golden Cross Momentum

### Overall Performance
The strategy delivered a +42% total return over 2 years with a 1.45 Sharpe ratio,
indicating strong risk-adjusted returns. The 15% max drawdown is acceptable for a
trend-following strategy.

### Strengths
- August 2024 was your best month (+8.2%), driven by strong trend continuation in tech
- The strategy shows consistency: 8 of 12 months in 2025 were positive
- Profit factor of 1.78 means winners are nearly 2x the size of losers

### Weaknesses
- Q1 2025 underperformed (-4.3% cumulative), as choppy markets generated false signals
- The strategy struggles during low-volatility periods (Mar-May 2025: -2.1%)
- Drawdowns cluster: 3 of 4 worst drawdowns occurred in Q3

### Parameter Sensitivity
The strategy is most sensitive to the RSI threshold (14 vs 21 days):
  - RSI=14: win rate 58%, Sharpe 1.45
  - RSI=21: win rate 52%, Sharpe 1.18
Consider tuning the RSI period as it has outsized impact.

### Recommendation
This strategy is solid for bullish trending markets but needs a volatility filter
for sideways periods. Consider adding a VIX > 15 condition to avoid choppy markets.
```

### Rules
- **Must be based on real backtest data** — AI cannot fabricate numbers
- Analysis must include: strengths, weaknesses, parameter sensitivity, recommendation
- If backtest data is insufficient (< 20 trades), return warning: "Insufficient data for reliable analysis"

---

## 3. AI Strategy Optimization (1.5 USDT)

### What It Does
Analyzes current strategy parameters and backtest history, then suggests **specific parameter adjustments** to improve performance. Output is **structured parameters**, not prose advice.

### Input

```json
{
  "strategy": {
    "name": "Golden Cross Momentum",
    "framework": "moving_average_cross",
    "currentParams": {
      "fastPeriod": 50,
      "slowPeriod": 200,
      "rsiPeriod": 14,
      "rsiThreshold": 70,
      "stopLossPercent": 5,
      "takeProfitPercent": 15,
      "positionSize": 0.1
    }
  },
  "backtestHistory": [...],
  "optimizationGoals": ["maximize_sharpe", "reduce_drawdown"]
}
```

### Output (Structured)

```json
{
  "suggestions": [
    {
      "parameter": "fastPeriod",
      "current": 50,
      "suggested": 20,
      "reason": "EMA 20/200 detects trend changes 2.5x faster than EMA 50/200, improving entry timing",
      "expectedImpact": "Sharpe +0.15, win rate +3%"
    },
    {
      "parameter": "rsiPeriod",
      "current": 14,
      "suggested": 21,
      "reason": "Longer RSI period (21) reduces false signals during consolidation (tested on your Q3 2024 data)",
      "expectedImpact": "Sharpe +0.08, drawdown -2%"
    },
    {
      "parameter": "stopLossPercent",
      "current": 5,
      "suggested": 4,
      "reason": "Tighter stop-loss (4%) would have avoided 3 of the 5 worst trades without adding false exits",
      "expectedImpact": "Drawdown -3%, win rate -1% (acceptable trade-off)"
    }
  ],
  "conflicts": [
    {
      "description": "fastPeriod=20 improves entry timing but increases false signals by ~8%",
      "resolution": "Pair with RSI=21 to filter false signals — complementary optimization"
    }
  ],
  "projectedAfterOptimization": {
    "sharpeRatio": 1.68,
    "winRate": 0.60,
    "maxDrawdown": 0.10,
    "profitFactor": 2.05
  }
}
```

### UI: Comparison & One-Click Adoption

```
┌───────────────────────────────────────────────────────────────┐
│  🔧 AI Strategy Optimizer                       Cost: 1.5 USDT │
│                                                               │
│  ┌──────────────────────┬──────────────────────┐             │
│  │    CURRENT            │    SUGGESTED          │             │
│  │    Sharpe: 1.45       │    Sharpe: 1.68 ✨    │             │
│  │    Win Rate: 58%      │    Win Rate: 60%      │             │
│  │    Max DD: 15%        │    Max DD: 10% ✨     │             │
│  └──────────────────────┴──────────────────────┘             │
│                                                               │
│  Changes:                                                     │
│    fastPeriod:  50 → 20   (Trend detection speed)             │
│    rsiPeriod:   14 → 21   (False signal filter)               │
│    stopLoss%:    5 → 4    (Risk control)                      │
│                                                               │
│  [🔄 Apply All Changes]  [📋 Apply Selected]  [✕ Dismiss]    │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. AI Strategy Health Check (1 USDT)

### What It Does
Scans **all user strategies** and flags health issues with a traffic-light system. Runs automatically daily or on-demand.

### Classification

| Status | Criteria | Action |
|--------|----------|--------|
| 🔴 **Red** | **30 consecutive days** of negative returns OR drawdown > 30% | Immediate attention required. Consider pausing or optimizing. |
| 🟡 **Yellow** | Parameters **not updated in 90 days** OR win rate declining 3+ months | Review recommended. Strategy may need tuning. |
| 🟢 **Green** | All metrics healthy. Win rate stable or improving. Drawdown controlled. | No action needed. Strategy running well. |

### Output

```json
{
  "checkId": "hc_abc123",
  "timestamp": "2026-06-13T00:00:00Z",
  "strategiesScanned": 8,
  "summary": {
    "red": 1,
    "yellow": 2,
    "green": 5,
    "overall": "fair"
  },
  "results": [
    {
      "strategyId": "tpl_macd_divergence",
      "name": "MACD Divergence Hunter",
      "status": "red",
      "diagnosis": {
        "issue": "30-day consecutive loss",
        "detail": "Last 32 days: -8.4% cumulative. Mean-reversion failing in trending market.",
        "recommendedAction": "Pause strategy until market regime changes. Consider switching to trend-following.",
        "lastProfitableDay": "2026-05-11"
      },
      "metrics": {
        "winRate30d": 0.22,
        "return30d": -0.084,
        "maxDrawdown30d": 0.12,
        "daysConsecutiveLoss": 32
      }
    },
    {
      "strategyId": "tpl_rsi_mean_revert",
      "name": "RSI Mean Reversion",
      "status": "yellow",
      "diagnosis": {
        "issue": "Parameters not updated in 90+ days",
        "detail": "Last parameter update: 2026-03-01 (104 days ago). RSI=14 may be suboptimal for current volatility regime.",
        "recommendedAction": "Run AI Optimization to review RSI period and threshold.",
        "lastParameterUpdate": "2026-03-01"
      },
      "metrics": {
        "winRate30d": 0.51,
        "return30d": 0.012,
        "maxDrawdown30d": 0.04
      }
    },
    {
      "strategyId": "tpl_golden_cross",
      "name": "Golden Cross Momentum",
      "status": "green",
      "diagnosis": {
        "issue": null,
        "detail": "Strategy performing well. All metrics within healthy range.",
        "recommendedAction": "No action needed."
      },
      "metrics": {
        "winRate30d": 0.61,
        "return30d": 0.084,
        "maxDrawdown30d": 0.04
      }
    }
  ]
}
```

### UI

```
┌────────────────────────────────────────────────────────────┐
│  🏥 Strategy Health Check              Last: 2 hours ago    │
│                                                            │
│  Summary: 🔴 1  🟡 2  🟢 5                                  │
│                                                            │
│  🔴 MACD Divergence Hunter                                  │
│     ⚠ 30-day consecutive loss (-8.4%)                      │
│     Last profitable: May 11                                 │
│     [Optimize] [Pause]                                      │
│                                                            │
│  🟡 RSI Mean Reversion                                      │
│     ⚠ Parameters 104 days old                               │
│     [Optimize] [Dismiss]                                    │
│                                                            │
│  🟢 Golden Cross Momentum  ✓                                │
│     All metrics healthy                                     │
│                                                            │
│  [Run Health Check Now]   [View All 8 Strategies]          │
└────────────────────────────────────────────────────────────┘
```

### Automatic Scheduling
- Health check runs **daily at 00:00 UTC**
- User can also trigger manually (1 USDT)
- Results cached for 1 hour
- Red status triggers notification after 2 consecutive days

---

## 5. Prompt Design Templates

### Generate Portfolio Prompt

```
You are a quantitative portfolio manager. Based on the user's description
and the available strategy library, select 2-8 strategies and allocate weights.

User goal: {description}
Available strategies:
[{strategyId, name, category, winRate, sharpeRatio, maxDrawdown, totalReturn}]...

Rules:
- Weights sum to 1.0
- Each weight ≥ 5%
- All strategies must be in compatible asset classes
- Diversify across categories (don't put 80% in one category)
- Include reasoning for each selection

Return ONLY valid JSON.
```

### Backtest Interpretation Prompt

```
You are a quantitative analyst. Interpret the following backtest results
in clear language a trader can understand.

Strategy: {name}
Period: {from} to {to}
Results: {winRate, sharpeRatio, maxDrawdown, profitFactor, totalTrades}
Monthly returns: [{month, return}]...
Equity curve: [{date, equity}]...

Analyze:
1. Overall performance assessment
2. Strengths (best periods, consistency)
3. Weaknesses (worst periods, patterns in losses)
4. Parameter sensitivity (which params matter most?)
5. Actionable recommendation

Keep it concise (150-300 words). Base everything on the data provided.
Do NOT make up data.
```

---

> **Related**: `docs/design/ai-workflow-loop.md`, `docs/design/ai-billing-rules.md`, `docs/design/ai-drawlines.md`
