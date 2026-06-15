// ── R198 ML P14-03: CommodityFactorCard — 大宗商品因子卡片 ──────────
// Shows: signal light + plain-language name + mini inventory chart + key numbers
// Plain language: Roll Yield="换月成本", Basis="现货贵还是期货贵", COT="大佬底牌"
// Color-coded by commodity category: 🥇Gold / 🛢️Orange / 🔩Silver / 🌾Green
// Inventory mini bar: actual vs expected vs 5yr avg

import React from 'react';
import { Tag } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type CommodityType = 'gold' | 'energy' | 'metal' | 'agri';

interface CommodityFactorCardData {
  id: string;
  name: string;
  plainName: string; // 人话翻译
  commodity: string;
  commodityEmoji: string;
  type: CommodityType;
  signal: 'green' | 'yellow' | 'red';
  currentValue: string;
  previousValue: string;
  // Optional inventory chart data
  inventory?: {
    actual: number;
    expected: number;
    fiveYearAvg: number;
    unit: string;
  };
  insight: string;
  source: string;
  price?: number;
}

interface CommodityFactorCardProps {
  data: CommodityFactorCardData;
  onClick?: (data: CommodityFactorCardData) => void;
  compact?: boolean;
}

// ── Category Themes ──────────────────────────────────────────────────
const TYPE_THEMES: Record<CommodityType, { accent: string; bg: string; gradient: string }> = {
  gold: { accent: '#FFD700', bg: 'rgba(255,215,0,0.08)', gradient: 'linear-gradient(135deg, #FFD700, #B8860B)' },
  energy: { accent: '#FF8C00', bg: 'rgba(255,140,0,0.08)', gradient: 'linear-gradient(135deg, #FF8C00, #FF4500)' },
  metal: { accent: '#B87333', bg: 'rgba(184,115,51,0.08)', gradient: 'linear-gradient(135deg, #B87333, #8B6914)' },
  agri: { accent: '#228B22', bg: 'rgba(34,139,34,0.08)', gradient: 'linear-gradient(135deg, #228B22, #006400)' },
};

// ── Demo Data ────────────────────────────────────────────────────────
const DEMO_COMMODITY_CARDS: CommodityFactorCardData[] = [
  {
    id: 'CMD_ROLL_YIELD', name: 'Roll Yield', plainName: '换月成本',
    commodity: 'Crude Oil', commodityEmoji: '🛢️', type: 'energy',
    signal: 'green', currentValue: '+3.2%', previousValue: '+2.8%',
    inventory: { actual: 435, expected: 450, fiveYearAvg: 460, unit: 'M bbl' },
    insight: '近月贴水→做多原油不仅赚涨跌,还能额外赚3.2%年化展期收益。这是做多CL的"免费午餐"。',
    source: 'CME / EIA',
  },
  {
    id: 'CMD_EIA_CRUDE', name: 'EIA Crude Inventory', plainName: '美国原油库存变了多少',
    commodity: 'Crude Oil', commodityEmoji: '🛢️', type: 'energy',
    signal: 'green', currentValue: '-4.35M', previousValue: '+1.2M',
    inventory: { actual: 435, expected: 450, fiveYearAvg: 460, unit: 'M bbl' },
    insight: '上周库存降435万桶(预期降150万)→实际降幅远超预期→需求强劲→短期看多。',
    source: 'EIA Weekly Report',
  },
  {
    id: 'CMD_GOLD_ETF', name: 'Gold ETF Holdings', plainName: '机构大佬买金了吗',
    commodity: 'Gold', commodityEmoji: '🥇', type: 'gold',
    signal: 'green', currentValue: '3,252 tons', previousValue: '3,218 tons',
    insight: '全球黄金ETF连续5周净流入→央行+机构持续增持→金价支撑强。ETF持仓是黄金的"聪明钱"。',
    source: 'World Gold Council / Bloomberg',
  },
  {
    id: 'CMD_LME_INVENTORY', name: 'LME Inventory', plainName: '伦敦仓库铜多不多',
    commodity: 'Copper', commodityEmoji: '🔩', type: 'metal',
    signal: 'yellow', currentValue: '185,000 tons', previousValue: '192,000 tons',
    inventory: { actual: 185000, expected: 195000, fiveYearAvg: 210000, unit: 'tons' },
    insight: '注销仓单占比38%→即将大量出库→但绝对库存仍够→供需紧平衡。密切关注注销仓单趋势。',
    source: 'LME Warehouse Report',
  },
  {
    id: 'CMD_MOMENTUM_12M', name: '12M Momentum', plainName: '过去一年谁涨最多',
    commodity: 'Copper', commodityEmoji: '🔩', type: 'metal',
    signal: 'green', currentValue: '+18.5%', previousValue: '+15.2%',
    insight: '铜12月动量强势→全球基建+新能源需求驱动→趋势可能延续。但注意:铜已连涨14个月,需警惕回撤。',
    source: 'CME',
  },
  {
    id: 'CMD_SEASONALITY', name: 'Seasonality', plainName: '这个月种还是收',
    commodity: 'Soybeans', commodityEmoji: '🫘', type: 'agri',
    signal: 'red', currentValue: '-2.0% avg', previousValue: '+0.2% avg',
    insight: '9月大豆收成季→历史10年9次下跌→平均跌-2.0%→现在做多就是在对抗收成洪峰。',
    source: 'USDA / CME',
  },
  {
    id: 'CMD_BASIS', name: 'Basis (Spot-Future)', plainName: '现货贵还是期货贵',
    commodity: 'Natural Gas', commodityEmoji: '🔥', type: 'energy',
    signal: 'yellow', currentValue: '-$0.12', previousValue: '-$0.08',
    insight: '期货略贵于现货→Contango结构→暗示近期供应不紧张。但价差不大,等待进一步信号。',
    source: 'CME / ICE',
  },
  {
    id: 'CMD_GOLD_SUMMER', name: 'Gold Summer Effect', plainName: '夏天黄金涨不涨',
    commodity: 'Gold', commodityEmoji: '🥇', type: 'gold',
    signal: 'green', currentValue: '+1.8% (Jun)', previousValue: '+1.2% (May)',
    insight: '6-8月黄金历史表现+3.2%→央行夏季购金+印度婚礼季→做多黄金胜率高。8月是传统最强月。',
    source: 'World Gold Council',
  },
];

