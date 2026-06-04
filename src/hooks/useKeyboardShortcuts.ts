// ── useKeyboardShortcuts — Global hotkeys for DAWN WHALES ──────────────────
import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

const SHORTCUTS: Record<string, { view?: string; action?: () => void; label: string }> = {
  '1': { view: 'market', label: '行情中心' },
  '2': { view: 'strategy', label: '策略工坊' },
  '3': { view: 'marketplace', label: '策略市场' },
  '4': { view: 'live', label: '实盘监控' },
  '5': { view: 'backtest', label: '回测报告' },
  '6': { view: 'portfolio', label: '持仓管理' },
  '7': { view: 'orders', label: '委托订单' },
  '8': { view: 'risk', label: '风控设置' },
  '9': { view: 'settings', label: '系统设置' },
};

export function useKeyboardShortcuts({ onOpenShortcuts }: { onOpenShortcuts?: () => void } = {}) {
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
        switch (e.key.toLowerCase()) {
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
            if (onOpenShortcuts) onOpenShortcuts();
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
  'Ctrl+B': '切换侧边栏',
  'Ctrl+N': '新建策略',
  'Ctrl+K': '跳转行情',
  '1': '行情中心',
  '2': '策略工坊',
  '3': '策略市场',
  '4': '实盘监控',
  '5': '回测报告',
  '6': '持仓管理',
  '7': '委托订单',
  '8': '风控设置',
  '9': '系统设置',
  'Esc': '关闭弹窗',
};
