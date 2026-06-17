// @ts-nocheck
// R271 ML#4: KeyboardShortcuts — Full shortcut system with chart-specific hotkeys
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import i18n from '../i18n';

// ── Type Definitions ──────────────────────────────────────────────────────

interface ShortcutDef {
  keys: string;
  label: string;
  labelCN: string;
  category: 'navigation' | 'chart' | 'drawing' | 'general';
  action: string; // CustomEvent name or special key
}

// ── Shortcut Registry ─────────────────────────────────────────────────────

const SHORTCUT_REGISTRY: ShortcutDef[] = [
  // Navigation
  { keys: '1', label: 'Market', labelCN: '市场', category: 'navigation', action: 'view:market' },
  { keys: '2', label: 'Strategy', labelCN: '策略', category: 'navigation', action: 'view:strategy' },
  { keys: '3', label: 'Marketplace', labelCN: '市场', category: 'navigation', action: 'view:marketplace' },
  { keys: '4', label: 'Live Trading', labelCN: '实盘', category: 'navigation', action: 'view:live' },
  { keys: '5', label: 'Backtest', labelCN: '回测', category: 'navigation', action: 'view:backtest' },
  { keys: '6', label: 'Portfolio', labelCN: '持仓', category: 'navigation', action: 'view:portfolio' },
  { keys: '7', label: 'Orders', labelCN: '订单', category: 'navigation', action: 'view:orders' },
  { keys: '8', label: 'Risk', labelCN: '风控', category: 'navigation', action: 'view:risk' },
  { keys: '9', label: 'Settings', labelCN: '设置', category: 'navigation', action: 'view:settings' },

  // Chart
  { keys: 'D', label: 'Draw Tool', labelCN: '画线工具', category: 'chart', action: 'chart:toggle-draw' },
  { keys: 'T', label: 'Trendline', labelCN: '趋势线', category: 'chart', action: 'chart:tool-trendline' },
  { keys: 'H', label: 'Horizontal Line', labelCN: '水平线', category: 'chart', action: 'chart:tool-horizontal' },
  { keys: 'F', label: 'Fibonacci', labelCN: '斐波那契', category: 'chart', action: 'chart:tool-fib' },
  { keys: 'R', label: 'Rectangle', labelCN: '矩形', category: 'chart', action: 'chart:tool-rect' },
  { keys: 'V', label: 'Vertical Line', labelCN: '垂直线', category: 'chart', action: 'chart:tool-vertical' },
  { keys: 'C', label: 'Crosshair', labelCN: '十字光标', category: 'chart', action: 'chart:crosshair' },
  { keys: 'I', label: 'Indicator Panel', labelCN: '指标面板', category: 'chart', action: 'chart:indicators' },
  { keys: 'A', label: 'AI Analysis', labelCN: 'AI分析', category: 'chart', action: 'chart:ai-draw' },
  { keys: 'O', label: 'Order Panel', labelCN: '下单', category: 'chart', action: 'chart:toggle-order' },

  // Drawing
  { keys: 'Delete', label: 'Delete Drawing', labelCN: '删除画线', category: 'drawing', action: 'drawing:delete-selected' },
  { keys: 'Backspace', label: 'Delete Drawing', labelCN: '删除画线', category: 'drawing', action: 'drawing:delete-selected' },
  { keys: 'Escape', label: 'Cancel / Close', labelCN: '取消/关闭', category: 'drawing', action: 'drawing:cancel' },

  // General
  { keys: 'Ctrl+B', label: 'Toggle Sidebar', labelCN: '切换侧栏', category: 'general', action: 'sidebar:toggle' },
  { keys: 'Ctrl+K', label: 'Command Palette', labelCN: '命令面板', category: 'general', action: 'palette:open' },
  { keys: 'Ctrl+N', label: 'New Strategy', labelCN: '新建策略', category: 'general', action: 'view:strategy' },
  { keys: 'Ctrl+E', label: 'Emergency Stop', labelCN: '紧急停止', category: 'general', action: 'emergency:stop' },
  { keys: '/', label: 'Quick Search', labelCN: '快速搜索', category: 'general', action: 'search:quick' },
  { keys: 'Ctrl+Z', label: 'Undo Drawing', labelCN: '撤销画线', category: 'drawing', action: 'drawing:undo' },
  { keys: 'Ctrl+Y', label: 'Redo Drawing', labelCN: '重做画线', category: 'drawing', action: 'drawing:redo' },
  { keys: 'Space', label: 'Play/Pause', labelCN: '播放/暂停', category: 'chart', action: 'playback:toggle' },
  { keys: '←', label: 'Step Back', labelCN: '后退一步', category: 'chart', action: 'playback:step-back' },
  { keys: '→', label: 'Step Forward', labelCN: '前进一步', category: 'chart', action: 'playback:step-forward' },
  { keys: '?', label: 'Show Shortcuts', labelCN: '快捷键帮助', category: 'general', action: 'shortcuts:help' },
];

