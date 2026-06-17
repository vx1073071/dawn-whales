// @ts-nocheck
// R281 ML#2: FactorDeprecationMap — 前端组件去重+废弃映射 (6h)
// Lists deprecated components with replacements. All old imports route to this file.
// console.warn on deprecated import to guide migration.
// 前端组件去重: 标记20个重复/旧版组件，映射到统一新版

// ─── Deprecation Entry ─────────────────────────────────────────────
export interface DeprecationEntry {
  /** Deprecated component name (file name without .tsx) */
  old: string;
  /** Replacement component name */
  replacement: string;
  /** Why it was deprecated */
  reason: string;
  /** When deprecated */
  since: string;
  /** Severity: 'soft' (still works) | 'hard' (will be removed) */
  severity: 'soft' | 'hard';
}

// ─── Master Deprecation Map ────────────────────────────────────────
/**
 * Complete deprecation map for 73→53 factor component consolidation.
 * Merging 20 duplicate/overlapping components into their unified replacements.
 * 
 * Usage: import DEPRECATION_MAP from './FactorDeprecationMap';
 *        const replacement = getReplacement('FactorPKMode'); // → 'FactorPK'
 */
export const DEPRECATION_MAP: DeprecationEntry[] = [
  // ── Search ──
  {
    old: 'FactorSearchBarV2',
    replacement: 'FactorSearch',
    reason: 'V2 merged into FactorSearch — same NLP + fuzzy matching, more features',
    since: 'R281', severity: 'soft',
  },

  // ── PK ──
  {
    old: 'FactorPKMode',
    replacement: 'FactorPK',
    reason: 'PKMode merged into FactorPK — shared radar + winner declaration + regime selector',
    since: 'R281', severity: 'soft',
  },

  // ── Onboarding ──
  {
    old: 'FactorOnboardingWizard',
    replacement: 'FactorOnboarding',
    reason: 'Wizard merged into FactorOnboarding — 3-step flow consolidated, less code',
    since: 'R281', severity: 'soft',
  },

  // ── Market Selectors (V2→V4, V3→V4) ──
  {
    old: 'MarketSelectorV2',
    replacement: 'MarketSelectorV4',
    reason: 'V2 superseded by V4 — 10 markets vs 5, better stats panel',
    since: 'R281', severity: 'hard',
  },
  {
    old: 'MarketSelectorV3',
    replacement: 'MarketSelectorV4',
    reason: 'V3 superseded by V4 — V3 7 markets → V4 10 markets with full integration',
    since: 'R281', severity: 'hard',
  },

  // ── Factor Hubs → Unified Entry ──
  {
    old: 'FactorFinalHub',
    replacement: 'FactorUnifiedEntry',
    reason: 'Consolidated into single role-based entry (5→1), v4.1 unified gateway',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'EntryFactorGallery',
    replacement: 'FactorUnifiedEntry',
    reason: 'Gallery is now the 🟢beginner view in FactorUnifiedEntry',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'FactorUniverseHub',
    replacement: 'FactorUnifiedEntry',
    reason: 'UniverseHub is now the 🔴pro view in FactorUnifiedEntry (620+ all factors)',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'FactorDarkUnifiedEntry',
    replacement: 'FactorUnifiedEntry',
    reason: 'Dark theme engine integrated into FactorUnifiedEntry — global theme provider',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'FactorSelector',
    replacement: 'FactorUnifiedEntry',
    reason: '3-level selector merged into FactorUnifiedEntry role-based switch',
    since: 'R281', severity: 'soft',
  },

  // ── Heatmaps → FactorHeatmap ──
  {
    old: 'ResponsiveHeatmap',
    replacement: 'FactorHeatmap',
    reason: 'Responsive variant merged into FactorHeatmap — auto-detect viewport + grid switch',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'FactorParameterHeatmap',
    replacement: 'FactorHeatmap',
    reason: 'Parameter sensitivity merged into FactorHeatmap as "Sensitivity" view mode',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'FactorCalendarHeatmap',
    replacement: 'FactorHeatmap',
    reason: 'Calendar view merged into FactorHeatmap as "Calendar" tab',
    since: 'R281', severity: 'soft',
  },

  // ── Scenarios ──
  {
    old: 'ScenarioPackSelector',
    replacement: 'ScenarioPackPanel',
    reason: 'Selector merged into ScenarioPackPanel — single unified scenario page with picker',
    since: 'R281', severity: 'soft',
  },

  // ── Community ──
  {
    old: 'FactorCommunityPanel',
    replacement: 'FactorFriendCircle',
    reason: 'Community panel merged into FriendCircle — shared social features + ratings',
    since: 'R281', severity: 'soft',
  },

  // ── Leaderboards ──
  {
    old: 'FactorWeeklyLeaderboard',
    replacement: 'CommodityLeaderboard',
    reason: 'Weekly leaderboard merged into CommodityLeaderboard as unified ranking engine',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'MarketLeaderboard',
    replacement: 'CommodityLeaderboard',
    reason: 'Market leaderboard merged — single ranking component with market filter',
    since: 'R281', severity: 'soft',
  },

  // ── Mobile ──
  {
    old: 'MobileFactorSelector',
    replacement: 'FactorMobileAdapter',
    reason: 'Mobile selector merged into FactorMobileAdapter — 5-tab bottom nav + all features',
    since: 'R281', severity: 'soft',
  },

  // ── Market Integration ──
  {
    old: 'FactorMarketIntegration',
    replacement: 'MarketFlag',
    reason: 'Market integration merged into MarketFlag — timezone+holiday+currency unified',
    since: 'R281', severity: 'soft',
  },
  {
    old: 'AssetClassSelector',
    replacement: 'FactorLevelSelector',
    reason: 'Asset class merged into FactorLevelSelector — shared tier/basic/advanced/pro logic',
    since: 'R281', severity: 'soft',
  },
];

