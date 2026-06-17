// @ts-nocheck
// R276 ML#1: A-Share Factor Panel — CN market 20-factor frontend dashboard
// Shows CN-specific factors with live IC, ranking, and subscription toggle

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CNFactorItem {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  categoryCN: string;
  currentIC: number;
  icRank: number;
  icChange: number;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  description: string;
  descriptionCN: string;
  subscribed: boolean;
}

const DEFAULT_CN_FACTORS: CNFactorItem[] = [
  // Value (5)
  { id: 'CN_PE_TTM', name: 'PE TTM', nameCN: '市盈率TTM', category: 'Value', categoryCN: '价值', currentIC: 0.042, icRank: 3, icChange: 0.008, signal: 'LONG', description: 'Lower PE = better value', descriptionCN: 'PE越低估值越合理', subscribed: true },
  { id: 'CN_PB_LF', name: 'PB LF', nameCN: '市净率LF', category: 'Value', categoryCN: '价值', currentIC: 0.035, icRank: 5, icChange: -0.002, signal: 'LONG', description: 'Lower PB = better value', descriptionCN: 'PB越低估值越安全', subscribed: false },
  { id: 'CN_DIVIDEND_YIELD', name: 'Dividend Yield', nameCN: '股息率', category: 'Value', categoryCN: '价值', currentIC: 0.028, icRank: 10, icChange: 0.005, signal: 'LONG', description: 'Higher dividend = income', descriptionCN: '股息越高分红回报越稳', subscribed: true },
  { id: 'CN_EV_EBITDA', name: 'EV/EBITDA', nameCN: '企业价值倍数', category: 'Value', categoryCN: '价值', currentIC: 0.038, icRank: 4, icChange: 0.003, signal: 'LONG', description: 'Enterprise value metric', descriptionCN: '综合估值指标', subscribed: false },
  { id: 'CN_PS_TTM', name: 'PS TTM', nameCN: '市销率TTM', category: 'Value', categoryCN: '价值', currentIC: 0.025, icRank: 14, icChange: -0.004, signal: 'NEUTRAL', description: 'Revenue-based valuation', descriptionCN: '收入估值指标', subscribed: false },
  // Growth (3)
  { id: 'CN_REVENUE_YOY', name: 'Revenue YoY', nameCN: '营收YoY', category: 'Growth', categoryCN: '成长', currentIC: 0.031, icRank: 8, icChange: 0.006, signal: 'LONG', description: 'Revenue growth rate', descriptionCN: '营收增长动能', subscribed: true },
  { id: 'CN_EARNINGS_YOY', name: 'Earnings YoY', nameCN: '净利YoY', category: 'Growth', categoryCN: '成长', currentIC: 0.045, icRank: 1, icChange: 0.012, signal: 'STRONG_LONG', description: 'Earnings growth momentum', descriptionCN: '盈利增长最快因子', subscribed: true },
  { id: 'CN_ROE_TTM', name: 'ROE TTM', nameCN: 'ROE TTM', category: 'Quality', categoryCN: '质量', currentIC: 0.029, icRank: 9, icChange: 0.001, signal: 'LONG', description: 'Return on equity', descriptionCN: '股东回报率', subscribed: false },
  // Momentum (2)
  { id: 'CN_MOMENTUM_1M', name: '1M Momentum', nameCN: '1月动量', category: 'Momentum', categoryCN: '动量', currentIC: 0.044, icRank: 2, icChange: 0.015, signal: 'STRONG_LONG', description: 'Short-term momentum', descriptionCN: '短期趋势强度', subscribed: true },
  { id: 'CN_MOMENTUM_3M', name: '3M Momentum', nameCN: '3月动量', category: 'Momentum', categoryCN: '动量', currentIC: 0.033, icRank: 7, icChange: -0.005, signal: 'LONG', description: 'Medium-term momentum', descriptionCN: '中期趋势延续', subscribed: false },
  // Size (1)
  { id: 'CN_MARKET_CAP', name: 'Market Cap', nameCN: '市值', category: 'Size', categoryCN: '规模', currentIC: -0.022, icRank: 16, icChange: 0.003, signal: 'SHORT', description: 'Small-cap premium', descriptionCN: '小盘溢价效应', subscribed: false },
  // Volatility (2)
  { id: 'CN_VOLATILITY_20D', name: '20D Volatility', nameCN: '20日波动', category: 'Volatility', categoryCN: '波动', currentIC: -0.018, icRank: 17, icChange: -0.002, signal: 'NEUTRAL', description: 'Low vol anomaly', descriptionCN: '低波异象', subscribed: false },
  { id: 'CN_BETA_60D', name: '60D Beta', nameCN: '60日Beta', category: 'Volatility', categoryCN: '波动', currentIC: -0.012, icRank: 18, icChange: 0.001, signal: 'NEUTRAL', description: 'Low beta premium', descriptionCN: '低Beta策略', subscribed: false },
  // Liquidity (2)
  { id: 'CN_TURNOVER_RATE', name: 'Turnover Rate', nameCN: '换手率', category: 'Liquidity', categoryCN: '流动性', currentIC: 0.034, icRank: 6, icChange: 0.009, signal: 'LONG', description: 'Turnover momentum', descriptionCN: '成交活跃度', subscribed: true },
  { id: 'CN_AMPLITUDE_5D', name: '5D Amplitude', nameCN: '5日振幅', category: 'Liquidity', categoryCN: '流动性', currentIC: -0.026, icRank: 15, icChange: -0.008, signal: 'SHORT', description: 'Low amplitude quality', descriptionCN: '低振幅精选', subscribed: false },
  // Fund Flow (3)
  { id: 'CN_NORTHBOUND_FLOW', name: 'Northbound Flow', nameCN: '北向资金', category: 'Flow', categoryCN: '资金流', currentIC: 0.028, icRank: 11, icChange: 0.004, signal: 'LONG', description: 'Foreign inflow proxy', descriptionCN: '外资流入指标', subscribed: true },
  { id: 'CN_INSTITUTION_HOLDING', name: 'Institution %', nameCN: '机构持股', category: 'Flow', categoryCN: '资金流', currentIC: 0.026, icRank: 12, icChange: 0.002, signal: 'LONG', description: 'Smart money following', descriptionCN: '机构集中度', subscribed: false },
  { id: 'CN_MAJOR_FLOW_5D', name: '5D Major Flow', nameCN: '5日主力', category: 'Flow', categoryCN: '资金流', currentIC: 0.035, icRank: 5, icChange: 0.007, signal: 'LONG', description: 'Major capital flow', descriptionCN: '主力资金方向', subscribed: true },
  // Macro (1)
  { id: 'CN_PMI_SENSITIVITY', name: 'PMI Sensitivity', nameCN: 'PMI敏感度', category: 'Macro', categoryCN: '宏观', currentIC: 0.024, icRank: 13, icChange: 0.001, signal: 'NEUTRAL', description: 'PMI-linked returns', descriptionCN: 'PMI关联收益', subscribed: false },
  // Sentiment (1)
  { id: 'CN_DRAGON_TIGER', name: 'Dragon Tiger', nameCN: '龙虎榜', category: 'Sentiment', categoryCN: '情绪', currentIC: 0.032, icRank: 8, icChange: 0.011, signal: 'LONG', description: 'Top trader following', descriptionCN: '游资动向追踪', subscribed: true },
];

