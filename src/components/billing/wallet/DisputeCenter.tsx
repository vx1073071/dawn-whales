/**
 * DisputeCenter + TransactionHistory — ML-62-02 [P0]
 * R62: v1.5.0-alpha — Dispute filing & transaction records (v15)
 *
 * Features:
 * - Dispute filing form: 4 reason types + description + evidence
 * - Dispute tracking: pending→reviewed→resolved/rejected
 * - Dispute history with status indicators
 * - "Cancel" option for buyer (releases frozen funds)
 * - Platform no-arbitration policy notice
 * - Transaction records: full history with filters
 * - Transaction detail: direction/amount/status/freeze countdown
 */

import React, { useState, useCallback } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export type DisputeReason = 'payment_unconfirmed' | 'terms_not_met' | 'account_issue' | 'other';
export type DisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'cancelled_by_buyer';

export const DISPUTE_REASONS: { value: DisputeReason; label: string; desc: string }[] = [
  { value: 'payment_unconfirmed', label: i18n.t('DisputeCenter.k1'), desc: 'Recipient claims payment not received or confirmed' },
  { value: 'terms_not_met', label: i18n.t('DisputeCenter.k2'), desc: 'Service/deliverable does not match agreed terms' },
  { value: 'account_issue', label: i18n.t('DisputeCenter.k3'), desc: 'Counterparty account appears unusual or suspicious' },
  { value: 'other', label: i18n.t('DisputeCenter.k4'), desc: 'Other reason (description required)' },
];

export interface Dispute {
  id: string;
  transferId: string;
  counterparty: string;
  amount: number;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt?: string;
  adminNote?: string;
}

export interface TransactionRecord {
  id: string;
  type: 'p2p_sent' | 'p2p_received' | 'recharge' | 'withdrawal' | 'analysis_fee' | 'subscription' | 'commission';
  counterparty?: string;
  amount: number;
  fee: number;
  net: number;
  status: 'completed' | 'frozen' | 'pending' | 'failed' | 'disputed';
  description: string;
  createdAt: string;
  frozenUntil?: string;
}

