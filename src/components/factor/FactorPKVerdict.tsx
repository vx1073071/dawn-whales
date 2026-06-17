// @ts-nocheck
// R282 ML#5: FactorPKVerdict — PK一句话模式 (3h)
// Extends FactorPK.tsx with "一句话总结" mode
// Users pick 2 factors → get 1 verdict sentence they can act on
// 因子PK一句话: 选两个因子 → 一句话告诉你哪个更强，为什么
import React, { useState, useMemo } from 'react';

interface PKFactor {
  id: string; name: string; emoji: string;
  categoryCN: string; ic: number; sharpe: number; winRate: number;
  signal: string; humanLabel: string;
}

interface PKResult {
  winner: string;
  winnerEmoji: string;
  loser: string;
  loserEmoji: string;
  verdict: string;       // 一句话结论 ≤30字
  reason: string;        // 为什么 (1-2句)
  synergy: string;       // 能否一起用
  advantage: number;     // 优势幅度
}

const DEMO_FACTORS: PKFactor[] = [
  { id: 'MOM_1M', name: '1月动量', emoji: '⚡', categoryCN: '动量', ic: 0.044, sharpe: 0.62, winRate: 0.58, signal: 'LONG', humanLabel: '过去1个月涨最多的' },
  { id: 'PE_TTM', name: 'PE TTM', emoji: '💰', categoryCN: '价值', ic: 0.042, sharpe: 0.55, winRate: 0.54, signal: 'LONG', humanLabel: '市盈率最低的' },
  { id: 'ROE', name: 'ROE', emoji: '⭐', categoryCN: '质量', ic: 0.029, sharpe: 0.48, winRate: 0.52, signal: 'LONG', humanLabel: 'ROE最高的公司' },
  { id: 'PCR', name: 'Put/Call', emoji: '🎯', categoryCN: '期权', ic: -0.031, sharpe: -0.35, winRate: 0.41, signal: 'SHORT', humanLabel: 'Put/Call比最低的' },
  { id: 'SHORT', name: '沽空比例', emoji: '😤', categoryCN: '情绪', ic: -0.026, sharpe: -0.28, winRate: 0.43, signal: 'SHORT', humanLabel: '沽空比例最低的' },
  { id: 'VOL20', name: '20日波动', emoji: '🌊', categoryCN: '波动', ic: -0.018, sharpe: 0.15, winRate: 0.49, signal: 'NEUTRAL', humanLabel: '波动率最低的' },
  { id: 'NORTH', name: '北向资金', emoji: '💵', categoryCN: '资金', ic: 0.035, sharpe: 0.52, winRate: 0.56, signal: 'LONG', humanLabel: '外资净买入最多的' },
  { id: 'ESG', name: 'MSCI ESG', emoji: '🌿', categoryCN: 'ESG', ic: 0.028, sharpe: 0.42, winRate: 0.50, signal: 'LONG', humanLabel: 'ESG评分最高的' },
];

function computePK(a: PKFactor, b: PKFactor): PKResult {
  const aScore = a.ic * 0.4 + a.sharpe * 0.25 + a.winRate * 0.2;
  const bScore = b.ic * 0.4 + b.sharpe * 0.25 + b.winRate * 0.2;
  const aWins = aScore > bScore;
  const diff = Math.abs(aScore - bScore);

  let verdict: string;
  let reason: string;
  let synergy: string;

  if (diff > 0.015) {
    verdict = `${aWins ? a.name : b.name}明显更强，${aWins ? 'IC和夏普都压倒性领先' : '综合评分大幅领先'}`;
    reason = `IC差距${Math.abs(a.ic - b.ic).toFixed(3)}，夏普差距${Math.abs(a.sharpe - b.sharpe).toFixed(2)}。${aWins ? a.name : b.name}在所有维度上均占优。`;
  } else if (diff > 0.005) {
    verdict = `${aWins ? a.name : b.name}略优，但差距不大。`;
    reason = `综合评分领先${diff.toFixed(3)}。核心差异在${Math.abs(a.ic - b.ic) > 0.01 ? 'IC强度' : Math.abs(a.sharpe - b.sharpe) > 0.15 ? '夏普比率' : '胜率'}上。`;
  } else {
    verdict = '两者几乎不分伯仲！';
    reason = `综合评分仅差${diff.toFixed(4)}，几乎无法区分优劣。需要看市场环境决定。`;
  }

  // Synergy analysis
  if (a.categoryCN !== b.categoryCN) {
    synergy = `✅ 好组合！${a.categoryCN}和${b.categoryCN}属于不同类别，可以互补。建议${Math.round(Math.abs(a.ic) / (Math.abs(a.ic) + Math.abs(b.ic)) * 100)}%权重给${a.name}。`;
  } else {
    synergy = `⚠️ 同是${a.categoryCN}因子，有些重复。如果IC相关度高，选一个就够了。`;
  }

  return {
    winner: aWins ? a.name : b.name,
    winnerEmoji: aWins ? a.emoji : b.emoji,
    loser: aWins ? b.name : a.name,
    loserEmoji: aWins ? b.emoji : a.emoji,
    verdict, reason, synergy,
    advantage: diff,
  };
}

