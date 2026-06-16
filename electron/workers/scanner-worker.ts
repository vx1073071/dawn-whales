// ── QUANT MOO — Scanner Worker ───────────────────────────────────────────
// Parameter scanning / grid search in worker thread

import { ParameterScanner } from '../engine/portfolio/parameter-scanner-v2';

export default async function execute(config: unknown) {
  const scanner = new ParameterScanner();
  return await scanner.scan(config);
}
