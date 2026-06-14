/**
 * TradingEasy R123 J03 — Order Confirm Modal
 * 
 * Shows before placing: broker name, code, side, qty, price, estimated fee.
 * Two buttons: [Confirm] [Cancel].
 * 
 * Triggered by IPC 'order:confirm-required' from main process.
 */

import React, { useEffect, useState, useCallback } from 'react';

// ═══════════ Types ════════════════════════════════════════

export interface OrderConfirmData {
  pendingId: string;
  brokerName: string;
  code: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price?: number;
  estimatedFee: {
    commission: number;
    platform: number;
    total: number;
    currency: string;
  };
  market: string;
}

// ═══════════ Hook: useOrderConfirm ═══════════════════════

export function useOrderConfirm() {
  const [pending, setPending] = useState<OrderConfirmData | null>(null);

  useEffect(() => {
    const api = (window as any).api;
    if (!api?.on) return;

    const unsub = api.on('order:confirm-required', (data: OrderConfirmData) => {
      setPending(data);
    });

    return () => { api.off?.('order:confirm-required', unsub); };
  }, []);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const api = (window as any).api;
    const result = await api?.broker?.placeOrderConfirm(pending.pendingId, true);
    setPending(null);
    return result;
  }, [pending]);

  const cancel = useCallback(async () => {
    if (!pending) return;
    const api = (window as any).api;
    const result = await api?.broker?.placeOrderConfirm(pending.pendingId, false);
    setPending(null);
    return result;
  }, [pending]);

  return { pending, confirm, cancel, dismiss: () => setPending(null) };
}

// ═══════════ OrderConfirmModal Component ═════════════════

interface Props {
  data: OrderConfirmData;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OrderConfirmModal: React.FC<Props> = ({ data, onConfirm, onCancel }) => {
  const [countdown, setCountdown] = useState(30);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [data.pendingId, onCancel]);

  const handleConfirm = () => {
    setConfirming(true);
    onConfirm();
  };

  const isMarketOrder = !data.price;
  const notional = data.qty * (data.price || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#c9d1d9] flex items-center gap-2">
            <span>确认下单</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1c2333] text-[#8b949e]">
              发送至 <strong className="text-[#f0883e]">{data.brokerName}</strong>
            </span>
          </h3>
          <span className="text-[10px] text-[#484f58]">{countdown}s 自动取消</span>
        </div>

        {/* Order Summary */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#8b949e]">交易对</span>
            <span className="font-mono text-[#c9d1d9] font-semibold">{data.code}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8b949e]">方向</span>
            <span className={`font-mono font-semibold ${data.side === 'BUY' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {data.side === 'BUY' ? '买入' : '卖出'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8b949e]">数量</span>
            <span className="font-mono text-[#c9d1d9]">{data.qty}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8b949e]">{isMarketOrder ? '市价单' : '限价'}</span>
            <span className="font-mono text-[#c9d1d9]">
              {isMarketOrder ? '市场价' : `$${data.price}`}
            </span>
          </div>
          {!isMarketOrder && (
            <div className="flex justify-between text-sm">
              <span className="text-[#8b949e]">预估金额</span>
              <span className="font-mono text-[#c9d1d9]">
                {notional.toLocaleString(undefined, { minimumFractionDigits: 2 })} {data.estimatedFee.currency}
              </span>
            </div>
          )}
          <hr className="border-[#21262d]" />
          <div className="flex justify-between text-[11px]">
            <span className="text-[#8b949e]">佣金 ({data.estimatedFee.currency})</span>
            <span className="font-mono text-[#c9d1d9]">{data.estimatedFee.commission}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#8b949e]">平台费 ({data.estimatedFee.currency})</span>
            <span className="font-mono text-[#c9d1d9]">{data.estimatedFee.platform}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-[#8b949e]">预估总费用</span>
            <span className="font-mono text-[#f0883e]">{data.estimatedFee.total} {data.estimatedFee.currency}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#30363d] text-[#8b949e] hover:bg-[#1c2333] text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {confirming ? '发送中...' : `确认下单 (${data.brokerName})`}
          </button>
        </div>
      </div>
    </div>
  );
};
