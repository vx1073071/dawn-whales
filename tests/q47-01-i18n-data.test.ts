// Q-47-01: i18n-data 完整测试 — zh-CN / zh-TW / en / ja / ko / fr / it / de
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
  SupportedLanguage,
} from '../electron/engine/i18n-data';

const LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'it', 'de'] as SupportedLanguage[];

// ── translateField 单字段翻译 ──────────────────────────────────────────────

describe('Q-47-01: i18n-data 国际化测试', () => {

  describe('translateField — macro 类别', () => {
    it('zh-CN: GDP → 国内生产总值', () => {
      expect(translateField('GDP', 'macro', 'zh-CN')).toBe('国内生产总值');
    });

    it('zh-TW: GDP → 國內生產總值', () => {
      expect(translateField('GDP', 'macro', 'zh-TW')).toBe('國內生產總值');
    });

    it('en: GDP → Gross Domestic Product', () => {
      expect(translateField('GDP', 'macro', 'en')).toBe('Gross Domestic Product');
    });

    it('ja: CPI → 消費者物価指数', () => {
      expect(translateField('CPI', 'macro', 'ja')).toBe('消費者物価指数');
    });

    it('ko: M2 → 광의통화공급량', () => {
      expect(translateField('M2', 'macro', 'ko')).toBe('광의통화공급량');
    });

    it('fr: PPI → Indice des Prix à la Production', () => {
      expect(translateField('PPI', 'macro', 'fr')).toBe('Indice des Prix à la Production');
    });

    it('it: PMI → Indice dei Direttori degli Acquisti', () => {
      expect(translateField('PMI', 'macro', 'it')).toBe('Indice dei Direttori degli Acquisti');
    });

    it('de: LPR → Leitzins für Kredite', () => {
      expect(translateField('LPR', 'macro', 'de')).toBe('Leitzins für Kredite');
    });

    it('zh-CN: 失业率 → 失业率', () => {
      expect(translateField('失业率', 'macro', 'zh-CN')).toBe('失业率');
    });

    it('en: 工业增加值 → Industrial Value Added', () => {
      expect(translateField('工业增加值', 'macro', 'en')).toBe('Industrial Value Added');
    });
  });

  describe('translateField — industry 类别', () => {
    it('zh-CN: 银行 → 银行', () => {
      expect(translateField('银行', 'industry', 'zh-CN')).toBe('银行');
    });

    it('en: 银行 → Banking', () => {
      expect(translateField('银行', 'industry', 'en')).toBe('Banking');
    });

    it('zh-TW: 房地产 → 房地產', () => {
      expect(translateField('房地产', 'industry', 'zh-TW')).toBe('房地產');
    });

    it('en: 医药生物 → Pharmaceutical & Biotech', () => {
      expect(translateField('医药生物', 'industry', 'en')).toBe('Pharmaceutical & Biotech');
    });

    it('ja: 电子 → 電子', () => {
      expect(translateField('电子', 'industry', 'ja')).toBe('電子');
    });

    it('de: 计算机 → Computer', () => {
      expect(translateField('计算机', 'industry', 'de')).toBe('Computer');
    });

    it('fr: 汽车 → Automobile', () => {
      expect(translateField('汽车', 'industry', 'fr')).toBe('Automobile');
    });

    it('ko: 通信 → 통신', () => {
      expect(translateField('通信', 'industry', 'ko')).toBe('통신');
    });
  });

  describe('translateField — sentiment 类别', () => {
    it('zh-CN: 极度贪婪 → 极度贪婪', () => {
      expect(translateField('极度贪婪', 'sentiment', 'zh-CN')).toBe('极度贪婪');
    });

    it('en: 极度贪婪 → Extreme Greed', () => {
      expect(translateField('极度贪婪', 'sentiment', 'en')).toBe('Extreme Greed');
    });

    it('zh-TW: 看涨 → 看漲', () => {
      expect(translateField('看涨', 'sentiment', 'zh-TW')).toBe('看漲');
    });

    it('en: 看涨 → Bullish', () => {
      expect(translateField('看涨', 'sentiment', 'en')).toBe('Bullish');
    });

    it('ja: 恐惧 → 恐怖', () => {
      expect(translateField('恐惧', 'sentiment', 'ja')).toBe('恐怖');
    });

    it('ko: 中性 → 중립', () => {
      expect(translateField('中性', 'sentiment', 'ko')).toBe('중립');
    });

    it('fr: 看跌 → Baissier', () => {
      expect(translateField('看跌', 'sentiment', 'fr')).toBe('Baissier');
    });

    it('it: 极度恐惧 → Paura Estrema', () => {
      expect(translateField('极度恐惧', 'sentiment', 'it')).toBe('Paura Estrema');
    });

    it('de: 贪婪 → Gier', () => {
      expect(translateField('贪婪', 'sentiment', 'de')).toBe('Gier');
    });
  });

  describe('translateField — anomaly 类别', () => {
    it('en: price_spike → Price Spike', () => {
      expect(translateField('price_spike', 'anomaly', 'en')).toBe('Price Spike');
    });

    it('zh-CN: price_spike → 价格飙升', () => {
      expect(translateField('price_spike', 'anomaly', 'zh-CN')).toBe('价格飙升');
    });

    it('zh-TW: volume_surge → 成交量激增', () => {
      expect(translateField('volume_surge', 'anomaly', 'zh-TW')).toBe('成交量激增');
    });

    it('ja: limit_up → ストップ高', () => {
      expect(translateField('limit_up', 'anomaly', 'ja')).toBe('ストップ高');
    });

    it('ko: gap_up → 갭상승', () => {
      expect(translateField('gap_up', 'anomaly', 'ko')).toBe('갭상승');
    });

    it('fr: gap_down → Gap Baissier', () => {
      expect(translateField('gap_down', 'anomaly', 'fr')).toBe('Gap Baissier');
    });

    it('de: unusual_activity → Ungewöhnliche Aktivität', () => {
      expect(translateField('unusual_activity', 'anomaly', 'de')).toBe('Ungewöhnliche Aktivität');
    });

    it('it: limit_down → Limite Inferiore', () => {
      expect(translateField('limit_down', 'anomaly', 'it')).toBe('Limite Inferiore');
    });
  });

  describe('translateField — 边界情况', () => {
    it('未知字段返回原字段', () => {
      expect(translateField('UNKNOWN_KEY', 'macro', 'en')).toBe('UNKNOWN_KEY');
    });

    it('未知类别返回原字段', () => {
      expect(translateField('GDP', 'unknown' as any, 'en')).toBe('GDP');
    });

    it('默认 lang 为 en', () => {
      expect(translateField('CPI', 'macro')).toBe('Consumer Price Index');
    });

    it('未知语言回退到原字段', () => {
      expect(translateField('GDP', 'macro', 'xx-XX' as any)).toBe('GDP');
    });
  });

  // ── translateFields 批量翻译 ─────────────────────────────────────────────

  describe('translateFields — 批量翻译', () => {
    it('批量翻译多个宏观指标（en）', () => {
      const result = translateFields(['GDP', 'CPI', 'M2'], 'macro', 'en');
      expect(result).toEqual([
        'Gross Domestic Product',
        'Consumer Price Index',
        'Broad Money Supply',
      ]);
    });

    it('批量翻译多个情绪标签（zh-CN）', () => {
      const result = translateFields(['看涨', '看跌', '中性'], 'sentiment', 'zh-CN');
      expect(result).toEqual(['看涨', '看跌', '中性']);
    });

    it('批量翻译多个异常类型（zh-TW）', () => {
      const result = translateFields(['price_spike', 'volume_surge'], 'anomaly', 'zh-TW');
      expect(result).toEqual(['價格飆升', '成交量激增']);
    });

    it('空数组返回空数组', () => {
      expect(translateFields([], 'macro', 'en')).toEqual([]);
    });

    it('混合已知/未知字段，未知返回原字段', () => {
      const result = translateFields(['GDP', 'UNKNOWN'], 'macro', 'en');
      expect(result).toEqual(['Gross Domestic Product', 'UNKNOWN']);
    });
  });

  // ── getAllTranslations ───────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('macro 返回完整 MACRO_INDICATORS map', () => {
      const result = getAllTranslations('macro');
      expect(result).toEqual(MACRO_INDICATORS);
    });

    it('industry 返回完整 INDUSTRY_NAMES map', () => {
      const result = getAllTranslations('industry');
      expect(result).toEqual(INDUSTRY_NAMES);
    });

    it('sentiment 返回完整 SENTIMENT_LABELS map', () => {
      const result = getAllTranslations('sentiment');
      expect(result).toEqual(SENTIMENT_LABELS);
    });

    it('anomaly 返回完整 ANOMALY_TYPES map', () => {
      const result = getAllTranslations('anomaly');
      expect(result).toEqual(ANOMALY_TYPES);
    });

    it('未知类别返回空对象', () => {
      expect(getAllTranslations('unknown' as any)).toEqual({});
    });

    it('返回的 map 包含所有 8 种语言', () => {
      const macro = getAllTranslations('macro');
      const gdpEntry = macro['GDP'] as Record<string, string>;
      LANGUAGES.forEach(lang => {
        expect(gdpEntry).toHaveProperty(lang);
      });
    });
  });

  // ── getSupportedLanguages ─────────────────────────────────────────────────

  describe('getSupportedLanguages', () => {
    it('返回 8 种语言', () => {
      const langs = getSupportedLanguages();
      expect(langs).toHaveLength(8);
    });

    it('包含所有预期语言代码', () => {
      const langs = getSupportedLanguages();
      expect(langs).toContain('zh-CN');
      expect(langs).toContain('zh-TW');
      expect(langs).toContain('en');
      expect(langs).toContain('ja');
      expect(langs).toContain('ko');
      expect(langs).toContain('fr');
      expect(langs).toContain('it');
      expect(langs).toContain('de');
    });

    it('返回顺序固定', () => {
      const langs = getSupportedLanguages();
      expect(langs[0]).toBe('zh-CN');
      expect(langs[1]).toBe('zh-TW');
      expect(langs[7]).toBe('de');
    });
  });

  // ── 所有语言覆盖完整性 ─────────────────────────────────────────────────

  describe('所有语言对关键字段的完整覆盖', () => {
    const keyFields: Array<{ category: 'macro' | 'industry' | 'sentiment' | 'anomaly'; field: string }> = [
      { category: 'macro', field: 'GDP' },
      { category: 'macro', field: 'M2' },
      { category: 'industry', field: '银行' },
      { category: 'sentiment', field: '看涨' },
      { category: 'sentiment', field: '极度恐惧' },
      { category: 'anomaly', field: 'price_spike' },
      { category: 'anomaly', field: 'limit_up' },
    ];

    keyFields.forEach(({ category, field }) => {
      LANGUAGES.forEach(lang => {
        it(`${lang}: ${field} (${category}) 有翻译`, () => {
          const result = translateField(field, category, lang);
          expect(result).not.toBeUndefined();
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        });
      });
    });
  });
});
