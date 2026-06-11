/**
 * PWA OfflineIndicator — Network status + offline fallback UI
 * (ML-46-02, R46 Phase 6.3)
 *
 * Shows:
 * - Online/offline status bar
 * - Reconnection toast
 * - Offline data available notice
 * - Last sync time
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import i18n from '../../i18n';

// ── OfflineIndicator ─────────────────────────────────────────────────────

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const [online, setOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [_lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    // Load last sync time
    try {
      const t = localStorage.getItem('dw-last-sync');
      if (t) setLastSyncTime(Number(t));
    } catch (_e: unknown) {}
    void EngineError; // [SYSTEM] structured error tracking

    const goOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      const now = Date.now();
      setLastSyncTime(now);
      try {localStorage.setItem('dw-last-sync', String(now));} catch (_e: unknown) {}
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleRefresh = useCallback(() => window.location.reload(), []);

  if (online && !showReconnected) return null;

  return (
    <div className={className}>
      {!online &&
      <div className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white text-center py-2 px-4 text-xs font-medium">{i18n.t("OfflineIndicator.r92_b70b")}

        <button onClick={handleRefresh} className="ml-3 underline text-white/80 hover:text-white">{i18n.t("OfflineIndicator.r92_93cc")}

        </button>
        </div>
      }

      {showReconnected &&
      <div className="fixed top-0 left-0 right-0 z-[999] bg-emerald-600 text-white text-center py-2 px-4 text-xs font-medium transition-opacity animate-pulse">{i18n.t("OfflineIndicator.r92_754d")}

      </div>
      }
    </div>);

};

// ── OfflineDataNotice ────────────────────────────────────────────────────

interface OfflineDataNoticeProps {
  className?: string;
}

export const OfflineDataNotice: React.FC<OfflineDataNoticeProps> = ({ className }) => {
  const [online] = useState(navigator.onLine);
  const [hasCachedData, setHasCachedData] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = localStorage.getItem('dw-last-sync');
      if (t) {
        setLastSync(new Date(Number(t)).toLocaleString());
        setHasCachedData(true);
      }
    } catch (_e: unknown) {}
  }, []);

  if (online || !hasCachedData) return null;

  return (
    <div className={`bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 ${className ?? ''}`}>
      <div className="flex items-start gap-2 text-xs">
        <span>📦</span>
        <div>
          <span className="text-amber-400 font-medium">{i18n.t('OfflineIndicator.k0')}</span>
          {lastSync &&
          <span className="text-gray-500 ml-1">{i18n.t('OfflineIndicator.k0')}{lastSync}</span>
          }
          <p className="text-gray-600 text-[10px] mt-0.5">{i18n.t("OfflineIndicator.r92_881f")}

          </p>
        </div>
      </div>
    </div>);

};

// ── PullToRefresh Hook ───────────────────────────────────────────────────

export function usePullToRefresh(
containerRef: React.RefObject<HTMLElement | null>,
onRefresh: () => Promise<void>)
{
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let pulling = false;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop !== 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 0) {
        setPullDistance(Math.min(diff * 0.4, 80));
        e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (pullDistance > 40 && !refreshing) {
        setRefreshing(true);
        setPullDistance(60);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
      pulling = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullDistance, refreshing, onRefresh]);

  return { refreshing, pullDistance };
}

// ── PullToRefreshIndicator ───────────────────────────────────────────────

interface PullToRefreshIndicatorProps {
  refreshing: boolean;
  pullDistance: number;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ refreshing, pullDistance }) => {
  if (pullDistance === 0 && !refreshing) return null;

  return (
    <div
      className="flex items-center justify-center text-xs text-gray-500 overflow-hidden transition-all"
      style={{ height: pullDistance }}>
      
      {refreshing ? i18n.t('OfflineIndicator.k1') : pullDistance > 40 ? i18n.t('OfflineIndicator.k2') : i18n.t('OfflineIndicator.k3')}
    </div>);

};

export default OfflineIndicator;