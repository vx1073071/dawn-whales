/**
 * @deprecated — REPLACED by v17.6 WalletFullPage (wallet/WalletFullPage.tsx, R143)
 * v17.6: unified wallet. This legacy billing/wallet/ is deprecated. | [DEPRECATED v17.6]
 *
 * Original (R59 v1.3.0): USDTWalletPage — TRC-20 top-up + withdrawal
 */

import React, { useState } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'analysis' | 'commission' | 'refund';
  amount: number;          // USDT
  fee?: number;            // platform fee
  creatorEarning?: number; // creator net
  status: 'pending' | 'confirmed' | 'failed' | 'reviewing';
  txHash?: string;
  timestamp: string;
  note: string;
}

export interface USDTWallet {
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  trc20Address: string;
  transactions: WalletTransaction[];
}

export interface USDTWalletPageProps {
  wallet?: USDTWallet;
  onDeposit?: () => void;
  onWithdraw?: (amount: number) => void;
  onCopyAddress?: (address: string) => void;
  className?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────

const mockWallet: USDTWallet = {
  balance: 28.50,
  totalDeposited: 50.00,
  totalWithdrawn: 8.00,
  trc20Address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  transactions: [
    { id: 'tx-001', type: 'deposit', amount: 20.00, status: 'confirmed', txHash: '0xabc...123', timestamp: '2026-06-08T14:20:00Z', note: 'TRC-20 deposit' },
    { id: 'tx-002', type: 'analysis', amount: 1.50, fee: 0.15, creatorEarning: 1.35, status: 'confirmed', timestamp: '2026-06-09T03:15:00Z', note: 'AAPL 4-agent standard analysis' },
    { id: 'tx-003', type: 'analysis', amount: 1.50, fee: 0.15, creatorEarning: 1.35, status: 'confirmed', timestamp: '2026-06-09T02:50:00Z', note: 'NVDA arena analysis (3 models)' },
    { id: 'tx-004', type: 'commission', amount: 0.30, creatorEarning: 0.30, status: 'confirmed', timestamp: '2026-06-09T00:00:00Z', note: 'Monthly commission settlement' },
    { id: 'tx-005', type: 'withdraw', amount: 5.00, status: 'pending', timestamp: '2026-06-08T22:00:00Z', note: 'Withdraw to TRC-20' },
    { id: 'tx-006', type: 'refund', amount: 1.50, status: 'confirmed', timestamp: '2026-06-08T18:00:00Z', note: 'Analysis failed, refunded' },
  ],
};

// ── QR Code SVG (placeholder) ───────────────────────────────────────────

const QRPlaceholder: React.FC<{ address: string }> = ({ address }) => (
  <div className="wallet-qr-container">
    <svg viewBox="0 0 160 160" className="wallet-qr-code">
      {/* Simple QR-like pattern */}
      <rect x="0" y="0" width="160" height="160" fill="#fff" rx="8" />
      {Array.from({ length: 13 }, (_, r) =>
        Array.from({ length: 13 }, (_, c) => {
          const hash = address.charCodeAt((r * 13 + c) % address.length);
          return hash % 3 === 0 ? (
            <rect key={`${r}-${c}`} x={12 + c * 10} y={12 + r * 10} width={8} height={8} fill="#1a1a2e" rx={1} />
          ) : null;
        })
      )}
      <rect x="60" y="60" width="40" height="40" fill="#fff" rx="4" />
      <circle cx="80" cy="80" r="12" fill="#3b82f6" />
    </svg>
    <p className="wallet-qr-hint">Scan with TRC-20 wallet</p>
  </div>
);

const TxIcon: React.FC<{ type: WalletTransaction['type'] }> = ({ type }) => {
  const icons: Record<string, string> = { deposit: '📥', withdraw: '📤', analysis: '🤖', commission: '💸', refund: '↩️' };
  return <span className="wallet-tx-icon">{icons[type] || '•'}</span>;
};

const TxRow: React.FC<{ tx: WalletTransaction }> = ({ tx }) => {
  const statusColors: Record<string, string> = { pending: '#f59e0b', confirmed: '#22c55e', failed: '#ef4444', reviewing: '#3b82f6' };
  const typeLabels: Record<string, string> = { deposit: 'Deposit', withdraw: 'Withdraw', analysis: 'AI Analysis', commission: 'Commission', refund: 'Refund' };

  return (
    <div className="wallet-tx-row">
      <TxIcon type={tx.type} />
      <div className="wallet-tx-info">
        <span className="wallet-tx-type">{typeLabels[tx.type]}</span>
        <span className="wallet-tx-note">{tx.note}</span>
      </div>
      <div className="wallet-tx-amounts">
        <span className={`wallet-tx-amount ${tx.amount > 0 ? 'positive' : ''}`}>
          {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
        </span>
        {tx.fee && <span className="wallet-tx-fee">Fee: ${tx.fee.toFixed(2)}</span>}
      </div>
      <div className="wallet-tx-status" style={{ color: statusColors[tx.status] }}>
        {tx.status}
      </div>
      <span className="wallet-tx-time">{new Date(tx.timestamp).toLocaleDateString()}</span>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────

const USDTWalletPage: React.FC<USDTWalletPageProps> = ({
  wallet: propWallet,
  onDeposit,
  onWithdraw,
  onCopyAddress,
  className = '',
}) => {
  const [tab, setTab] = useState<'overview' | 'deposit' | 'transactions'>('overview');
  const [withdrawAmount, setWithdrawAmount] = useState(0);

  const wallet = propWallet || mockWallet;

  return (
    <div className={`usdt-wallet-page ${className}`}>
      <h2 className="wallet-title">🪙 USDT Wallet</h2>

      {/* ── Balance Header ─────────────────────────── */}
      <div className="wallet-balance-header">
        <div className="wallet-balance-main">
          <span className="wallet-balance-amount">${wallet.balance.toFixed(2)}</span>
          <span className="wallet-balance-currency">USDT</span>
        </div>
        <div className="wallet-balance-stats">
          <span>Total Deposited: ${wallet.totalDeposited.toFixed(2)}</span>
          <span>Total Withdrawn: ${wallet.totalWithdrawn.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────── */}
      <div className="wallet-tabs">
        <button className={`wallet-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`wallet-tab ${tab === 'deposit' ? 'active' : ''}`} onClick={() => setTab('deposit')}>Deposit</button>
        <button className={`wallet-tab ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>Transactions</button>
      </div>

      {/* ── Overview ──────────────────────────────── */}
      {tab === 'overview' && (
        <div className="wallet-section">
          <div className="wallet-overview-grid">
            <div className="wallet-overview-card">
              <span className="wallet-overview-value">${wallet.balance.toFixed(2)}</span>
              <span className="wallet-overview-label">Available</span>
            </div>
            <div className="wallet-overview-card">
              <span className="wallet-overview-value">{wallet.transactions.filter((t) => t.type === 'deposit').length}</span>
              <span className="wallet-overview-label">Deposits</span>
            </div>
            <div className="wallet-overview-card">
              <span className="wallet-overview-value">{wallet.transactions.filter((t) => t.type === 'withdraw').length}</span>
              <span className="wallet-overview-label">Withdrawals</span>
            </div>
            <div className="wallet-overview-card">
              <span className="wallet-overview-value">{wallet.transactions.filter((t) => t.type === 'analysis').length}</span>
              <span className="wallet-overview-label">Analyses</span>
            </div>
          </div>
          <div className="wallet-quick-actions">
            <button className="wallet-btn-deposit" onClick={() => { setTab('deposit'); onDeposit?.(); }}>📥 Deposit USDT</button>
            <div className="wallet-withdraw-inline">
              <input type="number" min={10} step={1} placeholder="Min 10 USDT" value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))} />
              <button onClick={() => { if (withdrawAmount >= 10) onWithdraw?.(withdrawAmount); }}
                disabled={withdrawAmount < 10 || withdrawAmount > wallet.balance}>
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deposit ────────────────────────────────── */}
      {tab === 'deposit' && (
        <div className="wallet-section">
          <h3 className="wallet-section-title">TRC-20 Deposit</h3>
          <div className="wallet-deposit-guide">
            <div className="wallet-deposit-step">
              <span className="wallet-step-num">1</span>
              <span>Send USDT to this TRC-20 address (min $10):</span>
            </div>
            <div className="wallet-address-display">
              <code className="wallet-address">{wallet.trc20Address}</code>
              <button className="wallet-btn-copy" onClick={() => { navigator.clipboard.writeText(wallet.trc20Address); onCopyAddress?.(wallet.trc20Address); }}>
                📋 Copy
              </button>
            </div>
            <QRPlaceholder address={wallet.trc20Address} />
            <div className="wallet-deposit-step">
              <span className="wallet-step-num">2</span>
              <span>Wait for chain confirmation (≤30 min, TRC-20 network)</span>
            </div>
            <div className="wallet-deposit-step">
              <span className="wallet-step-num">3</span>
              <span>Balance updates automatically after 6 confirmations</span>
            </div>
            <div className="wallet-deposit-alert">
              ⚠️ Only send USDT on TRC-20. Other tokens/networks will be lost.
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions ───────────────────────────── */}
      {tab === 'transactions' && (
        <div className="wallet-section">
          <div className="wallet-tx-list">
            {wallet.transactions.length === 0 ? (
              <div className="wallet-empty"><span>📋</span><p>No transactions yet</p></div>
            ) : (
              wallet.transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        </div>
      )}

      {/* ── Commission Breakdown ───────────────────── */}
      <div className="wallet-section wallet-commission-section">
        <h3 className="wallet-section-title">💸 Commission Breakdown</h3>
        <div className="wallet-commission-grid">
          <div className="wallet-commission-tier">
            <span className="wallet-tier-badge">L1</span>
            <span>70% Creator</span>
            <span>30% Platform</span>
          </div>
          <div className="wallet-commission-tier">
            <span className="wallet-tier-badge">L2</span>
            <span>80% Creator</span>
            <span>20% Platform</span>
          </div>
          <div className="wallet-commission-tier active">
            <span className="wallet-tier-badge current">L2 (You)</span>
            <span>80% Creator</span>
            <span>20% Platform</span>
          </div>
          <div className="wallet-commission-tier">
            <span className="wallet-tier-badge">L3</span>
            <span>90% Creator</span>
            <span>10% Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── CSS ──────────────────────────────────────────────────────────────────

export const USDT_WALLET_STYLES = `
.usdt-wallet-page { max-width: 800px; margin: 0 auto; padding: 24px; }
.wallet-title { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; }

.wallet-balance-header { padding: 24px; border-radius: 14px; background: linear-gradient(135deg, #22c55e20, #3b82f620); border: 1px solid rgba(34,197,94,0.15); text-align: center; margin-bottom: 16px; }
.wallet-balance-main { margin-bottom: 8px; }
.wallet-balance-amount { font-size: 36px; font-weight: 800; }
.wallet-balance-currency { font-size: 18px; color: var(--text-secondary, #94a3b8); margin-left: 6px; }
.wallet-balance-stats { display: flex; justify-content: center; gap: 24px; font-size: 12px; color: var(--text-secondary, #94a3b8); }

.wallet-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1)); margin-bottom: 16px; }
.wallet-tab { padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 14px; color: var(--text-secondary, #94a3b8); cursor: pointer; }
.wallet-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

.wallet-section { padding: 20px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,0.05)); border: 1px solid var(--border-color, rgba(255,255,255,0.08)); margin-bottom: 16px; }
.wallet-section-title { font-size: 15px; font-weight: 600; margin: 0 0 14px 0; }

.wallet-overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.wallet-overview-card { display: flex; flex-direction: column; align-items: center; padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); }
.wallet-overview-value { font-size: 18px; font-weight: 700; }
.wallet-overview-label { font-size: 10px; color: var(--text-secondary, #94a3b8); margin-top: 2px; text-transform: uppercase; }

.wallet-quick-actions { display: flex; gap: 10px; align-items: center; }
.wallet-btn-deposit { padding: 12px 24px; border-radius: 10px; border: none; background: #22c55e; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
.wallet-withdraw-inline { display: flex; gap: 6px; }
.wallet-withdraw-inline input { width: 130px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: rgba(255,255,255,0.05); color: var(--text-primary, #e2e8f0); font-size: 14px; }
.wallet-withdraw-inline button { padding: 10px 20px; border-radius: 8px; border: none; background: #3b82f6; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.wallet-withdraw-inline button:disabled { background: #374151; cursor: not-allowed; }

/* Deposit */
.wallet-deposit-guide { display: flex; flex-direction: column; gap: 14px; }
.wallet-deposit-step { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.wallet-step-num { width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.wallet-address-display { display: flex; gap: 8px; align-items: center; padding: 14px; border-radius: 10px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); }
.wallet-address { font-size: 13px; color: #22c55e; word-break: break-all; flex: 1; }
.wallet-btn-copy { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.12)); background: transparent; color: var(--text-primary, #e2e8f0); font-size: 12px; cursor: pointer; }

.wallet-qr-container { text-align: center; }
.wallet-qr-code { width: 160px; height: 160px; border-radius: 8px; }
.wallet-qr-hint { font-size: 12px; color: var(--text-secondary, #94a3b8); margin-top: 6px; }

.wallet-deposit-alert { padding: 12px; border-radius: 8px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.15); color: #f59e0b; font-size: 12px; }

/* Transactions */
.wallet-tx-list { display: flex; flex-direction: column; gap: 6px; }
.wallet-tx-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; border: 1px solid var(--border-color, rgba(255,255,255,0.06)); font-size: 13px; transition: background 0.15s; }
.wallet-tx-row:hover { background: rgba(255,255,255,0.02); }
.wallet-tx-icon { font-size: 18px; flex-shrink: 0; }
.wallet-tx-info { flex: 1; min-width: 0; }
.wallet-tx-type { font-weight: 500; display: block; }
.wallet-tx-note { font-size: 11px; color: var(--text-secondary, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.wallet-tx-amounts { text-align: right; }
.wallet-tx-amount { font-weight: 600; } .wallet-tx-amount.positive { color: #ef4444; }
.wallet-tx-fee { font-size: 10px; color: var(--text-secondary, #94a3b8); display: block; }
.wallet-tx-status { font-size: 11px; font-weight: 500; text-transform: capitalize; min-width: 70px; text-align: center; }
.wallet-tx-time { font-size: 11px; color: var(--text-secondary, #94a3b8); white-space: nowrap; }

/* Commission */
.wallet-commission-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.wallet-commission-tier { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,0.08)); font-size: 12px; }
.wallet-commission-tier.active { border-color: #3b82f6; background: rgba(59,130,246,0.06); }
.wallet-tier-badge { padding: 3px 10px; border-radius: 8px; background: rgba(139,92,246,0.15); color: #a78bfa; font-weight: 600; font-size: 11px; }
.wallet-tier-badge.current { background: rgba(59,130,246,0.15); color: #60a5fa; }

.wallet-empty { text-align: center; padding: 40px; color: var(--text-secondary, #94a3b8); }

@media (max-width: 768px) {
  .wallet-overview-grid { grid-template-columns: repeat(2, 1fr); }
  .wallet-commission-grid { grid-template-columns: repeat(2, 1fr); }
  .wallet-tx-status, .wallet-tx-time { display: none; }
}
`;

export default USDTWalletPage;
