# quant-moo AI Auto-Drawing & Pattern Recognition v1.0

> **Round**: R145 | **Author**: QClaw | **Date**: 2026-06-13
> **Status**: USER GUIDE — Production Ready
> **Covers**: 10 drawing types, 8 chart patterns, interaction flow, coordinate protocol

---

## Overview

AI Auto-Drawing uses DeepSeek V4 Pro to analyze K-line charts and automatically generate **technical drawings** and **chart pattern annotations**. One click, 1 USDT, instant results.

### Cost
```
AI Auto-Drawing + Pattern Recognition: 1 USDT per analysis
- Covers both drawing lines AND chart pattern detection
- Deducted silently before AI call
- Full refund if analysis fails
```

---

## 1. Supported Drawing Types (10 total)

| # | Drawing | Description | Output |
|---|---------|-------------|--------|
| 1 | **Trend Line** | Connects consecutive higher lows (uptrend) or lower highs (downtrend) | 2+ points, slope |
| 2 | **Support Line** | Horizontal or diagonal price floor where buying pressure emerges | 2+ points, level |
| 3 | **Resistance Line** | Horizontal or diagonal price ceiling where selling pressure emerges | 2+ points, level |
| 4 | **Channel (Top)** | Upper boundary of a parallel price channel | 2+ points, parallel to bottom |
| 5 | **Channel (Bottom)** | Lower boundary of a parallel price channel | 2+ points, parallel to top |
| 6 | **Fibonacci Retracement** | Key retracement levels (0.236, 0.382, 0.5, 0.618, 0.786) from swing high→low | Multiple horizontal lines |
| 7 | **Fibonacci Extension** | Extension levels (1.272, 1.618) for price targets | Multiple horizontal lines |
| 8 | **Pitchfork** | Median line + parallel rails from 3 pivot points | 3 lines (median, upper, lower) |
| 9 | **Neckline** | Key level in head-and-shoulders / double top-bottom patterns | 1 horizontal line |
| 10 | **Volume Profile POC** | Point of Control — price level with highest volume | 1 horizontal line at POC |

---

## 2. Chart Pattern Recognition (8 types)

| # | Pattern | Type | Detection Criteria | Confidence Threshold |
|---|---------|------|--------------------|---------------------|
| 1 | **Head & Shoulders Top** | Reversal (bearish) | Left shoulder → Head (higher) → Right shoulder → Neckline break | > 50% |
| 2 | **Head & Shoulders Bottom** | Reversal (bullish) | Left shoulder → Head (lower) → Right shoulder → Neckline break | > 50% |
| 3 | **Double Top** | Reversal (bearish) | Two peaks at similar level with valley between | > 50% |
| 4 | **Double Bottom** | Reversal (bullish) | Two valleys at similar level with peak between | > 50% |
| 5 | **Ascending Triangle** | Continuation (bullish) | Flat top resistance + rising support line | > 40% |
| 6 | **Descending Triangle** | Continuation (bearish) | Flat bottom support + falling resistance line | > 40% |
| 7 | **Bull Flag** | Continuation (bullish) | Sharp rise (pole) + downward consolidation (flag) | > 40% |
| 8 | **Bear Flag** | Continuation (bearish) | Sharp drop (pole) + upward consolidation (flag) | > 40% |

### Confidence System

```
Confidence ≥ 70%:  🟢 High confidence — prominently displayed, bold annotation
Confidence 50-69%: 🟡 Medium confidence — displayed with dashed lines
Confidence 30-49%: 🟠 Low confidence — faint overlay, may still be useful
Confidence < 30%:  ⚫ Not displayed — too uncertain to be actionable
```

---