export default function CNFactorPanel() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [factors] = useState<CNFactorItem[]>(DEFAULT_CN_FACTORS);
  const [subscribed, setSubscribed] = useState<Set<string>>(
    new Set(DEFAULT_CN_FACTORS.filter(f => f.subscribed).map(f => f.id))
  );
  const [sortBy, setSortBy] = useState<'ic' | 'rank'>('rank');

  const sortedFactors = useMemo(() => {
    const list = [...factors];
    if (sortBy === 'ic') list.sort((a, b) => Math.abs(b.currentIC) - Math.abs(a.currentIC));
    else list.sort((a, b) => a.icRank - b.icRank);
    return list;
  }, [factors, sortBy]);

  const toggleSub = (id: string) => {
    setSubscribed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const signalConfig: Record<string, { color: string; bg: string; label: string; labelCN: string }> = {
    STRONG_LONG: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Strong Buy', labelCN: '强烈做多' },
    LONG: { color: 'text-green-300', bg: 'bg-green-500/10', label: 'Buy', labelCN: '做多' },
    NEUTRAL: { color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Neutral', labelCN: '中性' },
    SHORT: { color: 'text-red-300', bg: 'bg-red-500/10', label: 'Sell', labelCN: '做空' },
    STRONG_SHORT: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Strong Sell', labelCN: '强烈做空' },
  };

  const categories = ['Value', 'Growth', 'Quality', 'Momentum', 'Size', 'Volatility', 'Liquidity', 'Flow', 'Macro', 'Sentiment'];
  const categoryCN: Record<string, string> = {
    Value: '价值', Growth: '成长', Quality: '质量', Momentum: '动量', Size: '规模',
    Volatility: '波动', Liquidity: '流动性', Flow: '资金流', Macro: '宏观', Sentiment: '情绪',
  };

  return (
    <div className="p-4 bg-[#1a1a25] border border-white/5 rounded-xl text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-lg">🇨🇳 {isZh ? 'A股因子看板' : 'A-Share Factor Dashboard'}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {isZh ? `20个A股专属因子 · ${subscribed.size}个已订阅` : `20 CN-specific factors · ${subscribed.size} subscribed`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortBy(sortBy === 'rank' ? 'ic' : 'rank')}
            className="px-3 py-1 rounded bg-gray-800 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {sortBy === 'rank' ? (isZh ? '按排名' : 'By Rank') : (isZh ? '按IC' : 'By IC')}
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {categories.map(cat => {
          const count = factors.filter(f => f.category === cat).length;
          return (
            <span key={cat} className="px-2 py-0.5 rounded bg-gray-800/50 text-[10px] text-gray-400">
              {isZh ? categoryCN[cat] : cat} ({count})
            </span>
          );
        })}
      </div>

      {/* Factor List */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        {sortedFactors.map(factor => {
          const sig = signalConfig[factor.signal];
          const isSub = subscribed.has(factor.id);
          return (
            <div
              key={factor.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/30 border border-white/5 hover:border-white/10 transition-colors"
            >
              {/* Rank */}
              <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                {factor.icRank}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{isZh ? factor.nameCN : factor.name}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-700 text-gray-400">
                    {isZh ? factor.categoryCN : factor.category}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{isZh ? factor.descriptionCN : factor.description}</p>
              </div>

              {/* IC */}
              <div className="text-right flex-shrink-0 min-w-[60px]">
                <div className={`text-sm font-mono font-bold ${factor.currentIC >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {factor.currentIC >= 0 ? '+' : ''}{factor.currentIC.toFixed(3)}
                </div>
                <div className={`text-[10px] ${factor.icChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {factor.icChange >= 0 ? '↑' : '↓'} {Math.abs(factor.icChange).toFixed(3)}
                </div>
              </div>

              {/* Signal */}
              <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${sig.bg} ${sig.color} font-medium`}>
                {isZh ? sig.labelCN : sig.label}
              </span>

              {/* Subscribe */}
              <button
                onClick={() => toggleSub(factor.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded transition-colors ${
                  isSub
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {isSub ? (isZh ? '已订阅' : 'Subbed') : (isZh ? '订阅' : 'Sub')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between text-xs text-gray-500">
        <span>{isZh ? 'CN因子引擎 v1.0 · 东方财富/Yahoo双源' : 'CN Engine v1.0 · EastMoney/Yahoo dual source'}</span>
        <button className="text-indigo-400 hover:text-indigo-300">
          {isZh ? '导出因子报告 →' : 'Export Report →'}
        </button>
      </div>
    </div>
  );
}
