// ── DAWN WHALES — Backtest Worker ──────────────────────────────────────────
// CPU-intensive backtest execution in worker thread

import { BacktestEngine } from '../engine/backtest-engine';

export default async function execute(config: any) {
  const engine = new BacktestEngine();
  return await engine.run(config);
}
