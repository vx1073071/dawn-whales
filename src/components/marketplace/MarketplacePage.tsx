import React, { useState } from 'react';

// ── Mock Data ──────────────────────────────────────────────────────────────

interface StrategyCard {
  id: string;
  title: string;
  author: string;
  rating: number;
  reviews: number;
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  market: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  subscribers: number;
  priceMonthly: number;
  verified: boolean;
  equityCurve: number[];
}

const MOCK_STRATEGIES: StrategyCard[] = [
  {
    id: 'ms001', title: '动量轮动 Pro', author: 'quantmaster', rating: 4.8, reviews: 126,
    annualReturn: 28.3, sharpe: 1.8, maxDrawdown: 12, winRate: 62, profitFactor: 2.1,
    market: '美股', tags: ['科技', '月度轮动'], riskLevel: 'medium', subscribers: 234,
    priceMonthly: 49.9, verified: true,
    equityCurve: [100, 103, 107, 105, 112, 118, 115, 122, 128, 125, 132, 138],
  },
  {
    id: 'ms002', title: '信仰战法 v2', author: 'alpha_hunter', rating: 4.9, reviews: 89,
    annualReturn: 35.1, sharpe: 2.1, maxDrawdown: 18, winRate: 48, profitFactor: 3.2,
    market: '美股', tags: ['杠杆ETF', 'TQQQ', '加仓'], riskLevel: 'high', subscribers: 156,
    priceMonthly: 99.9, verified: true,
    equityCurve: [100, 108, 95, 115, 125, 110, 135, 145, 130, 155, 165, 170],
  },
  {
    id: 'ms003', title: '稳健双均线', author: 'safe_trader', rating: 4.5, reviews: 203,
    annualReturn: 14.2, sharpe: 1.4, maxDrawdown: 8, winRate: 58, profitFactor: 1.8,
    market: '美股', tags: ['趋势', '均线'], riskLevel: 'low', subscribers: 412,
    priceMonthly: 0, verified: true,
    equityCurve: [100, 101, 103, 102, 105, 107, 106, 109, 111, 110, 113, 114],
  },
  {
    id: 'ms004', title: '港股价值选股', author: 'hk_quant', rating: 4.3, reviews: 67,
    annualReturn: 19.5, sharpe: 1.2, maxDrawdown: 15, winRate: 55, profitFactor: 1.6,
    market: '港股', tags: ['价值', '基本面'], riskLevel: 'medium', subscribers: 98,
    priceMonthly: 29.9, verified: false,
    equityCurve: [100, 98, 103, 106, 102, 108, 112, 109, 115, 118, 116, 120],
  },
  {
    id: 'ms005', title: 'RSI 超卖反弹', author: 'mean_reversion', rating: 4.6, reviews: 154,
    annualReturn: 16.8, sharpe: 1.5, maxDrawdown: 10, winRate: 65, profitFactor: 2.0,
    market: '美股', tags: ['均值回归', 'RSI'], riskLevel: 'low', subscribers: 287,
    priceMonthly: 19.9, verified: true,
    equityCurve: [100, 102, 101, 104, 106, 105, 108, 110, 109, 112, 114, 117],
  },
  {
    id: 'ms006', title: '网格交易 · 震荡市利器', author: 'grid_master', rating: 4.4, reviews: 91,
    annualReturn: 22.1, sharpe: 1.6, maxDrawdown: 11, winRate: 72, profitFactor: 1.9,
    market: '美股', tags: ['震荡', '网格'], riskLevel: 'medium', subscribers: 165,
    priceMonthly: 39.9, verified: true,
    equityCurve: [100, 102, 104, 103, 106, 108, 107, 110, 112, 111, 115, 118],
  },
  {
    id: 'ms007', title: '海龟交易法 · 经典复刻', author: 'turtle_fund', rating: 4.7, reviews: 178,
    annualReturn: 21.5, sharpe: 1.3, maxDrawdown: 20, winRate: 42, profitFactor: 2.5,
    market: '美股', tags: ['趋势', '通道突破', 'ATR'], riskLevel: 'high', subscribers: 201,
    priceMonthly: 59.9, verified: true,
    equityCurve: [100, 95, 105, 115, 108, 120, 130, 118, 135, 140, 132, 148],
  },
  {
    id: 'ms008', title: '多因子选股 Alpha', author: 'factor_lab', rating: 4.2, reviews: 45,
    annualReturn: 18.7, sharpe: 1.7, maxDrawdown: 9, winRate: 56, profitFactor: 1.7,
    market: 'A股', tags: ['多因子', '选股'], riskLevel: 'medium', subscribers: 73,
    priceMonthly: 69.9, verified: false,
    equityCurve: [100, 101, 104, 103, 107, 109, 108, 112, 114, 113, 117, 119],
  },
];

