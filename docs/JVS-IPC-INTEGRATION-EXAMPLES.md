# JVS IPC Integration Examples

This document provides examples for integrating JVS IPC handlers in frontend components.

## Overview

JVS provides 147 IPC handlers for market data, technical indicators, risk metrics, and more. All handlers are registered in `electron/main.ts` and exposed via `window.api` in the preload script.

## Basic Pattern

```typescript
import { invoke } from '@tauri-apps/api/core';

// Basic IPC call pattern
const result = await window.api.jvs.someHandler(params);

if (result.success) {
  // Handle success
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error);
}
```

## Example 1: Sector Heatmap (JVS-1)

```typescript
// Get sector heatmap data
const result = await window.api.jvs.getSectorHeatmap({
  market: 'CN',
  limit: 50,
});

if (result.success) {
  const sectors = result.data;
  // sectors: Array<{ name: string, changePct: number, volume: number, ... }>
  
  // Render heatmap
  sectors.forEach(sector => {
    console.log(`${sector.name}: ${sector.changePct}%`);
  });
}
```

## Example 2: Real-time Quotes (JVS-29)

```typescript
// Subscribe to real-time quotes
const subscribeResult = await window.api.jvs.wsSubscribe({
  symbols: ['600519.SH', '000858.SZ'],
});

// Listen for quote updates
window.api.jvs.onQuoteUpdate((quote) => {
  console.log(`${quote.symbol}: ${quote.price} (${quote.changePct}%)`);
});

// Unsubscribe when done
await window.api.jvs.wsUnsubscribe({
  symbols: ['600519.SH'],
});
```

## Example 3: Technical Indicators (JVS-43)

```typescript
// Calculate technical indicators for a stock
const result = await window.api.jvs.calculateIndicators({
  symbol: '600519.SH',
  indicators: ['MA', 'EMA', 'MACD', 'RSI', 'KDJ', 'BOLL'],
  period: 20,
});

if (result.success) {
  const { ma, ema, macd, rsi, kdj, boll } = result.data;
  
  // MA example
  console.log(`MA20: ${ma.ma20}`);
  
  // MACD example
  console.log(`MACD DIF: ${macd.dif}, DEA: ${macd.dea}`);
  
  // RSI example
  console.log(`RSI(14): ${rsi.rsi14}`);
}
```

## Example 4: Risk Metrics (JVS-46)

```typescript
// Calculate risk metrics for a portfolio
const result = await window.api.jvs.calculateRiskMetrics({
  returns: [0.01, 0.02, -0.01, 0.03, 0.02, -0.02, 0.01],
  riskFreeRate: 0.02,
  confidenceLevel: 0.95,
});

if (result.success) {
  const { sharpe, sortino, maxDrawdown, var95, cvar95 } = result.data;
  
  console.log(`Sharpe Ratio: ${sharpe}`);
  console.log(`Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`VaR(95%): ${(var95 * 100).toFixed(2)}%`);
}
```

## Example 5: Performance Attribution (JVS-45)

```typescript
// Brinson attribution analysis
const result = await window.api.jvs.brinsonAttribution({
  portfolioReturns: [0.05, 0.03, -0.02, 0.04],
  benchmarkReturns: [0.03, 0.02, -0.01, 0.03],
  portfolioWeights: { '600519.SH': 0.3, '000858.SZ': 0.2, '601318.SH': 0.2 },
  benchmarkWeights: { '600519.SH': 0.25, '000858.SZ': 0.25, '601318.SH': 0.25 },
});

if (result.success) {
  const { allocationEffect, selectionEffect, interactionEffect } = result.data;
  
  console.log(`Allocation Effect: ${(allocationEffect * 100).toFixed(2)}%`);
  console.log(`Selection Effect: ${(selectionEffect * 100).toFixed(2)}%`);
  console.log(`Interaction Effect: ${(interactionEffect * 100).toFixed(2)}%`);
}
```

## Example 6: Correlation Matrix (JVS-47)

```typescript
// Calculate correlation matrix
const result = await window.api.jvs.correlationMatrix({
  symbols: ['600519.SH', '000858.SZ', '601318.SH', '600036.SH'],
  returns: {
    '600519.SH': [0.01, 0.02, -0.01, 0.03],
    '000858.SZ': [0.02, 0.01, -0.02, 0.02],
    '601318.SH': [0.01, -0.01, 0.02, 0.01],
    '600036.SH': [0.02, 0.02, -0.01, 0.03],
  },
});

