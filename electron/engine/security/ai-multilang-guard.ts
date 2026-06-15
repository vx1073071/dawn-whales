// ── R183 P2-06: Multi-Language Security Annotations ──────────────────────────
// Enhances existing guards with Chinese/English/Japanese pattern coverage.
// Attackers often switch languages to bypass single-language regex rules.
//
// Strategy: tri-lingual keyword maps for each guard category.
// Applied as overlay on top of existing regex-based guards.

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export type SupportedLang = 'zh' | 'en' | 'ja';

export interface MultiLangKeywordMap {
  category: string;
  zh: string[];
  en: string[];
  ja: string[];
  severity: number; // 0-10
}

// ── Multi-Language Keyword Maps ─────────────────────────────────────────────

export const MULTILANG_KEYWORD_MAPS: MultiLangKeywordMap[] = [
  // ── Financial manipulation ────────────────────────────────────────────
  {
    category: 'FINANCIAL_MANIPULATION',
    zh: ['保证', '一定赚', '稳赚', '包赚', '必涨', '铁定涨', '绝对不会亏', '100%安全'],
    en: ['guaranteed', 'risk-free', 'sure win', 'cannot lose', '100% safe', 'guaranteed profit'],
    ja: ['保証', '絶対儲かる', 'リスクなし', '確実', '100%安全', '必ず上がる'],
    severity: 10,
  },
  {
    category: 'INSIDER_CLAIM',
    zh: ['内部消息', '内幕', '庄家', '主力资金', '有可靠消息', '内部人士'],
    en: ['insider info', 'insider trading', 'tip off', 'reliable source', 'inside knowledge'],
    ja: ['内部情報', 'インサイダー', '確かな情報源', '裏情報'],
    severity: 10,
  },
  {
    category: 'LEVERAGE_PUSH',
    zh: ['加杠杆', '借钱炒股', '配资', '满仓干', '全仓', '梭哈', 'all in'],
    en: ['leverage up', 'borrow to trade', 'go all in', 'margin trade', 'max position'],
    ja: ['レバレッジ', '借金で投資', '全力買い', 'マージン'],
    severity: 8,
  },
  {
    category: 'ACCOUNT_ACCESS',
    zh: ['密码', '验证码', '登录', '账户密码', '支付密码'],
    en: ['password', 'verification code', 'login', 'account password', 'PIN'],
    ja: ['パスワード', '認証コード', 'ログイン', '暗証番号'],
    severity: 9,
  },
  {
    category: 'PLATFORM_ATTACK',
    zh: ['漏洞', '后门', '破解', '绕过', '攻击', '注入', 'exploit'],
    en: ['vulnerability', 'backdoor', 'exploit', 'bypass', 'injection', 'hack'],
    ja: ['脆弱性', 'バックドア', 'エクスプロイト', 'バイパス', 'インジェクション'],
    severity: 10,
  },
  {
    category: 'CODE_INJECTION',
    zh: ['<script', 'javascript:', 'onerror=', 'eval(', '系统提示词'],
    en: ['<script', 'javascript:', 'onerror=', 'eval(', 'system prompt'],
    ja: ['<script', 'javascript:', 'onerror=', 'eval(', 'システムプロンプト'],
    severity: 10,
  },
  {
    category: 'AMOUNT_SIGNAL',
    zh: ['万', '亿', '千万', '百万', '亿元'],
    en: ['million', 'billion', 'thousand dollars', 'grand', 'bucks'],
    ja: ['万円', '億円', '百万', '千万'],
    severity: 4,
  },
  {
    category: 'PERSONAL_DATA',
    zh: ['身份证', '银行卡号', '住址', '家庭地址', '真实姓名'],
    en: ['ID number', 'bank account', 'home address', 'real name', 'SSN'],
    ja: ['マイナンバー', '口座番号', '住所', '本名'],
    severity: 8,
  },
];

// ── Detection API ───────────────────────────────────────────────────────────

/**
 * Check text against multi-language keyword maps.
 * Returns detected categories with matched keywords.
 */
export function detectMultiLangThreats(text: string): Array<{
  category: string;
  matchedKeywords: string[];
  languages: SupportedLang[];
  severity: number;
}> {
  const results: Array<{
    category: string;
    matchedKeywords: string[];
    languages: SupportedLang[];
    severity: number;
  }> = [];

  for (const map of MULTILANG_KEYWORD_MAPS) {
    const matchedKeywords: string[] = [];
    const langs = new Set<SupportedLang>();

    for (const lang of ['zh', 'en', 'ja'] as SupportedLang[]) {
      for (const kw of map[lang]) {
        if (text.toLowerCase().includes(kw.toLowerCase())) {
          matchedKeywords.push(kw);
          langs.add(lang);
        }
      }
    }

    if (matchedKeywords.length > 0) {
      results.push({
        category: map.category,
        matchedKeywords,
        languages: [...langs],
        severity: map.severity,
      });
    }
  }

  return results;
}

/**
 * Quick multi-language pre-screen.
 * Returns true if text contains any threat keywords.
 */
export function multiLangPreScreen(text: string): {
  safe: boolean;
  totalThreats: number;
  maxSeverity: number;
  categories: string[];
} {
  const threats = detectMultiLangThreats(text);
  const maxSeverity = threats.reduce((m, t) => Math.max(m, t.severity), 0);

  return {
    safe: threats.length === 0,
    totalThreats: threats.length,
    maxSeverity,
    categories: threats.map(t => t.category),
  };
}

/**
 * Detect language of input text (simple heuristic).
 */
export function detectTextLanguage(text: string): SupportedLang {
  let zh = 0, en = 0, ja = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) zh++;
    else if (code >= 0x3040 && code <= 0x30ff) ja++;  // Hiragana + Katakana
    else if (code >= 0x61 && code <= 0x7a) en++;       // a-z
  }

  if (ja > zh && ja > en) return 'ja';
  if (zh > en) return 'zh';
  return 'en';
}
