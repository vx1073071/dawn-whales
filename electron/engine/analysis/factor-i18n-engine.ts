/**
 * FactorI18nEngine — R282 JVS-1 i18n补齐66引擎 (8h)
 *
 * 问题: 审计发现66个文件含硬编码中文 (行内注释/描述/UI文案/错误消息)
 * 目标: 统一i18n翻译层, 所有中文→9语言 (en/cn/ja/ko/zhHant/fr/de/es/pt)
 *
 * 功能:
 * - I18nRegistry: 因子名/描述/类别/单位的统一翻译
 * - TranslateFactor: factorId + locale → 完整本地化
 * - BatchTranslate: 批量因子翻译
 * - LocaleCoverageReport: 检查各语言覆盖率
 * - HardcodedChineseDetector: 扫描剩余硬编码中文
 * - FactorGroupI18n: 因子组(价值/成长/动量...)的国际化
 */

export type SupportedLocale = 'en' | 'cn' | 'ja' | 'ko' | 'zhHant' | 'fr' | 'de' | 'es' | 'pt';

export interface I18nEntry {
  factorId: string;
  field: 'name' | 'description' | 'category' | 'unit' | 'signal';
  translations: Record<SupportedLocale, string>;
  sourceFile: string;  // engine where this appears
}

export interface LocaleCoverage {
  locale: SupportedLocale;
  totalFactors: number;
  translated: number;
  missing: number;
  coveragePct: number;
}

export interface HardcodedChineseMatch {
  file: string;
  line: number;
  snippet: string;
  suggestion: string;  // recommended translation key
}