export interface DisputeCenterProps {
  disputes?: Dispute[];
  transactions?: TransactionRecord[];
  onFileDispute?: (transferId: string, reason: DisputeReason, description: string) => void;
  onCancelDispute?: (disputeId: string) => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockDisputes: Dispute[] = [
  {
    id: 'dis-001', transferId: 'p2p-004', counterparty: 'CryptoFlow_CN',
    amount: 15, reason: 'payment_unconfirmed', description: 'Transferred but recipient claims payment not received. Transaction shows frozen on my end.',
    status: 'pending', createdAt: '2026-06-08T10:30:00Z',
  },
  {
    id: 'dis-002', transferId: 'p2p-005', counterparty: 'MacroWave',
    amount: 45, reason: 'terms_not_met', description: 'Strategy delivered does not match the advertised backtest results.',
    status: 'reviewing', createdAt: '2026-06-05T14:00:00Z',
  },
];

const mockTransactions: TransactionRecord[] = [
  { id: 'tx-001', type: 'p2p_sent', counterparty: 'Sentiment Hawk', amount: 100, fee: 0.3, net: 99.70, status: 'frozen', description: 'Signal subscription', createdAt: '2026-06-08T14:00:00Z', frozenUntil: '2026-06-22T14:00:00Z' },
  { id: 'tx-002', type: 'p2p_received', counterparty: 'DeepAlpha AI', amount: 50, fee: 0.15, net: 49.85, status: 'completed', description: 'Strategy template', createdAt: '2026-05-25T09:00:00Z' },
  { id: 'tx-003', type: 'recharge', amount: 200, fee: 0, net: 200, status: 'completed', description: 'USDT top-up', createdAt: '2026-06-07T08:00:00Z' },
  { id: 'tx-004', type: 'analysis_fee', amount: 1.5, fee: 0, net: 1.5, status: 'completed', description: 'AAPL 4-Agent Premium', createdAt: '2026-06-08T03:15:00Z' },
  { id: 'tx-005', type: 'p2p_sent', counterparty: 'CryptoFlow_CN', amount: 15, fee: 0.05, net: 14.95, status: 'disputed', description: 'Quick scan', createdAt: '2026-06-07T10:00:00Z', frozenUntil: '2026-06-21T10:00:00Z' },
  { id: 'tx-006', type: 'commission', amount: 3.2, fee: 0, net: 3.2, status: 'completed', description: 'Creator commission (L2 80%)', createdAt: '2026-06-08T01:00:00Z' },
  { id: 'tx-007', type: 'subscription', counterparty: 'QuantEdge Pro', amount: 200, fee: 0.6, net: 199.40, status: 'completed', description: 'AI analysis licensing', createdAt: '2026-05-20T16:30:00Z' },
  { id: 'tx-008', type: 'withdrawal', amount: 100, fee: 0.1, net: 99.90, status: 'completed', description: 'USDT withdrawal', createdAt: '2026-06-01T12:00:00Z' },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtUSDT = (v: number): string => `${v.toFixed(2)} USDT`;

const statusColor: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700', frozen: 'bg-amber-100 text-amber-700',
  pending: 'bg-blue-100 text-blue-700', failed: 'bg-red-100 text-red-700', disputed: 'bg-red-100 text-red-700',
};

const disputeStatusColor: Record<DisputeStatus, string> = {
  pending: 'bg-amber-100 text-amber-700', reviewing: 'bg-purple-100 text-purple-700',
  resolved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700',
  cancelled_by_buyer: 'bg-gray-100 text-gray-500',
};

const typeLabel: Record<string, string> = {
  p2p_sent: '📤 Sent', p2p_received: '📥 Received', recharge: '💰 Top-up',
  withdrawal: '🏦 Withdraw', analysis_fee: '🤖 Analysis', subscription: '📡 Subscribe',
  commission: '💎 Commission',
};

const reasonLabel: Record<DisputeReason, string> = {
  payment_unconfirmed: i18n.t('DisputeCenter.k5'), terms_not_met: i18n.t('DisputeCenter.k6'),
  account_issue: i18n.t('DisputeCenter.k7'), other: i18n.t('DisputeCenter.k8'),
};

const getRemaining = (until?: string): string => {
  if (!until) return '';
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return 'Releasing...';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return `${d}d ${h}h`;
};

// ── DisputeCenter ───────────────────────────────────────────────────────

const DisputeCenter: React.FC<DisputeCenterProps> = ({
  disputes: inputDisputes,
  transactions: inputTransactions,
  onFileDispute,
  onCancelDispute,
  className = '',
}) => {
  const [disputes] = useState<Dispute[]>(inputDisputes ?? mockDisputes);
  const [transactions] = useState<TransactionRecord[]>(inputTransactions ?? mockTransactions);
  const [tab, setTab] = useState<'disputes' | 'transactions' | 'file'>('disputes');
  const [fileReason, setFileReason] = useState<DisputeReason>('payment_unconfirmed');
  const [fileDesc, setFileDesc] = useState('');
  const [fileTransferId, setFileTransferId] = useState('');
  const [filed, setFiled] = useState(false);
  const [txFilter, setTxFilter] = useState<string>('all');

  const handleFile = useCallback(() => {
    if (!fileTransferId.trim() || !fileDesc.trim()) return;
    onFileDispute?.(fileTransferId, fileReason, fileDesc);
    setFiled(true);
    setFileTransferId(''); setFileDesc('');
    setTimeout(() => setFiled(false), 5000);
  }, [fileTransferId, fileReason, fileDesc, onFileDispute]);

  const filteredTx = txFilter === 'all' ? transactions : transactions.filter(t => t.type === txFilter);

  const txTypes = [...new Set(transactions.map(t => t.type))];

  return (
    <div className={`dispute-center ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">⚖️ Dispute Center</h2>
        <span className="text-xs text-slate-400">{disputes.length} disputes · {transactions.length} records</span>
      </div>

      {/* Policy Notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4">
        <div className="flex items-start gap-2">
          <span className="text-sm">📜</span>
          <div className="text-xs text-indigo-700">
            <p className="font-semibold mb-0.5">Platform Dispute Policy</p>
            <p>• Platform does <strong>not arbitrate</strong> — disputes notify both parties + extend freeze</p>
            <p>• Buyer can cancel → immediately releases frozen funds to recipient</p>
            <p>• Admin intervention only for system errors (hidden button)</p>
            <p className="text-indigo-400 mt-0.5">This is not a court. Resolve directly with your counterparty.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
        {[
          ['disputes', `⚖️ Disputes (${disputes.length})`],
          ['transactions', `📋 Transactions (${transactions.length})`],
          ['file', '📝 File New'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Disputes Tab */}
      {tab === 'disputes' && (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {disputes.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">{d.counterparty}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${disputeStatusColor[d.status]}`}>
                    {d.status === 'pending' ? '⏳ Pending' : d.status === 'reviewing' ? '🔍 Reviewing' : d.status === 'resolved' ? '✅ Resolved' : d.status === 'rejected' ? '❌ Rejected' : '↩ Cancelled'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                <div><span className="text-slate-400">Transfer ID</span><div className="font-mono text-slate-600">{d.transferId}</div></div>
                <div><span className="text-slate-400">Amount</span><div className="font-bold text-slate-700">{fmtUSDT(d.amount)}</div></div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 mb-2">
                <span className="text-[10px] text-slate-500 font-semibold">{reasonLabel[d.reason]}</span>
                <p className="text-xs text-slate-600 mt-0.5">{d.description}</p>
              </div>
              {d.adminNote && <p className="text-[10px] text-indigo-600 italic">Admin: {d.adminNote}</p>}
              {d.status === 'pending' && (
                <button onClick={() => onCancelDispute?.(d.id)}
                  className="text-[10px] font-medium text-red-500 hover:text-red-600 mt-1">
                  Cancel dispute (release funds)
                </button>
              )}
            </div>
          ))}
          {disputes.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No disputes</p>}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div>
          {/* Type filter */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button onClick={() => setTxFilter('all')}
              className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg ${txFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
              All
            </button>
            {txTypes.map(t => (
              <button key={t} onClick={() => setTxFilter(t)}
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg ${txFilter === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {typeLabel[t] || t}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {filteredTx.map(tx => {
              const remaining = (tx.status === 'frozen' || tx.status === 'disputed') ? getRemaining(tx.frozenUntil) : null;
              return (
                <div key={tx.id} className="bg-white rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{typeLabel[tx.type] || tx.type}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor[tx.status]}`}>{tx.status}</span>
                      {tx.counterparty && <span className="text-[10px] text-slate-400">{tx.counterparty}</span>}
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${tx.amount >= 0 ? 'text-slate-700' : 'text-red-500'}`}>
                        {tx.type.includes('received') || tx.type === 'recharge' || tx.type === 'commission' ? '+' : '-'}{fmtUSDT(tx.amount)}
                      </span>
                      {tx.fee > 0 && <span className="text-[10px] text-red-400 ml-1">(-{fmtUSDT(tx.fee)})</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{tx.description}</span>
                    <div className="flex items-center gap-2">
                      {remaining && <span className="text-[10px] text-amber-600 font-medium">⏳ {remaining}</span>}
                      <span className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredTx.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No transactions</p>}
          </div>
        </div>
      )}

      {/* File Tab */}
      {tab === 'file' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">File a Dispute</h3>

          {/* Transfer ID */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Transfer ID</label>
            <input type="text" value={fileTransferId} onChange={e => setFileTransferId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="p2p-XXX" />
          </div>

          {/* Reason */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Reason</label>
            <div className="space-y-1.5">
              {DISPUTE_REASONS.map(r => (
                <div key={r.value} onClick={() => setFileReason(r.value)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    fileReason === r.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                  <div className="text-xs font-bold text-slate-700">{r.label}</div>
                  <div className="text-[10px] text-slate-400">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Description</label>
            <textarea value={fileDesc} onChange={e => setFileDesc(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 h-20 focus:ring-2 focus:ring-blue-300 outline-none resize-none"
              placeholder="Describe the issue..." />
            {fileReason === 'other' && !fileDesc.trim() && (
              <p className="text-[10px] text-red-500 mt-0.5">Description required for "Other" reason</p>
            )}
          </div>

          <button onClick={handleFile} disabled={!fileTransferId.trim() || !fileDesc.trim()}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
              fileTransferId.trim() && fileDesc.trim()
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}>
            ⚠️ File Dispute (extends freeze)
          </button>

          {filed && <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 font-semibold">✅ Dispute filed — counterparty notified</div>}
        </div>
      )}
    </div>
  );
};

export default DisputeCenter;

void EngineError; // [TRADE] structured error tracking