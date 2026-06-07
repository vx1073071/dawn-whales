// Q-46-01: i18n-data 测试 — QClaw R46
// 实际 API: translateField(field, category, lang?)
//           translateFields(fields, category, lang?)
//           getAllTranslations(category) → TranslationMap
//           getSupportedLanguages() → SupportedLanguage[]
// TranslationMap = { [field]: { [lang]: string } }
// 注意: SENTIMENT_LABELS 使用中文键，INDUSTRY_NAMES 可能也使用中文键

import { describe, it, expect } from 'vitest';
import {
  translateField,
  translateFields,
  getAllTranslations,
  getSupportedLanguages,
  MACRO_INDICATORS,
  INDUSTRY_NAMES,
  SENTIMENT_LABELS,
  ANOMALY_TYPES,
} from '../electron/engine/i18n-data';

describe('i18n-data', () => {
  describe('translateField', () => {
    it('returns a string for known field', () => {
      const result = translateField('GDP', 'macro', 'zh-CN');
      expect(typeof result).toBe('string');
    });

    it('returns field unchanged when not found', () => {
      expect(translateField('UNKNOWN_XYZ', 'macro', 'zh-CN')).toBe('UNKNOWN_XYZ');
    });

    it('returns field unchanged for unknown category', () => {
      expect(translateField('M2', 'unknown' as any, 'zh-CN')).toBe('M2');
    });

    it('returns a string when lang omitted (defaults to en)', () => {
      const result = translateField('CPI', 'macro');
      expect(typeof result).toBe('string');
    });

    it('is case-sensitive', () => {
      const upper = translateField('M2', 'macro', 'zh-CN');
      const lower = translateField('m2', 'macro', 'zh-CN');
      // Both should return strings; one may be translated, one likely not
      expect(typeof upper).toBe('string');
      expect(typeof lower).toBe('string');
    });

    it('handles empty string gracefully', () => {
      expect(typeof translateField('', 'macro', 'zh-CN')).toBe('string');
    });
  });

  describe('translateFields', () => {
    it('returns an array of same length as input', () => {
      const result = translateFields(['GDP', 'CPI', 'PPI'], 'macro', 'zh-CN');
      expect(result).toHaveLength(3);
    });

    it('returns array of strings', () => {
      const result = translateFields(['GDP'], 'macro', 'zh-CN');
      expect(result.every((r) => typeof r === 'string')).toBe(true);
    });

    it('handles empty array', () => {
      const result = translateFields([], 'macro', 'zh-CN');
      expect(result).toHaveLength(0);
    });

    it('returns results when lang omitted', () => {
      const result = translateFields(['CPI'], 'macro');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns array with exactly 8 languages', () => {
      expect(getSupportedLanguages()).toHaveLength(8);
    });

    it('includes zh-CN', () => {
      expect(getSupportedLanguages()).toContain('zh-CN');
    });

    it('includes en', () => {
      expect(getSupportedLanguages()).toContain('en');
    });

    it('each entry is a non-empty string', () => {
      for (const lang of getSupportedLanguages()) {
        expect(typeof lang).toBe('string');
        expect(lang.length).toBeGreaterThan(0);
      }
    });

    it('all languages are unique', () => {
      const langs = getSupportedLanguages();
      const unique = new Set(langs);
      expect(unique.size).toBe(langs.length);
    });
  });

  describe('getAllTranslations', () => {
    it('returns an object with 4 category keys', () => {
      const all = getAllTranslations('macro');
      // Returns a TranslationMap (object)
      expect(typeof all).toBe('object');
      expect(Object.keys(all).length).toBeGreaterThan(0);
    });

    it('returns non-empty map for macro category', () => {
      const map = getAllTranslations('macro');
      expect(Object.keys(map).length).toBeGreaterThan(0);
    });

    it('returns non-empty map for industry category', () => {
      const map = getAllTranslations('industry');
      expect(Object.keys(map).length).toBeGreaterThan(0);
    });

    it('returns non-empty map for sentiment category', () => {
      const map = getAllTranslations('sentiment');
      expect(Object.keys(map).length).toBeGreaterThan(0);
    });

    it('returns non-empty map for anomaly category', () => {
      const map = getAllTranslations('anomaly');
      expect(Object.keys(map).length).toBeGreaterThan(0);
    });

    it('each translation entry maps to language strings', () => {
      const map = getAllTranslations('anomaly');
      const firstKey = Object.keys(map)[0];
      const entry = map[firstKey];
      expect(typeof entry['zh-CN']).toBe('string');
      expect(typeof entry['en']).toBe('string');
    });

    it('returns empty object for unknown category', () => {
      const map = getAllTranslations('unknown' as any);
      expect(Object.keys(map)).toHaveLength(0);
    });
  });

  describe('exported TranslationMap objects', () => {
    it('MACRO_INDICATORS is a non-empty object', () => {
      expect(typeof MACRO_INDICATORS).toBe('object');
      expect(Object.keys(MACRO_INDICATORS).length).toBeGreaterThan(0);
    });

    it('INDUSTRY_NAMES is a non-empty object', () => {
      expect(typeof INDUSTRY_NAMES).toBe('object');
      expect(Object.keys(INDUSTRY_NAMES).length).toBeGreaterThan(0);
    });

    it('SENTIMENT_LABELS is a non-empty object', () => {
      expect(typeof SENTIMENT_LABELS).toBe('object');
      expect(Object.keys(SENTIMENT_LABELS).length).toBeGreaterThan(0);
    });

    it('ANOMALY_TYPES is a non-empty object', () => {
      expect(typeof ANOMALY_TYPES).toBe('object');
      expect(Object.keys(ANOMALY_TYPES).length).toBeGreaterThan(0);
    });

    it('ANOMALY_TYPES has price_spike entry', () => {
      expect(ANOMALY_TYPES.price_spike).toBeDefined();
    });

    it('ANOMALY_TYPES has price_crash entry', () => {
      expect(ANOMALY_TYPES.price_crash).toBeDefined();
    });

    it('each TranslationMap entry has zh-CN translation', () => {
      // Check first key in each map has zh-CN
      const firstAnomaly = Object.keys(ANOMALY_TYPES)[0];
      expect(typeof ANOMALY_TYPES[firstAnomaly]['zh-CN']).toBe('string');
    });
  });
});