interface Props { dark?: boolean; onFactorSelect?: (a: PKFactor, b: PKFactor) => void; }

export default function FactorPKVerdict({ dark = true }: Props) {
  const [left, setLeft] = useState(DEMO_FACTORS[0]);
  const [right, setRight] = useState(DEMO_FACTORS[1]);
  const result = useMemo(() => computePK(left, right), [left, right]);

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  return <div style={{ padding: 16, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '0 auto', borderRadius: 16 }}>
    <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
      ⚔️ 因子PK — 一句话模式
    </div>

    {/* Selectors */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
      {[
        { f: left, set: setLeft, side: 'A' },
        { f: right, set: setRight, side: 'B' },
      ].map(({ f, set, side }) => <div key={side} style={{
        padding: 10, borderRadius: 10, background: c.s, border: `1px solid ${c.b}`, textAlign: 'center',
      }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 4 }}>因子 {side}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{f.emoji} {f.name}</div>
        <div style={{ fontSize: 11, color: c.t2, marginTop: 2 }}>{f.humanLabel}</div>
        <div style={{ fontSize: 11, color: f.ic > 0 ? c.ok : c.er, marginTop: 2 }}>IC: {f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</div>
        <select
          value={f.id}
          onChange={e => { const found = DEMO_FACTORS.find(x => x.id === e.target.value); if (found) set(found); }}
          style={{ marginTop: 8, width: '100%', padding: '4px 8px', borderRadius: 6, border: `1px solid ${c.b}`, background: c.s, color: c.t, fontSize: 11, cursor: 'pointer', outline: 'none' }}
        >
          {DEMO_FACTORS.map(x => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
        </select>
      </div>)}
    </div>

    {/* ─── 一句话结论 ─── */}
    <div style={{ padding: 16, borderRadius: 12, background: c.ok + '08', border: `1px solid ${c.ok}22`, textAlign: 'center', marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: c.t2, marginBottom: 4 }}>🏆 一句话结论</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: c.t, lineHeight: 1.4 }}>
        {result.verdict}
      </div>
    </div>

    {/* ── Details ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
      <div style={{ padding: 10, borderRadius: 8, background: c.sh }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 3 }}>📊 为什么</div>
        <div style={{ fontSize: 12, color: c.t }}>{result.reason}</div>
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: c.sh }}>
        <div style={{ fontSize: 10, color: c.t2, marginBottom: 3 }}>🤝 能一起用吗</div>
        <div style={{ fontSize: 12, color: c.t }}>{result.synergy}</div>
      </div>
    </div>

    {/* ── Score Bar ── */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: c.a }}>{left.name}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: c.sh, overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${Math.round(50 + result.advantage * 2000)}%`, height: '100%', background: c.a, borderRadius: '4px 0 0 4px', transition: 'width 0.3s' }}/>
        <div style={{ flex: 1, height: '100%', background: c.t2, opacity: 0.3 }}/>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: c.t2 }}>{right.name}</span>
    </div>
    <div style={{ textAlign: 'center', fontSize: 10, color: c.t2, marginTop: 10 }}>
      ⚡ 一句话模式：3秒出结论。如需深度对比，请用完整PK面板。
    </div>
  </div>;
}
