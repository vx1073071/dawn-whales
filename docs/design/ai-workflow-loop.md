# quant-moo AI Strategy Closed-Loop Workflow v1.0

> **Round**: R146 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: DESIGN DOCUMENT — Production Ready
> **Covers**: End-to-end AI strategy loop (fill→backtest→read→optimize→health), integration, caching

---

## Overview

The AI Strategy Closed Loop is an integrated workflow that takes a strategy from **parameter filling → backtesting → interpretation → optimization → health monitoring**. Each step feeds into the next, creating a continuous improvement cycle.

---

## 1. The Closed Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AI STRATEGY CLOSED LOOP                        │
│                                                                     │
│  ┌──────────────────┐                                               │
│  │  1. Parameter    │  User picks a framework (MA cross, RSI, etc.) │
│  │     Fill         │  AI recommends parameters → 1 USDT            │
│  │     (R145)       │  User confirms or edits                       │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  2. Backtest     │  Strategy runs through historical data         │
│  │                  │  Produces: win rate, Sharpe, DD, equity curve  │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  3. Backtest     │  AI interprets backtest results                │
│  │     Reading      │  Explains strengths/weaknesses → 1 USDT       │
│  │     (R146)       │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  4. Optimization │  AI suggests parameter improvements            │
│  │     (R146)       │  Structured output (stop/target/periods)→1.5U │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  Loop: backtest  │  User reruns backtest with new params          │
│  │  + read + opt    │  Repeat steps 3-4 until satisfied              │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  5. Portfolio    │  User combines optimized strategies            │
│  │     Generation   │  AI builds diversified portfolio → 2 USDT     │
│  │     (R146)       │                                               │
│  └────────┬─────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌──────────────────┐                                               │
│  │  6. Health       │  Daily AI scan of all strategies               │
│  │     Check        │  Red/Yellow/Green + recommendations → 1 USDT  │
│  │     (R146)       │  Feeds back into step 4 when issues found      │
│  └──────────────────┘                                               │
│                                                                     │
│  Total cost for complete loop: 1+1+1.5+2+1 = 6.5 USDT               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step User Journey

### Phase 1: Create Strategy (R145 + User)

```
Step 1.1 [R145]: Select strategy framework
  User picks: "Moving Average Crossover"

Step 1.2 [R145]: AI Parameter Fill → 1 USDT
  AI suggests:
    fastPeriod=20, slowPeriod=200, rsiPeriod=14, stopLoss=5%, takeProfit=15%
  User reviews → confirms

Step 1.3 [User]: Configure & Save
  User fine-tunes any parameter
  Strategy saved as "My MA Strategy v1"
```

### Phase 2: Backtest & Understand (R146)

```
Step 2.1 [User]: Run Backtest
  Period: 2024-01-01 to 2025-12-31
  Asset: US stocks (AAPL, MSFT, GOOGL)
  Result: return=42%, Sharpe=1.45, DD=15%

Step 2.2 [R146]: AI Backtest Reading → 1 USDT
  AI interprets:
    "Strong trend-following performance. Q3 2024 was best quarter (+12%).
     Q1 2025 was weakest (-4.3%) due to choppy sideways market.
     Strategy excels in trending markets but generates false signals in low vol."
```

### Phase 3: Optimize (R146)

```
Step 3.1 [R146]: AI Optimization → 1.5 USDT
  AI analyzes current params + backtest + market conditions
  Suggestions:
    fastPeriod: 20→10  (faster entry, but more false signals)
    stopLoss%:  5→4   (tighter risk control)
    add VIX filter > 15 (eliminate low-vol false signals)

Step 3.2 [User]: Review & Apply
  User compares before/after:
    Current:  Sharpe 1.45 | DD 15%
    Proposed: Sharpe 1.62 | DD 10%
  User applies fastPeriod=10 + stopLoss=4 + VIX filter

Step 3.3 [User]: Re-run Backtest
  New backtest with updated parameters
  Result: Sharpe 1.60 | DD 11%
  → Good improvement!

Step 3.4 [Optional]: Re-interpret
  AI reads new backtest → 1 USDT
  Confirms improvement, notes trade-off (more trades, lower avg win)
```

