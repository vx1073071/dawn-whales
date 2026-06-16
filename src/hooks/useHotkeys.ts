// @ts-nocheck
// R232 ML#2: useHotkeys — Keyboard shortcut & ARIA navigation system
// Global + scoped hotkeys with config panel, F1-F12 trading shortcuts, Ctrl combos, ESC

import { useEffect, useCallback, useRef, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
export type HotkeyScope = 'global' | 'chart' | 'trading' | 'strategy' | 'portfolio' | 'settings';

export interface HotkeyBinding {
  id: string;
  key: string;           // e.g., 'F1', 'Ctrl+B', 'Escape'
  scope: HotkeyScope;
  description: string;
  action: () => void;
  enabled?: boolean;
}

export interface HotkeyConfig {
  bindings: HotkeyBinding[];
  activeScope: HotkeyScope;
  enabled: boolean;
}

// ── Predefined trading hotkeys ──────────────────────────────────────
export const DEFAULT_HOTKEYS: Omit<HotkeyBinding, 'action'>[] = [
  // Global
  { id: 'global-search', key: 'Ctrl+K', scope: 'global', description: 'Open search' },
  { id: 'global-settings', key: 'Ctrl+,', scope: 'global', description: 'Open settings' },
  { id: 'global-help', key: 'F1', scope: 'global', description: 'Show help' },
  // Trading
  { id: 'trade-buy', key: 'Ctrl+B', scope: 'trading', description: 'Buy order' },
  { id: 'trade-sell', key: 'Ctrl+S', scope: 'trading', description: 'Sell order' },
  { id: 'trade-cancel', key: 'Escape', scope: 'trading', description: 'Cancel order' },
  { id: 'trade-confirm', key: 'Enter', scope: 'trading', description: 'Confirm order' },
  { id: 'trade-quick-buy', key: 'F2', scope: 'trading', description: 'Quick buy' },
  { id: 'trade-quick-sell', key: 'F3', scope: 'trading', description: 'Quick sell' },
  { id: 'trade-stop-loss', key: 'F4', scope: 'trading', description: 'Set stop loss' },
  { id: 'trade-take-profit', key: 'F5', scope: 'trading', description: 'Set take profit' },
  // Chart
  { id: 'chart-zoom-in', key: 'Ctrl+=', scope: 'chart', description: 'Zoom in' },
  { id: 'chart-zoom-out', key: 'Ctrl+-', scope: 'chart', description: 'Zoom out' },
  { id: 'chart-reset', key: 'Ctrl+0', scope: 'chart', description: 'Reset zoom' },
  { id: 'chart-crosshair', key: 'Ctrl+\\', scope: 'chart', description: 'Crosshair' },
  { id: 'chart-fullscreen', key: 'F11', scope: 'chart', description: 'Fullscreen chart' },
  { id: 'chart-indicator', key: 'Ctrl+I', scope: 'chart', description: 'Indicators panel' },
  // Strategy
  { id: 'strategy-create', key: 'Ctrl+N', scope: 'strategy', description: 'New strategy' },
  { id: 'strategy-backtest', key: 'F6', scope: 'strategy', description: 'Run backtest' },
  { id: 'strategy-optimize', key: 'F7', scope: 'strategy', description: 'Optimize strategy' },
  { id: 'strategy-duplicate', key: 'Ctrl+D', scope: 'strategy', description: 'Duplicate strategy' },
  { id: 'strategy-rename', key: 'F2', scope: 'strategy', description: 'Rename' },
  // Portfolio
  { id: 'portfolio-refresh', key: 'F5', scope: 'portfolio', description: 'Refresh data' },
  { id: 'portfolio-export', key: 'Ctrl+E', scope: 'portfolio', description: 'Export report' },
  // Navigation
  { id: 'nav-dashboard', key: 'Ctrl+1', scope: 'global', description: 'Go to Dashboard' },
  { id: 'nav-market', key: 'Ctrl+2', scope: 'global', description: 'Go to Market' },
  { id: 'nav-strategy', key: 'Ctrl+3', scope: 'global', description: 'Go to Strategy' },
  { id: 'nav-portfolio', key: 'Ctrl+4', scope: 'global', description: 'Go to Portfolio' },
];

// ── Normalize key string for comparison ─────────────────────────────
function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && e.key.length > 1) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  
  // Don't add modifier keys themselves
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    if (e.key === 'Escape') parts.push('Escape');
    else if (e.key === 'Enter') parts.push('Enter');
    else if (e.key === ' ') parts.push('Space');
    else if (e.key === '\\') parts.push('\\');
    else if (e.key === '-') parts.push('-');
    else if (e.key === '=') parts.push('=');
    else if (e.key === ',') parts.push(',');
    else if (e.key === '0') parts.push('0');
    else if (e.key.startsWith('F') && !isNaN(Number(e.key.slice(1)))) parts.push(e.key);
    else parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  }
  
  return parts.join('+');
}

// ── Hook ────────────────────────────────────────────────────────────
export function useHotkeys(
  bindings: HotkeyBinding[],
  scope: HotkeyScope = 'global',
  enabled = true,
) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if inside input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      
      const norm = normalizeKey(e);
      const current = bindingsRef.current;
      
      for (const binding of current) {
        if (binding.enabled === false) continue;
        if (binding.scope !== scope && binding.scope !== 'global') continue;
        if (binding.key === norm) {
          e.preventDefault();
          e.stopPropagation();
          binding.action();
          return;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [scope, enabled]);
}

// ── Hook for binding-specific hotkeys (simpler API) ─────────────────
export interface UseHotkeyOptions {
  key: string;
  scope?: HotkeyScope;
  enabled?: boolean;
  onPress: () => void;
}

export function useHotkey({ key, scope = 'global', enabled = true, onPress }: UseHotkeyOptions) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  
  useEffect(() => {
    if (!enabled) return;
    
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      
      if (normalizeKey(e) === key) {
        e.preventDefault();
        e.stopPropagation();
        onPressRef.current();
      }
    };
    
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [key, enabled]);
}

// ── ARIA keyboard navigation hook ───────────────────────────────────
export function useAriaKeyboardNav(
  containerRef: React.RefObject<HTMLElement | null>,
  itemSelector: string,
  options?: { loop?: boolean; horizontal?: boolean; onSelect?: (index: number) => void },
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleKey = (e: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
      if (items.length === 0) return;
      
      const current = document.activeElement;
      const currentIdx = items.indexOf(current as HTMLElement);
      
      const nextKey = options?.horizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = options?.horizontal ? 'ArrowLeft' : 'ArrowUp';
      
      if (e.key === nextKey || e.key === prevKey) {
        e.preventDefault();
        let nextIdx: number;
        
        if (e.key === nextKey) {
          nextIdx = currentIdx + 1;
          if (nextIdx >= items.length) nextIdx = options?.loop ? 0 : items.length - 1;
        } else {
          nextIdx = currentIdx - 1;
          if (nextIdx < 0) nextIdx = options?.loop ? items.length - 1 : 0;
        }
        
        if (nextIdx >= 0 && nextIdx < items.length) {
          items[nextIdx].focus();
          options?.onSelect?.(nextIdx);
        }
      }
      
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentIdx >= 0) {
          items[currentIdx].click();
          options?.onSelect?.(currentIdx);
        }
      }
      
      if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      }
      
      if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    };
    
    container.addEventListener('keydown', handleKey);
    return () => container.removeEventListener('keydown', handleKey);
  }, [containerRef, itemSelector]);
}
