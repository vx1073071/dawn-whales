// ── R224 ML#3 (G5): 多显示器面板拖出第二屏 ──────────────────────────
// PanelDetach: 把策略/图表/深度面板拖至第二屏幕独立窗口
// 使用 window.open + postMessage 实现跨窗口同步
// 支持: K线图/深度面板/指标面板/策略编辑器 4种面板

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Tooltip, message } from 'antd';
import { ExpandOutlined, CompressOutlined, CloseOutlined } from '@ant-design/icons';
import i18n from '../../i18n';

const I18N = (k: string) => i18n.t(`panelDetach.${k}`);

// ═══════════════════════════════════════════════════════════════════════

export type DetachablePanel = 'kline' | 'depth' | 'indicator' | 'strategy';

export interface DetachedWindow {
  id: string;
  type: DetachablePanel;
  window: Window | null;
  symbol?: string;
}

// ═══════════════════════════════════════════════════════════════════════

/** 打开第二屏独立窗口 */
export function openDetachedPanel(
  type: DetachablePanel,
  symbol?: string,
  extra: Record<string, string> = {},
): DetachedWindow {
  const id = `${type}_${Date.now()}`;
  const params = new URLSearchParams({
    type, id, symbol: symbol || '',
    ...extra,
  });
  const url = `/detached-panel.html?${params.toString()}`;

  const width = type === 'indicator' ? 400 : 800;
  const height = type === 'strategy' ? 700 : 600;

  const win = window.open(
    url,
    id,
    `width=${width},height=${height},left=${window.screen.width - width - 50},top=50,resizable=yes,scrollbars=yes`,
  );

  if (!win) {
    message.warning(I18N('popupBlocked'));
    return { id, type, window: null, symbol };
  }

  message.success(`${I18N('detached')}: ${type}`);
  return { id, type, window: win, symbol };
}

// ═══════════════════════════════════════════════════════════════════════

/** 跨窗口同步hook (主窗口侧) */
export function useDetachedPanel(type: DetachablePanel, symbol?: string) {
  const [detached, setDetached] = useState<DetachedWindow | null>(null);
  const winRef = useRef<DetachedWindow | null>(null);

  const detach = useCallback(() => {
    setDetached(prev => {
      if (prev?.window && !prev.window.closed) {
        prev.window.close();
      }
      const dw = openDetachedPanel(type, symbol);
      winRef.current = dw;
      message.info(`${I18N('detachedTip')} (${type})`);
      return dw;
    });
  }, [type, symbol]);

  const attach = useCallback(() => {
    setDetached(prev => {
      if (prev?.window) {
        try { prev.window.postMessage({ type: 'CLOSE_PANEL', id: prev.id }, '*'); } catch {}
        prev.window.close();
      }
      return null;
    });
    winRef.current = null;
  }, []);

  // Listen for close events from the detached window
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PANEL_CLOSED' && e.data?.id === winRef.current?.id) {
        setDetached(null);
        winRef.current = null;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (winRef.current?.window && !winRef.current.window.closed) {
        winRef.current.window.close();
      }
    };
  }, []);

  return {
    detached: detached?.window && !detached.window.closed,
    detach,
    attach,
    windowRef: winRef.current,
  };
}

// ═══════════════════════════════════════════════════════════════════════

/** 面板分离按钮组件 */
export function DetachButton({
  type, symbol, size = 'small', className = '',
}: {
  type: DetachablePanel;
  symbol?: string;
  size?: 'small' | 'middle';
  className?: string;
}) {
  const [detached, setDetached] = useState(false);
  const dwRef = useRef<DetachedWindow | null>(null);

  const handleToggle = useCallback(() => {
    if (detached) {
      if (dwRef.current?.window) {
        try { dwRef.current.window.postMessage({ type: 'CLOSE_PANEL', id: dwRef.current.id }, '*'); } catch {}
        dwRef.current.window.close();
      }
      dwRef.current = null;
      setDetached(false);
    } else {
      const dw = openDetachedPanel(type, symbol);
      dwRef.current = dw;
      setDetached(true);
    }
  }, [detached, type, symbol]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PANEL_CLOSED' && e.data?.id === dwRef.current?.id) {
        setDetached(false);
        dwRef.current = null;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (dwRef.current?.window && !dwRef.current.window.closed) {
        dwRef.current.window.close();
      }
    };
  }, []);

  return (
    <Tooltip title={detached ? I18N('reattach') : I18N('detach')}>
      <Button
        size={size}
        type="text"
        icon={detached ? <CompressOutlined /> : <ExpandOutlined />}
        onClick={handleToggle}
        className={className}
        style={{ color: detached ? '#60a5fa' : '#9ca3af' }}
      />
    </Tooltip>
  );
}

// ═══════════════════════════════════════════════════════════════════════

/** 分离窗口内容容器 (在 detached-panel.html 渲染) */
export function DetachedPanelHost({
  type, symbol, onClose,
}: {
  type: DetachablePanel;
  symbol?: string;
  onClose?: () => void;
}) {
  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0a0a14',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, sans-serif', color: '#e0e0e0',
    }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', background: '#1a1a25', borderBottom: '1px solid #2a2d3e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExpandOutlined style={{ color: '#60a5fa' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {typeMap[type] || type} {symbol && <span style={{ color: '#6b7280', marginLeft: 8 }}>{symbol}</span>}
          </span>
        </div>
        <CloseOutlined
          onClick={() => {
            onClose?.();
            window.opener?.postMessage({ type: 'PANEL_CLOSED', id: new URLSearchParams(window.location.search).get('id') }, '*');
            window.close();
          }}
          style={{ cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}
        />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
          {I18N('detachedContent')}: {type}
          <br />
          <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
            {I18N('detachedContentSub')}
          </span>
        </div>
      </div>
    </div>
  );
}

const typeMap: Record<string, string> = {
  kline: 'K线图', depth: '深度面板', indicator: '指标面板', strategy: '策略编辑器',
};
