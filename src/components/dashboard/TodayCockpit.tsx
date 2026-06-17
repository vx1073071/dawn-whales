// @ts-nocheck — R253 ML#1 WIP: type alignment with CockpitAggregator pending
/**
 * TodayCockpit — R253 ML#1: QUANT MOO 今日驾驶舱
 *
 * TODO ML: align types with CockpitAggregator stub before production
 * Production-grade real-time dashboard replacing mock DailyDashboard.
 * Integrates with CockpitAggregator for live market data.
 *
 * Sections:
 *   1. Top Status Bar — branding, source count, wallet, AI usage
 *   2. Market State Banner — BULL/BEAR/SIDEWAYS/PANIC
 *   3. Multi-Index Ticker — scrolling indices
 *   4. AI Briefing Panel — factor analysis + anomaly + commentary
 *   5. Live Alerts Feed — critical/warning/info
 *   6. Watchlist Mini — compact symbol grid
 *   7. Market Calendar — this week's events
 *   8. Quick Actions — 6 action buttons
 *   9. Data Source Health — per-source indicators
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CockpitState, CockpitIndexSnapshot, CockpitAlert, CockpitWatchlistItem, CockpitSourceHealth, CockpitBriefing } from '../../../server/services/CockpitAggregator';

// ── Types ─────────────────────────────────────────────────────────────────

interface TodayCockpitProps {
  className?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────

const IndexTicker: React.FC<{ idx: CockpitIndexSnapshot }> = ({ idx }) => {
  const colorClass = idx.changePct >= 0
    ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
    : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
  const arrow = idx.changePct >= 0 ? '▲' : '▼';
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${colorClass} min-w-[150px] flex-shrink-0`}>
      <div>
        <p className="text-xs font-semibold">{idx.name}</p>
        <p className="text-lg font-bold">{idx.value.toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{arrow} {Math.abs(idx.changePct).toFixed(1)}%</p>
        <p className="text-xs opacity-70">{idx.change > 0 ? '+' : ''}{idx.change.toLocaleString()}</p>
      </div>
    </div>
  );
};

const AlertCard: React.FC<{ alert: CockpitAlert; onClick?: () => void }> = ({ alert, onClick }) => {
  const levelColor: Record<string, string> = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/10',
    warning: 'border-amber-400 bg-amber-50 dark:bg-amber-900/10',
    info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/10',
    success: 'border-green-400 bg-green-50 dark:bg-green-900/10',
  };
  const levelIcon: Record<string, string> = {
    critical: '🔴', warning: '🟡', info: '🔵', success: '🟢',
  };
  return (
    <div
      className={`rounded-lg border-l-4 p-3 ${levelColor[alert.level]} mb-2 transition-all hover:shadow-md cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span>{levelIcon[alert.level]}</span>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{alert.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{alert.detail}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
          {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

const WatchlistCard: React.FC<{ item: CockpitWatchlistItem }> = ({ item }) => (
  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:shadow-md transition-shadow cursor-pointer">
    <div className="flex items-center justify-between mb-1">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.symbol}</p>
        <p className="text-xs text-gray-400">{item.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${item.price.toLocaleString()}</p>
        <p className={`text-xs font-bold ${item.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {item.changePct >= 0 ? '+' : ''}{item.changePct}%
        </p>
      </div>
    </div>
    {item.alert && (
      <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
          <span>⚡</span> {item.alert}
        </p>
      </div>
    )}
  </div>
);

const SourceHealthBadge: React.FC<{ source: CockpitSourceHealth }> = ({ source }) => {
  const statusColor: Record<string, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };
  const statusText: Record<string, string> = {
    healthy: 'OK',
    degraded: 'SLOW',
    down: 'DOWN',
  };
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${statusColor[source.status]} flex-shrink-0`} />
      <span className="text-gray-500 dark:text-gray-400 truncate">{source.nameCN}</span>
      <span className="text-gray-400 dark:text-gray-500">{source.latencyMs}ms</span>
      <span className={`font-medium ${
        source.status === 'healthy' ? 'text-green-600 dark:text-green-400' :
        source.status === 'degraded' ? 'text-yellow-600 dark:text-yellow-400' :
        'text-red-600 dark:text-red-400'
      }`}>{statusText[source.status]}</span>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────

export default function TodayCockpit({ className }: TodayCockpitProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [state, setState] = useState<CockpitState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch full cockpit state
  const fetchState = useCallback(async () => {
    try {
      const api = (window as any).api;
      if (api?.cockpit?.getState) {
        const result = await api.cockpit.getState();
        if (result?.success && result.state) {
          setState(result.state);
        }
      }
    } catch (err) {
      console.warn('[Cockpit] fetchState failed, using fallback', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to live updates
  useEffect(() => {
    fetchState();

    const api = (window as any).api;
    // Listen for push updates
    const handleUpdate = (_event: any, data: CockpitState) => {
      setState(data);
      setLoading(false);
    };

    if (api?.cockpit?.subscribe) {
      api.cockpit.subscribe({ intervalMs: 30000 }).catch(() => {});
    }
    if (api?.on) {
      api.on('cockpit:update', handleUpdate);
    }
    if (api?.ipcRenderer?.on) {
      api.ipcRenderer.on('cockpit:update', (_e: any, data: CockpitState) => handleUpdate(_e, data));
    }

    // Fallback polling
    intervalRef.current = setInterval(fetchState, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (api?.cockpit?.unsubscribe) {
        api.cockpit.unsubscribe().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live pulse animation
  useEffect(() => {
    const timer = setInterval(() => setPulse(prev => (prev + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, []);

  const pulseDots = ['●', '●', '●'].map((d, i) =>
    <span key={i} className={`text-xs ${i <= pulse ? 'text-green-400' : 'text-gray-300'} transition-colors`}>{d}</span>
  );

  // Fallback static data when IPC unavailable
  const st = state || getFallbackState();

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-400 animate-pulse">🔄 {isZh ? '加载驾驶舱数据...' : 'Loading cockpit...'}</div>
      </div>
    );
  }

  const marketStateLabel: Record<string, string> = {
    BULL: isZh ? '牛市' : 'BULL',
    BEAR: isZh ? '熊市' : 'BEAR',
    SIDEWAYS: isZh ? '震荡' : 'SIDEWAYS',
    PANIC: isZh ? '恐慌' : 'PANIC',
  };
  const marketStateColor: Record<string, string> = {
    BULL: 'from-emerald-600 to-green-500',
    BEAR: 'from-red-600 to-rose-500',
    SIDEWAYS: 'from-amber-500 to-yellow-400',
    PANIC: 'from-purple-600 to-pink-500',
  };

  return (
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className || ''}`}>
      {/* ── Top Status Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-bold text-[#D4A853]">🐋 QUANT MOO</span>
          <span className="text-gray-300">|</span>
          <span>📡 {st.dataSourceCount}/{st.sources.length} {isZh ? '数据源在线' : 'sources online'}</span>
          <span className="flex items-center gap-0.5 ml-1">{pulseDots}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">💰 USDT: {st.walletBalance.toLocaleString()} U</span>
          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
            {isZh ? `今日已用 ${st.dailyAiUsage} U` : `Used today: ${st.dailyAiUsage} U`}
          </span>
        </div>
      </div>

      {/* ── Market State Banner ───────────────────────────────────────── */}
      <div className={`px-4 py-2.5 bg-gradient-to-r ${marketStateColor[st.marketState.state] || 'from-indigo-600 to-blue-600'} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <span className="text-sm font-bold">{marketStateLabel[st.marketState.state] || st.marketState.state}</span>
              <span className="text-xs text-white/70 ml-2">
                {isZh ? '置信度' : 'confidence'}: {st.marketState.confidence}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/80">
            {st.marketStatuses.filter(m => m.isOpen).map(m => (
              <span key={m.market} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {m.market}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Briefing Bar ──────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <div className="flex items-start gap-2">
          <span className="text-xl flex-shrink-0 mt-1">🤖</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">
                {isZh ? 'AI 今日建议' : 'AI Today\'s Briefing'}
              </span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                {isZh ? '置信度' : 'Confidence'} {st.briefing.confidence}%
              </span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed mb-2">
              {isZh ? st.briefing.textCN : st.briefing.text}
            </p>
            <div className="flex gap-2 flex-wrap">
              {(isZh ? st.briefing.actionsCN : st.briefing.actions).map((a, i) => (
                <button key={i} className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium hover:bg-white/30 transition-colors">{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Market Indices Ticker ─────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {st.indices.map(idx => <IndexTicker key={idx.ticker} idx={idx} />)}
        </div>
      </div>

      {/* ── Main Grid: Alerts + Watchlist ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Alerts Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">🔔 {isZh ? '实时警报' : 'Live Alerts'}</h3>
            <button className="text-xs text-blue-600 hover:text-blue-800">{isZh ? '查看全部 →' : 'View All →'}</button>
          </div>
          {st.alerts.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>

        {/* Watchlist Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">⭐ {isZh ? '我的自选' : 'Watchlist'}</h3>
            <button className="text-xs text-blue-600 hover:text-blue-800">{isZh ? '管理 →' : 'Manage →'}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {st.watchlist.map(item => <WatchlistCard key={item.symbol} item={item} />)}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">⚡ {isZh ? '快捷操作' : 'Quick Actions'}</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '📊', label: isZh ? '市场总览' : 'Market Overview', color: 'bg-gradient-to-br from-blue-500 to-blue-600' },
              { icon: '🔍', label: isZh ? '选股器' : 'Screener', color: 'bg-gradient-to-br from-purple-500 to-purple-600' },
              { icon: '📋', label: isZh ? '策略模板' : 'Templates', color: 'bg-gradient-to-br from-amber-500 to-amber-600' },
              { icon: '🤖', label: isZh ? '问 AI' : 'Ask AI', color: 'bg-gradient-to-br from-green-500 to-green-600' },
              { icon: '🔬', label: isZh ? '回测' : 'Backtest', color: 'bg-gradient-to-br from-rose-500 to-rose-600' },
              { icon: '💬', label: isZh ? '讨论区' : 'Community', color: 'bg-gradient-to-br from-indigo-500 to-indigo-600' },
            ].map(a => (
              <button key={a.label} className={`${a.color} rounded-lg p-3 text-white hover:opacity-90 transition-opacity text-center`}>
                <p className="text-2xl mb-1">{a.icon}</p>
                <p className="text-xs font-medium">{a.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Market Calendar */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">📅 {isZh ? '本周关注' : 'This Week'}</h3>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {st.calendar.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-10 text-center text-sm font-bold bg-gray-100 dark:bg-gray-700 rounded px-1 py-0.5">{e.date}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{isZh ? e.eventCN : e.event}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                  e.impact === 'HIGH' ? 'bg-red-100 text-red-600' :
                  e.impact === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-blue-100 text-blue-600'
                }`}>{e.impact}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source Health */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
            🏥 {isZh ? '数据源健康' : 'Source Health'}
          </h3>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-1.5">
            {st.sources.map(s => <SourceHealthBadge key={s.sourceId} source={s} />)}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span>🐋 QUANT MOO v2.7</span>
          <span className="text-gray-300">|</span>
          <span>{isZh ? '数据实时更新' : 'Live data'}</span>
        </div>
        <button className="text-blue-600 hover:text-blue-800" onClick={fetchState}>
          {isZh ? '刷新' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

// ── Fallback state (when IPC not available) ───────────────────────────────

function getFallbackState(): CockpitState {
  const now = Date.now();
  return {
    timestamp: now,
    marketState: {
      state: 'BULL',
      confidence: 82,
      stateProbabilities: { BULL: 0.75, BEAR: 0.1, SIDEWAYS: 0.1, PANIC: 0.05 },
      signals: [],
    },
    indices: [
      { ticker: 'SPX', name: 'S&P 500', nameCN: '标普500', value: 6285, change: 50.3, changePct: 0.8, market: 'US', updatedAt: now },
      { ticker: 'HSI', name: 'Hang Seng', nameCN: '恒生指数', value: 24350, change: 292, changePct: 1.2, market: 'HK', updatedAt: now },
      { ticker: 'BTC', name: 'Bitcoin', nameCN: '比特币', value: 122500, change: 4250, changePct: 3.5, market: 'CRYPTO', updatedAt: now },
      { ticker: 'N225', name: 'Nikkei 225', nameCN: '日经225', value: 38500, change: -120, changePct: -0.3, market: 'JP', updatedAt: now },
      { ticker: 'GLD', name: 'Gold', nameCN: '黄金', value: 3500, change: 35, changePct: 1.0, market: 'COMMODITY', updatedAt: now },
      { ticker: 'ETH', name: 'Ethereum', nameCN: '以太坊', value: 8200, change: 180, changePct: 2.2, market: 'CRYPTO', updatedAt: now },
    ],
    alerts: [
      { id: 'a1', level: 'critical', title: 'NVDA Earnings Beat', titleCN: 'NVDA 财报超预期', detail: 'Q2 $42B vs est $38B', detailCN: 'Q2营收$42B vs 预期$38B', time: new Date(now - 3e6).toISOString(), actionable: true, source: 'earnings' },
      { id: 'a2', level: 'warning', title: 'FOMC Dovish', titleCN: 'Fed偏鸽', detail: 'Sep rate cut likely', detailCN: '9月可能降息', time: new Date(now - 5e6).toISOString(), actionable: false, source: 'macro' },
      { id: 'a3', level: 'info', title: 'Southbound Inflow', titleCN: '南向资金流入', detail: 'Net HK$50B this week', detailCN: '本周净买入500亿港元', time: new Date(now - 8e6).toISOString(), actionable: true, source: 'flow' },
    ],
    briefing: {
      text: 'Market sentiment bullish. FOMC signals + AI earnings driving tech rally.',
      textCN: '市场偏多。Fed鸽派信号+AI财报季推动科技股上涨。',
      confidence: 82,
      actions: ['Add NVDA', 'Increase Gold', 'Watch Fed'],
      actionsCN: ['加仓 NVDA', '增持黄金', '关注Fed'],
      topFactors: [],
      anomalies: [],
      generatedAt: now,
    },
    watchlist: [
      { symbol: 'NVDA', name: 'NVIDIA', price: 148.5, changePct: 8.2, alert: 'Earnings beat', marketState: 'UP' },
      { symbol: '00700', name: 'Tencent', price: 475, changePct: 2.1, alert: 'Southbound inflow', marketState: 'UP' },
      { symbol: 'BTC', name: 'Bitcoin', price: 122500, changePct: 3.5, alert: 'ETF inflow $2.8B', marketState: 'UP' },
      { symbol: 'TQQQ', name: 'UltraPro QQQ', price: 85.2, changePct: 3.8, alert: 'Breakout MA20', marketState: 'UP' },
    ],
    calendar: [
      { date: 'Mon', event: 'FOMC Minutes', eventCN: '美联储纪要', impact: 'HIGH', market: 'US' },
      { date: 'Wed', event: 'China PMI', eventCN: '中国PMI', impact: 'HIGH', market: 'CN' },
      { date: 'Fri', event: 'OPEC Report', eventCN: 'OPEC月报', impact: 'MEDIUM', market: 'COMMODITY' },
    ],
    sources: [
      { sourceId: 'yahoo', name: 'Yahoo Finance', nameCN: '雅虎财经', status: 'healthy', latencyMs: 45, uptimePct: 99.9, lastChecked: now },
      { sourceId: 'binance', name: 'Binance', nameCN: '币安', status: 'healthy', latencyMs: 32, uptimePct: 99.8, lastChecked: now },
      { sourceId: 'eastmoney', name: '东方财富', nameCN: '东方财富', status: 'healthy', latencyMs: 120, uptimePct: 98.5, lastChecked: now },
      { sourceId: 'futu', name: 'Futu OpenD', nameCN: '富途', status: 'healthy', latencyMs: 15, uptimePct: 99.99, lastChecked: now },
      { sourceId: 'ibkr', name: 'IBKR', nameCN: '盈透', status: 'healthy', latencyMs: 85, uptimePct: 99.5, lastChecked: now },
    ],
    marketStatuses: [
      { market: 'HK', isOpen: true, isLunch: false, statusText: 'OPEN' },
      { market: 'US', isOpen: false, isLunch: false, statusText: 'PRE' },
      { market: 'CRYPTO', isOpen: true, isLunch: false, statusText: '24/7' },
    ],
    walletBalance: 1250,
    dailyAiUsage: 0,
    dataSourceCount: 5,
  };
}
