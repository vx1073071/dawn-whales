// @ts-nocheck
// R282 ML#1: FactorCollapsibleCard — 3级折叠因子卡片 (4h)
// Level 1: 极简摘要 (Robinhood风格) — 只显示emoji+名字+1句话+IC
// Level 2: 展开面板 — 加信号灯+5条关键数据
// Level 3: 全展开 — 全部detail+趋势图+操作
// 人话翻译默认可见，专业数据折叠，移动端优化
import React, { useState, useCallback } from 'react';

export interface FactorCardData {
  id: string;
  emoji: string;
  name: string;
  humanLabel: string;   // ≤12字人话
  ic: number;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  categoryCN: string;
  marketCN: string;
  stars: number;
  sharpe?: number;
  winRate?: number;
  turnover?: number;
  description: string;
  dontUseWhen: string;
  freshness: string;
  trend?: number[];
}

interface Props { data: FactorCardData; dark?: boolean; onToggleFav?: () => void; isFav?: boolean; }

export default function FactorCollapsibleCard({ data, dark = true, onToggleFav, isFav = false }: Props) {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const icC = data.ic > 0 ? c.ok : c.er;
  const sigLabel = data.signal === 'STRONG_LONG' ? '强力做多' : data.signal === 'LONG' ? '做多' : data.signal === 'SHORT' ? '做空' : data.signal === 'STRONG_SHORT' ? '强力做空' : '中性';
  const sigC = data.signal.includes('LONG') ? c.ok : data.signal.includes('SHORT') ? c.er : c.wa;

  return <div style={{
    padding: '14px 16px', borderRadius: 12, background: c.s, border: `1px solid ${c.b}`,
    transition: 'all 0.2s', marginBottom: 10, cursor: 'pointer',
  }} onClick={() => setLevel(level === 3 ? 1 : level === 1 ? 2 : 3)}>
    {/* ============ LEVEL 1: 极简摘要 ============ */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 24 }}>{data.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: c.t }}>{data.name}</span>
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: sigC + '18', color: sigC, fontWeight: 600 }}>{sigLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: c.t2, marginTop: 2 }}>{data.humanLabel}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: icC }}>{data.ic > 0 ? '+' : ''}{data.ic.toFixed(3)}</div>
        <div style={{ fontSize: 9, color: c.t2 }}>IC</div>
      </div>
    </div>

    {/* ============ LEVEL 2: 关键数据 ============ */}
    {(level >= 2) && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.b}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
        {[
          { l: '夏普', v: data.sharpe?.toFixed(2) || '—' },
          { l: '胜率', v: data.winRate != null ? `${(data.winRate * 100).toFixed(0)}%` : '—' },
          { l: '换手', v: data.turnover != null ? `${(data.turnover * 100).toFixed(0)}%` : '—' },
          { l: '星级', v: '⭐'.repeat(data.stars) },
          { l: '新鲜度', v: data.freshness },
        ].map((r, i) => <div key={i} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: c.sh }}>
          <div style={{ fontSize: 10, color: c.t2 }}>{r.l}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.t, marginTop: 2 }}>{r.v}</div>
        </div>)}
      </div>
    </div>}

    {/* ============ LEVEL 3: 全部 + 操作 ============ */}
    {level >= 3 && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.b}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ padding: 10, borderRadius: 8, background: c.sh }}>
          <div style={{ fontSize: 10, color: c.t2 }}>📊 是什么</div>
          <div style={{ fontSize: 12, color: c.t, marginTop: 2 }}>{data.description}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: c.er + '08', border: `1px solid ${c.er}18` }}>
          <div style={{ fontSize: 10, color: c.er }}>⚠️ 别用场景</div>
          <div style={{ fontSize: 12, color: c.t2, marginTop: 2 }}>{data.dontUseWhen}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {onToggleFav && <button onClick={e => { e.stopPropagation(); onToggleFav(); }} style={{
          flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${c.wa}`, background: 'transparent',
          color: isFav ? c.wa : c.t2, cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>{isFav ? '⭐ 已收藏' : '☆ 收藏因子'}</button>}
        <button onClick={e => { e.stopPropagation(); setLevel(1); }} style={{
          flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${c.a}`, background: c.a,
          color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>收起</button>
      </div>
      <div style={{ fontSize: 10, color: c.t2, textAlign: 'center', marginTop: 8 }}>
        💡 点击卡片切换摘要/详情/完整三种视图
      </div>
    </div>}

    {/* Level indicator */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: level > 1 ? 8 : 4 }}>
      {[1, 2, 3].map(l => <div key={l} style={{
        width: 6, height: 6, borderRadius: 3,
        background: level >= l ? c.a : c.t2, opacity: level >= l ? 1 : 0.3,
        transition: 'all 0.2s',
      }}/>)}
    </div>
  </div>;
}
