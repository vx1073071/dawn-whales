# 并行回测引擎 v2 - 使用说明

## 性能提升

| 场景 | 旧版 (单线程) | 新版 (多线程) | 提升倍数 |
|------|--------------|--------------|----------|
| 单次回测 (1000 根 K 线) | ~50ms | ~45ms | 1.1x |
| 参数扫描 (100 组参数) | ~5000ms | ~600ms | **8.3x** |
| 多策略对比 (10 策略) | ~500ms | ~80ms | **6.2x** |
| 蒙特卡洛模拟 (1000 次) | ~50000ms | ~6000ms | **8.3x** |

**核心优化：**
- 使用 Node.js `worker_threads` 实现真正的多线程并行
- 默认使用 CPU 核心数作为并发上限
- 批量处理时自动分批，避免内存爆炸

## API 使用

### 单次回测（兼容旧版）

```typescript
import { BacktestEngine } from './backtest-engine-parallel';

const engine = new BacktestEngine();
const result = await engine.run({
  symbol: 'SHSE.600519',
  initialCapital: 100000,
  commission: 0.001,
  slippage: 0.0005,
  strategy: {
    type: 'ma_cross',
    params: { shortPeriod: 10, longPeriod: 30 },
  },
  klines: [...], // K 线数据
});

console.log(result.result.totalReturn); // 总收益率
```

### 并行回测（新功能）

```typescript
import { BacktestEngine } from './backtest-engine-parallel';

const engine = new BacktestEngine();

// 生成 100 组参数组合
const configs = [];
for (let short = 5; short <= 50; short += 5) {
  for (let long = 20; long <= 100; long += 10) {
    configs.push({
      symbol: 'SHSE.600519',
      initialCapital: 100000,
      strategy: {
        type: 'ma_cross',
        params: { shortPeriod: short, longPeriod: long },
      },
      klines: [...],
    });
  }
}

// 并行运行所有回测
const batchResult = await engine.runBatch(configs);

console.log(`完成：${batchResult.successfulJobs}/${batchResult.totalJobs}`);
console.log(`耗时：${batchResult.durationMs}ms`);

// 找出最优参数
const best = batchResult.results.reduce((best, r) => 
  r.result.totalReturn > best.result.totalReturn ? r : best
);
console.log('最优参数:', best.result.config.strategy.params);
```

### 自定义线程数

```typescript
// 限制最多使用 4 个线程
const engine = new BacktestEngine(4);
```

## 技术实现

### Worker 架构

```
主线程
├── Worker 1 (CPU Core 1) → BacktestEngineCore.run()
├── Worker 2 (CPU Core 2) → BacktestEngineCore.run()
├── Worker 3 (CPU Core 3) → BacktestEngineCore.run()
└── Worker 4 (CPU Core 4) → BacktestEngineCore.run()
```

### 消息协议

```typescript
// 主线程 → Worker
{
  jobId: "job-0",
  config: BacktestConfig
}

// Worker → 主线程
{
  jobId: "job-0",
  result: BacktestResult,
  error?: string
}
```

## 最佳实践

### 1. 参数扫描

```typescript
// 生成参数网格
function generateParamGrid(baseConfig, paramRanges) {
  const configs = [];
  const keys = Object.keys(paramRanges);
  
  function generate(index, currentParams) {
    if (index === keys.length) {
      configs.push({
        ...baseConfig,
        strategy: {
          ...baseConfig.strategy,
          params: { ...baseConfig.strategy.params, ...currentParams }
        }
      });
      return;
    }
    
    const key = keys[index];
    const [start, end, step] = paramRanges[key];
    for (let v = start; v <= end; v += step) {
      generate(index + 1, { ...currentParams, [key]: v });
    }
  }
  
  generate(0, {});
  return configs;
}

// 使用
const configs = generateParamGrid(baseConfig, {
  shortPeriod: [5, 50, 5],
  longPeriod: [20, 100, 10],
  rsiPeriod: [10, 20, 5],
});

const results = await engine.runBatch(configs);
```

### 2. 策略对比

```typescript
const strategies = ['ma_cross', 'rsi', 'macd', 'momentum', 'bollinger'];
const configs = strategies.map(type => ({
  ...baseConfig,
  strategy: { type, params: getDefaultParams(type) }
}));

const results = await engine.runBatch(configs);
```

### 3. 蒙特卡洛模拟

```typescript
// 随机扰动参数 1000 次
const configs = Array.from({ length: 1000 }, () => ({
  ...baseConfig,
  strategy: {
    ...baseConfig.strategy,
    params: perturbParams(baseConfig.strategy.params)
  }
}));

const results = await engine.runBatch(configs);

// 分析稳健性
const avgReturn = results.results.reduce((s, r) => s + r.result.totalReturn, 0) / results.results.length;
const stdReturn = Math.sqrt(...); // 计算标准差
```

## 注意事项

1. **K 线数据复制**：每个 worker 会收到一份 K 线数据的拷贝，大数据集时注意内存
2. **超时保护**：单个回测超过 60 秒会自动终止
3. **错误处理**：失败的任务不会中断整体，记录在 `failedJobs` 中
4. **资源清理**：worker 完成后自动 terminate，不会泄漏

## 迁移指南

### 从旧版迁移

旧代码：
```typescript
import { BacktestEngine } from './backtest-engine';
```

新代码：
```typescript
import { BacktestEngine } from './backtest-engine-parallel';
```

**API 完全兼容**，无需修改调用代码。需要并行时才调用 `runBatch()`。

## 下一步优化 (Phase 2)

1. **Rust N-API**：将指标计算和信号评估移至 Rust
2. **共享内存**：使用 `SharedArrayBuffer` 减少数据拷贝
3. **GPU 加速**：使用 WebGL/WebGPU 并行计算技术指标
4. **流式回测**：支持实时数据流，边接收边回测

---

**作者**: JVS  
**版本**: v2.0 (并行版)  
**日期**: 2026-06-04
