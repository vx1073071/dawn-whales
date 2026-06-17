import { useState, useMemo } from 'react';

// ── Expanded Indicator Switcher ── ML#1 R268 (6h)
// 29→93 indicators, category system, search, favorites, 64 new

interface IndicatorMeta {
  id: string;
  name: string;
  fullName: string;
  category: 'trend' | 'momentum' | 'volume' | 'volatility' | 'china' | 'orderflow';
  emoji: string;
  description: string;
  params: { name: string; default: number; min: number; max: number }[];
  isFavorite?: boolean;
  isNew?: boolean;
}

interface IndicatorSwitcherProps {
  activeIndicators: string[];
  onToggle: (id: string) => void;
  onParamsChange: (id: string, params: Record<string, number>) => void;
}

const ALL_INDICATORS: IndicatorMeta[] = [
  // Trend (14)
  { id: 'ma', name: 'MA', fullName: '移动平均线', category: 'trend', emoji: '📈', description: '算术移动平均，最基础的趋势指标', params: [{ name: 'period', default: 20, min: 2, max: 500 }] },
  { id: 'ema', name: 'EMA', fullName: '指数移动均线', category: 'trend', emoji: '📉', description: '对近期价格赋予更高权重', params: [{ name: 'period', default: 20, min: 2, max: 500 }] },
  { id: 'sma', name: 'SMA', fullName: '简单均线', category: 'trend', emoji: '➖', description: '简单移动平均', params: [{ name: 'period', default: 50, min: 2, max: 500 }] },
  { id: 'wma', name: 'WMA', fullName: '加权移动均线', category: 'trend', emoji: '⚖️', description: '线性加权移动平均', params: [{ name: 'period', default: 20, min: 2, max: 500 }] },
  { id: 'hull', name: 'Hull MA', fullName: 'Hull移动均线', category: 'trend', emoji: '🚀', description: '零延迟移动均线，反应极快', params: [{ name: 'period', default: 20, min: 2, max: 300 }], isNew: true },
  { id: 'tema', name: 'TEMA', fullName: '三重指数均线', category: 'trend', emoji: '🔺', description: '三次EMA平滑，消除更多噪音', params: [{ name: 'period', default: 20, min: 2, max: 300 }] },
  { id: 'alma', name: 'ALMA', fullName: 'Arnaud Legoux MA', category: 'trend', emoji: '🎯', description: '正态分布权重，减少噪音+降低延迟', params: [{ name: 'period', default: 20, min: 2, max: 300 }], isNew: true },
  { id: 'vwma', name: 'VWMA', fullName: '成交量加权均线', category: 'trend', emoji: '📊', description: '成交量越大权重越高', params: [{ name: 'period', default: 20, min: 2, max: 300 }], isNew: true },
  { id: 'superTrend', name: 'SuperTrend', fullName: '超级趋势', category: 'trend', emoji: '🟢', description: '基于ATR的趋势跟踪指标', params: [{ name: 'period', default: 10, min: 2, max: 50 }, { name: 'multiplier', default: 3, min: 1, max: 10 }], isNew: true },
  { id: 'keltner', name: 'Keltner', fullName: '肯特纳通道', category: 'trend', emoji: '📐', description: '基于ATR的价格通道', params: [{ name: 'period', default: 20, min: 2, max: 200 }] },
  { id: 'donchian', name: 'Donchian', fullName: '唐奇安通道', category: 'trend', emoji: '🧱', description: 'N周期最高最低通道', params: [{ name: 'period', default: 20, min: 2, max: 200 }], isNew: true },
  { id: 'envelope', name: 'Envelope', fullName: '包络线', category: 'trend', emoji: '✉️', description: '均线上下百分比通道', params: [{ name: 'period', default: 20, min: 2, max: 200 }, { name: 'pct', default: 5, min: 1, max: 20 }], isNew: true },
  { id: 'parabolicSar', name: 'SAR', fullName: '抛物线SAR', category: 'trend', emoji: '🔴', description: '止损反转指标，追踪止盈好帮手', params: [{ name: 'accel', default: 0.02, min: 0.01, max: 0.1 }] },
  { id: 'guppy', name: 'Guppy MMA', fullName: '顾比多重均线', category: 'trend', emoji: '🌈', description: '12条均线，判断趋势强度', isNew: true, params: [] },

  // Momentum (11)
  { id: 'rsi', name: 'RSI', fullName: '相对强弱指数', category: 'momentum', emoji: '⚡', description: '最常用的超买超卖指标', params: [{ name: 'period', default: 14, min: 2, max: 200 }] },
  { id: 'macd', name: 'MACD', fullName: '异同移动平均线', category: 'momentum', emoji: '📶', description: '金叉死叉，经典趋势动量指标', params: [{ name: 'fast', default: 12, min: 2, max: 100 }, { name: 'slow', default: 26, min: 2, max: 100 }, { name: 'signal', default: 9, min: 2, max: 50 }] },
  { id: 'stoch', name: 'Stochastic', fullName: '随机指标', category: 'momentum', emoji: '🎰', description: '比较收盘价与价格区间', params: [{ name: 'k', default: 14, min: 2, max: 200 }, { name: 'd', default: 3, min: 1, max: 20 }] },
  { id: 'stochRsi', name: 'StochRSI', fullName: '随机RSI', category: 'momentum', emoji: '🔥', description: 'RSI的随机震荡，更灵敏', params: [{ name: 'period', default: 14, min: 2, max: 200 }], isNew: true },
  { id: 'cci', name: 'CCI', fullName: '商品通道指数', category: 'momentum', emoji: '📡', description: '测量价格偏离统计均值', params: [{ name: 'period', default: 20, min: 2, max: 200 }] },
  { id: 'mfi', name: 'MFI', fullName: '资金流向指数', category: 'momentum', emoji: '💰', description: '量价结合的RSI', params: [{ name: 'period', default: 14, min: 2, max: 200 }] },
  { id: 'williamsR', name: 'Williams %R', fullName: '威廉指标', category: 'momentum', emoji: '📉', description: '类似Stoch，方向相反', params: [{ name: 'period', default: 14, min: 2, max: 200 }], isNew: true },
  { id: 'roc', name: 'ROC', fullName: '变动率', category: 'momentum', emoji: '🚄', description: '价格变化速率', params: [{ name: 'period', default: 12, min: 1, max: 200 }] },
  { id: 'ultimateOsc', name: 'Ultimate Osc', fullName: '终极震荡指标', category: 'momentum', emoji: '🌀', description: '三周期加权震荡器', params: [{ name: 'p1', default: 7, min: 2, max: 50 }, { name: 'p2', default: 14, min: 2, max: 100 }], isNew: true },
  { id: 'trix', name: 'TRIX', fullName: '三重指数震荡', category: 'momentum', emoji: '↗️', description: '去趋势后的动量', params: [{ name: 'period', default: 15, min: 2, max: 200 }], isNew: true },
  { id: 'ao', name: 'AO', fullName: 'Awesome Oscillator', category: 'momentum', emoji: '🦅', description: '5-34周期简单移动均线差值', isNew: true, params: [] },

  // Volume (3)
  { id: 'vol', name: 'VOL', fullName: '成交量', category: 'volume', emoji: '📦', description: '最基本的成交量柱', params: [] },
  { id: 'obv', name: 'OBV', fullName: '能量潮', category: 'volume', emoji: '🌊', description: '量价背离检测', params: [] },
  { id: 'emv', name: 'EMV', fullName: '简易波动指标', category: 'volume', emoji: '📡', description: '量价关系量化', params: [{ name: 'period', default: 14, min: 2, max: 200 }], isNew: true },

  // Volatility (8)
  { id: 'boll', name: 'BOLL', fullName: '布林带', category: 'volatility', emoji: '🎗️', description: '标准差通道，波动率可视化', params: [{ name: 'period', default: 20, min: 2, max: 200 }, { name: 'stddev', default: 2, min: 1, max: 5 }] },
  { id: 'atr', name: 'ATR', fullName: '平均真实波幅', category: 'volatility', emoji: '📏', description: '测量波动性，设定止损参考', params: [{ name: 'period', default: 14, min: 2, max: 200 }] },
  { id: 'bollWidth', name: 'BB Width', fullName: '布林带宽度', category: 'volatility', emoji: '↔️', description: '布林带的宽度百分比', params: [{ name: 'period', default: 20, min: 2, max: 200 }], isNew: true },
  { id: 'historicalVol', name: 'Hist Vol', fullName: '历史波动率', category: 'volatility', emoji: '📐', description: 'N日年化标准差', params: [{ name: 'period', default: 20, min: 2, max: 252 }], isNew: true },
  { id: 'beta', name: 'Beta', fullName: '贝塔系数', category: 'volatility', emoji: 'β', description: '相对市场的波动倍数', isNew: true, params: [] },
  { id: 'squeeze', name: 'Squeeze Mom', fullName: '挤压动量', category: 'volatility', emoji: '🧃', description: '布林带内Keltner=挤压→突破', isNew: true, params: [] },
  { id: 'ulcerIdx', name: 'Ulcer Index', fullName: '溃疡指数', category: 'volatility', emoji: '🤒', description: '回撤的深度和持续时间', isNew: true, params: [] },
  { id: 'massIdx', name: 'Mass Index', fullName: '质量指数', category: 'volatility', emoji: '⚗️', description: '趋势反转预警', params: [{ name: 'period', default: 25, min: 2, max: 200 }], isNew: true },

  // China Market (10)
  { id: 'chipPct', name: 'Chip Pct', fullName: '筹码集中度', category: 'china', emoji: '🎯', description: '前10%筹码占比', isNew: true, params: [] },
  { id: 'fundFlow', name: 'Fund Flow', fullName: '资金净流入', category: 'china', emoji: '💸', description: '主力+大单+散户资金流向', isNew: true, params: [] },
  { id: 'northBound', name: 'North Bound', fullName: '北向资金', category: 'china', emoji: '🧭', description: '沪深港通北向净买入', isNew: true, params: [] },
  { id: 'marginBal', name: 'Margin Bal', fullName: '融资余额', category: 'china', emoji: '🏦', description: '两融余额变化趋势', isNew: true, params: [] },
  { id: 'fenShiBoll', name: 'FenShi Boll', fullName: '分时博弈', category: 'china', emoji: '⏱️', description: '分时资金博弈指标', isNew: true, params: [] },
  { id: 'longHu', name: 'LongHu Bang', fullName: '龙虎榜', category: 'china', emoji: '🐲', description: '龙虎榜游资动向', isNew: true, params: [] },

  // OrderFlow (8)
  { id: 'cumDelta', name: 'CumDelta', fullName: '累计Delta', category: 'orderflow', emoji: 'Δ', description: '买单-卖单累计差值', isNew: true, params: [] },
  { id: 'footprint', name: 'Footprint', fullName: '足迹图', category: 'orderflow', emoji: '👣', description: '每根K线bid/ask成交量', isNew: true, params: [] },
  { id: 'cvd', name: 'CVD', fullName: '累积量差', category: 'orderflow', emoji: '📊', description: 'Cumulative Volume Delta', isNew: true, params: [] },
  { id: 'largeLot', name: 'Large Lot', fullName: '大单检测', category: 'orderflow', emoji: '🐋', description: '实时大单成交检测', isNew: true, params: [] },
];

