/**
 * useCurrency — Global currency context hook (R99 M-02)
 *
 * Provides currency state with localStorage persistence.
 * Usage:
 *   const { currency, setCurrency, formatOpts } = useCurrency();
 */

import { useState, useCallback, useEffect } from 'react';

// ── Currency Config ───────────────────────────────────────────────────────

export interface CurrencyConfig {
  code: string;         // ISO 4217: USD, CNY, HKD, JPY, EUR, KRW
  symbol: string;       // $, ¥, HK$, ¥, €, ₩
  name: string;         // English name
  decimals: number;     // 0 for JPY/KRW, 2 for most, 3 for some
  position: 'prefix' | 'suffix'; // symbol position
  separator: string;    // thousands separator hint (locale decides)
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$',  name: 'US Dollar',      decimals: 2, position: 'prefix', separator: ',' },
  { code: 'CNY', symbol: '¥',  name: 'Chinese Yuan',   decimals: 2, position: 'prefix', separator: ',' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2, position: 'prefix', separator: ',' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen',   decimals: 0, position: 'prefix', separator: ',' },
  { code: 'EUR', symbol: '€',  name: 'Euro',           decimals: 2, position: 'prefix', separator: '.' },
  { code: 'KRW', symbol: '₩',  name: 'Korean Won',     decimals: 0, position: 'prefix', separator: ',' },
  { code: 'GBP', symbol: '£',  name: 'British Pound',  decimals: 2, position: 'prefix', separator: ',' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', decimals: 0, position: 'prefix', separator: ',' },
];

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

// ── Hook ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dw_currency';

export interface UseCurrencyReturn {
  currency: string;
  currencyConfig: CurrencyConfig;
  setCurrency: (code: string) => void;
}

function getStoredCurrency(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'USD';
  } catch {
    return 'USD';
  }
}

export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurr] = useState<string>(getStoredCurrency);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        setCurr(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCurrency = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch { /* SSR */ }
    setCurr(code);
  }, []);

  const currencyConfig = getCurrencyConfig(currency);

  return { currency, currencyConfig, setCurrency };
}