## 3. User Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    K-Line Chart View                         │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │             ▼ AAPL  1D   $150.00                  │      │
│  │  ┌──────────────────────────────────────────┐    │      │
│  │  │         Candle Chart Area                 │    │      │
│  │  │          ╱╲    ╱╲                         │    │      │
│  │  │    ╱╲  ╱    ╲╱  ╲  ╱╲                    │    │      │
│  │  │  ╱    ╲          ╲╱  ╲                   │    │      │
│  │  │ ╱                           ╲╱             │    │      │
│  │  │                                           │    │      │
│  │  └──────────────────────────────────────────┘    │      │
│  │                                                  │      │
│  │  [🤖 AI Draw] ← Click this!                      │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  Click "AI Draw" →                                          │
│  ┌──────────────────────────────────────────────┐          │
│  │  🤖 AI Analysis                               │          │
│  │                                              │          │
│  │  Analyzing last 200 candles...               │          │
│  │  Cost: 1 USDT (deducted from wallet)         │          │
│  │                                              │          │
│  │  [Cancel]                                    │          │
│  └──────────────────────────────────────────────┘          │
│       │                                                     │
│       ▼ (1-3 seconds, silent deduction)                     │
│  ┌──────────────────────────────────────────────────┐      │
│  │         Candle Chart with AI Drawings             │      │
│  │          ╱╲    ╱╲──── Resistance: $155.00        │      │
│  │    ╱╲  ╱  ──╲╱──╲──╱╲─── Trend Line             │      │
│  │  ╱    ╲          ╲╱  ╲                           │      │
│  │ ╱───Support: $142.00──╲╱──                        │      │
│  │                                                   │      │
│  │ [Double Bottom 🟡 65% @ $142]                    │      │
│  │                                                  │      │
│  │ [✕ Clear] [💾 Save]                              │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Coordinate Protocol

AI returns structured JSON coordinates for rendering:

```json
{
  "analysisId": "ai_draw_abc123",
  "symbol": "AAPL",
  "timeframe": "1D",
  "candlesAnalyzed": 200,
  "timestamp": "2026-06-13T10:00:00Z",
  "drawings": [
    {
      "type": "trend_line",
      "confidence": 0.88,
      "label": "Uptrend Support",
      "points": [
        { "time": 1718236800, "price": 142.30 },
        { "time": 1720656000, "price": 148.50 },
        { "time": 1723075200, "price": 155.20 }
      ],
      "extend": "right",
      "style": { "color": "#00AA00", "width": 2, "dash": "solid" }
    },
    {
      "type": "resistance",
      "confidence": 0.75,
      "label": "Resistance $155",
      "points": [
        { "time": 1718236800, "price": 155.00 },
        { "time": 1723075200, "price": 155.00 }
      ],
      "style": { "color": "#CC0000", "width": 1, "dash": "dashed" }
    },
    {
      "type": "support",
      "confidence": 0.82,
      "label": "Support $142",
      "points": [
        { "time": 1718236800, "price": 142.00 },
        { "time": 1723075200, "price": 142.00 }
      ],
      "style": { "color": "#00AA00", "width": 1, "dash": "dashed" }
    }
  ],
  "patterns": [
    {
      "type": "double_bottom",
      "confidence": 0.65,
      "label": "Double Bottom",
      "sentiment": "bullish",
      "points": [
        { "time": 1719446400, "price": 142.00 },
        { "time": 1720656000, "price": 152.00 },
        { "time": 1721865600, "price": 142.50 }
      ],
      "neckline": 152.00,
      "target": 162.00,
      "zone": {
        "fromTime": 1719446400,
        "toTime": 1723075200,
        "fromPrice": 140.00,
        "toPrice": 156.00
      }
    }
  ],
  "summary": "Strong uptrend with established support at $142. Resistance at $155 being tested. Double bottom pattern forming with $162 target."
}
```

### Coordinate Rules

```
1. All times in Unix epoch (seconds)
2. All prices in US Dollars
3. Points array: ordered left-to-right (time ascending)
4. Support/Resistance: horizontal lines → same price, different times
5. Trend Lines: diagonal → varying prices
6. Patterns: points = key pivot points + neckline + target
```

