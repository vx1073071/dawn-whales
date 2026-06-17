import { useState, useMemo } from 'react';

// ── Indicator Value Readout Panel ── ML#6 R266 (2h)
// Dense dashboard showing current values for all indicators at a glance

interface IndicatorSnapshot {
  name: string;
  fullName: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral' | 'overbought' | 'oversold';
  percentile?: number; // 0-100 where value falls in historical range
  description: string;
  category: 'trend' | 'momentum' | 'volatility' | 'volume';
}

interface IndicatorReadoutPanelProps {
  indicators: IndicatorSnapshot[];
  compact?: boolean;
}

const IndicatorReadoutPanel = ({ indicators, compact = false }: IndicatorReadoutPanelProps) => {
  const [filter, setFilter] = useState<'all' | 'trend' | 'momentum' | 'volatility' | 'volume'>('all');
  const [showPercentile, setShowPercentile] = useState(true);

  const filtered = useMemo(() => {
    return filter === 'all' ? indicators : indicators.filter(i => i.category === filter);
  }, [indicators, filter]);

  const signalSummary = useMemo(() => {
    const bullish = filtered.filter(i => i.signal === 'bullish' || i.signal === 'oversold');
    const bearish = filtered.filter(i => i.signal === 'bearish' || i.signal === 'overbought');
    const neutral = filtered.filter(i => i.signal === 'neutral');
    return { bullish: bullish.length, bearish: bearish.length, neutral: neutral.length };
  }, [filtered]);

  const categories: Array<{ key: typeof filter; label: string; emoji: string }> = [
    { key: 'all', label: '全部', emoji: '📊' },
    { key: 'trend', label: '趋势', emoji: '📈' },
    { key: 'momentum', label: '动量', emoji: '⚡' },
    { key: 'volatility', label: '波动', emoji: '🌊' },
    { key: 'volume', label: '成交量', emoji: '📦' },
  ];

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'bullish': return '#16a34a';
      case 'bearish': return '#dc2626';
      case 'overbought': return '#f59e0b';
      case 'oversold': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const getSignalEmoji = (signal: string) => {
    switch (signal) {
      case 'bullish': return '🟢';
      case 'bearish': return '🔴';
      case 'overbought': return '🟠';
      case 'oversold': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="indicator-readout" style={{ padding: compact ? 8 : 12, fontFamily: 'monospace', fontSize: 11 }}>
      {/* Header */}
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📐 指标读数面板</span>
          <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPercentile} onChange={e => setShowPercentile(e.target.checked)} />
            百分位
          </label>
        </div>
      )}

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {categories.map(cat => {
          const count = cat.key === 'all' ? indicators.length : indicators.filter(i => i.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              style={{
                padding: '3px 8px', borderRadius: 12, border: 'none',
                background: filter === cat.key ? '#3b82f6' : '#f1f5f9',
                color: filter === cat.key ? 'white' : '#64748b',
                fontWeight: filter === cat.key ? 600 : 400, fontSize: 10, cursor: 'pointer',
              }}
            >
              {cat.emoji} {cat.label} <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Signal Summary Bar */}
      <div style={{
        display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8,
        background: '#e5e7eb',
      }}>
        {signalSummary.bullish > 0 && (
          <div style={{
            width: `${(signalSummary.bullish / filtered.length) * 100}%`,
            background: '#16a34a',
          }} />
        )}
        {signalSummary.neutral > 0 && (
          <div style={{
            width: `${(signalSummary.neutral / filtered.length) * 100}%`,
            background: '#94a3b8',
          }} />
        )}
        {signalSummary.bearish > 0 && (
          <div style={{
            width: `${(signalSummary.bearish / filtered.length) * 100}%`,
            background: '#dc2626',
          }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#64748b', marginBottom: 8 }}>
        <span>🟢 多 {signalSummary.bullish}</span>
        <span>⚪ 中 {signalSummary.neutral}</span>
        <span>🔴 空 {signalSummary.bearish}</span>
      </div>

      {/* Indicator Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
        {filtered.map(ind => (
          <div key={ind.name} style={{
            padding: '6px 8px', borderRadius: 6, border: `1px solid ${getSignalColor(ind.signal)}20`,
            background: `${getSignalColor(ind.signal)}08`, display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {/* Name + Signal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: compact ? 10 : 11 }}>
                {ind.name}
                {!compact && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4, fontSize: 9 }}>{ind.fullName}</span>}
              </span>
              <span style={{ fontSize: 9 }}>{getSignalEmoji(ind.signal)}</span>
            </div>

            {/* Value + Percentile */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: compact ? 18 : 22, fontWeight: 700,
                color: getSignalColor(ind.signal),
              }}>
                {ind.value.toFixed(ind.value < 1 ? 4 : 2)}
              </span>
              {showPercentile && ind.percentile != null && (
                <span style={{ fontSize: 9, color: '#94a3b8' }}>
                  P{ind.percentile.toFixed(0)}
                </span>
              )}
            </div>

            {/* Percentile Bar */}
            {showPercentile && ind.percentile != null && (
              <div style={{
                height: 3, borderRadius: 1.5, background: '#e5e7eb',
                marginTop: 2,
              }}>
                <div style={{
                  height: 3, borderRadius: 1.5,
                  width: `${ind.percentile}%`,
                  background: ind.percentile > 80 ? '#dc2626' : ind.percentile < 20 ? '#16a34a' : '#f59e0b',
                }} />
              </div>
            )}

            {/* Description */}
            {!compact && (
              <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.4, marginTop: 2 }}>
                {ind.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: '#999', fontSize: 12 }}>
          📐 无指标数据，请先添加指标到图表
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 9, color: '#94a3b8' }}>
          <span>🟢 看涨/超卖</span>
          <span>🔴 看跌/超买</span>
          <span>🟠 超买区</span>
          <span>🔵 超卖区</span>
          <span>P = 历史百分位（越低越偏多）</span>
        </div>
      )}
    </div>
  );
};

export default IndicatorReadoutPanel;
