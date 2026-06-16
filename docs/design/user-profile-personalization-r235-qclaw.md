# R235-QClaw#1: User Profile & Personalization System
## Dawn Whales v2.6.0 QUANTUM

---

## 1. OVERVIEW

### 1.1 Purpose
Build a user profiling system that:
1. Classifies every user into 1 of 3 trading styles
2. Uses style to auto-recommend strategies and preset parameters
3. Evolves the profile as user behavior changes
4. Powers the recommendation engine for marketplace + AI features

### 1.2 Design Philosophy
- **Progressive Profiling**: Start with a quick 6-question quiz, refine with behavior data
- **No Fake Personalization**: Every recommendation has a traceable reason
- **User-Controlled**: Users can always override their assigned style
- **Privacy-First**: Profile computed locally on-device, only aggregate data shared

---

## 2. TRADING STYLE ARCHETYPES

### 2.1 The 3 Styles

| Dimension | 🟦 **The Analyst** (Conservative) | 🟧 **The Tactician** (Balanced) | 🔴 **The Hunter** (Aggressive) |
|-----------|------|------|------|
| **Risk Tolerance** | Low (<15% drawdown) | Medium (15-30%) | High (>30%) |
| **Time Horizon** | Long-term (months+) | Medium-term (weeks) | Short-term (hours-days) |
| **Decision Style** | Data-driven, slow | Rules-based, methodical | Intuitive, fast |
| **Position Sizing** | 5-10% per trade | 10-25% per trade | 25-50% per trade |
| **Max Positions** | 3-5 concurrent | 5-10 concurrent | 10-20 concurrent |
| **Preferred Markets** | Blue-chip stocks, ETFs | Mid-cap, crypto majors | Small-cap, altcoins, futures |
| **Analysis Method** | Fundamental + macro | Technical + sentiment | Price action + momentum |
| **Target Return** | 10-20% annual | 20-50% annual | 50%+ annual |
| **Stop-Loss Style** | Tight (3-5%) | Medium (5-10%) | Wide (10-20%) |
| **Holding Period** | 30-180 days | 5-30 days | 1-5 days |

### 2.2 Style Archetype Personas

**The Analyst (🟦)** — "I want steady, low-risk growth."
- Sarah, 42, working professional
- Checks portfolio weekly, not daily
- Prefers dividend stocks and index ETFs
- Uses 5% per position, tight stops
- Reads quarterly reports before entering

**The Tactician (🟧)** — "I follow a system and stick to it."
- Michael, 31, semi-active trader
- Checks daily, adjusts weekly
- Uses factor-based strategies with clear rules
- 15% per position, defined entry/exit
- Backtests before deploying new strategies

**The Hunter (🔴)** — "I hunt for alpha in volatile markets."
- Alex, 26, active day trader
- Monitors markets constantly
- Trades crypto futures, volatile small-caps
- 30% per position, aggressive scaling
- Acts on momentum and news catalysts

### 2.3 Style Color Coding (WCAG AA Compliant)
| Style | Color | Hex | Usage |
|-------|-------|-----|-------|
| Analyst | Blue | `#3b82f6` | Cards, badges, highlights |
| Tactician | Orange | `#f97316` | Cards, badges, highlights |
| Hunter | Red-Orange | `#ef4444` | Cards, badges, highlights |

---

## 3. USER PROFILE DATA MODEL