if (result.success) {
  const matrix = result.data.matrix;
  console.log('Correlation Matrix:', matrix);
}
```

## Example 7: Multi-Factor Selection (JVS-56)

```typescript
// Multi-factor stock selection
const result = await window.api.jvs.multiFactorSelection({
  symbols: ['600519.SH', '000858.SZ', '601318.SH', '600036.SH', '000001.SZ'],
  factors: {
    momentum: { weight: 0.3, direction: 'desc' },
    value: { weight: 0.3, direction: 'asc' },
    quality: { weight: 0.3, direction: 'desc' },
    volatility: { weight: 0.2, direction: 'asc' },
  },
  topN: 10,
});

if (result.success) {
  const selectedStocks = result.data;
  selectedStocks.forEach(stock => {
    console.log(`${stock.symbol}: score=${stock.score.toFixed(2)}`);
  });
}
```

## Example 8: Portfolio Optimization (JVS-57)

```typescript
// Portfolio optimization using Markowitz mean-variance
const result = await window.api.jvs.optimizePortfolio({
  symbols: ['600519.SH', '000858.SZ', '601318.SH', '600036.SH'],
  returns: {
    '600519.SH': [0.01, 0.02, -0.01, 0.03, 0.02],
    '000858.SZ': [0.02, 0.01, -0.02, 0.02, 0.01],
    '601318.SH': [0.01, -0.01, 0.02, 0.01, 0.02],
    '600036.SH': [0.02, 0.02, -0.01, 0.03, 0.01],
  },
  riskFreeRate: 0.02,
  method: 'markowitz',
});

