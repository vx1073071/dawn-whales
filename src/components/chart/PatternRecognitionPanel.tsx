import { useState, useMemo } from 'react';

// ── Pattern Recognition UI ── ML#4 R267 (4h)
// Detects and visualizes classic chart patterns

interface CandlePattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'reversal_bull' | 'reversal_bear' | 'continuation';
  confidence: number;
  startIdx: number;
  endIdx: number;
  description: string;
  reliability: string; // e.g. "7/10"
  target?: number;
  stop?: number;
}

interface PatternRecognitionPanelProps {
  symbol: string;
  patterns: CandlePattern[];
  currentPrice: number;
  timeframe: string;
}

const PATTERN_EMOJI: Record<string, string> = {
  bullish: '🟢', bearish: '🔴', neutral: '⚪',
  reversal_bull: '🌅', reversal_bear: '🌇', continuation: '➡️',
};

const PatternRecognitionPanel = ({ symbol, patterns }: PatternRecognitionPanelProps) => {
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish' | 'reversal'>('all');
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [showLearning, setShowLearning] = useState(false);

  const filtered = useMemo(() => {
    if (filter === 'all') return patterns;
    if (filter === 'bullish') return patterns.filter(p => p.type === 'bullish' || p.type === 'reversal_bull');
    if (filter === 'bearish') return patterns.filter(p => p.type === 'bearish' || p.type === 'reversal_bear');
    if (filter === 'reversal') return patterns.filter(p => p.type.startsWith('reversal'));
    return patterns;
  }, [patterns, filter]);

  const summary = useMemo(() => ({
    bullish: patterns.filter(p => p.type === 'bullish' || p.type === 'reversal_bull').length,
    bearish: patterns.filter(p => p.type === 'bearish' || p.type === 'reversal_bear').length,
    neutral: patterns.filter(p => p.type === 'neutral' || p.type === 'continuation').length,
    highConf: patterns.filter(p => p.confidence > 75).length,
  }), [patterns]);

  // Pattern learning cards
  const learningCards = [
    {
      name: '头肩顶', type: 'reversal_bear' as const,
      description: '左肩→头部→右肩，颈线跌破确认。是最可靠的顶部反转形态之一。',
      reliability: '8/10',
      visualDesc: '三个峰：中峰最高，两侧较低，跌破颈线=卖出信号',
    },
    {
      name: '双底 (W底)', type: 'reversal_bull' as const,
      description: '两次探底不破前低，放量突破颈线确认反转。底部成交量放大是关键。',
      reliability: '7/10',
      visualDesc: '两次低点接近，中间反弹形成W形，突破颈线进场',
    },
    {
      name: '上升三角形', type: 'continuation' as const,
      description: '水平上轨+逐步抬高的下轨。价格在三角形内收敛，大概率向上突破。',
      reliability: '7/10',
      visualDesc: '上方水平阻力线+下方逐步抬高的低点连线',
    },
    {
      name: '旗帜形态', type: 'continuation' as const,
      description: '快速拉升后的短暂盘整，形成倾斜的矩形。突破后延续原趋势。升幅≈旗杆高度。',
      reliability: '6/10',
      visualDesc: '旗杆（快速涨跌）+ 旗面（窄幅盘整）+ 突破方向=原来方向',
    },
    {
      name: '早晨之星', type: 'reversal_bull' as const,
      description: '三根K线：大阴线→小十字星（跳空低开）→大阳线（跳空高开）。底部反转信号。',
      reliability: '6/10',
      visualDesc: '阴→星（跳空）→阳（跳空），第三根阳线回补第二个缺口',
    },
    {
      name: '黄昏之星', type: 'reversal_bear' as const,
      description: '大阳线→小十字星（跳空高开）→大阴线（跳空低开）。顶部反转信号。',
      reliability: '6/10',
      visualDesc: '阳→星（跳空）→阴（跳空），第三根阴线跌回第一根实体内',
    },
  ];

  return (
    <div className="pattern-recognition" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🔍 形态识别</span>
        <button onClick={() => setShowLearning(!showLearning)} style={{
          padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 10, cursor: 'pointer',
          background: showLearning ? '#8b5cf6' : '#f1f5f9', color: showLearning ? 'white' : '#64748b',
        }}>
          {showLearning ? '返回检测' : '📚 学习'}
        </button>
      </div>

      {!showLearning ? (
        <>
          {/* Summary Bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 10, color: '#64748b' }}>
            <span>🟢 多 {summary.bullish}</span>
            <span>🔴 空 {summary.bearish}</span>
            <span>⚪ 中 {summary.neutral}</span>
            <span>⭐ 高置信 {summary.highConf}</span>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'bullish' as const, label: '看涨' },
              { key: 'bearish' as const, label: '看跌' },
              { key: 'reversal' as const, label: '反转' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 10, cursor: 'pointer',
                background: filter === f.key ? '#3b82f6' : '#f1f5f9',
                color: filter === f.key ? 'white' : '#64748b',
              }}>{f.label}</button>
            ))}
          </div>

          {/* Pattern List */}
          {filtered.length > 0 ? (
            filtered.map((p, i) => (
              <div key={i} style={{
                padding: 8, borderRadius: 6, marginBottom: 4, cursor: 'pointer',
                border: `1px solid ${selectedPattern === p.name ? '#3b82f6' : '#e5e7eb'}`,
                background: selectedPattern === p.name ? '#eff6ff' : 'white',
              }} onClick={() => setSelectedPattern(selectedPattern === p.name ? null : p.name)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{PATTERN_EMOJI[p.type] || '🔹'}</span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                    <span style={{ color: p.confidence > 75 ? '#16a34a' : p.confidence > 50 ? '#f59e0b' : '#dc2626' }}>
                      置信 {p.confidence}%
                    </span>
                    <span style={{ color: '#94a3b8' }}>可靠性 {p.reliability}</span>
                  </div>
                </div>

                {/* Expanded */}
                {selectedPattern === p.name && (
                  <div style={{ marginTop: 6, padding: 8, background: '#f8fafc', borderRadius: 4, fontSize: 10 }}>
                    <div style={{ lineHeight: 1.6, marginBottom: 6 }}>{p.description}</div>
                    {p.target && p.stop && (
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span>🎯 目标: <b>{p.target.toFixed(2)}</b></span>
                        <span>🛑 止损: <b style={{ color: '#dc2626' }}>{p.stop.toFixed(2)}</b></span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button style={{
                        padding: '3px 10px', borderRadius: 4, border: 'none',
                        background: '#3b82f6', color: 'white', fontSize: 10, cursor: 'pointer',
                      }}>📋 设为警报</button>
                      <button style={{
                        padding: '3px 10px', borderRadius: 4, border: '1px solid #d1d5db',
                        background: 'white', fontSize: 10, cursor: 'pointer',
                      }}>📖 了解更多</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
              📭 该筛选条件下无检测到的形态
            </div>
          )}

          {/* Summary */}
          <div style={{ marginTop: 8, padding: 8, background: '#f0f9ff', borderRadius: 6, fontSize: 10, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📊 {symbol} 形态总结:</div>
            {summary.bullish > summary.bearish ? (
              <span>多头形态占优（{summary.bullish}:{summary.bearish}），整体看涨倾向。</span>
            ) : summary.bearish > summary.bullish ? (
              <span>空头形态占优（{summary.bearish}:{summary.bullish}），谨慎追高。</span>
            ) : (
              <span>多空形态均衡，趋势不明朗。</span>
            )}
          </div>
        </>
      ) : (
        /* Learning Mode */
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
            📚 K线形态学习卡 — 了解经典形态的特征和含义
          </div>
          {learningCards.map((card, i) => (
            <div key={i} style={{
              padding: 10, borderRadius: 8, marginBottom: 6,
              border: '1px solid #e5e7eb', background: 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{PATTERN_EMOJI[card.type]} {card.name}</span>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>可靠性 {card.reliability}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>{card.description}</div>
              <div style={{ marginTop: 4, padding: 4, background: '#f8fafc', borderRadius: 4, fontSize: 9, color: '#94a3b8' }}>
                👁 {card.visualDesc}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatternRecognitionPanel;
