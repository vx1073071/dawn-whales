// R229 JVS-3.5c: Backward-compatible re-export barrel
// Original factor-i18n-map.ts (2104L) split into 3 files:
//   factor-i18n-names.ts       — nameCN + categoryCN + oneLine
//   factor-i18n-descriptions.ts — descriptionCN + highMeaning + lowMeaning + story + signaldesc
//   factor-i18n-metadata.ts     — level + region + colors + direction + source + level labels
//
// This file re-exports everything from the 3 split files for backward compatibility.
// New code should import directly from the specific split file.
// @version v2.5.0

export { FactorI18nName, FACTOR_I18N_NAMES, getFactorName } from './factor-i18n-names';
export { FactorI18nDescription, FACTOR_I18N_DESCRIPTIONS, getFactorDescription } from './factor-i18n-descriptions';
export { FactorLevel, FACTOR_LEVEL_LABELS, FactorI18nMetadata, FACTOR_I18N_METADATA, getFactorMetadata } from './factor-i18n-metadata';

// Re-export as the old names for backward compat
import { FACTOR_I18N_NAMES } from './factor-i18n-names';
import { FACTOR_I18N_DESCRIPTIONS } from './factor-i18n-descriptions';
import { FACTOR_I18N_METADATA } from './factor-i18n-metadata';
import type { FactorI18nName } from './factor-i18n-names';
import type { FactorI18nDescription } from './factor-i18n-descriptions';
import type { FactorI18nMetadata } from './factor-i18n-metadata';

// Build combined registry from 3 split files
export const FACTOR_I18N_REGISTRY: ReadonlyMap<string, FactorI18nEntry> = new Map(
  Array.from(FACTOR_I18N_NAMES.keys()).map((factorId) => {
    const name = FACTOR_I18N_NAMES.get(factorId)!;
    const desc = FACTOR_I18N_DESCRIPTIONS.get(factorId);
    const meta = FACTOR_I18N_METADATA.get(factorId);
    return [factorId, {
      factorId,
      level: meta?.level ?? 'L1',
      nameCN: name.nameCN,
      categoryCN: name.categoryCN,
      region: meta?.region ?? 'global',
      oneLine: name.oneLine,
      descriptionCN: desc?.descriptionCN ?? '',
      highMeaning: desc?.highMeaning ?? '',
      lowMeaning: desc?.lowMeaning ?? '',
      story: desc?.story ?? '',
      signaldesc: desc?.signaldesc ?? '',
      colors: meta?.colors ?? { greenMax: 50, yellowMax: 75, redMin: 75 },
      direction: meta?.direction ?? 'neutral',
      source: meta?.source ?? 'mock',
    }] as [string, FactorI18nEntry];
  })
);

// Re-export types
export type { FactorI18nName as FactorI18nName };
export type { FactorI18nDescription as FactorI18nDescription };
export type { FactorI18nMetadata as FactorI18nMetadata };

// Combined entry interface (unchanged)
export interface FactorI18nEntry {
  factorId: string;
  level: 'L1' | 'L2' | 'L3';
  nameCN: string;
  categoryCN: string;
  region: 'global' | 'hk' | 'us' | 'crypto';
  oneLine: string;
  descriptionCN: string;
  highMeaning: string;
  lowMeaning: string;
  story: string;
  signaldesc: string;
  colors: { greenMax: number; yellowMax: number; redMin: number };
  direction: 'higherBetter' | 'lowerBetter' | 'neutral';
  source: string;
}

// Re-export helper functions from the old API
export function getFactorI18n(factorId: string): FactorI18nEntry | undefined {
  return FACTOR_I18N_REGISTRY.get(factorId);
}

export function getFactorCNName(factorId: string): string {
  return FACTOR_I18N_NAMES.get(factorId)?.nameCN ?? factorId;
}

export function getFactorsByRegion(region: 'global' | 'hk' | 'us' | 'crypto'): FactorI18nEntry[] {
  return Array.from(FACTOR_I18N_REGISTRY.values()).filter((e) => e.region === region);
}

export function getAllFactorI18n(): FactorI18nEntry[] {
  return Array.from(FACTOR_I18N_REGISTRY.values());
}

export function getFactorColor(
  factorId: string,
  score: number,
): 'green' | 'yellow' | 'red' {
  const entry = FACTOR_I18N_REGISTRY.get(factorId);
  if (!entry) return 'yellow';
  if (score <= entry.colors.greenMax) return 'green';
  if (score <= entry.colors.yellowMax) return 'yellow';
  return 'red';
}

export function getFactorColorHex(factorId: string, score: number): string {
  const color = getFactorColor(factorId, score);
  return { green: '#22c55e', yellow: '#eab308', red: '#ef4444' }[color];
}

export default {
  FACTOR_I18N_REGISTRY,
  getFactorI18n,
  getFactorCNName,
  getFactorsByRegion,
  getAllFactorI18n,
  getFactorColor,
  getFactorColorHex,
};
