import { useTranslation } from "react-i18next";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  source: string;
  url?: string;
  publishedAt: string;
  sentiment?: number; // -1 to 1
  keywords?: string[];
  symbol?: string;
}

interface AnomalySignal {
  id: string;
  symbol: string;
  type: string;
  severity: number;
  message: string;
  timestamp: string;
}

interface EntitySentiment {
  name: string;
  score: number;
  count: number;
}

interface KeywordItem {
  text: string;
  frequency: number;
  sentiment: 'positive' | 'negative';
}

type SentimentLabel = '极度乐观' | '乐观' | '偏乐观' | '中性' | '偏悲观' | '悲观' | '极度悲观';
type TimeRange = '1h' | '4h' | '1d' | '7d';

// ─── Constants ───────────────────────────────────────────────────────────────

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'BTC', 'ETH', 'SPY'];
const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
  { value: '7d', label: '7天' },
];
const SOURCES = [t('components.all'), '新闻', '社交媒体', '公告', '研报'];

const MOOD_LABELS: { min: number; max: number; label: SentimentLabel; color: string }[] = [
  { min: 0.7, max: 1.0, label: '极度乐观', color: '#22c55e' },
  { min: 0.4, max: 0.7, label: '乐观', color: '#4ade80' },
  { min: 0.15, max: 0.4, label: '偏乐观', color: '#86efac' },
  { min: -0.15, max: 0.15, label: '中性', color: '#94a3b8' },
  { min: -0.4, max: -0.15, label: '偏悲观', color: '#fca5a5' },
  { min: -0.7, max: -0.4, label: '悲观', color: '#f87171' },
  { min: -1.0, max: -0.7, label: '极度悲观', color: '#ef4444' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSentimentLabel(score: number): { label: SentimentLabel; color: string } {
  for (const m of MOOD_LABELS) {
    if (score >= m.min && score <= m.max) return { label: m.label, color: m.color };
  }
  return { label: '中性', color: '#94a3b8' };
}

function getSentimentBadgeColor(score: number): string {
  if (score > 0.2) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score < -0.2) return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Mock Data Generator ─────────────────────────────────────────────────────

function generateMockNews(symbol: string, count: number): NewsItem[] {
  const titles = [
    `${symbol} 发布超预期财报，营收同比增长32%`,
    `分析师上调 ${symbol} 目标价至新高`,
    `${symbol} 宣布大规模回购计划`,
    `${symbol} 面临监管审查，股价承压`,
    `市场担忧 ${symbol} 供应链风险`,
    `${symbol} 新产品线获得重大突破`,
    `${symbol} 与行业巨头达成战略合作`,
    `${symbol} CEO 增持公司股份`,
    `${symbol} 海外市场扩张加速`,
    `机构下调 ${symbol} 评级至"持有"`,
    `${symbol} 技术面出现看空信号`,
    `${symbol} 获得政府大额补贴`,
    `空头持仓 ${symbol} 比例创新高`,
    `${symbol} 行业政策利好频出`,
    `${symbol} 宣布裁员计划，市场反应积极`,
  ];
  const sources = ['新闻', '社交媒体', '公告', '研报'];
  const keywordPool = ['财报', '增长', '回购', '监管', t('components.risk'), t('components.breakout'), '合作', t('components.increaseHolding'), '扩张', '评级', '看空', '补贴', '空头', '政策', '裁员'];

  return Array.from({ length: count }, (_, i) => ({
    id: `news-${i}-${Date.now()}`,
    title: titles[i % titles.length],
    summary: `这是关于 ${symbol} 的最新资讯摘要，包含关键市场数据和分析师观点...`,
    source: sources[Math.floor(Math.random() * sources.length)],
    publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600000).toISOString(),
    sentiment: clamp((Math.random() - 0.5) * 2, -1, 1),
    keywords: keywordPool.sort(() => Math.random() - 0.5).slice(0, 3),
    symbol,
  }));
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl ${className}`}>
    {children}
  </div>
);

// ─── Mood Gauge (SVG arc) ────────────────────────────────────────────────────

const MoodGauge: React.FC<{ score: number }> = ({ score }) => {
  const { label, color } = getSentimentLabel(score);
  const normalized = (score + 1) / 2; // 0..1
  // (angle removed, unused)

  const arcPath = (startAngle: number, endAngle: number, radius: number, cx: number, cy: number) => {
    const s = (startAngle * Math.PI) / 180;
    const e = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const segments = [
    { start: 180, end: 205.7, color: '#ef4444' },
    { start: 205.7, end: 231.4, color: '#f87171' },
    { start: 231.4, end: 257.1, color: '#fca5a5' },
    { start: 257.1, end: 282.8, color: '#94a3b8' },
    { start: 282.8, end: 308.5, color: '#86efac' },
    { start: 308.5, end: 334.2, color: '#4ade80' },
    { start: 334.2, end: 360, color: '#22c55e' },
  ];

  const needleAngle = (180 + normalized * 180) * (Math.PI / 180);
  const needleLen = 70;
  const cx = 120, cy = 110;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 140" className="w-56 h-32">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.start, seg.end, 85, cx, cy)}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeLinecap="round"
            opacity={0.8}
          />
        ))}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="white" />
        {/* Labels */}
        <text x="25" y="130" fill="#ef4444" fontSize="9" textAnchor="middle">极度悲观</text>
        <text x="120" y="25" fill="#94a3b8" fontSize="9" textAnchor="middle">{t("components.neutral")}</text>
        <text x="215" y="130" fill="#22c55e" fontSize="9" textAnchor="middle">极度乐观</text>
      </svg>
      <div className="mt-2 text-center">
        <span className="text-2xl font-bold" style={{ color }}>{label}</span>
        <span className="ml-2 text-sm text-gray-400">{(score * 100).toFixed(1)}</span>
      </div>
    </div>
  );
};

// ─── Pie Chart (SVG) ─────────────────────────────────────────────────────────

const SentimentPie: React.FC<{ bullish: number; neutral: number; bearish: number }> = ({ bullish, neutral, bearish }) => {
  const total = bullish + neutral + bearish || 1;
  const slices = [
    { value: bullish, color: '#22c55e', label: t('components.bullish') },
    { value: neutral, color: '#94a3b8', label: '中性' },
    { value: bearish, color: '#ef4444', label: t('components.bearish') },
  ];

  let cumAngle = -90;
  const paths = slices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const s = (startAngle * Math.PI) / 180;
    const e = (endAngle * Math.PI) / 180;
    const r = 50;
    const cx = 60, cy = 60;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const largeArc = angle > 180 ? 1 : 0;

    if (angle < 0.5) return null;
    return (
      <path
        key={slice.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={slice.color}
        opacity={0.85}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
      />
    );
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-24 h-24">{paths}</svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            <span className="text-gray-300">{s.label}</span>
            <span className="text-gray-500">{total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Timeline Chart (SVG) ────────────────────────────────────────────────────

const SentimentTimeline: React.FC<{ data: { time: string; score: number }[] }> = ({ data }) => {
  if (data.length < 2) {
    return <div className="text-gray-500 text-sm text-center py-8">暂无时间线数据</div>;
  }

  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const minT = Math.min(...data.map(d => new Date(d.time).getTime()));
  const maxT = Math.max(...data.map(d => new Date(d.time).getTime()));
  const tRange = maxT - minT || 1;

  const points = data.map((d) => ({
    x: padding.left + ((new Date(d.time).getTime() - minT) / tRange) * plotW,
    y: padding.top + ((1 - d.score) / 2) * plotH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + plotH} L ${points[0].x} ${padding.top + plotH} Z`;

  const gradientId = 'sentiment-gradient';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#94a3b8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[-1, -0.5, 0, 0.5, 1].map((v) => {
        const y = padding.top + ((1 - v) / 2) * plotH;
        return (
          <g key={v}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x={padding.left - 5} y={y + 3} fill="#6b7280" fontSize="9" textAnchor="end">{v.toFixed(1)}</text>
          </g>
        );
      })}
      {/* Zero line */}
      <line
        x1={padding.left}
        y1={padding.top + plotH / 2}
        x2={width - padding.right}
        y2={padding.top + plotH / 2}
        stroke="rgba(255,255,255,0.15)"
        strokeDasharray="4 2"
      />
      {/* Area */}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#60a5fa" opacity="0.7" />
      ))}
    </svg>
  );
};

