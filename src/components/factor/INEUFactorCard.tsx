// ── R196 ML P12-02: INEUFactorCard — 🇮🇳5 + 🇪🇺4 专属因子卡片 ──────────
// India: 橙绿 theme, FII/DII/季风雨/政策/卢比/质押
// Europe: 深蓝金 theme, STOXX行业/欧元/ESG/脱欧
// Each card: bilingual name + tier + signal + IC + local insight + source

import React from 'react';
import { Tag, Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type INEUMarket = 'in' | 'eu';

interface INEUMarketFactor {
  id: string;
  name: string;
  nameLocal: string;
  market: INEUMarket;
  tier: 'basic' | 'advanced' | 'pro';
  category: string;
  description: string;
  signal?: 'green' | 'yellow' | 'red';
  ic?: number;
  price?: number;
  localInsight?: string;
  source?: string;
}

interface INEUMarketTheme {
  name: string;
  flag: string;
  accent: string;
  bg: string;
  gradient: string;
  factors: INEUMarketFactor[];
}

interface INEUFactorCardProps {
  factor: INEUMarketFactor;
  theme: INEUMarketTheme;
  onClick?: (factor: INEUMarketFactor) => void;
  selected?: boolean;
}

interface INEURegionCardProps {
  market: INEUMarket;
  onSelectFactor?: (factor: INEUMarketFactor) => void;
  selectedFactorId?: string;
}

// ── 🇮🇳 India 5 Factors ─────────────────────────────────────────────
const IN_FACTORS: INEUMarketFactor[] = [
  {
    id: 'IN_FII_DII_FLOW', name: 'FII/DII Flow Balance', nameLocal: 'FII/DII प्रवाह',
    market: 'in', tier: 'basic', category: 'Flow',
    description: 'Net FII minus DII daily flow. FIIs drive momentum, DIIs provide floor. Net FII inflow > ₹2,000cr = strong bullish. FII selling absorbed by DII = sideways.',
    signal: 'green', ic: 0.044, price: 0,
    localInsight: 'FII net buying above ₹2,000cr/day for 5 consecutive days = +3.2% Nifty in 30 days. DII SIP flows (~₹20,000cr/month) act as structural support.',
    source: 'NSE / SEBI',
  },
  {
    id: 'IN_MONSOON_EFFECT', name: 'Monsoon Effect', nameLocal: 'मानसून प्रभाव',
    market: 'in', tier: 'advanced', category: 'Seasonal',
    description: 'Indian monsoon progress impact on rural consumption stocks. Normal/excess monsoon (>96% LPA) = +5% rural index. Deficit = -8%. Key June-September driver.',
    signal: 'yellow', ic: 0.018, price: 0,
    localInsight: 'Monsoon above 100% LPA boosts tractor/fertiliser/FMCG stocks +5-8%. Below 90% triggers rural sell-off. June IMD forecast is critical market event.',
    source: 'IMD / NSE',
  },
  {
    id: 'IN_MODI_POLICY', name: 'Policy Theme Exposure', nameLocal: 'नीति विषय',
    market: 'in', tier: 'advanced', category: 'Macro',
    description: 'Stock exposure to government flagship schemes (Make in India, PLI, infra capex). High policy beta stocks outperform during budget sessions and election year.',
    signal: 'yellow', ic: 0.027, price: 0,
    localInsight: 'Budget day policy beta > 0.8 stocks: +2.5% average bounce. PLI scheme sectors (electronics/pharma/auto) see structural re-rating post allocation.',
    source: 'NSE / Government Budget',
  },
  {
    id: 'IN_RUPEE_HEDGE', name: 'Rupee Hedge Beta', nameLocal: 'रुपया हेज',
    market: 'in', tier: 'pro', category: 'FX / Macro',
    description: 'Exporters benefit from INR weakness. IT/Pharma are natural rupee hedges. INR > 83 vs USD = IT sector +4% relative. INR appreciation favours banks/importers.',
    signal: 'red', ic: 0.035, price: 1,
    localInsight: 'Every ₹1 depreciation adds ~30bps to IT company margins. INR crossing 83.5 triggers systematic IT buying by quant funds.',
    source: 'RBI / NSE',
  },
  {
    id: 'IN_PLEDGED_SHARES', name: 'Promoter Pledge Risk', nameLocal: 'प्रवर्तक गिरवी',
    market: 'in', tier: 'pro', category: 'Risk',
    description: '% of promoter shares pledged as collateral. > 50% pledged = severe distress signal. > 25% = elevated risk. Pledge increase = insider selling pressure.',
    signal: 'red', ic: -0.029, price: 1,
    localInsight: 'Promoter pledge above 50% stocks: average -15% annual underperformance. Pledge increase of >5% in a quarter = -8% next month sell signal.',
    source: 'NSE / BSE',
  },
];

// ── 🇪🇺 Europe 4 Factors ─────────────────────────────────────────────
const EU_FACTORS: INEUMarketFactor[] = [
  {
    id: 'EU_STOXX_SECTOR', name: 'STOXX Sector Rotation', nameLocal: 'STOXX Sektorrotation',
    market: 'eu', tier: 'advanced', category: 'Sector',
    description: 'STOXX 600 sector momentum rotation. Long top-3 / short bottom-3 sectors. Monthly rebalance. Banks/Energy currently leading, Real Estate lagging.',
    signal: 'yellow', ic: 0.028, price: 0,
    localInsight: 'STOXX 600 sector momentum strategy generates +3.2% annual alpha. Current leaders: Financials & Energy. EU sector dispersion at 5-year high.',
    source: 'STOXX / Deutsche Börse',
  },
  {
    id: 'EU_EUR_SENSITIVITY', name: 'EUR Sensitivity', nameLocal: 'EUR Sensitivität',
    market: 'eu', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock return sensitivity to EUR/USD. EUR strength = exporters suffer, importers benefit. DAX exporters (autos) are most EUR-sensitive. CAC luxury goods less so.',
    signal: 'yellow', ic: 0.025, price: 0,
    localInsight: 'EUR/USD above 1.10: DAX underperforms STOXX 600 by -2%. Below 1.05: German exporters gain +3%. ECB rate path is the main EUR driver.',
    source: 'ECB / STOXX',
  },
  {
    id: 'EU_ESG_PREMIUM', name: 'ESG Premium/Discount', nameLocal: 'ESG Prämie/Discount',
    market: 'eu', tier: 'pro', category: 'ESG',
    description: 'EU SFDR Article 8/9 fund flow premium. SFDR 9 (dark green) funds attract €12B/month. Article 6 (non-ESG) seeing outflows. ESG leaders command 2-3x valuation premium.',
    signal: 'red', ic: 0.032, price: 1,
    localInsight: 'EU SFDR Article 9 funds received €150B inflows in past 12 months. High ESG-rated stocks trade at 18x P/E vs 12x for low ESG in same sector. Regulatory tailwind.',
    source: 'MSCI ESG / STOXX',
  },
  {
    id: 'EU_BREXIT_SHADOW', name: 'Brexit Shadow Effect', nameLocal: 'Brexit Schatteneffekt',
    market: 'eu', tier: 'pro', category: 'Geopolitical',
    description: 'Residual Brexit impact on UK-exposed European stocks. FTSE 250 (domestic) vs FTSE 100 (global) relative performance. UK-EU regulatory divergence widens post-2025.',
    signal: 'red', ic: 0.021, price: 1,
    localInsight: 'UK domestic stocks trade at 15% discount to EU peers post-Brexit. Regulatory divergence in financial services and agriculture creates sector-specific alpha.',
    source: 'LSE / STOXX',
  },
];

// ── Market Themes ────────────────────────────────────────────────────
const INEU_THEMES: Record<INEUMarket, INEUMarketTheme> = {
  in: {
    name: 'India',
    flag: '🇮🇳',
    accent: '#FF9933', // 印度橙 (saffron)
    bg: 'rgba(255, 153, 51, 0.08)',
    gradient: 'linear-gradient(135deg, #FF9933, #138808)',
    factors: IN_FACTORS,
  },
  eu: {
    name: 'Europe',
    flag: '🇪🇺',
    accent: '#003399', // 欧洲深蓝
    bg: 'rgba(0, 51, 153, 0.08)',
    gradient: 'linear-gradient(135deg, #003399, #FFCC00)',
    factors: EU_FACTORS,
  },
};

// ── Single Factor Card ──────────────────────────────────────────────
const INEUFactorCard: React.FC<INEUFactorCardProps> = ({
  factor, theme, onClick, selected,
}) => {
  const tierConfig = {
    basic: { label: '🌱', color: '#66bd63' },
    advanced: { label: '🌶️', color: '#d4a853' },
    pro: { label: '🔴', color: '#9b59b6' },
  };
  const tc = tierConfig[factor.tier];

  return (
    <div
      style={{
        ...cs.card,
        background: selected ? theme.bg : '#0f0f1e',
        borderColor: selected ? theme.accent : '#2a2a4a',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={() => onClick?.(factor)}
    >
      <div style={cs.header}>
        <div style={cs.headerLeft}>
          <span style={cs.flag}>{theme.flag}</span>
          <div>
            <div style={cs.nameRow}>
              <span style={cs.name}>{factor.name}</span>
              <span style={cs.nameLocal}>{factor.nameLocal}</span>
            </div>
            <div style={cs.metaRow}>
              <span style={{ color: tc.color }}>{tc.label}</span>
              <span style={cs.category}>{factor.category}</span>
              {factor.signal && (
                <Tooltip title={factor.signal === 'green' ? 'Bullish' : factor.signal === 'yellow' ? 'Neutral' : 'Bearish'}>
                  <span style={cs.signal}>{factor.signal === 'green' ? '🟢' : factor.signal === 'yellow' ? '🟡' : '🔴'}</span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div style={cs.headerRight}>
          {factor.ic != null && (
            <span style={{ ...cs.ic, color: factor.ic >= 0.03 ? '#66bd63' : factor.ic >= 0 ? '#d4a853' : '#f46d43' }}>
              IC {(factor.ic * 100).toFixed(1)}%
            </span>
          )}
          {factor.price ? <Tag color="gold" style={cs.priceTag}>{factor.price}U</Tag> : <Tag color="green" style={cs.priceTag}>FREE</Tag>}
        </div>
      </div>
      <p style={cs.desc}>{factor.description}</p>
      {factor.localInsight && (
        <div style={{ ...cs.insight, background: theme.bg, borderLeft: `3px solid ${theme.accent}` }}>
          <span style={cs.insightLabel}>💡 Local Analysis</span>
          <p style={cs.insightText}>{factor.localInsight}</p>
        </div>
      )}
      {factor.source && <div style={cs.source}><span>Data: {factor.source}</span></div>}
    </div>
  );
};

// ── Region Card ──────────────────────────────────────────────────────
const INEURegionCard: React.FC<INEURegionCardProps> = ({
  market, onSelectFactor, selectedFactorId,
}) => {
  const theme = INEU_THEMES[market];
  return (
    <div style={rs.container}>
      <div style={{ ...rs.header, borderBottom: `2px solid ${theme.accent}` }}>
        <div style={rs.headerLeft}>
          <span style={rs.flag}>{theme.flag}</span>
          <div>
            <div style={rs.title}>{theme.name} Exclusive Factors</div>
            <div style={rs.subtitle}>{theme.factors.length} market-specific</div>
          </div>
        </div>
        <div style={{ ...rs.accentBar, background: theme.gradient }} />
      </div>
      <div style={rs.grid}>
        {theme.factors.map((f) => (
          <INEUFactorCard
            key={f.id}
            factor={f}
            theme={theme}
            onClick={onSelectFactor}
            selected={f.id === selectedFactorId}
          />
        ))}
      </div>
    </div>
  );
};

// ── Both Markets Combined ───────────────────────────────────────────
const INEUBothRegions: React.FC<{
  markets?: INEUMarket[];
  onSelectFactor?: (factor: INEUMarketFactor) => void;
  selectedFactorId?: string;
}> = ({ markets, onSelectFactor, selectedFactorId }) => {
  const codes = markets || (['in', 'eu'] as INEUMarket[]);
  return (
    <div style={rs.allContainer}>
      {codes.map((m) => (
        <INEURegionCard key={m} market={m} onSelectFactor={onSelectFactor} selectedFactorId={selectedFactorId} />
      ))}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const cs: Record<string, React.CSSProperties> = {
  card: { background: '#0f0f1e', borderRadius: 10, border: '1px solid #2a2a4a', padding: '12px 14px', transition: 'all 0.2s ease', fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerLeft: { display: 'flex', gap: 8, flex: 1, minWidth: 0 },
  flag: { fontSize: 18, flexShrink: 0 },
  nameRow: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 13, fontWeight: 700, color: '#e0e0e0', fontFamily: 'monospace' },
  nameLocal: { fontSize: 11, color: '#888' },
  metaRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 },
  category: { fontSize: 10, color: '#666' },
  signal: { fontSize: 12, cursor: 'help' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  ic: { fontSize: 11, fontFamily: 'monospace', fontWeight: 700 },
  priceTag: { fontSize: 10, padding: '0 6px' },
  desc: { fontSize: 11, color: '#aaa', margin: '0 0 8px', lineHeight: 1.5 },
  insight: { padding: '8px 10px', borderRadius: 6, marginBottom: 6 },
  insightLabel: { fontSize: 10, fontWeight: 600, color: '#ccc', display: 'block', marginBottom: 2 },
  insightText: { fontSize: 11, color: '#bbb', margin: 0, lineHeight: 1.5, fontStyle: 'italic' },
  source: { fontSize: 9, color: '#555' },
};

const rs: Record<string, React.CSSProperties> = {
  allContainer: { display: 'flex', flexDirection: 'column', gap: 24 },
  container: { fontFamily: "'Inter', -apple-system, sans-serif" },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 14 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  flag: { fontSize: 24 },
  title: { fontSize: 15, fontWeight: 700, color: '#e0e0e0' },
  subtitle: { fontSize: 11, color: '#888', marginTop: 1 },
  accentBar: { width: 40, height: 3, borderRadius: 2 },
  grid: { display: 'flex', flexDirection: 'column', gap: 10 },
};

export {
  INEUFactorCard, INEURegionCard, INEUBothRegions,
  IN_FACTORS, EU_FACTORS, INEU_THEMES,
};
export type { INEUMarket, INEUMarketFactor, INEUMarketTheme, INEUFactorCardProps, INEURegionCardProps };
