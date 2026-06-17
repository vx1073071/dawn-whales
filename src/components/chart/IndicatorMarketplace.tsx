import { useState, useMemo } from 'react';

// ── Indicator Template Marketplace ── ML#3 R270 (4h)
// Community-shared indicator templates with preview, rating, download

interface IndicatorTemplate {
  id: string;
  name: string;
  author: string;
  authorAvatar?: string;
  indicators: string[];
  category: 'trend' | 'momentum' | 'combo' | 'custom' | 'volatility';
  rating: number;     // 1-5
  downloads: number;
  price: number;      // USDT
  description: string;
  preview: string;    // base64 or svg
  tags: string[];
}

const MOCK_TEMPLATES: IndicatorTemplate[] = [
  {
    id: 'tpl_001', name: 'MACD金叉套装', author: 'TraderWhale',
    indicators: ['MACD', 'RSI', 'VOL'], category: 'momentum', rating: 4.8, downloads: 2340, price: 9.9,
    description: 'MACD金叉+RSI背离+成交量确认三重过滤，适合趋势行情',
    preview: '', tags: ['金叉', '趋势', 'MACD', '热门'],
  },
  {
    id: 'tpl_002', name: '布林带挤压突破', author: 'QuantMaster',
    indicators: ['BOLL', 'ATR', 'SqueezeMom'], category: 'volatility', rating: 4.6, downloads: 1890, price: 12.9,
    description: '布林带+ATR+Squeeze动量，捕捉挤压后的爆发行情',
    preview: '', tags: ['布林带', '突破', '波动率'],
  },
  {
    id: 'tpl_003', name: 'A股主力追踪套装', author: 'ChinaBull',
    indicators: ['ChipPct', 'FundFlow', 'NorthBound', 'LongHu', 'VOL'], category: 'combo', rating: 4.9, downloads: 3560, price: 19.9,
    description: '筹码集中度+资金流向+龙虎榜+北向五维追踪。适合A股。',
    preview: '', tags: ['A股', '主力', '龙虎榜', '爆款'],
  },
  {
    id: 'tpl_004', name: '均线多头排列', author: 'TrendRider',
    indicators: ['MA', 'EMA', 'HullMA', 'SuperTrend', 'VOL'], category: 'trend', rating: 4.5, downloads: 1560, price: 9.9,
    description: 'MA20>MA60>MA120多头排列，多周期均线叠加',
    preview: '', tags: ['均线', '趋势', '多头'],
  },
  {
    id: 'tpl_005', name: '超买超卖组合', author: 'OscillatorPro',
    indicators: ['RSI', 'StochRSI', 'CCI', 'MFI', 'WR'], category: 'momentum', rating: 4.3, downloads: 980, price: 7.9,
    description: '5个震荡指标多重确认，RSI+StochRSI+CCI+MFI+WR',
    preview: '', tags: ['超买超卖', '震荡', '反转'],
  },
  {
    id: 'tpl_006', name: '订单流专业套装', author: 'FlowMaster',
    indicators: ['Footprint', 'CumDelta', 'CVD', 'LargeLot', 'VOL'], category: 'combo', rating: 4.7, downloads: 720, price: 24.9,
    description: 'Footprint+Delta+CVD+大单检测，专业交易员方案',
    preview: '', tags: ['订单流', '专业', '成交量'],
  },
];

const IndicatorMarketplace = () => {
  const [filter, setFilter] = useState<'all' | 'free' | 'paid' | 'popular'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'downloads' | 'price'>('rating');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = MOCK_TEMPLATES;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) || t.description.includes(q) || t.tags.some(tag => tag.includes(q))
      );
    }
    if (filter === 'free') list = list.filter(t => t.price === 0);
    if (filter === 'paid') list = list.filter(t => t.price > 0);
    if (filter === 'popular') list = list.filter(t => t.downloads >= 1500);
    return [...list].sort((a, b) => sortBy === 'rating' ? b.rating - a.rating :
                                            sortBy === 'downloads' ? b.downloads - a.downloads :
                                            a.price - b.price);
  }, [filter, search, sortBy]);

  return (
    <div className="indicator-marketplace" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🏪 指标模板市场</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{MOCK_TEMPLATES.length}个模板</span>
      </div>

      {/* Search + Sort */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text" placeholder="搜索指标模板..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, boxSizing: 'border-box',
          }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 10 }}>
          <option value="rating">⭐ 评分</option>
          <option value="downloads">📥 下载</option>
          <option value="price">💰 价格</option>
        </select>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[
          { key: 'all' as const, label: '全部' },
          { key: 'free' as const, label: '免费' },
          { key: 'paid' as const, label: '付费' },
          { key: 'popular' as const, label: '热门' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '3px 10px', borderRadius: 12, border: 'none', fontSize: 10, cursor: 'pointer',
            background: filter === f.key ? '#3b82f6' : '#f1f5f9',
            color: filter === f.key ? 'white' : '#64748b',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Template Cards */}
      <div style={{ display: 'grid', gap: 6 }}>
        {filtered.map(tpl => {
          const isSelected = selected === tpl.id;
          return (
            <div
              key={tpl.id}
              onClick={() => setSelected(isSelected ? null : tpl.id)}
              style={{
                padding: 10, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                background: isSelected ? '#eff6ff' : 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{tpl.name}</span>
                    {tpl.price > 0 ? (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#fef3c7', color: '#f59e0b' }}>
                        {tpl.price} USDT
                      </span>
                    ) : (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#dcfce7', color: '#16a34a' }}>
                        免费
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
                    {tpl.description}
                  </div>

                  {/* Indicator chips */}
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                    {tpl.indicators.map(ind => (
                      <span key={ind} style={{
                        fontSize: 8, padding: '1px 6px', borderRadius: 8,
                        background: '#eff6ff', color: '#3b82f6',
                      }}>{ind}</span>
                    ))}
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {tpl.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 7, padding: '0 4px', borderRadius: 6,
                        background: '#f1f5f9', color: '#94a3b8',
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Right stats */}
                <div style={{ textAlign: 'right', minWidth: 60 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>⭐ {tpl.rating.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>📥 {tpl.downloads}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>by {tpl.author}</div>
                </div>
              </div>

              {/* Expanded actions */}
              {isSelected && (
                <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                      background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
                    }}>
                      📥 下载 ({tpl.price > 0 ? tpl.price + 'U' : '免费'})
                    </button>
                    <button style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #d1d5db',
                      background: 'white', fontSize: 11, cursor: 'pointer',
                    }}>
                      🔍 预览
                    </button>
                    <button style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                      background: 'white', fontSize: 11, cursor: 'pointer',
                    }}>
                      📌 收藏
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
          🏪 暂无匹配模板 — 换个关键词试试
        </div>
      )}

      {/* Publisher CTA */}
      <div style={{
        marginTop: 10, padding: 10, borderRadius: 8, background: '#fefce8',
        border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 10 }}>
          <div style={{ fontWeight: 600 }}>📤 发布你的指标模板</div>
          <div style={{ color: '#92400e' }}>收益70%-90%归创作者！L1=70% / L2=80% / L3=90%</div>
        </div>
        <button style={{
          padding: '6px 14px', borderRadius: 6, border: 'none',
          background: '#f59e0b', color: 'white', fontWeight: 600, fontSize: 10, cursor: 'pointer',
        }}>
          立即发布
        </button>
      </div>
    </div>
  );
};

export default IndicatorMarketplace;
