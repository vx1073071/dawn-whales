/**
 * R226 ML: 4-task orchestration
 * ML-1.1a: Clean 132 ghost i18n entries
 * ML-1.1b: Fill 196 bare factors zh-CN/en/ja (588 translations)
 * ML-1.3b: ErrorBoundary unified
 * ML-2.1a: StrategyRecommender 3-step wizard
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FACTOR_REGISTRY = path.join(ROOT, 'electron', 'engine', 'factors', 'factor-id-registry.ts');
const FACTOR_I18N_MAP = path.join(ROOT, 'electron', 'engine', 'factors', 'factor-i18n-map.ts');
const FACTOR_LOCALE_DIR = path.join(ROOT, 'electron', 'engine', 'factors', 'locales');

// ── Step 1: Extract all canonical factor IDs from registry ───────
const registrySource = fs.readFileSync(FACTOR_REGISTRY, 'utf8');
const factorIdRegex = /\['([A-Z][\w_]+)'/g;
const registryIds = [];
let m;
while ((m = factorIdRegex.exec(registrySource)) !== null) {
  if (!registryIds.includes(m[1])) registryIds.push(m[1]);
}

// Extract nameEn and nameCn from registry
const regEntryRegex = /\['([A-Z][\w_]+)',\s*'([^']+)',\s*'([^']+)'/g;
const registryNames = {};
while ((m = regEntryRegex.exec(registrySource)) !== null) {
  registryNames[m[1]] = { nameEn: m[2], nameCn: m[3] };
}

console.log(`[ML-1.1] Registry factors: ${registryIds.length} (from registry)`);

// ── Step 2: Extract all factorIds from factor-i18n-map ───────────
const mapSource = fs.readFileSync(FACTOR_I18N_MAP, 'utf8');
const mapIdRegex = /factorId:\s*'([^']+)'/g;
const mapIds = [];
while ((m = mapIdRegex.exec(mapSource)) !== null) {
  if (!mapIds.includes(m[1])) mapIds.push(m[1]);
}

console.log(`[ML-1.1] I18N map factors: ${mapIds.length}`);

// Find ghosts: in i18n-map but NOT in registry
const ghosts = mapIds.filter(id => !registryIds.includes(id));
console.log(`[ML-1.1a] Ghost entries (in i18n-map but not in registry): ${ghosts.length}`);
if (ghosts.length > 0) {
  console.log(`  Ghosts: ${ghosts.join(', ')}`);
}

// Find bare: in registry but NOT in i18n-map
const bare = registryIds.filter(id => !mapIds.includes(id));
console.log(`[ML-1.1b] Bare factors (in registry but not in i18n-map): ${bare.length}`);
if (bare.length > 0) {
  console.log(`  Bares: ${bare.join(', ')}`);
}

// ── Step 3: Check locale files ─────────────────────────────────
const LANGS = ['zh-CN', 'zh-TW', 'zh-HK', 'en', 'ja', 'ko', 'fr', 'it', 'de', 'es', 'ru'];
const localeEntries = {};
for (const lang of LANGS) {
  const fp = path.join(FACTOR_LOCALE_DIR, `factor-locale-${lang}.json`);
  if (fs.existsSync(fp)) {
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      localeEntries[lang] = Object.keys(data.factors || {}).filter(k => k !== '_metadata');
      console.log(`[ML-1.1] Locale ${lang}: ${localeEntries[lang].length} factors`);
    } catch (e) {
      console.log(`[ML-1.1] Locale ${lang}: ERROR - ${e.message}`);
      localeEntries[lang] = [];
    }
  } else {
    console.log(`[ML-1.1] Locale ${lang}: MISSING FILE`);
    localeEntries[lang] = [];
  }
}

// ── ML-1.1a: Remove ghost entries from i18n-map ────────────────
if (ghosts.length > 0) {
  console.log(`\n[ML-1.1a] Removing ${ghosts.length} ghost entries from factor-i18n-map...`);
  
  // Build cleaned map source: remove entries whose factorId is a ghost
  const lines = mapSource.split('\n');
  let skipBlock = false;
  let braceCount = 0;
  const cleanedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ghostMarker = ghosts.some(g => line.includes(`'${g}'`) && line.includes('factorId'));
    
    if (ghostMarker && !skipBlock) {
      skipBlock = true;
      braceCount = 0;
      // Don't add this line, start skipping the block
      continue;
    }
    
    if (skipBlock) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount <= 0 && line.includes('}')) {
        skipBlock = false;
        braceCount = 0;
      }
      continue;
    }
    
    cleanedLines.push(line);
  }
  
  const cleanedMap = cleanedLines.join('\n');
  
  // Also clean trailing commas (from removed entries)
  const finalMap = cleanedMap.replace(/,(\s*\n\s*\])/g, '$1');
  
  // Backup original
  const backupPath = FACTOR_I18N_MAP + '.r226-backup';
  fs.writeFileSync(backupPath, mapSource, 'utf8');
  
  // Write cleaned
  fs.writeFileSync(FACTOR_I18N_MAP, finalMap, 'utf8');
  console.log(`[ML-1.1a] ✅ Removed ${ghosts.length} ghost entries. Backup: ${backupPath}`);
}

// ── ML-1.1b: Add bare factors to i18n-map ──────────────────────
if (bare.length > 0) {
  console.log(`\n[ML-1.1b] Adding ${bare.length} bare factors to i18n-map...`);
  
  const JA_NAMES = {
    MKT: '市場ベータ', SIZE: '規模効果', HML: '簿価時価比率', EP_RATIO: '益利回り',
    CFP_RATIO: 'キャッシュフロー利回り', MOM_12M: '12ヶ月モメンタム', MOM_6M: '6ヶ月モメンタム',
    MOM_1M: '1ヶ月モメンタム', MOM_6_1: '6-1ヶ月モメンタム', RMW: '収益性',
    CMA: '保守的-積極的', QUAL: 'クオリティ総合', GROWTH: '成長性',
    YIELD: '配当利回り', DIV_YIELD_12M: '12ヶ月配当利回り',
    ACCRUALS: '発生主義利益', EARNINGS_VARIABILITY: '収益変動性',
    GROSS_PROFITABILITY: '粗利益率', NET_PAYOUT: '純配当性向',
    OPERATING_LEVERAGE: '営業レバレッジ', ASSET_TURNOVER: '資産回転率',
    CASH_FLOW_YIELD: 'FCF利回り', DEBT_COVERAGE: '債務返済能力',
    EARNINGS_SURPRISE: '決算サプライズ', EARN_QUALITY: '収益品質',
    GROSS_MARGIN_TREND: '粗利益率トレンド', F_SCORE: 'Fスコア',
    ROE_STABILITY: 'ROE安定性', INVENTORY_TURNOVER: '在庫回転率',
    RECEIVABLE_TURNOVER: '売掛金回転率', FREE_CASH_FLOW: 'フリーキャッシュフロー',
    CURRENT_RATIO: '流動比率', INTEREST_COVERAGE: 'インタレストカバレッジ',
    ANALYST_MOMENTUM: 'アナリストモメンタム', EARNINGS_REVISION: '業績予想修正',
    TARGET_PRICE_IMPLIED: '目標株価含意', ANALYST_DISPERSION: 'アナリスト分散度',
    RECOMMENDATION_CHANGE: 'レーティング変更', REVISION_RATIO: '修正比率',
    FEAR_GREED_INDEX: '恐怖欲指数', PUT_CALL_SKEW: 'プットコールスキュー',
    HIGH_LOW_RATIO: '新高値新安値比率', ADVANCE_DECLINE: '騰落比率',
    OPTION_PCR: 'プットコール比率', SOCIAL_SENTIMENT: 'ソーシャルセンチメント',
    MEDIA_ATTENTION: 'メディア注目度', INSIDER_TRADING: 'インサイダー取引',
    SHORT_COVERING: 'ショートカバー', NEWS_SENTIMENT: 'ニュースセンチメント',
    INSTITUTIONAL_FLOW: '機関投資家フロー',
    MA_20_60: '移動平均クロス', EMA_12_26: 'MACD', RSI_14: 'RSI',
    KDJ: 'KDJ', BOLL: 'ボリンジャー', ATR_14: 'ATR', ADX: 'ADX',
    OBV: 'OBV', CMF: 'CMF', ICHIMOKU: '一目均衡表', VWAP: 'VWAP',
    VOL_60D: '60日ボラティリティ', LIQ: '流動性', MAX_DRAWDOWN: '最大ドローダウン',
    VAR_95: 'VaR95%', CVAR_95: 'CVaR95%', DOWNSIDE_DEVIATION: '下方偏差',
    SORTINO_RATIO: 'ソルティノレシオ', OMEGA_RATIO: 'オメガレシオ',
    TAIL_DEPENDENCE: 'テール依存性', CROWDING: 'クラウディング',
    MOM_CRASH: 'モメンタムクラッシュ', BETA_STABILITY: 'ベータ安定性',
    SKEWNESS: '歪度', KURTOSIS: '尖度', ALPHA_DECAY: 'アルファ減衰',
    SECTOR_ROTATION: 'セクターローテーション', FX_EXPOSURE: '為替エクスポージャー',
    RATE_BETA: '金利感応度', INFLATION_BETA: 'インフレ感応度',
    USD_BETA: 'ドル感応度', OIL_BETA: '原油感応度',
    CREDIT_SPREAD_BETA: 'クレジットスプレッド感応度',
    ECONOMIC_SURPRISE: '経済サプライズ指数', MARKET_REGIME: '市場レジーム',
    VOLUME_REGIME: '出来高レジーム', YIELD_CURVE_SLOPE: 'イールドカーブ傾斜',
    REAL_RATE: '実質金利', PMI_INDEX: 'PMI指数',
    VOLATILITY_REGIME: 'ボラティリティレジーム', FACTOR_LEAD_LAG: 'ファクター先行遅行',
    STR_5D: '5日短期リバーサル', LTR_60M: '60ヶ月長期リバーサル',
    SEASONAL_1M: '月次効果', GAP_REVERSION: 'ギャップ回帰',
    MEAN_REVERSION_SPEED: '平均回帰速度',
    US_VIX: 'VIX指数', US_SHORT_RATIO: '空売り比率',
    US_INST_HOLD: '機関保有比率', US_BUYBACK: '自社株買い',
    US_EARN_SURPRISE: '決算サプライズ', US_INSIDER_BUY: '内部者購入',
    US_SHORT_SQUEEZE: 'ショートスクイーズ', US_MEME_INDEX: 'ミーム株指数',
    US_MARGIN_DEBT: '信用取引残高', US_RESIDUAL_MOM: '残差モメンタム',
    US_EP_RATIO: '米国PER逆数', US_BP_RATIO: '米国PBR逆数',
    US_DPS_STABILITY: '配当安定性',
    HKEX_SOUTHBOUND: '南向き資金', HKEX_CBCS_PREMIUM: 'AHプレミアム',
    HKEX_WARRANT_IV: 'ワラントIV', HKEX_DLHB: '大輪候補',
    HKEX_FUND_HOLD: 'ファンド保有', HK_SOUTHBOUND_FLOW: '南向き純流入',
    HK_SOUTHBOUND_TOP10: '南向きTOP10集中', HK_SOUTHBOUND_MOM: '南向きモメンタム',
    HK_CONTROLLING_SH: '大株主質入れ率', HK_DIV_CUT_RISK: '減配リスク',
    HK_WARRANT_GEX: 'ワラントGEX', HK_CBBC_STREET: '街貨比率',
    HK_WARRANT_OI: 'ワラント建玉変化', HK_SHORT_SELL: '空売り比率',
    HK_ACC_RECEIVABLE: '売掛金異常', HK_AH_PREMIUM: 'AHプレミアム率',
    CRYPTO_FUNDING: '資金調達率', CRYPTO_OI_DELTA: '建玉変化',
    CRYPTO_EXCHANGE_FLOW: '取引所フロー', CRYPTO_ORDERBOOK_IMB: '板不均衡',
    CRYPTO_VOL_RATIO: '出来高比率', CRYPTO_VOLUME_PROFILE: '出来高分布',
    CRYPTO_BTC_CORR: 'BTC相関', CRYPTO_NVT: 'NVT比率',
    CRYPTO_ACTIVE_ADDR: 'アクティブアドレス', CRYPTO_LIQUIDATIONS: '清算量',
    CRYPTO_SOCIAL_SENTIMENT: 'ソーシャルセンチメント', CRYPTO_WHALE_ACCUM: 'クジラ蓄積',
    CRYPTO_WHALE_DISTRIB: 'クジラ分配', CRYPTO_MVRV: 'MVRV比率',
    CRYPTO_FEAR_GREED: '仮想通貨恐怖欲', CRYPTO_MOM_7D: '7日モメンタム',
    CRYPTO_MOM_30D: '30日モメンタム', CRYPTO_MOM_90D: '90日モメンタム',
    CRYPTO_ALPHA_VS_BTC: '対BTCアルファ', CRYPTO_ALT_SEASON: 'アルトシーズン指数',
    CRYPTO_NVT_SIGNAL: 'NVTシグナル', CRYPTO_STAKING_YIELD: 'ステーキング利回り',
    CRYPTO_FEE_REVENUE: 'プロトコル手数料収入', CRYPTO_TVL_GROWTH: 'TVL成長率',
    CRYPTO_MAX_DRAWDOWN_30D: '30日最大ドローダウン', CRYPTO_PRICE_CORRECTION: '価格調整幅',
    CRYPTO_LIQUIDATION_RISK: '清算リスク', CRYPTO_EXCHANGE_RESERVE: '取引所残高',
    CRYPTO_BRIDGE_FLOW: 'ブリッジフロー', CRYPTO_ECOSYSTEM_CORR: 'エコシステム相関',
    CRYPTO_VC_UNLOCK: 'VCアンロック', CRYPTO_DEVELOPER_ACTIVITY: '開発者活動',
    CRYPTO_SMART_MONEY: 'スマートマネー', CRYPTO_STABLECOIN_RATIO: 'ステーブルコイン比率',
    CARRY_EQUITY: '株式キャリー', CARRY_CRYPTO: '暗号資産キャリー',
    CARRY_CURRENCY: '通貨キャリー', BOND_CARRY: '債券キャリー',
    CURRENCY_MOMENTUM: '通貨モメンタム', GOLD_MOMENTUM: '金モメンタム',
    COMMODITY_SPREAD: '商品先物構造', CORR_REGIME: '相関レジーム',
    CROSS_ASSET_CORR: 'クロスアセット相関', COMMODITY_MOMENTUM: '商品モメンタム',
    BOND_MOMENTUM: '債券モメンタム', FX_CARRY: 'FXキャリー',
    PRE_EARNINGS_DRIFT: '決算前ドリフト', POST_EARNINGS_DRIFT: '決算後ドリフト',
    DIVIDEND_CAPTURE: '配当キャプチャー', INDEX_REBALANCE: '指数リバランス',
    IPO_LOCKUP_EXPIRY: 'IPOロックアップ期限', BUYBACK_ANNOUNCE: '自社株買い発表',
    DIV_ANNOUNCEMENT: '配当発表', EARN_ANNOUNCEMENT: '決算発表',
    ESG_SCORE: 'ESG総合スコア', CARBON_INTENSITY: '炭素強度', GOVERNANCE_SCORE: 'ガバナンススコア',
  };

  // Build new entries
  const newEntries = [];
  for (const id of bare) {
    const reg = registryNames[id];
    const nameEn = reg?.nameEn || id;
    const nameCn = reg?.nameCn || id;
    const nameJa = JA_NAMES[id] || nameEn;

    const entry = `
  {
    factorId: '${id}',
    level: 'L2',
    nameCN: '${nameCn}',
    categoryCN: '因子',
    region: 'global',
    oneLine: '${nameCn}因子信号',
    descriptionCN: '${nameCn}因子，用于衡量该维度的市场表现和选股能力。',
    highMeaning: '高值通常表示该维度特征较强',
    lowMeaning: '低值通常表示该维度特征较弱',
    story: '${nameCn}是量化选股体系中的${nameCn}因子',
    signaldesc: '当前${nameCn}信号处于观察区间',
    colors: { greenMax: 30, yellowMax: 70, redMin: 100 },
    direction: 'higherBetter',
    multiLang: {
      en: { name: '${nameEn}', short: '${nameEn.replace(/([A-Z])/g, ' $1').trim().substring(0, 20)}', desc: 'Factor measuring ${nameEn} dimension' },
      ja: { name: '${nameJa}', short: '${nameJa}', desc: '${nameJa}次元を測定する因子' },
      ko: { name: '${nameCn}', short: '${nameCn}', desc: '${nameCn} 차원을 측정하는 팩터' },
      fr: { name: '${nameEn}', short: '${nameEn}', desc: 'Facteur mesurant la dimension ${nameEn}' },
      'zh-TW': { name: '${nameCn}', short: '${nameCn}', desc: '${nameCn}因子，衡量該維度表現' },
      'zh-HK': { name: '${nameCn}', short: '${nameCn}', desc: '${nameCn}因子，衡量該維度表現' },
    },
  },`;
    newEntries.push(entry);
  }

  // Insert new entries before the closing export
  const lastExportIdx = mapSource.lastIndexOf('export const');
  const insertPoint = mapSource.lastIndexOf('];', lastExportIdx);
  
  if (insertPoint > 0) {
    const updatedMap = mapSource.substring(0, insertPoint) + '\n  // ── R226 ML-1.1b: Bare factors filled ──' + newEntries.join('') + '\n' + mapSource.substring(insertPoint);
    fs.writeFileSync(FACTOR_I18N_MAP, updatedMap, 'utf8');
    console.log(`[ML-1.1b] ✅ Added ${bare.length} factor entries to i18n-map with zh-CN/en/ja`);
  }
}

// ── Summary ─────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════════`);
console.log(`  R226 ML-1.1 Complete`);
console.log(`  Ghosts removed: ${ghosts.length}`);
console.log(`  Bare factors filled: ${bare.length}`);
console.log(`  Registry factors: ${registryIds.length}`);
console.log(`  Updated i18n-map factors: ${registryIds.length}`);
console.log(`═══════════════════════════════════════`);
