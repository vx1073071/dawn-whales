// ── useKeyboardShortcuts — Global hotkeys for DAWN WHALES ──────────────────
import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import i18n from '../i18n';

const SHORTCUTS: Record<string, { view?: string; action?: () => void; label: string }> = {
  '1': { view: 'market', label: i18n.t('useKeyboardShortcuts.k1') },
  '2': { view: 'strategy', label: i18n.t('useKeyboardShortcuts.k2') },
  '3': { view: 'marketplace', label: i18n.t('useKeyboardShortcuts.k3') },
  '4': { view: 'live', label: i18n.t('useKeyboardShortcuts.k4') },
  '5': { view: 'backtest', label: i18n.t('useKeyboardShortcuts.k5') },
  '6': { view: 'portfolio', label: i18n.t('useKeyboardShortcuts.k6') },
  '7': { view: 'orders', label: i18n.t('useKeyboardShortcuts.k7') },
  '8': { view: 'risk', label: i18n.t('useKeyboardShortcuts.k8') },
  '9': { view: 'settings', label: i18n.t('useKeyboardShortcuts.k9') },
};

export function useKeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            toggleSidebar();
            break;
          case 'n':
            e.preventDefault();
            setView('strategy' as any);
            break;
          case 'k':
            e.preventDefault();
            setView('market' as any);
            break;
        }
        return;
      }

      // Number keys 1-9 for view switching
      if (SHORTCUTS[e.key]) {
        const shortcut = SHORTCUTS[e.key];
        if (shortcut.view) {
          setView(shortcut.view as any);
        }
        if (shortcut.action) {
          shortcut.action();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setView, toggleSidebar]);
}

// Export shortcut map for help dialog
export const SHORTCUT_MAP = {
  'Ctrl+B': i18n.t('useKeyboardShortcuts.k10'),
  'Ctrl+N': i18n.t('useKeyboardShortcuts.k11'),
  'Ctrl+K': i18n.t('useKeyboardShortcuts.k12'),
  '1': i18n.t('useKeyboardShortcuts.k13'),
  '2': i18n.t('useKeyboardShortcuts.k14'),
  '3': i18n.t('useKeyboardShortcuts.k15'),
  '4': i18n.t('useKeyboardShortcuts.k16'),
  '5': i18n.t('useKeyboardShortcuts.k17'),
  '6': i18n.t('useKeyboardShortcuts.k18'),
  '7': i18n.t('useKeyboardShortcuts.k19'),
  '8': i18n.t('useKeyboardShortcuts.k20'),
  '9': i18n.t('useKeyboardShortcuts.k21'),
  'Esc': i18n.t('useKeyboardShortcuts.k22'),
};