```typescript
interface UserProfile {
  userId: string;
  // ── Core ──
  tradingStyle: 'analyst' | 'tactician' | 'hunter';
  styleConfidence: number;        // 0-1, how sure the system is
  styleSource: 'quiz' | 'behavior' | 'manual';
  lastStyleUpdate: number;

  // ── Quiz Results ──
  quiz: {
    completed: boolean;
    completedAt?: number;
    answers: Record<string, number>; // questionId → score
    resultScores: { analyst: number; tactician: number; hunter: number };
  };

  // ── Behavioral Signals ──
  behavior: {
    avgHoldingDays: number;       // rolling 90-day average
    avgPositionSize: number;      // % of portfolio
    maxConcurrentPositions: number;
    stopLossUsage: number;        // 0-1, how often SL is set
    takeProfitUsage: number;
    tradeFrequency: number;       // trades per month
    preferredMarkets: string[];   // top 3 market tags
    preferredAssetClasses: string[];
    orderTypes: Record<string, number>; // market/limit/stop → count
    timeOfDay: {                   // trading activity by hour
      morning: number;             // 09:00-12:00
      afternoon: number;           // 13:00-17:00
      evening: number;             // 17:00-22:00
      night: number;               // 22:00-09:00
    };
    winRate: number;
    avgReturnPerTrade: number;
    maxDrawdown: number;
    sharpeRatio: number;
    volatilityTolerance: number;  // derived from maxDrawdown / positionSize
  };

  // ── Preferences (learned + manual) ──
  preferences: {
    preferredStopLoss: number;    // default SL %
    preferredTakeProfit: number;  // default TP %
    defaultPositionSize: number;
    defaultOrderType: string;
    preferredIndicators: string[]; // RSI, MACD, MA, BB...
    uiTheme: 'light' | 'dark' | 'system';
    notificationsEnabled: boolean;
    autoRebalance: boolean;
  };

  // ── Evolutions ──
  history: ProfileSnapshot[];
}

interface ProfileSnapshot {
  timestamp: number;
  style: string;
  confidence: number;
  trigger: 'quiz' | 'quarterly_review' | 'threshold_change' | 'manual';
  metrics: Partial<BehaviorMetrics>;
}
```

---

## 4. ONBOARDING PERSONALITY QUIZ

### 4.1 Quiz Flow
```
Welcome Screen ("Let's find your trading style")
  ↓
6 Questions (one per screen, progress bar)
  ↓
Results Animation (style revealed with explainer)
  ↓
Parameter Presets (automatically applied)
  ↓
Customization (user can adjust anything)
  ↓
Done — redirected to Dashboard
```

### 4.2 The 6 Questions

| # | Question | Options (score: A=Analyst, T=Tactician, H=Hunter) |
|---|----------|------|
| Q1 | "When the market drops 10%, you..." | A: "Wait and research why" / T: "Check if my rules trigger a sell" / H: "Buy the dip!" |
| Q2 | "Your ideal holding period is..." | A: "Months to years" / T: "Weeks to a month" / H: "Hours to days" |
| Q3 | "How do you pick what to trade?" | A: "I read reports and financials" / T: "I use quantitative screens" / H: "I follow momentum and news" |
| Q4 | "What's your max acceptable loss per trade?" | A: "Less than 5%" / T: "5-15%" / H: "15% or more" |
| Q5 | "How often do you want to check your portfolio?" | A: "Weekly" / T: "Daily" / H: "Constantly" |
| Q6 | "What excites you most about trading?" | A: "Building long-term wealth" / T: "Testing strategies that work" / H: "The thrill of a good trade" |

### 4.3 Scoring Algorithm
```typescript
function computeStyle(answers: Record<string, string>): StyleResult {
  const scores = { analyst: 0, tactician: 0, hunter: 0 };
  for (const [qId, answer] of Object.entries(answers)) {
    const weight = getQuestionWeight(qId);
    scores[answer.style] += weight;
  }
  const total = scores.analyst + scores.tactician + scores.hunter;
  const pct = {
    analyst: scores.analyst / total,
    tactician: scores.tactician / total,
    hunter: scores.hunter / total,
  };
  // Find dominant style
  const dominant = Object.entries(pct).sort((a, b) => b[1] - a[1])[0];
  return {
    style: dominant[0],
    confidence: dominant[1], // >0.5 = clear, >0.4 = borderline
    scores: pct,
  };
}
```

### 4.4 Borderline Cases
- If top style < 0.4 confidence → show both top 2 styles, let user choose
- "You seem between Analyst and Tactician. Which feels more like you?"

---

## 5. RECOMMENDATION ENGINE

### 5.1 Strategy → Style Matching Matrix