// ─── Lookup Helpers ────────────────────────────────────────────────

/**
 * Get the replacement name for a deprecated component.
 * @param oldName — component file name (e.g., 'FactorPKMode', 'MarketSelectorV2')
 * @returns replacement name or null if not deprecated
 * 
 * @example getReplacement('FactorPKMode') // → 'FactorPK'
 * @example getReplacement('FactorHeatmap') // → null (not deprecated)
 */
export function getReplacement(oldName: string): string | null {
  const entry = DEPRECATION_MAP.find(e => e.old === oldName);
  if (!entry) return null;
  if (typeof console !== 'undefined') {
    console.warn(
      `[FactorDeprecationMap] ⚠️ "${oldName}" is deprecated since ${entry.since}. ` +
      `Reason: ${entry.reason}. Use "${entry.replacement}" instead. ` +
      `Severity: ${entry.severity}`
    );
  }
  return entry.replacement;
}

/**
 * Check if a component name is deprecated.
 */
export function isDeprecated(name: string): boolean {
  return DEPRECATION_MAP.some(e => e.old === name);
}

/**
 * Get all deprecated names as a flat array.
 */
export function getDeprecatedNames(): string[] {
  return DEPRECATION_MAP.map(e => e.old);
}

/**
 * Get all replacement names (unique).
 */
export function getReplacementNames(): string[] {
  return [...new Set(DEPRECATION_MAP.map(e => e.replacement))];
}

/**
 * Get deprecation stats for reporting.
 */
export function getDeprecationStats() {
  const total = DEPRECATION_MAP.length;
  const soft = DEPRECATION_MAP.filter(e => e.severity === 'soft').length;
  const hard = DEPRECATION_MAP.filter(e => e.severity === 'hard').length;
  const uniqueReplacements = new Set(DEPRECATION_MAP.map(e => e.replacement)).size;
  return { total, soft, hard, uniqueReplacements };
}

export default DEPRECATION_MAP;
