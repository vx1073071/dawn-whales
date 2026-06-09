import { useState, useMemo, type CSSProperties } from 'react';

// ── Types ──
interface SignalTrade {
  id: string; date: string; symbol: string; side: 'BUY' | 'SELL';
  entryPrice: number; exitPrice: number; pnl: number; pnlPct: number;
  reason: string; status: 'win' | 'loss';
}

interface BacktestSummary { totalSignals: number; winRate: number; profitFactor: number; maxDrawdown: number; sharpe: number; totalPnl: number }

interface NewsItem {
  id: string; source: string; title: string; summary: string;
  sentiment: number; symbols: string[]; timestamp: string; url?: string;
}

const SIGNAL_TRADES: SignalTrade[] = [
  { id: 's1', date: '2026-06-09', symbol: '00700.HK', side: 'BUY', entryPrice: 388, exitPrice: 412, pnl: 24, pnlPct: 6.19, reason: 'MACD金叉+RSI超卖', status: 'win' },
  { id: 's2', date: '2026-06-08', symbol: '09988.HK', side: 'SELL', entryPrice: 95, exitPrice: 88, pnl: 7, pnlPct: 7.37, reason: 'RSI超买+MACD死叉', status: 'win' },
  { id: 's3', date: '2026-06-07', symbol: 'AAPL.US', side: 'BUY', entryPrice: 228, exitPrice: 222, pnl: -6, pnlPct: -2.63, reason: '布林带上轨突破假信号', status: 'loss' },
  { id: 's4', date: '2026-06-06', symbol: '01810.HK', side: 'BUY', entryPrice: 42.5, exitPrice: 46.8, pnl: 4.3, pnlPct: 10.12, reason: '突破20日均线+放量', status: 'win' },
  { id: 's5', date: '2026-06-05', symbol: '09961.HK', side: 'SELL', entryPrice: 118, exitPrice: 126, pnl: -8, pnlPct: -6.78, reason: '错误做空', status: 'loss' },
  { id: 's6', date: '2026-06-04', symbol: 'NTES.US', side: 'BUY', entryPrice: 105, exitPrice: 112, pnl: 7, pnlPct: 6.67, reason: '高股息+低PE筛选', status: 'win' },
  { id: 's7', date: '2026-06-03', symbol: '00981.HK', side: 'BUY', entryPrice: 35, exitPrice: 38.5, pnl: 3.5, pnlPct: 10.00, reason: '季报超预期', status: 'win' },
  { id: 's8', date: '2026-06-02', symbol: '02800.HK', side: 'SELL', entryPrice: 22.8, exitPrice: 21.5, pnl: 1.3, pnlPct: 5.70, reason: '大盘回调', status: 'win' },
];

const NEWS_SAMPLES: NewsItem[] = [
  { id: 'n1', source: 'NewsAPI', title: '腾讯Q2营收增长超预期15%', summary: '得益于游戏和广告业务复苏，腾讯第二季度营收同比增长15%', sentiment: 78, symbols: ['00700.HK'], timestamp: '2026-06-09 14:30' },
  { id: 'n2', source: '东方财富', title: '恒生指数突破21000点，创6个月新高', summary: '受北水持续流入带动，恒指今日大涨2.3%', sentiment: 85, symbols: ['^HSI'], timestamp: '2026-06-09 13:15' },
  { id: 'n3', source: 'NewsAPI', title: '美国CPI低于预期，纳指期货大涨1.5%', summary: '6月CPI同比上升3.0%低于预期3.1%，市场押注9月降息', sentiment: 65, symbols: ['QQQ', 'AAPL.US'], timestamp: '2026-06-09 09:00' },
  { id: 'n4', source: '东方财富', title: '小米汽车交付突破10万辆', summary: 'SU7 Ultra正式交付，市场反响热烈', sentiment: 72, symbols: ['01810.HK'], timestamp: '2026-06-09 11:22' },
  { id: 'n5', source: 'NewsAPI', title: '日本央行维持利率不变', summary: 'BOJ决议符合预期，日元小幅走弱', sentiment: -20, symbols: ['^N225'], timestamp: '2026-06-09 08:45' },
  { id: 'n6', source: '东方财富', title: '中海油发现新大型油气田', summary: '南海深水区发现储量约3亿吨油气田', sentiment: 90, symbols: ['00883.HK'], timestamp: '2026-06-09 10:00' },
];

// ── Sub-components ──
function PnLBadge({ pnl, pnlPct }: { pnl: number; pnlPct: number }) {
  const isWin = pnl > 0;
  return (
    <span style={{ fontWeight: 700, fontSize: 13, color: isWin ? '#34D399' : '#FCA5A5', fontFamily: 'monospace' }}>
      {isWin ? '+' : ''}{Math.abs(pnl).toFixed(2)} ({isWin ? '+' : ''}{pnlPct.toFixed(2)}%)
    </span>
  );
}

function SentimentBar({ value }: { value: number }) {
  const pct = Math.abs(value);
  const isPositive = value > 0;
  const color = value > 30 ? '#10B981' : value < -30 ? '#EF4444' : '#6B7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#374151', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, marginLeft: isPositive ? 'auto' : 0 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 36 }}>
        {isPositive ? '😊' : '😟'} {value}
      </span>
    </div>
  );
}

