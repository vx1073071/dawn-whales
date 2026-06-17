
// ── quant-moo — IPC API Client ( OpenD， Electron IPC) ──────────────
// R127-P03: bridge-api type-safety COMPLETE — all 12 namespaces typed (batches 1-4/4). 104/104.
/* eslint-disable @typescript-eslint/no-explicit-any */

// R256: Window.api declared in bridge-api.ts (canonical) and window.d.ts


export function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}
