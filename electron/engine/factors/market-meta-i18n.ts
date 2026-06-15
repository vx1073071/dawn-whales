// ── R194 A2: 7-Market Metadata i18n ─────────────────────────────────────────
// Market names, timezones, currencies, holidays, and short descriptions
// in 8 languages (zh-CN/zh-TW/en/ja/ko/fr/it/de).
//
// zh-TW uses Traditional Chinese + Taiwan-specific terminology.
// ja uses native Japanese market terms.
//
// Total: 7 markets × 8 languages = 56 metadata entries.

export type MarketKey = 'hk' | 'us' | 'crypto' | 'jp' | 'tw' | 'global' | 'cross';

export interface MarketMeta {
  name: string;           // Native name for the market
  timezone: string;       // e.g. "UTC+8 (HKT)"
  currency: string;       // e.g. "HKD"
  holidayRegion: string;  // Holiday calendar reference
  flag: string;           // Emoji flag
  shortDesc: string;      // One-line description
}

// 7-market metadata registry — 8 languages
export const MARKET_META_I18N: Record<string, Record<MarketKey, MarketMeta>> = {
  'zh-CN': {
    hk: { name: '港股', timezone: 'UTC+8 (HKT)', currency: '港元 HKD', holidayRegion: '香港公众假期', flag: '🇭🇰', shortDesc: '香港联合交易所，全球第三大金融中心，中国资本出海桥头堡' },
    us: { name: '美股', timezone: 'UTC-5/-4 (EST/EDT)', currency: '美元 USD', holidayRegion: '美国联邦假期', flag: '🇺🇸', shortDesc: '纽约证交所+纳斯达克，全球最大最深资本市场' },
    crypto: { name: '加密', timezone: '24×7 全天候', currency: 'USDT/BTC/ETH', holidayRegion: '无休市', flag: '🪙', shortDesc: '加密货币24×7全时交易市场，波动率全球最高' },
    jp: { name: '日股', timezone: 'UTC+9 (JST)', currency: '日元 JPY', holidayRegion: '日本公众假期', flag: '🇯🇵', shortDesc: '东京证券交易所，全球第三大股票市场，独特的日银ETF和交叉持股体系' },
    tw: { name: '台股', timezone: 'UTC+8 (TST)', currency: '新台币 TWD', holidayRegion: '台湾公众假期', flag: '🇹🇼', shortDesc: '台湾证券交易所，以半导体为核心，融资融券文化独特' },
    global: { name: '全球通用', timezone: 'N/A', currency: '多币种', holidayRegion: 'N/A', flag: '🌍', shortDesc: '适用于所有市场的通用因子，跨市场比较的基础框架' },
    cross: { name: '跨市场', timezone: 'N/A', currency: '多币种', holidayRegion: 'N/A', flag: '🌏', shortDesc: '跨市场套利、汇率、协偏度等涉及多市场的因子' },
  },

  'zh-TW': {
    hk: { name: '港股', timezone: 'UTC+8 (HKT)', currency: '港元 HKD', holidayRegion: '香港公眾假期', flag: '🇭🇰', shortDesc: '香港聯合交易所，全球第三大金融中心，中國資本出海橋頭堡' },
    us: { name: '美股', timezone: 'UTC-5/-4 (EST/EDT)', currency: '美元 USD', holidayRegion: '美國聯邦假期', flag: '🇺🇸', shortDesc: '紐約證交所+納斯達克，全球最大最深資本市場' },
    crypto: { name: '加密貨幣', timezone: '24×7 全天候', currency: 'USDT/BTC/ETH', holidayRegion: '無休市', flag: '🪙', shortDesc: '加密貨幣24×7全時交易市場，波動率全球最高' },
    jp: { name: '日股', timezone: 'UTC+9 (JST)', currency: '日圓 JPY', holidayRegion: '日本公眾假期', flag: '🇯🇵', shortDesc: '東京證券交易所，全球第三大股票市場，獨特的日銀ETF和交叉持股體系' },
    tw: { name: '台股', timezone: 'UTC+8 (TST)', currency: '新台幣 TWD', holidayRegion: '台灣公眾假期', flag: '🇹🇼', shortDesc: '台灣證券交易所，以半導體為核心，融資融券文化獨特' },
    global: { name: '全球通用', timezone: 'N/A', currency: '多幣種', holidayRegion: 'N/A', flag: '🌍', shortDesc: '適用於所有市場的通用因子，跨市場比較的基礎框架' },
    cross: { name: '跨市場', timezone: 'N/A', currency: '多幣種', holidayRegion: 'N/A', flag: '🌏', shortDesc: '跨市場套利、匯率、協偏度等涉及多市場的因子' },
  },

  'en': {
    hk: { name: 'Hong Kong', timezone: 'UTC+8 (HKT)', currency: 'HKD', holidayRegion: 'HK Public Holidays', flag: '🇭🇰', shortDesc: 'HKEX — 3rd largest financial center. Gateway for China capital outflows.' },
    us: { name: 'US Markets', timezone: 'UTC-5/-4 (EST/EDT)', currency: 'USD', holidayRegion: 'US Federal Holidays', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — the deepest and most liquid capital market on Earth.' },
    crypto: { name: 'Crypto', timezone: '24×7 Always On', currency: 'USDT/BTC/ETH', holidayRegion: 'Never Closes', flag: '🪙', shortDesc: 'Cryptocurrency markets — 24/7 trading, highest volatility globally.' },
    jp: { name: 'Japan', timezone: 'UTC+9 (JST)', currency: 'JPY', holidayRegion: 'JP Public Holidays', flag: '🇯🇵', shortDesc: 'Tokyo Stock Exchange — 3rd largest globally. BOJ ETF + cross-holding ecosystem.' },
    tw: { name: 'Taiwan', timezone: 'UTC+8 (TST)', currency: 'TWD', holidayRegion: 'TW Public Holidays', flag: '🇹🇼', shortDesc: 'Taiwan Stock Exchange — semiconductor-centric with unique margin trading culture.' },
    global: { name: 'Global', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌍', shortDesc: 'Universal factors applicable across all markets.' },
    cross: { name: 'Cross-Market', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌏', shortDesc: 'Cross-market arbitrage, FX, co-skewness and multi-market factors.' },
  },

  'ja': {
    hk: { name: '香港市場', timezone: 'UTC+8 (HKT)', currency: '香港ドル HKD', holidayRegion: '香港休場日', flag: '🇭🇰', shortDesc: '香港証券取引所 — 世界第3位の金融センター、中国資本の海外流出ゲートウェイ' },
    us: { name: '米国市場', timezone: 'UTC-5/-4 (EST/EDT)', currency: '米ドル USD', holidayRegion: '米国祝日', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — 世界最大かつ最も流動性の高い資本市場' },
    crypto: { name: '暗号資産', timezone: '24時間365日', currency: 'USDT/BTC/ETH', holidayRegion: '常時稼働', flag: '🪙', shortDesc: '暗号資産市場 — 24時間365日取引、世界最高のボラティリティ' },
    jp: { name: '日本市場', timezone: 'UTC+9 (JST)', currency: '日本円 JPY', holidayRegion: '日本祝日/休場日', flag: '🇯🇵', shortDesc: '東京証券取引所 — 世界第3位。日銀ETF買入と株式持ち合いが特徴' },
    tw: { name: '台湾市場', timezone: 'UTC+8 (TST)', currency: '台湾ドル TWD', holidayRegion: '台湾祝日', flag: '🇹🇼', shortDesc: '台湾証券取引所 — 半導体中心。信用取引残高が特徴的な指標' },
    global: { name: 'グローバル', timezone: 'N/A', currency: '複数通貨', holidayRegion: 'N/A', flag: '🌍', shortDesc: '全市場で適用可能なユニバーサルファクター' },
    cross: { name: 'クロスマーケット', timezone: 'N/A', currency: '複数通貨', holidayRegion: 'N/A', flag: '🌏', shortDesc: 'クロスマーケット裁定、為替、共和分などの多市場ファクター' },
  },

  'ko': {
    hk: { name: '홍콩 시장', timezone: 'UTC+8 (HKT)', currency: '홍콩달러 HKD', holidayRegion: '홍콩 공휴일', flag: '🇭🇰', shortDesc: '홍콩거래소 — 세계 3대 금융센터, 중국 자본 해외 진출의 교두보' },
    us: { name: '미국 시장', timezone: 'UTC-5/-4 (EST/EDT)', currency: '미국달러 USD', holidayRegion: '미국 연방 공휴일', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — 세계 최대·최심 자본시장' },
    crypto: { name: '암호화폐', timezone: '24×7 상시', currency: 'USDT/BTC/ETH', holidayRegion: '무휴장', flag: '🪙', shortDesc: '암호화폐 시장 — 24시간 연중무휴, 세계 최고 변동성' },
    jp: { name: '일본 시장', timezone: 'UTC+9 (JST)', currency: '일본엔 JPY', holidayRegion: '일본 공휴일', flag: '🇯🇵', shortDesc: '도쿄증권거래소 — 세계 3위. 일본은행 ETF 매입과 상호출자 생태계' },
    tw: { name: '대만 시장', timezone: 'UTC+8 (TST)', currency: '대만달러 TWD', holidayRegion: '대만 공휴일', flag: '🇹🇼', shortDesc: '대만증권거래소 — 반도체 중심. 신용거래 문화가 독특' },
    global: { name: '글로벌', timezone: 'N/A', currency: '복수통화', holidayRegion: 'N/A', flag: '🌍', shortDesc: '모든 시장에 적용 가능한 범용 팩터' },
    cross: { name: '크로스마켓', timezone: 'N/A', currency: '복수통화', holidayRegion: 'N/A', flag: '🌏', shortDesc: '크로스마켓 차익거래, 환율, 코스큐네스 등 다중시장 팩터' },
  },

  'fr': {
    hk: { name: 'Hong Kong', timezone: 'UTC+8 (HKT)', currency: 'HKD', holidayRegion: 'Jours fériés HK', flag: '🇭🇰', shortDesc: 'HKEX — 3ᵉ centre financier mondial. Porte d\'entrée des capitaux chinois.' },
    us: { name: 'Marchés US', timezone: 'UTC-5/-4 (EST/EDT)', currency: 'USD', holidayRegion: 'Jours fériés US', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — le marché le plus profond et le plus liquide au monde.' },
    crypto: { name: 'Crypto', timezone: '24h/24 7j/7', currency: 'USDT/BTC/ETH', holidayRegion: 'Jamais fermé', flag: '🪙', shortDesc: 'Marchés crypto — trading 24/7, volatilité la plus élevée au monde.' },
    jp: { name: 'Japon', timezone: 'UTC+9 (JST)', currency: 'JPY', holidayRegion: 'Jours fériés JP', flag: '🇯🇵', shortDesc: 'Bourse de Tokyo — 3ᵉ mondiale. L\'écosystème BOJ ETF + participations croisées.' },
    tw: { name: 'Taïwan', timezone: 'UTC+8 (TST)', currency: 'TWD', holidayRegion: 'Jours fériés TW', flag: '🇹🇼', shortDesc: 'Bourse de Taïwan — centrée sur les semi-conducteurs, culture unique du trading sur marge.' },
    global: { name: 'Global', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌍', shortDesc: 'Facteurs universels applicables à tous les marchés.' },
    cross: { name: 'Transmarché', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌏', shortDesc: 'Arbitrage transmarché, change, co-skewness et facteurs multi-marchés.' },
  },

  'it': {
    hk: { name: 'Hong Kong', timezone: 'UTC+8 (HKT)', currency: 'HKD', holidayRegion: 'Festività HK', flag: '🇭🇰', shortDesc: 'HKEX — 3° centro finanziario mondiale. Porta d\'accesso per i capitali cinesi.' },
    us: { name: 'Mercati US', timezone: 'UTC-5/-4 (EST/EDT)', currency: 'USD', holidayRegion: 'Festività US', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — il mercato più profondo e liquido al mondo.' },
    crypto: { name: 'Cripto', timezone: '24×7 Sempre Aperto', currency: 'USDT/BTC/ETH', holidayRegion: 'Mai chiuso', flag: '🪙', shortDesc: 'Mercati crypto — trading 24/7, volatilità più alta al mondo.' },
    jp: { name: 'Giappone', timezone: 'UTC+9 (JST)', currency: 'JPY', holidayRegion: 'Festività JP', flag: '🇯🇵', shortDesc: 'Borsa di Tokyo — 3ª mondiale. Ecosistema BOJ ETF + partecipazioni incrociate.' },
    tw: { name: 'Taiwan', timezone: 'UTC+8 (TST)', currency: 'TWD', holidayRegion: 'Festività TW', flag: '🇹🇼', shortDesc: 'Borsa di Taiwan — incentrata sui semiconduttori, cultura unica del margin trading.' },
    global: { name: 'Globale', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌍', shortDesc: 'Fattori universali applicabili a tutti i mercati.' },
    cross: { name: 'Cross-Market', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌏', shortDesc: 'Arbitraggio cross-market, FX, co-skewness e fattori multi-mercato.' },
  },

  'de': {
    hk: { name: 'Hongkong', timezone: 'UTC+8 (HKT)', currency: 'HKD', holidayRegion: 'HK Feiertage', flag: '🇭🇰', shortDesc: 'HKEX — 3. größtes Finanzzentrum. Tor für chinesische Kapitalabflüsse.' },
    us: { name: 'US-Märkte', timezone: 'UTC-5/-4 (EST/EDT)', currency: 'USD', holidayRegion: 'US Feiertage', flag: '🇺🇸', shortDesc: 'NYSE + NASDAQ — der tiefste und liquideste Kapitalmarkt der Welt.' },
    crypto: { name: 'Krypto', timezone: '24×7 Immer Offen', currency: 'USDT/BTC/ETH', holidayRegion: 'Nie geschlossen', flag: '🪙', shortDesc: 'Kryptomärkte — 24/7 Handel, höchste Volatilität weltweit.' },
    jp: { name: 'Japan', timezone: 'UTC+9 (JST)', currency: 'JPY', holidayRegion: 'JP Feiertage', flag: '🇯🇵', shortDesc: 'Tokioter Börse — 3. weltweit. BOJ-ETF- und Überkreuzbeteiligungs-Ökosystem.' },
    tw: { name: 'Taiwan', timezone: 'UTC+8 (TST)', currency: 'TWD', holidayRegion: 'TW Feiertage', flag: '🇹🇼', shortDesc: 'Taiwan-Börse — Halbleiter-zentriert, einzigartige Margin-Trading-Kultur.' },
    global: { name: 'Global', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌍', shortDesc: 'Universelle Faktoren, anwendbar auf alle Märkte.' },
    cross: { name: 'Cross-Market', timezone: 'N/A', currency: 'Multi', holidayRegion: 'N/A', flag: '🌏', shortDesc: 'Marktübergreifende Arbitrage, Devisen, Co-Skewness und Multi-Markt-Faktoren.' },
  },
};

/** Get market metadata in the specified language (falls back to zh-CN) */
export function getMarketMeta(market: MarketKey, lang?: string): MarketMeta {
  const locale = MARKET_META_I18N[lang ?? 'zh-CN'] ?? MARKET_META_I18N['zh-CN'];
  return locale[market] ?? locale.global;
}

/** Get all market keys */
export function getAllMarketKeys(): MarketKey[] {
  return ['hk', 'us', 'crypto', 'jp', 'tw', 'global', 'cross'];
}

/** Get market name in the specified language */
export function getMarketName(market: MarketKey, lang?: string): string {
  return getMarketMeta(market, lang).name;
}

export default { MARKET_META_I18N, getMarketMeta, getAllMarketKeys, getMarketName };
