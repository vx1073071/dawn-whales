// ── R182 P1-08: Semantic Similarity Guard ────────────────────────────────────
// Detects AI output that circumvents regex rules by rewording.
//
// Problem: Regex guards catch "你的余额是 1000 USDT" but miss
//          "你在平台上的价值等价于一万美元等值的稳定币".
//
// Solution: Track known-blocked patterns, compute semantic similarity
//           (word overlap + keyword co-occurrence), flag circumvention.
//
// Lightweight: no external API, uses Jaccard similarity + keyword weighting.

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SemanticRule {
  category: string;
  triggerWords: string[];     // 触发词
  contextWords: string[];     // 上下文词（需共现才触发）
  minCooccurrence: number;    // 最少共现数
  severity: number;           // 0-10
  explanation: string;        // Human-readable explanation
}

export interface SemanticMatch {
  rule: string;
  category: string;
  severity: number;
  matchedTriggers: string[];
  matchedContext: string[];
  explanation: string;
}

export interface SemanticCheckResult {
  passed: boolean;
  totalScore: number;
  threshold: number;
  matches: SemanticMatch[];
  summary: string;
  safeToDeliver: boolean;
}

// ── Semantic Rules ──────────────────────────────────────────────────────────

const SEMANTIC_RULES: SemanticRule[] = [
  // Financial advice circumventing role guard
  {
    category: 'FINANCIAL_ADVICE',
    triggerWords: ['建议', '推荐', '应该', '最好', '必须', '绝对', '一定'],
    contextWords: ['买入', '卖出', '加仓', '减仓', '全仓', '清仓', '杠杆', '重仓', '抄底', '逃顶'],
    minCooccurrence: 2,
    severity: 7,
    explanation: 'AI输出包含投资操作建议（买入/卖出/仓位），可能被解读为投资建议',
  },
  // Amount circumvention
  {
    category: 'AMOUNT_CIRCUMVENTION',
    triggerWords: ['价值', '等价', '相当于', '约等于', '折算', '大概'],
    contextWords: ['万', '亿', '成', '倍', '翻', '半仓', '满仓', '仓位'],
    minCooccurrence: 2,
    severity: 6,
    explanation: 'AI输出通过隐喻方式描述了金额规模，绕过了数字检测',
  },
  // System prompt fishing detection
  {
    category: 'PROMPT_FISHING',
    triggerWords: ['你的', '你是', '作为', '称为', '名字叫'],
    contextWords: ['模型', '系统', '程序', 'AI', '机器人', '指令', '规则', '限制', '边界'],
    minCooccurrence: 3,
    severity: 8,
    explanation: 'AI输出暴露了系统角色或内部配置信息',
  },
  // Risk guarantee circumvention
  {
    category: 'RISK_GUARANTEE',
    triggerWords: ['稳', '不会亏', '一定赚', '肯定涨', '必涨', '铁定'],
    contextWords: ['收益', '回报', '涨', '赚', '利润', '盈利'],
    minCooccurrence: 2,
    severity: 9,
    explanation: 'AI输出隐含收益保证，违反合规要求',
  },
  // Market prediction without disclaimers
  {
    category: 'MARKET_PREDICTION',
    triggerWords: ['明天', '下周', '月底', '年底', '即将', '马上', '未来几天'],
    contextWords: ['涨', '跌', '牛市', '熊市', '反弹', '反转', '突破', '崩盘'],
    minCooccurrence: 2,
    severity: 6,
    explanation: 'AI输出包含市场预测（涉及具体时间窗口），应附带风险提示',
  },
  // Proprietary data leak
  {
    category: 'PROPRIETARY_DATA',
    triggerWords: ['内部', '我们的', '平台的', '系统的'],
    contextWords: ['数据', '算法', '模型', '策略', '因子', '权重', '参数'],
    minCooccurrence: 2,
    severity: 7,
    explanation: 'AI输出可能泄露平台自有因子权重或策略参数',
  },
  // Emotional manipulation
  {
    category: 'EMOTIONAL_MANIPULATION',
    triggerWords: ['别担心', '相信我', '放心', '没问题', '肯定', '绝对安全'],
    contextWords: ['投资', '买', '卖', '加仓', '持有', '亏损', '风险'],
    minCooccurrence: 2,
    severity: 5,
    explanation: 'AI输出包含情绪安抚用语，可能降低用户风险意识',
  },
];

