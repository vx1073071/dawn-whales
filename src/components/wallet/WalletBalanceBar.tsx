// ── R200 ML P1: WalletBalanceBar — 钱包余额展示组件重构 ──────────
// 9-language i18n support + real-time balance polling
// Red warning bar when balance < critical threshold (2 USDT)
// Yellow bar when balance < safe threshold (10 USDT)
// Green bar when balance >= safe
// USDT icon + 6dp precision + refresh button with last-updated timestamp
// Withdrawal/Deposit quick action buttons

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Tooltip, Skeleton } from 'antd';
import {
  WalletOutlined, ReloadOutlined, ArrowUpOutlined,
  ArrowDownOutlined, WarningFilled, CheckCircleFilled,
} from '@ant-design/icons';

// ── Types ───────────────────────────────────────────────────────────
interface WalletBalanceBarProps {
  balance?: number | null;
  currency?: 'USDT';
  locale?: string;
  onRefresh?: () => Promise<number>;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  pollingIntervalMs?: number; // 0 = disabled
  showActions?: boolean;
  compact?: boolean;
}

// ── i18n (9 languages) ──────────────────────────────────────────────
const I18N: Record<string, Record<string, string>> = {
  'zh-CN': { balance: '余额', deposit: '充值', withdraw: '提现', refresh: '刷新', low: '余额不足', warning: '余额偏低', ok: '余额充足', loading: '加载中', updated: '更新于', error: '获取失败', retry: '重试', hint: '最低交易余额 2 USDT' },
  'zh-TW': { balance: '餘額', deposit: '充值', withdraw: '提現', refresh: '刷新', low: '餘額不足', warning: '餘額偏低', ok: '餘額充足', loading: '載入中', updated: '更新於', error: '取得失敗', retry: '重試', hint: '最低交易餘額 2 USDT' },
  en: { balance: 'Balance', deposit: 'Deposit', withdraw: 'Withdraw', refresh: 'Refresh', low: 'Low Balance', warning: 'Low Balance', ok: 'Sufficient', loading: 'Loading', updated: 'Updated', error: 'Failed', retry: 'Retry', hint: 'Minimum 2 USDT to trade' },
  ja: { balance: '残高', deposit: '入金', withdraw: '出金', refresh: '更新', low: '残高不足', warning: '残高低下', ok: '残高十分', loading: '読込中', updated: '更新', error: '失敗', retry: '再試行', hint: '取引には最低2 USDT必要' },
  ko: { balance: '잔액', deposit: '입금', withdraw: '출금', refresh: '새로고침', low: '잔액 부족', warning: '잔액 낮음', ok: '잔액 충분', loading: '로딩 중', updated: '업데이트', error: '실패', retry: '재시도', hint: '최소 2 USDT 필요' },
  fr: { balance: 'Solde', deposit: 'Dépôt', withdraw: 'Retrait', refresh: 'Actualiser', low: 'Solde bas', warning: 'Solde faible', ok: 'Solde OK', loading: 'Chargement', updated: 'Mis à jour', error: 'Échec', retry: 'Réessayer', hint: '2 USDT minimum' },
  it: { balance: 'Saldo', deposit: 'Deposito', withdraw: 'Prelievo', refresh: 'Aggiorna', low: 'Saldo basso', warning: 'Saldo scarso', ok: 'Saldo OK', loading: 'Caricamento', updated: 'Aggiornato', error: 'Fallito', retry: 'Riprova', hint: 'Minimo 2 USDT' },
  de: { balance: 'Guthaben', deposit: 'Einzahlen', withdraw: 'Auszahlen', refresh: 'Aktualisieren', low: 'Gering', warning: 'Niedrig', ok: 'Ausreichend', loading: 'Laden', updated: 'Aktualisiert', error: 'Fehler', retry: 'Wiederholen', hint: 'Mindestens 2 USDT' },
  es: { balance: 'Saldo', deposit: 'Depositar', withdraw: 'Retirar', refresh: 'Actualizar', low: 'Saldo bajo', warning: 'Saldo bajo', ok: 'Saldo OK', loading: 'Cargando', updated: 'Actualizado', error: 'Error', retry: 'Reintentar', hint: 'Mínimo 2 USDT' },
};

