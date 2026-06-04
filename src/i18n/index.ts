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

export const supportedLanguages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
];

export type SupportedLang = (typeof supportedLanguages)[number]['code'];

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

const savedLang = localStorage.getItem('dw_language') as SupportedLang | null;
const defaultLang: SupportedLang = savedLang && (resources as any)[savedLang] ? savedLang : 'zh-CN';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLang,
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
});

export function changeLanguage(lang: SupportedLang) {
  localStorage.setItem('dw_language', lang);
  return i18n.changeLanguage(lang);
}

export default i18n;