### Phase 4: Deploy & Monitor (R146)

```
Step 4.1 [R146]: Portfolio Generation → 2 USDT
  User: "I want a diversified US stock portfolio"
  AI selects:
    40% My MA Strategy v2 (optimized)
    30% RSI Mean Reversion
    20% MACD Divergence
    10% Bollinger Band Reversal
  User saves as "US Stock Portfolio"

Step 4.2 [R146]: Daily Health Check → 1 USDT/day (auto) or manual
  AI scans "My MA Strategy v2":
    Green ✓ — all metrics healthy
  AI scans "RSI Mean Reversion":
    Yellow ⚠ — params 104 days old

Step 4.3 [R146]: When Yellow → back to Optimization
  Yellow alert → User clicks "Optimize" → AI suggests new params → Apply → Re-test

Step 4.4 [R146]: When Red → immediate action
  Red alert → "30-day losing streak"
  Options: Pause strategy | Emergency Optimize | Replace in portfolio
```

---

## 3. Cost Summary (Full Cycle)

```
Scenario: New user creates a complete strategy suite

  Phase 1 (Create):      1 USDT  (fill params)
  Phase 2 (Understand):  1 USDT  (interpret first backtest)
  Phase 3 (Optimize):    1.5 USDT (optimize)
                         1 USDT  (re-interpret after optimization)
  Phase 4 (Deploy):      2 USDT  (build portfolio)
                         1 USDT  (health check)
  ─────────────────────────────────────────
  One-time:              6.5 USDT
  Ongoing:               1 USDT/day (daily health check on all strategies)

Typical user spend (first week):   ~13 USDT
Typical user spend (monthly):      ~30 USDT (daily health checks)
```

---

