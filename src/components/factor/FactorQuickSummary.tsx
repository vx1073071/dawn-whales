// @ts-nocheck
// R282 ML#2: FactorQuickSummary — 3秒摘要UI (3h)
// The "Bloomberg First Word" of factors: one-glance answer.
// Users see: Top signal → 1-line verdict → color-coded action
// No scrolling needed. 3 seconds from open to decision.
// 3秒摘要: 打开即见答案，不滚动不思考
import React, { useState, useMemo } from 'react';

interface SummaryFactor {
  id: string; name: string; emoji: string;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  ic: number; icChange: number; // vs last period
  verdict: string;   // ≤20字最终判断
  action: string;    // 操作建议 ≤15字
  categoryCN: string;
}

interface Props {
  factors: SummaryFactor[];
  dark?: boolean;
  onFactorClick?: (id: string) => void;
  totalFactors?: number;
  activeSignals?: number;
}

// Shuffled demo data
const DEMO: SummaryFactor[] = [
  { id: '1', name: 'MOM 1M', emoji: '⚡', signal: 'STRONG_LONG', ic: 0.044, icChange: 0.012, verdict: '短线动能极强，趋势明确向上', action: '顺势做多，5日止盈', categoryCN: '动量' },
  { id: '2', name: 'PE TTM', emoji: '💰', signal: 'LONG', ic: 0.042, icChange: 0.008, verdict: '整体估值偏低，便宜有好货', action: '关注价值股，分批建仓', categoryCN: '价值' },
  { id: '3', name: '北向资金', emoji: '💵', signal: 'LONG', ic: 0.035, icChange: 0.005, verdict: '外资持续流入，跟随大资金', action: '跟买北向重仓股', categoryCN: '资金' },
  { id: '4', name: 'PCR', emoji: '🎯', signal: 'SHORT', ic: -0.031, icChange: -0.006, verdict: 'Put/Call比走高，市场偏谨慎', action: '减仓或买保护性Put', categoryCN: '期权' },
  { id: '5', name: '沽空比例', emoji: '😤', signal: 'SHORT', ic: -0.026, icChange: -0.004, verdict: '做空情绪加重，短期谨慎', action: '回避高沽空个股', categoryCN: '情绪' },
  { id: '6', name: '20日波动', emoji: '🌊', signal: 'NEUTRAL', ic: -0.005, icChange: 0.001, verdict: '波动率中性，无方向信号', action: '维持现有仓位不动', categoryCN: '波动' },
  { id: '7', name: 'ROE', emoji: '⭐', signal: 'LONG', ic: 0.029, icChange: -0.002, verdict: '高ROE公司持续优秀但动能减弱', action: '持有但不再加仓', categoryCN: '质量' },
  { id: '8', name: '龙虎榜', emoji: '🔥', signal: 'STRONG_LONG', ic: 0.052, icChange: 0.018, verdict: '游资活跃，短线机会丰富', action: '快进快出，2-3日', categoryCN: '情绪' },
];

export default function FactorQuickSummary({ factors = DEMO, dark = true, onFactorClick, totalFactors = 620, activeSignals = 12 }: Props) {
  const [sortMode, setSortMode] = useState<'ic' | 'change'>('ic');
  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const sorted = useMemo(() => [...factors].sort((a, b) => {
    if (sortMode === 'ic') return Math.abs(b.ic) - Math.abs(a.ic);
    return Math.abs(b.icChange) - Math.abs(a.icChange);
  }), [factors, sortMode]);

  const longCount = factors.filter(f => f.signal.includes('LONG')).length;
  const shortCount = factors.filter(f => f.signal.includes('SHORT')).length;

  return <div style={{ padding: '14px 16px', background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 500, margin: '0 auto', borderRadius: 16 }}>
    {/* ── Header Stats ── */}
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: c.a }}>🐄 3秒速览</div>
      <div style={{ fontSize: 12, color: c.t2, marginTop: 4 }}>
        {totalFactors}因子 · {activeSignals}活跃信号 · 今日<span style={{ color: c.ok }}>{longCount}做多</span> <span style={{ color: c.er }}>{shortCount}做空</span>
      </div>
    </div>

    {/* ── Sort Toggle ── */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', borderRadius: 8, background: c.sh, padding: 2 }}>
        <button onClick={() => setSortMode('ic')} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: sortMode === 'ic' ? 600 : 400, cursor: 'pointer', border: 'none', background: sortMode === 'ic' ? c.a : 'transparent', color: sortMode === 'ic' ? '#fff' : c.t2 }}>按IC强度</button>
        <button onClick={() => setSortMode('change')} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: sortMode === 'change' ? 600 : 400, cursor: 'pointer', border: 'none', background: sortMode === 'change' ? c.a : 'transparent', color: sortMode === 'change' ? '#fff' : c.t2 }}>按变化幅度</button>
      </div>
    </div>

    {/* ── Factor Rows ── */}
    {sorted.slice(0, 6).map((f, i) => {
      const icC = f.ic > 0 ? c.ok : c.er;
      const changeC = f.icChange > 0 ? c.ok : c.er;
      const sigBg = f.signal.includes('LONG') ? c.ok + '15' : f.signal.includes('SHORT') ? c.er + '15' : c.wa + '15';
      const sigC = f.signal.includes('LONG') ? c.ok : f.signal.includes('SHORT') ? c.er : c.wa;
      return <div
        key={f.id}
        onClick={() => onFactorClick?.(f.id)}
        style={{
          padding: '10px 12px', borderRadius: 10, marginBottom: 8,
          background: i < 3 ? c.s : 'transparent', border: i < 3 ? `1px solid ${c.b}` : 'none',
          cursor: onFactorClick ? 'pointer' : 'default', transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>{f.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.t }}>{f.name}</span>
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: sigBg, color: sigC, fontWeight: 600 }}>{f.signal.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 12, color: c.t, marginTop: 2, fontWeight: 500 }}>{f.verdict}</div>
            <div style={{ fontSize: 11, color: c.t2, marginTop: 1 }}>💡 {f.action}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: icC }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</div>
            <div style={{ fontSize: 10, color: changeC }}>{f.icChange > 0 ? '↑' : '↓'}{Math.abs(f.icChange).toFixed(3)}</div>
          </div>
        </div>
      </div>;
    })}

    {/* ── Footer ── */}
    <div style={{ padding: '10px 12px', borderRadius: 10, background: c.a + '08', border: `1px solid ${c.a}18`, textAlign: 'center', fontSize: 12, color: c.a, marginTop: 8 }}>
      🎯 以上为今日TOP信号，建议{activeSignals > 8 ? '分散配置' : '精选集中'} {totalFactors > 500 ? '620+因子中' : ''}前{factors.length}活跃信号
    </div>
    <div style={{ textAlign: 'center', fontSize: 10, color: c.t2, marginTop: 8 }}>
      ⏱️ 设计目标：3秒内完成阅读并形成初步判断
    </div>
  </div>;
}
