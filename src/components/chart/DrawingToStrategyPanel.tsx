import { useState, useMemo } from 'react';

// ── Drawing → Strategy UI ── ML#3 R267 (6h)
// Converts user-drawn lines into actionable trading strategies

interface DrawingLine {
  id: string;
  type: 'horiz' | 'trend' | 'channel' | 'fib' | 'rect';
  p1: number;  // price level
  p2?: number; // second price (channel)
  label: string;
  direction: 'support' | 'resistance';
}

interface StrategySuggestion {
  name: string;
  type: 'breakout' | 'bounce' | 'range' | 'trend_follow' | 'mean_revert';
  entryCondition: string;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskReward: number;
  description: string;
}

interface DrawingToStrategyPanelProps {
  lines: DrawingLine[];
  currentPrice: number;
  symbol: string;
  timeframe: string;
}

const DrawingToStrategyPanel = ({ lines, currentPrice, symbol, timeframe }: DrawingToStrategyPanelProps) => {
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [strategyMode, setStrategyMode] = useState<'auto' | 'manual'>('auto');
  const [generating, setGenerating] = useState(false);

  const nearestLines = useMemo(() => {
    return [...lines]
      .map(l => ({ ...l, distance: Math.abs(l.p1 - currentPrice), distPct: Math.abs(l.p1 - currentPrice) / currentPrice * 100 }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  }, [lines, currentPrice]);

  const suggestions = useMemo((): StrategySuggestion[] => {
    if (!selectedLine) return [];
    const line = lines.find(l => l.id === selectedLine);
    if (!line) return [];

    const suggestions: StrategySuggestion[] = [];
    const isAbove = currentPrice > line.p1;
    const distPct = Math.abs(currentPrice - line.p1) / currentPrice * 100;

    if (line.type === 'horiz' || line.direction === 'support') {
      // Support line — bounce strategy
      if (isAbove && distPct < 5) {
        suggestions.push({
          name: '支撑反弹',
          type: 'bounce',
          entryCondition: `回落至 ${line.p1.toFixed(2)} 附近止跌企稳`,
          stopLoss: line.p1 * 0.98,
          takeProfit: currentPrice * 1.05,
          confidence: 72,
          riskReward: 2.5,
          description: '在支撑位附近等待反弹信号（如下影线/放量），止损设在支撑下方2%。',
        });
      }
      // Break below support
      if (isAbove && distPct < 3) {
        suggestions.push({
          name: '跌破支撑',
          type: 'breakout',
          entryCondition: `有效跌破 ${line.p1.toFixed(2)}（收盘价确认）`,
          stopLoss: line.p1 * 1.02,
          takeProfit: line.p1 * 0.92,
          confidence: 58,
          riskReward: 1.5,
          description: '支撑跌破后追空。⚠️ 假跌破常见，等收盘确认。',
        });
      }
    }

    if (line.type === 'horiz' || line.direction === 'resistance') {
      // Resistance — breakout strategy
      if (!isAbove && distPct < 5) {
        suggestions.push({
          name: '突破阻力',
          type: 'breakout',
          entryCondition: `放量突破 ${line.p1.toFixed(2)}`,
          stopLoss: line.p1 * 0.97,
          takeProfit: line.p1 * 1.08,
          confidence: 75,
          riskReward: 2.7,
          description: '放量突破阻力位是强买入信号。配合成交量确认。',
        });
        suggestions.push({
          name: '阻力位做空',
          type: 'mean_revert',
          entryCondition: `触及 ${line.p1.toFixed(2)} 受阻回落`,
          stopLoss: line.p1 * 1.02,
          takeProfit: line.p1 * 0.95,
          confidence: 65,
          riskReward: 2.0,
          description: '在阻力位等待冲高回落信号做空。',
        });
      }
    }

    if (line.type === 'channel' && line.p2) {
      const upper = Math.max(line.p1, line.p2);
      const lower = Math.min(line.p1, line.p2);
      suggestions.push({
        name: '通道震荡',
        type: 'range',
        entryCondition: `回落至 ${lower.toFixed(2)} 买入 / 冲高至 ${upper.toFixed(2)} 卖出`,
        stopLoss: lower * 0.98,
        takeProfit: upper * 0.99,
        confidence: 80,
        riskReward: (upper - lower) / (lower * 0.02),
        description: `在${lower.toFixed(2)}-${upper.toFixed(2)}区间高抛低吸，突破通道则止损。`,
      });
    }

    if (line.type === 'trend') {
      suggestions.push({
        name: '趋势跟随',
        type: 'trend_follow',
        entryCondition: `回调至趋势线 ${line.p1.toFixed(2)} 附近买入`,
        stopLoss: line.p1 * 0.97,
        takeProfit: currentPrice * 1.1,
        confidence: 78,
        riskReward: 3.3,
        description: '沿趋势线逢低买入，趋势不破则持有。',
      });
    }

    return suggestions;
  }, [lines, selectedLine, currentPrice]);

  const generateStrategy = () => { setGenerating(true); setTimeout(() => setGenerating(false), 800); };

  return (
    <div className="drawing-to-strategy" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>✏️ 画线→策略</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setStrategyMode('auto')} style={{
            padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 10, cursor: 'pointer',
            background: strategyMode === 'auto' ? '#3b82f6' : '#f1f5f9', color: strategyMode === 'auto' ? 'white' : '#64748b',
          }}>自动</button>
          <button onClick={() => setStrategyMode('manual')} style={{
            padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 10, cursor: 'pointer',
            background: strategyMode === 'manual' ? '#3b82f6' : '#f1f5f9', color: strategyMode === 'manual' ? 'white' : '#64748b',
          }}>手动</button>
        </div>
      </div>

      {/* Nearest Lines */}
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
        {symbol} · {timeframe} · 现价 {currentPrice.toFixed(2)} · {lines.length}条画线
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {nearestLines.map(line => (
          <button
            key={line.id}
            onClick={() => { setSelectedLine(line.id); if (strategyMode === 'auto') generateStrategy(); }}
            style={{
              padding: '4px 8px', borderRadius: 6, border: `1.5px solid ${selectedLine === line.id ? '#3b82f6' : '#e5e7eb'}`,
              background: selectedLine === line.id ? '#eff6ff' : 'white', fontSize: 10, cursor: 'pointer',
            }}
          >
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: line.direction === 'support' ? '#22c55e' : '#ef4444', marginRight: 4,
            }} />
            {line.label || `${line.type} @ ${line.p1.toFixed(2)}`}
            <span style={{ color: '#94a3b8', marginLeft: 4 }}>{line.distPct.toFixed(1)}%</span>
          </button>
        ))}
      </div>

      {/* Auto Strategy Suggestions */}
      {strategyMode === 'auto' && selectedLine && (
        <div>
          {generating ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>⏳ 分析中...</div>
          ) : (
            suggestions.map((s, i) => (
              <div key={i} style={{
                padding: 10, borderRadius: 8, marginBottom: 8,
                border: `1px solid ${s.confidence > 70 ? '#bbf7d0' : '#fef9c3'}`,
                background: s.confidence > 70 ? '#f0fdf4' : '#fefce8',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                    <span style={{ color: s.confidence > 70 ? '#16a34a' : '#f59e0b' }}>置信 {s.confidence}%</span>
                    <span style={{ color: '#3b82f6' }}>R:R {s.riskReward.toFixed(1)}</span>
                  </div>
                </div>

                <div style={{ fontSize: 10, lineHeight: 1.6, color: '#64748b', marginBottom: 6 }}>
                  {s.description}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 9 }}>入场条件</div>
                    <div style={{ fontWeight: 500 }}>{s.entryCondition}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 9 }}>止损</div>
                    <div style={{ fontWeight: 600, color: '#dc2626' }}>{s.stopLoss.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: 9 }}>止盈</div>
                    <div style={{ fontWeight: 600, color: '#16a34a' }}>{s.takeProfit.toFixed(2)}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                    background: '#3b82f6', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    📋 创建策略
                  </button>
                  <button style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: 'white', fontSize: 11, cursor: 'pointer',
                  }}>
                    ⚙️ 调参
                  </button>
                  <button style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: 'white', fontSize: 11, cursor: 'pointer',
                  }}>
                    📤 回测
                  </button>
                </div>
              </div>
            ))
          )}
          {suggestions.length === 0 && !generating && (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
              选中的画线无法生成策略建议（现价离画线太远），换一条试试
            </div>
          )}
        </div>
      )}

      {/* Manual Mode */}
      {strategyMode === 'manual' && selectedLine && (
        <div style={{ padding: 10, fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>⚙️ 手动配置策略参数</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>方向:</span>
              <select style={{ fontSize: 10, padding: '0 4px' }}>
                <option>做多</option><option>做空</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>入场价:</span>
              <input type="number" defaultValue={currentPrice.toFixed(2)} style={{ width: 80, fontSize: 10 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>止损:</span>
              <input type="number" defaultValue={(currentPrice * 0.97).toFixed(2)} style={{ width: 80, fontSize: 10 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>止盈:</span>
              <input type="number" defaultValue={(currentPrice * 1.05).toFixed(2)} style={{ width: 80, fontSize: 10 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>数量:</span>
              <input type="number" defaultValue={100} style={{ width: 80, fontSize: 10 }} />
            </div>
            <button style={{
              width: '100%', padding: 8, border: 'none', borderRadius: 6,
              background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer',
            }}>
              ✅ 保存策略
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!selectedLine && (
        <div style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✏️</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>选择一条画线</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>AI将自动分析画线位置，生成对应的交易策略</div>
        </div>
      )}
    </div>
  );
};

export default DrawingToStrategyPanel;