---

## 5. AI Prompt Design (DeepSeek V4 Pro)

### Drawing Prompt Template

```
You are a technical analysis expert. Analyze the following {timeframe} K-line data
for {symbol} ({N} candles) and identify support/resistance levels, trend lines,
channels, Fibonacci levels, and pitchforks.

Return ONLY valid JSON, no explanation.

K-line data:
[
  { "t": 1718236800, "o": 143.50, "h": 145.20, "l": 142.10, "c": 144.80, "v": 1234567 },
  ...
]

Return format:
{
  "drawings": [
    {
      "type": "trend_line|support|resistance|channel_top|channel_bottom|fib_retracement|fib_extension|pitchfork|neckline|volume_poc",
      "confidence": 0.0-1.0,
      "label": "short description",
      "points": [{"time": unix_seconds, "price": number}],
      "extend": "left|right|both"
    }
  ],
  "patterns": [
    {
      "type": "head_shoulders_top|head_shoulders_bottom|double_top|double_bottom|ascending_triangle|descending_triangle|bull_flag|bear_flag",
      "confidence": 0.0-1.0,
      "label": "pattern name",
      "sentiment": "bullish|bearish",
      "points": [key pivot points],
      "neckline": price,
      "target": price
    }
  ],
  "summary": "one sentence summary"
}

Rules:
- Only include drawings with confidence > 30%
- Only include patterns with confidence > 30%
- Support/resistance: horizontal lines connecting at least 2 touches
- Trend lines: diagonal lines connecting at least 2 touches
- Channels: parallel top and bottom
- Fibonacci: use the most prominent swing high and low
- POC: price with highest cumulative volume
```

### Constraints

```
- Input: Up to 500 K-line candles (4KB max per prompt)
- Timeout: 30 seconds per request
- Model: DeepSeek V4 Pro (with fallback chain)
- Retry: Up to 2 retries on timeout/parse failure
```

---

## 6. User Controls

| Action | Button | Behavior |
|--------|--------|----------|
| **Draw** | 🤖 AI Draw | Analyze current chart, 1 USDT |
| **Clear** | ✕ Clear | Remove all AI drawings from chart |
| **Save** | 💾 Save | Save drawings to chart template (persists across sessions) |
| **Toggle** | 👁 Hide/Show | Toggle visibility of AI layer |
| **Undo** | ↩ Undo | Remove last drawing set |

### Clear Rules
- "Clear" removes AI drawings from the current view only
- Previously saved drawings remain in the template library
- "Clear" does NOT refund the 1 USDT (analysis was performed)

---

## 7. Error Handling

| Scenario | User Sees | Behavior |
|----------|-----------|----------|
| AI analysis success | Drawings rendered | Normal |
| AI timeout (>30s) | "Analysis timed out. 1 USDT refunded." | Refund + offer retry |
| AI returns invalid JSON | "Analysis failed. 1 USDT refunded." | Refund + offer retry |
| Insufficient balance | "Insufficient balance. Need 1 USDT." | No deduction, no API call |
| Network error | "Connection error. 1 USDT refunded." | Refund + offer retry |
| No patterns found | "No significant patterns detected." | Still charged 1 USDT (analysis ran) |

---

## 8. Degradation / Fallback

| Tier | Model | Used When | Performance |
|------|-------|-----------|-------------|
| 1 | DeepSeek V4 Pro (discounted) | Default | Best accuracy |
| 2 | DeepSeek V4 Pro (full price) | Tier 1 unavailable | Same accuracy, higher cost |
| 3 | DeepSeek V4 Flash | Tier 2 unavailable | Faster, slightly lower accuracy |
| 4 | MiniMax-M3 | Tier 3 unavailable | Last resort, lowest cost |

Fallback is **transparent to user** (same UX, same price).

---

> **Related**: `docs/design/ai-billing-rules.md`, `docs/design/ai-param-fill.md`
