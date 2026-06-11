/**
 * Legacy i18n module — R101 M-01 upgrade: 3→11 locales
 * 
 * This module is kept for backward compatibility but now delegates to the main i18n system.
 * New code should import directly from '@/i18n' instead.
 * 
 * Supported languages (11): zh-CN, zh-HK, zh-TW, en, ja, ko, fr, it, de, es, ru
 */

// Re-export main i18n instance
export { default } from '../i18n';

// Language configuration with labels and currency metadata
export const LANGUAGES = {
  'zh-CN': { label: '简体中文', currency: 'CNY', currencySymbol: '¥', dateFormat: 'YYYY年MM月DD日' },
  'zh-HK': { label: '繁體中文(港)', currency: 'HKD', currencySymbol: 'HK$', dateFormat: 'YYYY年MM月DD日' },
  'zh-TW': { label: '繁體中文(台)', currency: 'TWD', currencySymbol: 'NT$', dateFormat: 'YYYY年MM月DD日' },
  'en':    { label: 'English',    currency: 'USD', currencySymbol: '$', dateFormat: 'MM/DD/YYYY' },
  'ja':    { label: '日本語',      currency: 'JPY', currencySymbol: '¥', dateFormat: 'YYYY年MM月DD日' },
  'ko':    { label: '한국어',      currency: 'KRW', currencySymbol: '₩', dateFormat: 'YYYY.MM.DD' },
  'fr':    { label: 'Français',   currency: 'EUR', currencySymbol: '€', dateFormat: 'DD/MM/YYYY' },
  'it':    { label: 'Italiano',   currency: 'EUR', currencySymbol: '€', dateFormat: 'DD/MM/YYYY' },
  'de':    { label: 'Deutsch',    currency: 'EUR', currencySymbol: '€', dateFormat: 'DD.MM.YYYY' },
  'es':    { label: 'Español',    currency: 'EUR', currencySymbol: '€', dateFormat: 'DD/MM/YYYY' },
  'ru':    { label: 'Русский',    currency: 'RUB', currencySymbol: '₽', dateFormat: 'DD.MM.YYYY' },
} as const;

// Legacy aliases (backward compat)
export const LOCALE_LABELS = LANGUAGES;

/**
 * Get currency symbol for a given language/locale
 */
export function getCurrencySymbol(locale: string): string {
  const lang = LANGUAGES[locale as keyof typeof LANGUAGES];
  return lang?.currencySymbol ?? '$';
}

/**
 * Get supported language codes
 */
export function getSupportedLocales(): string[] {
  return Object.keys(LANGUAGES);
}

/**
 * Check if a locale is supported
 */
export function isLocaleSupported(locale: string): boolean {
  return locale in LANGUAGES;
}
