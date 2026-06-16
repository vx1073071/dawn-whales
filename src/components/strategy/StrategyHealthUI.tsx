// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface StrategyHealth {
  id: string; name: string; oneLiner: string;
  healthScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'active' | 'paused' | 'degraded' | 'retired';
  runningDays: number; totalReturn: number; currentDrawdown: number;
  winRate30d: number; winRateAll: number; winRateTrend: 'up' | 'down' | 'stable';
  issues: string[]; recommendations: string[];
}

interface HealthEvent { date: string; icon: string; title: string; detail: string; }

/* ====== Mock Data ====== */
const mockStrategies: StrategyHealth[] = [
  {
    id: 'sh1', name: 'MACD金叉策略', oneLiner: '你跟着金叉买死叉卖', healthScore: 72, grade: 'B', status: 'degraded',
    runningDays: 186, totalReturn: 22.5, currentDrawdown: -6.8,
    winRate30d: 42, winRateAll: 58, winRateTrend: 'down',
    issues: ['近30天胜率从58%→42%', 'RSI超买信号失效', '盘整市场频繁止损'],
    recommendations: ['暂停手动交易，保持自动观察', '加入成交量过滤条件', '缩小持仓至50%']
  },
  {
    id: 'sh2', name: '高息股组合', oneLiner: '你买分红>4%躺收5-8%', healthScore: 88, grade: 'A', status: 'active',
    runningDays: 245, totalReturn: 12.8, currentDrawdown: -1.2,
    winRate30d: 76, winRateAll: 78, winRateTrend: 'stable',
    issues: [], recommendations: ['维持当前配置', '可考虑加仓至60%']
  },
  {
    id: 'sh3', name: 'BTC链上策略', oneLiner: '你看BTC流出就买', healthScore: 65, grade: 'C', status: 'active',
    runningDays: 120, totalReturn: 18.3, currentDrawdown: -12.5,
    winRate30d: 55, winRateAll: 62, winRateTrend: 'down',
    issues: ['最大回撤-25%超过预设-20%', 'BTC波动率上升'],
    recommendations: ['减仓至25%', '设止损-15%', '等波动率回落再恢复']
  }
];

const mockEvents: Record<string, HealthEvent[]> = {
  'sh1': [
    { date: '6月10日', icon: '⚠️', title: '策略健康度降为B', detail: '连续亏损5笔，MACD信号失灵。市场进入盘整期。' },
    { date: '6月1日', icon: '✅', title: '月收益+3.2%', detail: '5月MACD策略录得+3.2%，跑赢基准2.1%。' },
    { date: '5月15日', icon: '🔄', title: '参数微调', detail: 'MACD快线从12调整为10，慢线从26调整为22。' }
  ],
  'sh2': [
    { date: '6月5日', icon: '💰', title: '分红到账', detail: '持仓5只股票分红到账，合计$1,250。' },
    { date: '5月1日', icon: '✅', title: '策略创历史新高', detail: '累计收益+12.8%，最大回撤仅-1.2%。' }
  ],
  'sh3': [
    { date: '6月14日', icon: '🔴', title: '回撤突破-20%', detail: 'BTC一周内从$125K跌至$110K，策略回撤达-25%。' },
    { date: '6月1日', icon: '📈', title: '策略创新高', detail: 'BTC突破$120K带动策略收益+18.3%。' }
  ]
};

/* ====== Sub-Components ====== */

const GradeBadge = ({ grade }: { grade: string }) => {
  const map: Record<string, string> = {
    A: 'bg-green-500 text-white', B: 'bg-blue-500 text-white', C: 'bg-yellow-500 text-white', D: 'bg-orange-500 text-white', F: 'bg-red-500 text-white'
  };
  return <span className={`w-10 h-10 rounded-full ${map[grade]} flex items-center justify-center text-lg font-bold`}>{grade}</span>;
};

const HealthBar = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold">{score}</span>
    </div>
  );
};

/* ====== Main Component ====== */

export default function StrategyHealthUI() {
  const [selectedId, setSelectedId] = useState<string>(mockStrategies[0].id);
  const strategy = mockStrategies.find(s => s.id === selectedId) || mockStrategies[0];
  const events = mockEvents[selectedId] || [];
  const winRateColor = strategy.winRateTrend === 'up' ? 'text-green-600' : strategy.winRateTrend === 'down' ? 'text-red-500' : 'text-gray-500';
  const statusColor: Record<string, string> = { active: 'bg-green-100 text-green-700', paused: 'bg-gray-100 text-gray-700', degraded: 'bg-yellow-100 text-yellow-700', retired: 'bg-red-100 text-red-700' };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900">🩺 策略健康监测</h2>
        <p className="text-xs text-gray-500">{mockStrategies.length}个策略 · 1个需要关注</p>
      </div>

      {/* Strategy Tabs */}
      <div className="flex gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {mockStrategies.map(s => (
          <button key={s.id} onClick={() => setSelectedId(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${selectedId === s.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
            {s.grade === 'A' ? '🟢' : s.grade === 'B' ? '🔵' : s.grade === 'C' ? '🟡' : '🔴'} {s.name}
          </button>
        ))}
      </div>

      {/* Health Dashboard */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Score + Grade */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-4 mb-3">
            <GradeBadge grade={strategy.grade} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-gray-900">{strategy.name}</h3>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${statusColor[strategy.status]}`}>{strategy.status === 'active' ? '运行中' : strategy.status === 'degraded' ? '退化中' : strategy.status}</span>
              </div>
              <p className="text-xs text-gray-400">{strategy.oneLiner} · 运行{strategy.runningDays}天</p>
            </div>
          </div>
          <HealthBar score={strategy.healthScore} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '累计收益', value: `+${strategy.totalReturn}%`, color: 'text-green-600' },
            { label: '当前回撤', value: `${strategy.currentDrawdown}%`, color: 'text-red-500' },
            { label: '30天胜率', value: `${strategy.winRate30d}%`, color: winRateColor }
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Issues */}
        {strategy.issues.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <h4 className="text-sm font-bold text-red-700 dark:text-red-400 mb-2">🔴 发现问题</h4>
            {strategy.issues.map((issue, i) => (
              <p key={i} className="text-xs text-red-600 leading-relaxed flex items-start gap-1 mb-1">
                <span className="flex-shrink-0">•</span> {issue}
              </p>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {strategy.recommendations.length > 0 && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
            <h4 className="text-sm font-bold text-blue-700 mb-2">💡 建议行动</h4>
            {strategy.recommendations.map((rec, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <p className="text-xs text-blue-600">{rec}</p>
              </div>
            ))}
          </div>
        )}

        {/* Health Timeline */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-2">📅 健康历程</h4>
          {events.map((e, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <span className="text-lg flex-shrink-0">{e.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-400">{e.date}</span>
                  <span className="text-xs font-semibold text-gray-700">{e.title}</span>
                </div>
                <p className="text-xs text-gray-500">{e.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>🩺 自动监测 · 每日健康评分</span>
        <span className="text-blue-600 font-semibold">免费</span>
      </div>
    </div>
  );
}