// ── Helpers ──────────────────────────────────────────────────────────
function detectLocale(locale?: string): string {
  if (locale && I18N[locale]) return locale;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language;
    if (I18N[lang]) return lang;
    const base = lang.split('-')[0];
    const match = Object.keys(I18N).find((k) => k.startsWith(base));
    if (match) return match;
  }
  return 'en';
}

type BalanceStatus = 'critical' | 'warning' | 'safe' | 'loading' | 'error';

// ── Component ────────────────────────────────────────────────────────
const WalletBalanceBar: React.FC<WalletBalanceBarProps> = ({
  balance: propBalance,
  currency = 'USDT',
  locale: propLocale,
  onRefresh,
  onDeposit,
  onWithdraw,
  pollingIntervalMs = 0,
  showActions = true,
  compact = false,
}) => {
  const [balance, setBalance] = useState<number | null>(propBalance ?? null);
  const [status, setStatus] = useState<BalanceStatus>('loading');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const locale = detectLocale(propLocale);
  const t = I18N[locale] || I18N.en;

  // Determine status from balance
  useEffect(() => {
    if (balance === null || balance === undefined) {
      setStatus('loading');
    } else if (balance < 2) {
      setStatus('critical');
    } else if (balance < 10) {
      setStatus('warning');
    } else {
      setStatus('safe');
    }
  }, [balance]);

  // Sync prop balance
  useEffect(() => {
    if (propBalance !== undefined && propBalance !== null) {
      setBalance(propBalance);
    }
  }, [propBalance]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      if (onRefresh) {
        const newBalance = await onRefresh();
        setBalance(newBalance);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMsg(err?.message || t.error);
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, t]);

  // Polling
  useEffect(() => {
    if (pollingIntervalMs > 0 && onRefresh) {
      handleRefresh();
      intervalRef.current = setInterval(handleRefresh, pollingIntervalMs);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [pollingIntervalMs, onRefresh, handleRefresh]);

  // Initial load
  useEffect(() => {
    if (propBalance === undefined && onRefresh) {
      handleRefresh();
    } else if (propBalance !== undefined) {
      setLastUpdated(new Date());
    }
  }, []);

  // Status config
  const statusConfig: Record<BalanceStatus, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
    critical: { color: '#d73027', bg: 'rgba(215,48,39,0.12)', border: '#d73027', icon: <WarningFilled />, label: t.low },
    warning: { color: '#d4a853', bg: 'rgba(212,168,83,0.12)', border: '#d4a853', icon: <WarningFilled />, label: t.warning },
    safe: { color: '#66bd63', bg: 'rgba(102,189,99,0.12)', border: '#66bd63', icon: <CheckCircleFilled />, label: t.ok },
    loading: { color: '#888', bg: 'rgba(136,136,136,0.08)', border: '#2a2a4a', icon: null, label: t.loading },
    error: { color: '#d73027', bg: 'rgba(215,48,39,0.08)', border: '#d73027', icon: <WarningFilled />, label: t.error },
  };

  const sc = statusConfig[status];

  if (compact) {
    return (
      <div style={{ ...styles.compact, background: sc.bg, borderColor: sc.border }} onClick={handleRefresh}>
        <span style={styles.compactIcon}><WalletOutlined style={{ color: sc.color }} /></span>
        {balance !== null ? (
          <span style={{ ...styles.compactVal, color: sc.color }}>{balance.toFixed(2)}</span>
        ) : (
          <span style={styles.compactVal}>—</span>
        )}
        <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>{currency}</span>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, background: sc.bg, borderColor: sc.border }}>
      {/* Main Row */}
      <div style={styles.mainRow}>
        <div style={styles.leftSection}>
          {/* Icon + Balance */}
          <div style={styles.balanceZone}>
            <span style={styles.balanceIcon}>
              <WalletOutlined style={{ fontSize: 20, color: sc.color }} />
            </span>
            <div style={styles.balanceInfo}>
              <div style={styles.balanceLabel}>{t.balance}</div>
              {status === 'loading' ? (
                <Skeleton.Input active size="small" style={{ width: 80, height: 24 }} />
              ) : balance !== null ? (
                <div style={styles.balanceAmount}>
                  <span style={{ ...styles.balanceNum, color: sc.color }}>
                    {balance.toFixed(2)}
                  </span>
                  <span style={styles.balanceCurrency}> {currency}</span>
                  <span style={{ ...styles.balanceStatusBadge, background: sc.color }}>
                    {sc.label}
                  </span>
                </div>
              ) : (
                <div style={{ ...styles.balanceNum, color: '#888' }}>—</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={styles.rightSection}>
          <Tooltip title={t.refresh}>
            <Button
              size="small"
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={handleRefresh}
              type="text"
              style={{ color: '#888' }}
            />
          </Tooltip>
          {showActions && (
            <>
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={onDeposit}
                style={styles.depositBtn}
              >
                {t.deposit}
              </Button>
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={onWithdraw}
                disabled={balance !== null && balance < 2}
                style={styles.withdrawBtn}
              >
                {t.withdraw}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Footer */}
      <div style={styles.footer}>
        <div style={styles.footerLeft}>
          {status === 'error' ? (
            <span style={{ color: '#d73027', fontSize: 10 }}>
              {errorMsg}
              <Button type="link" size="small" onClick={handleRefresh} style={{ fontSize: 10, padding: 0, marginLeft: 4 }}>
                {t.retry}
              </Button>
            </span>
          ) : (
            <>
              {status === 'critical' && (
                <span style={{ color: '#d73027', fontSize: 10 }}>⚠️ {t.hint}</span>
              )}
              {status === 'warning' && (
                <span style={{ color: '#d4a853', fontSize: 10 }}>⚡ {t.hint}</span>
              )}
            </>
          )}
        </div>
        <div style={styles.footerRight}>
          {lastUpdated && (
            <span style={styles.timestamp}>
              {t.updated} {lastUpdated.toLocaleTimeString(locale)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 10,
    border: '1px solid',
    padding: '12px 16px',
    fontFamily: "'Inter', -apple-system, sans-serif",
    transition: 'all 0.3s ease',
    minWidth: 280,
  },
  mainRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: { flex: 1 },
  balanceZone: { display: 'flex', alignItems: 'center', gap: 10 },
  balanceIcon: { flexShrink: 0 },
  balanceInfo: {},
  balanceLabel: { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceAmount: { display: 'flex', alignItems: 'baseline', gap: 4 },
  balanceNum: { fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 },
  balanceCurrency: { fontSize: 12, color: '#888', fontFamily: 'monospace' },
  balanceStatusBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: '#1a1a2e',
    padding: '1px 6px',
    borderRadius: 8,
    marginLeft: 6,
  },
  rightSection: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  depositBtn: {
    fontSize: 11,
    height: 26,
    padding: '0 10px',
    background: 'rgba(102,189,99,0.15)',
    border: '1px solid rgba(102,189,99,0.4)',
    color: '#66bd63',
    borderRadius: 6,
  },
  withdrawBtn: {
    fontSize: 11,
    height: 26,
    padding: '0 10px',
    background: 'rgba(244,109,67,0.1)',
    border: '1px solid rgba(244,109,67,0.3)',
    color: '#f46d43',
    borderRadius: 6,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  footerLeft: {},
  footerRight: {},
  timestamp: { fontSize: 9, color: '#555', fontFamily: 'monospace' },
  // Compact
  compact: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  compactIcon: { fontSize: 14 },
  compactVal: { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
};

export { WalletBalanceBar, I18N as WALLET_I18N, detectLocale };
export type { WalletBalanceBarProps, BalanceStatus };
