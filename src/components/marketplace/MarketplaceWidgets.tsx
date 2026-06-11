/**
 * Subscribe Widget + Error States — ML-52-03 [P1]
 * R52: v1.1.0-alpha UI Polish
 *
 * - Subscribe button with confirmation dialog
 * - Error boundary for marketplace components
 * - Empty state for no search results
 * - Responsive breakpoint adjustments
 */

import React, { useState, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

// ── Subscribe Button ────────────────────────────────────────────────────

interface SubscribeButtonProps {
  isSubscribed: boolean;
  subscriberCount: number;
  price: number;
  strategyName: string;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  className?: string;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  isSubscribed,
  subscriberCount,
  price,
  strategyName,
  onSubscribe,
  onUnsubscribe,
  className,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [action, setAction] = useState<'sub' | 'unsub'>('sub');

  const handleClick = useCallback((act: 'sub' | 'unsub') => {
    setAction(act);
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    if (action === 'sub') onSubscribe();
    else onUnsubscribe();
  }, [action, onSubscribe, onUnsubscribe]);

  return (
    <>
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <button
          onClick={() => handleClick(isSubscribed ? 'unsub' : 'sub')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            isSubscribed
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-amber-500 text-black hover:bg-amber-400'
          }`}
        >
          {isSubscribed ? 'Subscribed' : price === 0 ? 'Subscribe Free' : `Subscribe · $${price}`}
        </button>
        <span className="text-[10px] text-gray-600">{subscriberCount.toLocaleString()} subscribers</span>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-[#111119] border border-white/[0.08] rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-200 mb-2">
              {action === 'sub' ? 'Subscribe to Strategy' : 'Unsubscribe'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {action === 'sub'
                ? `Subscribe to "${strategyName}"${price > 0 ? ` for $${price}` : ' for free'}? You'll receive signal notifications and updates.`
                : `Are you sure you want to unsubscribe from "${strategyName}"? You'll lose access to signals.`}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-300">Cancel</button>
              <button onClick={handleConfirm} className={`px-4 py-2 rounded-lg text-xs font-medium ${action === 'sub' ? 'bg-green-500 text-black' : 'bg-red-500/15 text-red-400'}`}>
                {action === 'sub' ? 'Confirm Subscribe' : 'Unsubscribe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Empty State ─────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const MarketplaceEmpty: React.FC<EmptyStateProps> = ({
  icon = '\u{1F50D}',
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-20 px-4">
    <span className="text-5xl mb-4 opacity-40">{icon}</span>
    <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
    {description && <p className="text-xs text-gray-600 max-w-xs text-center mb-4">{description}</p>}
    {action && (
      <button onClick={action.onClick} className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-medium">
        {action.label}
      </button>
    )}
  </div>
);

// ── Error Boundary ──────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class MarketplaceErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Marketplace] Error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <span className="text-4xl mb-3">⚠️</span>
          <p className="text-sm text-gray-400 mb-1">Something went wrong</p>
          <p className="text-[10px] text-gray-600 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-white/[0.06] text-gray-300 rounded-lg text-xs"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Responsive Grid Hook ────────────────────────────────────────────────

export function useResponsiveCols(): { sm: number; md: number; lg: number } {
  const [cols, setCols] = React.useState({ sm: 1, md: 2, lg: 3 });

  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setCols({ sm: 1, md: 1, lg: 1 });
      else if (w < 1024) setCols({ sm: 1, md: 2, lg: 2 });
      else if (w < 1440) setCols({ sm: 2, md: 3, lg: 3 });
      else setCols({ sm: 3, md: 3, lg: 4 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

export default {
  SubscribeButton,
  MarketplaceEmpty,
  MarketplaceErrorBoundary,
  useResponsiveCols,
};

void EngineError; // [DATA] structured error tracking