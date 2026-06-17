/**
 * FactorCommunityPanel — R279 ML#6: 因子社区前端 (Factor Community)
 *
 * Social layer for factor investors:
 * - Creator profiles + portfolios
 * - Strategy discussions
 * - Factor performance leaderboard
 * - Follow system
 * - Trending factors
 */
import React, { useState } from 'react';

interface CreatorCard {
  id: string;
  name: string;
  avatar: string;
  tier: string;
  followers: number;
  strategies: number;
  avgReturn: number;
  winRate: number;
  totalRevenue: number;
  bio: string;
  topFactors: string[];
}

interface CommunityPost {
  id: string;
  creator: string;
  avatar: string;
  title: string;
  content: string;
  factor: string;
  likes: number;
  comments: number;
  time: string;
  tags: string[];
}

const MOCK_CREATORS: CreatorCard[] = [
  { id: 'c001', name: 'AlphaSeeker', avatar: 'AS', tier: 'L3', followers: 2850, strategies: 12, avgReturn: 18.5, winRate: 62, totalRevenue: 158000, bio: 'Quant at heart. Factor investing since 2015. Specialize in value + quality combos.', topFactors: ['US Value', 'Quality ROE', 'Global Low Vol'] },
  { id: 'c002', name: 'DragonTrader', avatar: 'DT', tier: 'L2', followers: 1520, strategies: 8, avgReturn: 25.2, winRate: 58, totalRevenue: 85000, bio: 'A-share specialist. Northbound flow + dragon tiger board analysis. 7 years in China markets.', topFactors: ['Northbound Flow', 'Dragon Tiger', 'Momentum CN'] },
  { id: 'c003', name: 'ChainAlpha', avatar: 'CA', tier: 'L3', followers: 3800, strategies: 15, avgReturn: 52.0, winRate: 68, totalRevenue: 298000, bio: 'On-chain data is the new fundamentals. Crypto factor pioneer since 2018.', topFactors: ['Exchange Flow', 'Hash Rate', 'Stablecoin'] },
  { id: 'c004', name: 'NiftyMaster', avatar: 'NM', tier: 'L2', followers: 1200, strategies: 6, avgReturn: 24.0, winRate: 65, totalRevenue: 62000, bio: 'India markets. FII flows + GST data + macro overlay. Mumbai based.', topFactors: ['FII Flow', 'Growth IN', 'GST'] },
];

const MOCK_POSTS: CommunityPost[] = [
  { id: 'p001', creator: 'AlphaSeeker', avatar: 'AS', title: 'US Value factor at inflection point?', content: 'PE TTM Z-score hitting 2.1 — historically this precedes a rotation from growth to value within 4-6 weeks. Adding to value positions. The last 3 times this happened, value outperformed growth by 8-12% over the next quarter.', factor: 'US Value', likes: 128, comments: 34, time: '2h ago', tags: ['value', 'rotation', 'US'] },
  { id: 'p002', creator: 'DragonTrader', avatar: 'DT', title: 'Northbound 5-day streak — strong buy signal', content: '5 consecutive days of net northbound inflow totaling 12.5B CNY. This is the longest streak in 3 months. Historically, 5-day streaks precede CSI 300 rallies averaging +8.5% over the following 30 days. Loading up on consumer and healthcare.', factor: 'CN Northbound', likes: 95, comments: 28, time: '5h ago', tags: ['northbound', 'A-share', 'China'] },
  { id: 'p003', creator: 'ChainAlpha', avatar: 'CA', title: 'BTC exchange reserves at 3-year low', content: 'Exchange bitcoin reserves dropped below 2.3M BTC — lowest since Jan 2023. Combined with $2.8B ETF inflows this week, the supply squeeze setup is the strongest since the ETF launch. Accumulation phase confirmed.', factor: 'Crypto Flow', likes: 215, comments: 52, time: '1h ago', tags: ['bitcoin', 'on-chain', 'crypto', 'supply-squeeze'] },
  { id: 'p004', creator: 'NiftyMaster', avatar: 'NM', title: 'GST collection at ATH — India consumption boom', content: 'June GST hitting 1.85T INR — new record. Every single state showed positive growth. Consumer discretionary and auto sectors are the direct play here. FIIs bought 2.8B USD this month — the smart money sees it.', factor: 'IN Growth', likes: 72, comments: 18, time: '8h ago', tags: ['India', 'consumption', 'GST'] },
];

