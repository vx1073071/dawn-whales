// @ts-nocheck
// R286 ML#5: FactorSignalOverlay — 因子信号灯图表叠加 (2h)
// Overlays factor signals (STRONG_LONG/LONG/NEUTRAL/SHORT/STRONG_SHORT) on chart
// Color-coded dots/bars at chart bottom showing factor health
// 因子信号叠加: 图表底部显示10个关键因子的当前信号
import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FactorSignal {
  id: string; name: string; emoji: string;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  ic: number; category: string;
}

const SIGNALS: FactorSignal[] = [
  { id: 'MOM_1M', name: '1月动量', emoji: '⚡', signal: 'STRONG_LONG', ic: 0.044, category: '动量' },
  { id: 'PE_TTM', name: 'PE', emoji: '💰', signal: 'LONG', ic: 0.042, category: '价值' },
  { id: 'ROE', name: 'ROE', emoji: '⭐', signal: 'LONG', ic: 0.029, category: '质量' },
  { id: 'NORTH', name: '北向', emoji: '💵', signal: 'LONG', ic: 0.033, category: '资金' },
  { id: 'PCR', name: 'PCR', emoji: '🎯', signal: 'SHORT', ic: -0.031, category: '期权' },
  { id: 'SHORT', name: '沽空', emoji: '😤', signal: 'SHORT', ic: -0.026, category: '情绪' },
  { id: 'ESG', name: 'ESG', emoji: '🌿', signal: 'LONG', ic: 0.028, category: 'ESG' },
  { id: 'VOL20', name: '波动', emoji: '🌊', signal: 'NEUTRAL', ic: -0.005, category: '波动' },
  { id: 'MAJOR', name: '主力', emoji: '🔥', signal: 'LONG', ic: 0.031, category: '资金' },
  { id: 'DRAGON', name: '龙虎', emoji: '🐉', signal: 'STRONG_LONG', ic: 0.052, category: '情绪' },
];

interface Props { dark?: boolean; factors?: FactorSignal[]; compact?: boolean; }

export default function FactorSignalOverlay({ dark = true, factors = SIGNALS, compact = false }: Props) {
  const c = dark ? {
    bg:'#0a0e1a',s:'#111827',sh:'#1a2236',b:'#1e293b',t:'#e2e8f0',t2:'#64748b',
    a:'#3b82f6',ok:'#22c55e',er:'#ef4444',wa:'#f59e0b',
  } : { bg:'#f8fafc',s:'#fff',sh:'#f1f5f9',b:'#e2e8f0',t:'#0f172a',t2:'#64748b',a:'#2563eb',ok:'#16a34a',er:'#dc2626',wa:'#d97706' };

  const longCount = factors.filter(f => f.signal.includes('LONG')).length;
  const shortCount = factors.filter(f => f.signal.includes('SHORT')).length;

  return <div style={{ padding: compact ? 6 : 10, background: c.bg, borderRadius: 10, border: `1px solid ${c.b}` }}>
    {!compact && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: c.t, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Activity size={12} style={{ color: c.a }}/> 因子信号
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
        <span style={{ color: c.ok }}>{longCount}🟢看多</span>
        <span style={{ color: c.er }}>{shortCount}🔴看空</span>
      </div>
    </div>}

    <div style={{ display: 'flex', gap: compact ? 2 : 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {factors.map(f => {
        const sigBg = f.signal === 'STRONG_LONG' ? c.ok : f.signal === 'LONG' ? c.ok+'40' : f.signal === 'SHORT' ? c.er+'40' : f.signal === 'STRONG_SHORT' ? c.er : c.t2+'30';
        const sigColor = f.signal.includes('LONG') ? c.ok : f.signal.includes('SHORT') ? c.er : c.t2;
        const sigIcon = f.signal === 'STRONG_LONG' ? '🔥' : f.signal === 'LONG' ? '🟢' : f.signal === 'SHORT' ? '🔴' : f.signal === 'STRONG_SHORT' ? '💀' : '⚪';

        return <div key={f.id} title={`${f.name}: IC ${f.ic>0?'+':''}${f.ic.toFixed(3)} (${f.category})`} style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: compact ? '2px 6px' : '3px 8px', borderRadius: compact ? 12 : 14,
          background: sigBg, border: `1px solid ${sigColor}30`,
          fontSize: compact ? 10 : 11, fontWeight: f.signal.includes('LONG') ? 600 : 400,
          color: sigColor, cursor: 'default', transition: 'all 0.2s',
        }}>
          <span style={{ fontSize: compact ? 11 : 13 }}>{f.emoji}</span>
          {!compact && <span>{f.name}</span>}
          {!compact && <span style={{ fontSize: 9, opacity: 0.7 }}>{f.ic>0?'+':''}{f.ic.toFixed(2)}</span>}
        </div>;
      })}
    </div>

    {!compact && <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
      <div style={{ height: 4, borderRadius: 2, background: c.sh, width: '80%', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${(longCount/factors.length)*100}%`, height: '100%', background: c.ok, transition: 'width 0.3s' }}/>
        <div style={{ flex: 1, height: '100%', background: c.er, opacity: 0.3 }}/>
      </div>
    </div>}

    {compact && <div style={{ textAlign: 'center', fontSize: 9, color: c.t2, marginTop: 2 }}>
      {longCount}🟢 / {shortCount}🔴
    </div>}
  </div>;
}

export { type FactorSignal, SIGNALS };
