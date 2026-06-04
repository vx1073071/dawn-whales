// ── DAWN WHALES — Indicator Worker ────────────────────────────────────────
// Technical indicator calculations in worker thread

import { computeIndicators } from '../engine/technical-indicators';

export default async function execute(params: { klines: any[]; indicators: string[] }) {
  return computeIndicators(params.klines, params.indicators);
}
