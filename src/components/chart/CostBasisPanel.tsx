import { useState, useMemo } from 'react';

// ── Cost Basis / Holding Days Panel ── ML#5 R266 (2h)
// Shows cost basis lines, breakeven price, and holding duration

interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  entryDate: string;
  totalCost: number;
  fees: number;
}

interface CostBasisPanelProps {
  positions: Position[];
  showAll?: boolean;
}

const CostBasisPanel = ({ positions }: CostBasisPanelProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAvgOnly, setShowAvgOnly] = useState(false);

  const enriched = useMemo(() => {
    return positions.map(p => {
      const marketValue = p.shares * p.currentPrice;
      const pnl = marketValue - p.totalCost - p.fees;
      const pnlPct = (pnl / (p.totalCost + p.fees)) * 100;
      const breakeven = (p.totalCost + p.fees) / p.shares;

      // Holding days
      const entry = new Date(p.entryDate);
      const now = new Date();
      const holdDays = Math.floor((now.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
      const holdMonths = holdDays / 30;

      // Time-based return
      const annualizedReturn = holdDays > 0
        ? (Math.pow(1 + pnlPct / 100, 365 / holdDays) - 1) * 100
        : 0;

      return {
        ...p,
        marketValue,
        pnl,
        pnlPct,
        breakeven,
        holdDays,
        holdMonths,
        annualizedReturn,
        isProfitable: pnl > 0,
        daysLabel: holdDays >= 365
          ? `${(holdDays / 365).toFixed(1)}年`
          : holdDays >= 30
            ? `${Math.floor(holdDays / 30)}月${holdDays % 30}天`
            : `${holdDays}天`,
      };
    }).sort((a, b) => b.pnlPct - a.pnlPct);
  }, [positions]);

  const overall = useMemo(() => {
    const totalCost = enriched.reduce((s, p) => s + p.totalCost + p.fees, 0);
    const totalValue = enriched.reduce((s, p) => s + p.marketValue, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const avgHoldDays = enriched.length > 0
      ? enriched.reduce((s, p) => s + p.holdDays, 0) / enriched.length
      : 0;
    return { totalCost, totalValue, totalPnl, totalPnlPct, avgHoldDays };
  }, [enriched]);

  const toggleExpand = (symbol: string) => {
    const next = new Set(expanded);
    if (next.has(symbol)) next.delete(symbol);
    else next.add(symbol);
    setExpanded(next);
  };

  if (positions.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>
        💰 暂无持仓数据，添加持仓后显示成本线和持有天数
      </div>
    );
  }

  return (
    <div className="cost-basis-panel" style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>💰 成本线·持有天数</span>
        <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAvgOnly} onChange={e => setShowAvgOnly(e.target.checked)} />
          仅均价
        </label>
      </div>

      {/* Overall Summary */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 12, padding: 10,
        background: overall.totalPnl >= 0 ? '#f0fdf4' : '#fef2f2',
        borderRadius: 8, border: `1px solid ${overall.totalPnl >= 0 ? '#bbf7d0' : '#fecaca'}`,
      }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748b' }}>总成本</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{overall.totalCost.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748b' }}>总市值</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{overall.totalValue.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748b' }}>总盈亏</div>
          <div style={{
            fontWeight: 700, fontSize: 13,
            color: overall.totalPnl >= 0 ? '#16a34a' : '#dc2626',
          }}>
            {overall.totalPnl >= 0 ? '+' : ''}{overall.totalPnl.toFixed(2)}
            <span style={{ fontSize: 10 }}> ({overall.totalPnlPct >= 0 ? '+' : ''}{overall.totalPnlPct.toFixed(2)}%)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#64748b' }}>平均持期</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{overall.avgHoldDays.toFixed(0)}天</div>
        </div>
      </div>

      {/* Per-Position */}
      {enriched.map(p => (
        <div key={p.symbol} style={{
          marginBottom: 6, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden',
        }}>
          {/* Row Header */}
          <div
            onClick={() => toggleExpand(p.symbol)}
            style={{
              display: 'flex', alignItems: 'center', padding: '6px 10px',
              background: '#fafafa', cursor: 'pointer', gap: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 12, minWidth: 60 }}>{p.symbol}</span>

            {/* Cost vs Current visual bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>成本</span>
              <div style={{
                flex: 1, height: 4, borderRadius: 2, background: '#e5e7eb', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: 0, height: 4, borderRadius: 2,
                  width: `${Math.min(100, (p.currentPrice / Math.max(p.avgCost, p.currentPrice)) * 100)}%`,
                  background: p.isProfitable ? '#16a34a' : '#dc2626',
                }} />
                {/* Cost line */}
                <div style={{
                  position: 'absolute', left: `${(p.avgCost / Math.max(p.avgCost, p.currentPrice, 1)) * 100}%`,
                  top: -3, width: 2, height: 10, background: '#ef4444', borderRadius: 1,
                }} title={`成本: ${p.avgCost.toFixed(2)}`} />
              </div>
              <span style={{ fontSize: 10, color: '#64748b' }}>现价</span>
            </div>

            {/* PnL */}
            <div style={{ textAlign: 'right', minWidth: 80 }}>
              <div style={{
                fontWeight: 700, fontSize: 12,
                color: p.isProfitable ? '#16a34a' : '#dc2626',
              }}>
                {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
              </div>
              <div style={{ fontSize: 9, color: '#64748b' }}>{p.daysLabel}</div>
            </div>

            <span style={{ fontSize: 10, color: '#64748b' }}>{expanded.has(p.symbol) ? '▾' : '▸'}</span>
          </div>

          {/* Expanded Detail */}
          {expanded.has(p.symbol) && (
            <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
              {!showAvgOnly && (
                <>
                  <div>
                    <span style={{ color: '#64748b' }}>持仓: </span>
                    <span style={{ fontWeight: 500 }}>{p.shares}股</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>市值: </span>
                    <span style={{ fontWeight: 500 }}>{p.marketValue.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div>
                <span style={{ color: '#64748b' }}>成本价: </span>
                <span style={{ fontWeight: 500 }}>{p.avgCost.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>保本价: </span>
                <span style={{ fontWeight: 500, color: '#ef4444' }}>{p.breakeven.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>建仓日: </span>
                <span>{p.entryDate}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>年化: </span>
                <span style={{ color: p.annualizedReturn >= 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                  {p.annualizedReturn >= 0 ? '+' : ''}{p.annualizedReturn.toFixed(1)}%
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>总成本: </span>
                <span>{p.totalCost.toFixed(2)}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>手续费: </span>
                <span>{p.fees.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Duration-based classifications */}
      <div style={{ marginTop: 10, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 10, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>📅 持仓分类:</div>
        {(() => {
          const short = enriched.filter(p => p.holdDays < 30);
          const mid = enriched.filter(p => p.holdDays >= 30 && p.holdDays < 180);
          const long = enriched.filter(p => p.holdDays >= 180);
          return (
            <>
              <div>🟡 短线 (&lt;30天): {short.length}只 — {short.reduce((s, p) => s + p.pnl, 0) >= 0 ? '+' : ''}{short.reduce((s, p) => s + p.pnl, 0).toFixed(2)}</div>
              <div>🟠 中线 (1-6月): {mid.length}只 — {mid.reduce((s, p) => s + p.pnl, 0) >= 0 ? '+' : ''}{mid.reduce((s, p) => s + p.pnl, 0).toFixed(2)}</div>
              <div>🟢 长线 (&gt;6月): {long.length}只 — {long.reduce((s, p) => s + p.pnl, 0) >= 0 ? '+' : ''}{long.reduce((s, p) => s + p.pnl, 0).toFixed(2)}</div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default CostBasisPanel;
