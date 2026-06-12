# Signal Provider & Portfolio API Reference

> 📄 **R120 #22 + #23** | QClaw (document-shrimp) | 2026-06-12
>
> Covers: SignalProvider, SignalStats, TradeHistory, PortfolioSummary, AssetAllocation, BrokerHolding

---

## Table of Contents

1. [Signal Provider Types](#1-signal-provider-types)
2. [Performance Statistics](#2-performance-statistics)
3. [Trade History](#3-trade-history)
4. [Portfolio & Holdings](#4-portfolio--holdings)
5. [IPC Interfaces](#5-ipc-interfaces)
6. [Convenience Helpers](#6-convenience-helpers)
7. [Integration Guide](#7-integration-guide)

---

## 1. Signal Provider Types

### SignalProvider

Core signal provider profile used by the **SignalProviderDashboard** UI component.

```typescript
import type { SignalProvider } from '@src/lib/chart/broker-ui-types';
```

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | `string` | Unique provider ID |
| `name` | `string` | Display name |
| `avatarUrl` | `string \| null` | Avatar URL (null = default) |
| `brokers` | `BrokerType[]` | Primary brokers the provider trades on |
| `primaryMarket` | `'HK' \| 'US' \| 'CN' \| 'JP' \| 'crypto' \| 'global'` | Primary market focus |
| `style` | `'day-trade' \| 'swing' \| 'position' \| 'scalping' \| 'quant' \| 'mixed'` | Trading style |
| `strategyName` | `string` | Strategy name (e.g. "Dual EMA Crossover") |
| `strategySummary` | `string` | Strategy description (1-2 sentences) |
| `description` | `string` | Full strategy description (markdown) |
| `verification` | `ProviderVerification` | Verification status |
| `tier` | `SignalTier` | Subscription tier |
| `monthlyFee` | `number` | Monthly subscription cost in USDT |
| `followerCount` | `number` | Follower count |
| `totalAUM` | `number` | Total AUM following this provider (USDT) |
| `daysActive` | `number` | Days since first signal |
| `minAUMToSubscribe` | `number` | Minimum AUM to subscribe |
| `tags` | `string[]` | Profile tags |
| `createdAt` | `string` | Creation date (ISO 8601) |
| `lastActiveAt` | `string` | Last active timestamp |
| `stats` | `SignalStats` | Aggregated performance statistics |
| `recentSignals` | `TradeSignal[]` | Recent signals (last 10) |
| `activeSignals` | `number` | Active (not expired) signals count |

### Enums & Labels

| Enum | Values |
|------|--------|
| `SignalRiskLevel` | `'conservative'` / `'moderate'` / `'aggressive'` / `'extreme'` |
| `SignalTier` | `'free'` / `'basic'` / `'pro'` / `'elite'` |
| `CopyTradeMode` | `'manual'` / `'semi-auto'` / `'full-auto'` |
| `ProviderVerification` | `'unverified'` / `'pending'` / `'verified'` / `'featured'` |

### Usage Example

```typescript
const provider: SignalProvider = {
  providerId: 'sp-001',
  name: 'AlphaQuant',
  brokers: ['futu', 'ib'],
  primaryMarket: 'HK',
  style: 'swing',
  strategyName: 'Mean Reversion + Volume Profile',
  strategySummary: '基于布林带和成交量分布的均值回归策略',
  /* ... */
  stats: { /* SignalStats */ },
  recentSignals: [ /* TradeSignal[] */ ],
};
```

---

## 2. Performance Statistics

### SignalStats

| Field | Type | Description |
|-------|------|-------------|
| `totalReturn` | `number` | All-time cumulative return (ratio, e.g. 0.42 = 42%) |
| `annualizedReturn` | `number` | Annualized return (ratio) |
| `totalTrades` | `number` | Total trades executed |
| `winningTrades` | `number` | Winning trades count |
| `losingTrades` | `number` | Losing trades count |
| `winRate` | `number` | Win rate (0-1) |
| `avgWinReturn` | `number` | Average return per winning trade (ratio) |
| `avgLossReturn` | `number` | Average return per losing trade (ratio, negative) |
| `sharpeRatio` | `number` | Sharpe ratio (risk-adjusted) |
| `sortinoRatio` | `number` | Sortino ratio (downside risk-adjusted) |
| `calmarRatio` | `number` | Calmar ratio (return / max drawdown) |
| `profitFactor` | `number` | Profit factor (gross profit / gross loss) |
| `maxDrawdown` | `number` | Maximum drawdown (0-1, e.g. 0.15 = -15%) |
| `maxConsecutiveWins` | `number` | Maximum consecutive wins |
| `maxConsecutiveLosses` | `number` | Maximum consecutive losses |
| `avgHoldTimeHours` | `number` | Average holding time in hours |
| `monthlyReturns` | `Record<string, number>` | Monthly returns (ISO "YYYY-MM" → return ratio) |
| `dailyVolatility` | `number` | Daily volatility (standard deviation) |
| `beta` | `number` | Beta relative to benchmark |
| `alpha` | `number` | Alpha (excess return over benchmark) |
| `informationRatio` | `number` | Information ratio |
| `updatedAt` | `string` | Last updated (ISO 8601) |

### Performance Tier Helper

```typescript
import { getPerformanceTier } from '@src/lib/chart/broker-ui-types';

const tier = getPerformanceTier(winRate: 0.72, sharpeRatio: 2.8);
// Returns: 'diamond' (winRate ≥ 0.70 && sharpe ≥ 2.5)
// Tiers: diamond > gold > silver > bronze > unranked
```

---

## 3. Trade History

### TradeHistory

Individual completed trade record.

| Field | Type | Description |
|-------|------|-------------|
| `tradeId` | `string` | Unique trade ID |
| `providerId` | `string` | Provider who executed |
| `symbol` | `string` | Symbol (e.g. HK.00700) |
| `market` | `Market type` | Market identifier |
| `direction` | `'long' \| 'short'` | Direction |
| `entryTime` | `string` | Entry time (ISO 8601) |
| `entryPrice` | `number` | Entry price |
| `exitTime` | `string` | Exit time (ISO 8601) |
| `exitPrice` | `number` | Exit price |
| `quantity` | `number` | Quantity |
| `grossPnL` | `number` | Gross P&L (quote currency) |
| `pnlPercent` | `number` | P&L percentage (ratio) |
| `fees` | `number` | Fees paid |
| `netPnL` | `number` | Net P&L after fees |
| `isWin` | `boolean` | Was this a winner? |
| `holdTimeHours` | `number` | Holding time in hours |
| `tags` | `string[]` | Trade tags |
| `strategyContext` | `string` | Strategy context (e.g. "breakout") |

---

## 4. Portfolio & Holdings

### PortfolioSummary

Aggregated view across all connected brokers.

| Field | Type | Description |
|-------|------|-------------|
| `totalValue` | `number` | Total portfolio value |
| `totalCost` | `number` | Total cost basis |
| `totalUnrealizedPnL` | `number` | Total unrealized P&L |
| `totalUnrealizedPnLPct` | `number` | Unrealized P&L percentage |
| `todayPnL` | `number` | Today's P&L |
| `todayReturn` | `number` | Today's return (ratio) |
| `displayCurrency` | `PortfolioCurrency` | Base currency |
| `connectedBrokers` | `number` | Number of connected brokers |
| `totalBrokers` | `number` | Total registered brokers |
| `totalHoldings` | `number` | Total holdings across all brokers |
| `totalCash` | `number` | Total available cash |
| `overallMarginUsed` | `number` | Overall margin usage (0-1) |
| `metrics` | `PortfolioMetrics` | Key performance metrics |
| `brokerAllocations` | `BrokerAllocation[]` | Per-broker allocation |
| `marketAllocations` | `MarketAllocation[]` | Per-market allocation |
| `assetClassAllocations` | `AssetClassAllocation[]` | Per-asset-class allocation |
| `topHoldings` | `BrokerHolding[]` | Top 10 holdings by value |
| `dailyPnLHistory` | `DailyPnLPoint[]` | Daily P&L history (last 30 days) |
| `updatedAt` | `string` | Last update (ISO 8601) |

### Asset Classes

```typescript
type AssetClass = 'stock' | 'etf' | 'warrant' | 'option' | 'future'
  | 'crypto' | 'forex' | 'bond' | 'fund' | 'cash' | 'other';
```

Each class has a label (中文), color hex, and allocation breakdown.

---

## 5. IPC Interfaces

### Fetch Portfolio

```typescript
// Request
interface IpcPortfolioRequest {
  displayCurrency?: PortfolioCurrency;  // default: user preference
  includeHistory?: boolean;             // include daily P&L history
  historyDays?: number;                 // default 30, max 365
}

// Response: PortfolioSummary
```

### Fetch Signal Providers

```typescript
// Request
interface IpcSignalProvidersRequest {
  brokerFilter?: BrokerType[];
  marketFilter?: string[];
  riskFilter?: SignalRiskLevel[];
  tierFilter?: SignalTier[];
  minWinRate?: number;
  sortBy?: 'totalReturn' | 'sharpeRatio' | 'winRate' | 'followerCount' | 'totalAUM';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// Response
interface IpcSignalProvidersResponse {
  providers: SignalProvider[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

### Fetch Trade History

```typescript
interface IpcTradeHistoryRequest {
  providerId: string;
  startDate?: string;       // ISO 8601
  endDate?: string;
  winsOnly?: boolean;
  symbol?: string;
  sortBy?: 'entryTime' | 'pnlPercent' | 'holdTimeHours';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
```

---

## 6. Convenience Helpers

| Helper | Returns |
|--------|---------|
| `getPerformanceTier(winRate, sharpeRatio)` | `'diamond' \| 'gold' \| 'silver' \| 'bronze' \| 'unranked'` |
| `CURRENCY_SYMBOLS[currency]` | Currency symbol (e.g. `$`, `HK$`, `¥`) |
| `ASSET_CLASS_LABELS[class]` | Chinese label (e.g. `'正股'`, `'ETF'`) |
| `ASSET_CLASS_COLORS[class]` | Chart color hex |
| `MARKET_LABELS[market]` | Chinese label (e.g. `'港股'`, `'美股'`) |
| `RISK_LABELS[risk]` | Chinese label (e.g. `'保守'`, `'稳健'`) |
| `TIER_LABELS[tier]` | Chinese label (e.g. `'免费'`, `'专业'`) |
| `VERIFICATION_LABELS[status]` | Chinese label (e.g. `'已认证'`, `'精选'`) |

---

## 7. Integration Guide

### For ML (UI Components)

```typescript
// SignalProviderDashboard.tsx
import type { SignalProvider, SignalStats, TradeHistory } from '../../lib/chart/broker-ui-types';
import { getPerformanceTier, RISK_LABELS, TIER_LABELS } from '../../lib/chart/broker-ui-types';

function ProviderCard({ provider }: { provider: SignalProvider }) {
  const tier = getPerformanceTier(provider.stats.winRate, provider.stats.sharpeRatio);
  return (
    <div className={`tier-${tier}`}>
      <h3>{provider.name}</h3>
      <span>{RISK_LABELS[/* risk */]}</span>
      <span>Win Rate: {(provider.stats.winRate * 100).toFixed(1)}%</span>
    </div>
  );
}
```

### For JVS (Engine)

```typescript
// electron/broker/SignalProviderService.ts
import type { SignalProvider, PortfolioSummary } from '@src/lib/chart/broker-ui-types';

export class SignalProviderService {
  async getProviders(req: IpcSignalProvidersRequest): Promise<IpcSignalProvidersResponse> {
    // Query database, compute stats, return paginated results
  }
}
```

### For youdao (Testing)

```typescript
import type { SignalProvider, PortfolioSummary } from '../../lib/chart/broker-ui-types';

// Ensure provider stats match schema
const provider: SignalProvider = createMockProvider();
expect(provider.stats.winRate).toBeGreaterThanOrEqual(0);
expect(provider.stats.winRate).toBeLessThanOrEqual(1);
```

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/chart/broker-ui-types.ts` | All type definitions |
| `electron/broker/IBrokerAdapterV2.ts` | BrokerType definition (synced) |
| `src/components/broker/SignalProviderDashboard.tsx` | ML UI component |

---

> **TSC**: `npx tsc --noEmit` EXIT:0 — broker-ui-types.ts compiles cleanly.
> **Author**: QClaw (document-shrimp) · **Round**: R120 · **Tasks**: #22 + #23
