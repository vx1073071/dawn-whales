// ── R200 ML P2: FeeDeductionToastV3 — 计费Toast静默升级 ──────────
// V3 upgrade: silent mode (no popup), slide-in toast with auto-dismiss
// Shows: fee amount, balance after, service name, timestamp
// Error toast: red, with retry button
// 9-language i18n
// Configurable: autoDismissMs, showBalance, silent mode on/off
// V2→V3 migration: FeeDeductionToast → FeeDeductionToastV3

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled,
  ThunderboltOutlined, CloseOutlined,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'silent';

interface FeeDeduction {
  id: string;
  type: ToastType;
  serviceName: string;
  feeAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency?: 'USDT';
  timestamp: Date;
  errorMessage?: string;
  contactId?: string; // billing contact point ID
}

interface FeeDeductionToastV3Props {
  deduction: FeeDeduction | null;
  onDismiss?: () => void;
  onRetry?: (deduction: FeeDeduction) => void;
  onViewHistory?: () => void;
  autoDismissMs?: number; // 0 = don't auto-dismiss
  showBalance?: boolean;
  silent?: boolean; // true = no popup at all (just update balance silently)
  locale?: string;
}

// ── i18n (9 languages) ──────────────────────────────────────────────
const TOAST_I18N: Record<string, Record<string, string>> = {
  'zh-CN': { deducted: '已扣除', fee: '手续费', balance: '余额', service: '服务', success: '扣费成功', error: '扣费失败', retry: '重试', dismiss: '关闭', viewHistory: '查看记录', from: '原余额', to: '现余额', free: '免费' },
  'zh-TW': { deducted: '已扣除', fee: '手續費', balance: '餘額', service: '服務', success: '扣費成功', error: '扣費失敗', retry: '重試', dismiss: '關閉', viewHistory: '查看記錄', from: '原餘額', to: '現餘額', free: '免費' },
  en: { deducted: 'Deducted', fee: 'Fee', balance: 'Balance', service: 'Service', success: 'Charged', error: 'Charge Failed', retry: 'Retry', dismiss: 'Dismiss', viewHistory: 'History', from: 'Before', to: 'After', free: 'Free' },
  ja: { deducted: '差引', fee: '手数料', balance: '残高', service: 'サービス', success: '課金済', error: '課金失敗', retry: 'リトライ', dismiss: '閉じる', viewHistory: '履歴', from: '前', to: '後', free: '無料' },
  ko: { deducted: '차감됨', fee: '수수료', balance: '잔액', service: '서비스', success: '과금 완료', error: '과금 실패', retry: '재시도', dismiss: '닫기', viewHistory: '기록', from: '이전', to: '이후', free: '무료' },
  fr: { deducted: 'Déduit', fee: 'Frais', balance: 'Solde', service: 'Service', success: 'Facturé', error: 'Échec', retry: 'Réessayer', dismiss: 'Fermer', viewHistory: 'Historique', from: 'Avant', to: 'Après', free: 'Gratuit' },
  it: { deducted: 'Dedotto', fee: 'Commissione', balance: 'Saldo', service: 'Servizio', success: 'Addebitato', error: 'Addebito Fallito', retry: 'Riprova', dismiss: 'Chiudi', viewHistory: 'Cronologia', from: 'Prima', to: 'Dopo', free: 'Gratis' },
  de: { deducted: 'Abgezogen', fee: 'Gebühr', balance: 'Guthaben', service: 'Dienst', success: 'Belastet', error: 'Fehlgeschlagen', retry: 'Wiederholen', dismiss: 'Schließen', viewHistory: 'Verlauf', from: 'Vorher', to: 'Nachher', free: 'Kostenlos' },
  es: { deducted: 'Deducido', fee: 'Comisión', balance: 'Saldo', service: 'Servicio', success: 'Cobrado', error: 'Error', retry: 'Reintentar', dismiss: 'Cerrar', viewHistory: 'Historial', from: 'Antes', to: 'Después', free: 'Gratis' },
};

function getToastLocale(locale?: string): Record<string, string> {
  if (locale && TOAST_I18N[locale]) return TOAST_I18N[locale];
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language;
    if (TOAST_I18N[lang]) return TOAST_I18N[lang];
    const base = lang.split('-')[0];
    const match = Object.keys(TOAST_I18N).find((k) => k.startsWith(base));
    if (match) return TOAST_I18N[match];
  }
  return TOAST_I18N.en;
}