| Strategy Category | Analyst 🟦 | Tactician 🟧 | Hunter 🔴 |
|-------------------|:---------:|:---------:|:---------:|
| Dividend Growth | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Index Tracking | ⭐⭐⭐ | ⭐⭐ | — |
| Blue-Chip Value | ⭐⭐⭐ | ⭐⭐ | — |
| Bond/Fixed Income | ⭐⭐⭐ | ⭐ | — |
| Mean Reversion | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Factor Rotation | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Pairs Trading | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Grid Trading | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Momentum | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Breakout Trading | — | ⭐⭐ | ⭐⭐⭐ |
| Scalping | — | ⭐ | ⭐⭐⭐ |
| Options/High Lev | — | ⭐ | ⭐⭐⭐ |
| Futures (Crypto) | — | ⭐ | ⭐⭐⭐ |

### 5.2 Recommendation Algorithm
```typescript
function recommendStrategies(
  profile: UserProfile,
  allStrategies: Strategy[],
  limit: number = 5
): ScoredStrategy[] {
  return allStrategies
    .map(s => ({
      strategy: s,
      score: computeMatchScore(profile, s),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function computeMatchScore(profile: UserProfile, strategy: Strategy): number {
  let score = 0;

  // Style match (40% weight) — from matrix
  score += 0.40 * getStyleMatchScore(profile.tradingStyle, strategy.category);

  // Market preference (20% weight)
  score += 0.20 * marketOverlapScore(profile.behavior.preferredMarkets, strategy.markets);

  // Risk alignment (20% weight)
  score += 0.20 * riskAlignmentScore(profile.behavior.volatilityTolerance, strategy.riskLevel);

  // Time horizon (10% weight)
  score += 0.10 * horizonMatchScore(profile.behavior.avgHoldingDays, strategy.expectedHoldingDays);

  // Social proof (10% weight)
  score += 0.10 * socialProofScore(strategy.salesCount, strategy.avgRating);

  return score; // 0-1
}
```

### 5.3 Cold Start (No Behavior Data)
Before behavior data is accumulated:
- 100% from quiz result (or manual selection)
- Recommendations based purely on style matrix
- First 5 trades tracked → start building behavior signals
- After 10 trades → quiz weight drops to 50%, behavior 50%
- After 30 trades → quiz weight 20%, behavior 80%

---

## 6. PARAMETER PRESETS BY STYLE

When a user applies a strategy, parameters are pre-filled based on their style:

| Parameter | Analyst 🟦 | Tactician 🟧 | Hunter 🔴 |
|-----------|------|------|------|
| Position Size | 8% | 15% | 30% |
| Stop Loss | 4% | 8% | 15% |
| Take Profit | 12% | 20% | 40% |
| Max Positions | 4 | 8 | 15 |
| Order Type | Limit | Limit | Market |
| Rebalance Freq | Monthly | Weekly | Daily |
| Auto-Reinvest | Yes | Optional | No |
| Alert Threshold | 2% move | 3% move | 5% move |

### 6.1 Preset Application
```typescript
function applyStylePresets(strategy: Strategy, profile: UserProfile): StrategyConfig {
  const presets = STYLE_PRESETS[profile.tradingStyle];
  return {
    ...strategy.defaultConfig,
    positionSize: presets.positionSize,
    stopLoss: presets.stopLoss,
    takeProfit: presets.takeProfit,
    maxPositions: presets.maxPositions,
    orderType: presets.orderType,
    rebalanceFrequency: presets.rebalanceFreq,
  };
}
```

### 6.2 Override Policy
- User can always override any preset
- "Smart override": system detects if user consistently changes a parameter and learns the preference
- After 3 manual overrides of same param → system updates the stored preference

---

## 7. ADAPTIVE PROFILE EVOLUTION

### 7.1 Trigger Events for Recalculation
| Trigger | Frequency | Action |
|---------|-----------|--------|
| 10 trades completed | Once | First behavioral calibration |
| 30 trades completed | Once | Major recalibration (quiz→20%, behavior→80%) |
| Quarterly review | Every 90 days | Full profile refresh |
| Style drift detected | Real-time | Alert user: "Your trading has become more aggressive" |
| Manual request | On-demand | User triggers re-assessment |

