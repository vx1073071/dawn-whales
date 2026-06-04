import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import de from './locales/de.json';

const resources = {
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  en: { translation: en },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  it: { translation: it },
  de: { translation: de },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('dw_language') || 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
  });

export default i18n;
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
