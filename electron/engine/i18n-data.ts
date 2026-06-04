// ── i18n Data Layer (JVS-40) ──────────────────────────────────────────────
// Master Directive: Multi-language support for all EM data fields
// Covers: macro indicators, industry names, sentiment labels, anomaly types
// Languages: zh-CN, zh-TW, en, ja, ko, fr, it, de

import { ipcMain } from 'electron';

// ── Types ──────────────────────────────────────────────────────────────────

export type SupportedLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'it' | 'de';

export interface TranslationMap {
  [key: string]: {
    [lang in SupportedLanguage]: string;
  };
}

// ── Macro Indicators Translation ───────────────────────────────────────────

export const MACRO_INDICATORS: TranslationMap = {
  'GDP': {
    'zh-CN': '国内生产总值',
    'zh-TW': '國內生產總值',
    'en': 'Gross Domestic Product',
    'ja': '国内総生産',
    'ko': '국내총생산',
    'fr': 'Produit Intérieur Brut',
    'it': 'Prodotto Interno Lordo',
    'de': 'Bruttoinlandsprodukt',
  },
  'CPI': {
    'zh-CN': '居民消费价格指数',
    'zh-TW': '居民消費價格指數',
    'en': 'Consumer Price Index',
    'ja': '消費者物価指数',
    'ko': '소비자물가지수',
    'fr': 'Indice des Prix à la Consommation',
    'it': 'Indice dei Prezzi al Consumo',
    'de': 'Verbraucherpreisindex',
  },
  'PPI': {
    'zh-CN': '工业生产者出厂价格指数',
    'zh-TW': '工業生產者出廠價格指數',
    'en': 'Producer Price Index',
    'ja': '生産者物価指数',
    'ko': '생산자물가지수',
    'fr': 'Indice des Prix à la Production',
    'it': 'Indice dei Prezzi alla Produzione',
    'de': 'Erzeugerpreisindex',
  },
  'PMI': {
    'zh-CN': '采购经理指数',
    'zh-TW': '採購經理指數',
    'en': 'Purchasing Managers Index',
    'ja': '購買担当者指数',
    'ko': '구매관리자지수',
    'fr': 'Indice des Directeurs d\'Achat',
    'it': 'Indice dei Direttori degli Acquisti',
    'de': 'Einkaufsmanagerindex',
  },
  'M2': {
    'zh-CN': '广义货币供应量',
    'zh-TW': '廣義貨幣供應量',
    'en': 'Broad Money Supply',
    'ja': '広義通貨供給量',
    'ko': '광의통화공급량',
    'fr': 'Masse Monétaire',
    'it': 'Massa Monetaria',
    'de': 'Geldmenge M2',
  },
  'LPR': {
    'zh-CN': '贷款市场报价利率',
    'zh-TW': '貸款市場報價利率',
    'en': 'Loan Prime Rate',
    'ja': 'ローンプライムレート',
    'ko': '대출우대금리',
    'fr': 'Taux Préférentiel de Prêt',
    'it': 'Tasso Prime sui Prestiti',
    'de': 'Leitzins für Kredite',
  },
  '失业率': {
    'zh-CN': '失业率',
    'zh-TW': '失業率',
    'en': 'Unemployment Rate',
    'ja': '失業率',
    'ko': '실업률',
    'fr': 'Taux de Chômage',
    'it': 'Tasso di Disoccupazione',
    'de': 'Arbeitslosenquote',
  },
  '工业增加值': {
    'zh-CN': '工业增加值',
    'zh-TW': '工業增加值',
    'en': 'Industrial Value Added',
    'ja': '工業付加価値',
    'ko': '공업부가가치',
    'fr': 'Valeur Ajoutée Industrielle',
    'it': 'Valore Aggiunto Industriale',
    'de': 'Industrielle Wertschöpfung',
  },
};

// ── Industry Names Translation ─────────────────────────────────────────────

