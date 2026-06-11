// ── DAWN WHALES — i18n with on-demand locale loading (R107 S-29) ──────────
// R107 optimization: Detect current language → load only that one file (~30KB).
// Language switch triggers lazy-load of target language.
// Eager load: only 'en' as fallback (minimal). Others lazy on first use.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export const supportedLanguages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-HK', label: '香港繁體' },
  { code: 'zh-TW', label: '台灣繁體' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
];

export type SupportedLang = (typeof supportedLanguages)[number]['code'];

// Dynamic import map for lazy locale loading (R107 S-29: all lazy, en as fallback)
const localeImporters: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  'zh-CN': () => import('./locales/zh-CN.json'),
  'zh-HK': () => import('./locales/zh-HK.json'),
  'zh-TW': () => import('./locales/zh-TW.json'),
  'en': () => import('./locales/en.json'),
  'ja': () => import('./locales/ja.json'),
  'ko': () => import('./locales/ko.json'),
  'fr': () => import('./locales/fr.json'),
  'it': () => import('./locales/it.json'),
  'de': () => import('./locales/de.json'),
  'es': () => import('./locales/es.json'),
  'ru': () => import('./locales/ru.json'),
};

// Track which locales have been loaded (en always loaded as fallback)
const loadedLocales = new Set<string>(['en']);

// Load a locale dynamically and add it to i18n
async function loadLocale(lang: string): Promise<void> {
  if (loadedLocales.has(lang)) return;
  const importer = localeImporters[lang];
  if (!importer) return;
  const mod = await importer();
  i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
  loadedLocales.add(lang);
}

const savedLang = localStorage.getItem('dw_language') as SupportedLang | null;
const validLangCodes = Object.keys(localeImporters);
const detectedLang: SupportedLang = savedLang && validLangCodes.includes(savedLang) ? savedLang : 'zh-CN';

// Initialize with 'en' as fallback (loaded eagerly). Detect user lang on first render.
const initLang = loadedLocales.has(detectedLang) ? detectedLang : 'en';
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: initLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Load detected language after init
if (detectedLang !== 'en') {
  loadLocale(detectedLang).then(() => {
    i18n.changeLanguage(detectedLang);
  });
}

export async function changeLanguage(lang: SupportedLang) {
  localStorage.setItem('dw_language', lang);
  await loadLocale(lang);
  return i18n.changeLanguage(lang);
}

// Preload a locale (e.g., on hover over language selector)
export function preloadLocale(lang: SupportedLang) {
  loadLocale(lang);
}

// S-23: Narrow i18n.t() return type from TFunctionResult (contains unknown) to string.
// This prevents TS2322 errors in every component using i18n.t() in JSX children.
// Original: i18n.t() → TFunctionResult = string | TemplateStringsArray | ...
const _i18nT = i18n.t.bind(i18n) as (key: string | string[], options?: Record<string, unknown>) => string;
(i18n as any).t = _i18nT;

export default i18n;
