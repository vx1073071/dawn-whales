// ── R194 ML P10-03: JPTWFactorCard — JP/TW专属因子卡片 ──────────────
// Japan: 和风红白配色, 日银ETF/交叉持股/JPX400/外国人买卖/套息
// Taiwan: 清新蓝绿配色, 融资余额/融券/外资/台积电联动/除权息
// Factor card with flag + market-specific metadata
// Localized signal interpretation (JP = BOJ impact, TW = margin data)
// 🔴 premium, 🟡 advanced, 🟢 basic tier badges

import React from 'react';
import { Tag, Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type JPTWMarket = 'jp' | 'tw';

interface JPTWFactorMeta {
  id: string;
  name: string;
  nameLocal: string; // 日本語 / 繁體中文
  market: JPTWMarket;
  tier: 'basic' | 'advanced' | 'pro';
  category: string;
  description: string;
  signal?: 'green' | 'yellow' | 'red';
  ic?: number;
  price?: number;
  localInsight?: string; // native language insight
  source?: string; // JPX/TSE/TWSE/data provider
}

interface JPTWFactorCardProps {
  factor: JPTWFactorMeta;
  onClick?: (factor: JPTWFactorMeta) => void;
  selected?: boolean;
}

// ── Japan 12 Factors ────────────────────────────────────────────────
const JP_FACTORS: JPTWFactorMeta[] = [
  {
    id: 'JP_BOJ_ETF', name: 'BOJ ETF Purchases', nameLocal: '日銀ETF購入',
    market: 'jp', tier: 'advanced', category: 'Central Bank',
    description: 'Tracks BOJ ETF buying activity. BOJ purchases support TOPIX and suppress volatility. Signal turns bullish when daily purchase exceeds ¥70B.',
    signal: 'yellow', ic: 0.038, price: 0, localInsight: '日銀が1日700億円以上のETFを購入した日は、翌日のTOPIXが平均+0.3%上昇。',
    source: 'JPX / BOJ',
  },
  {
    id: 'JP_CROSS_HOLDING', name: 'Cross-Holding Ratio', nameLocal: '株式持ち合い比率',
    market: 'jp', tier: 'pro', category: 'Governance',
    description: 'Measures cross-shareholding intensity among keiretsu groups. High cross-holding reduces float and inflates valuations. Declining trend = governance improvement.',
    signal: 'green', ic: 0.042, price: 1, localInsight: '持ち合い解消が進む企業は、ROEが平均+2.5%改善。東証の改革要請が追い風。',
    source: 'Nikkei NEEDS / TSE',
  },
  {
    id: 'JP_MARCH_EFFECT', name: 'March Fiscal Year End', nameLocal: '3月期末効果',
    market: 'jp', tier: 'basic', category: 'Seasonal',
    description: 'Fiscal year-end window dressing and dividend capture effect. Japanese institutions rebalance portfolios in March. Historically +1.2% excess return in March.',
    signal: 'green', ic: 0.019, price: 0, localInsight: '3月は機関投資家のリバランス需要で、例年TOPIXが上昇しやすい「期末効果」が見られる。',
    source: 'JPX / TSE',
  },
  {
    id: 'JPY_CARRY_TRADE', name: 'JPY Carry Trade Proxy', nameLocal: '円キャリートレード指標',
    market: 'jp', tier: 'pro', category: 'FX / Macro',
    description: 'Net short JPY positions as proxy for carry trade activity. JPY weakness → boost exporters. JPY strength spike → risk-off signal.',
    signal: 'yellow', ic: 0.051, price: 1, localInsight: '円キャリーの巻き戻しは株価の急落を伴う。CFTC投機筋の円ショートが過去1年の90%ileを超えたら警戒。',
    source: 'CFTC / Tokyo Financial Exchange',
  },
  {
    id: 'JPX_400_SELECTION', name: 'JPX400 Index Inclusion', nameLocal: 'JPX日経400選定',
    market: 'jp', tier: 'advanced', category: 'Index',
    description: 'Stocks selected for JPX-Nikkei 400 index based on ROE and governance. Inclusion = passive inflow ~¥20B per stock. Exclusion = outflow.',
    signal: 'green', ic: 0.033, price: 0, localInsight: 'JPX400に採用された銘柄は、発表後3ヶ月で平均+5%の超過リターン。',
    source: 'JPX',
  },
  {
    id: 'JP_TOPIX_SECTOR', name: 'TOPIX Sector Rotation', nameLocal: 'TOPIX業種別回転',
    market: 'jp', tier: 'advanced', category: 'Sector',
    description: 'Measures TOPIX 33-sector rotation momentum. Long top-5 sectors / short bottom-5. Useful for sector-neutral L/S strategies.',
    signal: 'yellow', ic: 0.025, price: 0, localInsight: '業種別モメンタムは四半期リバランスで効果が最大化。銀行・商社セクターが現在上位。',
    source: 'JPX / TSE',
  },
  {
    id: 'JP_FOREIGN_FLOW', name: 'Foreign Net Buying', nameLocal: '外国人売買動向',
    market: 'jp', tier: 'basic', category: 'Flow',
    description: 'Weekly net foreign buying on TSE 1st section. Foreigners account for ~60% of TSE volume. Sustained buying = bullish signal.',
    signal: 'green', ic: 0.046, price: 0, localInsight: '3週連続で外国人が買い越した場合、翌月のTOPIX上昇確率は72%。',
    source: 'TSE / JPX',
  },
  {
    id: 'JP_DIVIDEND_SEASON', name: 'Dividend Season Effect', nameLocal: '配当シーズン効果',
    market: 'jp', tier: 'basic', category: 'Seasonal',
    description: 'Japanese dividend capture strategy around March/September ex-dates. Stocks with >3% yield see +1.5% run-up before ex-date.',
    signal: 'green', ic: 0.016, price: 0, localInsight: '3月と9月の権利付き最終日に向けて、高配当銘柄が買われる「配当取り」の動き。',
    source: 'JPX',
  },
  {
    id: 'JP_SHAREHOLDER_BENEFIT', name: 'Shareholder Benefits', nameLocal: '株主優待利回り',
    market: 'jp', tier: 'pro', category: 'Special',
    description: 'Yūtai (shareholder perks) yield as % of market cap. Japanese retail investors heavily favor stocks with generous perks. Average excess return +2%.',
    signal: 'green', ic: 0.029, price: 1, localInsight: '株主優待の新設・拡充発表後、小型株は平均+8%の急騰。優待銘柄は個人投資家の支持厚い。',
    source: 'Daiwa Investor Relations',
  },
  {
    id: 'JP_BANK_LENDING', name: 'Bank Lending Growth', nameLocal: '銀行貸出動向',
    market: 'jp', tier: 'advanced', category: 'Macro',
    description: 'YoY change in outstanding bank loans. Leading indicator for capex cycle. Positive growth = bank stocks + corporate investment.',
    signal: 'yellow', ic: 0.022, price: 0, localInsight: '貸出金前年比+3%を超えると、銀行株がTOPIXをアウトパフォームする傾向。',
    source: 'BOJ',
  },
  {
    id: 'JP_VALUE_TRAP', name: 'Value Trap Detector', nameLocal: 'バリュートラップ検出',
    market: 'jp', tier: 'pro', category: 'Value',
    description: 'Identifies deep value stocks that are cheap for structural reasons (declining industry, poor governance). Avoids PBR < 1 traps in Japan.',
    signal: 'red', ic: 0.035, price: 1, localInsight: 'PBR1倍割れのうち、ROE5%未満かつ持ち合い比率30%超の銘柄は「バリュートラップ」。10年平均-3.2%/年。',
    source: 'TSE / Nikkei NEEDS',
  },
  {
    id: 'JPY_SENSITIVITY', name: 'JPY Sensitivity Beta', nameLocal: '円感応度ベータ',
    market: 'jp', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock return sensitivity to JPY/USD moves. High beta = exporters (autos, electronics). Low beta = domestics (retail, utilities).',
    signal: 'yellow', ic: 0.028, price: 0, localInsight: '1ドル=150円超で輸出株優位、130円割れで内需株優位のセクターローテーション。',
    source: 'JPX / BOJ',
  },
];

// ── Taiwan 7 Factors ────────────────────────────────────────────────
const TW_FACTORS: JPTWFactorMeta[] = [
  {
    id: 'TW_MARGIN_BALANCE', name: 'Margin Balance', nameLocal: '融資餘額',
    market: 'tw', tier: 'basic', category: 'Flow',
    description: 'Total margin loan balance on TWSE. Rising margin = retail bullish. Extreme levels (>NT$300B) = overheating risk. Key sentiment indicator.',
    signal: 'green', ic: 0.041, price: 0, localInsight: '融資餘額突破3000億台幣常為過熱訊號，2週內加權指數平均回調-3.5%。散戶指標之王。',
    source: 'TWSE',
  },
  {
    id: 'TW_SHORT_RATIO', name: 'Short Ratio', nameLocal: '融券餘額',
    market: 'tw', tier: 'advanced', category: 'Sentiment',
    description: 'Total short selling balance. Short ratio > 2% of total shares = crowded short = potential squeeze. < 0.5% = low bearish sentiment.',
    signal: 'yellow', ic: -0.022, price: 0, localInsight: '融券餘額佔發行量2%以上且股價在月線之上，是強制回補軋空行情的前兆。',
    source: 'TWSE',
  },
  {
    id: 'TW_FOREIGN_FLOW', name: 'Foreign Net Flow', nameLocal: '外資買賣超',
    market: 'tw', tier: 'basic', category: 'Flow',
    description: 'Net foreign institutional buying on TWSE. Foreigners own ~40% of TAIEX market cap. Sustained inflow > NT$10B/day = strong bullish signal.',
    signal: 'green', ic: 0.048, price: 0, localInsight: '外資連續3日買超100億以上，20日後加權指數上漲機率78%。外資是台股最大推力。',
    source: 'TWSE',
  },
  {
    id: 'TW_TSMC_LINKAGE', name: 'TSMC Linkage Beta', nameLocal: '台積電連動係數',
    market: 'tw', tier: 'advanced', category: 'Correlation',
    description: 'Stock beta to TSMC (2330). TSMC is ~30% of TAIEX. High linkage = semiconductor supply chain. Low linkage = domestic consumption.',
    signal: 'yellow', ic: 0.026, price: 0, localInsight: '台積電佔加權指數30%，連動係數>0.8的股票等於跟著台積走。半導體景氣決定台股方向。',
    source: 'TWSE',
  },
  {
    id: 'TW_DIVIDEND_CHASE', name: 'Dividend Chase', nameLocal: '除權息行情',
    market: 'tw', tier: 'advanced', category: 'Seasonal',
    description: 'Pre ex-dividend run-up effect in Taiwan (June-August peak season). Companies with >5% yield attract buying 2 weeks before ex-date.',
    signal: 'green', ic: 0.018, price: 0, localInsight: '除權息前2週，高殖利率股(>5%)平均漲幅+3.2%。6-8月為台股除權息旺季。',
    source: 'TWSE',
  },
  {
    id: 'TW_FINANCING_OVERHEAT', name: 'Margin Overheat', nameLocal: '融資過熱訊號',
    market: 'tw', tier: 'pro', category: 'Risk',
    description: 'Composite overheating score using margin/day-trading ratio/leverage. Score > 80 percentile = history suggests -5% correction within 2 months.',
    signal: 'red', ic: 0.037, price: 1, localInsight: '融資維持率低於150%且當沖比>40%時，散戶斷頭壓力大增。歷史回測該訊號後2月平均跌-6.8%。',
    source: 'TWSE',
  },
  {
    id: 'TW_NT_DOLLAR', name: 'TWD Directional Beta', nameLocal: '台幣匯率聯動',
    market: 'tw', tier: 'advanced', category: 'FX / Macro',
    description: 'Stock return sensitivity to TWD/USD. TWD appreciation = foreign inflow = tech rally. TWD weakness > 32 = foreign outflow risk.',
    signal: 'yellow', ic: 0.031, price: 0, localInsight: '台幣升破30元 → 外資匯入 → 台股上漲。台幣貶破32 → 外資提款 → 權值股賣壓。',
    source: 'CBC / TWSE',
  },
];

// ── Market Theme Colors ──────────────────────────────────────────────
const MARKET_THEME: Record<JPTWMarket, { bg: string; accent: string; text: string; gradient: string }> = {
  jp: {
    bg: 'rgba(188, 0, 45, 0.08)',
    accent: '#BC002D', // 和紅
    text: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #BC002D, #FF6B6B)', // 白 is text color
  },
  tw: {
    bg: 'rgba(0, 133, 99, 0.08)',
    accent: '#008563', // 台灣綠
    text: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #008563, #4DB6AC)',
  },
};

// ── Component ────────────────────────────────────────────────────────
const JPTWFactorCard: React.FC<JPTWFactorCardProps> = ({
  factor,
  onClick,
  selected = false,
}) => {
  const theme = MARKET_THEME[factor.market];
  const flag = factor.market === 'jp' ? '🇯🇵' : '🇹🇼';
  const tierConfig = {
    basic: { label: '🌱', color: '#66bd63' },
    advanced: { label: '🌶️', color: '#d4a853' },
    pro: { label: '🔴', color: '#9b59b6' },
  };
  const tc = tierConfig[factor.tier];
  const signalConfig = {
    green: { dot: '🟢', label: 'Bullish' },
    yellow: { dot: '🟡', label: 'Neutral' },
    red: { dot: '🔴', label: 'Bearish' },
  };
  const sc = factor.signal ? signalConfig[factor.signal] : null;

  return (
    <div
      style={{
        ...styles.card,
        background: selected ? theme.bg : '#0f0f1e',
        borderColor: selected ? theme.accent : '#2a2a4a',
        boxShadow: selected ? `0 0 10px ${theme.bg}` : 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={() => onClick?.(factor)}
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.flag}>{flag}</span>
          <div>
            <div style={styles.nameRow}>
              <span style={styles.name}>{factor.name}</span>
              <span style={styles.nameLocal}>{factor.nameLocal}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={{ ...styles.tierBadge, color: tc.color }}>{tc.label}</span>
              <span style={styles.category}>{factor.category}</span>
              {sc && (
                <Tooltip title={sc.label}>
                  <span style={styles.signal}>{sc.dot}</span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          {factor.ic != null && (
            <span
              style={{
                ...styles.ic,
                color: factor.ic >= 0.03 ? '#66bd63' : factor.ic >= 0 ? '#d4a853' : '#f46d43',
              }}
            >
              IC {(factor.ic * 100).toFixed(1)}%
            </span>
          )}
          {factor.price ? (
            <Tag color="gold" style={styles.priceTag}>{factor.price}U</Tag>
          ) : (
            <Tag color="green" style={styles.priceTag}>FREE</Tag>
          )}
        </div>
      </div>

      {/* Description */}
      <p style={styles.desc}>{factor.description}</p>

      {/* Local Insight */}
      {factor.localInsight && (
        <div
          style={{
            ...styles.insight,
            background: theme.bg,
            borderLeft: `3px solid ${theme.accent}`,
          }}
        >
          <span style={styles.insightLabel}>
            {factor.market === 'jp' ? '💡 日本語分析' : '💡 中文分析'}
          </span>
          <p style={styles.insightText}>{factor.localInsight}</p>
        </div>
      )}

      {/* Source */}
      {factor.source && (
        <div style={styles.source}>
          <span style={styles.sourceLabel}>Data: {factor.source}</span>
        </div>
      )}
    </div>
  );
};

// ── JPTW Factor List Component ──────────────────────────────────────
const JPTWFactorList: React.FC<{
  market: JPTWMarket;
  onSelect?: (factor: JPTWFactorMeta) => void;
  selectedId?: string;
}> = ({ market, onSelect, selectedId }) => {
  const factors = market === 'jp' ? JP_FACTORS : TW_FACTORS;
  const theme = MARKET_THEME[market];
  const flag = market === 'jp' ? '🇯🇵' : '🇹🇼';
  const title = market === 'jp' ? 'Japan Exclusive' : 'Taiwan Exclusive';

  return (
    <div style={styles.listContainer}>
      <div style={{ ...styles.listHeader, borderBottom: `2px solid ${theme.accent}` }}>
        <span style={styles.listFlag}>{flag}</span>
        <span style={styles.listTitle}>{title}</span>
        <Tag color={market === 'jp' ? 'red' : 'green'} style={{ marginLeft: 'auto' }}>
          {factors.length} factors
        </Tag>
      </div>
      <div style={styles.listGrid}>
        {factors.map((f) => (
          <JPTWFactorCard
            key={f.id}
            factor={f}
            onClick={onSelect}
            selected={f.id === selectedId}
          />
        ))}
      </div>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
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
  flag: {
    fontSize: 18,
    flexShrink: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  nameLocal: {
    fontSize: 11,
    color: '#888',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  tierBadge: {
    fontSize: 12,
  },
  category: {
    fontSize: 10,
    color: '#666',
  },
  signal: {
    fontSize: 12,
    cursor: 'help',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  ic: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  priceTag: {
    fontSize: 10,
    padding: '0 6px',
  },
  desc: {
    fontSize: 11,
    color: '#aaa',
    margin: '0 0 8px',
    lineHeight: 1.5,
  },
  insight: {
    padding: '8px 10px',
    borderRadius: 6,
    marginBottom: 6,
  },
  insightLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#ccc',
    display: 'block',
    marginBottom: 2,
  },
  insightText: {
    fontSize: 11,
    color: '#bbb',
    margin: 0,
    lineHeight: 1.5,
    fontStyle: 'italic',
  },
  source: {
    fontSize: 9,
    color: '#555',
  },
  sourceLabel: {},
  // List
  listContainer: {
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 14,
  },
  listFlag: {
    fontSize: 22,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  listGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
};

export { JPTWFactorCard, JPTWFactorList, JP_FACTORS, TW_FACTORS };
export { MARKET_THEME };
export type { JPTWFactorCardProps, JPTWFactorMeta, JPTWMarket };
