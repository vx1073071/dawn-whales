/**
 * FeeDeductionToast — Animated toast for USDT fee deductions
 * 
 * R102 M-01: Auto-trade completion → fee deduction notification
 * - Slide-in animation from bottom-right
 * - Auto-dismiss after 4s
 * - Shows: source, fee amount (USDT 6dp), original currency
 * - Stackable (multiple toasts)
 */

import { useState, useEffect, useCallback } from 'react';

interface FeeToast {
  id: string;
  source: string;
  feeUSDT: number;
  currency?: string;
  originalAmount?: number;
  timestamp: number;
}

interface FeeDeductionToastProps {
  // External trigger: new fee to show
  newFee?: FeeToast | null;
}

export default function FeeDeductionToast({ newFee }: FeeDeductionToastProps) {
  const [toasts, setToasts] = useState<FeeToast[]>([]);

  // Add new toast when fee arrives
  useEffect(() => {
    if (newFee) {
      setToasts(prev => [...prev, newFee]);
    }
  }, [newFee]);

  // Auto-dismiss after 4s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-slide-in-right bg-[#1a1a25] border border-[#D4A853]/30 rounded-xl px-4 py-3 shadow-2xl shadow-black/50 min-w-[280px] max-w-[360px]"
          style={{
            animationDelay: `${i * 50}ms`,
            animation: 'slideInRight 0.3s ease-out forwards',
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-[#D4A853]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">💸</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold mb-0.5">
                Fee Deducted
              </div>
              <div className="text-gray-400 text-[10px] truncate mb-1">
                {toast.source}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-red-400 text-sm font-bold font-mono tabular-nums">
                  -{toast.feeUSDT.toFixed(6)}
                </span>
                <span className="text-[#D4A853] text-[9px] font-medium">USDT</span>
              </div>
              {toast.currency && toast.originalAmount && (
                <div className="text-gray-500 text-[9px] mt-0.5">
                  {toast.originalAmount.toFixed(2)} {toast.currency} → USDT
                </div>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => dismiss(toast.id)}
              className="text-gray-500 hover:text-white text-xs p-1 rounded hover:bg-white/5 flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Progress bar (4s timer) */}
          <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D4A853]/50 rounded-full"
              style={{
                animation: 'shrink 4s linear forwards',
              }}
            />
          </div>
        </div>
      ))}

      {/* CSS keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Global toast manager (singleton pattern)
let toastListeners: ((toast: FeeToast) => void)[] = [];

export function showFeeToast(fee: Omit<FeeToast, 'id' | 'timestamp'>) {
  const toast: FeeToast = {
    ...fee,
    id: `fee-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  toastListeners.forEach(fn => fn(toast));
}

export function useFeeToast() {
  const [currentFee, setCurrentFee] = useState<FeeToast | null>(null);

  useEffect(() => {
    const listener = (toast: FeeToast) => setCurrentFee(toast);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  return currentFee;
}