export const INDUSTRY_NAMES: TranslationMap = {
  '银行': {
    'zh-CN': '银行',
    'zh-TW': '銀行',
    'en': 'Banking',
    'ja': '銀行',
    'ko': '은행',
    'fr': 'Banque',
    'it': 'Banca',
    'de': 'Bankwesen',
  },
  '房地产': {
    'zh-CN': '房地产',
    'zh-TW': '房地產',
    'en': 'Real Estate',
    'ja': '不動産',
    'ko': '부동산',
    'fr': 'Immobilier',
    'it': 'Immobiliare',
    'de': 'Immobilien',
  },
  '食品饮料': {
    'zh-CN': '食品饮料',
    'zh-TW': '食品飲料',
    'en': 'Food & Beverage',
    'ja': '食品・飲料',
    'ko': '식품음료',
    'fr': 'Alimentation et Boissons',
    'it': 'Alimenti e Bevande',
    'de': 'Lebensmittel und Getränke',
  },
  '医药生物': {
    'zh-CN': '医药生物',
    'zh-TW': '醫藥生物',
    'en': 'Pharmaceutical & Biotech',
    'ja': '医薬品・バイオ',
    'ko': '의약생물',
    'fr': 'Pharmaceutique et Biotechnologie',
    'it': 'Farmaceutico e Biotecnologie',
    'de': 'Pharma und Biotechnologie',
  },
  '电子': {
    'zh-CN': '电子',
    'zh-TW': '電子',
    'en': 'Electronics',
    'ja': '電子',
    'ko': '전자',
    'fr': 'Électronique',
    'it': 'Elettronica',
    'de': 'Elektronik',
  },
  '计算机': {
    'zh-CN': '计算机',
    'zh-TW': '計算機',
    'en': 'Computer',
    'ja': 'コンピュータ',
    'ko': '컴퓨터',
    'fr': 'Informatique',
    'it': 'Informatica',
    'de': 'Computer',
  },
  '通信': {
    'zh-CN': '通信',
    'zh-TW': '通信',
    'en': 'Telecommunications',
    'ja': '通信',
    'ko': '통신',
    'fr': 'Télécommunications',
    'it': 'Telecomunicazioni',
    'de': 'Telekommunikation',
  },
  '汽车': {
    'zh-CN': '汽车',
    'zh-TW': '汽車',
    'en': 'Automotive',
    'ja': '自動車',
    'ko': '자동차',
    'fr': 'Automobile',
    'it': 'Automobili',
    'de': 'Automobil',
  },
};

// ── Sentiment Labels Translation ───────────────────────────────────────────

export const SENTIMENT_LABELS: TranslationMap = {
  '极度贪婪': {
    'zh-CN': '极度贪婪',
    'zh-TW': '極度貪婪',
    'en': 'Extreme Greed',
    'ja': '極度の強欲',
    'ko': '극단적 탐욕',
    'fr': 'Avidité Extrême',
    'it': 'Avidità Estrema',
    'de': 'Extreme Gier',
  },
  '贪婪': {
    'zh-CN': '贪婪',
    'zh-TW': '貪婪',
    'en': 'Greed',
    'ja': '強欲',
    'ko': '탐욕',
    'fr': 'Avidité',
    'it': 'Avidità',
    'de': 'Gier',
  },
  '中性': {
    'zh-CN': '中性',
    'zh-TW': '中性',
    'en': 'Neutral',
    'ja': '中立',
    'ko': '중립',
    'fr': 'Neutre',
    'it': 'Neutro',
    'de': 'Neutral',
  },
  '恐惧': {
    'zh-CN': '恐惧',
    'zh-TW': '恐懼',
    'en': 'Fear',
    'ja': '恐怖',
    'ko': '공포',
    'fr': 'Peur',
    'it': 'Paura',
    'de': 'Angst',
  },
  '极度恐惧': {
    'zh-CN': '极度恐惧',
    'zh-TW': '極度恐懼',
    'en': 'Extreme Fear',
    'ja': '極度の恐怖',
    'ko': '극단적 공포',
    'fr': 'Peur Extrême',
    'it': 'Paura Estrema',
    'de': 'Extreme Angst',
  },
  '看涨': {
    'zh-CN': '看涨',
    'zh-TW': '看漲',
    'en': 'Bullish',
    'ja': '強気',
    'ko': '강세',
    'fr': 'Haussier',
    'it': 'Rialzista',
    'de': 'Bullisch',
  },
  '看跌': {
    'zh-CN': '看跌',
    'zh-TW': '看跌',
    'en': 'Bearish',
    'ja': '弱気',
    'ko': '약세',
    'fr': 'Baissier',
    'it': 'Ribassista',
    'de': 'Bärisch',
  },
};

// ── Anomaly Types Translation ──────────────────────────────────────────────