## 4. Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI WORKFLOW INTEGRATION                          │
│                                                                     │
│  User Client (Electron + React)                                     │
│  │                                                                  │
│  ├─→ POST /api/ai/param-fill      → server/services/ai-param-fill  │
│  ├─→ POST /api/ai/backtest-read   → server/services/ai-backtest-read│
│  ├─→ POST /api/ai/optimize        → server/services/ai-optimize    │
│  ├─→ POST /api/ai/generate-pf     → server/services/ai-portfolio   │
│  └─→ POST /api/ai/health-check    → server/services/ai-health      │
│                                                                     │
│  All AI calls route through:                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  server/services/ai-orchestrator.ts (PM, R145)                  ││
│  │  ├─ ai-billing.ts:    deduct/refund                             ││
│  │  ├─ ai-fallback.ts:   4-tier degradation                        ││
│  │  ├─ ai-cache.ts:      1-hour cache for same K-line/symbol       ││
│  │  └─ multi-llm-router.ts: route to DeepSeek/MiniMax              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  Workflow orchestration:                                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  server/services/ai-workflow.ts (PM, R146)                      ││
│  │  - Tracks user's current position in the loop                   ││
│  │  - Suggests next step based on current state                    ││
│  │  - Pre-fills context between steps (backtest data → optimizer)  ││
│  │  - Enforces loop rules (can't optimize without backtest first)  ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Caching Strategy

### What Gets Cached

| Cache Key | Cache | TTL | Reason |
|-----------|-------|-----|--------|
| Same symbol + same K-line data hash | Drawing results | 1 hour | User re-clicking "AI Draw" on same chart |
| Same backtest result + same strategy | Backtest interpretation | 1 hour | User re-reading same backtest |
| Same strategy + same params | Optimization suggestions | 1 hour | User running optimize twice |
| Same portfolio set | Health check results | 1 hour | Daily auto-scan vs manual trigger |

### Cache Implementation

```typescript
// server/services/ai-cache.ts

interface CacheEntry {
  key: string;
  result: AIResponse;
  expiresAt: number;  // Unix ms
  hitCount: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(type: string, hash: string): string {
  return `ai:${type}:${hash}`;
}

function checkCache(type: string, hash: string): AIResponse | null {
  const key = getCacheKey(type, hash);
  const entry = cache.get(key);

  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  entry.hitCount++;
  console.log(`[AI Cache] HIT ${type} (hit #${entry.hitCount})`);
  return entry.result;
}

function setCache(type: string, hash: string, result: AIResponse, ttlMs: number): void {
  const key = getCacheKey(type, hash);
  cache.set(key, { key, result, expiresAt: Date.now() + ttlMs, hitCount: 0 });
}
```

### Cache Rules

```
1. Cache only after successful AI call (not failures)
2. Cache key = SHA256(type + input_hash)
3. Billing: cached response = NO deduction (free replay within TTL)
4. User can force-refresh to bypass cache
5. Cache auto-clears on new K-line data / backtest rerun
```

---

## 6. Token Monitoring

### Per-Request Limits

| Limit | Value | Action on Exceed |
|-------|-------|-----------------|
| Input tokens per request | 4,000 | Truncate + warn user |
| Output tokens per request | 2,000 | Truncate response |
| Timeout | 30s | Refund, try next fallback tier |

### Daily Limits

| Limit | Value | Action |
|-------|-------|--------|
| Per-user AI calls/day | 50 | Warn, no block (business decision: let them spend) |
| Total platform AI spend/day | 500 USDT | INFO alert to PM |

### Cost Tracking

```
Per AI call:
  Log: { userId, type, model, tier, tokens_in, tokens_out, cost_to_platform, charged_to_user }

Per day aggregation:
  Sum: total_calls, total_tokens, platform_cost, user_revenue
  Margin: user_revenue - platform_cost
```

---

## 7. State Machine: AI Workflow Progress

```
User's current position in the loop:

  [NO_STRATEGY] ──→ [PARAMS_FILLED] ──→ [BACKTEST_DONE] ──→ [INTERPRETED]
                        │                      │                 │
                        │                      │                 ▼
                        │                      │           [OPTIMIZED]
                        │                      │                 │
                        │                      │    ┌────────────┘
                        │                      │    ▼
                        │                      │ [BACKTEST_DONE]
                        │                      │    │
                        │                      │    ▼  (user satisfied)
                        │                      │ [DEPLOYED]
                        │                      │    │
                        │                      │    ├─→ [PORTFOLIO_GENERATED]
                        │                      │    └─→ [MONITORING]
                        │                      │         │
                        │                      │    ┌────┴────┐
                        │                      │    ▼         ▼
                        │                      │ [GREEN]  [YELLOW]
                        │                      │            │
                        │                      │            └─→ [OPTIMIZED]
                        │                      │
                        └──────────────────────┴─ (can also test directly without AI fill)
```

### Workflow Rules

```
1. Cannot read backtest without backtest data → show "Run backtest first"
2. Cannot optimize without strategy params → show "Create strategy first"
3. Health check can run anytime regardless of workflow position
4. Portfolio generation can use non-AI-optimized strategies
5. Workflow position persists across sessions (saved per user)
```

---

## 8. AI Workflow API

### `GET /api/ai/workflow/state`

```json
{
  "userId": "user_abc",
  "currentStep": "optimized",
  "suggestedNextSteps": ["portfolio_generation", "health_check"],
  "recentHistory": [
    { "step": "param_fill", "timestamp": "2026-06-13T09:00:00Z", "cost": 1.00 },
    { "step": "backtest_read", "timestamp": "2026-06-13T09:30:00Z", "cost": 1.00 },
    { "step": "optimize", "timestamp": "2026-06-13T10:00:00Z", "cost": 1.50 }
  ],
  "totalSpentToday": 3.50
}
```

---

> **Related**: `docs/design/ai-strategy-suite.md`, `docs/design/ai-billing-rules.md`, `docs/design/ai-drawlines.md`
