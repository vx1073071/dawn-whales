/**
 * FactorCanonicalNamingRegistry — R281 JVS-3 因子命名统一 (4h)
 *
 * 问题: 620 因子中, 同一因子在不同引擎/模板/UI 中有不同命名
 * 例如: 'pe_ttm' 在 A引擎叫 'PE_TTM'、B引擎叫 'PE TTM'、C引擎叫 '市盈率(TTM)'
 *
 * 解决方案:
 * 1. Canonical Naming Registry — 唯一ID → 所有语言的 canonical name
 * 2. Name Resolution: resolve(id) → { en, cn, ja, ko, zhHant }
 * 3. Alias Registry: 所有别名 → canonical ID
 * 4. Fuzzy Match: 用户输入 '市盈率' → 找到 pe_ttm
 * 5. Naming Convention Rules: snake_case ID, PascalCase English, 中文金融标准术语
 */

export interface CanonicalName {
  id: string;             // canonical ID: snake_case, lowercase (e.g., 'pe_ttm')
  nameEn: string;         // English: PascalCase acronym (e.g., 'PE Ratio (TTM)')
  nameCn: string;         // Simplified Chinese (e.g., '市盈率(TTM)')
  nameJa: string;         // Japanese (e.g., '株価収益率(TTM)')
  nameKo: string;         // Korean (e.g., '주가수익비율(TTM)')
  nameZhHant: string;     // Traditional Chinese (e.g., '本益比(TTM)')
  category: 'value' | 'growth' | 'momentum' | 'quality' | 'volatility' | 'size' | 'liquidity' | 'dividend' | 'sentiment' | 'flow' | 'macro' | 'esg' | 'options' | 'fixedIncome' | 'risk';
  aliases: string[];      // all known non-canonical names
  description: string;    // short English description
  unit: string;           // '%', 'ratio', 'USD', 'days', etc.
}

export interface NamingStats {
  totalFactors: number;
  factorsWithAliases: number;
  totalAliases: number;
  avgAliasesPerFactor: number;
  ambiguousNames: Array<{ name: string; possibleIds: string[] }>;
}

