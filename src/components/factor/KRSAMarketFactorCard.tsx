// ── R195 ML P11-02: KRSAFactorCard — 🇰🇷6 + 🇸🇬5 + 🇦🇺5 专属因子卡片 ──────────
// Korea: 太极蓝红 theme, 财阀折扣/外资持股/三星联动/期权到期/韩元/股息
// Singapore: 鱼尾狮白 theme, REIT息差/海指/SGD/分红/ADR
// Australia: 南十字绿金 theme, 大宗商品/Franking/分红季/银行/澳元
// Each card: flag+name+local+tier+signal+IC+localInsight+source

import React from 'react';
import { Tag, Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type KRSAMarket = 'kr' | 'sg' | 'au';

interface KRSAMarketTheme {
  name: string;
  flag: string;
  accent: string;
  bg: string;
  gradient: string;
  factors: KRSAMarketFactor[];
}

// ── Unified Factor Type ─────────────────────────────────────────────
interface KRSAMarketFactor {
  id: string;
  name: string;
  nameLocal: string;
  market: KRSAMarket;
  tier: 'basic' | 'advanced' | 'pro';
  category: string;
  description: string;
  signal?: 'green' | 'yellow' | 'red';
  ic?: number;
  price?: number;
  localInsight?: string;
  source?: string;
}

interface KRSAMarketRegionCardProps {
  market: KRSAMarket;
  onSelectFactor?: (factor: KRSAMarketFactor) => void;
  selectedFactorId?: string;
}

// ── 🇰🇷 Korea 6 Factors ─────────────────────────────────────────────
const KR_FACTORS: KRSAMarketFactor[] = [
  {
    id: 'KR_CHAEBOL_DISCOUNT', name: 'Chaebol Discount', nameLocal: '재벌 할인',
    market: 'kr', tier: 'advanced', category: 'Governance',
    description: 'Discount applied to conglomerates due to governance concerns. Narrowing discount = reform progress. Average 20-30% discount to sum-of-parts.',
    signal: 'yellow', ic: 0.034, price: 0, localInsight: '재벌 그룹의 순환출자 해소 발표 후 평균 +12% 상승. 지배구조 개선이 핵심 촉매.',
    source: 'KRX / FSS',
  },
  {
    id: 'KR_FOREIGN_OWNERSHIP', name: 'Foreign Ownership', nameLocal: '외국인 지분율',
    market: 'kr', tier: 'basic', category: 'Flow',
    description: '% shares held by foreign investors. Foreign ownership > 40% = quality signal. Trend increase = institutional conviction.',
    signal: 'green', ic: 0.043, price: 0, localInsight: '외국인 지분율 40% 이상 종목은 KOSPI 대비 연간 +3.5% 초과수익. 외국인 순매수 지속 종목 선별 필수.',
    source: 'KRX',
  },
  {
    id: 'KR_SAMSUNG_LINKAGE', name: 'Samsung Linkage', nameLocal: '삼성전자 연동',
    market: 'kr', tier: 'advanced', category: 'Correlation',
    description: 'Stock beta to Samsung Electronics (005930). Samsung is ~20% of KOSPI. High linkage = semiconductor supply chain exposure.',
    signal: 'yellow', ic: 0.025, price: 0, localInsight: '삼성전자 시총 비중 20%. 연동계수 0.8 이상 종목은 삼성전자 주가에 동조. 반도체 사이클이 핵심 변수.',
    source: 'KRX',
  },
  {
    id: 'KR_OPTION_EXPIRY', name: 'Option Expiry Effect', nameLocal: '옵션 만기 효과',
    market: 'kr', tier: 'pro', category: 'Derivatives',
    description: 'KOSPI 200 option expiry day effect (2nd Thursday). Quadruple witching amplifies volatility. Gamma pinning around key strikes.',
    signal: 'red', ic: 0.031, price: 1, localInsight: '동시만기일(매월 두번째 목요일) 당일 KOSPI200 변동성 +40%. 옵션 만기주 수요일~금요일 단기 전략 유효.',
    source: 'KRX Derivatives',
  },
  {
    id: 'KR_KRW_SENSITIVITY', name: 'KRW Sensitivity', nameLocal: '원화 민감도',
    market: 'kr', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock return sensitivity to KRW/USD. KRW appreciation = foreign inflow = tech rally. KRW > 1300 = exporter benefit.',
    signal: 'yellow', ic: 0.027, price: 0, localInsight: '원/달러 1300원 돌파 시 수출주(반도체/자동차) 실적 개선. 1200원 하회 시 외국인 매수세 유입.',
    source: 'BOK / KRX',
  },
  {
    id: 'KR_DIVIDEND_YIELD', name: 'Korean Dividend Yield', nameLocal: '배당수익률',
    market: 'kr', tier: 'basic', category: 'Income',
    description: 'Korean dividend yield factor. Korean companies historically pay low dividends (~1.5%) but trend is improving with Value-Up program.',
    signal: 'green', ic: 0.021, price: 0, localInsight: '기업 밸류업 프로그램으로 배당성향 30% 이상 기업 급증. 배당수익률 3%+ 종목이 새로운 가치 팩터.',
    source: 'KRX / FSS',
  },
];

// ── 🇸🇬 Singapore 5 Factors ────────────────────────────────────────
const SG_FACTORS: KRSAMarketFactor[] = [
  {
    id: 'SG_REIT_SPREAD', name: 'S-REIT Yield Spread', nameLocal: 'S-REIT Yield Spread',
    market: 'sg', tier: 'basic', category: 'Income',
    description: 'S-REIT distribution yield minus 10Y government bond. Spread > 3% = attractive entry. SG has 40+ REITs, one of largest REIT markets globally.',
    signal: 'green', ic: 0.047, price: 0, localInsight: 'S-REIT yield spread above 3% historically signals +8-12% total return over 12 months. Interest rate sensitive.',
    source: 'SGX / MAS',
  },
  {
    id: 'SG_STI_WEIGHT', name: 'STI Weight Momentum', nameLocal: 'STI Weight Momentum',
    market: 'sg', tier: 'advanced', category: 'Index',
    description: 'STI component weight change momentum. Weight increase = passive fund inflow. STI has only 30 stocks, weight changes are significant.',
    signal: 'yellow', ic: 0.029, price: 0, localInsight: 'STI 30 components only. Weight increase of 1% translates to ~S$50M passive inflow per stock.',
    source: 'SGX',
  },
  {
    id: 'SG_SGD_LINKAGE', name: 'SGD NEER Sensitivity', nameLocal: 'SGD NEER Sensitivity',
    market: 'sg', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock sensitivity to SGD Nominal Effective Exchange Rate. MAS uses FX as primary monetary policy tool. SGD strength = low beta stocks benefit.',
    signal: 'yellow', ic: 0.026, price: 0, localInsight: 'MAS maintains SGD NEER band. SGD appreciation phase favors banks and property stocks over exporters.',
    source: 'MAS / SGX',
  },
  {
    id: 'SG_DIVIDEND_CULTURE', name: 'SG Dividend Culture', nameLocal: 'SG Dividend Culture',
    market: 'sg', tier: 'advanced', category: 'Income',
    description: 'Singapore\'s unique dividend culture. Average payout ratio ~50%. Banks and REITs distribute quarterly. Tax-free dividends for individuals.',
    signal: 'green', ic: 0.022, price: 0, localInsight: 'Singapore dividends are tax-free. Companies with 20+ year consecutive dividend growth command 15-20% valuation premium.',
    source: 'SGX',
  },
  {
    id: 'SG_US_LISTED', name: 'Cross-Listed ADR', nameLocal: 'Cross-Listed ADR Arbitrage',
    market: 'sg', tier: 'pro', category: 'Arbitrage',
    description: 'SG-listed vs US-ADR price spread arbitrage. Companies like Sea Ltd dual-listed. Spread > 2% = arb opportunity after costs.',
    signal: 'red', ic: 0.038, price: 1, localInsight: 'Dual-listed SG/US stocks show mean-reverting spreads. Monitor ADR premium/discount for tactical trades.',
    source: 'SGX / NYSE / NASDAQ',
  },
];

// ── 🇦🇺 Australia 5 Factors ───────────────────────────────────────
const AU_FACTORS: KRSAMarketFactor[] = [
  {
    id: 'AU_COMMODITY_LINK', name: 'Commodity Beta', nameLocal: 'Commodity Beta',
    market: 'au', tier: 'advanced', category: 'Macro',
    description: 'ASX stock sensitivity to iron ore/coal/LNG prices. Resources = 20% of ASX200. Iron ore correlation is key for miners (BHP, RIO, FMG).',
    signal: 'yellow', ic: 0.039, price: 0, localInsight: 'Iron ore price explains ~40% of ASX materials sector returns. BHP/RIO/FMG dominate with 15% combined market cap.',
    source: 'ASX / SGX Iron Ore Futures',
  },
  {
    id: 'AU_FRANKING_CREDIT', name: 'Franking Credit', nameLocal: 'Franking Credit Yield',
    market: 'au', tier: 'basic', category: 'Income',
    description: 'Imputation credit boost to effective dividend yield. Fully franked dividends = ~43% gross-up for top tax bracket. Unique Australian advantage.',
    signal: 'green', ic: 0.036, price: 0, localInsight: 'Fully franked dividends grossed-up yield can be 5%→7.2%. Franking balance analysis predicts dividend sustainability.',
    source: 'ASX / ATO',
  },
  {
    id: 'AU_DIVIDEND_SEASON', name: 'Dividend Season', nameLocal: 'Dividend Season Effect',
    market: 'au', tier: 'advanced', category: 'Seasonal',
    description: 'February/August ex-dividend peak. ASX200 dividend futures pricing gives forward visibility. Run-up starts 3 weeks before ex-date.',
    signal: 'green', ic: 0.018, price: 0, localInsight: 'Feb and Aug are Australia\'s peak dividend months. Pre ex-date run-up averages +1.8% in the 3 weeks prior.',
    source: 'ASX',
  },
  {
    id: 'AU_BANK_DIVIDEND', name: 'Bank Dividend Yield', nameLocal: 'Bank Dividend Yield',
    market: 'au', tier: 'basic', category: 'Income',
    description: 'Australian Big 4 banks dividend yield. Banks = 25% of ASX200. High payout ratio (~70-80%) makes dividends the primary return driver.',
    signal: 'green', ic: 0.024, price: 0, localInsight: 'Big 4 banks (CBA/WBC/NAB/ANZ) yield 4-5%. Dividend cuts are rare and signal severe stress. Franking adds 1.5-2%.',
    source: 'ASX',
  },
  {
    id: 'AU_AUD_SENSITIVITY', name: 'AUD Sensitivity', nameLocal: 'AUD Sensitivity Beta',
    market: 'au', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock return sensitivity to AUD/USD. AUD = commodity currency. AUD down = miners benefit (USD revenue). AUD up = importers benefit.',
    signal: 'yellow', ic: 0.028, price: 0, localInsight: 'AUD below 0.65 favours iron ore exporters. AUD above 0.75 favours retailers and domestic industrials.',
    source: 'RBA / ASX',
  },
];

// ── Market Themes ────────────────────────────────────────────────────
const KRSA_THEMES: Record<KRSAMarket, KRSAMarketTheme> = {
  kr: {
    name: 'South Korea',
    flag: '🇰🇷',
    accent: '#CD2E3A', // 太极红
    bg: 'rgba(205, 46, 58, 0.08)',
    gradient: 'linear-gradient(135deg, #CD2E3A, #004EA2)',
    factors: KR_FACTORS,
  },
  sg: {
    name: 'Singapore',
    flag: '🇸🇬',
    accent: '#ED2939', // 鱼尾狮红
    bg: 'rgba(237, 41, 57, 0.08)',
    gradient: 'linear-gradient(135deg, #ED2939, #FFFFFF)',
    factors: SG_FACTORS,
  },
  au: {
    name: 'Australia',
    flag: '🇦🇺',
    accent: '#00843D', // 绿金
    bg: 'rgba(0, 132, 61, 0.08)',
    gradient: 'linear-gradient(135deg, #00843D, #FFB81C)',
    factors: AU_FACTORS,
  },
};

// ── Single Factor Card ──────────────────────────────────────────────
const KRSAMarketFactorCard: React.FC<{
  factor: KRSAMarketFactor;
  theme: KRSAMarketTheme;
  onClick?: (factor: KRSAMarketFactor) => void;
  selected?: boolean;
}> = ({ factor, theme, onClick, selected }) => {
  const tierConfig = {
    basic: { label: '🌱', color: '#66bd63' },
    advanced: { label: '🌶️', color: '#d4a853' },
    pro: { label: '🔴', color: '#9b59b6' },
  };
  const tc = tierConfig[factor.tier];

  return (
    <div
      style={{
        ...cardStyles.card,
        background: selected ? theme.bg : '#0f0f1e',
        borderColor: selected ? theme.accent : '#2a2a4a',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={() => onClick?.(factor)}
    >
      <div style={cardStyles.header}>
        <div style={cardStyles.headerLeft}>
          <span style={cardStyles.flag}>{theme.flag}</span>
          <div>
            <div style={cardStyles.nameRow}>
              <span style={cardStyles.name}>{factor.name}</span>
              <span style={cardStyles.nameLocal}>{factor.nameLocal}</span>
            </div>
            <div style={cardStyles.metaRow}>
              <span style={{ color: tc.color }}>{tc.label}</span>
              <span style={cardStyles.category}>{factor.category}</span>
              {factor.signal && (
                <Tooltip title={factor.signal === 'green' ? 'Bullish' : factor.signal === 'yellow' ? 'Neutral' : 'Bearish'}>
                  <span style={cardStyles.signal}>
                    {factor.signal === 'green' ? '🟢' : factor.signal === 'yellow' ? '🟡' : '🔴'}
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div style={cardStyles.headerRight}>
          {factor.ic != null && (
            <span style={{
              ...cardStyles.ic,
              color: factor.ic >= 0.03 ? '#66bd63' : factor.ic >= 0 ? '#d4a853' : '#f46d43',
            }}>
              IC {(factor.ic * 100).toFixed(1)}%
            </span>
          )}
          {factor.price ? (
            <Tag color="gold" style={cardStyles.priceTag}>{factor.price}U</Tag>
          ) : (
            <Tag color="green" style={cardStyles.priceTag}>FREE</Tag>
          )}
        </div>
      </div>
      <p style={cardStyles.desc}>{factor.description}</p>
      {factor.localInsight && (
        <div style={{ ...cardStyles.insight, background: theme.bg, borderLeft: `3px solid ${theme.accent}` }}>
          <span style={cardStyles.insightLabel}>💡 Local Analysis</span>
          <p style={cardStyles.insightText}>{factor.localInsight}</p>
        </div>
      )}
      {factor.source && (
        <div style={cardStyles.source}>
          <span>Data: {factor.source}</span>
        </div>
      )}
    </div>
  );
};

// ── Region Card (one market block) ───────────────────────────────────
const KRSAMarketRegionCard: React.FC<KRSAMarketRegionCardProps> = ({
  market,
  onSelectFactor,
  selectedFactorId,
}) => {
  const theme = KRSA_THEMES[market];

  return (
    <div style={regionStyles.container}>
      <div style={{ ...regionStyles.header, borderBottom: `2px solid ${theme.accent}` }}>
        <div style={regionStyles.headerLeft}>
          <span style={regionStyles.flag}>{theme.flag}</span>
          <div>
            <div style={regionStyles.title}>{theme.name} Exclusive Factors</div>
            <div style={regionStyles.subtitle}>{theme.factors.length} market-specific factors</div>
          </div>
        </div>
        <div style={{
          ...regionStyles.accentBar,
          background: theme.gradient,
        }} />
      </div>
      <div style={regionStyles.grid}>
        {theme.factors.map((f) => (
          <KRSAMarketFactorCard
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

// ── All 3 Markets List ──────────────────────────────────────────────
const KRSAMarketAllRegions: React.FC<{
  markets?: KRSAMarket[];
  onSelectFactor?: (factor: KRSAMarketFactor) => void;
  selectedFactorId?: string;
}> = ({ markets, onSelectFactor, selectedFactorId }) => {
  const codes = markets || (['kr', 'sg', 'au'] as KRSAMarket[]);

  return (
    <div style={regionStyles.allContainer}>
      {codes.map((m) => (
        <KRSAMarketRegionCard
          key={m}
          market={m}
          onSelectFactor={onSelectFactor}
          selectedFactorId={selectedFactorId}
        />
      ))}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0f0f1e',
    borderRadius: 10,
    border: '1px solid #2a2a4a',
    padding: '12px 14px',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    display: 'flex',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
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

const regionStyles: Record<string, React.CSSProperties> = {
  allContainer: { display: 'flex', flexDirection: 'column', gap: 24 },
  container: { fontFamily: "'Inter', -apple-system, sans-serif" },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  flag: { fontSize: 24 },
  title: { fontSize: 15, fontWeight: 700, color: '#e0e0e0' },
  subtitle: { fontSize: 11, color: '#888', marginTop: 1 },
  accentBar: { width: 40, height: 3, borderRadius: 2 },
  grid: { display: 'flex', flexDirection: 'column', gap: 10 },
};

export {
  KRSAMarketFactorCard,
  KRSAMarketRegionCard,
  KRSAMarketAllRegions,
  KR_FACTORS,
  SG_FACTORS,
  AU_FACTORS,
  KRSA_THEMES,
};
export type { KRSAMarket, KRSAMarketFactor, KRSAMarketTheme, KRSAMarketRegionCardProps };
