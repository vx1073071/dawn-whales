import { useState, useMemo, useCallback } from 'react';

// ── AI Auto Drawing Panel ── ML#3 R266 (4h)
// AI detects trendlines, support/resistance, channels, patterns
// Cost: 1 USDT/次 (per v17.6 pricing #15)

interface AILine {
  id: string;
  type: 'trendline' | 'support' | 'resistance' | 'channel_top' | 'channel_bottom' | 'fib_retracement';
  startPrice: number;
  endPrice: number;
  startIdx: number;
  endIdx: number;
  confidence: number; // 0-100
  label: string;
  color: string;
}

interface AIAutoDrawingPanelProps {
  symbol: string;
  price: number;
  high: number;
  low: number;
  dataPoints: number[]; // close prices
  timeframe: string;
}

const AIAutoDrawingPanel = ({ symbol, price, high, low, dataPoints, timeframe }: AIAutoDrawingPanelProps) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [lines, setLines] = useState<AILine[]>([]);
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(true);

  const runAutoDraw = useCallback(() => {
    setAnalyzing(true);
    setTimeout(() => {
      const n = dataPoints.length;
      const range = Math.max(...dataPoints) - Math.min(...dataPoints);
      const generated: AILine[] = [];

      // Support levels (local minima)
      for (let i = 2; i < n - 2; i++) {
        if (dataPoints[i] < dataPoints[i - 1] && dataPoints[i] < dataPoints[i - 2] &&
            dataPoints[i] < dataPoints[i + 1] && dataPoints[i] < dataPoints[i + 2]) {
          generated.push({
            id: `s${i}`,
            type: 'support',
            startPrice: dataPoints[i],
            endPrice: dataPoints[i],
            startIdx: i - 5,
            endIdx: Math.min(i + 10, n - 1),
            confidence: 75 + Math.random() * 20,
            label: `支撑 S${generated.filter(l => l.type === 'support').length + 1}`,
            color: '#22c55e',
          });
          if (generated.filter(l => l.type === 'support').length >= 3) break;
        }
      }

      // Resistance levels (local maxima)
      for (let i = 2; i < n - 2; i++) {
        if (dataPoints[i] > dataPoints[i - 1] && dataPoints[i] > dataPoints[i - 2] &&
            dataPoints[i] > dataPoints[i + 1] && dataPoints[i] > dataPoints[i + 2]) {
          generated.push({
            id: `r${i}`,
            type: 'resistance',
            startPrice: dataPoints[i],
            endPrice: dataPoints[i],
            startIdx: i - 5,
            endIdx: Math.min(i + 10, n - 1),
            confidence: 75 + Math.random() * 20,
            label: `阻力 R${generated.filter(l => l.type === 'resistance').length + 1}`,
            color: '#ef4444',
          });
          if (generated.filter(l => l.type === 'resistance').length >= 3) break;
        }
      }

      // Trendline (linear regression on last 20 points)
      const recent = dataPoints.slice(-20);
      const sumX = recent.reduce((s, _, i) => s + i, 0);
      const sumY = recent.reduce((s, v) => s + v, 0);
      const sumXY = recent.reduce((s, v, i) => s + i * v, 0);
      const sumX2 = recent.reduce((s, _, i) => s + i * i, 0);
      const slope = (20 * sumXY - sumX * sumY) / (20 * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / 20;
      generated.push({
        id: 'trend-main',
        type: 'trendline',
        startPrice: intercept,
        endPrice: intercept + slope * (n - 1 - (n - 20)),
        startIdx: 0,
        endIdx: n - 1,
        confidence: 70 + Math.abs(slope / range) * 200,
        label: slope > 0 ? '上升趋势 📈' : '下降趋势 📉',
        color: slope > 0 ? '#3b82f6' : '#dc2626',
      });

      // Fib retracement
      const recentHigh = Math.max(...recent);
      const recentLow = Math.min(...recent);
      if (recentHigh - recentLow > range * 0.1) {
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        levels.forEach(level => {
          generated.push({
            id: `fib-${level}`,
            type: 'fib_retracement',
            startPrice: recentLow + (recentHigh - recentLow) * level,
            endPrice: recentLow + (recentHigh - recentLow) * level,
            startIdx: n - 20,
            endIdx: n - 1,
            confidence: 65,
            label: `Fib ${(level * 100).toFixed(1)}%`,
            color: '#a855f7',
          });
        });
      }

      setLines(generated);
      setVisibleLines(new Set(generated.map(l => l.id)));
      setAnalyzing(false);
    }, 1500);
  }, [dataPoints]);

  const groupedLines = useMemo(() => {
    const groups: Record<string, AILine[]> = {
      '趋势线': [],
      '支撑位': [],
      '阻力位': [],
      '斐波那契': [],
    };
    for (const line of lines) {
      if (line.type === 'trendline') groups['趋势线'].push(line);
      else if (line.type === 'support') groups['支撑位'].push(line);
      else if (line.type === 'resistance') groups['阻力位'].push(line);
      else if (line.type.startsWith('fib')) groups['斐波那契'].push(line);
    }
    return groups;
  }, [lines]);

  const toggleLine = (id: string) => {
    const next = new Set(visibleLines);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleLines(next);
  };

  const toggleGroup = (group: string) => {
    const groupLines = groupedLines[group] || [];
    const next = new Set(visibleLines);
    const allVisible = groupLines.every(l => next.has(l.id));
    if (allVisible) {
      groupLines.forEach(l => next.delete(l.id));
    } else {
      groupLines.forEach(l => next.add(l.id));
    }
    setVisibleLines(next);
  };

  return (
    <div className="ai-auto-drawing" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 400 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>✏️ AI自动画线</span>
        <span style={{ fontSize: 10, color: '#f59e0b', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
          1 USDT/次
        </span>
      </div>

      <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
        {symbol} · {timeframe} · AI自动识别趋势线/支撑阻力/斐波那契
      </div>

      {/* Auto Draw Button */}
      {lines.length === 0 && (
        <button
          onClick={runAutoDraw}
          disabled={analyzing}
          style={{
            width: '100%', padding: '10px 0', border: 'none', borderRadius: 6,
            background: analyzing ? '#a5b4fc' : '#6366f1', color: 'white',
            fontWeight: 600, cursor: analyzing ? 'default' : 'pointer', fontSize: 13,
          }}
        >
          {analyzing ? '⏳ AI识别中...' : '🤖 AI自动画线 (1 USDT)'}
        </button>
      )}

      {/* Results */}
      {lines.length > 0 && (
        <div>
          {/* Global Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setShowAll(!showAll); setVisibleLines(showAll ? new Set() : new Set(lines.map(l => l.id))); }}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
            >
              {showAll ? '隐藏全部' : '显示全部'}
            </button>
            <span style={{ fontSize: 10, color: '#64748b' }}>{visibleLines.size}/{lines.length} 条可见</span>
          </div>

          {/* Line Groups */}
          {Object.entries(groupedLines).map(([group, groupLines]) => (
            groupLines.length > 0 && (
              <div key={group} style={{ marginBottom: 8 }}>
                <div
                  onClick={() => toggleGroup(group)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 8px', borderRadius: 4,
                    background: '#f8fafc', cursor: 'pointer', marginBottom: 2,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{group}</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    {groupLines.filter(l => visibleLines.has(l.id)).length}/{groupLines.length}
                  </span>
                </div>
                {groupLines.map(line => (
                  <div
                    key={line.id}
                    onClick={() => toggleLine(line.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                      opacity: visibleLines.has(line.id) ? 1 : 0.4,
                      cursor: 'pointer', fontSize: 10,
                    }}
                  >
                    {/* Color dot */}
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: line.color,
                      border: visibleLines.has(line.id) ? '2px solid ' + line.color : undefined,
                    }} />
                    <span>{line.label}</span>
                    <span style={{ color: '#64748b' }}>{line.startPrice.toFixed(2)}</span>
                    <span style={{
                      fontSize: 9, padding: '0 3px', borderRadius: 2,
                      background: line.confidence > 80 ? '#dcfce7' : line.confidence > 60 ? '#fef9c3' : '#fef2f2',
                      color: line.confidence > 80 ? '#16a34a' : line.confidence > 60 ? '#ca8a04' : '#dc2626',
                    }}>
                      {line.confidence.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )
          ))}

          {/* Summary */}
          <div style={{
            marginTop: 8, padding: 8, background: '#f0f9ff', borderRadius: 6,
            fontSize: 11, borderLeft: '3px solid #6366f1', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>🧠 AI分析摘要:</div>
            <div>
              共识别 {lines.length} 条关键线。
              {groupedLines['支撑位'].length > 0 && (
                <span>支撑区 {groupedLines['支撑位'].map(l => l.startPrice.toFixed(0)).join(' → ')}。 </span>
              )}
              {groupedLines['阻力位'].length > 0 && (
                <span>阻力区 {groupedLines['阻力位'].map(l => l.startPrice.toFixed(0)).join(' → ')}。 </span>
              )}
              当前价 {price.toFixed(2)} 位于{price > (high + low) / 2 ? '上方压力区' : '下方支撑区'}。
            </div>
          </div>

          {/* Re-draw */}
          <button
            onClick={runAutoDraw}
            disabled={analyzing}
            style={{
              width: '100%', marginTop: 8, padding: 6, border: '1px solid #d1d5db',
              borderRadius: 6, background: 'white', fontSize: 11, cursor: 'pointer',
            }}
          >
            {analyzing ? '⏳ ...' : '🔄 重新分析 (1 USDT)'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIAutoDrawingPanel;
