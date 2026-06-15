// ── R198 A2: 4 Commodity Family i18n ─────────────────────────────────────
// Precious Metals / Energy / Industrial Metals / Agriculture
// in 8 languages. Used by CommodityOnboarding and CommodityFactorCard.

export type CommodityFamily = 'precious_metals' | 'energy' | 'industrial_metals' | 'agriculture';

export interface CommodityFamilyMeta {
  name: string;
  color: string;        // Hex color for UI
  icon: string;         // Emoji
  members: string;      // Key commodities in this family
  drivers: string;      // Main price drivers
  signalTip: string;   // "How to read the signal" in plain language
}

export const COMMODITY_FAMILY_I18N: Record<string, Record<CommodityFamily, CommodityFamilyMeta>> = {
  'zh-CN': {
    precious_metals: { name: '贵金属', color: '#F5A623', icon: '🥇', members: '黄金·白银·铂金·钯金', drivers: '实际利率·美元·央行购金·避险情绪', signalTip: '信号>60=黄金需求旺季；信号<30=夏季低迷。配合美元走势一起看。' },
    energy: { name: '能源', color: '#E74C3C', icon: '🛢️', members: 'WTI原油·布伦特·天然气·汽油·取暖油', drivers: 'OPEC+·EIA库存·地缘政治·天气(HDD/CDD)', signalTip: '每周三EIA库存是关键——库存降超预期=做多信号。天然气的\"冬天故事\"最动人。' },
    industrial_metals: { name: '工业金属', color: '#F39C12', icon: '🔩', members: '铜·铝·锌·镍·铁矿石·热轧卷板', drivers: '全球PMI·中国房地产·新能源·LME库存', signalTip: '\"铜博士\"领先PMI 1-2个月——库存降+注销多=经济在加速。别和\"铁矿石=中国\"脱钩。' },
    agriculture: { name: '农产品', color: '#27AE60', icon: '🌾', members: '大豆·玉米·小麦·棉花·糖·咖啡·可可·活牛', drivers: '天气(降水/温度)·USDA报告·种植面积·生物燃料', signalTip: '季节性最强——\"谷雨前后种瓜点豆\"量化版。6月大豆/12月棉花是经典。关注厄尔尼诺。' },
  },
  'zh-TW': {
    precious_metals: { name: '貴金屬', color: '#F5A623', icon: '🥇', members: '黃金·白銀·鉑金·鈀金', drivers: '實質利率·美元·央行購金·避險情緒', signalTip: '信號>60=黃金需求旺季；信號<30=夏季低迷。配合美元走勢一起看。' },
    energy: { name: '能源', color: '#E74C3C', icon: '🛢️', members: 'WTI原油·布蘭特·天然氣·汽油·熱燃油', drivers: 'OPEC+·EIA庫存·地緣政治·天氣(HDD/CDD)', signalTip: '每週三EIA庫存是關鍵——庫存降超預期=做多信號。天然氣的冬天故事最動人。' },
    industrial_metals: { name: '工業金屬', color: '#F39C12', icon: '🔩', members: '銅·鋁·鋅·鎳·鐵礦石·熱軋鋼捲', drivers: '全球PMI·中國房地產·新能源·LME庫存', signalTip: '銅博士領先PMI 1-2個月——庫存降+註銷多=經濟在加速。別和鐵礦石=中國脫鉤。' },
    agriculture: { name: '農產品', color: '#27AE60', icon: '🌾', members: '大豆·玉米·小麥·棉花·糖·咖啡·可可·活牛', drivers: '天氣(降水/溫度)·USDA報告·種植面積·生質燃料', signalTip: '季節性最強——穀雨前後種瓜點豆量化版。6月大豆/12月棉花是經典。關注聖嬰現象。' },
  },
  'en': {
    precious_metals: { name: 'Precious Metals', color: '#F5A623', icon: '🥇', members: 'Gold·Silver·Platinum·Palladium', drivers: 'Real Rates·USD·Central Bank Buying·Safe Haven', signalTip: 'Signal >60 = seasonally strong. Track real yields (TIPS) — gold\'s #1 driver.' },
    energy: { name: 'Energy', color: '#E74C3C', icon: '🛢️', members: 'WTI·Brent·Natural Gas·Gasoline·Heating Oil', drivers: 'OPEC+·EIA Inventories·Geopolitics·Weather(HDD/CDD)', signalTip: 'Wednesday EIA report is the weekly event. Inventory draw > 2σ = strong buy signal.' },
    industrial_metals: { name: 'Industrial Metals', color: '#F39C12', icon: '🔩', members: 'Copper·Aluminum·Zinc·Nickel·Iron Ore·HRC Steel', drivers: 'Global PMI·China Property·Green Energy·LME Inventories', signalTip: '"Dr. Copper" leads PMI by 1-2 months. Watch cancelled warrants — they signal real demand.' },
    agriculture: { name: 'Agriculture', color: '#27AE60', icon: '🌾', members: 'Soybeans·Corn·Wheat·Cotton·Sugar·Coffee·Cocoa·Live Cattle', drivers: 'Weather·USDA Reports·Acreage·Biofuels', signalTip: 'Seasonality is king — June soybeans, December cotton. El Niño/La Niña watch essential.' },
  },
  'ja': {
    precious_metals: { name: '貴金属', color: '#F5A623', icon: '🥇', members: '金·銀·プラチナ·パラジウム', drivers: '実質金利·米ドル·中央銀行購入·安全資産', signalTip: 'シグナル>60=需要期。実質金利(TIPS)を追跡——金の第1要因。' },
    energy: { name: 'エネルギー', color: '#E74C3C', icon: '🛢️', members: 'WTI·ブレント·天然ガス·ガソリン·灯油', drivers: 'OPEC+·EIA在庫·地政学·天候(HDD/CDD)', signalTip: '水曜EIAレポートが週次イベント。在庫減>2σ=強い買いシグナル。' },
    industrial_metals: { name: '工業用金属', color: '#F39C12', icon: '🔩', members: '銅·アルミ·亜鉛·ニッケル·鉄鉱石·熱延鋼板', drivers: '世界PMI·中国不動産·グリーンエネルギー·LME在庫', signalTip: '銅博士はPMIを1-2ヶ月先行。キャンセルワラント=実需シグナル。' },
    agriculture: { name: '農産物', color: '#27AE60', icon: '🌾', members: '大豆·トウモロコシ·小麦·綿花·砂糖·コーヒー·ココア·生牛', drivers: '天候·USDA報告·作付面積·バイオ燃料', signalTip: '季節性が最強——6月大豆、12月綿花が定番。エルニーニョ/ラニーニャ監視必須。' },
  },
  'ko': {
    precious_metals: { name: '귀금속', color: '#F5A623', icon: '🥇', members: '금·은·백금·팔라듐', drivers: '실질금리·달러·중앙은행 매입·안전자산', signalTip: '신호>60=수요 성수기. TIPS 실질금리를 추적하세요.' },
    energy: { name: '에너지', color: '#E74C3C', icon: '🛢️', members: 'WTI·브렌트·천연가스·휘발유·난방유', drivers: 'OPEC+·EIA 재고·지정학·날씨', signalTip: '수요일 EIA 보고서가 주간 이벤트. 재고 감소>2σ=강력 매수 신호.' },
    industrial_metals: { name: '산업금속', color: '#F39C12', icon: '🔩', members: '구리·알루미늄·아연·니켈·철광석·열연강판', drivers: '글로벌 PMI·중국 부동산·녹색에너지·LME 재고', signalTip: '구리 박사는 PMI를 1-2개월 선행. 취소된 창고증권=실수요 신호.' },
    agriculture: { name: '농산물', color: '#27AE60', icon: '🌾', members: '대두·옥수수·밀·면화·설탕·커피·코코아·생우', drivers: '날씨·USDA 보고서·재배면적·바이오연료', signalTip: '계절성이 최강——6월 대두, 12월 면화. 엘니뇨/라니냐 감시 필수.' },
  },
  'fr': {
    precious_metals: { name: 'Métaux Précieux', color: '#F5A623', icon: '🥇', members: 'Or·Argent·Platine·Palladium', drivers: 'Taux Réels·USD·Achats Banques Centrales·Valeur Refuge', signalTip: 'Signal >60 = saison forte. Suivez les taux réels (TIPS).' },
    energy: { name: 'Énergie', color: '#E74C3C', icon: '🛢️', members: 'WTI·Brent·Gaz Naturel·Essence·Fioul', drivers: 'OPEC+·Stocks EIA·Géopolitique·Météo', signalTip: 'Rapport EIA mercredi = événement hebdo. Baisse stocks > 2σ = signal achat fort.' },
    industrial_metals: { name: 'Métaux Industriels', color: '#F39C12', icon: '🔩', members: 'Cuivre·Aluminium·Zinc·Nickel·Minerai de Fer·Acier', drivers: 'PMI Mondial·Immobilier Chine·Énergie Verte·Stocks LME', signalTip: 'Le cuivre anticipe le PMI de 1-2 mois. Warrants annulés = demande réelle.' },
    agriculture: { name: 'Agriculture', color: '#27AE60', icon: '🌾', members: 'Soja·Maïs·Blé·Coton·Sucre·Café·Cacao·Bovins', drivers: 'Météo·Rapports USDA·Surfaces·Biocarburants', signalTip: 'Saisonnalité maximale — soja en juin, coton en décembre. Surveiller El Niño.' },
  },
  'it': {
    precious_metals: { name: 'Metalli Preziosi', color: '#F5A623', icon: '🥇', members: 'Oro·Argento·Platino·Palladio', drivers: 'Tassi Reali·USD·Acquisti BC·Rifugio Sicuro', signalTip: 'Segnale >60 = stagione forte. Traccia i tassi reali (TIPS).' },
    energy: { name: 'Energia', color: '#E74C3C', icon: '🛢️', members: 'WTI·Brent·Gas Naturale·Benzina·Gasolio', drivers: 'OPEC+·Scorte EIA·Geopolitica·Meteo', signalTip: 'Rapporto EIA mercoledì = evento settimanale. Calo scorte > 2σ = forte buy.' },
    industrial_metals: { name: 'Metalli Industriali', color: '#F39C12', icon: '🔩', members: 'Rame·Alluminio·Zinco·Nichel·Ferro·Acciaio', drivers: 'PMI Globale·Immobiliare Cina·Energia Verde·Scorte LME', signalTip: 'Il rame anticipa il PMI di 1-2 mesi. Warrant cancellati = domanda reale.' },
    agriculture: { name: 'Agricoltura', color: '#27AE60', icon: '🌾', members: 'Soia·Mais·Grano·Cotone·Zucchero·Caffè·Cacao·Bovini', drivers: 'Meteo·Rapporti USDA·Superfici·Biocarburanti', signalTip: 'Stagionalità massima — soia a giugno, cotone a dicembre. Monitorare El Niño.' },
  },
  'de': {
    precious_metals: { name: 'Edelmetalle', color: '#F5A623', icon: '🥇', members: 'Gold·Silber·Platin·Palladium', drivers: 'Realzinsen·USD·Zentralbankkäufe·Sicherer Hafen', signalTip: 'Signal >60 = starke Saison. Realzinsen (TIPS) verfolgen.' },
    energy: { name: 'Energie', color: '#E74C3C', icon: '🛢️', members: 'WTI·Brent·Erdgas·Benzin·Heizöl', drivers: 'OPEC+·EIA-Lager·Geopolitik·Wetter', signalTip: 'Mittwoch EIA-Bericht = Wochenereignis. Lagerabbau > 2σ = starkes Kaufsignal.' },
    industrial_metals: { name: 'Industriemetalle', color: '#F39C12', icon: '🔩', members: 'Kupfer·Aluminium·Zink·Nickel·Eisenerz·Stahl', drivers: 'Globaler PMI·China Immobilien·Grüne Energie·LME-Lager', signalTip: 'Kupfer eilt PMI 1-2 Monate voraus. Stornierte Lagerscheine = reale Nachfrage.' },
    agriculture: { name: 'Landwirtschaft', color: '#27AE60', icon: '🌾', members: 'Soja·Mais·Weizen·Baumwolle·Zucker·Kaffee·Kakao·Rinder', drivers: 'Wetter·USDA-Berichte·Anbaufläche·Biokraftstoffe', signalTip: 'Saisonalität maximal — Soja im Juni, Baumwolle im Dezember. El Niño beobachten.' },
  },
};

export function getCommodityFamily(family: CommodityFamily, lang?: string): CommodityFamilyMeta {
  const locale = COMMODITY_FAMILY_I18N[lang ?? 'zh-CN'] ?? COMMODITY_FAMILY_I18N['zh-CN'];
  return locale[family];
}

export function getAllCommodityFamilies(): CommodityFamily[] {
  return ['precious_metals', 'energy', 'industrial_metals', 'agriculture'];
}

export default { COMMODITY_FAMILY_I18N, getCommodityFamily, getAllCommodityFamilies };
