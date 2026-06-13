// ── R150 ML #13 — useBalanceCheck (余额检查拦截器) ─────────────────────
// PM: 2h — Before any purchase/AI: check balance → insufficient → guide to top-up
//
// Usage:
//   const { checkBalance, deductFee } = useBalanceCheck();
//   await checkBalance(5, 'AI画线需5 USDT, 请先充值', () => navigateToWallet());
//   await deductFee(1, 'AI画线扣费', () => { /* do AI */ });

import { useState, useCallback } from 'react';
import { message, Modal } from 'antd';
import { useAppStore } from '@/stores/appStore';
import type { SidebarView } from '@/lib/types';

// ═══════════ Types ═══════════

export interface BalanceCheckResult {
  sufficient: boolean;
  balance: number;
  required: number;
  shortfall: number;
}

// ═══════════ Default balance (mock — real balance from walletStore) ══════

const DEFAULT_BALANCE = 10234.80;

// ═══════════ Hook ═══════════

export default function useBalanceCheck(initialBalance?: number) {
  const [balance, setBalance] = useState(initialBalance ?? DEFAULT_BALANCE);
  const setView = useAppStore((s) => s.setView);

  /** Check if balance is sufficient. If not, show a modal with navigation to Wallet. */
  const checkBalance = useCallback(
    (required: number, actionLabel: string): BalanceCheckResult => {
      const sufficient = balance >= required;
      const shortfall = Math.max(required - balance, 0);

      if (!sufficient) {
        Modal.confirm({
          title: '余额不足',
          content: (
            <div>
              <p>
                {actionLabel} 需要 <strong>{required.toFixed(2)} USDT</strong>
              </p>
              <p>
                当前余额: <strong style={{ color: '#ef4444' }}>{balance.toFixed(2)} USDT</strong>
                {' · '}
                还差: <strong style={{ color: '#f59e0b' }}>{shortfall.toFixed(2)} USDT</strong>
              </p>
              <p style={{ color: '#8b949e', fontSize: 12 }}>
                前往钱包页充值 USDT (TRC-20/ERC-20 充值免费)
              </p>
            </div>
          ),
          okText: '前往钱包',
          cancelText: '取消',
          onOk: () => {
            setView('wallet' as SidebarView);
          },
          centered: true,
        });
      }

      return { sufficient, balance, required, shortfall };
    },
    [balance, setView],
  );

  /** Deduct fee from balance and optionally execute callback. */
  const deductFee = useCallback(
    async (amount: number, description: string, onSuccess?: () => void): Promise<boolean> => {
      if (balance < amount) {
        message.error(`余额不足: 需${amount}U, 当前${balance.toFixed(2)}U`);
        checkBalance(amount, description);
        return false;
      }

      setBalance((p) => p - amount);

      // Show lightweight toast (R150 #14: 2s auto-dismiss)
      message.success({
        content: `已扣 ${amount} USDT — ${description}`,
        duration: 2,
        icon: '💰',
      });

      onSuccess?.();
      return true;
    },
    [balance, checkBalance],
  );

  /** Manually set balance (e.g., after top-up via IPC) */
  const setBalanceManually = useCallback((val: number) => setBalance(val), []);

  return { balance, checkBalance, deductFee, setBalance: setBalanceManually };
}
