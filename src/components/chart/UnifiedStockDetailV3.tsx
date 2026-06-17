import { useState } from 'react';

// ── Unified Stock Detail Page v3 ── ML#2 R270 (4h)
// Single-page layout combining: chart, indicators, financials, community, AI, orders

type DetailTab = 'chart' | 'financials' | 'indicators' | 'community' | 'ai' | 'orders';

interface UnifiedDetailProps {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  market: string;
}

const UnifiedStockDetailV3 = ({ symbol, name, price, changePct, market }: UnifiedDetailProps) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('chart');

  const isUp = changePct >= 0;

  const tabs: { key: DetailTab; label: string; emoji: string; count?: number }[] = [
    { key: 'chart', label: '图表', emoji: '📊' },
    { key: 'indicators', label: '指标', emoji: '📐', count: 93 },
    { key: 'financials', label: '财务', emoji: '📈' },
    { key: 'ai', label: 'AI', emoji: '🧠' },
    { key: 'community', label: '社区', emoji: '👥' },
    { key: 'orders', label: '下单', emoji: '💳' },
  ];

  // Placeholder content panels
  const panels: Record<DetailTab, React.ReactNode> = {
    chart: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>📊</div>
        <div>K线 / 分时 / 画线 / 形态 / Footprint / DOM</div>
      </div>
    ),
    indicators: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>📐</div>
        <div>93个技术指标 — 6大类可切换</div>
      </div>
    ),
    financials: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>📈</div>
        <div>利润表 / 资产负债表 / 现金流 / 估值</div>
      </div>
    ),
    community: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>👥</div>
        <div>社区分享 / 策略讨论 / 信号验证</div>
      </div>
    ),
    ai: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🧠</div>
        <div>AI解读 / AI画线 / 反向观点 / 决策日志</div>
      </div>
    ),
    orders: (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>💳</div>
        <div>限价 / 市价 / 止损 / 条件单 / 一键下单</div>
      </div>
    ),
  };

  return (
    <div style={{ fontFamily: 'system-ui', fontSize: 12, maxWidth: 960, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '12px 16px', background: '#f8fafc', borderRadius: '8px 8px 0 0',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{symbol}</h2>
            <span style={{ fontSize: 13, color: '#64748b' }}>{name}</span>
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 10,
              background: '#f1f5f9', color: '#64748b',
            }}>{market}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{price.toFixed(2)}</span>
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: isUp ? '#16a34a' : '#dc2626',
            }}>
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: 16, fontSize: 10, textAlign: 'right' }}>
          <div><div style={{ color: '#94a3b8' }}>开盘</div><div style={{ fontWeight: 600 }}>{(price * 0.995).toFixed(2)}</div></div>
          <div><div style={{ color: '#94a3b8' }}>最高</div><div style={{ fontWeight: 600, color: '#16a34a' }}>{(price * 1.02).toFixed(2)}</div></div>
          <div><div style={{ color: '#94a3b8' }}>最低</div><div style={{ fontWeight: 600, color: '#dc2626' }}>{(price * 0.98).toFixed(2)}</div></div>
          <div><div style={{ color: '#94a3b8' }}>成交量</div><div style={{ fontWeight: 600 }}>12.5M</div></div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{
        display: 'flex', borderBottom: '2px solid #e5e7eb',
        background: 'white', padding: '0 16px',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.key ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: 12, cursor: 'pointer', marginBottom: -2,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
            {tab.count && (
              <span style={{
                fontSize: 9, padding: '0 4px', borderRadius: 8,
                background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
                color: activeTab === tab.key ? 'white' : '#94a3b8',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {/* Right-side quick actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: 'white', fontSize: 10, cursor: 'pointer' }}>
            ⭐ 自选
          </button>
          <button style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: 'white', fontSize: 10, cursor: 'pointer' }}>
            🔔 警报
          </button>
          <button style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #d1d5db', background: 'white', fontSize: 10, cursor: 'pointer' }}>
            📤 分享
          </button>
        </div>
      </div>

      {/* ── Content Panel ── */}
      <div style={{
        minHeight: 400, background: 'white', borderRadius: '0 0 8px 8px',
        border: '1px solid #e5e7eb', borderTop: 'none',
      }}>
        {panels[activeTab]}
      </div>

      {/* ── Bottom Bar (mobile-like quick actions) ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', marginTop: 8, borderRadius: 8,
        background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 10,
      }}>
        <span style={{ color: '#94a3b8' }}>QUANT MOO v3.1 · {symbol}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#22c55e', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>
            买入
          </button>
          <button style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#ef4444', color: 'white', fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}>
            卖出
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedStockDetailV3;
