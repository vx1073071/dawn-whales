# T23: Worker Pool 性能对比

> 日期: 2026-06-05 06:08 | 状态: ✅ 实现完成

## 架构

- **WorkerPool**: 通用线程池（最多 CPU核心数-1 个 worker）
- **worker-runner.js**: 动态加载模块执行
- **4个专用 Worker**: Backtest / Indicator / Scanner / Risk

## 预期性能提升

| 操作 | 单线程 | 4 Worker | 加速比 |
|------|--------|----------|:--:|
| 参数扫描(100组) | ~8s | ~2.5s | 3.2x |
| 技术指标(50只) | ~3s | ~1s | 3x |
| 蒙特卡洛(10K) | ~5s | ~1.8s | 2.8x |
| 批量回测(10组) | ~12s | ~4s | 3x |

## IPC 集成

```typescript
// ipcMain.handle('backtest:parallel', async (_e, configs) => {
//   const pool = getWorkerPool();
//   const results = await Promise.all(
//     configs.map(c => pool.execute('workers/backtest-worker', c))
//   );
//   return { success: true, results };
// });
```

