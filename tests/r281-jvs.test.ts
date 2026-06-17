/**
 * R281 JVS 综合测试 — DataSanitizer + DeduplicationAuditor + CanonicalNamingRegistry
 * >= 25 tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorDataSanitizer,
  getFactorDataSanitizer,
  resetFactorDataSanitizer,
} from '../electron/engine/analysis/factor-data-sanitizer';
import {
  FactorDeduplicationAuditor,
  getFactorDeduplicationAuditor,
  resetFactorDeduplicationAuditor,
} from '../electron/engine/analysis/factor-deduplication-auditor';
import {
  FactorCanonicalNamingRegistry,
  getFactorCanonicalNamingRegistry,
  resetFactorCanonicalNamingRegistry,
} from '../electron/engine/analysis/factor-canonical-naming-registry';

beforeEach(() => {
  resetFactorDataSanitizer();
  resetFactorDeduplicationAuditor();
  resetFactorCanonicalNamingRegistry();
});

// ============================================================
// A. FactorDataSanitizer (9 tests)
// ============================================================
describe('FactorDataSanitizer', () => {
  it('A1: singleton', () => {
    expect(getFactorDataSanitizer()).toBe(getFactorDataSanitizer());
  });

  it('A2: isProduction returns false in test', () => {
    const sanitizer = getFactorDataSanitizer();
    expect(sanitizer.isProduction()).toBe(false);
  });

  it('A3: guardSeed returns true in dev mode', () => {
    const sanitizer = getFactorDataSanitizer();
    expect(sanitizer.guardSeed('test-engine')).toBe(true);
  });

  it('A4: guardSeed returns false in strictMode production', () => {
    const sanitizer = new FactorDataSanitizer({ strictMode: true });
    // Mock production
    const origProd = sanitizer.isProduction;
    sanitizer.isProduction = () => true;
    expect(sanitizer.guardSeed('test-engine')).toBe(false);
    sanitizer.isProduction = origProd;
  });

  it('A5: sanitizeValue rejects NaN', () => {
    const sanitizer = getFactorDataSanitizer();
    expect(sanitizer.sanitizeValue(NaN, 'e1')).toEqual({ clean: 0, flagged: true });
    expect(sanitizer.sanitizeValue(Infinity, 'e1')).toEqual({ clean: 0, flagged: true });
    expect(sanitizer.sanitizeValue(42, 'e1')).toEqual({ clean: 42, flagged: false });
  });

  it('A6: sanitizeBatch filters array', () => {
    const sanitizer = getFactorDataSanitizer();
    const { clean, flagged } = sanitizer.sanitizeBatch([1, NaN, 3, Infinity, 5], 'test');
    expect(clean).toEqual([1, 0, 3, 0, 5]);
    expect(flagged).toBe(2);
  });

  it('A7: markSource tracks annotations', () => {
    const sanitizer = getFactorDataSanitizer();
    sanitizer.markSource('engine-a', 'pe_ttm', 'REAL', Date.now());
    sanitizer.markSource('engine-a', 'pb_lf', 'PSEUDO');
    const anns = sanitizer.getAnnotations();
    expect(anns.length).toBe(2);
    expect(anns.find(a => a.factorId === 'pb_lf')!.sourceType).toBe('PSEUDO');
  });

  it('A8: audit10Engines returns valid report', () => {
    const sanitizer = getFactorDataSanitizer();
    const report = sanitizer.audit10Engines();
    expect(report.totalEngines).toBe(10);
    expect(report.pseudoSources + report.realSources + report.hybridSources).toBe(10);
  });

  it('A9: upgradePath returns data source info for each engine', () => {
    const sanitizer = getFactorDataSanitizer();
    // audit first to mark engines
    sanitizer.audit10Engines();
    const path = sanitizer.upgradePath('factor-ic-dashboard-engine');
    expect(['PSEUDO', 'REAL', 'HYBRID']).toContain(path.currentSource);
    expect(path.priority).toBe('HIGH');
    expect(path.targetSource.length).toBeGreaterThan(0);
  });
});

// ============================================================
// B. FactorDeduplicationAuditor (8 tests)
// ============================================================
describe('FactorDeduplicationAuditor', () => {
  it('B1: singleton', () => {
    expect(getFactorDeduplicationAuditor()).toBe(getFactorDeduplicationAuditor());
  });

  it('B2: runAudit generates report', () => {
    const auditor = getFactorDeduplicationAuditor();
    const report = auditor.runAudit();
    expect(report.totalDuplicates).toBeGreaterThan(0);
    expect(report.totalLinesToRemove).toBeGreaterThan(100000);
    expect(report.duplicates.length).toBe(report.totalDuplicates);
  });

  it('B3: getCanonical resolves known alias', () => {
    const auditor = getFactorDeduplicationAuditor();
    auditor.runAudit();
    // FactorCacheManager → FactorCacheManagerV2
    const canonical = auditor.getCanonical('FactorCacheManager');
    expect(canonical).not.toBeNull();
    if (canonical) expect(canonical).toContain('Cache');
  });

  it('B4: isDeprecated returns true for known old modules', () => {
    const auditor = getFactorDeduplicationAuditor();
    auditor.runAudit();
    expect(auditor.isDeprecated('FactorDataProvider')).toBe(true);
    expect(auditor.isDeprecated('NonexistentModule')).toBe(false);
  });

  it('B5: getMigrationChecklist has all items', () => {
    const auditor = getFactorDeduplicationAuditor();
    auditor.runAudit();
    const checklist = auditor.getMigrationChecklist();
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.every(c => c.startsWith('[ ]'))).toBe(true);
  });

  it('B6: estimateEffort returns hours', () => {
    const auditor = getFactorDeduplicationAuditor();
    auditor.runAudit();
    const effort = auditor.estimateEffort();
    expect(effort.totalHours).toBeGreaterThan(0);
    expect(effort.perModule.length).toBeGreaterThan(0);
  });

  it('B7: generateDeprecationStub produces valid TS', () => {
    const auditor = getFactorDeduplicationAuditor();
    auditor.runAudit();
    const stub = auditor.generateDeprecationStub(auditor.getDeprecatedModules()[0]);
    expect(stub).toContain('@deprecated');
    expect(stub).toContain('export *');
  });

  it('B8: report includes estimated memory saved', () => {
    const auditor = getFactorDeduplicationAuditor();
    const report = auditor.runAudit();
    expect(report.estimatedMemorySaved).toContain('KB');
  });
});

// ============================================================
// C. FactorCanonicalNamingRegistry (8 tests)
// ============================================================
describe('FactorCanonicalNamingRegistry', () => {
  it('C1: singleton with preloaded registry', () => {
    const reg = getFactorCanonicalNamingRegistry();
    expect(reg.getCount()).toBeGreaterThan(20);
  });

  it('C2: resolve via canonical ID', () => {
    const reg = getFactorCanonicalNamingRegistry();
    expect(reg.resolve('pe_ttm')).toBe('pe_ttm');
  });

  it('C3: resolve via English name', () => {
    const reg = getFactorCanonicalNamingRegistry();
    expect(reg.resolve('PE Ratio (TTM)'.toLowerCase())).toBe('pe_ttm');
  });

  it('C4: resolve via Chinese name', () => {
    const reg = getFactorCanonicalNamingRegistry();
    // Resolve by nameCn (Chinese financial standard term)
    const result = reg.resolve('市盈率(TTM)');
    if (!result) {
      // Debug: check what's indexed
      const f = reg.get('pe_ttm');
      console.log('DEBUG C4 get:', JSON.stringify(f?.nameCn));
      console.log('DEBUG C4 count:', reg.getCount());
    }
    expect(result).toBe('pe_ttm');
  });

  it('C5: resolve via alias', () => {
    const reg = getFactorCanonicalNamingRegistry();
    expect(reg.resolve('P/E')).toBe('pe_ttm');
    expect(reg.resolve('DY')).toBe('dividend_yield');
  });

  it('C6: getName localized', () => {
    const reg = getFactorCanonicalNamingRegistry();
    expect(reg.getName('pe_ttm', 'cn')).toBe('市盈率(TTM)');
    expect(reg.getName('pe_ttm', 'en')).toBe('PE Ratio (TTM)');
    expect(reg.getName('pe_ttm', 'ja')).toBe('株価収益率(TTM)');
    expect(reg.getName('pe_ttm', 'ko')).toBe('주가수익비율(TTM)');
  });

  it('C7: fuzzySearch finds by partial Chinese', () => {
    const reg = getFactorCanonicalNamingRegistry();
    const results = reg.fuzzySearch('市盈');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'pe_ttm')).toBe(true);
  });

  it('C8: validateNaming produces stats', () => {
    const reg = getFactorCanonicalNamingRegistry();
    const stats = reg.validateNaming();
    expect(stats.totalFactors).toBeGreaterThan(0);
    expect(stats.totalAliases).toBeGreaterThan(0);
    expect(typeof stats.avgAliasesPerFactor).toBe('number');
  });

  it('C9: getNamingRules returns list', () => {
    const reg = getFactorCanonicalNamingRegistry();
    const rules = reg.getNamingRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some(r => r.includes('snake_case'))).toBe(true);
  });
});