// ── Usage tracking (show hint on first use) ───────────────────────────────

const USED_SHORTCUTS_KEY = 'quant-moo-shortcuts-used';

function getUsedShortcuts(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(USED_SHORTCUTS_KEY) || '[]'));
  } catch { return new Set(); }
}

function markShortcutUsed(keys: string): void {
  const used = getUsedShortcuts();
  used.add(keys);
  localStorage.setItem(USED_SHORTCUTS_KEY, JSON.stringify([...used]));
}

function isFirstUse(keys: string): boolean {
  return !getUsedShortcuts().has(keys);
}

function showShortcutHint(keys: string, def: ShortcutDef): void {
  window.dispatchEvent(new CustomEvent('dw:shortcut-hint', {
    detail: { keys, label: def.label, labelCN: def.labelCN },
  }));
  markShortcutUsed(keys);
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useKeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const emergencyStop = useAppStore((s) => s.emergencyStop);
  const usedRef = useRef(getUsedShortcuts());

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow Escape in inputs for blur
        if (e.key !== 'Escape') return;
      }
      if ((e.target as HTMLElement)?.isContentEditable && e.key !== 'Escape') return;

      // Don't override system shortcuts except for our registered ones
      const isMod = e.ctrlKey || e.metaKey;
      const rawKey = isMod ? `Ctrl+${e.key.toUpperCase()}` : e.key;

      // Find matching shortcuts
      const matches = SHORTCUT_REGISTRY.filter(s => {
        if (s.keys.includes('+')) {
          const parts = s.keys.split('+');
          const hasCtrl = parts.includes('Ctrl');
          const key = parts[parts.length - 1];
          // Normalize arrow keys
          if (key === '←' && e.key === 'ArrowLeft') return isMod === hasCtrl;
          if (key === '→' && e.key === 'ArrowRight') return isMod === hasCtrl;
          if (key === 'Space' && (e.key === ' ' || e.code === 'Space')) return isMod === hasCtrl;
          return isMod === hasCtrl && e.key === key;
        }
        // Arrow keys
        if (s.keys === '←') return e.key === 'ArrowLeft' && !isMod;
        if (s.keys === '→') return e.key === 'ArrowRight' && !isMod;
        if (s.keys === 'Space') return (e.key === ' ' || e.code === 'Space') && !isMod;
        return rawKey === s.keys && !isMod;
      });

      if (matches.length === 0) return;
      e.preventDefault();

      for (const match of matches) {
        // Show hint on first use
        if (isFirstUse(match.keys)) {
          showShortcutHint(match.keys, match);
        }

        // Dispatch to chart context if applicable
        if (match.category === 'chart' || match.category === 'drawing') {
          window.dispatchEvent(new CustomEvent(match.action));
          continue;
        }

        // Handle general actions
        switch (match.action) {
          case 'sidebar:toggle':
            toggleSidebar();
            break;
          case 'emergency:stop':
            emergencyStop();
            break;
          case 'palette:open':
            window.dispatchEvent(new CustomEvent('dw:command-palette'));
            break;
          case 'search:quick':
            window.dispatchEvent(new CustomEvent('dw:quick-search'));
            break;
          case 'shortcuts:help':
            window.dispatchEvent(new CustomEvent('dw:shortcuts-help'));
            break;
          case 'playback:toggle':
            window.dispatchEvent(new CustomEvent('dw:toggle-playback'));
            break;
          case 'playback:step-back':
            window.dispatchEvent(new CustomEvent('dw:step-backward'));
            break;
          case 'playback:step-forward':
            window.dispatchEvent(new CustomEvent('dw:step-forward'));
            break;
          default:
            if (match.action.startsWith('view:')) {
              const view = match.action.replace('view:', '');
              setView(view as any);
            } else if (match.action.startsWith('drawing:')) {
              window.dispatchEvent(new CustomEvent(match.action));
            } else {
              window.dispatchEvent(new CustomEvent(match.action));
            }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setView, toggleSidebar, emergencyStop]);
}

// ── Exportable Shortcut Map for Help Dialog ───────────────────────────────

export function getShortcutMap(lang: 'zh' | 'en' = 'en'): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of SHORTCUT_REGISTRY) {
    map[s.keys] = lang === 'zh' ? s.labelCN : s.label;
  }
  return map;
}

export function getShortcutsByCategory(): Record<string, ShortcutDef[]> {
  const cats: Record<string, ShortcutDef[]> = {};
  for (const s of SHORTCUT_REGISTRY) {
    if (!cats[s.category]) cats[s.category] = [];
    cats[s.category].push(s);
  }
  return cats;
}

export { SHORTCUT_REGISTRY as REGISTRY };
