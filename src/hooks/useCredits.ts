/**
 * useCredits hook — USDT credits balance + transaction history
 * 
 * R102 M-01: Credits system UI
 * - Balance with 6 decimal precision
 * - Transaction history with filters (all/income/expense/P2P)
 * - LocalStorage persistence
 */

import { useState, useCallback, useEffect } from 'react';

export type CreditTxType = 'income' | 'expense' | 'p2p' | 'fee' | 'withdraw' | 'topup';

export interface CreditTransaction {
  id: string;
  type: CreditTxType;
  amount: number; // positive = income, negative = expense
  balanceAfter: number;
  source: string; // e.g. "Trade HK.0700", "P2P Transfer", "Top-up"
  timestamp: number;
  fee?: number; // fee amount if applicable
  currency?: string; // original currency before conversion
  originalAmount?: number; // original amount before conversion
  txHash?: string; // for on-chain transactions
}

interface CreditsState {
  balance: number;
  transactions: CreditTransaction[];
}

const STORAGE_KEY = 'TradingEasy-credits';
const INITIAL_BALANCE = 100.0; // 100 USDT starting credits for demo

function loadState(): CreditsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.balance === 'number' && Array.isArray(parsed.transactions)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { balance: INITIAL_BALANCE, transactions: [] };
}

function saveState(state: CreditsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export type CreditFilter = 'all' | 'income' | 'expense' | 'p2p' | 'fee' | 'withdraw' | 'topup';

export function useCredits() {
  const [state, setState] = useState<CreditsState>(loadState);
  const [filter, setFilter] = useState<CreditFilter>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setState(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addTransaction = useCallback((tx: Omit<CreditTransaction, 'id' | 'balanceAfter' | 'timestamp'>) => {
    setState(prev => {
      const newBalance = prev.balance + tx.amount;
      const newTx: CreditTransaction = {
        ...tx,
        id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        balanceAfter: newBalance,
        timestamp: Date.now(),
      };
      return {
        balance: newBalance,
        transactions: [newTx, ...prev.transactions],
      };
    });
  }, []);

  const deductFee = useCallback((feeUSDT: number, source: string, currency?: string, originalAmount?: number) => {
    addTransaction({
      type: 'fee',
      amount: -feeUSDT,
      source,
      currency,
      originalAmount,
    });
  }, [addTransaction]);

  // Filtered transactions
  const filteredTxs = state.transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'income') return tx.amount > 0;
    if (filter === 'expense') return tx.amount < 0 && tx.type !== 'p2p';
    if (filter === 'p2p') return tx.type === 'p2p';
    if (filter === 'fee') return tx.type === 'fee';
    if (filter === 'withdraw') return tx.type === 'withdraw';
    if (filter === 'topup') return tx.type === 'topup';
    return true;
  });

  // Paginated
  const paginatedTxs = filteredTxs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredTxs.length / pageSize);

  return {
    balance: state.balance,
    transactions: state.transactions,
    filteredTxs: paginatedTxs,
    totalFiltered: filteredTxs.length,
    filter,
    setFilter,
    page,
    setPage,
    totalPages,
    pageSize,
    addTransaction,
    deductFee,
  };
}