export const FactorCommunityPanel: React.FC = () => {
  const [tab, setTab] = useState<'feed' | 'creators' | 'trending'>('feed');

  const trendingFactors = ['Northbound Flow', 'Bitcoin Exchange Outflow', 'US Value PE', 'AI Capex Growth', 'India GST'];
  const topCreatorsSorted = [...MOCK_CREATORS].sort((a, b) => b.followers - a.followers);

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F465}'} Factor Community</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['feed', 'creators', 'trending'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: tab === t ? 700 : 500,
            }}>{t === 'feed' ? '\u{1F4AC} Feed' : t === 'creators' ? '\u{2B50} Creators' : '\u{1F525} Trending'}</button>
          ))}
        </div>
      </div>

      {tab === 'feed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOCK_POSTS.map(p => (
            <div key={p.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{p.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{p.creator}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{p.time} · factor: {p.factor}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-dim)', marginBottom: 8 }}>{p.content}</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {p.tags.map(t => <span key={t} style={{ padding: '1px 8px', borderRadius: 10, background: 'rgba(99,102,241,.08)', color: '#818cf8', fontSize: 9, fontWeight: 600 }}>#{t}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-dim)' }}>
                <span>{'\u{2764}\u{FE0F}'} {p.likes}</span>
                <span>{'\u{1F4AC}'} {p.comments} comments</span>
                <span>{'\u{1F516}'} Share</span>
                <span>{'\u{1F4CC}'} Save</span>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'creators' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {topCreatorsSorted.map(c => (
            <div key={c.id} style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{c.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <span style={{ padding: '1px 6px', borderRadius: 3, background: c.tier === 'L3' ? 'rgba(245,158,11,.12)' : 'rgba(99,102,241,.12)', color: c.tier === 'L3' ? '#fbbf24' : '#818cf8', fontSize: 9, fontWeight: 600 }}>{c.tier}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{c.followers.toLocaleString()} followers</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>{c.bio}</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 10 }}>
                <span>Return: <strong style={{ color: '#22c55e' }}>+{c.avgReturn}%</strong></span>
                <span>Win: <strong>{c.winRate}%</strong></span>
                <span>Strategies: <strong>{c.strategies}</strong></span>
                <span>Revenue: <strong style={{ color: '#6366f1' }}>{c.totalRevenue.toLocaleString()}U</strong></span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {c.topFactors.map(f => <span key={f} style={{ padding: '2px 6px', borderRadius: 3, background: 'var(--bg-input)', fontSize: 9 }}>{f}</span>)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gap: 8 }}>
            {trendingFactors.map((f, i) => (
              <div key={f} style={{
                padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: i < 3 ? '#fbbf24' : 'var(--bg-input)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                  color: i < 3 ? '#fff' : 'var(--text-dim)',
                }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{f}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                    {i === 0 ? '15 strategies · 2.5K followers · Trending' :
                     i === 1 ? '8 strategies · 1.8K followers · Hot' :
                     i === 2 ? '12 strategies · 1.2K followers · Rising' :
                     `${Math.floor(Math.random() * 8 + 3)} strategies · ${Math.floor(Math.random() * 800 + 200)} followers`}
                  </div>
                </div>
                <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 600 }}>
                  {i === 0 ? '\u{1F525} #1' : i === 1 ? '\u{1F525} #2' : i === 2 ? '\u{1F525} #3' : `#${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FactorCommunityPanel;