// ── Component ────────────────────────────────────────────────────────
const CommodityFactorCard: React.FC<CommodityFactorCardProps> = ({ data, onClick, compact = false }) => {
  const theme = TYPE_THEMES[data.type];
  const signalConfig = {
    green: { dot: '🟢', label: '看多', color: '#66bd63' },
    yellow: { dot: '🟡', label: '观望', color: '#d4a853' },
    red: { dot: '🔴', label: '看空', color: '#f46d43' },
  };
  const sc = signalConfig[data.signal];

  if (compact) {
    return (
      <div style={{ ...cs.compact, borderLeft: `3px solid ${theme.accent}`, cursor: onClick ? 'pointer' : 'default' }}
        onClick={() => onClick?.(data)}>
        <div style={cs.compactRow}>
          <span style={cs.compactEmoji}>{data.commodityEmoji}</span>
          <div style={cs.compactInfo}>
            <div style={cs.compactName}>{data.plainName}</div>
            <div style={cs.compactSrc}>{data.commodity}</div>
          </div>
          <span style={{ fontSize: 18 }}>{sc.dot}</span>
          <span style={{ ...cs.compactVal, color: sc.color }}>{data.currentValue}</span>
        </div>
        <p style={cs.compactInsight}>💡 {data.insight.substring(0, 80)}...</p>
      </div>
    );
  }

  return (
    <div style={{ ...cs.card, borderColor: theme.accent, background: theme.bg, cursor: onClick ? 'pointer' : 'default' }}
      onClick={() => onClick?.(data)}>
      {/* Header */}
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <span style={cs.emoji}>{data.commodityEmoji}</span>
          <div>
            <div style={cs.nameRow}>
              <Tag color={sc.color.replace('#', '')} style={cs.signalTag}>{sc.dot} {sc.label}</Tag>
              <span style={cs.name}>{data.plainName}</span>
            </div>
            <div style={cs.subRow}>
              <span style={cs.enName}>{data.name}</span>
              <span style={cs.commodityName}>· {data.commodity}</span>
            </div>
          </div>
        </div>
        <div style={cs.headerRight}>
          <div style={cs.valueLabel}>Now</div>
          <div style={{ ...cs.value, color: sc.color }}>{data.currentValue}</div>
          <div style={cs.prevValue}>Prev: {data.previousValue}</div>
        </div>
      </div>

      {/* Inventory Mini Chart (if available) */}
      {data.inventory && (
        <div style={cs.inventorySection}>
          <div style={cs.invLabel}>📊 Inventory ({data.inventory.unit})</div>
          <div style={cs.invBars}>
            <div style={cs.invBarGroup}>
              <div style={cs.invBarLabel}>Actual</div>
              <div style={cs.invBarTrack}>
                <div style={{ ...cs.invBarFill, width: `${(data.inventory.actual / data.inventory.fiveYearAvg) * 100}%`, background: data.inventory.actual < data.inventory.expected ? '#66bd63' : '#f46d43' }} />
              </div>
              <span style={cs.invBarNum}>{data.inventory.actual.toLocaleString()}</span>
            </div>
            <div style={cs.invBarGroup}>
              <div style={cs.invBarLabel}>Expected</div>
              <div style={cs.invBarTrack}>
                <div style={{ ...cs.invBarFill, width: `${(data.inventory.expected / data.inventory.fiveYearAvg) * 100}%`, background: '#888' }} />
              </div>
              <span style={cs.invBarNum}>{data.inventory.expected.toLocaleString()}</span>
            </div>
            <div style={cs.invBarGroup}>
              <div style={cs.invBarLabel}>5yr Avg</div>
              <div style={cs.invBarTrack}>
                <div style={{ ...cs.invBarFill, width: '100%', background: '#3a3a5a' }} />
              </div>
              <span style={cs.invBarNum}>{data.inventory.fiveYearAvg.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plain-Language Insight */}
      <div style={cs.insightBox}>
        <span style={cs.insightEmoji}>💡</span>
        <span style={cs.insightText}>{data.insight}</span>
      </div>

      {/* Footer */}
      <div style={cs.footer}>
        <span style={cs.source}>📡 {data.source}</span>
        {data.price ? (
          <Tag color="gold" style={cs.priceTag}>{data.price}U</Tag>
        ) : (
          <Tag color="green" style={cs.priceTag}>FREE</Tag>
        )}
      </div>
    </div>
  );
};

// ── Grid Wrapper ─────────────────────────────────────────────────────
const CommodityFactorGrid: React.FC<{
  cards?: CommodityFactorCardData[];
  onSelectCard?: (data: CommodityFactorCardData) => void;
  compact?: boolean;
}> = ({ cards = DEMO_COMMODITY_CARDS, onSelectCard, compact = false }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {cards.map((c) => (
        <CommodityFactorCard key={c.id} data={c} onClick={onSelectCard} compact={compact} />
      ))}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const cs: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: 10,
    border: '1px solid',
    padding: '14px 16px',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerLeft: { display: 'flex', gap: 10, flex: 1, minWidth: 0 },
  emoji: { fontSize: 24, flexShrink: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  signalTag: { fontSize: 11, fontWeight: 700, padding: '1px 8px' },
  name: { fontSize: 14, fontWeight: 700, color: '#e0e0e0' },
  subRow: { display: 'flex', alignItems: 'center', gap: 4 },
  enName: { fontSize: 10, color: '#888', fontFamily: 'monospace' },
  commodityName: { fontSize: 10, color: '#666' },
  headerRight: { textAlign: 'right', flexShrink: 0, marginLeft: 12 },
  valueLabel: { fontSize: 9, color: '#888', textTransform: 'uppercase' },
  value: { fontSize: 20, fontWeight: 800, fontFamily: 'monospace' },
  prevValue: { fontSize: 9, color: '#666', marginTop: 1 },
  // Inventory
  inventorySection: { marginBottom: 10, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 },
  invLabel: { fontSize: 10, color: '#aaa', marginBottom: 8 },
  invBars: { display: 'flex', flexDirection: 'column', gap: 6 },
  invBarGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  invBarLabel: { fontSize: 10, color: '#888', minWidth: 52 },
  invBarTrack: { flex: 1, height: 8, background: '#2a2a4a', borderRadius: 4, overflow: 'hidden' },
  invBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease', minWidth: 4 },
  invBarNum: { fontSize: 10, fontFamily: 'monospace', color: '#ccc', minWidth: 50, textAlign: 'right' },
  // Insight
  insightBox: { display: 'flex', gap: 8, marginBottom: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, lineHeight: 1.5 },
  insightEmoji: { flexShrink: 0, fontSize: 14 },
  insightText: { fontSize: 11, color: '#bbb' },
  // Footer
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  source: { fontSize: 9, color: '#555' },
  priceTag: { fontSize: 9, padding: '0 5px' },
  // Compact
  compact: { padding: '10px 12px', background: '#0f0f1e', borderRadius: 8, border: '1px solid #2a2a4a' },
  compactRow: { display: 'flex', alignItems: 'center', gap: 8 },
  compactEmoji: { fontSize: 20 },
  compactInfo: { flex: 1 },
  compactName: { fontSize: 12, fontWeight: 600, color: '#e0e0e0' },
  compactSrc: { fontSize: 9, color: '#666' },
  compactVal: { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },
  compactInsight: { fontSize: 10, color: '#888', margin: '4px 0 0', lineHeight: 1.4 },
};

export { CommodityFactorCard, CommodityFactorGrid, DEMO_COMMODITY_CARDS };
export type { CommodityFactorCardProps, CommodityFactorCardData, CommodityType };
