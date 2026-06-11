// ── i18n Data Layer (JVS-40) ──────────────────────────────────────────────
// Master Directive: Multi-language support for all EM data fields
// Covers: macro indicators, industry names, sentiment labels, anomaly types
// Languages: zh-CN, zh-TW, en, ja, ko, fr, it, de

import { ipcMain } from 'electron';

import i18n from '../../../src/i18n';
import { EngineError } from './engine-error';


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
    'zh-CN': i18n.t('i18nData.k1'),
    'zh-TW': i18n.t('i18nData.k2'),
    'en': 'Gross Domestic Product',
    'ja': i18n.t('i18nData.k3'),
    'ko': '국내총생산',
    'fr': 'Produit Intérieur Brut',
    'it': 'Prodotto Interno Lordo',
    'de': 'Bruttoinlandsprodukt',
  },
  'CPI': {
    'zh-CN': i18n.t('i18nData.k4'),
    'zh-TW': i18n.t('i18nData.k5'),
    'en': 'Consumer Price Index',
    'ja': i18n.t('i18nData.k6'),
    'ko': '소비자물가지수',
    'fr': 'Indice des Prix à la Consommation',
    'it': 'Indice dei Prezzi al Consumo',
    'de': 'Verbraucherpreisindex',
  },
  'PPI': {
    'zh-CN': i18n.t('i18nData.k7'),
    'zh-TW': i18n.t('i18nData.k8'),
    'en': 'Producer Price Index',
    'ja': i18n.t('i18nData.k9'),
    'ko': '생산자물가지수',
    'fr': 'Indice des Prix à la Production',
    'it': 'Indice dei Prezzi alla Produzione',
    'de': 'Erzeugerpreisindex',
  },
  'PMI': {
    'zh-CN': i18n.t('i18nData.k10'),
    'zh-TW': i18n.t('i18nData.k11'),
    'en': 'Purchasing Managers Index',
    'ja': i18n.t('i18nData.k12'),
    'ko': '구매관리자지수',
    'fr': 'Indice des Directeurs d\'Achat',
    'it': 'Indice dei Direttori degli Acquisti',
    'de': 'Einkaufsmanagerindex',
  },
  'M2': {
    'zh-CN': i18n.t('i18nData.k13'),
    'zh-TW': i18n.t('i18nData.k14'),
    'en': 'Broad Money Supply',
    'ja': i18n.t('i18nData.k15'),
    'ko': '광의통화공급량',
    'fr': 'Masse Monétaire',
    'it': 'Massa Monetaria',
    'de': 'Geldmenge M2',
  },
  'LPR': {
    'zh-CN': i18n.t('i18nData.k16'),
    'zh-TW': i18n.t('i18nData.k17'),
    'en': 'Loan Prime Rate',
    'ja': 'ローンプライムレート',
    'ko': '대출우대금리',
    'fr': 'Taux Préférentiel de Prêt',
    'it': 'Tasso Prime sui Prestiti',
    'de': 'Leitzins für Kredite',
  },
  [i18n.t('i18nData.k18')]: {
    'zh-CN': i18n.t('i18nData.k19'),
    'zh-TW': i18n.t('i18nData.k20'),
    'en': 'Unemployment Rate',
    'ja': i18n.t('i18nData.k21'),
    'ko': '실업률',
    'fr': 'Taux de Chômage',
    'it': 'Tasso di Disoccupazione',
    'de': 'Arbeitslosenquote',
  },
  [i18n.t('i18nData.k22')]: {
    'zh-CN': i18n.t('i18nData.k23'),
    'zh-TW': i18n.t('i18nData.k24'),
    'en': 'Industrial Value Added',
    'ja': i18n.t('i18nData.k25'),
    'ko': '공업부가가치',
    'fr': 'Valeur Ajoutée Industrielle',
    'it': 'Valore Aggiunto Industriale',
    'de': 'Industrielle Wertschöpfung',
  },
};

// ── Industry Names Translation ─────────────────────────────────────────────

