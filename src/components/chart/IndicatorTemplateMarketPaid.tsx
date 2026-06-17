// @ts-nocheck
// R285 ML#2: IndicatorTemplateMarketPaid — 模板市场付费UI (4h)
// Community indicator templates with purchase flow, creator tiers, rating
// Free: 3 basic templates. Paid: Community/AI-generated. Platform 30% cut.
// 指标模板市场: 免费3个基础+付费社区模板+AI定制
import React, { useState, useMemo, useCallback } from 'react';
import { ShoppingCart, Star, Download, TrendingUp, Zap, Shield, Crown, Filter, Search } from 'lucide-react';

interface Template {
  id: string; name: string; author: string; avatar: string;
  indicators: string[]; category: string; rating: number; downloads: number;
  price: number; // USDT, 0 = free
  description: string; tier: 'free' | 'basic' | 'premium';
  return5Y?: number; // annualized backtest return
  sharpe?: number;
}

const TEMPLATES: Template[] = [
  // Free tier (3)
  { id: 'free01', name: 'MACD金叉基础', author: 'DawnWhales', avatar: '🐄', indicators: ['MACD', 'VOL'], category: '动量', rating: 4.2, downloads: 5620, price: 0, tier: 'free', description: '经典MACD金叉+成交量确认，适合新手入门', return5Y: 8.5, sharpe: 0.72 },
  { id: 'free02', name: '双均线交叉', author: 'DawnWhales', avatar: '🐄', indicators: ['MA5', 'MA20'], category: '趋势', rating: 3.9, downloads: 4100, price: 0, tier: 'free', description: '5日20日均线金叉死叉，最经典的均线策略', return5Y: 6.2, sharpe: 0.55 },
  { id: 'free03', name: 'RSI超买超卖', author: 'DawnWhales', avatar: '🐄', indicators: ['RSI14'], category: '反转', rating: 4.0, downloads: 3800, price: 0, tier: 'free', description: 'RSI>70超买/RSI<30超卖，均值回归策略', return5Y: 5.8, sharpe: 0.48 },
  // Paid basic
  { id: 'paid01', name: 'MACD背离套装', author: 'QuantKing', avatar: '👑', indicators: ['MACD', 'RSI', 'OBV'], category: '动量', rating: 4.8, downloads: 2340, price: 4.9, tier: 'basic', description: 'MACD背离+RSI强度+OBV量能三重过滤，高胜率', return5Y: 15.3, sharpe: 1.12 },
  { id: 'paid02', name: '布林带挤压突破', author: 'VolMaster', avatar: '🌊', indicators: ['BOLL', 'ATR', 'SqueezeMom'], category: '波动', rating: 4.6, downloads: 1890, price: 9.9, tier: 'basic', description: '布林带宽收窄→挤压→突破，捕捉爆发行情', return5Y: 22.1, sharpe: 1.45 },
  { id: 'paid03', name: '一目均衡全系', author: 'TokyoTrader', avatar: '🗾', indicators: ['Ichimoku', 'KDJ'], category: '趋势', rating: 4.7, downloads: 1560, price: 12.9, tier: 'basic', description: '一目均衡+KDJ，日股交易员最爱组合', return5Y: 18.7, sharpe: 1.28 },
  // Premium tier
  { id: 'paid04', name: '成交量加权MACD', author: 'AI_Whale', avatar: '🤖', indicators: ['VWAP', 'VWMA', 'MACD'], category: '成交量', rating: 4.9, downloads: 890, price: 19.9, tier: 'premium', description: '成交量加权均线+MACD，机构级策略', return5Y: 28.4, sharpe: 1.78 },
  { id: 'paid05', name: '五维共振系统', author: 'AI_Whale', avatar: '🤖', indicators: ['ADX', 'RSI', 'MACD', 'BOLL', 'OBV'], category: '组合', rating: 4.9, downloads: 620, price: 29.9, tier: 'premium', description: '5指标共振入场，AI自动优化参数', return5Y: 35.2, sharpe: 2.05 },
];

interface Props { dark?: boolean; onBuy?: (tpl: Template) => void; }