// ============================================================
const CANONICAL_FACTORS: CanonicalName[] = [
  // Value
  { id: 'pe_ttm', nameEn: 'PE Ratio (TTM)', nameCn: '市盈率(TTM)', nameJa: '株価収益率(TTM)', nameKo: '주가수익비율(TTM)', nameZhHant: '本益比(TTM)', category: 'value', aliases: ['PE TTM', 'pe', '市盈率', 'P/E', 'PE_RATIO', 'peRatio'], description: 'Price to trailing 12-month earnings', unit: 'ratio' },
  { id: 'pb_lf', nameEn: 'PB Ratio (Latest)', nameCn: '市净率(最新)', nameJa: '株価純資産倍率(最新)', nameKo: '주가순자산비율(최신)', nameZhHant: '股價淨值比(最新)', category: 'value', aliases: ['PB LF', 'pb', '市净率', 'P/B', 'PB_RATIO', 'pbRatio'], description: 'Price to latest book value', unit: 'ratio' },
  { id: 'ev_ebitda', nameEn: 'EV/EBITDA', nameCn: '企业价值/EBITDA', nameJa: 'EV/EBITDA', nameKo: 'EV/EBITDA', nameZhHant: '企業價值/EBITDA', category: 'value', aliases: ['EV EBITDA', '企业价值倍数'], description: 'Enterprise value to EBITDA', unit: 'ratio' },
  { id: 'dividend_yield', nameEn: 'Dividend Yield', nameCn: '股息率', nameJa: '配当利回り', nameKo: '배당수익률', nameZhHant: '股息率', category: 'dividend', aliases: ['DY', '股息', 'dividend', 'DivYield'], description: 'Annual dividend / current price', unit: '%' },

  // Growth
  { id: 'revenue_yoy', nameEn: 'Revenue YoY Growth', nameCn: '营收同比增速', nameJa: '売上高前年比', nameKo: '매출액 전년비', nameZhHant: '營收年增率', category: 'growth', aliases: ['Rev_YoY', '营收增速', 'revenue growth', 'RevYoY'], description: 'Year-over-year revenue growth rate', unit: '%' },
  { id: 'earnings_yoy', nameEn: 'Earnings YoY Growth', nameCn: '盈利同比增速', nameJa: '利益前年比', nameKo: '이익 전년비', nameZhHant: '盈利年增率', category: 'growth', aliases: ['EPS_YoY', '盈利增速', 'earnings growth', 'EPSYoY'], description: 'Year-over-year earnings per share growth', unit: '%' },
  { id: 'roe_ttm', nameEn: 'ROE (TTM)', nameCn: '净资产收益率(TTM)', nameJa: '自己資本利益率(TTM)', nameKo: '자기자본이익률(TTM)', nameZhHant: '股東權益報酬率(TTM)', category: 'quality', aliases: ['ROE', '净资产收益率', 'roe'], description: 'Return on equity trailing 12 months', unit: '%' },
  { id: 'gross_margin', nameEn: 'Gross Profit Margin', nameCn: '毛利率', nameJa: '売上総利益率', nameKo: '매출총이익률', nameZhHant: '毛利率', category: 'quality', aliases: ['GPM', '毛利率', 'gross margin'], description: 'Gross profit / revenue', unit: '%' },

  // Momentum
  { id: 'momentum_1m', nameEn: 'Momentum 1-Month', nameCn: '动量1月', nameJa: 'モメンタム1ヶ月', nameKo: '모멘텀 1개월', nameZhHant: '動能1個月', category: 'momentum', aliases: ['Mo1M', '1M momentum', 'ret_1M', 'mom1m'], description: '1-month trailing return', unit: '%' },
  { id: 'momentum_3m', nameEn: 'Momentum 3-Month', nameCn: '动量3月', nameJa: 'モメンタム3ヶ月', nameKo: '모멘텀 3개월', nameZhHant: '動能3個月', category: 'momentum', aliases: ['Mo3M', '3M momentum', 'ret_3M', 'mom3m'], description: '3-month trailing return', unit: '%' },
  { id: 'momentum_6m', nameEn: 'Momentum 6-Month', nameCn: '动量6月', nameJa: 'モメンタム6ヶ月', nameKo: '모멘텀 6개월', nameZhHant: '動能6個月', category: 'momentum', aliases: ['Mo6M', '6M momentum', 'ret_6M', 'mom6m'], description: '6-month trailing return', unit: '%' },
  { id: 'momentum_12m', nameEn: 'Momentum 12-1 Month', nameCn: '动量12-1月', nameJa: 'モメンタム12-1ヶ月', nameKo: '모멘텀 12-1개월', nameZhHant: '動能12-1個月', category: 'momentum', aliases: ['Mo12M', '12M momentum', 'ret_12M_skip1M', 'mom12m'], description: '12-month return skipping most recent month', unit: '%' },

  // Size & Liquidity
  { id: 'market_cap', nameEn: 'Market Capitalization', nameCn: '总市值', nameJa: '時価総額', nameKo: '시가총액', nameZhHant: '總市值', category: 'size', aliases: ['MktCap', '市值', 'market cap', 'size', 'MC'], description: 'Log market capitalization', unit: 'USD' },
  { id: 'turnover_rate', nameEn: 'Turnover Rate', nameCn: '换手率', nameJa: '売買回転率', nameKo: '회전율', nameZhHant: '換手率', category: 'liquidity', aliases: ['Turnover', '换手', 'turnover'], description: 'Daily volume / shares outstanding', unit: '%' },
  { id: 'amihud', nameEn: 'Amihud Illiquidity', nameCn: 'Amihud非流动性', nameJa: 'アミフド非流動性', nameKo: 'Amihud 비유동성', nameZhHant: 'Amihud非流動性', category: 'liquidity', aliases: ['Amihud', '非流动性', 'illiq'], description: 'Average absolute return per dollar volume', unit: 'ratio' },

  // Volatility
  { id: 'volatility_20d', nameEn: 'Volatility 20-Day', nameCn: '20日波动率', nameJa: '20日ボラティリティ', nameKo: '20일 변동성', nameZhHant: '20日波動率', category: 'volatility', aliases: ['Vol20D', '20日波动', 'std20d', 'vol20'], description: 'Annualized 20-day standard deviation of returns', unit: '%' },
  { id: 'beta_60d', nameEn: 'Beta 60-Day', nameCn: '60日贝塔', nameJa: '60日ベータ', nameKo: '60일 베타', nameZhHant: '60日貝塔', category: 'volatility', aliases: ['Beta60D', '60日beta', 'cov/var', 'beta'], description: '60-day CAPM beta to market index', unit: 'ratio' },
  { id: 'amplitude_5d', nameEn: 'Amplitude 5-Day', nameCn: '5日振幅', nameJa: '5日振幅', nameKo: '5일 진폭', nameZhHant: '5日振幅', category: 'volatility', aliases: ['Ampl5D', '5日振幅', 'Ampl'], description: '5-day high-low range / average close', unit: '%' },
  { id: 'max_drawdown', nameEn: 'Max Drawdown', nameCn: '最大回撤', nameJa: '最大ドローダウン', nameKo: '최대 낙폭', nameZhHant: '最大回撤', category: 'risk', aliases: ['MaxDD', '最大回撤', 'MDD'], description: 'Maximum peak-to-trough decline', unit: '%' },

  // Flow & Sentiment
  { id: 'northbound', nameEn: 'Northbound Flow', nameCn: '北向资金', nameJa: '北向き資金', nameKo: '북향 자금', nameZhHant: '北向資金', category: 'flow', aliases: ['NB', '北向', '陆股通'], description: 'Northbound capital flow via Stock Connect', unit: 'USD' },
  { id: 'institution', nameEn: 'Institutional Flow', nameCn: '机构资金流', nameJa: '機関投資家フロー', nameKo: '기관 자금', nameZhHant: '機構資金流', category: 'flow', aliases: ['InstFlow', '机构', 'Inst'], description: 'Institutional net buying flow', unit: 'USD' },
  { id: 'major_flow_5d', nameEn: 'Major Flow 5-Day', nameCn: '主力资金5日', nameJa: '主力資金5日', nameKo: '주요자금 5일', nameZhHant: '主力資金5日', category: 'flow', aliases: ['Major5D', '主力资金', 'MajorFlow'], description: '5-day cumulative major player flow', unit: 'USD' },

  // Quality
  { id: 'debt_equity', nameEn: 'Debt/Equity Ratio', nameCn: '资产负债率', nameJa: '負債資本比率', nameKo: '부채비율', nameZhHant: '負債權益比', category: 'quality', aliases: ['D/E', '负债率', 'DebtEquity'], description: 'Total debt / total equity', unit: 'ratio' },
  { id: 'accruals_q', nameEn: 'Accruals (Quarterly)', nameCn: '应计项目(季度)', nameJa: 'アクルーアル(四半期)', nameKo: '발생액(분기)', nameZhHant: '應計項目(季度)', category: 'quality', aliases: ['Accruals', '应计', 'accruals'], description: 'Quarterly accruals / total assets', unit: 'ratio' },

  // Macro
  { id: 'pmi_sens', nameEn: 'PMI Sensitivity', nameCn: 'PMI敏感性', nameJa: 'PMI感応度', nameKo: 'PMI 민감도', nameZhHant: 'PMI敏感性', category: 'macro', aliases: ['PMI_Sens', 'PMI敏感', 'PMI'], description: 'Stock sensitivity to PMI changes', unit: 'ratio' },
];

