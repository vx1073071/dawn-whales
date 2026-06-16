// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface DailyPick {
  rank: number; symbol: string; name: string; market: string;
  signal: string; reason: string; confidence: number; // %
  expectedReturn: string; risk: 'low' | 'medium' | 'high';
  factors: string[]; action: 'BUY' | 'HOLD' | 'SELL';
}

/* ====== Mock Data ====== */
const top5Picks: DailyPick[] = [
  { rank: 1, symbol: 'NVDA', name: 'NVIDIA', market: 'US', signal: '财报超预期+盘后涨8%', reason: 'Q2营收$42B超预期10%，Q3指引上调至$45B。AI芯片需求潮还在加速。机构资金连续5日净流入。', confidence: 92, expectedReturn: '+5-8% (7天)', risk: 'medium', factors: ['机构资金', '12月动量', '新闻情绪'], action: 'BUY' },
  { rank: 2, symbol: '00700', name: '腾讯控股', market: 'HK', signal: '南向资金连续5日净买入', reason: '本周南向资金净买入超500亿港元，腾讯为最大受益者。估值PE 22x处于5年低位，云业务东南亚扩张加速。', confidence: 85, expectedReturn: '+3-5% (7天)', risk: 'low', factors: ['北向资金', 'PE估值', '行业动量'], action: 'BUY' },
  { rank: 3, symbol: 'GLD', name: '黄金ETF', market: 'US', signal: '央行持续购金+地缘避险', reason: '金价$3,500创历史新高。中国央行5月增持50吨。全球央行年购金量1200吨。Fed降息预期支撑金价。', confidence: 88, expectedReturn: '+2-4% (14天)', risk: 'low', factors: ['宏观周期', '波动率', '美元指数'], action: 'BUY' },
  { rank: 4, symbol: 'BTC', name: 'Bitcoin', market: 'CRYPTO', signal: 'ETF净流入$2.8B+突破$120K', reason: '现货ETF连续多日净流入。期权最大痛点$115K已被突破。Gamma挤压推高至$130K可能。鲸鱼链上持续增持。', confidence: 78, expectedReturn: '+8-15% (14天)', risk: 'high', factors: ['交易所资金流', '稳定币铸币', '社交热度'], action: 'BUY' },
  { rank: 5, symbol: 'XLP', name: '消费必需品ETF', market: 'US', signal: '防御板块轮动信号', reason: '科技板块涨幅已高，资金开始轮动至防御板块。XLP过去1周资金流入创3个月新高。VIX偏低，但防御配置有意义。', confidence: 72, expectedReturn: '+1-3% (30天)', risk: 'low', factors: ['行业轮动', 'Beta', '波动率'], action: 'BUY' }
];

/* ====== Sub-Components ====== */

const RankMedal = ({ rank }: { rank: number }) => {
  const colors = {
    1: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
    2: 'bg-gradient-to-r from-gray-300 to-gray-400 text-white',
    3: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white',
    4: 'bg-gray-200 text-gray-600',
    5: 'bg-gray-200 text-gray-600'
  };
  const emojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '4', 5: '5' };
  return (
    <div className={`w-8 h-8 rounded-full ${colors[rank] || colors[5]} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
      {emojis[rank] || rank}
    </div>
  );
};

const ConfidenceGauge = ({ pct }: { pct: number }) => {
  const color = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-orange-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold ${pct >= 85 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-orange-600'}`}>{pct}%</span>
    </div>
  );
};

const RiskBadge = ({ risk }: { risk: string }) => {
  const map: Record<string, string> = {
    low: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700'
  };
  const icon: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${map[risk]}`}>{icon[risk]} {risk}</span>;
};

const PickCard = ({ pick, expandedId, onToggle }: { pick: DailyPick; expandedId: string | null; onToggle: (id: string) => void }) => {
  const isExpanded = expandedId === `p${pick.rank}`;
  const actionColor = pick.action === 'BUY' ? 'bg-green-600 hover:bg-green-700' : pick.action === 'SELL' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500 hover:bg-gray-600';
  
  return (
    <div className={`rounded-xl border ${pick.rank === 1 ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 overflow-hidden transition-all hover:shadow-md`}>
      <div className="p-3 cursor-pointer" onClick={() => onToggle(`p${pick.rank}`)}>
        <div className="flex items-center gap-3">
          <RankMedal rank={pick.rank} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{pick.symbol}</span>
              <span className="text-xs text-gray-400">{pick.name}</span>
              <span className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{pick.market}</span>
              <RiskBadge risk={pick.risk} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{pick.signal}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-green-600 dark:text-green-400">{pick.expectedReturn}</p>
            <ConfidenceGauge pct={pick.confidence} />
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{pick.reason}</p>
          <div className="flex items-center gap-1 mb-2">
            {pick.factors.map(f => <span key={f} className="px-1.5 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">{f}</span>)}
          </div>
          <div className="flex gap-2">
            <button className={`flex-1 py-1.5 rounded-lg ${actionColor} text-white text-xs font-bold`}>
              {pick.action === 'BUY' ? '买入' : pick.action === 'SELL' ? '卖出' : '持有'}
            </button>
            <button className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">加入自选</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ====== Main Component ====== */

export default function Top5DailyPick() {
  const [expandedId, setExpandedId] = useState<string | null>('p1');

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🏆 每日精选 Top 5</h2>
            <p className="text-xs text-white/80">综合12因子+新闻+资金流排序 · 每日8AM更新</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-bold">0.99U/天</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">免费3天</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">2026-06-17 更新</span>
          <div className="flex items-center gap-3">
            <span className="text-green-600 font-bold">4买入 · 1持有</span>
            <span className="text-gray-400">平均置信度 83%</span>
          </div>
        </div>
      </div>

      {/* Picks */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {top5Picks.map(p => <PickCard key={p.rank} pick={p} expandedId={expandedId} onToggle={setExpandedId} />)}
      </div>

      {/* Performance */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">📊 历史表现</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: '本周胜率', value: '80%', color: 'text-green-600' },
            { label: '本月胜率', value: '72%', color: 'text-green-600' },
            { label: '平均收益', value: '+4.2%', color: 'text-green-600' }
          ].map(s => (
            <div key={s.label} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>💡</span>
          <span>免费试用3天 · 之后0.99U/天</span>
        </div>
        <button className="text-blue-600 font-bold">订阅 →</button>
      </div>
    </div>
  );
}
