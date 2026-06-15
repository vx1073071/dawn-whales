// ── R202 ML P4: SignalPushPopup — AI信号推送通知弹窗 ──────────
// Real-time popup when a subscribed factor signal changes
// Shows: factor name, old→new signal, current IC, price label 0.5U
// Actions: Dismiss / View Detail (1-click order → execute fee)
// Stack management: max 3 visible, queue overflow silently
// Auto-dismiss: 8s idle
// Integration with FeeDeductionToastV3 for silent balance update

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Tag } from 'antd';
import {
  BellOutlined, CloseOutlined, ArrowRightOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface SignalPushEvent {
  id: string;
  factorId: string;
  factorName: string;
  assetName?: string;
  oldSignal: 'green' | 'yellow' | 'red';
  newSignal: 'green' | 'yellow' | 'red';
  currentIC: number;
  price: number; // 0.5 USDT
  timestamp: Date;
  urgency: 'high' | 'normal';
  message: string;
  actionable: boolean; // can the user act on this?
  orderAction?: string; // e.g., "Buy MOM Basket"
}

interface SignalPushPopupProps {
  event: SignalPushEvent | null;
  onDismiss?: (eventId: string) => void;
  onViewDetail?: (event: SignalPushEvent) => void;
  onOrderAction?: (event: SignalPushEvent) => void;
  autoDismissMs?: number; // 0 = no auto-dismiss
  locale?: string;
}

// ── i18n ─────────────────────────────────────────────────────────────
const POPUP_I18N: Record<string, { alert: string; price: string; view: string; order: string; dismiss: string; signalChange: string }> = {
  'zh-CN': { alert: '信号提醒', price: '0.5U', view: '查看详情', order: '一键交易', dismiss: '忽略', signalChange: '信号变化' },
  en: { alert: 'Signal Alert', price: '0.5U', view: 'View Detail', order: 'Trade Now', dismiss: 'Dismiss', signalChange: 'Signal Change' },
  ja: { alert: 'シグナル通知', price: '0.5U', view: '詳細', order: '取引', dismiss: '閉じる', signalChange: 'シグナル変化' },
  ko: { alert: '시그널 알림', price: '0.5U', view: '상세보기', order: '거래', dismiss: '닫기', signalChange: '시그널 변경' },
  fr: { alert: 'Alerte Signal', price: '0.5U', view: 'Détail', order: 'Trader', dismiss: 'Ignorer', signalChange: 'Changement' },
  it: { alert: 'Avviso', price: '0.5U', view: 'Dettaglio', order: 'Opera', dismiss: 'Chiudi', signalChange: 'Cambio' },
  de: { alert: 'Signal-Alarm', price: '0.5U', view: 'Details', order: 'Handeln', dismiss: 'Schließen', signalChange: 'Änderung' },
  es: { alert: 'Alerta', price: '0.5U', view: 'Detalle', order: 'Operar', dismiss: 'Cerrar', signalChange: 'Cambio' },
};

// ── Helpers ──────────────────────────────────────────────────────────
const SIGNAL_EMOJI = { green: '🟢', yellow: '🟡', red: '🔴' };
const SIGNAL_LABEL: Record<string, string> = {
  'green→red': '翻空 ⚠️', 'green→yellow': '转弱 ⚡', 'yellow→red': '转空 📉',
  'red→green': '翻多 🚀', 'red→yellow': '企稳 🌤', 'yellow→green': '转多 📈',
  'green→green': '维持 ✅', 'yellow→yellow': '维持 ➖', 'red→red': '维持 ❌',
};

function signalLabel(oldS: string, newS: string): string {
  return SIGNAL_LABEL[`${oldS}→${newS}`] || '变化';
}

// ── Component ────────────────────────────────────────────────────────
const SignalPushPopup: React.FC<SignalPushPopupProps> = ({
  event,
  onDismiss,
  onViewDetail,
  onOrderAction,
  autoDismissMs = 8000,
}) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locale = 'en';
  const t = POPUP_I18N[locale] || POPUP_I18N.en;

  // Show when event arrives
  useEffect(() => {
    if (event) {
      setVisible(true);
      setClosing(false);
      if (autoDismissMs > 0) {
        timerRef.current = setTimeout(handleDismiss, autoDismissMs);
      }
    } else {
      setVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event?.id, autoDismissMs]);

  const handleDismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      if (event) onDismiss?.(event.id);
    }, 300);
  }, [event, onDismiss]);

  const handleView = useCallback(() => {
    if (event) {
      handleDismiss();
      onViewDetail?.(event);
    }
  }, [event, onViewDetail, handleDismiss]);

  const handleOrder = useCallback(() => {
    if (event) {
      handleDismiss();
      onOrderAction?.(event);
    }
  }, [event, onOrderAction, handleDismiss]);

  if (!event || !visible) return null;

  const isUrgent = event.urgency === 'high' || event.oldSignal !== event.newSignal;
  const borderColor = isUrgent
    ? (event.newSignal === 'red' ? '#d73027' : event.newSignal === 'green' ? '#66bd63' : '#d4a853')
    : '#2a2a4a';

  return (
    <div style={{
      ...styles.popup,
      borderColor,
      opacity: closing ? 0 : 1,
      transform: closing ? 'translateX(30px)' : visible ? 'translateX(0)' : 'translateX(30px)',
      background: isUrgent
        ? (event.newSignal === 'red' ? 'rgba(215,48,39,0.12)' : event.newSignal === 'green' ? 'rgba(102,189,99,0.08)' : 'rgba(212,168,83,0.08)')
        : '#1a1a2e',
    }}>
      {/* Close Btn */}
      <button style={styles.closeBtn} onClick={handleDismiss}>
        <CloseOutlined style={{ fontSize: 10 }} />
      </button>

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}><BellOutlined style={{ color: borderColor }} /></span>
        <div style={styles.headerInfo}>
          <div style={styles.title}>
            {t.signalChange}: {event.factorName}
            {event.assetName && <span style={{ color: '#888', fontSize: 10, marginLeft: 4 }}>{event.assetName}</span>}
          </div>
          <div style={styles.signalRow}>
            <span style={styles.signalOld}>{SIGNAL_EMOJI[event.oldSignal]}</span>
            <ArrowRightOutlined style={{ color: '#888', fontSize: 10 }} />
            <span style={styles.signalNew}>{SIGNAL_EMOJI[event.newSignal]}</span>
            <Tag color={isUrgent ? (event.newSignal === 'red' ? 'red' : 'green') : 'default'} style={styles.signalTag}>
              {signalLabel(event.oldSignal, event.newSignal)}
            </Tag>
          </div>
        </div>
      </div>

      {/* Message */}
      <div style={styles.message}>
        <span>{event.message}</span>
      </div>

      {/* IC Display */}
      <div style={styles.icRow}>
        <span style={styles.icLabel}>Current IC:</span>
        <span style={{
          color: event.currentIC >= 0.02 ? '#66bd63' : event.currentIC >= 0 ? '#d4a853' : '#f46d43',
          fontWeight: 700, fontFamily: 'monospace', fontSize: 13,
        }}>
          {event.currentIC >= 0 ? '+' : ''}{(event.currentIC * 100).toFixed(2)}%
        </span>
        <Tag color="gold" style={{ marginLeft: 'auto', fontSize: 10 }}>
          <BellOutlined style={{ fontSize: 9 }} /> {t.price}
        </Tag>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <Button size="small" onClick={handleDismiss} style={{ fontSize: 10, color: '#888' }}>
          {t.dismiss}
        </Button>
        <Button size="small" type="primary" onClick={handleView}
          style={{ borderRadius: 6, fontSize: 10, background: '#4a90d9', border: 'none' }}>
          {t.view}
        </Button>
        {event.actionable && (
          <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={handleOrder}
            style={{ borderRadius: 6, fontSize: 10, background: '#66bd63', border: 'none' }}>
            {event.orderAction || t.order}
          </Button>
        )}
      </div>

      {/* Timestamp */}
      <div style={styles.timestamp}>
        {event.timestamp.toLocaleTimeString()}
      </div>
    </div>
  );
};

