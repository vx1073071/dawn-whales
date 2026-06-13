/**
 * @deprecated — Replaced by WalletFullPage transaction history (wallet/, R143).
 * All billing/ components deprecated. Refer to MEMORY.md v17.6. | [DEPRECATED v17.6]
 */
/**
 * CreditsHistoryPage — USDT credits transaction history
 * 
 * R102 M-01: Settings → Credits History
 * - Tabs: All / Income / Expense / P2P
 * - Each entry: time + source + amount + balance after
 * - Pagination (20 per page)
 * - Color-coded amounts (green = income, red = expense)
 */

import { useTranslation } from 'react-i18next';
import { useCredits, type CreditFilter, type CreditTransaction } from '@/hooks/useCredits';
import { formatTime } from '@/utils/formatTime';

const TABS: { key: CreditFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'income', label: 'Income', icon: '📥' },
  { key: 'expense', label: 'Expense', icon: '📤' },
  { key: 'p2p', label: 'P2P', icon: '🤝' },
];

function TxRow({ tx }: { tx: CreditTransaction }) {
  const isPositive = tx.amount > 0;
  const amountColor = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '+' : '';

  const typeIcon: Record<string, string> = {
    income: '📥',
    expense: '📤',
    fee: '💸',
    p2p: '🤝',
    withdraw: '🏧',
    topup: '💳',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      {/* Type icon */}
      <span className="text-lg w-8 text-center">{typeIcon[tx.type] || '💰'}</span>

      {/* Source & time */}
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm truncate">{tx.source}</div>
        <div className="text-gray-500 text-xs">
          {formatTime(tx.timestamp)}
          {tx.currency && tx.originalAmount && (
            <span className="ml-2 text-gray-600">
              {tx.originalAmount.toFixed(2)} {tx.currency}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <div className={`${amountColor} text-sm font-mono tabular-nums font-bold`}>
          {sign}{tx.amount.toFixed(6)}
        </div>
        <div className="text-gray-500 text-[10px] font-mono tabular-nums">
          Bal: {tx.balanceAfter.toFixed(6)}
        </div>
      </div>
    </div>
  );
}

export default function CreditsHistoryPage() {
  const { t: _t } = useTranslation();
  const {
    balance,
    filteredTxs,
    totalFiltered,
    filter,
    setFilter,
    page,
    setPage,
    totalPages,
  } = useCredits();

  // Sync local tab with hook filter
  const activeTab = filter;

  const handleTabChange = (tab: CreditFilter) => {
    setFilter(tab);
    setPage(0);
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <span>💰</span> USDT Credits
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Balance:</span>
            <span className="text-[#D4A853] font-bold font-mono tabular-nums text-sm">
              {balance.toFixed(6)} USDT
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'text-[#D4A853] border-[#D4A853]'
                : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.02]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center px-4 text-[10px] text-gray-500">
          {totalFiltered} records
        </div>
      </div>

      {/* Transaction list */}
      <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
        {filteredTxs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-3xl mb-2">📭</span>
            <span className="text-sm">No transactions yet</span>
            <span className="text-xs mt-1">Fee deductions will appear here</span>
          </div>
        ) : (
          filteredTxs.map(tx => <TxRow key={tx.id} tx={tx} />)
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
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-white/5"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
