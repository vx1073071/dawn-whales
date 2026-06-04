// ── DAWN WHALES — Risk Worker ─────────────────────────────────────────────
// Risk calculations (VaR / Monte Carlo) in worker thread

import { decomposeRisk, runMonteCarlo } from '../engine/risk-decomposition';

export default async function execute(params: { 
  action: 'decompose' | 'montecarlo';
  data: any;
}) {
  if (params.action === 'decompose') {
    return decomposeRisk(params.data);
  }
  return runMonteCarlo(params.data);
}
