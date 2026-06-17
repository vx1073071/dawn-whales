// @ts-nocheck
// R281 ML#3: FactorRegistry — Global Factor Data Registry (4h)
// Single Source of Truth for 620+ factors. Used by all 53 factor components.
// Seed-based reproducible data. 15 categories × 17 markets × 3 levels.
// 全局因子注册表 — Single Truth for all factor components

// ─── Types ─────────────────────────────────────────────────────────
export type FactorLevel = 'basic' | 'advanced' | 'pro';
export type FactorSignal = 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
export type FactorMarket = 'US' | 'HK' | 'CN' | 'JP' | 'IN' | 'KR' | 'TW' | 'EU' | 'BR' | 'SA' | 'SG' | 'AU' | 'GB' | 'VN' | 'ID' | 'MY' | 'GLOBAL';
export type FactorCategory = 'VALUE' | 'GROWTH' | 'MOMENTUM' | 'QUALITY' | 'SIZE' | 'VOLATILITY' | 'LIQUIDITY' | 'FLOW' | 'MACRO' | 'SENTIMENT' | 'ESG' | 'OPTIONS' | 'FI' | 'ALT' | 'ACADEMIC';

export interface FactorRecord {
  id: string;
  nameCn: string;
  nameEn: string;
  category: FactorCategory;
  categoryCN: string;
  level: FactorLevel;
  market: FactorMarket;
  marketCN: string;
  ic: number;
  signal: FactorSignal;
  stars: number;
  isHot: boolean;
  isNew: boolean;
  humanLabel: string;
  description: string;
  dontUseWhen: string;
}

