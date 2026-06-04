# Testing Guide — DAWN WHALES

## Quick Start

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npx vitest run tests/dynamic-sizer.test.ts

# Run in watch mode
npx vitest tests/dynamic-sizer.test.ts

# E2E tests
npm run test:e2e
```

## Test Structure

```
tests/
├── helpers/               # Shared utilities (import from here)
│   ├── index.ts          # Barrel export
│   ├── mocks.ts          # Mock market data, IPC, window.api
│   ├── fixtures.ts       # Strategy, backtest, risk fixtures
│   └── utils.ts          # Custom assertions, timers, IPC helpers
├── README.md             # This file
├── engine.test.ts        # Legacy (npx tsx, custom assert)
├── dynamic-sizer.test.ts  # Vitest modern style (reference)
└── *.test.{ts,tsx}      # All new tests use Vitest
```

## Naming Conventions

| File | Pattern | Example |
|------|---------|---------|
| Engine tests | `engine-name.test.ts` | `nl-parser.test.ts` |
| Component tests | `ComponentName.test.tsx` | `TradingDesk.test.tsx` |
| IPC handler tests | `ipc-handler.test.ts` | `backtest.test.ts` |
| E2E tests | `e2e-*.test.ts` | `e2e-pipeline.test.ts` |

## Test Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourEngine } from '../../electron/engine/your-engine';
import { FIXTURE_MA_CROSS } from '../helpers/fixtures';
import { ok, err } from '../helpers/fixtures';
import { createMockTrades, MOCK_QUOTES } from '../helpers/mocks';
import { assertIpcOk, assertTimeUnder } from '../helpers/utils';

describe('EngineName', () => {
  let engine: YourEngine;

  beforeEach(() => {
    engine = new YourEngine();
    vi.useFakeTimers();
  });

  it('should initialize with config', () => {
    expect(engine).toBeDefined();
  });

  it('should handle success response', async () => {
    const result = await engine.process(FIXTURE_MA_CROSS);
    assertIpcOk(result);
    expect(result.data).toBeDefined();
  });

  it('should reject invalid input', async () => {
    const result = await engine.process({ ...FIXTURE_MA_CROSS, type: 'invalid' as any });
    expect(result.success).toBe(false);
  });

  it('should complete within 100ms', async () => {
    await assertTimeUnder(() => engine.process(FIXTURE_MA_CROSS), 100);
  });
});
```

## IPC Handler Testing

```typescript
import { mockIpcHandler } from '../helpers/mocks';
import { backtestHandler } from '../../electron/main/ipc/backtest-ipc';

it('should run backtest', async () => {
  const result = await mockIpcHandler(backtestHandler, {}, {
    strategy: FIXTURE_MA_CROSS,
    capital: 1_000_000,
    startDate: '2024-01-01',
    endDate: '2024-03-31',
  });
  assertIpcOk(result);
  expect(result.data!.totalTrades).toBeGreaterThan(0);
});
```

## Component Testing (React)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TradingDesk } from '@/components/trading/TradingDesk';
import { stubWindowApi } from '../helpers/mocks';

describe('TradingDesk', () => {
  beforeEach(() => {
    stubWindowApi(createMockApi());
  });

  it('should render account balance', () => {
    render(<TradingDesk />);
    expect(screen.getByText(/Account/i)).toBeInTheDocument();
  });
});
```

## Custom Assertions

```typescript
import { expect } from 'vitest';
import '../helpers/utils'; // extends expect

// Available custom matchers:
expect(received).toBeCloseTo(expected, 0.01);
expect(received).toBeBetween(min, max);
expect(array).toBeSortedDesc();
```

## Mock Data

```typescript
import { MOCK_QUOTES, MOCK_POSITIONS, MOCK_ACCOUNTS, createMockTrades } from '../helpers/mocks';

// Quotes
MOCK_QUOTES.TQQQ.price  // 45.67

// Positions
MOCK_POSITIONS[0].pnl  // 3370

// Generate 50 mock trades
const trades = createMockTrades(50, 100);
```

## CI / Pre-commit

Tests must pass before merge. Run locally:

```bash
npm test -- --run   # single run (no watch)
```