// ── Text similarity helpers ─────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two token sets.
 * Range: 0 (no overlap) to 1 (identical).
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Tokenize Chinese/English text into meaningful words.
 * Chinese: approximate by bigrams. English: split by whitespace/punctuation.
 */
function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();

  // English/punctuation-separated words
  for (const word of text.toLowerCase().split(/[\s,，。！？、：；""''（）\(\)]+/)) {
    if (word.length >= 1) tokens.add(word);
  }

  // Chinese bigrams (rough: every 2 consecutive characters)
  const chineseChars = text.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < chineseChars.length - 1; i++) {
    tokens.add(chineseChars.substring(i, i + 2));
  }

  return tokens;
}

/**
 * Compute semantic similarity between two texts.
 * Combines Jaccard similarity + keyword co-occurrence weighting.
 */
function semanticSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  const jaccard = jaccardSimilarity(tokens1, tokens2);

  // Keyword bonus: specific financial terms boost similarity weight
  const financialKeywords = ['IC', 'Sharpe', '波动', '回撤', '收益', '风险', '因子', '因子', '权重', 'ETF', '动量', '价值', '质量'];
  const kw1 = financialKeywords.filter(k => text1.includes(k));
  const kw2 = financialKeywords.filter(k => text2.includes(k));
  const kwOverlap = kw1.filter(k => kw2.includes(k)).length;

  const keywordBonus = kwOverlap / Math.max(kw1.length + kw2.length, 1) * 0.3;

  return Math.min(1, jaccard + keywordBonus);
}

// ── Main API ────────────────────────────────────────────────────────────────

/**
 * Check AI output against semantic circumvention rules.
 * Returns matches and overall safety assessment.
 */
export function semanticCheck(text: string): SemanticCheckResult {
  const matches: SemanticMatch[] = [];
  let totalScore = 0;

  for (const rule of SEMANTIC_RULES) {
    const matchedTriggers = rule.triggerWords.filter(w => text.includes(w));
    const matchedContext = rule.contextWords.filter(w => text.includes(w));
    const cooccurrence = matchedTriggers.length + matchedContext.length;

    if (matchedTriggers.length > 0 && cooccurrence >= rule.minCooccurrence) {
      totalScore += rule.severity;
      matches.push({
        rule: rule.category,
        category: rule.category,
        severity: rule.severity,
        matchedTriggers,
        matchedContext,
        explanation: rule.explanation,
      });
    }
  }

  const threshold = 12;
  const passed = totalScore < threshold;

  const summary = passed
    ? matches.length > 0
      ? `语义检测通过: ${matches.length}个低危匹配(共${totalScore}分)`
      : '语义检测通过: 未发现可疑语义模式'
    : `语义检测告警: ${matches.length}个匹配(共${totalScore}分，阈值${threshold})`;

  if (!passed) {
    log.warn(`[SemanticGuard] ${summary}`);
  }

  return {
    passed,
    totalScore,
    threshold,
    matches,
    summary,
    safeToDeliver: totalScore < 18, // absolute cap: even if threshold exceeded, allow if < 18
  };
}

/**
 * Check if two texts are semantically similar (potential circumvention).
 * Used to compare AI output against known blocked patterns.
 */
export function detectCircumvention(aiOutput: string, knownBlockedPatterns: string[]): {
  circumvention: boolean;
  similarTo: string[];
  maxSimilarity: number;
} {
  const similarTo: string[] = [];
  let maxSimilarity = 0;

  for (const pattern of knownBlockedPatterns) {
    const sim = semanticSimilarity(aiOutput, pattern);
    if (sim > maxSimilarity) maxSimilarity = sim;
    if (sim > 0.5) {
      similarTo.push(`"${pattern.substring(0, 50)}..." (${(sim * 100).toFixed(0)}%)`);
    }
  }

  return {
    circumvention: similarTo.length > 0,
    similarTo,
    maxSimilarity,
  };
}