// ─── Entity Sentiment Bar Chart ──────────────────────────────────────────────

const EntitySentimentChart: React.FC<{ entities: EntitySentiment[] }> = ({ entities }) => {
  const sorted = [...entities].sort((a, b) => b.score - a.score).slice(0, 10);
  const maxAbs = Math.max(...sorted.map(e => Math.abs(e.score)), 0.01);

  return (
    <div className="space-y-2">
      {sorted.map((entity) => {
        const pct = (Math.abs(entity.score) / maxAbs) * 100;
        const isPositive = entity.score >= 0;
        const barColor = isPositive ? 'bg-green-500/70' : 'bg-red-500/70';
        return (
          <div key={entity.name} className="flex items-center gap-2">
            <span className="text-xs text-gray-300 w-16 truncate text-right" title={entity.name}>{entity.name}</span>
            <div className="flex-1 h-5 bg-gray-800/50 rounded overflow-hidden relative">
              <div
                className={`h-full rounded ${barColor} transition-all duration-500`}
                style={{ width: `${pct}%`, marginLeft: isPositive ? '50%' : `${50 - pct}%` }}
              />
              <div className="absolute inset-0 border-l border-white/10" style={{ left: '50%' }} />
            </div>
            <span className={`text-xs w-12 text-right font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {entity.score > 0 ? '+' : ''}{entity.score.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-500 w-8">({entity.count})</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Keyword Cloud ───────────────────────────────────────────────────────────

const KeywordCloud: React.FC<{ keywords: KeywordItem[] }> = ({ keywords }) => {
  const maxFreq = Math.max(...keywords.map(k => k.frequency), 1);

  return (
    <div className="flex flex-wrap gap-2 justify-center items-center py-3">
      {keywords.map((kw) => {
        const size = 12 + (kw.frequency / maxFreq) * 20;
        const color = kw.sentiment === 'positive' ? 'text-green-400' : 'text-red-400';
        return (
          <span
            key={kw.text}
            className={`${color} font-medium hover:scale-110 transition-transform cursor-default`}
            style={{ fontSize: `${size}px` }}
            title={`频率: ${kw.frequency}`}
          >
            {kw.text}
          </span>
        );
      })}
    </div>
  );
};

// ─── News Feed Item ──────────────────────────────────────────────────────────

const NewsFeedItem: React.FC<{ item: NewsItem }> = ({ item }) => {
  const badge = getSentimentBadgeColor(item.sentiment ?? 0);
  const sentimentText = item.sentiment && item.sentiment > 0.2 ? t('components.bullish') : item.sentiment && item.sentiment < -0.2 ? t('components.bearish') : '中性';

  return (
    <div className="flex gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
      <div className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-medium h-fit mt-0.5 ${badge}`}>
        {sentimentText}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
          {item.keywords?.map((kw) => (
            <span key={kw} className="text-blue-400 font-medium">#{kw} </span>
          ))}
          {item.title}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
          <span>{item.source}</span>
          <span>·</span>
          <span>{formatTime(item.publishedAt)}</span>
          {item.symbol && <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">{item.symbol}</span>}
        </div>
      </div>
      {item.sentiment !== undefined && (
        <div className="shrink-0 text-right">
          <span className={`text-xs font-mono ${item.sentiment > 0 ? 'text-green-400' : item.sentiment < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {item.sentiment > 0 ? '+' : ''}{item.sentiment.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Filter Bar ──────────────────────────────────────────────────────────────

interface FilterBarProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (t: TimeRange) => void;
  source: string;
  onSourceChange: (s: string) => void;
  onRefresh: () => void;
  lastUpdate: Date | null;
  loading: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({
  symbol, onSymbolChange, timeRange, onTimeRangeChange,
  source, onSourceChange, onRefresh, lastUpdate, loading,
}) => (
  <GlassCard className="p-3 flex flex-wrap items-center gap-3">
    {/* Symbol selector */}
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400">标的</span>
      <select
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        className="bg-gray-800/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
      >
        {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>

    {/* Time range */}
    <div className="flex items-center gap-1">
      {TIME_RANGES.map((tr) => (
        <button
          key={tr.value}
          onClick={() => onTimeRangeChange(tr.value)}
          className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
            timeRange === tr.value
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {tr.label}
        </button>
      ))}
    </div>

    {/* Source filter */}
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400">来源</span>
      <select
        value={source}
        onChange={(e) => onSourceChange(e.target.value)}
        className="bg-gray-800/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
      >
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>

    <div className="flex-1" />

    {/* Real-time indicator */}
    <div className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span>实时更新</span>
      {lastUpdate && <span>· 最后更新 {lastUpdate.toLocaleTimeString('zh-CN')}</span>}
    </div>

    {/* Refresh button */}
    <button
      onClick={onRefresh}
      disabled={loading}
      className={`p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all ${loading ? 'animate-spin' : ''}`}
      title="刷新数据"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </GlassCard>
);

// ─── Main Component ──────────────────────────────────────────────────────────

const SentimentDashboardPage: React.FC = () => {
  const [symbol, setSymbol] = useState('AAPL');
  const [timeRange, setTimeRange] = useState<TimeRange>('1d');
  const [sourceFilter, setSourceFilter] = useState(t('components.all'));
  const [news, setNews] = useState<NewsItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalySignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const signalCleanupRef = useRef<(() => void) | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Try IPC first
      const api = window.api;
      let newsData: NewsItem[] = [];
      let anomalyData: AnomalySignal[] = [];

      if (api?.dataProvider?.getNews) {
        try {
          const raw = await api.dataProvider.getNews(symbol, 50);
          if (Array.isArray(raw) && raw.length > 0) {
            newsData = raw.map((item: unknown, idx: number) => ({
              id: item.id || `news-${idx}`,
              title: item.title || item.headline || '无标题',
              summary: item.summary || item.body || '',
              source: item.source || '未知',
              url: item.url,
              publishedAt: item.publishedAt || item.timestamp || new Date().toISOString(),
              sentiment: item.sentiment ?? (Math.random() - 0.5) * 2,
              keywords: item.keywords || [],
              symbol: item.symbol || symbol,
            }));
          }
        } catch { /* fallback to mock */ }
      }

      if (api?.dataProvider?.getAnomalies) {
        try {
          const raw = await api.dataProvider.getAnomalies(symbol);
          if (Array.isArray(raw)) {
            anomalyData = raw;
          }
        } catch { /* ignore */ }
      }

      // Fallback to mock data
      if (newsData.length === 0) {
        newsData = generateMockNews(symbol, 30);
      }

      setNews(newsData);
      setAnomalies(anomalyData);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // ─── Real-time Signal Listener ───────────────────────────────────────────

  useEffect(() => {
    const api = window.api;
    if (api?.on) {
      const handler = (_event: any, signal: any) => {
        if (signal?.type === 'sentiment_update' || signal?.type === 'signal') {
          fetchData();
        }
      };
      const cleanup = api.on('signal', handler);
      signalCleanupRef.current = typeof cleanup === 'function' ? cleanup : null;
    }
    return () => {
      signalCleanupRef.current?.();
    };
  }, [fetchData]);

  // ─── Initial & Symbol/Range Change Fetch ─────────────────────────────────

  useEffect(() => {
    fetchData();
  }, [fetchData, timeRange]);

  // ─── Computed Data ───────────────────────────────────────────────────────

  const filteredNews = useMemo(() => {
    let items = [...news];
    if (sourceFilter !== t('components.all')) {
      items = items.filter(n => n.source === sourceFilter);
    }
    // Time range filter
    const now = Date.now();
    const rangeMs: Record<TimeRange, number> = { '1h': 3600000, '4h': 14400000, '1d': 86400000, '7d': 604800000 };
    items = items.filter(n => now - new Date(n.publishedAt).getTime() <= rangeMs[timeRange]);
    return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [news, sourceFilter, timeRange]);

  const overallScore = useMemo(() => {
    if (filteredNews.length === 0) return 0;
    return filteredNews.reduce((sum, n) => sum + (n.sentiment ?? 0), 0) / filteredNews.length;
  }, [filteredNews]);

  const sentimentDistribution = useMemo(() => {
    let bullish = 0, neutral = 0, bearish = 0;
    filteredNews.forEach(n => {
      const s = n.sentiment ?? 0;
      if (s > 0.2) bullish++;
      else if (s < -0.2) bearish++;
      else neutral++;
    });
    return { bullish, neutral, bearish };
  }, [filteredNews]);

  const timelineData = useMemo(() => {
    // Bucket news by time
    const sorted = [...filteredNews].sort((a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    if (sorted.length === 0) return [];

    const bucketCount = Math.min(20, sorted.length);
    const buckets: { time: string; score: number; count: number }[] = [];
    const step = Math.ceil(sorted.length / bucketCount);

    for (let i = 0; i < sorted.length; i += step) {
      const chunk = sorted.slice(i, i + step);
      const avg = chunk.reduce((s, n) => s + (n.sentiment ?? 0), 0) / chunk.length;
      buckets.push({
        time: chunk[Math.floor(chunk.length / 2)].publishedAt,
        score: avg,
        count: chunk.length,
      });
    }
    return buckets;
  }, [filteredNews]);

  const entitySentiments = useMemo((): EntitySentiment[] => {
    const map = new Map<string, { total: number; count: number }>();
    filteredNews.forEach(n => {
      const sym = n.symbol || symbol;
      const entry = map.get(sym) || { total: 0, count: 0 };
      entry.total += n.sentiment ?? 0;
      entry.count++;
      map.set(sym, entry);
    });
    // Also generate synthetic entities for demonstration
    const synthEntities = ['半导体', '新能源', 'AI概念', '医药生物', '消费', '金融', '地产'];
    synthEntities.forEach(e => {
      map.set(e, { total: (Math.random() - 0.5) * 3, count: Math.floor(Math.random() * 20) + 5 });
    });
    return Array.from(map.entries()).map(([name, { total, count }]) => ({
      name,
      score: count > 0 ? total / count : 0,
      count,
    }));
  }, [filteredNews, symbol]);

  const keywordCloud = useMemo((): KeywordItem[] => {
    const freqMap = new Map<string, { count: number; sentimentSum: number }>();
    filteredNews.forEach(n => {
      n.keywords?.forEach(kw => {
        const entry = freqMap.get(kw) || { count: 0, sentimentSum: 0 };
        entry.count++;
        entry.sentimentSum += n.sentiment ?? 0;
        freqMap.set(kw, entry);
      });
    });
    // Add synthetic keywords if empty
    if (freqMap.size === 0) {
      const synth = ['财报超预期', '利好政策', '机构增持', '业绩增长', '技术突破', '行业整合', '风险预警', '监管收紧', '资金外流', '估值过高', t('components.decreaseHolding'), '盈利下滑'];
      synth.forEach(kw => {
        freqMap.set(kw, { count: Math.floor(Math.random() * 15) + 1, sentimentSum: (Math.random() - 0.5) * 4 });
      });
    }
    return Array.from(freqMap.entries())
      .map(([text, { count, sentimentSum }]) => ({
        text,
        frequency: count,
        sentiment: (sentimentSum / count) >= 0 ? 'positive' as const : 'negative' as const,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }, [filteredNews]);

  // ─── Stats ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const scores = filteredNews.map(n => n.sentiment ?? 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const variance = scores.length > 0 ? scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length : 0;
    const stdDev = Math.sqrt(variance);
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    return { avg, stdDev, maxScore, minScore, total: filteredNews.length };
  }, [filteredNews]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            NLP 舆情分析仪表板
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Sentiment Analysis Dashboard · {symbol} · {timeRange}</p>
        </div>
        {anomalies.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-yellow-400">{anomalies.length} 异常信号</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        symbol={symbol}
        onSymbolChange={setSymbol}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        source={sourceFilter}
        onSourceChange={setSourceFilter}
        onRefresh={fetchData}
        lastUpdate={lastUpdate}
        loading={loading}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '资讯总量', value: stats.total.toString(), sub: '条' },
          { label: '平均情绪', value: (stats.avg > 0 ? '+' : '') + stats.avg.toFixed(3), sub: '', color: stats.avg > 0 ? 'text-green-400' : stats.avg < 0 ? 'text-red-400' : 'text-gray-400' },
          { label: '情绪波动', value: stats.stdDev.toFixed(3), sub: 'σ' },
          { label: '最高情绪', value: stats.maxScore.toFixed(2), sub: '', color: 'text-green-400' },
          { label: '最低情绪', value: stats.minScore.toFixed(2), sub: '', color: 'text-red-400' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-3 text-center">
            <div className="text-[11px] text-gray-500 mb-1">{stat.label}</div>
            <div className={`text-lg font-bold font-mono ${stat.color || 'text-white'}`}>{stat.value}</div>
            {stat.sub && <div className="text-[10px] text-gray-600">{stat.sub}</div>}
          </GlassCard>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Overview & Timeline */}
        <div className="col-span-8 space-y-4">
          {/* Overview Panel */}
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">市场情绪仪表盘</h3>
              <MoodGauge score={overallScore} />
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">情绪分布</h3>
              <div className="flex items-center justify-center h-36">
                <SentimentPie {...sentimentDistribution} />
              </div>
            </GlassCard>
          </div>

          {/* Sentiment Timeline */}
          <GlassCard className="p-4">
            <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">情绪时间线</h3>
            <SentimentTimeline data={timelineData} />
          </GlassCard>

          {/* Entity Sentiment */}
          <GlassCard className="p-4">
            <h3 className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">实体情绪排行</h3>
            <EntitySentimentChart entities={entitySentiments} />
          </GlassCard>
        </div>

        {/* Right Column - News Feed & Keywords */}
        <div className="col-span-4 space-y-4">
          {/* Keyword Cloud */}
          <GlassCard className="p-4">
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">关键词云</h3>
            <KeywordCloud keywords={keywordCloud} />
            <div className="flex justify-center gap-4 mt-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> 正面</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> 负面</span>
            </div>
          </GlassCard>

          {/* News Feed */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">资讯流</h3>
              <span className="text-[10px] text-gray-600">{filteredNews.length} 条</span>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {filteredNews.length > 0 ? (
                filteredNews.slice(0, 20).map((item) => (
                  <NewsFeedItem key={item.id} item={item} />
                ))
              ) : (
                <div className="text-center py-12 text-gray-600">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <p className="text-sm">暂无相关资讯</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-700 pt-2">
        NLP Sentiment Analysis Dashboard · Powered by Dawn Whales Engine · {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default SentimentDashboardPage;
