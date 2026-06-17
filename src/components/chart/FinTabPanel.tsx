import { useState } from 'react';

// ── Financial Tab Enhanced UI ── ML#2 R267 (4h)
// Enhanced financial data tab: income statement, balance sheet, cash flow

interface FinStatement {
  period: string;
  revenue: number;
  netIncome: number;
  grossMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  debtRatio: number;
  currentRatio: number;
  fcf: number;           // free cash flow
  eps: number;
  bvps: number;          // book value per share
  dividend: number;      // dividend per share
  revGrowthYoY: number;
  niGrowthYoY: number;
}

interface FinTabPanelProps {
  symbol: string;
  name: string;
  statements: FinStatement[];
  price: number;
  marketCap: number;
}

const FinTabPanel = ({ symbol, name, statements, price, marketCap }: FinTabPanelProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'balance' | 'cashflow'>('overview');

  const latest = statements[0];
  const prev = statements[1];

  const formatLarge = (v: number): string => {
    if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(2) + '万';
    return v.toFixed(2);
  };

  const formatPct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  const gaugeColor = (v: number, thresholds: [number, number]) => {
    if (v >= thresholds[0]) return '#16a34a';
    if (v >= thresholds[1]) return '#f59e0b';
    return '#dc2626';
  };

  if (statements.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>📊 暂无财务数据</div>;
  }

  return (
    <div className="fin-tab-panel" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{symbol}</span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{name}</span>
        </div>
        <div style={{ fontSize: 11, textAlign: 'right' }}>
          <div style={{ color: '#64748b' }}>市值: {formatLarge(marketCap)}</div>
          <div style={{ fontWeight: 600 }}>股价: {price.toFixed(2)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 10, borderBottom: '2px solid #e5e7eb' }}>
        {[
          { key: 'overview' as const, label: '📊 概览' },
          { key: 'income' as const, label: '📈 利润表' },
          { key: 'balance' as const, label: '⚖️ 资产负债表' },
          { key: 'cashflow' as const, label: '💵 现金流' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '6px 12px', border: 'none', background: 'transparent',
            borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: -2, color: activeTab === tab.key ? '#3b82f6' : '#64748b',
            fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 12, cursor: 'pointer',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* === Overview Tab === */}
      {activeTab === 'overview' && latest && (
        <div>
          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: '营收', value: formatLarge(latest.revenue), sub: `YoY ${formatPct(latest.revGrowthYoY)}` },
              { label: '净利润', value: formatLarge(latest.netIncome), sub: `YoY ${formatPct(latest.niGrowthYoY)}` },
              { label: 'EPS', value: latest.eps.toFixed(2), sub: `PE ${(price / latest.eps).toFixed(1)}` },
              { label: 'ROE', value: `${latest.roe.toFixed(1)}%`, sub: latest.roe > 15 ? '优秀 >15%' : '一般' },
              { label: '毛利率', value: `${latest.grossMargin.toFixed(1)}%`, sub: latest.grossMargin > 40 ? '高利润' : '' },
              { label: '净利率', value: `${latest.netMargin.toFixed(1)}%`, sub: latest.netMargin > 20 ? '竞争力强' : '' },
              { label: '经营现金流', value: formatLarge(latest.fcf), sub: latest.fcf > 0 ? '健康' : '⚠️' },
              { label: '每股净资产', value: latest.bvps.toFixed(2), sub: `PB ${(price / latest.bvps).toFixed(1)}` },
              { label: '股息', value: latest.dividend.toFixed(2), sub: `收益率 ${((latest.dividend / price) * 100).toFixed(1)}%` },
            ].map((m, i) => (
              <div key={i} style={{ padding: 8, borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{m.value}</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Quality Score */}
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>🔍 财务健康速评:</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10 }}>
              <span style={{ color: gaugeColor(latest.roe, [15, 10]) }}>{latest.roe > 15 ? '✅' : latest.roe > 10 ? '⚠️' : '❌'} ROE {latest.roe.toFixed(1)}%</span>
              <span style={{ color: gaugeColor(latest.debtRatio, [50, 70]) }}>{latest.debtRatio < 50 ? '✅' : latest.debtRatio < 70 ? '⚠️' : '❌'} 负债率 {latest.debtRatio.toFixed(1)}%</span>
              <span style={{ color: gaugeColor(latest.currentRatio, [1.5, 1]) }}>{latest.currentRatio > 1.5 ? '✅' : latest.currentRatio > 1 ? '⚠️' : '❌'} 流动比 {latest.currentRatio.toFixed(1)}</span>
              <span style={{ color: latest.fcf > 0 ? '#16a34a' : '#dc2626' }}>{latest.fcf > 0 ? '✅' : '❌'} FCF {latest.fcf > 0 ? '+' : ''}{formatLarge(latest.fcf)}</span>
              <span style={{ color: latest.revGrowthYoY > 10 ? '#16a34a' : latest.revGrowthYoY > 0 ? '#f59e0b' : '#dc2626' }}>
                {latest.revGrowthYoY >= 0 ? '📈' : '📉'} 增长 {formatPct(latest.revGrowthYoY)}
              </span>
            </div>
          </div>

          {/* Period Comparison */}
          {prev && (
            <div style={{ marginTop: 10, fontSize: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>📅 环比变化 ({latest.period} vs {prev.period}):</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span>营收: {formatPct(latest.revGrowthYoY)}</span>
                <span>利润: {formatPct(latest.niGrowthYoY)}</span>
                <span>EPS: {formatPct(((latest.eps - prev.eps) / Math.abs(prev.eps || 1)) * 100)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Income Statement === */}
      {activeTab === 'income' && (
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>单位: 亿元（除每股数据）</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#64748b' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>项目</th>
                {statements.slice(0, 4).map(s => (
                  <th key={s.period} style={{ textAlign: 'right', padding: 4 }}>{s.period}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: '营业收入', key: 'revenue' as const, fmt: (v: number) => (v / 1e8).toFixed(2) },
                { label: '营收增长', key: 'revGrowthYoY' as const, fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
                { label: '净利润', key: 'netIncome' as const, fmt: (v: number) => (v / 1e8).toFixed(2) },
                { label: '利润增长', key: 'niGrowthYoY' as const, fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
                { label: '毛利率', key: 'grossMargin' as const, fmt: (v: number) => `${v.toFixed(1)}%` },
                { label: '净利率', key: 'netMargin' as const, fmt: (v: number) => `${v.toFixed(1)}%` },
                { label: 'EPS', key: 'eps' as const, fmt: (v: number) => v.toFixed(2) },
                { label: '每股净资产', key: 'bvps' as const, fmt: (v: number) => v.toFixed(2) },
                { label: 'ROE', key: 'roe' as const, fmt: (v: number) => `${v.toFixed(1)}%` },
                { label: 'ROA', key: 'roa' as const, fmt: (v: number) => `${v.toFixed(1)}%` },
              ].map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 3, fontWeight: ri < 4 ? 500 : 400 }}>{row.label}</td>
                  {statements.slice(0, 4).map(s => (
                    <td key={s.period} style={{ textAlign: 'right', padding: 3, fontFamily: 'monospace' }}>
                      {row.fmt(s[row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* === Balance Sheet === */}
      {activeTab === 'balance' && (
        <div style={{ padding: 10 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>关键比率</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
            {latest && (
              <>
                <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>资产负债率</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: gaugeColor(latest.debtRatio, [50, 70]) }}>
                    {latest.debtRatio.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    {latest.debtRatio < 30 ? '低杠杆' : latest.debtRatio < 60 ? '适中' : '高杠杆'}
                  </div>
                </div>
                <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>流动比率</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: gaugeColor(latest.currentRatio, [1.5, 1]) }}>
                    {latest.currentRatio.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>
                    {latest.currentRatio > 2 ? '流动性充裕' : latest.currentRatio > 1 ? '正常' : '⚠️ 偿债压力'}
                  </div>
                </div>
                <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>每股净资产</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{latest.bvps.toFixed(2)}</div>
                </div>
                <div style={{ padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>市净率 PB</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{(price / latest.bvps).toFixed(1)}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* === Cash Flow === */}
      {activeTab === 'cashflow' && (
        <div style={{ padding: 10 }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>现金流分析</div>
          {latest && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: 10, borderRadius: 8, background: latest.fcf > 0 ? '#f0fdf4' : '#fef2f2', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>自由现金流</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: latest.fcf > 0 ? '#16a34a' : '#dc2626' }}>
                  {latest.fcf > 0 ? '+' : ''}{formatLarge(latest.fcf)}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>
                  {latest.fcf > 0 ? '✅ 造血能力强' : '⚠️ 注意现金流'}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>FCF收益率</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {((latest.fcf / marketCap) * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>FCF/市值</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>股息</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{latest.dividend.toFixed(2)}</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>收益率 {((latest.dividend / price) * 100).toFixed(1)}%</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#94a3b8' }}>FCF/净利润</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {latest.netIncome > 0 ? ((latest.fcf / latest.netIncome) * 100).toFixed(0) : '—'}%
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>
                  {(latest.fcf / Math.max(latest.netIncome, 1)) > 0.8 ? '利润含金量高' : '关注应收账款'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinTabPanel;
