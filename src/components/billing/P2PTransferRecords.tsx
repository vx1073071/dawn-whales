/**
 * P2PTransferRecords — R104 M-01: P2P transfer history
 *
 * Shows:
 * - Sender / Receiver / Amount / Fee / Time
 * - Filter: sent / received / all
 * - Pagination 20/page
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCredits, type CreditTransaction } from '@/hooks/useCredits';
import { formatDateTime } from '@/utils/formatTime';
import i18n from '../../i18n';

type P2PFilter = 'all' | 'sent' | 'received';

const FILTERS: { key: P2PFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'sent', label: 'Sent', icon: '📤' },
  { key: 'received', label: 'Received', icon: '📥' },
];

const PAGE_SIZE = 20;

function P2PRow({ tx }: { tx: CreditTransaction }) {
  // Determine if sent or received
  const isSent = tx.amount < 0;
  const arrow = isSent ? '📤' : '📥';
  const amountColor = isSent ? 'text-red-400' : 'text-green-400';
  const sign = isSent ? '' : '+';

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      {/* Direction */}
      <span className="text-lg w-8 text-center">{arrow}</span>

      {/* Parties */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium truncate">
            {isSent ? (i18n.t('credits.to') || 'To') : (i18n.t('credits.from') || 'From')}
          </span>
          <span className="text-gray-300 text-sm truncate">{tx.source}</span>
        </div>
        <div className="text-gray-500 text-xs mt-0.5">
          {formatDateTime(tx.timestamp)}
        </div>
      </div>

      {/* Amount + Fee */}
      <div className="text-right flex-shrink-0">
        <div className={`${amountColor} text-sm font-mono font-bold tabular-nums`}>
          {sign}{tx.amount.toFixed(6)}
        </div>
        {tx.fee !== undefined && tx.fee > 0 && (
          <div className="text-gray-500 text-[10px] font-mono">
            {i18n.t('credits.fee') || 'Fee'}: {tx.fee.toFixed(6)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function P2PTransferRecords() {
  const { t: _t } = useTranslation();
  const { transactions } = useCredits();

  const [filter, setFilter] = useState<P2PFilter>('all');
  const [page, setPage] = useState(0);

  const p2pTxs = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'p2p')
      .filter(tx => {
        if (filter === 'all') return true;
        if (filter === 'sent') return tx.amount < 0;
        if (filter === 'received') return tx.amount > 0;
        return true;
      });
  }, [transactions, filter]);

  const totalPages = Math.ceil(p2pTxs.length / PAGE_SIZE);
  const paginatedTxs = p2pTxs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Summary stats
  const summary = useMemo(() => {
    const sent = p2pTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const received = p2pTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const fees = p2pTxs.reduce((s, t) => s + (t.fee || 0), 0);
    return { sent, received, fees, count: p2pTxs.length };
  }, [p2pTxs]);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <span>🤝</span> {i18n.t('credits.p2pTransfers') || 'P2P Transfers'}
        </h2>
        {/* Summary */}
        <div className="flex gap-4 mt-2 text-xs">
          <span className="text-gray-400">
            {i18n.t('credits.sent') || 'Sent'}: <span className="text-red-400 font-mono">{summary.sent.toFixed(4)}</span>
          </span>
          <span className="text-gray-400">
            {i18n.t('credits.received') || 'Received'}: <span className="text-green-400 font-mono">{summary.received.toFixed(4)}</span>
          </span>
          <span className="text-gray-400">
            {i18n.t('credits.fees') || 'Fees'}: <span className="text-yellow-400 font-mono">{summary.fees.toFixed(4)}</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex border-b border-white/5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(0); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              filter === f.key
                ? 'text-[#D4A853] border-[#D4A853]'
                : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.02]'
            }`}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center px-4 text-[10px] text-gray-500">
          {summary.count} {i18n.t('credits.records') || 'records'}
        </div>
      </div>

      {/* List */}
      <div className="min-h-[120px] max-h-[350px] overflow-y-auto">
        {paginatedTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <span className="text-2xl mb-2">🤝</span>
            <span className="text-sm">{i18n.t('credits.noP2P') || 'No P2P transfers yet'}</span>
          </div>
        ) : (
          paginatedTxs.map(tx => <P2PRow key={tx.id} tx={tx} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-white/5"
          >
            ← {i18n.t('common.prev') || 'Prev'}
          </button>
          <span className="text-xs text-gray-500">
            {i18n.t('credits.page') || 'Page'} {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-white/5"
          >
            {i18n.t('common.next') || 'Next'} →
          </button>
        </div>
      )}
    </div>
  );
}
