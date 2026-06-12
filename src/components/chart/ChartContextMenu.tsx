// @ts-nocheck
// ── R123-M02 ChartContextMenu — 图表右键菜单 ──────────────────────────────
// PM: K线右键→设置提醒/添加水平线/复制价格/在此下单
//     深度右键→限价单/复制价格/添加到自选
//     自选右键→查看深度/移除/K线分析

import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useChartStore } from '../../store/ChartStore';

// ═══════════ Types ═══════════

export interface MenuItem {
  key: string;
  label: string;
  icon?: string; // emoji
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export type ContextMenuContext = 'kline' | 'depth' | 'watchlist' | 'orderbook' | 'scanner';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  context: ContextMenuContext;
  /** Optional: the symbol the click happened on */
  symbol?: string;
  /** Optional: the price at the click point */
  price?: number;
  /** Optional: the broker the click happened on */
  brokerId?: string;
}

// ═══════════ K-Line menu items ═══════════

function getKLineMenuItems(
  symbol: string,
  price?: number,
  storeSymbol: string,
  setStoreSymbol: (s: string) => void,
): MenuItem[] {
  return [
    {
      key: 'add-alert-price',
      label: price ? `在此价格设置提醒 ($${price.toFixed(2)})` : '在此价格设置提醒',
      icon: '🔔',
      onClick: () => { /* AlertPanel integration */ },
    },
    {
      key: 'add-horizontal-line',
      label: price ? `添加水平线 ($${price.toFixed(2)})` : '添加水平线',
      icon: '➖',
      onClick: () => { /* DrawingToolbar integration */ },
    },
    {
      key: 'copy-price',
      label: price ? `复制价格 $${price.toFixed(2)}` : '复制价格',
      icon: '📋',
      shortcut: 'Ctrl+C',
      onClick: () => {
        if (price != null) navigator.clipboard.writeText(price.toString()).catch(() => {});
      },
    },
    { key: 'div-1', label: '', divider: true, onClick: () => {} },
    {
      key: 'place-limit',
      label: price ? `在此价格下限价单 ($${price.toFixed(2)})` : '限价单',
      icon: '📝',
      onClick: () => { /* Quick order panel */ },
    },
    {
      key: 'place-market',
      label: '市价单',
      icon: '⚡',
      onClick: () => { /* Quick order panel */ },
    },
    { key: 'div-2', label: '', divider: true, onClick: () => {} },
    {
      key: 'switch-timeframe',
      label: '切换周期',
      icon: '⏱',
      onClick: () => {},
    },
    {
      key: 'add-watchlist',
      label: '添加到自选',
      icon: '⭐',
      onClick: () => { /* Watchlist add */ },
    },
    {
      key: 'view-depth',
      label: '查看深度图',
      icon: '📊',
      onClick: () => { /* Navigate to depth */ },
    },
  ];
}

// ═══════════ Depth/OrderBook menu items ═══════════

function getDepthMenuItems(price?: number): MenuItem[] {
  return [
    {
      key: 'place-limit-bid',
      label: price ? `在 $${price.toFixed(2)} 下限价买单` : '限价买单',
      icon: '🟢',
      onClick: () => {},
    },
    {
      key: 'place-limit-ask',
      label: price ? `在 $${price.toFixed(2)} 下限价卖单` : '限价卖单',
      icon: '🔴',
      onClick: () => {},
    },
    { key: 'div-d1', label: '', divider: true, onClick: () => {} },
    {
      key: 'copy-price',
      label: price ? `复制价格 $${price.toFixed(2)}` : '复制价格',
      icon: '📋',
      onClick: () => { if (price != null) navigator.clipboard.writeText(price.toString()).catch(() => {}); },
    },
  ];
}

// ═══════════ Watchlist menu items ═══════════

function getWatchlistMenuItems(
  symbol: string,
  setStoreSymbol: (s: string) => void,
): MenuItem[] {
  return [
    {
      key: 'view-kline',
      label: `查看 ${symbol} K线图`,
      icon: '📈',
      onClick: () => setStoreSymbol(symbol),
    },
    {
      key: 'view-depth',
      label: `查看深度图`,
      icon: '📊',
      onClick: () => { /* nav */ },
    },
    { key: 'div-w1', label: '', divider: true, onClick: () => {} },
    {
      key: 'place-order',
      label: '快速下单',
      icon: '⚡',
      onClick: () => {},
    },
    { key: 'div-w2', label: '', divider: true, onClick: () => {} },
    {
      key: 'remove-watchlist',
      label: '从自选移除',
      icon: '🗑',
      danger: true,
      onClick: () => { /* remove */ },
    },
  ];
}

// ═══════════ Scanner menu items ═══════════

function getScannerMenuItems(symbol: string, setStoreSymbol: (s: string) => void): MenuItem[] {
  return [
    {
      key: 'view-kline',
      label: `📈 查看 ${symbol} K线图`,
      icon: '📈',
      onClick: () => setStoreSymbol(symbol),
    },
    {
      key: 'add-watchlist',
      label: '⭐ 添加到自选',
      icon: '⭐',
      onClick: () => {},
    },
    { key: 'div-s1', label: '', divider: true, onClick: () => {} },
    {
      key: 'place-order',
      label: '⚡ 快速下单',
      icon: '⚡',
      onClick: () => {},
    },
  ];
}

// ═══════════ Context Menu Component ═══════════

interface ChartContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

export function ChartContextMenu({ state, onClose }: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const storeSymbol = useChartStore((s) => s.symbol);
  const setStoreSymbol = useChartStore((s) => s.setSymbol);
  const symbol = state.symbol || storeSymbol;

  // Build menu items based on context
  let items: MenuItem[] = [];
  switch (state.context) {
    case 'kline':
      items = getKLineMenuItems(symbol, state.price, storeSymbol, setStoreSymbol);
      break;
    case 'depth':
    case 'orderbook':
      items = getDepthMenuItems(state.price);
      break;
    case 'watchlist':
      items = getWatchlistMenuItems(symbol, setStoreSymbol);
      break;
    case 'scanner':
      items = getScannerMenuItems(symbol, setStoreSymbol);
      break;
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!state.visible) return null;

  // Ensure menu doesn't overflow screen
  const x = Math.min(state.x, window.innerWidth - 180);
  const y = Math.min(state.y, window.innerHeight - items.length * 32 - 20);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl py-1 min-w-[180px] max-w-[260px]"
      style={{ left: x, top: y, fontFamily: 'monospace' }}
      role="menu"
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return <div key={item.key || `div-${idx}`} className="my-1 border-t border-[#1c2333]" />;
        }
        return (
          <button
            key={item.key}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose(); }}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors
              ${item.danger ? 'text-[#ef4444] hover:bg-[#ef444410]' : 'text-[#c9d1d9] hover:bg-[#3b82f610]'}
              ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {item.icon && <span className="text-xs w-4 text-center shrink-0">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] text-[#484f58] ml-2 shrink-0">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════ Custom hook: useChartContextMenu ═══════════

export function useChartContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, context: 'kline',
  });

  const open = useCallback((e: React.MouseEvent, context: ContextMenuContext, extra?: Partial<ContextMenuState>) => {
    e.preventDefault();
    e.stopPropagation();
    setState({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      context,
      ...extra,
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return { menuState: state, openContextMenu: open, closeContextMenu: close };
}

export default ChartContextMenu;
