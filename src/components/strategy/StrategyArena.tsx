// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface ArenaContender {
  id: string; name: string; oneLiner: string; author: { name: string; avatar: string; };
  annualReturn: number; maxDrawdown: number; winRate: number; sharpe: number;
  votes: number; rank: number; isWinner: boolean;
  category: string; market: string;
}

interface ArenaBattle {
  id: string; round: string; title: string; contenders: ArenaContender[];
  totalVotes: number; endsIn: string; status: 'live' | 'ended';
  prize: number;
}

/* ====== Mock Data ====== */
const mockBattles: ArenaBattle[] = [
  {
    id: 'b1', round: '第8期', title: '🏆 本周最强趋势策略', status: 'live', totalVotes: 847, endsIn: '2天3小时', prize: 50,
    contenders: [
      { id: 'c1', name: 'MACD双均线', oneLiner: '你跟着金叉买死叉卖', author: { name: 'QuantWhale', avatar: '🐋' }, annualReturn: 22, maxDrawdown: 18, winRate: 58, sharpe: 1.2, votes: 423, rank: 1, isWinner: false, category: '趋势跟踪', market: 'US/HK' },
      { id: 'c2', name: '海龟交易法', oneLiner: '你突破20日高点才买', author: { name: 'TurtleMaster', avatar: '🐢' }, annualReturn: 35, maxDrawdown: 30, winRate: 45, sharpe: 1.17, votes: 248, rank: 2, isWinner: false, category: '趋势跟踪', market: 'US/CN' },
      { id: 'c3', name: 'EMA趋势+ATR', oneLiner: '你顺着均线方向买', author: { name: 'TrendRider', avatar: '🏄' }, annualReturn: 18, maxDrawdown: 15, winRate: 55, sharpe: 1.2, votes: 176, rank: 3, isWinner: false, category: '趋势跟踪', market: 'US/HK' }
    ]
  },
  {
    id: 'b2', round: '第7期', title: '💸 最佳收息策略', status: 'ended', totalVotes: 1234, endsIn: '已结束', prize: 50,
    contenders: [
      { id: 'c4', name: '高息股组合', oneLiner: '你买分红>4%躺收5-8%', author: { name: 'DividendHunter', avatar: '💸' }, annualReturn: 10, maxDrawdown: 8, winRate: 78, sharpe: 1.25, votes: 678, rank: 1, isWinner: true, category: '价值投资', market: 'HK/CN' },
      { id: 'c5', name: 'REITs收租组合', oneLiner: '你买商业地产REIT收租', author: { name: 'PropertyKing', avatar: '🏢' }, annualReturn: 8, maxDrawdown: 6, winRate: 82, sharpe: 1.33, votes: 389, rank: 2, isWinner: false, category: '不动产', market: 'US' },
      { id: 'c6', name: '债券阶梯', oneLiner: '你构建到期日阶梯债券', author: { name: 'BondGuy', avatar: '📜' }, annualReturn: 5, maxDrawdown: 3, winRate: 92, sharpe: 1.67, votes: 167, rank: 3, isWinner: false, category: '固收', market: 'US' }
    ]
  }
];

/* ====== Sub-Components ====== */

const ContenderCard = ({ c, isLeading }: { c: ArenaContender; isLeading: boolean }) => {
  const rankColors = {
    1: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    2: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white',
    3: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white'
  };
  return (
    <div className={`rounded-lg border ${isLeading ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 p-3 mb-2 transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full ${c.rank <= 3 ? rankColors[c.rank] : 'bg-gray-200'} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
          {c.isWinner ? '👑' : `#${c.rank}`}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span>{c.author.avatar}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.name}</span>
            {c.isWinner && <span className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">🏆 冠军</span>}
          </div>
          <p className="text-xs text-gray-500 mb-1">{c.oneLiner}</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600 font-bold">+{c.annualReturn}%</span>
            <span className="text-red-500">-{c.maxDrawdown}%</span>
            <span className="text-gray-500">{c.winRate}%胜率</span>
            <span className="text-blue-600">夏普{c.sharpe}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-amber-600">{c.votes}</p>
          <p className="text-xs text-gray-400">票</p>
        </div>
      </div>
      {/* Vote progress bar */}
      <div className="mt-2">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${c.rank === 1 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' : c.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'}`} style={{ width: `${(c.votes / 847) * 100}%` }} />
        </div>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function StrategyArena() {
  const [activeBattle, setActiveBattle] = useState<string>('b1');
  const [userVote, setUserVote] = useState<string | null>(null);

  const battle = mockBattles.find(b => b.id === activeBattle) || mockBattles[0];

  const handleVote = (contenderId: string) => {
    if (battle.status === 'ended' || userVote) return;
    setUserVote(contenderId);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">⚔️ 策略竞技场</h2>
            <p className="text-xs text-white/80">投票选出最强策略 · 冠军上首页 · 创作者赢US$50奖金</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">🔥 进行中</span>
        </div>
      </div>

      {/* Battle Selector */}
      <div className="flex gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {mockBattles.map(b => (
          <button key={b.id} onClick={() => setActiveBattle(b.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${activeBattle === b.id ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-400' : 'text-gray-500 hover:bg-gray-100'}`}>
            {b.round} · {b.title.slice(0, 15)}...
          </button>
        ))}
      </div>

      {/* Battle Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{battle.title}</h3>
            <p className="text-xs text-gray-500">{battle.round} · {battle.totalVotes.toLocaleString()} 票 · {battle.contenders.length} 个参赛策略</p>
          </div>
          <div className="text-right">
            {battle.status === 'live' ? (
              <>
                <p className="text-xs text-amber-600 font-bold">⏳ {battle.endsIn} 后截止</p>
                <p className="text-xs text-gray-400">奖金 US${battle.prize}</p>
              </>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">已结束</span>
            )}
          </div>
        </div>
        {battle.status === 'live' && !userVote && (
          <p className="text-xs text-blue-600 font-medium">👇 点击策略卡片投票，每人每期1票</p>
        )}
        {userVote && (
          <p className="text-xs text-green-600 font-medium">✅ 你已投票！等待结果揭晓</p>
        )}
      </div>

      {/* Contenders */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {battle.contenders.map(c => (
          <div key={c.id} onClick={() => handleVote(c.id)} className={battle.status === 'live' && !userVote ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''}>
            <ContenderCard c={c} isLeading={c.rank === 1} />
          </div>
        ))}
      </div>

      {/* Leaderboard Summary */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">📊 排行榜</h4>
        <div className="space-y-1">
          {[...battle.contenders].sort((a, b) => b.votes - a.votes).map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <span className={`w-5 text-center font-bold ${i === 0 ? 'text-amber-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>#{i + 1}</span>
              <span>{c.author.avatar}</span>
              <span className="text-gray-700 font-medium">{c.name}</span>
              <span className="text-amber-600 font-bold ml-auto">{c.votes}票</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>⚔️ 每周一期 · 创作者赢奖金 · 策略上首页</span>
        <button className="text-blue-600 font-medium">提交我的策略 →</button>
      </div>
    </div>
  );
}