type Tab = 'hot' | 'return' | 'stable' | 'new' | 'free';
type RiskFilter = 'all' | 'low' | 'medium' | 'high';

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('hot');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = MOCK_STRATEGIES
    .filter((s) => riskFilter === 'all' || s.riskLevel === riskFilter)
    .filter((s) => !searchQuery || s.title.includes(searchQuery) || s.tags.some((t) => t.includes(searchQuery)));

  const sorted = [...filtered].sort((a, b) => {
    switch (activeTab) {
      case 'return': return b.annualReturn - a.annualReturn;
      case 'stable': return b.sharpe - a.sharpe;
      case 'new': return 0; // already ordered
      case 'free': return a.priceMonthly - b.priceMonthly;
      default: return b.subscribers - a.subscribers; // hot
    }
  });

  const selected = sorted.find((s) => s.id === selectedId);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🏪 策略市场</h1>
          <p className="text-gray-400 text-sm">发现优质策略，一键订阅跟单</p>
        </div>
        <button className="px-4 py-2 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-bright transition-colors">
          📤 发布我的策略
        </button>
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
          {([['hot', '🔥 热度'], ['return', '📈 收益'], ['stable', '🛡️ 稳健'], ['new', '🆕 新星'], ['free', '🆓 免费']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === key ? 'bg-primary text-black' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 text-xs">
          {([['all', '全部'], ['low', '低风险'], ['medium', '中风险'], ['high', '高风险']] as [RiskFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRiskFilter(key)}
              className={`px-2.5 py-1 rounded transition-colors ${
                riskFilter === key ? 'bg-surface-3 text-gray-200' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索策略..."
          className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 w-48 focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Content area */}
      <div className="flex gap-4">
        {/* Strategy grid */}
        <div className="flex-1 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start">
          {sorted.map((s) => (
            <StrategyCardItem
              key={s.id}
              strategy={s}
              selected={s.id === selectedId}
              onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
            />
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <StrategyDetail strategy={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Strategy Card ──────────────────────────────────────────────────────────

function StrategyCardItem({ strategy: s, selected, onClick }: { strategy: StrategyCard; selected: boolean; onClick: () => void }) {
  const riskColor = s.riskLevel === 'low' ? 'text-green-400 bg-green-400/10' : s.riskLevel === 'medium' ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10';
  const riskLabel = s.riskLevel === 'low' ? '低风险' : s.riskLevel === 'medium' ? '中风险' : '高风险';
  const returnColor = s.annualReturn >= 0 ? 'text-up' : 'text-down';

  return (
    <button
      onClick={onClick}
      className={`bg-surface-2 border rounded-xl p-4 text-left transition-all hover:border-border-light ${
        selected ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-white text-sm font-medium truncate">{s.title}</h3>
            {s.verified && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded flex-shrink-0">✓ 认证</span>}
          </div>
          <div className="text-gray-500 text-[11px] mt-0.5">@{s.author} · ⭐{s.rating} ({s.reviews})</div>
        </div>
      </div>

      {/* Mini equity curve */}
      <div className="h-12 mb-3">
        <MiniChart data={s.equityCurve} positive={s.annualReturn >= 0} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className={`text-sm font-mono font-bold ${returnColor}`}>{s.annualReturn}%</div>
          <div className="text-[10px] text-gray-500">年化</div>
        </div>
        <div>
          <div className="text-sm font-mono text-gray-200">{s.sharpe}</div>
          <div className="text-[10px] text-gray-500">夏普</div>
        </div>
        <div>
          <div className="text-sm font-mono text-gray-200">{s.maxDrawdown}%</div>
          <div className="text-[10px] text-gray-500">回撤</div>
        </div>
      </div>

      {/* Tags + risk */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${riskColor}`}>⚠️ {riskLabel}</span>
        <span className="text-[10px] text-gray-500 bg-surface-3 px-1.5 py-0.5 rounded">{s.market}</span>
        {s.tags.slice(0, 2).map((t) => (
          <span key={t} className="text-[10px] text-gray-400 bg-surface-3 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="text-gray-500 text-[11px]">👥 {s.subscribers}人订阅</div>
        <div className={`text-sm font-bold ${s.priceMonthly === 0 ? 'text-green-400' : 'text-primary'}`}>
          {s.priceMonthly === 0 ? '免费' : `¥${s.priceMonthly}/月`}
        </div>
      </div>
    </button>
  );
}

// ── Mini Chart ─────────────────────────────────────────────────────────────

function MiniChart({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const color = positive ? '#f85149' : '#3fb950';
  const fillColor = positive ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${positive ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points.join(' ')} ${w},${h}`}
        fill={`url(#grad-${positive ? 'up' : 'down'})`}
      />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Strategy Detail Panel ──────────────────────────────────────────────────

function StrategyDetail({ strategy: s, onClose }: { strategy: StrategyCard; onClose: () => void }) {
  const [followMode, setFollowMode] = useState<'auto' | 'semi' | 'notify'>('auto');

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5 sticky top-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">{s.title}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
      </div>

      {/* Author */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
        <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-primary text-sm font-bold">
          {s.author[0].toUpperCase()}
        </div>
        <div>
          <div className="text-gray-200 text-sm">@{s.author}</div>
          <div className="text-gray-500 text-[11px]">⭐ {s.rating} · {s.reviews} 条评价 · {s.subscribers} 订阅</div>
        </div>
        {s.verified && (
          <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full">✓ 实盘认证</span>
        )}
      </div>

      {/* Performance grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricBox label="年化收益" value={`${s.annualReturn}%`} color={s.annualReturn >= 0 ? 'text-up' : 'text-down'} />
        <MetricBox label="夏普比率" value={String(s.sharpe)} />
        <MetricBox label="最大回撤" value={`${s.maxDrawdown}%`} />
        <MetricBox label="胜率" value={`${s.winRate}%`} />
        <MetricBox label="盈亏比" value={String(s.profitFactor)} />
        <MetricBox label="订阅人数" value={String(s.subscribers)} />
      </div>

      {/* Equity curve */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs mb-2">收益曲线</div>
        <div className="h-24 bg-surface-1 rounded-lg p-2">
          <MiniChart data={s.equityCurve} positive={s.annualReturn >= 0} />
        </div>
      </div>

      {/* Follow mode */}
      <div className="mb-4">
        <div className="text-gray-400 text-xs mb-2">跟单模式</div>
        <div className="flex gap-2">
          {([['auto', '⚡ 全自动'], ['semi', '👆 半自动'], ['notify', '🔔 仅通知']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setFollowMode(mode)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs transition-colors ${
                followMode === mode ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-3 text-gray-400 border border-transparent hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-gray-500 text-[11px] mt-2">
          {followMode === 'auto' && '策略信号自动下单执行'}
          {followMode === 'semi' && '推送信号，你确认后执行'}
          {followMode === 'notify' && '只推送通知，不执行交易'}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-400 text-sm">价格</div>
          <div className={`text-xl font-bold ${s.priceMonthly === 0 ? 'text-green-400' : 'text-primary'}`}>
            {s.priceMonthly === 0 ? '免费' : `¥${s.priceMonthly}/月`}
          </div>
        </div>

        {s.priceMonthly > 0 && (
          <div className="text-gray-500 text-[11px] mb-3 text-center">
            年付 ¥{Math.round(s.priceMonthly * 10)}/年（省 {Math.round((1 - 10/12) * 100)}%）
          </div>
        )}

        <button className="w-full py-2.5 bg-primary text-black font-semibold rounded-lg text-sm hover:bg-primary-bright transition-colors">
          {s.priceMonthly === 0 ? '免费使用' : '立即订阅'}
        </button>

        {s.priceMonthly > 0 && (
          <button className="w-full py-2 mt-2 bg-surface-3 text-gray-300 rounded-lg text-sm hover:bg-surface-hover transition-colors">
            免费试用 7 天
          </button>
        )}

        {/* Revenue split info */}
        <div className="mt-3 text-center text-[10px] text-gray-600">
          平台服务费 30% · 创作者收入 70%
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = 'text-gray-200' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-1 rounded-lg p-2.5 text-center">
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
