// ── DAWN WHALES — SignalTimeline (strategy/policy) ──────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import { getSignals, getAllStrategies } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface SignalItem {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  reason: string;
  timestamp: number;
  status: 'pending' | 'executed' | 'cancelled' | 'rejected';
}

interface SignalTimelineProps {
  strategyId?: string;
  maxItems?: number;
  autoRefresh?: boolean;
}

export default function SignalTimeline({
  strategyId,
  maxItems = 50,
  autoRefresh = true
}: SignalTimelineProps) {

  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [, setStrategies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL'>('all');

  const loadData = useCallback(async () => {
    try {
      const strats = await getAllStrategies();
      const nameMap: Record<string, string> = {};
      strats.forEach((s: any) => {nameMap[s.id] = s.name || s.id;});
      setStrategies(nameMap);

      const result = await getSignals(strategyId);
      const items = (result || []).
      map((s: any) => ({
        id: s.id || `${s.strategyId}-${s.timestamp}`,
        strategyId: s.strategyId || '',
        strategyName: nameMap[s.strategyId] || s.strategyId || i18n.t('SignalTimeline.k1'),
        symbol: s.symbol || s.code || '--',
        side: (s.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        price: s.price || 0,
        qty: s.qty || 0,
        reason: s.reason || s.signal || '',
        timestamp: s.timestamp || s.created_at || Date.now(),
        status: s.status || 'pending'
      })).
      sort((a: SignalItem, b: SignalItem) => b.timestamp - a.timestamp).
      slice(0, maxItems);
      setSignals(items as any);
    } catch (err) {
      void EngineError; // [SYSTEM] structured error tracking
      console.error('[SignalTimeline] load error:', err);
    }
    setLoading(false);
  }, [strategyId, maxItems]);

  useEffect(() => {
    loadData();
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData, autoRefresh]);

  const filtered = signals.filter((s) => filter === 'all' || s.side === filter);

  if (loading) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5 flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">{i18n.t('SignalTimeline.k0')}</div>
      </div>);

  }

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">{i18n.t("SignalTimeline.r92_7ebe")}</h2>
          <p className="text-gray-500 text-[10px] mt-0.5">{i18n.t("SignalTimeline.r92_b42a")}
            {signals.length}{i18n.t("SignalTimeline.r92_4885")}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#12121a] rounded-lg p-1">
          {(['all', 'BUY', 'SELL'] as const).map((f) =>
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            filter === f ?
            'bg-[#C9A046] text-black' :
            'text-gray-400 hover:text-gray-200'}`
            }>
            
              {f === 'all' ? 'components.all' : f === 'BUY' ? i18n.t('SignalTimeline.k2') : i18n.t('SignalTimeline.k3')}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ?
      <div className="text-center py-8">
          <div className="text-2xl mb-2 opacity-40">📡</div>
          <p className="text-gray-500 text-sm">{i18n.t('SignalTimeline.k1')}</p>
          <p className="text-gray-600 text-xs mt-1">{i18n.t('SignalTimeline.k2')}</p>
        </div> :

      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {filtered.map((s, i) => {
          const isBuy = s.side === 'BUY';
          const time = new Date(s.timestamp);
          const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const dateStr = time.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
          const isNew = i < 3;

          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isNew ? 'bg-[#C9A046]/5 border border-[#C9A046]/10' : 'bg-[#12121a] hover:bg-[#1a1a25]'}`
              }>
              
                {/* Side indicator */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`
              }>
                  {isBuy ? 'B' : 'S'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{s.symbol.replace('US.', '')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`
                  }>
                      {isBuy ? i18n.t('SignalTimeline.k4') : i18n.t('SignalTimeline.k5')}
                    </span>
                    <span className="text-gray-500 text-[10px]">{s.strategyName}</span>
                    {isNew &&
                  <span className="text-[10px] bg-[#C9A046]/10 text-[#D4A853] px-1.5 py-0.5 rounded">NEW</span>
                  }
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">
                    <span>{i18n.t('SignalTimeline.k3')}<span className="text-gray-300 font-mono">${s.price.toFixed(2)}</span></span>
                    <span>{i18n.t('SignalTimeline.k4')}<span className="text-gray-300 font-mono">{s.qty}</span></span>
                    <span>{i18n.t('SignalTimeline.k5')}<span className="text-gray-300 font-mono">${(s.price * s.qty).toFixed(0)}</span></span>
                    {s.reason && <span className="truncate max-w-[200px]">{s.reason}</span>}
                  </div>
                </div>

                {/* Time + Status */}
                <div className="text-right flex-shrink-0">
                  <div className="text-gray-300 text-xs font-mono">{timeStr}</div>
                  <div className="text-gray-500 text-[10px]">{dateStr}</div>
                  <div className={`text-[10px] mt-0.5 ${
                s.status === 'executed' ? 'text-emerald-400' :
                s.status === 'rejected' ? 'text-red-400' :
                s.status === 'cancelled' ? 'text-gray-400' :
                'text-yellow-400'}`
                }>
                    {s.status === 'executed' ? i18n.t('SignalTimeline.k6') :
                  s.status === 'rejected' ? 'components.tradeRejected' :
                  s.status === 'cancelled' ? i18n.t('SignalTimeline.k7') : 'components.pending'}
                  </div>
                </div>
              </div>);

        })}
        </div>
      }
    </div>);

}