### 7.2 Style Drift Detection
```typescript
function detectStyleDrift(profile: UserProfile, recentBehavior: BehaviorMetrics): DriftAlert | null {
  const current = STYLE_PROFILES[profile.tradingStyle];

  // Check if recent behavior is outside current style boundaries
  const warnings: string[] = [];

  if (recentBehavior.maxDrawdown > current.maxDrawdown * 1.5) {
    warnings.push(`Your recent drawdown (${recentBehavior.maxDrawdown}%) exceeds your ${profile.tradingStyle} profile (${current.maxDrawdown}%).`);
  }
  if (recentBehavior.avgPositionSize > current.positionSize * 1.5) {
    warnings.push(`Your position sizes have grown beyond your typical ${profile.tradingStyle} range.`);
  }
  if (recentBehavior.tradeFrequency > current.tradeFrequency * 2) {
    warnings.push(`You are trading much more frequently than typical for a ${profile.tradingStyle}.`);
  }

  if (warnings.length >= 2) {
    const suggestedStyle = computeStyleFromBehavior(recentBehavior);
    return {
      currentStyle: profile.tradingStyle,
      suggestedStyle,
      warnings,
      action: 'Would you like to update your profile or discuss with an AI advisor?',
    };
  }
  return null;
}
```

### 7.3 Profile History Visualization
```
Profile Timeline (ProfilePage)
┌────────────────────────────────────────────┐
│ Your Trading Evolution                      │
│                                             │
│  🟦 Analyst ────┐                           │
│                  ├──🟧 Tactician ── (now)   │
│  Jan          Apr          Jul             │
│  Quiz: 85%   Recal: 70%  Drift alert       │
│  "Started    "Rules are  "More active      │
│   cautious"   clicking"   than before"      │
│                                             │
│ ── Style Score Breakdown ──                │
│ Analyst:     ████████░░ 80%→65%→45%        │
│ Tactician:   ████░░░░░░ 15%→30%→50%        │
│ Hunter:      █░░░░░░░░░  5%→ 5%→ 5%        │
└────────────────────────────────────────────┘
```

---

## 8. PROFILE DASHBOARD UI

### 8.1 ProfilePage Layout
```
┌──────────────────────────────────────────────┐
│  ← Back      Your Trading Profile      [Edit]│
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────────────────┐             │
│  │  🟧 Tactician              │             │
│  │  Confidence: 78%           │             │
│  │  Source: Behavior (80%)    │             │
│  │           + Quiz (20%)     │             │
│  │  Updated: 3 days ago       │             │
│  │  [Retake Quiz] [Reset]     │             │
│  └─────────────────────────────┘             │
│                                               │
│  ── Your Trading DNA ──                      │
│  ┌──────────┬──────────┬──────────┐          │
│  │Risk      │Horizon   │Frequency │          │
│  │Medium    │Medium    │Daily     │          │
│  │████████░░│██████░░░░│█████████░│          │
│  └──────────┴──────────┴──────────┘          │
│  ┌──────────┬──────────┬──────────┐          │
│  │Win Rate  │Sharpe    │Max DD    │          │
│  │  62%     │  1.8     │ -14%     │          │
│  └──────────┴──────────┴──────────┘          │
│                                               │
│  ── Preferred Markets ──                     │
│  🪙 Crypto 65%  │ 🇺🇸 US Stocks 25%          │
│  🇭🇰 HK Stocks 10% │ +2 more                  │
│                                               │
│  ── Your Presets ──                          │
│  Position: 15%  │  Stop Loss: 8%             │
│  Take Profit: 20%  │  Order: Limit           │
│  [Customize Presets]                         │
│                                               │
│  ── Style Evolution ──                       │
│  [Timeline chart]                            │
│                                               │
│  ── Recommendations for You ──               │
│  [3 strategy cards with match scores]        │
│  "89% match · Based on your Tactician style" │
└──────────────────────────────────────────────┘
```

