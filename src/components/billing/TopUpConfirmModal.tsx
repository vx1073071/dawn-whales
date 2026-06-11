/**
 * TopUpConfirmModal — R103 M-01: Confirmation dialog for USDT top-up
 *
 * Shows:
 * - Current exchange rate
 * - Fiat amount → USDT calculation
 * - Rate source indicator
 * - Confirm/Cancel buttons
 */

import { useEffect, useRef } from 'react';
import i18n from '../../i18n';

interface TopUpConfirmModalProps {
  currency: string;
  amount: number;
  rate: number;
  estimatedUSDT: number;
  rateSource: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function TopUpConfirmModal({
  currency,
  amount,
  rate,
  estimatedUSDT,
  rateSource,
  onConfirm,
  onCancel,
}: TopUpConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onCancel();
  };

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-[#1a1a25] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#D4A853]/20 flex items-center justify-center">
            <span className="text-xl">💰</span>
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">
              {i18n.t('credits.confirmTopUp') || 'Confirm Top Up'}
            </h3>
            <p className="text-gray-400 text-xs">
              {i18n.t('credits.reviewDetails') || 'Review transaction details'}
            </p>
          </div>
        </div>

        {/* Transaction details */}
        <div className="space-y-3 mb-6">
          {/* Fiat amount */}
          <div className="flex items-center justify-between p-3 bg-[#0f0f18] rounded-lg">
            <span className="text-gray-400 text-sm">
              {i18n.t('credits.fiatAmount') || 'Amount'}
            </span>
            <span className="text-white font-mono font-bold text-base">
              {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
            </span>
          </div>

          {/* Exchange rate */}
          <div className="flex items-center justify-between p-3 bg-[#0f0f18] rounded-lg">
            <span className="text-gray-400 text-sm">
              {i18n.t('credits.exchangeRate') || 'Exchange Rate'}
            </span>
            <span className={`font-mono text-sm ${rateSource === 'live' ? 'text-green-400' : 'text-gray-400'}`}>
              1 {currency} = {rate.toFixed(6)} USDT
              <span className="text-[9px] ml-1 opacity-60">
                ({rateSource === 'live' ? '🟢' : '⚪'})
              </span>
            </span>
          </div>

          {/* Calculation */}
          <div className="flex items-center justify-between p-3 bg-[#0f0f18] rounded-lg">
            <span className="text-gray-400 text-sm">
              {i18n.t('credits.calculation') || 'Calculation'}
            </span>
            <span className="text-gray-300 font-mono text-xs">
              {amount.toLocaleString()} × {rate.toFixed(6)}
            </span>
          </div>

          {/* USDT result */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#D4A853]/10 to-[#D4A853]/5 rounded-lg border border-[#D4A853]/30">
            <span className="text-[#D4A853] text-sm font-semibold">
              {i18n.t('credits.youWillReceive') || 'You Will Receive'}
            </span>
            <span className="text-[#D4A853] font-mono font-bold text-xl tabular-nums">
              {estimatedUSDT.toFixed(6)} <span className="text-xs">USDT</span>
            </span>
          </div>
        </div>

        {/* Warning */}
        <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-xs leading-relaxed">
            ⚠️ {i18n.t('credits.topUpWarning') || 'Please verify the amount and exchange rate before confirming. Transactions cannot be reversed.'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg bg-white/5 text-gray-400 font-medium text-sm hover:bg-white/10 hover:text-white transition-colors"
          >
            {i18n.t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-lg bg-[#D4A853] text-[#0a0a10] font-bold text-sm hover:bg-[#D4A853]/90 transition-colors"
          >
            {i18n.t('credits.confirm') || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
