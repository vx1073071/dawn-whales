// ── R187 A1: Factor Correlation i18n ────────────────────────────────────────
// 8-language terminology for factor correlation descriptions.
// Used by: FactorPK component, FactorCompatibilityEngine, correlation matrix UI.
//
// Correlation tiers:
//   strong_positive  (r > 0.7)  → "互补/协同"
//   moderate_positive (0.3-0.7) → "轻微相关"
//   independent      (|r| < 0.3)→ "独立/不相关"
//   moderate_negative (-0.7 to -0.3) → "弱冲突"
//   strong_negative  (r < -0.7) → "天然对冲/冲突"

// ── Correlation Tier ─────────────────────────────────────────────────────────

export type CorrelationTier =
  | 'strong_positive'
  | 'moderate_positive'
  | 'independent'
  | 'moderate_negative'
  | 'strong_negative';

export interface CorrelationI18n {
  label: string;               // e.g. "强正相关"
  metaphor: string;            // e.g. "一起涨一起跌，步调一致"
  marriage: string;            // 因子婚姻比喻 e.g. "天生一对，互补协同"
  adviceCN: string;            // 交易建议(中文)
  adviceEN: string;            // 交易建议(英文)
  icon: string;                // Emoji icon
}

// ── 8-Language Correlation Labels ────────────────────────────────────────────

interface LocaleCorrelation {
  strong_positive: string;
  moderate_positive: string;
  independent: string;
  moderate_negative: string;
  strong_negative: string;
  rRange: string;              // "r=%.2f"
  rSquared: string;            // "r²=%.2f"
}

