import { useState, useMemo } from 'react';

// ── Capital Flow / Main Force Money UI ── ML#1 R267 (4h)
// Shows institutional money flow: main force, retail, north/south-bound

interface FlowData {
  date: string;
  mainForce: number;      // 主力净流入 (亿元)
  retail: number;          // 散户净流入
  institution: number;     // 机构
  northBound?: number;     // 北向资金 (沪深港通)
  southBound?: number;     // 南向资金
  totalVolume: number;     // 成交额
}

interface CapitalFlowPanelProps {
  symbol: string;
  flows: FlowData[];
  market: 'A' | 'HK' | 'US';
}

const CapitalFlowPanel = ({ flows }: CapitalFlowPanelProps) => {
  const [period, setPeriod] = useState<'1D' | '5D' | '20D' | '60D'>('5D');
  const [showDetail, setShowDetail] = useState(false);

  const periodData = useMemo(() => {
    const days = { '1D': 1, '5D': 5, '20D': 20, '60D': 60 }[period];
    return flows.slice(-days);
  }, [flows, period]);

  const summary = useMemo(() => {
    const mf = periodData.reduce((s, f) => s + f.mainForce, 0);
    const rt = periodData.reduce((s, f) => s + f.retail, 0);
    const inst = periodData.reduce((s, f) => s + f.institution, 0);
    const vol = periodData.reduce((s, f) => s + f.totalVolume, 0);
    const nb = periodData.reduce((s, f) => s + (f.northBound || 0), 0);
    const sb = periodData.reduce((s, f) => s + (f.southBound || 0), 0);

    // Flow intensity: mainForce as % of total vol
    const intensity = vol > 0 ? Math.abs(mf) / vol * 100 : 0;

    // Consecutive days direction
    let consecutiveIn = 0, consecutiveOut = 0;
    for (let i = periodData.length - 1; i >= 0; i--) {
      if (periodData[i].mainForce > 0) { consecutiveIn++; consecutiveOut = 0; }
      else if (periodData[i].mainForce < 0) { consecutiveOut++; consecutiveIn = 0; }
      else break;
    }

    return {
      mainForce: mf, retail: rt, institution: inst, totalVolume: vol,
      northBound: nb, southBound: sb, intensity,
      consecutiveIn, consecutiveOut,
      direction: mf > 1 ? '流入' : mf < -1 ? '流出' : '平衡',
      signalColor: mf > 1 ? '#16a34a' : mf < -1 ? '#dc2626' : '#f59e0b',
    };
  }, [periodData]);

  const chartW = 440, chartH = 180;

  const flowBars = useMemo(() => {
    if (periodData.length === 0) return [];
    const maxAbs = Math.max(...periodData.map(f => Math.max(Math.abs(f.mainForce), Math.abs(f.retail), 1)));
    return periodData.map((f, i) => {
      const x = 50 + (i / (periodData.length - 1 || 1)) * (chartW - 60);
      const mfH = (Math.abs(f.mainForce) / maxAbs) * (chartH / 2 - 20);
      const rtH = (Math.abs(f.retail) / maxAbs) * (chartH / 2 - 20);
      return { ...f, x, mfH, rtH, idx: i };
    });
  }, [periodData]);

  return (
    <div className="capital-flow-panel" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>💰 主力资金流向</span>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: summary.signalColor + '15', color: summary.signalColor, fontWeight: 600 }}>
          {summary.direction}
        </span>
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {(['1D', '5D', '20D', '60D'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding: '2px 10px', borderRadius: 12, border: 'none', fontSize: 10, cursor: 'pointer',
            background: period === p ? '#3b82f6' : '#f1f5f9',
            color: period === p ? 'white' : '#64748b', fontWeight: period === p ? 600 : 400,
          }}>{p}</button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>主力资金</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: summary.mainForce >= 0 ? '#16a34a' : '#dc2626' }}>
            {summary.mainForce >= 0 ? '+' : ''}{summary.mainForce.toFixed(1)}亿
          </div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>散户资金</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: summary.retail >= 0 ? '#16a34a' : '#dc2626' }}>
            {summary.retail >= 0 ? '+' : ''}{summary.retail.toFixed(1)}亿
          </div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>成交额</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{summary.totalVolume.toFixed(0)}亿</div>
        </div>
      </div>

      {/* Intensity Indicators */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 10, color: '#64748b' }}>
        <span>强度: {(summary.intensity * 100).toFixed(1)}%</span>
        {summary.consecutiveIn >= 3 && <span style={{ color: '#16a34a' }}>🔥 连续{summary.consecutiveIn}日流入</span>}
        {summary.consecutiveOut >= 3 && <span style={{ color: '#dc2626' }}>❄️ 连续{summary.consecutiveOut}日流出</span>}
      </div>

      {/* North/South Bound */}
      {summary.northBound !== 0 && (
        <div style={{ padding: 6, borderRadius: 4, background: '#eff6ff', marginBottom: 8, fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>北向资金: <b style={{ color: summary.northBound >= 0 ? '#16a34a' : '#dc2626' }}>{summary.northBound >= 0 ? '+' : ''}{summary.northBound.toFixed(1)}亿</b></span>
          <span>南向资金: <b style={{ color: summary.southBound >= 0 ? '#16a34a' : '#dc2626' }}>{summary.southBound >= 0 ? '+' : ''}{summary.southBound.toFixed(1)}亿</b></span>
        </div>
      )}

      {/* Flow Chart */}
      {flowBars.length > 0 && (
        <div style={{ position: 'relative', width: chartW + 10, height: chartH + 30 }}>
          <svg width={chartW + 10} height={chartH + 30}>
            {/* Zero Line */}
            <line x1={40} y1={chartH / 2 + 5} x2={chartW - 10} y2={chartH / 2 + 5} stroke="#e5e7eb" strokeWidth={1} />

            {/* Bars */}
            {flowBars.map(f => (
              <g key={f.idx}>
                {/* Main Force (blue if in, red if out) */}
                <rect
                  x={f.x - 3} width={6}
                  y={f.mainForce >= 0 ? chartH / 2 + 5 - f.mfH : chartH / 2 + 5}
                  height={f.mfH}
                  fill={f.mainForce >= 0 ? '#3b82f6' : '#ef4444'}
                  opacity={0.8} rx={1}
                />

                {/* Retail */}
                <rect
                  x={f.x + 4} width={4}
                  y={f.retail >= 0 ? chartH / 2 + 5 - f.rtH : chartH / 2 + 5}
                  height={f.rtH}
                  fill={f.retail >= 0 ? '#93c5fd' : '#fca5a5'}
                  opacity={0.5} rx={1}
                />

                {/* Date label every 5 */}
                {f.idx % Math.max(1, Math.floor(flowBars.length / 6)) === 0 && (
                  <text x={f.x} y={chartH + 20} textAnchor="middle" fontSize={8} fill="#94a3b8">
                    {f.date.slice(5)}
                  </text>
                )}
              </g>
            ))}

            {/* Legend */}
            <rect x={chartW - 100} y={0} width={8} height={8} fill="#3b82f6" opacity={0.8} rx={1} />
            <text x={chartW - 88} y={8} fontSize={8} fill="#64748b">主力</text>
            <rect x={chartW - 50} y={0} width={8} height={8} fill="#93c5fd" opacity={0.5} rx={1} />
            <text x={chartW - 38} y={8} fontSize={8} fill="#64748b">散户</text>
          </svg>
        </div>
      )}

      {/* Detail Table Toggle */}
      <button onClick={() => setShowDetail(!showDetail)} style={{
        width: '100%', marginTop: 8, padding: 4, border: 'none', background: 'transparent',
        fontSize: 10, color: '#3b82f6', cursor: 'pointer',
      }}>
        {showDetail ? '▲ 收起' : '▼ 查看每日明细'}
      </button>

      {showDetail && (
        <div style={{ marginTop: 4, fontSize: 10, maxHeight: 200, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#94a3b8' }}>
                <th style={{ textAlign: 'left', padding: 2 }}>日期</th>
                <th style={{ textAlign: 'right', padding: 2 }}>主力</th>
                <th style={{ textAlign: 'right', padding: 2 }}>散户</th>
                <th style={{ textAlign: 'right', padding: 2 }}>成交额</th>
                <th style={{ textAlign: 'right', padding: 2 }}>北向</th>
              </tr>
            </thead>
            <tbody>
              {periodData.slice().reverse().map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: 2 }}>{f.date}</td>
                  <td style={{ textAlign: 'right', padding: 2, color: f.mainForce >= 0 ? '#16a34a' : '#dc2626' }}>
                    {f.mainForce >= 0 ? '+' : ''}{f.mainForce.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: 2 }}>{f.retail >= 0 ? '+' : ''}{f.retail.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', padding: 2 }}>{f.totalVolume.toFixed(0)}</td>
                  <td style={{ textAlign: 'right', padding: 2, color: (f.northBound || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                    {f.northBound ? `${f.northBound >= 0 ? '+' : ''}${f.northBound.toFixed(1)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tip */}
      <div style={{ marginTop: 6, fontSize: 9, color: '#94a3b8', lineHeight: 1.4 }}>
        💡 主力资金=超大单+大单净流入。连续3日流入→主力建仓信号；连续流出→警惕出货。
      </div>
    </div>
  );
};

export default CapitalFlowPanel;