// ============================================================
export class FactorCanonicalNamingRegistry {
  private registry = new Map<string, CanonicalName>();  // id → canonical
  private aliasIndex = new Map<string, string>();       // alias → canonical id
  private fuzzyIndex = new Map<string, string[]>();     // search terms → ids

  constructor() {
    // Build indexes
    for (const f of CANONICAL_FACTORS) {
      this.registry.set(f.id, f);
      // Index all aliases
      for (const alias of f.aliases) {
        const lower = alias.toLowerCase().trim();
        if (!this.aliasIndex.has(lower)) this.aliasIndex.set(lower, f.id);
      }
      // Also index canonical names
      this.aliasIndex.set(f.id, f.id);
      this.aliasIndex.set(f.nameEn.toLowerCase(), f.id);
      this.aliasIndex.set(f.nameCn.toLowerCase(), f.id);
      // Fuzzy index
      const terms = new Set<string>();
      for (const t of [f.id, f.nameCn, f.nameEn.toLowerCase(), ...f.aliases.map(a => a.toLowerCase())]) {
        for (const word of t.split(/[\s_\-/()]+/)) {
          if (word.length >= 2) terms.add(word);
        }
      }
      const _terms = Array.from(terms);
      for (let _ti = 0; _ti < _terms.length; _ti++) {
        const term = _terms[_ti];
        if (!this.fuzzyIndex.has(term)) this.fuzzyIndex.set(term, []);
        this.fuzzyIndex.get(term)!.push(f.id);
      }
    }
  }

  /** Resolve: any name → canonical ID */
  resolve(name: string): string | null {
    const key = name.toLowerCase().trim();
    return this.aliasIndex.get(key) || null;
  }

  /** Get canonical info by ID */
  get(id: string): CanonicalName | null { return this.registry.get(id) || null; }

  /** Get localized name */
  getName(id: string, locale: 'en' | 'cn' | 'ja' | 'ko' | 'zhHant' = 'cn'): string {
    const f = this.registry.get(id);
    if (!f) return id;
    const key = locale === 'zhHant' ? 'nameZhHant' : locale === 'cn' ? 'nameCn' : locale === 'ja' ? 'nameJa' : locale === 'ko' ? 'nameKo' : 'nameEn';
    return f[key as keyof CanonicalName] as string;
  }

