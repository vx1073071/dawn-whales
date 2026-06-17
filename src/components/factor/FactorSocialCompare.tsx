// @ts-nocheck
// R283 ML#3: FactorSocialCompare — 社交比较UI (4h)
// Users compare their factor usage vs community: "Your PE usage: top 35%"
// Percentile ranking, community averages, trending factors, share card
// 社交比较: 你的因子使用 vs 社区平均水平
import React, { useState, useMemo } from 'react';
import { TrendingUp, Users, Share2, Award } from 'lucide-react';

interface UserFactorStat {
  factorId: string; factorName: string; emoji: string;
  userWeight: number;  // 0-100, user's allocation weight
  communityAvg: number; // 0-100, community average weight
  trending: 'up' | 'down' | 'stable';
}

interface SocialStats {
  totalUsers: number;
  userRank: number;         // percentile position
  mostPopular: string;      // #1 most used factor
  userMostUsed: string;     // user's #1
  communityTrend: string;   // what's gaining popularity
}

const DEMO_STATS: SocialStats = {
  totalUsers: 2847,
  userRank: 35, // top 35%
  mostPopular: '💰 PE TTM',
  userMostUsed: '⚡ 1月动量',
  communityTrend: '🌿 ESG因子使用量+42%本周',
};

const DEMO_FACTORS: UserFactorStat[] = [
  { factorId: 'MOM_1M', factorName: '1月动量', emoji: '⚡', userWeight: 28, communityAvg: 18, trending: 'up' },
  { factorId: 'PE_TTM', factorName: 'PE TTM', emoji: '💰', userWeight: 22, communityAvg: 35, trending: 'stable' },
  { factorId: 'ROE', factorName: 'ROE', emoji: '⭐', userWeight: 15, communityAvg: 12, trending: 'up' },
  { factorId: 'PCR', factorName: 'Put/Call', emoji: '🎯', userWeight: 8, communityAvg: 14, trending: 'down' },
  { factorId: 'ESG', factorName: 'MSCI ESG', emoji: '🌿', userWeight: 12, communityAvg: 6, trending: 'up' },
  { factorId: 'NORTH', factorName: '北向资金', emoji: '💵', userWeight: 10, communityAvg: 10, trending: 'stable' },
  { factorId: 'SHORT', factorName: '沽空比例', emoji: '😤', userWeight: 5, communityAvg: 5, trending: 'down' },
];

interface Props { dark?: boolean; stats?: SocialStats; factors?: UserFactorStat[]; }

export default function FactorSocialCompare({ dark = true, stats = DEMO_STATS, factors = DEMO_FACTORS }: Props) {
  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', borderRadius: 14 }}>
    {/* ── Header Card ── */}
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>👥 社交比较</div>
      <div style={{ fontSize: 12, color: c.t2, marginTop: 4 }}>{stats.totalUsers.toLocaleString()} 位用户 · 你位于 <span style={{ color: c.a, fontWeight: 600 }}>Top {stats.userRank}%</span></div>
    </div>

    {/* ── Your vs Community ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
      <div style={{ padding: 12, borderRadius: 10, background: c.a + '10', border: `1px solid ${c.a}20`, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 4 }}>🔝 你最常用</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{stats.userMostUsed}</div>
      </div>
      <div style={{ padding: 12, borderRadius: 10, background: c.ok + '08', border: `1px solid ${c.ok}20`, textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 4 }}>👑 社区最爱</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{stats.mostPopular}</div>
      </div>
    </div>

    {/* ── Trend Alert ── */}
    <div style={{ padding: 10, borderRadius: 8, background: c.wa + '10', border: `1px solid ${c.wa}20`, marginBottom: 14, fontSize: 12, color: c.t }}>
      <TrendingUp size={14} style={{ color: c.ok, marginRight: 6, verticalAlign: 'middle' }}/>
      {stats.communityTrend}
    </div>

    {/* ── Factor-by-Factor Comparison ── */}
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={14} style={{ color: c.a }}/> 你的权重 vs 社区均值
      </div>
      {factors.map(f => {
        const diff = f.userWeight - f.communityAvg;
        const diffC = Math.abs(diff) > 10 ? (diff > 0 ? c.a : c.er) : c.t2;
        return <div key={f.factorId} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 12, color: c.t }}>{f.emoji} {f.factorName}</span>
            <span style={{ fontSize: 11, color: diffC }}>
              你 {f.userWeight}% · 均值 {f.communityAvg}%
              {Math.abs(diff) > 10 && <span> {diff > 0 ? '↑偏重' : '↓偏轻'}</span>}
            </span>
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, background: c.sh, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(f.communityAvg, 40)}%`, height: '100%', background: c.t2, opacity: 0.3, borderRadius: '3px 0 0 3px' }}/>
            <div style={{ width: `${Math.min(f.userWeight, 40)}%`, height: '100%', background: diff > 5 ? c.a : diff < -5 ? c.er : c.ok, borderRadius: 3, marginLeft: 1 }}/>
          </div>
        </div>;
      })}
    </div>

    {/* ── Share ── */}
    <div style={{ textAlign: 'center', marginTop: 12 }}>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10,
        background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
      }}>
        <Share2 size={14}/> 分享我的因子配置
      </button>
      <div style={{ fontSize: 10, color: c.t2, marginTop: 6 }}>
        💡 你的PE权重低于85%的用户 — 也许该加仓PE因子？
      </div>
    </div>
  </div>;
}
