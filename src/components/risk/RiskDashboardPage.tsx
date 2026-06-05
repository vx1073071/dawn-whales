// ── DAWN WHALES — Risk Dashboard (v0.6.0) ───────────────────────────────────
// 实时展示 Kelly/回撤/VIX/风控状态

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getRiskStatusSnapshot } from '../../lib/bridge-api';
import EquityChart from './EquityChart';
import PerformanceMetricsPanel from './PerformanceMetricsPanel';
import TradingJournal from './TradingJournal';
import DailyPnLSummary from './DailyPnLSummary';
import RiskConfigEditor from './RiskConfigEditor';
import SystemLog from './SystemLog';
import PortfolioStressTest from './PortfolioStressTest';
import SentimentGauge from './SentimentGauge';
import AnomalyAlertPanel from './AnomalyAlertPanel';

interface KellyStats {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  kellyFraction: number;
  sampleSize: number;
}

interface DrawdownState {
  peakEquity: number;
  currentDrawdownPct: number;
  maxDrawdownPct: number;
  drawdownStart?: number;
  isReduced: boolean;
  reductionFactor: number;
}

interface RiskAlert {
  time: number;
  type: string;
  message: string;
}

interface RiskSnapshot {
  config: any;
  drawdown: DrawdownState;
  kelly: KellyStats;
  volatilityFactor: number;
  currentVix: number | null;
  totalAssets: number;
  dailyPnl: number;
  alerts: RiskAlert[];
}

