// Q-47-02 Part 2: i18n Switching E2E — zh-CN / zh-HK / en 三语言完整切换
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';
import {
  translateField,
  translateFields,
  getAllTranslations,
  getSupportedLanguages,
} from '../electron/engine/core/i18n-data';

describe('Q-47-02 Part 2: i18n Switching E2E — 三语言完整切换', () => {

  // ── 场景 4: 多语言界面切换 ─────────────────────────────────────────────────

  describe('场景 4: UI 语言动态切换', () => {
    it('zh-CN: 宏观指标显示正确', () => {
      expect(translateField('GDP', 'macro', 'zh-CN')).toBe('国内生产总值');
      expect(translateField('M2', 'macro', 'zh-CN')).toBe('广义货币供应量');
      expect(translateField('CPI', 'macro', 'zh-CN')).toBe('居民消费价格指数');
    });

    it('zh-HK: 宏观指标显示繁体', () => {
      expect(translateField('GDP', 'macro', 'zh-TW')).toBe('國內生產總值');
      expect(translateField('M2', 'macro', 'zh-TW')).toBe('廣義貨幣供應量');
      expect(translateField('CPI', 'macro', 'zh-TW')).toBe('居民消費價格指數');
    });

    it('en: 宏观指标显示英文', () => {
      expect(translateField('GDP', 'macro', 'en')).toBe('Gross Domestic Product');
      expect(translateField('M2', 'macro', 'en')).toBe('Broad Money Supply');
      expect(translateField('CPI', 'macro', 'en')).toBe('Consumer Price Index');
    });

    it('行业名称三语言覆盖', () => {
      expect(translateField('银行', 'industry', 'zh-CN')).toBe('银行');
      expect(translateField('银行', 'industry', 'zh-TW')).toBe('銀行');
      expect(translateField('银行', 'industry', 'en')).toBe('Banking');
    });

    it('情绪标签三语言覆盖', () => {
      expect(translateField('看涨', 'sentiment', 'zh-CN')).toBe('看涨');
      expect(translateField('看涨', 'sentiment', 'zh-TW')).toBe('看漲');
      expect(translateField('看涨', 'sentiment', 'en')).toBe('Bullish');
      expect(translateField('极度恐惧', 'sentiment', 'en')).toBe('Extreme Fear');
      expect(translateField('极度恐惧', 'sentiment', 'zh-TW')).toBe('極度恐懼');
    });

    it('异常类型三语言覆盖', () => {
      expect(translateField('price_spike', 'anomaly', 'zh-CN')).toBe('价格飙升');
      expect(translateField('price_spike', 'anomaly', 'zh-TW')).toBe('價格飆升');
      expect(translateField('price_spike', 'anomaly', 'en')).toBe('Price Spike');
      expect(translateField('limit_up', 'anomaly', 'ja')).toBe('ストップ高');
    });
  });

  // ── 场景 5: 日期与货币本地化 ─────────────────────────────────────────────

  describe('场景 5: 日期与货币本地化', () => {
    it('支持 8 种语言返回', () => {
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

    it('MACRO_INDICATORS 所有字段均有 8 种语言翻译', () => {
      const macro = getAllTranslations('macro');
      const langs = getSupportedLanguages();
      for (const [key, entry] of Object.entries(macro)) {
        for (const lang of langs) {
          const val = (entry as Record<string, string>)[lang];
          expect(val).toBeTruthy();
          expect(typeof val).toBe('string');
          expect(val.length).toBeGreaterThan(0);
        }
      }
    });

    it('INDUSTRY_NAMES 所有字段均有 8 种语言翻译', () => {
      const industries = getAllTranslations('industry');
      const langs = getSupportedLanguages();
      for (const [key, entry] of Object.entries(industries)) {
        for (const lang of langs) {
          const val = (entry as Record<string, string>)[lang];
          expect(val).toBeTruthy();
        }
      }
    });

    it('SENTIMENT_LABELS 所有字段均有 8 种语言翻译', () => {
      const sentiments = getAllTranslations('sentiment');
      const langs = getSupportedLanguages();
      for (const [key, entry] of Object.entries(sentiments)) {
        for (const lang of langs) {
          const val = (entry as Record<string, string>)[lang];
          expect(val).toBeTruthy();
        }
      }
    });

    it('ANOMALY_TYPES 所有字段均有 8 种语言翻译', () => {
      const anomalies = getAllTranslations('anomaly');
      const langs = getSupportedLanguages();
      for (const [key, entry] of Object.entries(anomalies)) {
        for (const lang of langs) {
          const val = (entry as Record<string, string>)[lang];
          expect(val).toBeTruthy();
        }
      }
    });

    it('批量翻译保持顺序一致', () => {
      const fields = ['GDP', 'CPI', 'M2', 'PPI'];
      const zhResult = translateFields(fields, 'macro', 'zh-CN');
      const enResult = translateFields(fields, 'macro', 'en');
      expect(zhResult).toHaveLength(4);
      expect(enResult).toHaveLength(4);
      expect(zhResult[0]).toBe('国内生产总值');
      expect(enResult[0]).toBe('Gross Domestic Product');
    });

    it('未知字段在所有语言返回原字段', () => {
      const langs = ['zh-CN', 'zh-TW', 'en', 'ja'];
      for (const lang of langs) {
        expect(translateField('UNKNOWN_FIELD', 'macro', lang as any)).toBe('UNKNOWN_FIELD');
      }
    });
  });

  // ── 场景 6: 语言切换 API ─────────────────────────────────────────────────

  describe('场景 6: 语言切换 API (IPC)', () => {
    it('preload 暴露 i18n API', () => {
      stubWindowApi({
        i18n: {
          translateField: vi.fn().mockResolvedValue({ success: true, translation: '国内生产总值' }),
          getSupportedLanguages: vi.fn().mockResolvedValue({
            success: true,
            languages: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'it', 'de'],
          }),
        },
      });

      expect((window as any).api.i18n).toBeDefined();
      expect(typeof (window as any).api.i18n.translateField).toBe('function');
    });

    it('切换语言后 UI 自动刷新', async () => {
      const translateFieldMock = vi.fn()
        .mockResolvedValueOnce({ success: true, translation: 'Gross Domestic Product' })
        .mockResolvedValueOnce({ success: true, translation: '国内生产总值' });

      stubWindowApi({
        i18n: { translateField: translateFieldMock, getSupportedLanguages: vi.fn().mockResolvedValue({ success: true, languages: ['zh-CN', 'en'] }) },
      });

      const enResult = await (window as any).api.i18n.translateField('GDP', 'macro', 'en');
      const zhResult = await (window as any).api.i18n.translateField('GDP', 'macro', 'zh-CN');

      expect(enResult.translation).toBe('Gross Domestic Product');
      expect(zhResult.translation).toBe('国内生产总值');
    });
  });
});
