// @ts-nocheck
// ── R141-M02 WalletStore (Zustand) — 钱包状态管理 ────────────────────────
// PM: balance/transactions/loading + IPC接口骨架
import { create } from 'zustand';

// ═══════════ Types ═══════════

export interface WalletBalance {
  total: number;          // USDT
  available: number;      // available to spend
  frozen: number;         // in orders/withdrawals
  pendingDeposit: number; // unconfirmed deposits
}

export type TransactionType = 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'tip_sent' | 'tip_received' | 'trade_fee' | 'ai_fee' | 'marketplace_buy' | 'marketplace_sell' | 'refund' | 'reward';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  fee: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  description: string;
  counterparty?: string;
  txHash?: string;
  createdAt: number;
  completedAt?: number;
}

export interface DepositRequest {
  chain: 'TRC20' | 'ERC20';
  amount: number;
}

export interface WithdrawRequest {
  address: string;
  chain: 'TRC20' | 'ERC20';
  amount: number;
}

export interface TransferRequest {
  recipientId: string;
  amount: number;
  note?: string;
}

// ═══════════ Store ═══════════

interface WalletStore {
  // State
  balance: WalletBalance;
  transactions: WalletTransaction[];
  loading: boolean;
  error: string | null;

  // Balance
  setBalance: (b: WalletBalance) => void;
  updateBalance: (partial: Partial<WalletBalance>) => void;

  // Transactions
  setTransactions: (txs: WalletTransaction[]) => void;
  addTransaction: (tx: WalletTransaction) => void;

  // Loading
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;

  // IPC methods (skeleton — actual IPC calls via window.api.wallet)
  fetchBalance: () => Promise<void>;
  fetchTransactions: (params?: { page?: number; limit?: number; type?: TransactionType }) => Promise<void>;
  deposit: (req: DepositRequest) => Promise<{ success: boolean; message?: string }>;
  withdraw: (req: WithdrawRequest) => Promise<{ success: boolean; message?: string }>;
  transfer: (req: TransferRequest) => Promise<{ success: boolean; message?: string }>;
}

// ═══════════ Helpers ═══════════

// Try IPC, fallback to mock
async function ipcOrMock<T>(channel: string, params: any, mockData: T): Promise<T> {
  try {
    // @ts-ignore — window.api is exposed via contextBridge
    if (typeof window !== 'undefined' && (window as any).api?.wallet) {
      // @ts-ignore
      return await (window as any).api.wallet.invoke(channel, params);
    }
  } catch {
    // IPC unavailable → fallback to mock
  }
  return mockData;
}

// ═══════════ Default balance ═══════════

const DEFAULT_BALANCE: WalletBalance = {
  total: 0,
  available: 0,
  frozen: 0,
  pendingDeposit: 0,
};

// ═══════════ Create store ═══════════

export const useWalletStore = create<WalletStore>((set, get) => ({
  balance: DEFAULT_BALANCE,
  transactions: [],
  loading: false,
  error: null,

  setBalance: (b) => set({ balance: b }),
  updateBalance: (partial) => set((s) => ({ balance: { ...s.balance, ...partial } })),

  setTransactions: (txs) => set({ transactions: txs }),
  addTransaction: (tx) => set((s) => ({ transactions: [tx, ...s.transactions].slice(0, 500) })),

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),

  // ── IPC methods ──

  fetchBalance: async () => {
    set({ loading: true, error: null });
    try {
      const data = await ipcOrMock('wallet:getBalance', {}, {
        total: 12580.50,
        available: 10234.80,
        frozen: 2345.70,
        pendingDeposit: 0,
      });
      set({ balance: data, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch balance', loading: false });
    }
  },

  fetchTransactions: async (params) => {
    set({ loading: true, error: null });
    try {
      const data = await ipcOrMock('wallet:getTransactions', params || {}, [
        { id: 'tx1', type: 'deposit', amount: 5000, fee: 0, balanceBefore: 0, balanceAfter: 5000, status: 'completed', description: 'TRC-20充值', txHash: '0xabc123...', createdAt: Date.now() - 86400000, completedAt: Date.now() - 86300000 },
        { id: 'tx2', type: 'trade_fee', amount: -5, fee: 0, balanceBefore: 5000, balanceAfter: 4995, status: 'completed', description: 'BTC-USDT 交易手续费', createdAt: Date.now() - 43200000 },
        { id: 'tx3', type: 'transfer_out', amount: -1000, fee: 3, balanceBefore: 4995, balanceAfter: 3992, status: 'completed', description: '转账给用户@trader123', counterparty: 'trader123', createdAt: Date.now() - 21600000 },
        { id: 'tx4', type: 'ai_fee', amount: -1, fee: 0, balanceBefore: 3992, balanceAfter: 3991, status: 'completed', description: 'AI回测解读', createdAt: Date.now() - 3600000 },
        { id: 'tx5', type: 'tip_received', amount: 50, fee: 0, balanceBefore: 3991, balanceAfter: 4041, status: 'completed', description: '收到打赏 from @whale_tracker', counterparty: 'whale_tracker', createdAt: Date.now() - 1800000 },
        { id: 'tx6', type: 'withdraw', amount: -500, fee: 2, balanceBefore: 4041, balanceAfter: 3539, status: 'pending', description: '提现至 TRC-20', txHash: '0xdef456...', createdAt: Date.now() - 600000 },
      ]);
      set({ transactions: data, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch transactions', loading: false });
    }
  },

  deposit: async (req) => {
    set({ loading: true, error: null });
    try {
      const result = await ipcOrMock('wallet:deposit', req, { success: true, message: `充值 ${req.amount} USDT (${req.chain}) 处理中，等待区块确认` });
      if (result.success) {
        get().updateBalance({ pendingDeposit: get().balance.pendingDeposit + req.amount });
      }
      set({ loading: false });
      return result;
    } catch (err: any) {
      set({ error: err?.message || 'Deposit failed', loading: false });
      return { success: false, message: err?.message };
    }
  },

  withdraw: async (req) => {
    set({ loading: true, error: null });
    try {
      const result = await ipcOrMock('wallet:withdraw', req, { success: true, message: '提现请求已提交' });
      set({ loading: false });
      return result;
    } catch (err: any) {
      set({ error: err?.message || 'Withdraw failed', loading: false });
      return { success: false, message: err?.message };
    }
  },

  transfer: async (req) => {
    set({ loading: true, error: null });
    try {
      const result = await ipcOrMock('wallet:transfer', req, { success: true, message: '转账成功' });
      set({ loading: false });
      return result;
    } catch (err: any) {
      set({ error: err?.message || 'Transfer failed', loading: false });
      return { success: false, message: err?.message };
    }
  },
}));
