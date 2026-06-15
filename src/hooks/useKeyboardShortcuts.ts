// ── useKeyboardShortcuts — Global hotkeys for TradingEasy ──────────────────
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
  const emergencyStop = useAppStore((s) => s.emergencyStop);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      // R224: ESC — close modals/popups, return to main view
      if (e.key === 'Escape') {
        e.preventDefault();
        // Close any open modal via body class
        const modals = document.querySelectorAll('[role="dialog"], .modal-overlay');
        if (modals.length > 0) {
          // Dispatch global close event for any modal component to listen
          window.dispatchEvent(new CustomEvent('dw:close-all-modals'));
          return;
        }
        setView('market' as any);
        return;
      }

      // R224: Space — toggle play/pause for live data / chart streaming
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('dw:toggle-playback'));
        return;
      }

      // R224: ← → — step backward/forward in time (backtest / replay navigation)
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('dw:step-backward'));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('dw:step-forward'));
        return;
      }

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
          case 'e':
            e.preventDefault();
            emergencyStop();
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
  }, [setView, toggleSidebar, emergencyStop]);
}

// Export shortcut map for help dialog
export const SHORTCUT_MAP = {
  'Ctrl+B': i18n.t('useKeyboardShortcuts.k10'),
  'Ctrl+N': i18n.t('useKeyboardShortcuts.k11'),
  'Ctrl+K': i18n.t('useKeyboardShortcuts.k12'),
  'Ctrl+E': i18n.t('useKeyboardShortcuts.k23'),
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
  'Space': i18n.t('useKeyboardShortcuts.k24'),
  '←': i18n.t('useKeyboardShortcuts.k25'),
  '→': i18n.t('useKeyboardShortcuts.k26'),
};