// ============================================================
const FACTOR_I18N_REGISTRY: I18nEntry[] = [
  // Value
  {
    factorId: 'pe_ttm', field: 'name',
    translations: {
      en: 'PE Ratio (TTM)', cn: '市盈率(TTM)',
      ja: '株価収益率(TTM)', ko: '주가수익비율(TTM)',
      zhHant: '本益比(TTM)',
      fr: 'Ratio C/B (TTM)', de: 'KGV (TTM)',
      es: 'Ratio PER (TTM)', pt: 'P/L (TTM)',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'pe_ttm', field: 'description',
    translations: {
      en: 'Price to trailing twelve-month earnings per share',
      cn: '股价除以过去12个月每股收益',
      ja: '株価÷過去12ヶ月の1株当たり利益',
      ko: '주가 / 최근 12개월 주당순이익',
      zhHant: '股價除以過去12個月每股盈餘',
      fr: 'Prix divisé par le bénéfice par action des 12 derniers mois',
      de: 'Preis geteilt durch Gewinn je Aktie der letzten 12 Monate',
      es: 'Precio dividido por las ganancias por acción de los últimos 12 meses',
      pt: 'Preço dividido pelo lucro por ação dos últimos 12 meses',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'pb_lf', field: 'name',
    translations: {
      en: 'PB Ratio (Latest)', cn: '市净率(最新)',
      ja: '株価純資産倍率(最新)', ko: '주가순자산비율(최신)',
      zhHant: '股價淨值比(最新)',
      fr: 'Ratio P/B (Dernier)', de: 'KBV (Neueste)',
      es: 'Ratio P/B (Último)', pt: 'P/VP (Último)',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'ev_ebitda', field: 'name',
    translations: {
      en: 'EV/EBITDA', cn: '企业价值/EBITDA',
      ja: 'EV/EBITDA', ko: 'EV/EBITDA',
      zhHant: '企業價值/EBITDA',
      fr: 'VE/EBITDA', de: 'EV/EBITDA',
      es: 'EV/EBITDA', pt: 'EV/EBITDA',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'dividend_yield', field: 'name',
    translations: {
      en: 'Dividend Yield', cn: '股息率',
      ja: '配当利回り', ko: '배당수익률',
      zhHant: '股息率',
      fr: 'Rendement du dividende', de: 'Dividendenrendite',
      es: 'Rendimiento por dividendo', pt: 'Dividend Yield',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'dividend_yield', field: 'description',
    translations: {
      en: 'Annual dividend per share divided by current stock price',
      cn: '每股年度分红除以当前股价',
      ja: '1株当たり年間配当÷現在の株価',
      ko: '주당 연간 배당금 / 현재 주가',
      zhHant: '每股年度股息除以當前股價',
      fr: 'Dividende annuel par action divisé par le cours actuel',
      de: 'Jährliche Dividende je Aktie geteilt durch aktuellen Aktienkurs',
      es: 'Dividendo anual por acción dividido por el precio actual',
      pt: 'Dividendo anual por ação dividido pelo preço atual',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Growth
  {
    factorId: 'revenue_yoy', field: 'name',
    translations: {
      en: 'Revenue YoY Growth', cn: '营收同比增速',
      ja: '売上高前年比成長率', ko: '매출액 전년대비 성장률',
      zhHant: '營收年增率',
      fr: 'Croissance du CA en glissement annuel',
      de: 'Umsatzwachstum im Jahresvergleich',
      es: 'Crecimiento interanual de ingresos',
      pt: 'Crescimento de receita ano a ano',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'earnings_yoy', field: 'name',
    translations: {
      en: 'Earnings YoY Growth', cn: '盈利同比增速',
      ja: '利益前年比成長率', ko: '이익 전년대비 성장률',
      zhHant: '盈利年增率',
      fr: 'Croissance des bénéfices en glissement annuel',
      de: 'Gewinnwachstum im Jahresvergleich',
      es: 'Crecimiento interanual de ganancias',
      pt: 'Crescimento de lucros ano a ano',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Quality
  {
    factorId: 'roe_ttm', field: 'name',
    translations: {
      en: 'ROE (TTM)', cn: '净资产收益率(TTM)',
      ja: '自己資本利益率(TTM)', ko: '자기자본이익률(TTM)',
      zhHant: '股東權益報酬率(TTM)',
      fr: 'RCP (TTM)', de: 'Eigenkapitalrendite (TTM)',
      es: 'ROE (TTM)', pt: 'ROE (TTM)',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'gross_margin', field: 'name',
    translations: {
      en: 'Gross Profit Margin', cn: '毛利率',
      ja: '売上総利益率', ko: '매출총이익률',
      zhHant: '毛利率',
      fr: 'Marge brute', de: 'Bruttomarge',
      es: 'Margen bruto', pt: 'Margem bruta',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'debt_equity', field: 'name',
    translations: {
      en: 'Debt/Equity Ratio', cn: '资产负债率',
      ja: '負債資本比率', ko: '부채비율',
      zhHant: '負債權益比',
      fr: 'Ratio Dette/Capitaux propres', de: 'Verschuldungsgrad',
      es: 'Ratio Deuda/Patrimonio', pt: 'Dívida/Patrimônio Líquido',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Momentum
  {
    factorId: 'momentum_1m', field: 'name',
    translations: {
      en: 'Momentum 1-Month', cn: '动量1月',
      ja: 'モメンタム1ヶ月', ko: '모멘텀 1개월',
      zhHant: '動能1個月',
      fr: 'Momentum 1 mois', de: 'Momentum 1 Monat',
      es: 'Momento 1 mes', pt: 'Momentum 1 mês',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'momentum_3m', field: 'name',
    translations: {
      en: 'Momentum 3-Month', cn: '动量3月',
      ja: 'モメンタム3ヶ月', ko: '모멘텀 3개월',
      zhHant: '動能3個月',
      fr: 'Momentum 3 mois', de: 'Momentum 3 Monate',
      es: 'Momento 3 meses', pt: 'Momentum 3 meses',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'momentum_6m', field: 'name',
    translations: {
      en: 'Momentum 6-Month', cn: '动量6月',
      ja: 'モメンタム6ヶ月', ko: '모멘텀 6개월',
      zhHant: '動能6個月',
      fr: 'Momentum 6 mois', de: 'Momentum 6 Monate',
      es: 'Momento 6 meses', pt: 'Momentum 6 meses',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Size
  {
    factorId: 'market_cap', field: 'name',
    translations: {
      en: 'Market Capitalization', cn: '总市值',
      ja: '時価総額', ko: '시가총액',
      zhHant: '總市值',
      fr: 'Capitalisation boursière', de: 'Marktkapitalisierung',
      es: 'Capitalización de mercado', pt: 'Valor de mercado',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Volatility
  {
    factorId: 'volatility_20d', field: 'name',
    translations: {
      en: 'Volatility 20-Day', cn: '20日波动率',
      ja: '20日ボラティリティ', ko: '20일 변동성',
      zhHant: '20日波動率',
      fr: 'Volatilité 20 jours', de: 'Volatilität 20 Tage',
      es: 'Volatilidad 20 días', pt: 'Volatilidade 20 dias',
    },
    sourceFile: 'multi-factor.ts',
  },
  {
    factorId: 'beta_60d', field: 'name',
    translations: {
      en: 'Beta 60-Day', cn: '60日贝塔',
      ja: '60日ベータ', ko: '60일 베타',
      zhHant: '60日貝塔',
      fr: 'Bêta 60 jours', de: 'Beta 60 Tage',
      es: 'Beta 60 días', pt: 'Beta 60 dias',
    },
    sourceFile: 'multi-factor.ts',
  },

  // Factor groups (categories)
  {
    factorId: 'category_value', field: 'name',
    translations: {
      en: 'Value', cn: '价值', ja: 'バリュー', ko: '가치', zhHant: '價值',
      fr: 'Value', de: 'Value', es: 'Valor', pt: 'Valor',
    },
    sourceFile: 'common',
  },
  {
    factorId: 'category_growth', field: 'name',
    translations: {
      en: 'Growth', cn: '成长', ja: 'グロース', ko: '성장', zhHant: '成長',
      fr: 'Croissance', de: 'Wachstum', es: 'Crecimiento', pt: 'Crescimento',
    },
    sourceFile: 'common',
  },
  {
    factorId: 'category_momentum', field: 'name',
    translations: {
      en: 'Momentum', cn: '动量', ja: 'モメンタム', ko: '모멘텀', zhHant: '動能',
      fr: 'Momentum', de: 'Momentum', es: 'Momento', pt: 'Momentum',
    },
    sourceFile: 'common',
  },
  {
    factorId: 'category_quality', field: 'name',
    translations: {
      en: 'Quality', cn: '质量', ja: 'クオリティ', ko: '퀄리티', zhHant: '品質',
      fr: 'Qualité', de: 'Qualität', es: 'Calidad', pt: 'Qualidade',
    },
    sourceFile: 'common',
  },
  {
    factorId: 'category_volatility', field: 'name',
    translations: {
      en: 'Volatility', cn: '波动', ja: 'ボラティリティ', ko: '변동성', zhHant: '波動',
      fr: 'Volatilité', de: 'Volatilität', es: 'Volatilidad', pt: 'Volatilidade',
    },
    sourceFile: 'common',
  },
  {
    factorId: 'category_lowRisk', field: 'name',
    translations: {
      en: 'Low Risk', cn: '低风险', ja: '低リスク', ko: '저위험', zhHant: '低風險',
      fr: 'Faible risque', de: 'Geringes Risiko', es: 'Bajo riesgo', pt: 'Baixo risco',
    },
    sourceFile: 'common',
  },

  // UI labels
  {
    factorId: 'ui_filter_hot', field: 'signal',
    translations: {
      en: 'Hot Factors', cn: '热门因子', ja: '注目ファクター', ko: '인기 팩터',
      zhHant: '熱門因子', fr: 'Facteurs tendance', de: 'Beliebte Faktoren',
      es: 'Factores populares', pt: 'Fatores em alta',
    },
    sourceFile: 'factor-template-marketplace-engine.ts',
  },
  {
    factorId: 'ui_filter_new', field: 'signal',
    translations: {
      en: 'New', cn: '最新', ja: '新着', ko: '신규', zhHant: '最新',
      fr: 'Nouveau', de: 'Neu', es: 'Nuevo', pt: 'Novo',
    },
    sourceFile: 'factor-template-marketplace-engine.ts',
  },
  {
    factorId: 'ui_filter_trending', field: 'signal',
    translations: {
      en: 'Trending', cn: '趋势', ja: 'トレンド', ko: '트렌딩', zhHant: '趨勢',
      fr: 'Tendances', de: 'Im Trend', es: 'Tendencias', pt: 'Em alta',
    },
    sourceFile: 'factor-template-marketplace-engine.ts',
  },
  {
    factorId: 'ui_signal_bullish', field: 'signal',
    translations: {
      en: 'Bullish', cn: '看涨', ja: '強気', ko: '강세', zhHant: '看漲',
      fr: 'Haussier', de: 'Bullisch', es: 'Alcista', pt: 'Altista',
    },
    sourceFile: 'factor-ai-interpretation-engine.ts',
  },
  {
    factorId: 'ui_signal_bearish', field: 'signal',
    translations: {
      en: 'Bearish', cn: '看跌', ja: '弱気', ko: '약세', zhHant: '看跌',
      fr: 'Baissier', de: 'Bärisch', es: 'Bajista', pt: 'Baixista',
    },
    sourceFile: 'factor-ai-interpretation-engine.ts',
  },
  {
    factorId: 'ui_signal_neutral', field: 'signal',
    translations: {
      en: 'Neutral', cn: '中性', ja: '中立', ko: '중립', zhHant: '中性',
      fr: 'Neutre', de: 'Neutral', es: 'Neutral', pt: 'Neutro',
    },
    sourceFile: 'factor-ai-interpretation-engine.ts',
  },
];

// ============================================================
export class FactorI18nEngine {
  private registry: I18nEntry[] = [...FACTOR_I18N_REGISTRY];
  private index = new Map<string, I18nEntry>(); // factorId:field → entry
  private translatedCount = 0;

  constructor() {
    // Build index
    const entries = this.registry;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const key = `${e.factorId}:${e.field}`;
      this.index.set(key, e);
    }
    this.translatedCount = this.registry.length;
  }

  /** Translate a single factor field */
  translate(factorId: string, field: 'name' | 'description' | 'category' | 'unit' | 'signal', locale: SupportedLocale = 'cn'): string {
    const key = `${factorId}:${field}`;
    const entry = this.index.get(key);
    if (entry && entry.translations[locale]) {
      return entry.translations[locale];
    }
    // Fallback: try English, then return factorId
    if (entry && entry.translations['en']) return entry.translations['en'];
    return factorId;
  }

  /** Batch translate: returns Record<factorId, translation> */
  translateBatch(factorIds: string[], field: 'name' | 'description' | 'category' | 'unit' | 'signal', locale: SupportedLocale = 'cn'): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < factorIds.length; i++) {
      result[factorIds[i]] = this.translate(factorIds[i], field, locale);
    }
    return result;
  }

  /** Get all supported locales */
  getSupportedLocales(): SupportedLocale[] {
    return ['en', 'cn', 'ja', 'ko', 'zhHant', 'fr', 'de', 'es', 'pt'];
  }

  /** Get locale coverage stats */
  getLocaleCoverage(): LocaleCoverage[] {
    const locales = this.getSupportedLocales();
    const entries = this.registry;
    const totalFactors = entries.length;
    return locales.map(locale => {
      let translated = 0;
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].translations[locale]) translated++;
      }
      return {
        locale,
        totalFactors,
        translated,
        missing: totalFactors - translated,
        coveragePct: totalFactors > 0 ? +((translated / totalFactors) * 100).toFixed(1) : 0,
      };
    });
  }

  /** Detect remaining hardcoded Chinese in a file (simulated scanner) */
  scanHardcodedChinese(fileContent: string, fileName: string): HardcodedChineseMatch[] {
    const matches: HardcodedChineseMatch[] = [];
    const chinesePattern = /[\u4e00-\u9fff]+/g;
    const lines = fileContent.split('\n');

    // Ignore lines in comments for this simplified scanner
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip pure comment lines
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) continue;

      const chineseMatch = line.match(chinesePattern);
      if (chineseMatch) {
        const snippet = line.trim().substring(0, 60);
        matches.push({
          file: fileName,
          line: i + 1,
          snippet,
          suggestion: `translate('${chineseMatch[0].substring(0, 10)}', locale)`,
        });
      }
    }
    return matches;
  }

  /** Generate migration report for 66 engines */
  getMigrationReport(): { totalEngines: number; estimatedFiles: number; priorityFiles: string[]; totalTranslations: number } {
    const priorityFiles = [
      'multi-factor.ts',
      'factor-unification-engine.ts',
      'factor-performance-engine.ts',
      'global-84-factors-engine.ts',
      'academic-200-factors-engine.ts',
      'factor-ai-interpretation-engine.ts',
      'factor-template-marketplace-engine.ts',
      'factor-ic-dashboard-engine.ts',
      'cn-6-indicators-engine.ts',
      'hk-6-indicators-engine.ts',
    ];

    return {
      totalEngines: 66,
      estimatedFiles: 66,
      priorityFiles,
      totalTranslations: this.translatedCount,
    };
  }

  /** Register a new translation entry */
  register(entry: I18nEntry): void {
    const key = `${entry.factorId}:${entry.field}`;
    const existingIdx = this.registry.findIndex(e => `${e.factorId}:${e.field}` === key);
    if (existingIdx >= 0) {
      this.registry[existingIdx] = entry;
    } else {
      this.registry.push(entry);
      this.translatedCount++;
    }
    this.index.set(key, entry);
  }

  getRegistry(): I18nEntry[] { return this.registry; }
  getTranslatedCount(): number { return this.translatedCount; }
  reset(): void { this.registry = []; this.index.clear(); this.translatedCount = 0; }
}

let _fie: FactorI18nEngine | undefined;
export function getFactorI18nEngine(): FactorI18nEngine {
  if (!_fie) _fie = new FactorI18nEngine();
  return _fie;
}
export function resetFactorI18nEngine(): void { _fie?.reset(); _fie = undefined; }
