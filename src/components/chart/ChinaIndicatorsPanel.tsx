import { useState, useMemo } from 'react';

// ── China 10 Market-Specific Indicators UI ── ML#3 R269 (4h)
// A股特色指标: 筹码+资金+北向+龙虎榜+融资融券...

interface ChinaIndicator {
  id: string;
  name: string;
  fullName: string;
  emoji: string;
  category: 'chip' | 'fund' | 'north' | 'margin' | 'longhu' | 'board';
  unit: string;
  description: string;
  source: string;
}

const CHINA_10: ChinaIndicator[] = [
  {
    id: 'chip_concentration', name: '筹码集中度', fullName: 'Chip Concentration',
    emoji: '🎯', category: 'chip', unit: '%',
    description: '前10%股东持仓占比，越高越集中。>60%=主力控盘，<30%=散户主导',
    source: '东方财富/同花顺',
  },
  {
    id: 'chip_profit_ratio', name: '获利比例', fullName: 'Chip Profit Ratio',
    emoji: '💰', category: 'chip', unit: '%',
    description: '当前价格以下的筹码占比。>80%=大部分获利抛压小，<20%=深度套牢',
    source: '东方财富/同花顺',
  },
  {
    id: 'main_force_flow', name: '主力净流入', fullName: 'Main Force Net Flow',
    emoji: '🐋', category: 'fund', unit: '亿元',
    description: '超大单+大单净买入。>0.5亿=明显流入，<-0.5亿=明显流出',
    source: '东方财富/同花顺',
  },
  {
    id: 'retail_flow', name: '散户净流入', fullName: 'Retail Net Flow',
    emoji: '🐟', category: 'fund', unit: '亿元',
    description: '小单+中单净买入。散户反向情绪指标',
    source: '东方财富/同花顺',
  },
  {
    id: 'north_bound', name: '北向资金', fullName: 'North Bound Capital',
    emoji: '🧭', category: 'north', unit: '亿元/日',
    description: '沪深港通T+1日净买入。连续3日流入=外资看好',
    source: '沪深港通',
  },
  {
    id: 'south_bound', name: '南向资金', fullName: 'South Bound Capital',
    emoji: '🧭', category: 'north', unit: '亿元/日',
    description: '内地资金净流入港股。连续流入=抄底港股',
    source: '沪深港通',
  },
  {
    id: 'margin_balance', name: '融资余额', fullName: 'Margin Balance',
    emoji: '🏦', category: 'margin', unit: '亿元',
    description: '融资买入未偿还金额。增加=加杠杆看多，减少=去杠杆',
    source: '交易所',
  },
  {
    id: 'short_balance', name: '融券余额', fullName: 'Short Balance',
    emoji: '🐻', category: 'margin', unit: '亿元',
    description: '融券卖出未偿还金额。增加=看空力量加强',
    source: '交易所',
  },
  {
    id: 'longhu_bang', name: '龙虎榜', fullName: 'Dragon-Tiger Board',
    emoji: '🐲', category: 'longhu', unit: '排名',
    description: '当日涨跌幅>7%股票的买卖席位Top5。游资/机构动向',
    source: '交易所/东方财富',
  },
  {
    id: 'board_rotation', name: '板块轮动', fullName: 'Sector Rotation Index',
    emoji: '🔄', category: 'board', unit: '指数',
    description: '申万一级行业轮动热度。识别市场主线板块',
    source: '申万研究所/东方财富',
  },
];

const ChinaIndicatorsPanel = () => {
  const [activeCat, setActiveCat] = useState<ChinaIndicator['category'] | 'all'>('all');
  const [detail, setDetail] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return activeCat === 'all' ? CHINA_10 : CHINA_10.filter(c => c.category === activeCat);
  }, [activeCat]);

  const categories = [
    { key: 'all' as const, label: '全部', emoji: '🇨🇳' },
    { key: 'chip' as const, label: '筹码', emoji: '🎯', color: '#8b5cf6' },
    { key: 'fund' as const, label: '资金', emoji: '🐋', color: '#3b82f6' },
    { key: 'north' as const, label: '北向/南向', emoji: '🧭', color: '#ef4444' },
    { key: 'margin' as const, label: '融资融券', emoji: '🏦', color: '#f59e0b' },
    { key: 'longhu' as const, label: '龙虎榜', emoji: '🐲', color: '#22c55e' },
    { key: 'board' as const, label: '板块', emoji: '🔄', color: '#ec4899' },
  ];

  return (
    <div className="china-indicators" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🇨🇳 A股特色指标 ({CHINA_10.length})</span>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>数据源: 东方财富/同花顺</span>
      </div>

      {/* Category */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => {
          const cnt = cat.key === 'all' ? CHINA_10.length : CHINA_10.filter(c => c.category === cat.key).length;
          return (
            <button key={cat.key} onClick={() => { setActiveCat(cat.key); setDetail(null); }} style={{
              padding: '3px 6px', borderRadius: 10, border: 'none', fontSize: 9, cursor: 'pointer',
              background: activeCat === cat.key ? (cat.color || '#3b82f6') : '#f1f5f9',
              color: activeCat === cat.key ? 'white' : '#64748b',
            }}>
              {cat.emoji} {cat.label}({cnt})
            </button>
          );
        })}
      </div>

      {/* Indicatior Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {filtered.map(ind => {
          const isActive = detail === ind.id;
          return (
            <div key={ind.id} onClick={() => setDetail(isActive ? null : ind.id)} style={{
              padding: '8px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${isActive ? '#3b82f6' : '#e5e7eb'}`,
              background: isActive ? '#eff6ff' : 'white',
              transition: 'all 0.1s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{ind.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 11 }}>{ind.name}</span>
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>
                {ind.fullName} · {ind.unit}
              </div>

              {/* Show detail */}
              {isActive && (
                <div style={{ marginTop: 4, padding: 6, background: '#f8fafc', borderRadius: 4, fontSize: 9, lineHeight: 1.5 }}>
                  <div>{ind.description}</div>
                  <div style={{ marginTop: 4, color: '#94a3b8' }}>📡 {ind.source}</div>

                  {/* Simulated data display */}
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, textAlign: 'center', padding: 4, background: ind.category === 'chip' ? '#f0fdf4' : '#f8fafc', borderRadius: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {ind.id === 'chip_concentration' ? '65.3%' : ind.id === 'chip_profit_ratio' ? '72%' :
                          ind.id === 'main_force_flow' ? '+3.2亿' : ind.id === 'retail_flow' ? '-1.8亿' :
                            ind.id === 'north_bound' ? '+58亿' : ind.id === 'south_bound' ? '+15亿' :
                              ind.id === 'margin_balance' ? '1.52万亿' : ind.id === 'short_balance' ? '820亿' :
                                ind.id === 'longhu_bang' ? '前5席位' : '科技领涨'}
                      </div>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>实时</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', padding: 4, background: '#f8fafc', borderRadius: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 10 }}>
                        {ind.category === 'chip' ? '中高集中' : ind.category === 'fund' ? '主力流入' :
                          ind.category === 'north' ? '外资看多' : ind.category === 'margin' ? '加杠杆' :
                            ind.category === 'longhu' ? '游资活跃' : '科技轮动'}
                      </div>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>解读</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 10, padding: 6, borderRadius: 4, background: '#fefce8', fontSize: 9, color: '#92400e', textAlign: 'center' }}>
        ⚠️ A股特色指标数据来源于东方财富/同花顺/交易所公开数据，T+1日更新，仅供参考不构成投资建议
      </div>
    </div>
  );
};

export { CHINA_10 };
export default ChinaIndicatorsPanel;