export const INDUSTRY_NAMES: TranslationMap = {
  [i18n.t('i18nData.k26')]: {
    'zh-CN': i18n.t('i18nData.k27'),
    'zh-TW': i18n.t('i18nData.k28'),
    'en': 'Banking',
    'ja': i18n.t('i18nData.k29'),
    'ko': '은행',
    'fr': 'Banque',
    'it': 'Banca',
    'de': 'Bankwesen',
  },
  [i18n.t('i18nData.k30')]: {
    'zh-CN': i18n.t('i18nData.k31'),
    'zh-TW': i18n.t('i18nData.k32'),
    'en': 'Real Estate',
    'ja': i18n.t('i18nData.k33'),
    'ko': '부동산',
    'fr': 'Immobilier',
    'it': 'Immobiliare',
    'de': 'Immobilien',
  },
  [i18n.t('i18nData.k34')]: {
    'zh-CN': i18n.t('i18nData.k35'),
    'zh-TW': i18n.t('i18nData.k36'),
    'en': 'Food & Beverage',
    'ja': i18n.t('i18nData.k37'),
    'ko': '식품음료',
    'fr': 'Alimentation et Boissons',
    'it': 'Alimenti e Bevande',
    'de': 'Lebensmittel und Getränke',
  },
  [i18n.t('i18nData.k38')]: {
    'zh-CN': i18n.t('i18nData.k39'),
    'zh-TW': i18n.t('i18nData.k40'),
    'en': 'Pharmaceutical & Biotech',
    'ja': i18n.t('i18nData.k41'),
    'ko': '의약생물',
    'fr': 'Pharmaceutique et Biotechnologie',
    'it': 'Farmaceutico e Biotecnologie',
    'de': 'Pharma und Biotechnologie',
  },
  [i18n.t('i18nData.k42')]: {
    'zh-CN': i18n.t('i18nData.k43'),
    'zh-TW': i18n.t('i18nData.k44'),
    'en': 'Electronics',
    'ja': i18n.t('i18nData.k45'),
    'ko': '전자',
    'fr': 'Électronique',
    'it': 'Elettronica',
    'de': 'Elektronik',
  },
  [i18n.t('i18nData.k46')]: {
    'zh-CN': i18n.t('i18nData.k47'),
    'zh-TW': i18n.t('i18nData.k48'),
    'en': 'Computer',
    'ja': 'コンピュータ',
    'ko': '컴퓨터',
    'fr': 'Informatique',
    'it': 'Informatica',
    'de': 'Computer',
  },
  [i18n.t('i18nData.k49')]: {
    'zh-CN': i18n.t('i18nData.k50'),
    'zh-TW': i18n.t('i18nData.k51'),
    'en': 'Telecommunications',
    'ja': i18n.t('i18nData.k52'),
    'ko': '통신',
    'fr': 'Télécommunications',
    'it': 'Telecomunicazioni',
    'de': 'Telekommunikation',
  },
  [i18n.t('i18nData.k53')]: {
    'zh-CN': i18n.t('i18nData.k54'),
    'zh-TW': i18n.t('i18nData.k55'),
    'en': 'Automotive',
    'ja': i18n.t('i18nData.k56'),
    'ko': '자동차',
    'fr': 'Automobile',
    'it': 'Automobili',
    'de': 'Automobil',
  },
};

// ── Sentiment Labels Translation ───────────────────────────────────────────

export const SENTIMENT_LABELS: TranslationMap = {
  [i18n.t('i18nData.k57')]: {
    'zh-CN': i18n.t('i18nData.k58'),
    'zh-TW': i18n.t('i18nData.k59'),
    'en': 'Extreme Greed',
    'ja': i18n.t('i18nData.k60'),
    'ko': '극단적 탐욕',
    'fr': 'Avidité Extrême',
    'it': 'Avidità Estrema',
    'de': 'Extreme Gier',
  },
  [i18n.t('i18nData.k61')]: {
    'zh-CN': i18n.t('i18nData.k62'),
    'zh-TW': i18n.t('i18nData.k63'),
    'en': 'Greed',
    'ja': i18n.t('i18nData.k64'),
    'ko': '탐욕',
    'fr': 'Avidité',
    'it': 'Avidità',
    'de': 'Gier',
  },
  [i18n.t('i18nData.k65')]: {
    'zh-CN': i18n.t('i18nData.k66'),
    'zh-TW': i18n.t('i18nData.k67'),
    'en': 'Neutral',
    'ja': i18n.t('i18nData.k68'),
    'ko': '중립',
    'fr': 'Neutre',
    'it': 'Neutro',
    'de': 'Neutral',
  },
  [i18n.t('i18nData.k69')]: {
    'zh-CN': i18n.t('i18nData.k70'),
    'zh-TW': i18n.t('i18nData.k71'),
    'en': 'Fear',
    'ja': i18n.t('i18nData.k72'),
    'ko': '공포',
    'fr': 'Peur',
    'it': 'Paura',
    'de': 'Angst',
  },
  [i18n.t('i18nData.k73')]: {
    'zh-CN': i18n.t('i18nData.k74'),
    'zh-TW': i18n.t('i18nData.k75'),
    'en': 'Extreme Fear',
    'ja': i18n.t('i18nData.k76'),
    'ko': '극단적 공포',
    'fr': 'Peur Extrême',
    'it': 'Paura Estrema',
    'de': 'Extreme Angst',
  },
  [i18n.t('i18nData.k77')]: {
    'zh-CN': i18n.t('i18nData.k78'),
    'zh-TW': i18n.t('i18nData.k79'),
    'en': 'Bullish',
    'ja': i18n.t('i18nData.k80'),
    'ko': '강세',
    'fr': 'Haussier',
    'it': 'Rialzista',
    'de': 'Bullisch',
  },
  [i18n.t('i18nData.k81')]: {
    'zh-CN': i18n.t('i18nData.k82'),
    'zh-TW': i18n.t('i18nData.k83'),
    'en': 'Bearish',
    'ja': i18n.t('i18nData.k84'),
    'ko': '약세',
    'fr': 'Baissier',
    'it': 'Ribassista',
    'de': 'Bärisch',
  },
};

