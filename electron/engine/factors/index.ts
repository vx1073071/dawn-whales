// R170 A1: factor-id-registry is the canonical factor naming source
export * from './factor-id-registry';
// R160: DawnFactorFramework is now the primary entry point
export * from './dawn-factor-framework';
export * from './factor-cloud-api';
export * from './factor-compatibility-engine';
export * from './factor-exposure';
export * from './factor-research-engine';
export * from './factor-risk-model';
// R173 C5: Factor snapshot save/restore/compare
export * from './factor-snapshot-store';
// R174 D4/D5/D1: Signal pipeline, trade pipeline, billing gateway
export * from './factor-signal-pipeline';
export * from './factor-trade-pipeline';
export * from './factor-billing-gateway';

// R186 A1: Factor→Signal→UI Pipeline Integration
export * from './factor-signal-integration';
// R186 A2: FactorDataProvider adapter for 🟢 entry factors
export * from './factor-provider-adapter-r186';
// R198 A2: Commodity family i18n (4 families × 8 languages)
export * from './commodity-family-i18n';
// R203 autoclaw: AI Portfolio Attribution Engine (Brinson + Factor + Residual)
export * from './AttributionEngine';
// R177 D3-D5 Convergence: End-to-end pipeline validation
export * from './factor-pipeline-convergence';

// ── R172 C6: Unified Factor Sorting ─────────────────────────────────────
// Standard sort order for all factor lists/displays:
//   1. IC value descending (higher IC = better predictive power)
//   2. Same IC → IR descending (higher IR = more consistent)
//   3. Same IR → factor name ascending (alphabetical tiebreaker)

/**
 * A sortable factor item must have at least an id (name).
 * IC and IR are optional — missing values go last within their tier.
 */
export interface SortableFactor {
  id: string;
  ic?: number;
  ir?: number;
}

/**
 * Unified factor sort: IC desc → IR desc → name asc.
 * Use this for ALL factor lists throughout the system.
 */
export function sortFactors<T extends SortableFactor>(factors: T[]): T[] {
  return [...factors].sort((a, b) => {
    const icA = a.ic ?? -1;
    const icB = b.ic ?? -1;
    if (icB !== icA) return icB - icA; // IC descending

    const irA = a.ir ?? -1;
    const irB = b.ir ?? -1;
    if (irB !== irA) return irB - irA; // IR descending

    return a.id.localeCompare(b.id); // Name ascending (tiebreaker)
  });
}

/**
 * Sort factors by composite score then by IC then by name.
 * For scored results (where a compositeScore is available).
 */
export interface ScoreableFactor extends SortableFactor {
  score: number;
}

export function sortScoredFactors<T extends ScoreableFactor>(factors: T[]): T[] {
  return [...factors].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score; // Score descending

    const icA = a.ic ?? -1;
    const icB = b.ic ?? -1;
    if (icB !== icA) return icB - icA; // IC descending

    const irA = a.ir ?? -1;
    const irB = b.ir ?? -1;
    if (irB !== irA) return irB - irA; // IR descending

    return a.id.localeCompare(b.id); // Name ascending
  });
}

// @deprecated R170 A9: Use DawnFactorFramework instead — marked for deletion
export * from './multi-factor-selector';
export * from './multi-factor';