export const ANOMALY_TYPES: TranslationMap = {
  'price_spike': {
    'zh-CN': '价格飙升',
    'zh-TW': '價格飆升',
    'en': 'Price Spike',
    'ja': '価格急騰',
    'ko': '가격급등',
    'fr': 'Flambée des Prix',
    'it': 'Picco di Prezzo',
    'de': 'Preisspitze',
  },
  'price_crash': {
    'zh-CN': '价格暴跌',
    'zh-TW': '價格暴跌',
    'en': 'Price Crash',
    'ja': '価格暴落',
    'ko': '가격급락',
    'fr': 'Effondrement des Prix',
    'it': 'Crollo del Prezzo',
    'de': 'Preiscrash',
  },
  'volume_surge': {
    'zh-CN': '成交量激增',
    'zh-TW': '成交量激增',
    'en': 'Volume Surge',
    'ja': '出来高急増',
    'ko': '거래량급증',
    'fr': 'Surge de Volume',
    'it': 'Picco di Volume',
    'de': 'Volumenanstieg',
  },
  'limit_up': {
    'zh-CN': '涨停',
    'zh-TW': '漲停',
    'en': 'Limit Up',
    'ja': 'ストップ高',
    'ko': '상한가',
    'fr': 'Limite Haute',
    'it': 'Limite Superiore',
    'de': 'Limit Aufwärts',
  },
  'limit_down': {
    'zh-CN': '跌停',
    'zh-TW': '跌停',
    'en': 'Limit Down',
    'ja': 'ストップ安',
    'ko': '하한가',
    'fr': 'Limite Basse',
    'it': 'Limite Inferiore',
    'de': 'Limit Abwärts',
  },
  'gap_up': {
    'zh-CN': '跳空高开',
    'zh-TW': '跳空高開',
    'en': 'Gap Up',
    'ja': 'ギャップアップ',
    'ko': '갭상승',
    'fr': 'Gap Haussier',
    'it': 'Gap al Rialzo',
    'de': 'Aufwärtslücke',
  },
  'gap_down': {
    'zh-CN': '跳空低开',
    'zh-TW': '跳空低開',
    'en': 'Gap Down',
    'ja': 'ギャップダウン',
    'ko': '갭하락',
    'fr': 'Gap Baissier',
    'it': 'Gap al Ribasso',
    'de': 'Abwärtslücke',
  },
  'unusual_activity': {
    'zh-CN': '异常交易',
    'zh-TW': '異常交易',
    'en': 'Unusual Activity',
    'ja': '異常取引',
    'ko': '이상거래',
    'fr': 'Activité Inhabituelle',
    'it': 'Attività Insolita',
    'de': 'Ungewöhnliche Aktivität',
  },
};

// ── Translation Functions ──────────────────────────────────────────────────

export function translateField(
  field: string,
  category: 'macro' | 'industry' | 'sentiment' | 'anomaly',
  lang: SupportedLanguage = 'en'
): string {
  let map: TranslationMap;

  switch (category) {
    case 'macro':
      map = MACRO_INDICATORS;
      break;
    case 'industry':
      map = INDUSTRY_NAMES;
      break;
    case 'sentiment':
      map = SENTIMENT_LABELS;
      break;
    case 'anomaly':
      map = ANOMALY_TYPES;
      break;
    default:
      return field;
  }

  return map[field]?.[lang] || field;
}

export function translateFields(
  fields: string[],
  category: 'macro' | 'industry' | 'sentiment' | 'anomaly',
  lang: SupportedLanguage = 'en'
): string[] {
  return fields.map(field => translateField(field, category, lang));
}

export function getAllTranslations(
  category: 'macro' | 'industry' | 'sentiment' | 'anomaly'
): TranslationMap {
  switch (category) {
    case 'macro':
      return MACRO_INDICATORS;
    case 'industry':
      return INDUSTRY_NAMES;
    case 'sentiment':
      return SENTIMENT_LABELS;
    case 'anomaly':
      return ANOMALY_TYPES;
    default:
      return {};
  }
}

export function getSupportedLanguages(): SupportedLanguage[] {
  return ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'it', 'de'];
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

export function setupI18nDataIPC(): void {
  ipcMain.handle('i18n:translate-field', async (_event, field: string, category: string, lang: string) => {
    try {
      const translation = translateField(
        field,
        category as any,
        lang as SupportedLanguage
      );
      return { success: true, translation };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('i18n:translate-fields', async (_event, fields: string[], category: string, lang: string) => {
    try {
      const translations = translateFields(
        fields,
        category as any,
        lang as SupportedLanguage
      );
      return { success: true, translations };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('i18n:get-all-translations', async (_event, category: string) => {
    try {
      const translations = getAllTranslations(category as any);
      return { success: true, translations };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('i18n:get-supported-languages', async () => {
    try {
      const languages = getSupportedLanguages();
      return { success: true, languages };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