const CORRELATION_LOCALES: Record<string, LocaleCorrelation> = {
  'zh-CN': {
    strong_positive: '强正相关',
    moderate_positive: '中度正相关',
    independent: '独立性高',
    moderate_negative: '中度负相关',
    strong_negative: '强负相关',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  'zh-TW': {
    strong_positive: '強正相關',
    moderate_positive: '中度正相關',
    independent: '獨立性高',
    moderate_negative: '中度負相關',
    strong_negative: '強負相關',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  en: {
    strong_positive: 'Strong Positive',
    moderate_positive: 'Moderate Positive',
    independent: 'Independent',
    moderate_negative: 'Moderate Negative',
    strong_negative: 'Strong Negative',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  ja: {
    strong_positive: '強い正相関',
    moderate_positive: '中程度の正相関',
    independent: '独立性が高い',
    moderate_negative: '中程度の負相関',
    strong_negative: '強い負相関',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  ko: {
    strong_positive: '강한 양의 상관관계',
    moderate_positive: '중간 양의 상관관계',
    independent: '독립적',
    moderate_negative: '중간 음의 상관관계',
    strong_negative: '강한 음의 상관관계',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  fr: {
    strong_positive: 'Forte corrélation positive',
    moderate_positive: 'Corrélation positive modérée',
    independent: 'Indépendant',
    moderate_negative: 'Corrélation négative modérée',
    strong_negative: 'Forte corrélation négative',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  it: {
    strong_positive: 'Forte correlazione positiva',
    moderate_positive: 'Correlazione positiva moderata',
    independent: 'Indipendente',
    moderate_negative: 'Correlazione negativa moderata',
    strong_negative: 'Forte correlazione negativa',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
  de: {
    strong_positive: 'Starke positive Korrelation',
    moderate_positive: 'Mäßige positive Korrelation',
    independent: 'Unabhängig',
    moderate_negative: 'Mäßige negative Korrelation',
    strong_negative: 'Starke negative Korrelation',
    rRange: 'r=%.2f',
    rSquared: 'r²=%.2f',
  },
};

// ── Correlation Descriptions (CN + EN) ──────────────────────────────────────

export const CORRELATION_TIER_META: Record<CorrelationTier, CorrelationI18n> = {
  strong_positive: {
    label: '强正相关',
    metaphor: '夫妻同心，形影不离 — 一个涨另一个几乎必涨',
    marriage: '💍 天生一对：同涨同跌，协同完美',
    adviceCN: '二选一即可，同时持有过多此类因子浪费仓位',
    adviceEN: 'Pick one — holding multiple duplicates wastes allocation',
    icon: '💍',
  },
  moderate_positive: {
    label: '中度正相关',
    metaphor: '闺蜜逛街 — 大多数时候一起走，偶尔分头行动',
    marriage: '👫 好朋友：多数时候同向，偶尔独立发挥',
    adviceCN: '可以搭配但要控制总权重，r²>0.5时警惕共振',
    adviceEN: 'Use together but cap total weight; watch for resonance when r²>0.5',
    icon: '👫',
  },
  independent: {
    label: '独立性高',
    metaphor: '陌生人 — 各走各的路，互不影响',
    marriage: '🤝 独立个体：各自发挥，互不干扰',
    adviceCN: '理想的因子组合！独立因子可有效分散风险，提高Sharpe',
    adviceEN: 'Ideal pairing! Independent factors diversify risk and improve Sharpe',
    icon: '🤝',
  },
  moderate_negative: {
    label: '中度负相关',
    metaphor: '跷跷板 — 一个上去另一个会下来，但节奏不完全同步',
    marriage: '🎭 冤家：经常反着走但并非绝对',
    adviceCN: '可构建自然对冲，低波动组合首选，但要测极端行情',
    adviceEN: 'Build natural hedge; ideal for low-vol portfolios; stress-test extremes',
    icon: '🎭',
  },
  strong_negative: {
    label: '强负相关',
    metaphor: '镜像倒影 — 你向左它向右，几乎精确相反',
    marriage: '⚔️ 天然对冲：此消彼长，完美对冲',
    adviceCN: '完美对冲工具！牛熊双吃。但要警惕\"对冲失灵\"(极端行情下负相关可能崩溃)',
    adviceEN: 'Perfect hedge! Capture both up and down. Watch for correlation breakdown in extremes',
    icon: '⚔️',
  },
};

// ── Utility Functions ────────────────────────────────────────────────────────

/** Map correlation coefficient r to a tier */
export function rToTier(r: number): CorrelationTier {
  const absR = Math.abs(r);
  if (absR >= 0.7) return r > 0 ? 'strong_positive' : 'strong_negative';
  if (absR >= 0.3) return r > 0 ? 'moderate_positive' : 'moderate_negative';
  return 'independent';
}

/** Get correlation tier label in a specific language */
export function getCorrelationLabel(tier: CorrelationTier, lang: string = 'zh-CN'): string {
  const locale = CORRELATION_LOCALES[lang] ?? CORRELATION_LOCALES['en'];
  return locale[tier];
}

/** Get full correlation tier i18n description */
export function getCorrelationI18n(r: number, lang: string = 'zh-CN'): {
  tier: CorrelationTier;
  label: string;
  metaphor: string;
  marriage: string;
  advice: string;
  icon: string;
  rFormatted: string;
  r2Formatted: string;
} {
  const tier = rToTier(r);
  const meta = CORRELATION_TIER_META[tier];
  const locale = CORRELATION_LOCALES[lang] ?? CORRELATION_LOCALES['en'];

  return {
    tier,
    label: locale[tier],
    metaphor: meta.metaphor,
    marriage: meta.marriage,
    advice: lang.startsWith('zh') ? meta.adviceCN : meta.adviceEN,
    icon: meta.icon,
    rFormatted: locale.rRange.replace('%.2f', r.toFixed(2)),
    r2Formatted: locale.rSquared.replace('%.2f', (r * r).toFixed(2)),
  };
}

/** Get correlation advice for a factor pair */
export function getCorrelationPairAdvice(
  factorA: string,
  factorB: string,
  r: number,
  lang: string = 'zh-CN',
): string {
  const tier = rToTier(r);
  const meta = CORRELATION_TIER_META[tier];
  const cnNameA = factorA; // caller should pass CN names
  const cnNameB = factorB;

  const base = lang.startsWith('zh')
    ? `${cnNameA} vs ${cnNameB}: ${meta.label}`
    : `${cnNameA} vs ${cnNameB}: ${getCorrelationLabel(tier, 'en')}`;

  const advice = lang.startsWith('zh') ? meta.adviceCN : meta.adviceEN;

  return `${base} (r=${r.toFixed(3)}, r²=${(r * r).toFixed(3)}) — ${meta.icon} ${advice}`;
}

/** Supported languages for correlation i18n */
export const CORRELATION_SUPPORTED_LANGS = Object.keys(CORRELATION_LOCALES);

/** All correlation tier labels in a given language (for UI dropdowns/legends) */
export function getAllCorrelationLabels(lang: string = 'zh-CN'): Record<CorrelationTier, string> {
  const locale = CORRELATION_LOCALES[lang] ?? CORRELATION_LOCALES['en'];
  return {
    strong_positive: locale.strong_positive,
    moderate_positive: locale.moderate_positive,
    independent: locale.independent,
    moderate_negative: locale.moderate_negative,
    strong_negative: locale.strong_negative,
  };
}

/** Quick correlation format string: "强正相关 (r=0.85, r²=0.72)" */
export function formatCorrelationBrief(r: number, lang: string = 'zh-CN'): string {
  const tier = rToTier(r);
  const label = getCorrelationLabel(tier, lang);
  const locale = CORRELATION_LOCALES[lang] ?? CORRELATION_LOCALES['en'];
  const rStr = locale.rRange.replace('%.2f', r.toFixed(2));
  const r2Str = locale.rSquared.replace('%.2f', (r * r).toFixed(2));
  return `${label} (${rStr}, ${r2Str})`;
}

export default {
  CORRELATION_TIER_META,
  CORRELATION_LOCALES,
  rToTier,
  getCorrelationLabel,
  getCorrelationI18n,
  getCorrelationPairAdvice,
  getAllCorrelationLabels,
  formatCorrelationBrief,
  CORRELATION_SUPPORTED_LANGS,
};
