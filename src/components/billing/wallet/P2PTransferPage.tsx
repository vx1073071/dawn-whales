/**
 * @deprecated — REPLACED by v17.6 WalletFullPage internal-transfer (wallet/, R143)
 * v17.6: P2P removed → user-to-user transfers only (0.3% sender + 0.3% receiver).
 * No negotiate/release/dispute flow. All billing/wallet/ deprecated. | [DEPRECATED v17.6]
 *
 * Original (R62 v1.5.0): P2PTransferPage — P2P USDT points transfer
 */

import React, { useState, useCallback, useMemo } from 'react';
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export type TransferStatus = 'frozen' | 'released' | 'disputed' | 'cancelled';

export interface P2PTransfer {
  id: string;
  counterparty: string;
  counterpartyId: string;
  direction: 'sent' | 'received';
  amount: number;
  fee: number;
  netAmount: number;
  status: TransferStatus;
  note: string;
  createdAt: string;
  frozenUntil: string;
  releasedAt?: string;
  disputeReason?: string;
}

export interface Recipient {
  id: string;
  name: string;
  avatar: string;
  level: 'L1' | 'L2' | 'L3';
  recentTransfers: number;
}

export interface P2PTransferPageProps {
  balance?: number;
  transfers?: P2PTransfer[];
  recipients?: Recipient[];
  onTransfer?: (recipientId: string, amount: number, note: string) => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockRecipients: Recipient[] = [
  { id: 'r-01', name: 'QuantEdge Pro', avatar: '🦊', level: 'L3', recentTransfers: 12 },
  { id: 'r-02', name: 'DeepAlpha AI', avatar: '🤖', level: 'L2', recentTransfers: 5 },
  { id: 'r-03', name: 'Sentiment Hawk', avatar: '🦅', level: 'L3', recentTransfers: 28 },
  { id: 'r-04', name: 'CryptoFlow_CN', avatar: '🐲', level: 'L1', recentTransfers: 1 },
  { id: 'r-05', name: 'MacroWave', avatar: '🌊', level: 'L1', recentTransfers: 0 },
];

const mockTransfers: P2PTransfer[] = [
  {
    id: 'p2p-001', counterparty: 'Sentiment Hawk', counterpartyId: 'r-03',
    direction: 'sent', amount: 100, fee: 0.3, netAmount: 99.70,
    status: 'frozen', note: 'Signal subscription fee',
    createdAt: '2026-06-08T14:00:00Z', frozenUntil: '2026-06-22T14:00:00Z',
  },
  {
    id: 'p2p-002', counterparty: 'DeepAlpha AI', counterpartyId: 'r-02',
    direction: 'received', amount: 50, fee: 0.15, netAmount: 49.85,
    status: 'released', note: 'Strategy template purchase',
    createdAt: '2026-05-25T09:00:00Z', frozenUntil: '2026-06-08T09:00:00Z', releasedAt: '2026-06-08T09:00:01Z',
  },
  {
    id: 'p2p-003', counterparty: 'QuantEdge Pro', counterpartyId: 'r-01',
    direction: 'sent', amount: 200, fee: 0.6, netAmount: 199.40,
    status: 'released', note: 'AI analysis licensing',
    createdAt: '2026-05-20T16:30:00Z', frozenUntil: '2026-06-03T16:30:00Z', releasedAt: '2026-06-03T16:30:02Z',
  },
  {
    id: 'p2p-004', counterparty: 'CryptoFlow_CN', counterpartyId: 'r-04',
    direction: 'received', amount: 15, fee: 0.05, netAmount: 14.95,
    status: 'disputed', note: 'Quick scan purchase',
    createdAt: '2026-06-07T10:00:00Z', frozenUntil: '2026-06-21T10:00:00Z',
    disputeReason: i18n.t('P2PTransferPage.k0'),
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const fmtUSDT = (v: number): string => `${v.toFixed(2)} USDT`;
const fmtPct = (v: number): string => `-${v.toFixed(1)}%`;

const statusBadge: Record<TransferStatus, { label: string; color: string; icon: string }> = {
  frozen: { label: 'Frozen', color: 'bg-amber-100 text-amber-700', icon: '🔒' },
  released: { label: 'Released', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  disputed: { label: 'Disputed', color: 'bg-red-100 text-red-700', icon: '⚠️' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: '✕' },
};

const getRemaining = (frozenUntil: string): string => {
  const now = Date.now();
  const until = new Date(frozenUntil).getTime();
  const diff = until - now;
  if (diff <= 0) return 'Releasing...';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h`;
};

const levelBadge: Record<string, string> = {
  L1: 'bg-gray-100 text-gray-600', L2: 'bg-blue-100 text-blue-600', L3: 'bg-purple-100 text-purple-700',
};

// ── P2PTransferPage ─────────────────────────────────────────────────────

const P2PTransferPage: React.FC<P2PTransferPageProps> = ({
  balance: inputBalance = 285.50,
  transfers: inputTransfers,
  recipients: inputRecipients,
  onTransfer,
  className = '',
}) => {
  const [balance] = useState(inputBalance);
  const [transfers] = useState<P2PTransfer[]>(inputTransfers ?? mockTransfers);
  const [recipients] = useState<Recipient[]>(inputRecipients ?? mockRecipients);
  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [search, setSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const amt = parseFloat(amount) || 0;
  const fee = amt * 0.003;
  const net = amt - fee;
  const isValid = selectedRecipient && amt > 0 && amt <= balance;
  const warningMsg = amt > balance ? 'Insufficient balance' : amt > 1000 ? 'Large transfer (>1000 USDT) — PM will be notified' : '';

  const filteredRecipients = useMemo(() => {
    if (!search.trim()) return recipients;
    const q = search.toLowerCase();
    return recipients.filter(r => r.name.toLowerCase().includes(q));
  }, [recipients, search]);

  const handleTransfer = useCallback(() => {
    if (!selectedRecipient || amt <= 0 || amt > balance) return;
    onTransfer?.(selectedRecipient.id, amt, note);
    setConfirming(false);
    setSuccessMsg(`Sent ${fmtUSDT(net)} to ${selectedRecipient.name}`);
    setAmount(''); setNote(''); setSelectedRecipient(null);
    setTimeout(() => setSuccessMsg(''), 5000);
  }, [selectedRecipient, amt, balance, note, net, onTransfer]);

  return (
    <div className={`p2p-transfer-page ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800">💸 P2P Transfer</h2>
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">0.3% fee</span>
        </div>
        <div className="text-sm font-bold text-slate-700">
          Balance: <span className="text-blue-600">{fmtUSDT(balance)}</span>
        </div>
      </div>

      {/* Fee Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
        <div className="flex items-start gap-2">
          <span className="text-sm">ℹ️</span>
          <div className="text-xs text-amber-700">
            <p className="font-semibold mb-0.5">P2P Transfer Rules (v15)</p>
            <p>• Both sender & receiver pay <strong>0.3%</strong> fee (platform)</p>
            <p>• All transfers are <strong>frozen for 14 days</strong> before release</p>
            <p>• Disputes extend freeze until resolved</p>
            <p className="text-amber-500 mt-0.5">⚠ No Stripe/Credit Card — USDT points only</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
        {[
          ['send', '📤 Send'],
          ['history', '📋 History'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Send Tab */}
      {tab === 'send' && (
        <div>
          {/* Search recipient */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Recipient</label>
            <input type="text" placeholder="Search creator..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-300 outline-none" />
          </div>

          {/* Recipient list */}
          {!selectedRecipient && (
            <div className="space-y-1.5 mb-3 max-h-[200px] overflow-y-auto">
              {filteredRecipients.map(r => (
                <div key={r.id} onClick={() => setSelectedRecipient(r)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{r.avatar}</span>
                    <div>
                      <div className="text-sm font-bold text-slate-700">{r.name}</div>
                      <div className="text-[10px] text-slate-400">{r.recentTransfers} recent transfers</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${levelBadge[r.level]}`}>{r.level}</span>
                </div>
              ))}
              {filteredRecipients.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No recipients found</p>
              )}
            </div>
          )}

          {/* Selected recipient */}
          {selectedRecipient && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{selectedRecipient.avatar}</span>
                <div>
                  <div className="text-sm font-bold text-slate-700">{selectedRecipient.name}</div>
                  <div className="text-[10px] text-slate-500">{selectedRecipient.level} creator</div>
                </div>
              </div>
              <button onClick={() => setSelectedRecipient(null)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
            </div>
          )}

          {/* Amount */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Amount (USDT)</label>
            <input type="number" step="0.01" min="0" value={amount}
              onChange={e => setAmount(e.target.value)}
              className={`w-full text-sm border rounded-lg px-3 py-2.5 font-mono focus:ring-2 outline-none ${
                amt > balance ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-slate-200 focus:ring-blue-300'
              }`} placeholder="0.00" />
            {warningMsg && <p className={`text-[10px] mt-0.5 ${amt > balance ? 'text-red-500' : 'text-amber-600'}`}>{warningMsg}</p>}
          </div>

          {/* Note */}
          <div className="mb-3">
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-300 outline-none"
              placeholder="e.g. Signal subscription" />
          </div>

          {/* Fee preview */}
          {amt > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 mb-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-bold">{fmtUSDT(amt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fee (0.3% both sides)</span>
                  <span className="font-mono text-red-500">{fmtPct(0.3)} ({fmtUSDT(fee)})</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="font-semibold">Recipient gets</span>
                  <span className="font-mono font-bold text-slate-700">{fmtUSDT(net)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Freeze period</span>
                  <span className="font-mono text-amber-600 font-semibold">14 days</span>
                </div>
              </div>
            </div>
          )}

          {/* Send button */}
          <button onClick={() => setConfirming(true)} disabled={!isValid}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
              isValid ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}>
            {isValid ? `💸 Send ${fmtUSDT(net)} to ${selectedRecipient?.name}` : 'Select recipient and enter amount'}
          </button>

          {successMsg && <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 font-semibold">✅ {successMsg}</div>}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {transfers.map(tx => {
            const remaining = tx.status === 'frozen' || tx.status === 'disputed' ? getRemaining(tx.frozenUntil) : null;
            const badge = statusBadge[tx.status];
            return (
              <div key={tx.id} className={`rounded-xl border p-4 ${tx.direction === 'sent' ? 'bg-rose-50/30 border-rose-100' : 'bg-emerald-50/30 border-emerald-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{tx.counterparty}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      tx.direction === 'sent' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {tx.direction === 'sent' ? '↑ Sent' : '↓ Received'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${badge.color}`}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                  <div><span className="text-slate-400">Amount</span><div className="font-bold text-slate-700">{fmtUSDT(tx.amount)}</div></div>
                  <div><span className="text-slate-400">Fee (0.3%)</span><div className="text-red-500">{fmtUSDT(tx.fee)}</div></div>
                  <div><span className="text-slate-400">Net</span><div className="font-bold text-slate-700">{fmtUSDT(tx.netAmount)}</div></div>
                </div>

                {remaining && (
                  <div className="bg-amber-50 rounded-lg px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-amber-700 font-medium">⏳ Freeze remaining</span>
                    <span className="text-[10px] font-bold text-amber-800">{remaining}</span>
                  </div>
                )}

                {tx.disputeReason && (
                  <div className="bg-red-50 rounded-lg px-3 py-1.5 mt-1">
                    <span className="text-[10px] text-red-600">⚠ Disputed: {tx.disputeReason}</span>
                  </div>
                )}

                {tx.note && <p className="text-[10px] text-slate-400 mt-1.5">Note: {tx.note}</p>}
              </div>
            );
          })}
          {transfers.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No transfers yet</p>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {confirming && selectedRecipient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">Confirm P2P Transfer</h3>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">To</span><span className="font-bold">{selectedRecipient.name} ({selectedRecipient.level})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-mono font-bold">{fmtUSDT(amt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Fee (0.3%)</span><span className="font-mono text-red-500">{fmtUSDT(fee)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-semibold">Recipient gets</span><span className="font-mono font-bold">{fmtUSDT(net)}</span></div>
              <div className="flex justify-between"><span className="text-amber-600 font-medium text-xs">⏳ Frozen 14 days</span><span className="text-xs text-slate-400">Releases {new Date(Date.now() + 14*86400000).toLocaleDateString()}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl">Cancel</button>
              <button onClick={handleTransfer} className="flex-1 text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 px-4 py-2.5 rounded-xl shadow-md">Confirm Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default P2PTransferPage;
