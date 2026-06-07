/**
 * MarketplaceDetail — Strategy detail page with metrics + subscribe
 * (ML-46-01, R46 Phase 6.3)
 */

import React, { useState, useMemo } from 'react';

interface MarketplaceDetailProps {
  strategyId: string;
  onClose?: () => void;
  className?: string;
}

interface StrategyDetail {
  id: string;
  name: string;
  author: string;
  type: string;
  description: string;
  longDescription: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  annualVol: number;
  calmarRatio: number;
  tradeCount: number;
  subscribers: number;
  rating: number;
  reviewCount: number;
  price: 'free' | 'paid';
  priceAmount: number;
  tags: string[];
  createdAt: string;
  weeklyReturns: number[];
}

const MOCK_DETAIL: StrategyDetail = {
  id: 'strat-001',
  name: '双均线交叉 v3',
  author: 'ML',
  type: 'MA_CROSS',
  description: '经典双均线交叉策略，快线上穿慢线做多，下穿做空。经过 3 年历史回测验证。',
  longDescription: '本策略基于 10 日和 30 日移动平均线的交叉信号。当快线（10 日）上穿慢线（30 日），发出买入信号；当快线下穿慢线，发出卖出信号。策略配备 5% 止损和 10% 止盈，有效控制风险。\n\n回测期间: 2023-01-01 至 2026-05-31\n年化收益: 35%\n最大回撤: -12%\n夏普比率: 2.1\n\n适用于 A 股和港股市场的中频交易。建议单次仓位不超过总资产的 5%。',
  sharpe: 2.1, totalReturn: 0.35, maxDrawdown: -0.12, winRate: 0.58,
  annualVol: 0.18, calmarRatio: 2.9, tradeCount: 245,
  subscribers: 128, rating: 4.7, reviewCount: 34,
  price: 'free', priceAmount: 0,
  tags: ['趋势跟踪', '均线', '中频', 'A股', '港股'],
  createdAt: '2026-05-15',
  weeklyReturns: [2.1, -0.5, 3.2, 1.8, -1.2, 4.0, 0.3, 2.5, -0.8, 3.6, 1.1, 2.9],
};

export const MarketplaceDetail: React.FC<MarketplaceDetailProps> = ({ strategyId: _id, onClose, className }) => {
  const [subscribed, setSubscribed] = useState(false);
  const detail = MOCK_DETAIL;

  const weeklyChart = useMemo(() => {
    const max = Math.max(...detail.weeklyReturns.map(Math.abs));
    return detail.weeklyReturns
      .map((v, i) => `${(i / (detail.weeklyReturns.length - 1)) * 100},${50 - (v / (max || 1)) * 40}`)
      .join(' ');
  }, [detail.weeklyReturns]);

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Back button */}
      {onClose && (
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 mb-3">
          ← 返回市场
        </button>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">{detail.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded">{detail.type}</span>
            <span className="text-[10px] text-gray-500">by {detail.author}</span>
            <span className="text-[10px] text-amber-400">⭐ {detail.rating}</span>
            <span className="text-[10px] text-gray-600">({detail.reviewCount} 评价)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${
            detail.price === 'free' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {detail.price === 'free' ? '免费' : `¥${detail.priceAmount}`}
          </span>
          <span className="text-[10px] text-gray-600">{detail.subscribers} 订阅</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {([
          ['Sharpe', detail.sharpe.toFixed(1), 'text-amber-400'],
          ['年化收益', `${(detail.totalReturn * 100).toFixed(0)}%`, 'text-emerald-400'],
          ['最大回撤', `${(detail.maxDrawdown * 100).toFixed(0)}%`, 'text-red-400'],
          ['胜率', `${(detail.winRate * 100).toFixed(0)}%`, 'text-blue-400'],
          ['年化波动', `${(detail.annualVol * 100).toFixed(0)}%`, 'text-purple-400'],
          ['Calmar', detail.calmarRatio.toFixed(1), 'text-cyan-400'],
          ['交易次数', String(detail.tradeCount), 'text-gray-400'],
          ['创建日期', detail.createdAt, 'text-gray-500'],
        ] as const).map(([label, val, color]) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 text-center">
            <div className="text-[10px] text-gray-500">{label}</div>
            <div className={`text-sm font-bold mt-0.5 ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Weekly returns chart */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 mb-5">
        <h4 className="text-xs font-semibold text-gray-400 mb-3">周收益走势</h4>
        <svg viewBox="0 0 100 100" className="w-full h-24">
          <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={weeklyChart} />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
        </svg>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-5">
        {detail.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">{tag}</span>
        ))}
      </div>

      {/* Description */}
      <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700/30 mb-5">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">策略说明</h4>
        <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{detail.longDescription}</p>
      </div>

      {/* Subscribe button */}
      <button
        onClick={() => setSubscribed(s => !s)}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
          subscribed
            ? 'bg-gray-800 border border-gray-700 text-gray-400'
            : 'bg-amber-500 text-black hover:bg-amber-400'
        }`}
      >
        {subscribed ? '✓ 已订阅' : '订阅策略'}
      </button>
    </div>
  );
};

export default MarketplaceDetail;