export default function IndicatorTemplateMarketPaid({ dark = true, onBuy }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [tier, setTier] = useState<'ALL' | 'free' | 'paid'>('ALL');
  const [confirmBuy, setConfirmBuy] = useState<Template | null>(null);

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const filtered = useMemo(() => TEMPLATES.filter(t => {
    if (search && !t.name.includes(search) && !t.author.includes(search) && !t.description.includes(search)) return false;
    if (category !== 'ALL' && t.category !== category) return false;
    if (tier === 'free' && t.price > 0) return false;
    if (tier === 'paid' && t.price === 0) return false;
    return true;
  }), [search, category, tier]);

  const cats = ['ALL', ...new Set(TEMPLATES.map(t => t.category))];

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto', borderRadius: 14 }}>
    {/* Header */}
    <div style={{ textAlign: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        🏪 指标模板市场
      </div>
      <div style={{ fontSize: 11, color: c.t2, marginTop: 4 }}>
        {TEMPLATES.length} 个模板 · {TEMPLATES.filter(t => t.price === 0).length}免费 · 社区创作者分享
      </div>
    </div>

    {/* Search + Filters */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '6px 12px', borderRadius: 8, background: c.s, border: `1px solid ${c.b}` }}>
        <Search size={13} style={{ color: c.t2 }}/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索模板..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: c.t }}/>
      </div>
      <select value={tier} onChange={e => setTier(e.target.value as any)} style={{ padding: '4px 8px', borderRadius: 8, background: c.s, border: `1px solid ${c.b}`, color: c.t, fontSize: 11, cursor: 'pointer', outline: 'none' }}>
        <option value="ALL">全部</option><option value="free">免费</option><option value="paid">付费</option>
      </select>
    </div>

    {/* Category pills */}
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
      {cats.map(cat => <button key={cat} onClick={() => setCategory(cat)} style={{
        padding: '3px 10px', borderRadius: 14, fontSize: 10, fontWeight: category === cat ? 600 : 400,
        cursor: 'pointer', border: category === cat ? `1px solid ${c.a}` : `1px solid ${c.b}`,
        background: category === cat ? c.ab : 'transparent', color: category === cat ? c.a : c.t2,
      }}>{cat === 'ALL' ? '全部' : cat}</button>)}
    </div>

    {/* Templates */}
    {filtered.map(tpl => (
      <div key={tpl.id} style={{ padding: 12, borderRadius: 10, background: c.s, border: `1px solid ${tpl.tier === 'premium' ? c.wa + '40' : c.b}`, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18 }}>{tpl.avatar}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: c.t }}>{tpl.name}</span>
              {tpl.tier === 'premium' && <Crown size={13} style={{ color: c.wa }}/>}
              {tpl.tier === 'free' && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: c.ok + '15', color: c.ok }}>免费</span>}
            </div>
            <div style={{ fontSize: 10, color: c.t2, marginTop: 2 }}>by {tpl.author} · {tpl.indicators.join(' + ')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {tpl.price > 0 ? <div style={{ fontSize: 16, fontWeight: 700, color: c.a }}>{tpl.price}U</div> : <div style={{ fontSize: 16, fontWeight: 700, color: c.ok }}>免费</div>}
          </div>
        </div>

        <div style={{ fontSize: 11, color: c.t2, marginBottom: 8 }}>{tpl.description}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          {[
            { l: '评分', v: '⭐'.repeat(Math.round(tpl.rating)) },
            { l: '下载', v: tpl.downloads.toLocaleString() },
            { l: '年化', v: tpl.return5Y ? `+${tpl.return5Y}%` : '—' },
            { l: '夏普', v: tpl.sharpe?.toFixed(2) || '—' },
          ].map((s, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: c.t2 }}>{s.l}<div style={{ fontSize: 11, fontWeight: 600, color: c.t }}>{s.v}</div></div>)}
        </div>

        <button onClick={() => tpl.price > 0 ? setConfirmBuy(tpl) : {}} style={{
          width: '100%', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: 'none', background: tpl.price > 0 ? c.a : c.ok + '20',
          color: tpl.price > 0 ? '#fff' : c.ok,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          {tpl.price > 0 ? <><ShoppingCart size={13}/> 购买 · {tpl.price} USDT</> : '免费获取'}
        </button>
      </div>
    ))}

    {/* Buy Confirm Modal */}
    {confirmBuy && <div onClick={e => { if (e.target === e.currentTarget) setConfirmBuy(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: c.s, borderRadius: 14, padding: 24, maxWidth: 360, width: '90%', border: `1px solid ${c.b}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>确认购买</div>
        <div style={{ fontSize: 13, color: c.t2, marginBottom: 4 }}>{confirmBuy.name}</div>
        <div style={{ fontSize: 11, color: c.t2, marginBottom: 12 }}>by {confirmBuy.author}</div>
        <div style={{ padding: 12, borderRadius: 8, background: c.sh, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: c.t2 }}>价格</span>
            <span style={{ fontWeight: 600, color: c.t }}>{confirmBuy.price} USDT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: c.t2 }}>平台抽成</span>
            <span style={{ color: c.t2 }}>{Math.round(confirmBuy.price * 0.3 * 100) / 100} USDT (30%)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ color: c.t2 }}>创作者得</span>
            <span style={{ color: c.ok }}>{Math.round(confirmBuy.price * 0.7 * 100) / 100} USDT (70%)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setConfirmBuy(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: c.sh, color: c.t2, border: 'none', cursor: 'pointer', fontSize: 12 }}>取消</button>
          <button onClick={() => { onBuy?.(confirmBuy); setConfirmBuy(null); }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: c.a, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            确认支付 {confirmBuy.price}U
          </button>
        </div>
      </div>
    </div>}
  </div>;
}