if (result.success) {
  const weights = result.data.weights;
  console.log('Optimal Weights:', weights);
  console.log(`Expected Return: ${(result.expectedReturn * 100).toFixed(2)}%`);
  console.log(`Expected Volatility: ${(result.expectedVolatility * 100).toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
}
```

## Example 9: Options Pricing (JVS-44)

```typescript
// Black-Scholes options pricing
const result = await window.api.jvs.blackScholesPrice({
  underlyingPrice: 1800,
  strikePrice: 1850,
  timeToExpiry: 0.25, // 3 months
  riskFreeRate: 0.02,
  volatility: 0.25,
  optionType: 'call',
});

if (result.success) {
  const { price, greeks } = result.data;
  console.log(`Option Price: ${price.toFixed(2)}`);
  console.log(`Delta: ${greeks.delta.toFixed(4)}`);
  console.log(`Gamma: ${greeks.gamma.toFixed(4)}`);
  console.log(`Theta: ${greeks.theta.toFixed(4)}`);
  console.log(`Vega: ${greeks.vega.toFixed(4)}`);
}
```

## Example 10: Data Quality Monitoring (JVS-31)

```typescript
// Subscribe to data quality alerts
window.api.jvs.onDataQualityAlert((alert) => {
  console.log(`[${alert.severity}] ${alert.message}`);
  console.log(`Symbol: ${alert.symbol}, Timestamp: ${alert.timestamp}`);
});

// Get current data quality status
const result = await window.api.jvs.getDataQualityStatus();
if (result.success) {
  const { status, lastCheckTime, alertCount } = result.data;
  console.log(`Data Quality Status: ${status}`);
  console.log(`Last Check: ${new Date(lastCheckTime).toLocaleString()}`);
  console.log(`Active Alerts: ${alertCount}`);
}
```

## Error Handling Best Practices

```typescript
// Always handle errors gracefully
async function fetchDataWithRetry(
  handler: () => Promise<any>,
  maxRetries = 3
): Promise<any> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const result = await handler();
      
      if (result.success) {
        return result;
      } else {
        console.warn(`IPC call failed: ${result.error}`);
        attempts++;
        
        if (attempts < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    } catch (error) {
      console.error('IPC call threw error:', error);
      attempts++;
      
      if (attempts >= maxRetries) {
        throw new Error(`IPC call failed after ${maxRetries} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Usage
const result = await fetchDataWithRetry(() => 
  window.api.jvs.getSectorHeatmap({ market: 'CN', limit: 50 })
);
```

## Complete Dashboard Integration Example

```typescript
import { useEffect, useState } from 'react';

interface DashboardData {
  sectorHeatmap: any[];
  riskMetrics: any;
  correlationMatrix: number[][];
  lastUpdate: Date;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        
        // Fetch sector heatmap
        const heatmapResult = await window.api.jvs.getSectorHeatmap({
          market: 'CN',
          limit: 50,
        });
        
        if (!heatmapResult.success) {
          throw new Error(heatmapResult.error);
        }
        
        // Fetch risk metrics (example portfolio)
        const riskResult = await window.api.jvs.calculateRiskMetrics({
          returns: [0.01, 0.02, -0.01, 0.03, 0.02],
          riskFreeRate: 0.02,
          confidenceLevel: 0.95,
        });
        
        if (!riskResult.success) {
          throw new Error(riskResult.error);
        }
        
        // Fetch correlation matrix
        const corrResult = await window.api.jvs.correlationMatrix({
          symbols: ['600519.SH', '000858.SZ', '601318.SH'],
          returns: {
            '600519.SH': [0.01, 0.02, -0.01, 0.03],
            '000858.SZ': [0.02, 0.01, -0.02, 0.02],
            '601318.SH': [0.01, -0.01, 0.02, 0.01],
          },
        });
        
        if (!corrResult.success) {
          throw new Error(corrResult.error);
        }
        
        setData({
          sectorHeatmap: heatmapResult.data,
          riskMetrics: riskResult.data,
          correlationMatrix: corrResult.data.matrix,
          lastUpdate: new Date(),
        });
        
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchAll();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAll, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}
```

## Testing Your Integration

```typescript
// Test IPC handler availability
async function testIPCHandlers() {
  const handlers = [
    'jvs.getSectorHeatmap',
    'jvs.calculateIndicators',
    'jvs.calculateRiskMetrics',
    'jvs.correlationMatrix',
    'jvs.multiFactorSelection',
    'jvs.optimizePortfolio',
    'jvs.blackScholesPrice',
    'jvs.getDataQualityStatus',
  ];
  
  const results = await Promise.all(
    handlers.map(async (handler) => {
      try {
        const [namespace, method] = handler.split('.');
        const fn = (window.api as any)[namespace]?.[method];
        
        if (typeof fn === 'function') {
          return { handler, available: true };
        } else {
          return { handler, available: false, error: 'Handler not found' };
        }
      } catch (error) {
        return { handler, available: false, error: error.message };
      }
    })
  );
  
  const available = results.filter(r => r.available).length;
  const total = results.length;
  
  console.log(`IPC Handler Availability: ${available}/${total}`);
  
  results.filter(r => !r.available).forEach(r => {
    console.warn(`Missing handler: ${r.handler} - ${r.error}`);
  });
  
  return results;
}

// Run tests
testIPCHandlers().then(results => {
  const available = results.filter(r => r.available).length;
  console.log(`✓ ${available}/${results.length} IPC handlers available`);
});
```

## Notes

1. **Error Handling**: Always check `result.success` before using `result.data`
2. **Retry Logic**: Implement exponential backoff for transient failures
3. **Caching**: JVS handlers implement internal caching, but you can add client-side caching for better performance
4. **Real-time Updates**: Subscribe to real-time updates using `on*` event handlers
5. **Type Safety**: Use TypeScript interfaces for type safety (see `JVS-DATA-API-SPEC.md`)

## Support

For questions or issues:
1. Check `docs/JVS-DATA-API-SPEC.md` for API specifications
2. Check `docs/JVS-IPC-INTEGRATION-EXAMPLES.md` (this document) for examples
3. Ask JVS on the bridge channel for technical support
