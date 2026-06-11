/**
 * SettlementTimeline — R103 M-01: Settlement history with filter + pagination + CSV export
 *
 * Features:
 * - Timeline view of all point changes (top-up/trade fee/P2P/withdraw)
 * - Filter by type (all/top-up/fee/P2P/withdraw)
 * - Pagination (20 per page)
 * - CSV export functionality
 * - Color-coded amounts (green = income, red = expense)
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCredits, type CreditTransaction, type CreditFilter } from '@/hooks/useCredits';
import { formatTime } from '@/utils/formatTime';
import i18n from '../../i18n';

const FILTER_TABS: { key: CreditFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'topup', label: 'Top-up', icon: '💳' },
  { key: 'fee', label: 'Trade Fee', icon: '💸' },
  { key: 'p2p', label: 'P2P', icon: '🤝' },
  { key: 'withdraw', label: 'Withdraw', icon: '🏧' },
];

const PAGE_SIZE = 20;

export default function SettlementTimeline() {
  const { t: _t } = useTranslation();
  const { transactions } = useCredits();

  const [filter, setFilter] = useState<CreditFilter>('all');
  const [page, setPage] = useState(0);

  // Listen for export CSV event
  useEffect(() => {
    const handleExport = () => exportCSV();
    window.addEventListener('export-settlement-csv', handleExport);
    return () => window.removeEventListener('export-settlement-csv', handleExport);
  });

  // Filter transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (filter === 'all') return true;
      if (filter === 'topup') return tx.type === 'topup';
      if (filter === 'withdraw') return tx.type === 'withdraw';
      if (filter === 'fee') return tx.type === 'fee' || tx.type === 'expense';
      if (filter === 'p2p') return tx.type === 'p2p';
      if (filter === 'income') return tx.amount > 0;
      if (filter === 'expense') return tx.amount < 0;
      return true;
    });
  }, [transactions, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredTxs.length / PAGE_SIZE);
  const paginatedTxs = filteredTxs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // CSV export
  const exportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Source', 'Amount (USDT)', 'Balance After', 'Currency', 'Original Amount'];
    const rows = filteredTxs.map(tx => [
      new Date(tx.timestamp).toISOString(),
      tx.type,
      tx.source,
      tx.amount.toFixed(6),
      tx.balanceAfter.toFixed(6),
      tx.currency || '',
      tx.originalAmount?.toFixed(2) || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `settlement-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [filter]);

  const typeIcons: Record<string, string> = {
    topup: '💳',
    income: '📥',
    expense: '📤',
    fee: '💸',
    p2p: '🤝',
    withdraw: '🏧',
  };

  return (
    <div className="p-4">
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/50'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-gray-500 text-xs self-center">
          {filteredTxs.length} {i18n.t('credits.records') || 'records'}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {paginatedTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-3xl mb-2">📭</span>
            <span className="text-sm">{i18n.t('credits.noTransactions') || 'No transactions yet'}</span>
          </div>
        ) : (
          paginatedTxs.map((tx, idx) => (
            <TimelineRow key={tx.id} tx={tx} isFirst={idx === 0} typeIcon={typeIcons[tx.type] || '💰'} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            ← {i18n.t('common.prev') || 'Prev'}
          </button>
          <span className="text-xs text-gray-500">
            {i18n.t('credits.page') || 'Page'} {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {i18n.t('common.next') || 'Next'} →
          </button>
        </div>
      )}
    </div>
  );
}

// Timeline row component
function TimelineRow({ tx, isFirst, typeIcon }: { tx: CreditTransaction; isFirst: boolean; typeIcon: string }) {
  const isPositive = tx.amount > 0;
  const amountColor = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '+' : '';

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isFirst && (
        <div className="absolute left-4 top-0 w-px h-full bg-white/5" />
      )}

      {/* Timeline dot */}
      <div className="relative z-10 w-8 h-8 rounded-full bg-[#0f0f18] border-2 border-white/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm">{typeIcon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{tx.source}</div>
            <div className="text-gray-500 text-xs mt-0.5">
              {formatTime(tx.timestamp)}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`${amountColor} text-sm font-mono font-bold tabular-nums`}>
              {sign}{tx.amount.toFixed(6)}
            </div>
            <div className="text-gray-600 text-[10px] font-mono tabular-nums">
              Bal: {tx.balanceAfter.toFixed(6)}
            </div>
          </div>
        </div>
        {tx.currency && tx.originalAmount && (
          <div className="text-gray-600 text-xs mt-1">
            {tx.originalAmount.toFixed(2)} {tx.currency} → USDT
          </div>
        )}
      </div>
    </div>
  );
}