  /** Fuzzy search: returns ranked matches */
  fuzzySearch(query: string, limit: number = 10): Array<CanonicalName & { score: number }> {
    const ql = query.toLowerCase().trim();
    const words = ql.split(/[\s_\-/()]+/).filter(w => w.length >= 1);

    // Direct match first
    const direct = this.aliasIndex.get(ql);
    if (direct) {
      const f = this.registry.get(direct);
      if (f) return [{ ...f, score: 1 }];
    }

    // Scored matches
    const scores = new Map<string, number>();
    for (const word of words) {
      const _fiEntries = Array.from(this.fuzzyIndex.entries());
      for (let _fii = 0; _fii < _fiEntries.length; _fii++) {
        const [term, ids] = _fiEntries[_fii];
        if (term.includes(word) || word.includes(term)) {
          for (const id of ids) {
            scores.set(id, (scores.get(id) || 0) + 1);
          }
        }
      }
    }

    // Check nameCn contains query
    const _regVals = Array.from(this.registry.values());
    for (let _ri = 0; _ri < _regVals.length; _ri++) {
      const f = _regVals[_ri];
      if (f.nameCn.includes(query)) scores.set(f.id, (scores.get(f.id) || 0) + 3);
      if (f.nameEn.toLowerCase().includes(ql)) scores.set(f.id, (scores.get(f.id) || 0) + 2);
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({ ...this.registry.get(id)!, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** Validate naming consistency */
  validateNaming(): NamingStats {
    let totalAliases = 0;
    let factorsWithAliases = 0;
    const ambiguousNames: NamingStats['ambiguousNames'] = [];

    const _regVals = Array.from(this.registry.values());
    for (let _ri = 0; _ri < _regVals.length; _ri++) {
      const f = _regVals[_ri];
      if (f.aliases.length > 1) factorsWithAliases++;
      totalAliases += f.aliases.length;
    }

    // Check for ambiguous aliases
    const aliasCount = new Map<string, string[]>();
    const _aliasEntries = Array.from(this.aliasIndex.entries());
    for (let _ai = 0; _ai < _aliasEntries.length; _ai++) {
      const [alias, id] = _aliasEntries[_ai];
      if (!aliasCount.has(alias)) aliasCount.set(alias, []);
      aliasCount.get(alias)!.push(id);
    }

    const _acEntries = Array.from(aliasCount.entries());
    for (let _aci = 0; _aci < _acEntries.length; _aci++) {
      const [alias, ids] = _acEntries[_aci];
      if (ids.length > 1) ambiguousNames.push({ name: alias, possibleIds: ids });
    }

    return {
      totalFactors: this.registry.size,
      factorsWithAliases,
      totalAliases,
      avgAliasesPerFactor: this.registry.size > 0 ? +(totalAliases / this.registry.size).toFixed(1) : 0,
      ambiguousNames,
    };
  }

  /** Get naming convention rules */
  getNamingRules(): string[] {
    return [
      '1. Canonical ID: snake_case, lowercase, no special chars (e.g., "pe_ttm")',
      '2. English: PascalCase acronym with unit suffix (e.g., "PE Ratio (TTM)")',
      '3. Chinese: 中文金融标准术语, 括号标注周期 (e.g., "市盈率(TTM)")',
      '4. Japanese/Korean: 使用本地金融标准术语',
      '5. All engines MUST use resolve(id) instead of hardcoded names',
      '6. UI layer calls getName(id, locale) for display',
      '7. New factors: add to this registry, NOT to individual engines',
    ];
  }

  /** Get all registered factors */
  getAll(): CanonicalName[] {
    const _allVals: CanonicalName[] = [];
    this.registry.forEach(f => _allVals.push(f));
    return _allVals;
  }
  _old_getAll(): CanonicalName[] { return Array.from(this.registry.values()); }

  /** Count */
  getCount(): number { return this.registry.size; }

  reset(): void { this.registry.clear(); this.aliasIndex.clear(); this.fuzzyIndex.clear(); }
}

let _fcnr: FactorCanonicalNamingRegistry | undefined;
export function getFactorCanonicalNamingRegistry(): FactorCanonicalNamingRegistry {
  if (!_fcnr) _fcnr = new FactorCanonicalNamingRegistry();
  return _fcnr;
}
export function resetFactorCanonicalNamingRegistry(): void { _fcnr?.reset(); _fcnr = undefined; }
