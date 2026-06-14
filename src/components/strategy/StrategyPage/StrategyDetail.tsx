/**
 * R161 ML: StrategyDetail — Strategy detail view with backtest + live controls
 * Shows strategy info, backtest results, and actions (run backtest, start/stop live).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StrategyExpiryBanner } from '../StrategyExpiryBanner';

interface BacktestResult {
  totalReturn?: number;
  annualReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  totalTrades?: number;
}

interface Props {
  strategyId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export const StrategyDetail: React.FC<Props> = ({ strategyId, onBack, onRefresh }) => {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<any>(null);
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btRunning, setBtRunning] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('stopped');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { getAllStrategies } = await import('../../../lib/bridge-api');
      const list = await getAllStrategies();
      const found = list.find((s: any) => s.id === strategyId);
      if (found) setStrategy(found);
    } catch { /* ignore */ }
    setLoading(false);
  }, [strategyId]);

  useEffect(() => { load(); }, [load]);

  const handleBacktest = async () => {
    setBtRunning(true);
    try {
      const { runBacktest } = await import('../../../lib/bridge-api');
      const res = await runBacktest(strategyId);
      setBtResult(res);
    } catch { /* ignore */ }
    setBtRunning(false);
  };

  const handleToggleLive = async () => {
    try {
      const { startLive, stopLive } = await import('../../../lib/bridge-api');
      if (liveStatus === 'running') {
        await stopLive(strategyId);
        setLiveStatus('stopped');
      } else {
        await startLive(strategyId);
        setLiveStatus('running');
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    try {
      const { deleteStrategy } = await import('../../../lib/bridge-api');
      await deleteStrategy(strategyId);
      onRefresh();
      onBack();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-2xl mb-3">⏳</div>
        <p className="text-sm text-gray-500">{t('StrategyDetail.loading', '加载中...')}</p>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-sm text-gray-400">{t('StrategyDetail.notFound', '策略未找到')}</p>
        <button onClick={onBack} className="mt-3 text-xs text-[#C9A046] hover:underline">{t('StrategyDetail.goBack', '返回列表')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{strategy.nameCn || strategy.name || strategyId}</h2>
          <div className="flex items-center gap-2 mt-1">
            {strategy.category && (
              <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{strategy.category}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              liveStatus === 'running' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {liveStatus === 'running' ? '● LIVE' : '○ STOPPED'}
            </span>
          </div>
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-white transition-colors">
          ← {t('StrategyDetail.back', '返回')}
        </button>
      </div>

      {/* ── R166 X5: Strategy Expiry Banner ── */}
      <StrategyExpiryBanner
        strategyId={strategy.id}
        strategyName={strategy.nameCn || strategy.name}
        lastOptimizedAt={strategy.lastOptimizedAt}
        createdAt={strategy.createdAt}
        onNavigateOptimizer={() => {
          // Navigate to optimizer - dispatch an event or use store
          const event = new CustomEvent('navigate-strategy-tab', { detail: { strategyId, tab: 'optimizer' } });
          window.dispatchEvent(event);
        }}
      />

      {/* Description */}
      {strategy.description && (
        <p className="text-sm text-gray-400 italic bg-[#1a1a25] rounded-xl p-3 border border-white/5">
          "{strategy.description}"
        </p>
      )}

      {/* Strategy Info */}
      {strategy.strategy && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-300 mb-3">{t('StrategyDetail.config', '策略配置')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-white/[0.03] rounded p-2">
              <span className="text-gray-500">{t('StrategyDetail.type', '类型')}</span>
              <p className="text-white font-medium">{strategy.strategy.type || '-'}</p>
            </div>
            {strategy.strategy.stopLoss !== undefined && (
              <div className="bg-white/[0.03] rounded p-2">
                <span className="text-gray-500">{t('StrategyDetail.stopLoss', '止损')}</span>
                <p className="text-red-400 font-mono">{(strategy.strategy.stopLoss * 100).toFixed(1)}%</p>
              </div>
            )}
            {strategy.strategy.takeProfit !== undefined && (
              <div className="bg-white/[0.03] rounded p-2">
                <span className="text-gray-500">{t('StrategyDetail.takeProfit', '止盈')}</span>
                <p className="text-emerald-400 font-mono">{(strategy.strategy.takeProfit * 100).toFixed(1)}%</p>
              </div>
            )}
            {Object.keys(strategy.strategy.params || {}).length > 0 && (
              <div className="bg-white/[0.03] rounded p-2">
                <span className="text-gray-500">{t('StrategyDetail.params', '参数')}</span>
                <p className="text-white font-mono text-[10px]">
                  {Object.entries(strategy.strategy.params).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {strategy.tags && strategy.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {strategy.tags.map((tag: string, i: number) => (
            <span key={i} className="text-[10px] text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleBacktest}
          disabled={btRunning}
          className="flex-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg py-2 transition-all disabled:opacity-50"
        >
          {btRunning ? '⏳ ' : '🔬 '}
          {btRunning ? t('StrategyDetail.btRunning', '回测中...') : t('StrategyDetail.runBacktest', '运行回测')}
        </button>
        <button
          onClick={handleToggleLive}
          className={`flex-1 text-xs rounded-lg py-2 transition-all border ${
            liveStatus === 'running'
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {liveStatus === 'running' ? '⏹ ' : '▶ '}
          {liveStatus === 'running' ? t('StrategyDetail.stopLive', '停止实盘') : t('StrategyDetail.startLive', '启动实盘')}
        </button>
      </div>

      {/* Backtest Result */}
      {btResult && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-300">{t('StrategyDetail.btResult', '回测结果')}</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {btResult.totalReturn !== undefined && (
              <div className="text-center">
                <p className={`text-lg font-mono font-bold ${(btResult.totalReturn || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {((btResult.totalReturn || 0) * 100).toFixed(1)}%
                </p>
                <span className="text-[10px] text-gray-500">{t('StrategyDetail.totalReturn', '总收益')}</span>
              </div>
            )}
            {btResult.sharpeRatio !== undefined && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">{(btResult.sharpeRatio || 0).toFixed(2)}</p>
                <span className="text-[10px] text-gray-500">Sharpe</span>
              </div>
            )}
            {btResult.maxDrawdown !== undefined && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-red-400">{((btResult.maxDrawdown || 0) * 100).toFixed(1)}%</p>
                <span className="text-[10px] text-gray-500">{t('StrategyDetail.maxDD', '最大回撤')}</span>
              </div>
            )}
            {btResult.winRate !== undefined && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-[#C9A046]">{((btResult.winRate || 0) * 100).toFixed(0)}%</p>
                <span className="text-[10px] text-gray-500">{t('StrategyDetail.winRate', '胜率')}</span>
              </div>
            )}
            {btResult.profitFactor !== undefined && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-white">{(btResult.profitFactor || 0).toFixed(2)}</p>
                <span className="text-[10px] text-gray-500">{t('StrategyDetail.pf', '盈亏比')}</span>
              </div>
            )}
            {btResult.totalTrades !== undefined && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-gray-300">{btResult.totalTrades}</p>
                <span className="text-[10px] text-gray-500">{t('StrategyDetail.trades', '交易次数')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="pt-4 border-t border-white/5">
        <button
          onClick={handleDelete}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
        >
          🗑️ {t('StrategyDetail.delete', '删除此策略')}
        </button>
        <p className="text-[10px] text-gray-700 mt-1">
          ID: {strategyId}
        </p>
      </div>
    </div>
  );
};

export default StrategyDetail;