// ── Anomaly Types Translation ──────────────────────────────────────────────

export const ANOMALY_TYPES: TranslationMap = {
  'price_spike': {
    'zh-CN': i18n.t('i18nData.k85'),
    'zh-TW': i18n.t('i18nData.k86'),
    'en': 'Price Spike',
    'ja': i18n.t('i18nData.k87'),
    'ko': '가격급등',
    'fr': 'Flambée des Prix',
    'it': 'Picco di Prezzo',
    'de': 'Preisspitze',
  },
  'price_crash': {
    'zh-CN': i18n.t('i18nData.k88'),
    'zh-TW': i18n.t('i18nData.k89'),
    'en': 'Price Crash',
    'ja': i18n.t('i18nData.k90'),
    'ko': '가격급락',
    'fr': 'Effondrement des Prix',
    'it': 'Crollo del Prezzo',
    'de': 'Preiscrash',
  },
  'volume_surge': {
    'zh-CN': i18n.t('i18nData.k91'),
    'zh-TW': i18n.t('i18nData.k92'),
    'en': 'Volume Surge',
    'ja': i18n.t('i18nData.k93'),
    'ko': '거래량급증',
    'fr': 'Surge de Volume',
    'it': 'Picco di Volume',
    'de': 'Volumenanstieg',
  },
  'limit_up': {
    'zh-CN': i18n.t('i18nData.k94'),
    'zh-TW': i18n.t('i18nData.k95'),
    'en': 'Limit Up',
    'ja': i18n.t('i18nData.k96'),
    'ko': '상한가',
    'fr': 'Limite Haute',
    'it': 'Limite Superiore',
    'de': 'Limit Aufwärts',
  },
  'limit_down': {
    'zh-CN': i18n.t('i18nData.k97'),
    'zh-TW': i18n.t('i18nData.k98'),
    'en': 'Limit Down',
    'ja': i18n.t('i18nData.k99'),
    'ko': '하한가',
    'fr': 'Limite Basse',
    'it': 'Limite Inferiore',
    'de': 'Limit Abwärts',
  },
  'gap_up': {
    'zh-CN': i18n.t('i18nData.k100'),
    'zh-TW': i18n.t('i18nData.k101'),
    'en': 'Gap Up',
    'ja': 'ギャップアップ',
    'ko': '갭상승',
    'fr': 'Gap Haussier',
    'it': 'Gap al Rialzo',
    'de': 'Aufwärtslücke',
  },
  'gap_down': {
    'zh-CN': i18n.t('i18nData.k102'),
    'zh-TW': i18n.t('i18nData.k103'),
    'en': 'Gap Down',
    'ja': 'ギャップダウン',
    'ko': '갭하락',
    'fr': 'Gap Baissier',
    'it': 'Gap al Ribasso',
    'de': 'Abwärtslücke',
  },
  'unusual_activity': {
    'zh-CN': i18n.t('i18nData.k104'),
    'zh-TW': i18n.t('i18nData.k105'),
    'en': 'Unusual Activity',
    'ja': i18n.t('i18nData.k106'),
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('i18n:get-all-translations', async (_event, category: string) => {
    try {
      const translations = getAllTranslations(category as any);
      return { success: true, translations };
    } catch (err: unknown) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('i18n:get-supported-languages', async () => {
    try {
      const languages = getSupportedLanguages();
      return { success: true, languages };
    } catch (err: unknown) {
      return { success: false, error: err.message };
    }
  });
}