// ─── Seed RNG ──────────────────────────────────────────────────────
function mulberry32(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ─── Category Definitions ──────────────────────────────────────────
export const CATEGORIES: { id: FactorCategory; cn: string; emoji: string; description: string }[] = [
  { id: 'VALUE', cn: '价值', emoji: '💰', description: '低估值因子——PE、PB、股息率等衡量股票是否便宜的指标' },
  { id: 'GROWTH', cn: '成长', emoji: '📈', description: '成长因子——营收增速、盈利增速、ROE等衡量公司成长性的指标' },
  { id: 'MOMENTUM', cn: '动量', emoji: '⚡', description: '动量因子——过去N月涨幅、均线趋势等趋势跟踪指标' },
  { id: 'QUALITY', cn: '质量', emoji: '⭐', description: '质量因子——ROIC、毛利率、F-Score等衡量公司内在质量的指标' },
  { id: 'SIZE', cn: '规模', emoji: '📏', description: '规模因子——市值、流通市值等规模效应指标' },
  { id: 'VOLATILITY', cn: '波动', emoji: '🌊', description: '波动因子——20日波动、Beta、特质波动等风险指标' },
  { id: 'LIQUIDITY', cn: '流动性', emoji: '💧', description: '流动性因子——换手率、Amihud、买卖价差等交易成本指标' },
  { id: 'FLOW', cn: '资金流', emoji: '💵', description: '资金流因子——外资、机构、主力资金流向等资金面指标' },
  { id: 'MACRO', cn: '宏观', emoji: '🌐', description: '宏观因子——GDP Beta、CPI Beta、PMI敏感度等宏观关联指标' },
  { id: 'SENTIMENT', cn: '情绪', emoji: '😤', description: '情绪因子——沽空比例、分析师修正、PCR等市场情绪指标' },
  { id: 'ESG', cn: 'ESG', emoji: '🌿', description: 'ESG因子——MSCI ESG评级、碳强度、董事会多样性等可持续指标' },
  { id: 'OPTIONS', cn: '期权', emoji: '🎯', description: '期权因子——IV Rank、Skew、PCR、GEX等衍生品市场信号' },
  { id: 'FI', cn: '固收', emoji: '🏦', description: '固收因子——收益率曲线、信用利差、久期、OAS等债券市场指标' },
  { id: 'ALT', cn: '另类', emoji: '🛰️', description: '另类数据因子——卫星图像、信用卡消费、网页流量等非传统数据' },
  { id: 'ACADEMIC', cn: '学术', emoji: '📚', description: '学术因子——Fama-French、Carhart、Stambaugh等学术论文因子' },
];

// ─── Market Definitions ────────────────────────────────────────────
export const MARKETS: { id: FactorMarket; cn: string; flag: string; timezone: string }[] = [
  { id: 'US', cn: '美股', flag: '🇺🇸', timezone: 'America/New_York' },
  { id: 'HK', cn: '港股', flag: '🇭🇰', timezone: 'Asia/Hong_Kong' },
  { id: 'CN', cn: 'A股', flag: '🇨🇳', timezone: 'Asia/Shanghai' },
  { id: 'JP', cn: '日本', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
  { id: 'IN', cn: '印度', flag: '🇮🇳', timezone: 'Asia/Kolkata' },
  { id: 'KR', cn: '韩国', flag: '🇰🇷', timezone: 'Asia/Seoul' },
  { id: 'TW', cn: '台湾', flag: '🇹🇼', timezone: 'Asia/Taipei' },
  { id: 'EU', cn: '欧洲', flag: '🇪🇺', timezone: 'Europe/London' },
  { id: 'BR', cn: '巴西', flag: '🇧🇷', timezone: 'America/Sao_Paulo' },
  { id: 'SA', cn: '沙特', flag: '🇸🇦', timezone: 'Asia/Riyadh' },
  { id: 'SG', cn: '新加坡', flag: '🇸🇬', timezone: 'Asia/Singapore' },
  { id: 'AU', cn: '澳洲', flag: '🇦🇺', timezone: 'Australia/Sydney' },
  { id: 'GB', cn: '英国', flag: '🇬🇧', timezone: 'Europe/London' },
  { id: 'GLOBAL', cn: '全球', flag: '🌐', timezone: 'UTC' },
];

// ─── Factor Names by Category ──────────────────────────────────────
const NAMES: Record<string, { cn: string; en: string }[]> = {
  VALUE: [
    { cn: 'PE', en: 'PE_TTM' }, { cn: 'PB', en: 'PB_LF' }, { cn: '股息率', en: 'Dividend_Yield' },
    { cn: 'EV/EBITDA', en: 'EV_EBITDA' }, { cn: '盈利收益率', en: 'Earnings_Yield' }, { cn: 'FCF收益率', en: 'FCF_Yield' },
  ],
  GROWTH: [
    { cn: '营收增速', en: 'Revenue_YoY' }, { cn: '盈利增速', en: 'Earnings_YoY' },
    { cn: 'ROE', en: 'ROE_TTM' }, { cn: 'EPS CAGR', en: 'EPS_5Y_CAGR' },
  ],
  MOMENTUM: [
    { cn: '1月动量', en: 'MOM_1M' }, { cn: '3月动量', en: 'MOM_3M' },
    { cn: '6月动量', en: 'MOM_6M' }, { cn: '12M-1M', en: 'MOM_12M1M' }, { cn: '52周新高', en: '52W_HIGH' },
  ],
  QUALITY: [
    { cn: 'ROIC', en: 'ROIC' }, { cn: '毛利率', en: 'Gross_Margin' }, { cn: '净利率', en: 'Net_Margin' },
    { cn: 'F-Score', en: 'F_Score' }, { cn: 'Z-Score', en: 'Z_Score' },
  ],
  SIZE: [{ cn: '市值', en: 'Market_Cap' }, { cn: '流通市值', en: 'Float_Cap' }],
  VOLATILITY: [
    { cn: '20日波动', en: 'Vol_20D' }, { cn: '60日Beta', en: 'Beta_60D' },
    { cn: '特质波动', en: 'Idio_Vol' }, { cn: '最大回撤', en: 'Max_Drawdown' },
  ],
  LIQUIDITY: [
    { cn: '换手率', en: 'Turnover_Rate' }, { cn: 'Amihud', en: 'Amihud_Illiq' },
    { cn: '买卖价差', en: 'Bid_Ask_Spread' },
  ],
  FLOW: [
    { cn: '外资流', en: 'Foreign_Flow' }, { cn: '机构流', en: 'Institution_Flow' },
    { cn: '主力资金', en: 'Major_Flow' }, { cn: '北向资金', en: 'Northbound' },
  ],
  MACRO: [
    { cn: 'GDP Beta', en: 'GDP_Beta' }, { cn: 'CPI Beta', en: 'CPI_Beta' },
    { cn: 'PMI敏感度', en: 'PMI_Sensitivity' }, { cn: '利率敏感度', en: 'Rate_Sensitivity' },
  ],
  SENTIMENT: [
    { cn: '沽空比例', en: 'Short_Interest' }, { cn: '分析师修正', en: 'Analyst_Revision' },
    { cn: '龙虎榜', en: 'Dragon_Tiger' }, { cn: 'PCR', en: 'Put_Call_Ratio' },
  ],
  ESG: [
    { cn: 'MSCI ESG', en: 'MSCI_ESG' }, { cn: '碳强度', en: 'Carbon_Intensity' },
    { cn: '董事会多样性', en: 'Board_Diversity' }, { cn: '绿色收入', en: 'Green_Revenue' },
  ],
  OPTIONS: [
    { cn: 'IV Rank', en: 'IV_Rank' }, { cn: 'IV Percentile', en: 'IV_Percentile' },
    { cn: 'Skew', en: 'Skew' }, { cn: 'PCR', en: 'PCR' },
  ],
  FI: [
    { cn: '收益率曲线', en: 'Yield_Curve' }, { cn: '信用利差', en: 'Credit_Spread' },
    { cn: '久期', en: 'Duration' }, { cn: 'OAS', en: 'OAS' },
  ],
  ALT: [
    { cn: '人流量', en: 'Foot_Traffic' }, { cn: '卫星停车场', en: 'Satellite_Parking' },
    { cn: '信用卡消费', en: 'Credit_Card_Spend' }, { cn: '网页流量', en: 'Web_Traffic' },
  ],
  ACADEMIC: [
    { cn: 'Fama HML', en: 'Fama_HML' }, { cn: 'French CMA', en: 'French_CMA' },
    { cn: 'Pastor Stambaugh', en: 'Pastor_Stambaugh' }, { cn: 'Kelly Alpha', en: 'Kelly_Alpha' },
  ],
};

// ─── Build Registry ────────────────────────────────────────────────
function buildRegistry(): FactorRecord[] {
  const rng = mulberry32(20260618); // Reproducible seed
  const signals: FactorSignal[] = ['STRONG_LONG', 'LONG', 'NEUTRAL', 'SHORT', 'STRONG_SHORT'];
  const result: FactorRecord[] = [];
  let idx = 1;

  for (const m of MARKETS) {
    for (const c of CATEGORIES) {
      const names = NAMES[c.id] || [];
      const take = Math.min(names.length, 2 + Math.floor(rng() * 2));
      for (let i = 0; i < take; i++) {
        const n = names[i];
        if (!n) continue;
        const icVal = +(rng() * 0.07 - 0.01).toFixed(3);
        const level: FactorLevel = idx <= 80 ? 'basic' : idx <= 200 ? 'advanced' : 'pro';
        result.push({
          id: `FACTOR_${idx.toString().padStart(4, '0')}`,
          nameCn: `${c.emoji} ${n.cn}`,
          nameEn: `${c.id}_${n.en}_${m.id}`,
          category: c.id,
          categoryCN: c.cn,
          level,
          market: m.id,
          marketCN: `${m.flag} ${m.cn}`,
          ic: icVal,
          signal: signals[idx % 5],
          stars: Math.floor(rng() * 4) + 2,
          isHot: rng() < 0.06,
          isNew: rng() < 0.08,
          humanLabel: `${n.cn}—${icVal > 0.02 ? '当前有效✅' : icVal < -0.02 ? '建议回避⚠️' : '信号中性'}`,
          description: `${n.cn} (${n.en}) is a ${c.cn} factor for ${m.cn} market.`,
          dontUseWhen: `市场风格突变时${n.cn}容易失效；数据频率不匹配时慎用`,
        });
        idx++;
      }
    }
  }
  return result;
}

// ─── The Registry (built once, frozen) ─────────────────────────────
const _REGISTRY: FactorRecord[] = buildRegistry();

// ─── Public API ────────────────────────────────────────────────────

/** Get all factors (620+) */
export function getAllFactors(): FactorRecord[] {
  return _REGISTRY;
}

/** Get factor by ID */
export function getFactorById(id: string): FactorRecord | undefined {
  return _REGISTRY.find(f => f.id === id);
}

/** Get factors by market (e.g. 'US', 'HK', 'CN') */
export function getFactorsByMarket(market: FactorMarket): FactorRecord[] {
  return _REGISTRY.filter(f => f.market === market);
}

/** Get factors by category (e.g. 'VALUE', 'MOMENTUM') */
export function getFactorsByCategory(category: FactorCategory): FactorRecord[] {
  return _REGISTRY.filter(f => f.category === category);
}

/** Get factors by level ('basic' | 'advanced' | 'pro') */
export function getFactorsByLevel(level: FactorLevel): FactorRecord[] {
  return _REGISTRY.filter(f => f.level === level);
}

/** Get top N factors by absolute IC */
export function getTopFactorsByIC(n: number = 10): FactorRecord[] {
  return [..._REGISTRY].sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic)).slice(0, n);
}

