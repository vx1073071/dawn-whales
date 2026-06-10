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
import zhHK from './zh-HK.json';
import zhTW from './zh-TW.json';
import ja from './ja.json';
import ko from './ko.json';
import fr from './fr.json';
import de from './de.json';
import es from './es.json';
import ru from './ru.json';

const resources = {
  'zh-CN': { translation: zhCN },
  en: { translation: en },
  'zh-HK': { translation: zhHK },
  'zh-TW': { translation: zhTW },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  ru: { translation: ru },
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