// ── Component ────────────────────────────────────────────────────────
const FeeDeductionToastV3: React.FC<FeeDeductionToastV3Props> = ({
  deduction,
  onDismiss,
  onRetry,
  onViewHistory,
  autoDismissMs = 5000,
  showBalance = true,
  silent = false,
  locale: propLocale,
}) => {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = getToastLocale(propLocale);

  // Show when deduction arrives
  useEffect(() => {
    if (deduction) {
      if (silent || deduction.type === 'silent') {
        // Silent mode: no toast, just log
        setVisible(false);
        if (autoDismissMs > 0) {
          setTimeout(() => onDismiss?.(), 100); // immediate background dismiss
        }
        return;
      }
      setVisible(true);
      setDismissing(false);

      // Auto-dismiss
      if (autoDismissMs > 0) {
        timerRef.current = setTimeout(handleDismiss, autoDismissMs);
      }
    } else {
      setVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [deduction, silent, autoDismissMs]);

  const handleDismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  const handleRetry = useCallback(() => {
    if (deduction) onRetry?.(deduction);
  }, [deduction, onRetry]);

  // Silent mode: render nothing
  if (!deduction || (!visible && silent)) return null;
  if (deduction.type === 'silent' && silent) return null;

  const isError = deduction.type === 'error';
  const isSuccess = deduction.type === 'success';
  const isFree = deduction.feeAmount === 0;

  return (
    <div style={{
      ...styles.toast,
      opacity: dismissing ? 0 : 1,
      transform: dismissing ? 'translateX(40px)' : visible ? 'translateX(0)' : 'translateX(40px)',
      borderColor: isError ? '#d73027' : isSuccess ? '#66bd63' : '#d4a853',
      background: isError ? 'rgba(215,48,39,0.12)' : isSuccess ? 'rgba(102,189,99,0.08)' : 'rgba(212,168,83,0.08)',
    }}>
      {/* Close Button */}
      <button style={styles.closeBtn} onClick={handleDismiss}>
        <CloseOutlined style={{ fontSize: 10 }} />
      </button>

      {/* Header */}
      <div style={styles.toastHeader}>
        {isError ? (
          <CloseCircleFilled style={{ color: '#d73027', fontSize: 18 }} />
        ) : isSuccess ? (
          <CheckCircleFilled style={{ color: '#66bd63', fontSize: 18 }} />
        ) : (
          <ThunderboltOutlined style={{ color: '#d4a853', fontSize: 18 }} />
        )}
        <div style={styles.toastHeaderText}>
          <div style={styles.toastTitle}>
            {isFree ? t.free : `${t.deducted} ${deduction.feeAmount.toFixed(deduction.feeAmount < 0.1 ? 4 : 2)} ${deduction.currency || 'USDT'}`}
          </div>
          <div style={styles.toastService}>
            {t.service}: {deduction.serviceName}
            {deduction.contactId && (
              <span style={{ fontSize: 9, padding: '0 4px', marginLeft: 4, background: '#2a2a4a', borderRadius: 4, color: '#888' }}>
                #{deduction.contactId}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Balance Change */}
      {showBalance && !isFree && (
        <div style={styles.balanceChange}>
          <div style={styles.balanceRow}>
            <span style={styles.balanceLabel}>{t.from}</span>
            <span style={styles.balanceVal}>{deduction.balanceBefore.toFixed(2)}</span>
            <span style={styles.balanceArrow}>→</span>
            <span style={styles.balanceLabel}>{t.to}</span>
            <span style={{ ...styles.balanceVal, color: '#66bd63' }}>{deduction.balanceAfter.toFixed(2)}</span>
          </div>
          <div style={styles.balanceBar}>
            <div style={{ height: 3, background: '#2a2a4a', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ height: '100%', width: `${Math.min(deduction.balanceBefore > 0 ? (deduction.feeAmount / deduction.balanceBefore) * 100 : 5, 100)}%`, background: isError ? '#d73027' : '#d4a853', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {isError && deduction.errorMessage && (
        <div style={styles.errorMsg}>
          <span>{deduction.errorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div style={styles.actions}>
        {isError && onRetry && (
          <Button size="small" type="primary" danger onClick={handleRetry} style={{ borderRadius: 6 }}>
            {t.retry}
          </Button>
        )}
        <Button size="small" type="text" onClick={handleDismiss} style={{ color: '#888', fontSize: 10 }}>
          {t.dismiss}
        </Button>
        {onViewHistory && (
          <Button size="small" type="link" onClick={onViewHistory} style={{ fontSize: 10, padding: 0 }}>
            {t.viewHistory}
          </Button>
        )}
      </div>

      {/* Timestamp */}
      <div style={styles.timestamp}>
        {deduction.timestamp.toLocaleTimeString()}
      </div>
    </div>
  );
};

// ── Toast Manager (for stacking multiple toasts) ────────────────────
interface ToastQueueItem {
  id: string;
  deduction: FeeDeduction;
}

const useFeeToastManager = () => {
  const [queue, setQueue] = useState<ToastQueueItem[]>([]);
  const [active, setActive] = useState<FeeDeduction | null>(null);

  const enqueue = useCallback((d: FeeDeduction) => {
    if (d.type === 'silent') {
      // Silent: don't enqueue, just callback
      return;
    }
    const item: ToastQueueItem = { id: d.id, deduction: d };
    setQueue((prev) => [...prev, item]);
    if (!active) {
      setActive(d);
      setQueue((prev) => prev.filter((q) => q.id !== d.id));
    }
  }, [active]);

  const dismiss = useCallback(() => {
    setActive(null);
    setQueue((prev) => {
      if (prev.length > 0) {
        const next = prev[0];
        setActive(next.deduction);
        return prev.slice(1);
      }
      return prev;
    });
  }, []);

  return { active, queue, enqueue, dismiss };
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  toast: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 9999,
    width: 340,
    maxWidth: '90vw',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid',
    fontFamily: "'Inter', -apple-system, sans-serif",
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: 2,
  },
  toastHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  toastHeaderText: {},
  toastTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  toastService: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },
  balanceChange: {
    padding: '8px 10px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    marginBottom: 8,
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  balanceLabel: { fontSize: 9, color: '#888' },
  balanceVal: { fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: '#ccc' },
  balanceArrow: { fontSize: 10, color: '#666' },
  balanceBar: {},
  errorMsg: {
    padding: '6px 8px',
    background: 'rgba(215,48,39,0.1)',
    borderRadius: 4,
    marginBottom: 6,
    fontSize: 10,
    color: '#f46d43',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: 9,
    color: '#555',
    marginTop: 6,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
};

export { FeeDeductionToastV3, useFeeToastManager, getToastLocale, TOAST_I18N };
export type { FeeDeductionToastV3Props, FeeDeduction, ToastType, ToastQueueItem };