### 8.2 Dashboard Widget (mini)
```
┌─────────────────────────────┐
│ 🟧 Your Style: Tactician    │
│ 3 new strategies for you →  │
│ Risk: Medium · 78% match    │
│ [View Recommendations]      │
└─────────────────────────────┘
```

---

## 9. PRIVACY & DATA USAGE

| Principle | Implementation |
|-----------|---------------|
| **Local-first** | Profile computed on-device, no server-side analysis |
| **Opt-in sharing** | Aggregate style distribution sent only with permission |
| **No PII** | Profile does not contain name, email, or identifiable data |
| **Deletion** | "Delete My Profile" button removes all profiling data |
| **Export** | Profile available as JSON download |
| **Differential privacy** | Aggregate stats add noise before sharing for market insights |

### 9.1 Shared Aggregate Data (Opt-in)
```json
{
  "styleDistribution": { "analyst": 35, "tactician": 45, "hunter": 20 },
  "popularMarketsByStyle": {
    "analyst": ["us", "hk"],
    "tactician": ["crypto", "us"],
    "hunter": ["crypto", "futures"]
  },
  "avgPerformanceByStyle": {
    "analyst": { "avgReturn": 12.5, "avgSharpe": 1.2 },
    "tactician": { "avgReturn": 28.3, "avgSharpe": 1.8 },
    "hunter": { "avgReturn": 45.1, "avgSharpe": 0.9 }
  }
}
```

---

## 10. IPC CHANNELS

```typescript
'profile:get'          // Get user profile
'profile:update'       // Update profile (style, preferences)
'profile:quiz:submit'  // Submit quiz answers → get style result
'profile:recalibrate'  // Trigger recalibration from behavior
'profile:drift:check'  // Check for style drift
'profile:delete'       // Delete profiling data
'profile:export'       // Export profile as JSON
'recommend:forUser'    // Get personalized strategy recommendations
'recommend:presets'    // Get parameter presets for a strategy + user
```

---

## 11. IMPLEMENTATION FILE MAP

```typescript
// Core Engine
electron/engine/personalization/profile-engine.ts       // Main profile logic
electron/engine/personalization/style-classifier.ts     // Quiz scoring + behavior classification
electron/engine/personalization/recommendation-engine.ts // Strategy matching
electron/engine/personalization/preset-engine.ts        // Parameter presets
electron/engine/personalization/drift-detector.ts       // Style drift monitoring

// IPC
electron/ipc/profile-ipc.ts

// Frontend
src/pages/ProfilePage.tsx           // Full profile dashboard
src/pages/OnboardingQuiz.tsx        // 6-question quiz flow
src/components/profile/StyleCard.tsx // Style badge + confidence
src/components/profile/StyleEvolution.tsx // Timeline chart
src/components/profile/MarketPreferences.tsx // Market distribution
src/components/profile/PresetEditor.tsx // Parameter preset editor
src/components/recommendations/ForYou.tsx // Personalized recs widget

// Store
src/stores/profileStore.ts (zustand)

// Types
electron/types/profile.ts
```

---

## 12. SUCCESS METRICS

| Metric | Target |
|--------|--------|
| Quiz completion rate | >80% of new users |
| Recommendation click-through | >25% of "For You" impressions |
| Recommendation-to-purchase | >10% conversion |
| Style confidence >0.7 | >60% of active users |
| Profile page monthly visits | >50% MAU |
| Drift alert engagement | >30% click "review" or "update" |
| Preset override rate | <40% (most users keep presets) |
| Manual style changes | <15% (most agree with system) |

---

## 13. EDGE CASES & ERROR STATES

| Case | Handling |
|------|----------|
| Quiz not completed | "Complete your trading style quiz" banner on Dashboard |
| No behavior data yet | Use quiz-only recommendations with "Early" badge |
| Inconsistent behavior | Show "Mixed Signals" badge, suggest re-quiz |
| User resets profile | Clear all history, start fresh quiz |
| Profile data corrupted | Fallback to default Tactician + log error |
| Very new user (<3 trades) | Show quiz result prominently, hide behavior insights |
| Extreme style change | Confirm dialog: "Your style has changed a lot. Keep or reset?" |
