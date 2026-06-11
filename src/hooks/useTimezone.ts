/**
 * useTimezone — Global timezone context hook (R98 M-01)
 *
 * Provides timezone state with localStorage persistence.
 * Usage:
 *   const { timezone, setTimezone, recentTimezones } = useTimezone();
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getTimezone,
  setTimezone as persistTimezone,
  getRecentTimezones,
  type FormatOptions,
} from '@/utils/formatTime';

export interface UseTimezoneReturn {
  /** Current timezone (IANA identifier, e.g. "Asia/Hong_Kong") */
  timezone: string;
  /** Set a new timezone (persists to localStorage) */
  setTimezone: (tz: string) => void;
  /** Recently used timezones (max 5) */
  recentTimezones: string[];
  /** Format options shorthand: { locale, timezone } */
  formatOpts: FormatOptions;
}

export function useTimezone(): UseTimezoneReturn {
  const [timezone, setTz] = useState<string>(getTimezone);
  const [recentTimezones, setRecent] = useState<string[]>(getRecentTimezones);

  // Listen for timezone changes from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'dw_timezone' && e.newValue) {
        setTz(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTimezone = useCallback((tz: string) => {
    persistTimezone(tz);
    setTz(tz);
    setRecent(getRecentTimezones());
  }, []);

  const formatOpts: FormatOptions = { timezone };

  return { timezone, setTimezone, recentTimezones, formatOpts };
}
