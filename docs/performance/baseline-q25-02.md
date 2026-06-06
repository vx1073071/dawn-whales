# Performance Baseline Report — Q-25-02

**Date:** 2026-06-06 07:09 HKT
**Environment:** Alienware-Lam | Node.js v22.16.0 | Vitest 1.6.1
**Branch:** feature/strategy-optimize

## RiskEngine v2 Performance Baseline

| Method | Time (×1000) | Throughput |
|---|---|---:|
| `calculatePositionSize` | 233.31ms | **4,286 ops/s** |
| `checkOrder` | 232.32ms | **4,304 ops/s** |
| `getStatusSnapshot` | 0.35ms | 2,828,054 ops/s |
| `getKellyStats` | 0.10ms | 10,070,493 ops/s |
| `getConfig` | 0.07ms | 13,831,258 ops/s |
| `getDrawdownState` | 0.02ms | 40,160,642 ops/s |

### Key Observations

- **Heavy methods** (`calculatePositionSize`, `checkOrder`): ~4.3k ops/s — these do real financial math (Kelly criterion, ATR sizing, VIX adjustment). This is acceptable for human-paced trading signals (~1-10 signals/min).
- **Read-only getters**: All sub-millisecond for ×1000 iterations — negligible overhead.
- `getDrawdownState` is the fastest method at 40M ops/s (pure state read).

## TradeExecutor (processSignal ×500)

| Metric | Result |
|---|---:|
| Time | 113.22ms |
| Success rate | 500/500 |
| Throughput | **4,416 signals/sec** |

## Strategy Evaluation (×1000)

| Metric | Result |
|---|---:|
| Time | 1.96ms |
| Throughput | **510,986 evals/sec** |

Strategy evaluation is 2 orders of magnitude faster than position sizing — confirms that optimization effort should focus on `calculatePositionSize`, not signal evaluation.

## Memory Baseline

| Metric | Result |
|---|---:|
| Heap used | 37.75 MB |
| Heap total | 77.68 MB |
| RSS | 624.80 MB |

## Performance Conclusions

### ✅ Pass Criteria
- RiskEngine core methods: All < 500ms for ×1000 iterations
- TradeExecutor throughput: > 1,000 signals/sec
- No memory leaks: Heap stable across runs

### Bottleneck Analysis
`calculatePositionSize` and `checkOrder` are the primary bottlenecks at ~4.3k ops/s. These methods:
1. Call `getKellyStats()` → reads trade history (fast)
2. Compute Kelly fraction or ATR-based sizing (moderate)
3. Apply VIX volatility adjustment (fast)
4. Check against RiskConfig limits (fast)

**Recommendation:** If > 10k signals/sec throughput needed, consider:
- Caching `getKellyStats()` result with 1-minute TTL
- Batching `checkOrder` validations
- Pre-computing VIX factor with lazy update

### Benchmark Coverage
- ✅ RiskEngine core methods
- ✅ TradeExecutor pipeline
- ✅ Strategy evaluation
- ✅ Memory baseline

**Test file:** `tests/benchmark-engine.test.ts`