export default function RiskDashboardPage() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<RiskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Demo equity curve data (60 days)
  const demoEquityData = useMemo(() => {
    const data: { time: string; equity: number }[] = [];
    let equity = 100000;
    const now = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const change = (Math.random() - 0.48) * 0.02 * equity;
      equity += change;
      data.push({
        time: d.toISOString().split('T')[0],
        equity: Math.max(equity, 50000),
      });
    }
    return data;
  }, []);

  // Demo trade history for performance metrics
  const demoTrades = useMemo(() => {
    const trades: { pnl: number; timestamp: number }[] = [];
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      const isWin = Math.random() > 0.42;
      const pnl = isWin
        ? 50 + Math.random() * 450
        : -(30 + Math.random() * 220);
      trades.push({ pnl, timestamp: now - i * 86400000 });
    }
    return trades;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const result = await getRiskStatusSnapshot();
      if (result?.success && result.snapshot) {
        setSnapshot(result.snapshot);
        setLastUpdate(new Date().toLocaleTimeString('zh-CN'));
      }
    } catch (err) {
      console.error('[RiskDashboard] load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData, autoRefresh]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">{t('risk.loading')}</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">{t('risk.engineNotInitialized')}</div>
      </div>
    );
  }

  const { kelly, drawdown, currentVix, totalAssets, dailyPnl, alerts, volatilityFactor } = snapshot;

  // ── Derived visuals ───────────────────────────────────────────────────────

  const kellyPct = Math.round(kelly.kellyFraction * 100);
  const kellyColor = kellyPct >= 15 ? 'text-emerald-400' : kellyPct >= 5 ? 'text-[#D4A853]' : 'text-gray-400';
  const kellyBg = kellyPct >= 15 ? 'bg-emerald-500/10' : kellyPct >= 5 ? 'bg-[#D4A853]/10' : 'bg-gray-500/10';

  const ddPct = drawdown.currentDrawdownPct * 100;
  const ddColor = ddPct >= 15 ? 'text-red-400' : ddPct >= 10 ? 'text-orange-400' : 'text-emerald-400';
  const ddBarColor = ddPct >= 15 ? 'bg-red-500' : ddPct >= 10 ? 'bg-orange-500' : 'bg-emerald-500';

  const vixLabel = currentVix === null
    ? { text: '无数据', color: 'text-gray-500', bg: 'bg-gray-500/10' }
    : currentVix >= 35
    ? { text: '极端波动', color: 'text-red-400', bg: 'bg-red-500/10' }
    : currentVix >= 25
    ? { text: '高波动', color: 'text-orange-400', bg: 'bg-orange-500/10' }
    : { text: '正常', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };

  const volFactorPct = Math.round(volatilityFactor * 100);

  const pnlColor = dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const pnlBg = dailyPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🛡️ {t('risk.title')}</h1>
          <p className="text-gray-400 text-sm">
            {t('common.lastUpdate')}: {lastUpdate || '--'} · {t('common.autoRefresh')} {autoRefresh ? t('common.on') : t('common.off')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
            }`}
          >
            {autoRefresh ? `⏸ ${t('common.pause')}` : `▶ ${t('common.resume')}`}
          </button>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9A046]/10 text-[#D4A853] border border-[#C9A046]/20 hover:bg-[#C9A046]/20 transition-colors"
          >
            🔄 {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          label="Kelly 建议仓位"
          value={kelly.sampleSize > 0 ? `${kellyPct}%` : '无数据'}
          sub={kelly.sampleSize > 0 ? `基于 ${kelly.sampleSize} 笔交易` : '交易历史不足'}
          color={kellyColor}
          bg={kellyBg}
        />
        <SummaryCard
          label="当前回撤"
          value={`${ddPct.toFixed(1)}%`}
          sub={drawdown.isReduced ? `🔴 已降仓至 ${Math.round(drawdown.reductionFactor * 100)}%` : '正常'}
          color={ddColor}
          bg={drawdown.isReduced ? 'bg-red-500/10' : 'bg-emerald-500/10'}
        />
        <SummaryCard
          label="VIX 波动率"
          value={currentVix !== null ? `${currentVix.toFixed(1)}` : '--'}
          sub={vixLabel.text}
          color={vixLabel.color}
          bg={vixLabel.bg}
        />
        <SummaryCard
          label="日盈亏 / 总资产"
          value={totalAssets > 0 ? `${(dailyPnl / 10000).toFixed(1)}万` : '--'}
          sub={totalAssets > 0 ? `总资产 ${(totalAssets / 10000).toFixed(0)}万` : '未连接'}
          color={pnlColor}
          bg={pnlBg}
        />
      </div>

      {/* Drawdown Bar */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">📉 回撤进度</h2>
          <span className={`text-xs font-mono ${ddColor}`}>{ddPct.toFixed(1)}% / 峰值 ${drawdown.peakEquity.toFixed(0)}</span>
        </div>
        <div className="w-full h-3 bg-[#0d0d14] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${ddBarColor}`}
            style={{ width: `${Math.min(ddPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
          <span>0%</span>
          <span className="text-orange-400">降仓阈值 {(snapshot.config.drawdownReduceThreshold * 100).toFixed(0)}%</span>
          <span className="text-red-400">极限 30%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Gauge */}
        <SentimentGauge />

        {/* Kelly Detail */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🧮 Kelly 统计详情</h2>
          {kelly.sampleSize === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">暂无交易记录，无法进行 Kelly 计算</p>
          ) : (
            <div className="space-y-3">
              <StatRow label="胜率" value={`${(kelly.winRate * 100).toFixed(1)}%`} />
              <StatRow label="平均盈利" value={`+$${kelly.avgWin.toFixed(0)}`} valueColor="text-emerald-400" />
              <StatRow label="平均亏损" value={`-$${kelly.avgLoss.toFixed(0)}`} valueColor="text-red-400" />
              <StatRow label="盈亏比" value={kelly.profitFactor === Infinity ? '∞' : kelly.profitFactor.toFixed(2)} />
              <StatRow label="Kelly f*" value={`${(kelly.kellyFraction * 100).toFixed(1)}%`} valueColor={kellyColor} />
              <div className="pt-2 border-t border-white/5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">仓位调节因子</span>
                  <span className="text-gray-300 font-mono">{volFactorPct}%</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  {volFactorPct < 100
                    ? `波动率调节生效中 (${volFactorPct}% 正常仓位)`
                    : '无波动率调节'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">🚨 最新告警</h2>
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">暂无告警</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {alerts.slice().reverse().map((a, i) => {
                const isSevere = a.type === 'DRAWDOWN_REDUCE' || a.type === 'RATE_LIMIT' || a.type === 'DAILY_LOSS';
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                      isSevere ? 'bg-red-500/5 border border-red-500/10' : 'bg-[#12121a]'
                    }`}
                  >
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSevere ? 'bg-red-400' : 'bg-[#D4A853]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${isSevere ? 'text-red-400' : 'text-[#D4A853]'}`}>{a.type}</div>
                      <div className="text-gray-400 truncate">{a.message}</div>
                      <div className="text-gray-600 text-[10px] mt-0.5">
                        {new Date(a.time).toLocaleTimeString('zh-CN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Equity Curve + Daily P&L */}
      <div className="grid grid-cols-2 gap-4">
        <EquityChart data={demoEquityData} title="📈 账户净值走势" height={300} showDrawdown />
        <DailyPnLSummary />
      </div>

      {/* Performance Metrics */}
      <PerformanceMetricsPanel trades={demoTrades} title="📊 交易绩效指标" />

      {/* Portfolio Stress Test */}
      <PortfolioStressTest />

      {/* Anomaly Alert Panel */}
      <AnomalyAlertPanel />

      {/* Trading Journal + System Log */}
      <div className="grid grid-cols-2 gap-4">
        <TradingJournal />
        <SystemLog />
      </div>

      {/* Risk Config Editor */}
      <RiskConfigEditor />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, bg }: {
  label: string; value: string; sub: string; color: string; bg?: string;
}) {
  return (
    <div className={`bg-[#1a1a25] border border-white/5 rounded-xl p-4 ${bg || ''}`}>
      <div className="text-gray-500 text-[11px] mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-gray-500 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}

function StatRow({ label, value, valueColor = 'text-gray-300' }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-mono font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}
