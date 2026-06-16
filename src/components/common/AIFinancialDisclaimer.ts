// @ts-nocheck
/**
* AIFinancialDisclaimer — ML R178 G15 [P0] 金融免责声明注入
* Appended to every AI-generated response to comply with regulatory requirements.
* Per 2026-06-08 Chinese six-ministry financial data classification guidelines.
*/

import i18n from '../../i18n';

// ── Disclaimer templates ───────────────────────────────────────────────

type DisclaimerType = 'factor_analysis' | 'strategy_recommendation' | 'market_view' | 'trading_signal' | 'general';

interface DisclaimerConfig {
  type: DisclaimerType;
  key: string;
  severity: 'info' | 'warning' | 'critical';
}

const DISCLAIMERS: Record<DisclaimerType, string> = {
  general: i18n.t('AIFinancialDisclaimer.general') ||
    '⚠️ 以上内容由AI生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。',
  factor_analysis: i18n.t('AIFinancialDisclaimer.factorAnalysis') ||
    '⚠️ 因子分析基于历史数据回测，过去表现不代表未来收益。因子IC可能随时间变化而衰减。',
  strategy_recommendation: i18n.t('AIFinancialDisclaimer.strategyRecommendation') ||
    '⚠️ 策略建议仅供参考，不构成投资建议。实际交易前请考虑个人风险承受能力。过去表现不代表未来结果。',
  market_view: i18n.t('AIFinancialDisclaimer.marketView') ||
    '⚠️ 市场观点基于当前数据，未来可能发生变化。投资有风险，请谨慎决策。',
  trading_signal: i18n.t('AIFinancialDisclaimer.tradingSignal') ||
    '⚠️ 交易信号由AI模型生成，可能存在误差。请结合自身判断做出决策。历史胜率不代表未来胜率。',
};

// ── Main function ──────────────────────────────────────────────────────

/**
 * Detect disclaimer type based on AI response content.
 */
function detectType(content: string): DisclaimerType {
  if (/交易信号|买入|卖出|做多|做空|开仓|平仓|entry|exit/.test(content)) return 'trading_signal';
  if (/策略|配置|权重|因子组合|建议配置/.test(content)) return 'strategy_recommendation';
  if (/因子.*IC|因子.*分析|因子.*表现|因子.*得分/.test(content)) return 'factor_analysis';
  if (/市场|大盘|趋势|宏观|展望|行情/.test(content)) return 'market_view';
  return 'general';
}

/**
 * Inject financial disclaimer at the end of AI-generated content.
 * @param content - Raw AI response text
 * @param type - Optional override for disclaimer type (auto-detect if omitted)
 * @returns Content with disclaimer appended
 */
export function injectDisclaimer(content: string, type?: DisclaimerType): string {
  const detectedType = type || detectType(content);
  const disclaimer = DISCLAIMERS[detectedType] || DISCLAIMERS.general;

  // Don't double-append
  if (content.includes('⚠️ 以上内容由AI生成') || content.includes('不构成投资建议')) {
    return content;
  }

  return `${content.trim()}\n\n---\n${disclaimer}`;
}

/**
 * Strip financial sensitive data from AI response for display.
 * Replaces precise numbers with qualitative labels.
 */
export function stripFinancialSensitive(content: string): string {
  let result = content;

  // Replace exact wallet balances with qualitative labels
  result = result.replace(
    /(余额|wallet|balance)[：:]\s*\$?\d[\d,.]*\s*(USDT|USD|HKD|CNY)?/gi,
    (_match, label) => `${label}: *** (已隐藏)`
  );

  // Replace exact share counts
  result = result.replace(
    /(持仓|position|hold)[：:]\s*\d[\d,.]*\s*(股|shares?)/gi,
    (_match, label) => `${label}: *** (已隐藏)`
  );

  // Replace exact PnL
  result = result.replace(
    /([+-]?\$?\d[\d,.]*\s*(USDT|USD|HKD|CNY)\s*(盈利|亏损|profit|loss))/gi,
    '*** (已隐藏)'
  );

  // Replace user IDs
  result = result.replace(
    /(user[_ ]?id|用户ID)[：:]\s*[a-zA-Z0-9_-]+/gi,
    (_match, label) => `${label}: ***`
  );

  return result;
}

/**
 * Wrap AI response with full safety pipeline:
 * 1. Strip financial sensitive data
 * 2. Inject appropriate disclaimer
 */
export function sanitizeAIResponse(content: string, type?: DisclaimerType): string {
  const stripped = stripFinancialSensitive(content);
  return injectDisclaimer(stripped, type);
}

export default sanitizeAIResponse;
