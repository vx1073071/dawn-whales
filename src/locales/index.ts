/**
 * src/locales/index.ts
 * R82 P1-5a: i18n 基础架构 — react-i18next 标准入口
 *
 * 用法:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <span>{t('dashboard.title')}</span>
 *
 * 语言: zh-CN (默认) / en / zh-HK / zh-TW / ja / ko / fr / it / de
 * 存储: localStorage dw_language
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCN from './zh-CN.json';
import en from './en.json';

const resources = {
  'zh-CN': { translation: zhCN },
  en: { translation: en },
};

const savedLang = (() => {
  try { return localStorage.getItem('dw_language') ?? 'zh-CN'; } catch { return 'zh-CN'; }
})();

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
});

export default i18n;
export { useTranslation } from 'react-i18next';
