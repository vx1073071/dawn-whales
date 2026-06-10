// ── DAWN WHALES — ID Generator (R83 unified) ──────────────────────────────
// Canonical implementation extracted from 8 duplicates: async-io-scheduler,
// condition-engine, data-versioning, docker-manager, pipeline-engine,
// reward-engine, trade-executor, ws-market-data.

let counter = 0;

/**
 * Generate a unique ID with optional prefix.
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${++counter}-${Math.random().toString(36).slice(2, 8)}`;
}
