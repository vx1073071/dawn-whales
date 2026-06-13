// ── R150 ML #14 — FeeDeductionToast (扣费轻量反馈) ──────────────────────
// PM: 2h — "已扣X USDT" 2秒消失, 可点查看
// v17.6: Silent deduction ≠ invisible. User MUST see every deduction.
//
// Usage (from useBalanceCheck hook):
//   import useBalanceCheck from '@/hooks/useBalanceCheck';
//   const { deductFee } = useBalanceCheck();
//   await deductFee(1, 'AI画线', () => { /* do work */ });
//
// Or standalone:
//   import { showFeeToast } from '@/components/billing/FeeDeductionToast';
//   showFeeToast(1, 'AI画线');

import { message } from 'antd';

export function showFeeToast(amount: number, description: string, duration = 2) {
  message.success({
    content: `已扣 ${amount} USDT — ${description}`,
    duration,
    icon: '💰',
  });
}

export function showFeeRefundToast(amount: number, description: string) {
  message.info({
    content: `已退费 ${amount} USDT — ${description} 失败`,
    duration: 3,
    icon: '↩️',
  });
}

export function showInsufficientToast(shortfall: number, description: string) {
  message.warning({
    content: `余额不足 — 还差 ${shortfall.toFixed(2)} USDT — ${description}`,
    duration: 4,
    icon: '⚠️',
  });
}