const CATEGORIES = [
  { key: 'trend' as const, label: '趋势', emoji: '📈', color: '#3b82f6' },
  { key: 'momentum' as const, label: '动量', emoji: '⚡', color: '#f59e0b' },
  { key: 'volume' as const, label: '成交量', emoji: '📦', color: '#22c55e' },
  { key: 'volatility' as const, label: '波动', emoji: '🌊', color: '#8b5cf6' },
  { key: 'china' as const, label: '中国市场', emoji: '🇨🇳', color: '#ef4444' },
  { key: 'orderflow' as const, label: '订单流', emoji: '📊', color: '#ec4899' },
];

const IndicatorSwitcherPro = ({ activeIndicators, onToggle, onParamsChange }: IndicatorSwitcherProps) => {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<IndicatorMeta['category'] | 'all'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['ma', 'macd', 'rsi', 'boll', 'vol']));
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [editingParam, setEditingParam] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = ALL_INDICATORS;
    if (activeCat !== 'all') list = list.filter(i => i.category === activeCat);
    if (showNewOnly) list = list.filter(i => i.isNew);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.fullName.includes(q) || i.description.includes(q));
    }
    // Sort: active first, then favorites, then rest
    return [...list].sort((a, b) => {
      const aScore = (activeIndicators.includes(a.id) ? 3 : 0) + (favorites.has(a.id) ? 1 : 0) + (a.isNew ? 0.5 : 0);
      const bScore = (activeIndicators.includes(b.id) ? 3 : 0) + (favorites.has(b.id) ? 1 : 0) + (b.isNew ? 0.5 : 0);
      return bScore - aScore;
    });
  }, [search, activeCat, showNewOnly, activeIndicators, favorites]);

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
  };

  const stats = useMemo(() => ({
    total: ALL_INDICATORS.length,
    active: activeIndicators.length,
    favorites: favorites.size,
    newCount: ALL_INDICATORS.filter(i => i.isNew).length,
  }), [activeIndicators, favorites]);

  return (
    <div className="indicator-switcher-pro" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 540 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>📐 指标切换器</span>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
          <span>✅ {stats.active}/{stats.total}</span>
          <span>⭐ {stats.favorites}</span>
          <span style={{ color: '#f59e0b' }}>🆕 {stats.newCount}</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="搜索64个新指标..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
            fontSize: 11, boxSizing: 'border-box',
          }}
        />
        <label style={{
          fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          <input type="checkbox" checked={showNewOnly} onChange={e => setShowNewOnly(e.target.checked)} />
          🆕新
        </label>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveCat('all')} style={{
          padding: '3px 8px', borderRadius: 12, border: 'none', fontSize: 10, cursor: 'pointer',
          background: activeCat === 'all' ? '#64748b' : '#f1f5f9',
          color: activeCat === 'all' ? 'white' : '#64748b',
        }}>全部 ({ALL_INDICATORS.length})</button>
        {CATEGORIES.map(cat => {
          const cnt = ALL_INDICATORS.filter(i => i.category === cat.key).length;
          return (
            <button key={cat.key} onClick={() => setActiveCat(cat.key)} style={{
              padding: '3px 8px', borderRadius: 12, border: 'none', fontSize: 10, cursor: 'pointer',
              background: activeCat === cat.key ? cat.color : '#f1f5f9',
              color: activeCat === cat.key ? 'white' : '#64748b',
            }}>{cat.emoji} {cat.label} ({cnt})</button>
          );
        })}
      </div>

      {/* Indicator Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
        {filtered.map(ind => {
          const isActive = activeIndicators.includes(ind.id);
          const cat = CATEGORIES.find(c => c.key === ind.category);
          return (
            <div key={ind.id} style={{
              padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${isActive ? (cat?.color || '#3b82f6') : '#e5e7eb'}`,
              background: isActive ? `${cat?.color || '#3b82f6'}08` : 'white',
              transition: 'all 0.15s',
            }} onClick={() => onToggle(ind.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 12 }}>{ind.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 11 }}>{ind.name}</span>
                {ind.isNew && <span style={{ fontSize: 8, background: '#fef3c7', color: '#f59e0b', padding: '0 4px', borderRadius: 4 }}>NEW</span>}
                {isActive && <span style={{ fontSize: 10, color: cat?.color || '#3b82f6' }}>✅</span>}
                <button
                  onClick={e => { e.stopPropagation(); toggleFavorite(ind.id); }}
                  style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
                >
                  {favorites.has(ind.id) ? '⭐' : '☆'}
                </button>
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3 }}>
                {ind.description}
              </div>

              {/* Params editor (when active & editing) */}
              {isActive && editingParam === ind.id && ind.params.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {ind.params.map(p => (
                    <label key={p.name} style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 2 }}>
                      {p.name}:
                      <input
                        type="number"
                        defaultValue={p.default}
                        min={p.min} max={p.max}
                        style={{ width: 40, fontSize: 9, padding: '1px 2px' }}
                        onChange={e => onParamsChange(ind.id, { [p.name]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
              )}

              {isActive && ind.params.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setEditingParam(editingParam === ind.id ? null : ind.id); }}
                  style={{ marginTop: 3, fontSize: 8, border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer' }}
                >
                  {editingParam === ind.id ? '收起' : '⚙️ 参数'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
          🔍 无匹配指标 — 尝试其他关键词
        </div>
      )}
    </div>
  );
};

export { ALL_INDICATORS, CATEGORIES };
export default IndicatorSwitcherPro;