// ── Popup Queue Manager ──────────────────────────────────────────────
interface SignalQueueState {
  active: SignalPushEvent | null;
  queue: SignalPushEvent[];
}

const useSignalPopupManager = () => {
  const [state, setState] = useState<SignalQueueState>({ active: null, queue: [] });
  const maxVisible = 3;

  const push = useCallback((event: SignalPushEvent) => {
    setState((prev) => {
      if (!prev.active) {
        return { active: event, queue: prev.queue };
      }
      if (prev.queue.length < maxVisible) {
        return { active: prev.active, queue: [...prev.queue, event] };
      }
      // Drop silently beyond max
      return prev;
    });
  }, []);

  const dismiss = useCallback((eventId: string) => {
    setState((prev) => {
      if (prev.active?.id === eventId) {
        const next = prev.queue[0] || null;
        return { active: next, queue: prev.queue.slice(1) };
      }
      return { active: prev.active, queue: prev.queue.filter(q => q.id !== eventId) };
    });
  }, []);

  return { ...state, push, dismiss };
};

// ── Demo Events ──────────────────────────────────────────────────────
function generateDemoSignals(): SignalPushEvent[] {
  return [
    {
      id: 'sig-001', factorId: 'MOM_12M1M', factorName: '12-1M Momentum', assetName: 'US Tech',
      oldSignal: 'yellow', newSignal: 'green', currentIC: 0.052, price: 0.5,
      timestamp: new Date(), urgency: 'normal', actionable: true,
      orderAction: 'Buy MOM Basket',
      message: '12-1M Momentum flipped 🟡→🟢 in US Tech sector. IC surged to +5.2%. Trend-following signal confirmed.',
    },
    {
      id: 'sig-002', factorId: 'SHORT_INTEREST', factorName: 'Short Interest', assetName: 'TSLA',
      oldSignal: 'green', newSignal: 'red', currentIC: -0.028, price: 0.5,
      timestamp: new Date(Date.now() - 60000), urgency: 'high', actionable: true,
      orderAction: 'Hedge TSLA',
      message: 'TSLA short interest spiked 380%! 🟢→🔴. Historical pattern: 70% probability of -5% correction within 2 weeks.',
    },
    {
      id: 'sig-003', factorId: 'CMD_EIA_CRUDE', factorName: 'EIA Inventory', assetName: 'Crude Oil',
      oldSignal: 'yellow', newSignal: 'green', currentIC: 0.038, price: 0.5,
      timestamp: new Date(Date.now() - 120000), urgency: 'normal', actionable: true,
      orderAction: 'Long CL',
      message: 'EIA crude draw -4.35M vs expected -1.5M. 🟡→🟢. Inventory tightening faster than expected. Bullish oil.',
    },
  ];
}

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  popup: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 9998,
    width: 340,
    maxWidth: '90vw',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1.5px solid',
    fontFamily: "'Inter', -apple-system, sans-serif",
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  closeBtn: { position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2 },
  header: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  icon: { fontSize: 18, flexShrink: 0, marginTop: 2 },
  headerInfo: {},
  title: { fontSize: 13, fontWeight: 700, color: '#e0e0e0' },
  signalRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  signalOld: { fontSize: 16, opacity: 0.5 },
  signalNew: { fontSize: 18 },
  signalTag: { fontSize: 10, fontWeight: 600, padding: '1px 6px' },
  message: { padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#aaa', lineHeight: 1.5 },
  icRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.1)', borderRadius: 6 },
  icLabel: { fontSize: 10, color: '#888' },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  timestamp: { fontSize: 9, color: '#555', marginTop: 6, fontFamily: 'monospace', textAlign: 'right' },
};

export { SignalPushPopup, useSignalPopupManager, generateDemoSignals };
export type { SignalPushPopupProps, SignalPushEvent };