// ── Tab Components ──
function SignalBacktestTab() {
  const summary: BacktestSummary = useMemo(() => {
    const win = SIGNAL_TRADES.filter(t => t.pnl > 0).length;
    const total = SIGNAL_TRADES.length;
    const grossProfit = SIGNAL_TRADES.filter(t => t.pnl > 0).reduce((a, b) => a + b.pnl, 0);
    const grossLoss = Math.abs(SIGNAL_TRADES.filter(t => t.pnl < 0).reduce((a, b) => a + b.pnl, 0));
    return {
      totalSignals: total, winRate: win / total * 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      maxDrawdown: 0.08, sharpe: 1.42,
      totalPnl: SIGNAL_TRADES.reduce((a, b) => a + b.pnl, 0),
    };
  }, []);

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>总信号</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#818CF8' }}>{summary.totalSignals}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>胜率</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981' }}>{summary.winRate.toFixed(0)}%</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>盈亏比</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#D4A853' }}>{summary.profitFactor.toFixed(2)}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>夏普</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>{summary.sharpe.toFixed(2)}</div>
        </div>
      </div>

      {/* PnL chart bar */}
      <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937' }}>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>📊 逐笔 PnL</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
          {SIGNAL_TRADES.map(t => {
            const maxAbs = 10;
            const h = Math.min(75, Math.abs(t.pnlPct) / maxAbs * 75);
            return (
              <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  height: `${h}px`, width: '80%', borderRadius: '4px 4px 0 0',
                  background: t.pnl > 0 ? '#10B98188' : '#EF444488',
                  marginTop: t.pnl > 0 ? 0 : 'auto',
                }} />
                <span style={{ fontSize: 9, color: '#6B7280' }}>{t.symbol.split('.')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trade table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>日期</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>标的</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF' }}>方向</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>入场</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>出场</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>PnL</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>原因</th>
            </tr>
          </thead>
          <tbody>
            {SIGNAL_TRADES.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #1F2937' }}>
                <td style={{ padding: '10px 10px', color: '#9CA3AF' }}>{t.date}</td>
                <td style={{ padding: '10px 10px', color: '#D1D5DB', fontWeight: 600 }}>{t.symbol}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: t.side === 'BUY' ? '#10B98122' : '#EF444422', color: t.side === 'BUY' ? '#34D399' : '#FCA5A5' }}>
                    {t.side === 'BUY' ? '买入' : '卖出'}
                  </span>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB' }}>{t.entryPrice}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB' }}>{t.exitPrice}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right' }}><PnLBadge pnl={t.pnl} pnlPct={t.pnlPct} /></td>
                <td style={{ padding: '10px 10px', color: '#6B7280', fontSize: 11 }}>{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RealtimeNewsTab() {
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const filtered = useMemo(() => {
    let list = NEWS_SAMPLES;
    if (sentimentFilter === 'positive') list = list.filter(n => n.sentiment > 30);
    else if (sentimentFilter === 'negative') list = list.filter(n => n.sentiment < -30);
    else if (sentimentFilter === 'neutral') list = list.filter(n => n.sentiment >= -30 && n.sentiment <= 30);
    return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [sentimentFilter]);

  const avgSentiment = useMemo(() => NEWS_SAMPLES.reduce((a, b) => a + b.sentiment, 0) / NEWS_SAMPLES.length, []);

  return (
    <div>
      {/* Sentiment summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>市场情绪</span>
          <SentimentBar value={Math.round(avgSentiment)} />
        </div>
        {['all', 'positive', 'negative', 'neutral'].map(f => (
          <button key={f} onClick={() => setSentimentFilter(f as any)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid', borderColor: sentimentFilter === f ? '#6366F1' : '#374151',
            background: sentimentFilter === f ? '#6366F118' : 'transparent', color: sentimentFilter === f ? '#818CF8' : '#6B7280',
            fontSize: 12, cursor: 'pointer',
          }}>
            {f === 'all' ? '全部' : f === 'positive' ? '😊 正面' : f === 'negative' ? '😟 负面' : '😐 中性'}
          </button>
        ))}
      </div>

      {/* News cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(n => (
          <div key={n.id} style={{ padding: '14px 16px', borderRadius: 12, background: '#111827', border: '1px solid #1F2937' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F9FAFB', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>{n.summary}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <SentimentBar value={n.sentiment} />
                <span style={{ padding: '2px 8px', borderRadius: 4, background: '#374151', fontSize: 10, color: '#9CA3AF' }}>{n.source}</span>
                {n.symbols.map(s => (
                  <span key={s} style={{ padding: '2px 8px', borderRadius: 4, background: '#6366F122', fontSize: 10, color: '#818CF8' }}>
                    {s}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 10, color: '#6B7280' }}>{n.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──
export default function SignalBacktestNewsPanel() {
  const [tab, setTab] = useState<'backtest' | 'news'>('backtest');

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 960, margin: '0 auto',
  };

  return (
    <div style={theme}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            📊 信号回测 & 实时新闻
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            BUY→SELL闭环回测 · 双源新闻聚合 · 情绪打分
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab('backtest')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'backtest' ? '#6366F1' : '#1F2937',
          color: tab === 'backtest' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📈 信号回测</button>
        <button onClick={() => setTab('news')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'news' ? '#6366F1' : '#1F2937',
          color: tab === 'news' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>📰 实时新闻</button>
      </div>

      {tab === 'backtest' && <SignalBacktestTab />}
      {tab === 'news' && <RealtimeNewsTab />}
    </div>
  );
}
