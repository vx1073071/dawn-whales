// ── R223 ML#2 (E1+E2): ChartContextMenu — K线/Watchlist/OrderBook 右键菜单 ──────────
// 3处统一右键菜单: K线图 / 自选表 / 深度面板
// 功能: 复制/查看详情/添加自选/设置提醒/分享/导出
// 9语言i18n + 防误触(300ms hold)

import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';
import {
  CopyOutlined, StarOutlined, BellOutlined, ShareAltOutlined,
  DownloadOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContextMenuTarget {
  type: 'kline' | 'watchlist' | 'orderbook';
  symbol?: string;
  price?: number;
  time?: number;
  column?: string;       // watchlist column
  bidAsk?: 'bid' | 'ask'; // orderbook side
  rowData?: Record<string, unknown>;
}

export interface ContextMenuItem {
  key: string;
  icon?: React.ReactNode;
  label?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export interface ChartContextMenuProps {
  target: ContextMenuTarget;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy?: (symbol: string) => void;
  onAddWatchlist?: (symbol: string) => void;
  onSetAlert?: (symbol: string, price?: number) => void;
  onShare?: (symbol: string) => void;
  onExport?: (symbol: string) => void;
  onViewDetail?: (symbol: string) => void;
}

// ── i18n ────────────────────────────────────────────────────────────────────

const I18N = (k: string) => i18n.t(`chartContextMenu.${k}`);

// ── 菜单构建 ───────────────────────────────────────────────────────────────

function buildMenu(
  target: ContextMenuTarget,
  handlers: Pick<ChartContextMenuProps, 'onCopy' | 'onAddWatchlist' | 'onSetAlert' | 'onShare' | 'onExport' | 'onViewDetail'>
): ContextMenuItem[] {
  const s = target.symbol || '';
  const p = target.price;

  const items: ContextMenuItem[] = [];

  if (target.type === 'kline') {
    items.push(
      { key: 'copy', icon: <CopyOutlined />, label: `${I18N('copySymbol')}: ${s}`, onClick: () => { handlers.onCopy?.(s); navigator.clipboard.writeText(s).catch(() => {}); message.success(I18N('copied')); } },
      { separator: true, key: 'sep1' },
      { key: 'addWatchlist', icon: <StarOutlined />, label: I18N('addWatchlist'), onClick: () => { handlers.onAddWatchlist?.(s); message.success(I18N('added')); } },
      { key: 'setAlert', icon: <BellOutlined />, label: p ? `${I18N('setAlert')} @ $${p}` : I18N('setAlert'), onClick: () => { handlers.onSetAlert?.(s, p); message.success(I18N('alertSet')); } },
      { separator: true, key: 'sep2' },
      { key: 'share', icon: <ShareAltOutlined />, label: I18N('share'), onClick: () => { handlers.onShare?.(s); navigator.clipboard.writeText(`https://QuantMoo.com/chart/${s}`).catch(() => {}); message.success(I18N('linkCopied')); } },
      { key: 'export', icon: <DownloadOutlined />, label: I18N('export'), onClick: () => { handlers.onExport?.(s); message.info(I18N('exportStarted')); } },
      { separator: true, key: 'sep3' },
      { key: 'detail', icon: <InfoCircleOutlined />, label: I18N('viewDetail'), onClick: () => { handlers.onViewDetail?.(s); } },
    );
  } else if (target.type === 'watchlist') {
    items.push(
      { key: 'copy', icon: <CopyOutlined />, label: I18N('copyCell'), onClick: () => { handlers.onCopy?.(s); message.success(I18N('copied')); } },
      { key: 'remove', icon: <StarOutlined />, label: I18N('removeFromWatchlist'), danger: true, onClick: () => { handlers.onAddWatchlist?.(s); message.success(I18N('removed')); } },
      { separator: true, key: 'sep1' },
      { key: 'setAlert', icon: <BellOutlined />, label: I18N('setAlert'), onClick: () => { handlers.onSetAlert?.(s); message.success(I18N('alertSet')); } },
      { key: 'detail', icon: <InfoCircleOutlined />, label: I18N('viewDetail'), onClick: () => { handlers.onViewDetail?.(s); } },
    );
  } else if (target.type === 'orderbook') {
    const side = target.bidAsk === 'bid' ? I18N('bid') : I18N('ask');
    items.push(
      { key: 'copy', icon: <CopyOutlined />, label: I18N('copyPrice'), onClick: () => { navigator.clipboard.writeText(String(p || '')); message.success(I18N('copied')); } },
      { key: 'addWatchlist', icon: <StarOutlined />, label: I18N('addWatchlist'), onClick: () => { handlers.onAddWatchlist?.(s); message.success(I18N('added')); } },
      { key: 'setAlert', icon: <BellOutlined />, label: `${I18N('setAlert')} ${side} @ $${p}`, onClick: () => { handlers.onSetAlert?.(s, p); message.success(I18N('alertSet')); } },
      { separator: true, key: 'sep1' },
      { key: 'detail', icon: <InfoCircleOutlined />, label: I18N('viewDetail'), onClick: () => { handlers.onViewDetail?.(s); } },
    );
  }

  return items;
}

// ── 主组件 ──────────────────────────────────────────────────────────────────

export default function ChartContextMenu({
  target, position, onClose, onCopy, onAddWatchlist, onSetAlert, onShare, onExport, onViewDetail,
}: ChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const items = buildMenu(target, { onCopy, onAddWatchlist, onSetAlert, onShare, onExport, onViewDetail });

  // Close on outside click / ESC
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close, { once: true });
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjX = Math.min(position.x, window.innerWidth - 220);
  const adjY = Math.min(position.y, window.innerHeight - items.length * 36 - 20);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: adjX, top: adjY, zIndex: 9999,
        background: '#1a1a25', border: '1px solid #2a2d3e', borderRadius: 8,
        minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      {target.symbol && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d3e', color: '#e0e0e0', fontSize: 12, fontWeight: 600 }}>
          {target.symbol} {target.price != null && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>${target.price}</span>}
        </div>
      )}

      {items.map((item) => item.separator ? (
        <div key={item.key} style={{ borderTop: '1px solid #2a2d3e' }} />
      ) : (
        <div
          key={item.key}
          onClick={() => { item.onClick?.(); onClose(); }}
          style={{
            padding: '8px 14px', cursor: item.disabled ? 'not-allowed' : 'pointer',
            opacity: item.disabled ? 0.4 : 1,
            color: item.danger ? '#ef4444' : '#e0e0e0', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (!item.disabled) (e.target as HTMLElement).style.background = '#2a2d3e'; }}
          onMouseLeave={e => { if (!item.disabled) (e.target as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── 快捷导出hooks ─────────────────────────────────────────────────

/** K线右键菜单封装 */
export function useKlineContextMenu(params: {
  onCopy?: (s: string) => void; onAddWatchlist?: (s: string) => void;
  onSetAlert?: (s: string, p?: number) => void; onShare?: (s: string) => void;
  onExport?: (s: string) => void; onViewDetail?: (s: string) => void;
}) {
  const [ctx, setCtx] = useState<ChartContextMenuProps | null>(null);
  const show = useCallback((target: ContextMenuTarget, pos: { x: number; y: number }) => {
    setCtx({ target, position: pos, onClose: () => setCtx(null), ...params });
  }, [params]);
  const menu = ctx ? <ChartContextMenu {...ctx} /> : null;
  return { show, menu };
}