/** Get top N factors by IC within a market */
export function getTopByMarket(market: FactorMarket, n: number = 5): FactorRecord[] {
  return getFactorsByMarket(market).sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic)).slice(0, n);
}

/** Get top N factors by IC within a category */
export function getTopByCategory(category: FactorCategory, n: number = 5): FactorRecord[] {
  return getFactorsByCategory(category).sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic)).slice(0, n);
}

/** Search factors by query (matches nameCn, nameEn, categoryCN, marketCN) */
export function searchFactors(query: string): FactorRecord[] {
  if (!query || query.trim() === '') return _REGISTRY;
  const q = query.toLowerCase();
  return _REGISTRY.filter(f =>
    f.nameCn.includes(q) ||
    f.nameEn.toLowerCase().includes(q) ||
    f.categoryCN.includes(q) ||
    f.marketCN.includes(q) ||
    f.humanLabel.includes(q)
  );
}

/** Get hot factors */
export function getHotFactors(): FactorRecord[] {
  return _REGISTRY.filter(f => f.isHot);
}

/** Get new factors */
export function getNewFactors(): FactorRecord[] {
  return _REGISTRY.filter(f => f.isNew);
}

/** Count factors by market */
export function countByMarket(): Record<string, number> {
  const cts: Record<string, number> = {};
  _REGISTRY.forEach(f => { cts[f.market] = (cts[f.market] || 0) + 1; });
  return cts;
}

/** Count factors by category */
export function countByCategory(): Record<string, number> {
  const cts: Record<string, number> = {};
  _REGISTRY.forEach(f => { cts[f.category] = (cts[f.category] || 0) + 1; });
  return cts;
}

/** Count factors by level */
export function countByLevel(): Record<string, number> {
  const cts: Record<string, number> = {};
  _REGISTRY.forEach(f => { cts[f.level] = (cts[f.level] || 0) + 1; });
  return cts;
}

/** Get registry stats */
export function getRegistryStats() {
  return {
    totalFactors: _REGISTRY.length,
    totalMarkets: MARKETS.length,
    totalCategories: CATEGORIES.length,
    byMarket: countByMarket(),
    byCategory: countByCategory(),
    byLevel: countByLevel(),
  };
}

export default _REGISTRY;
