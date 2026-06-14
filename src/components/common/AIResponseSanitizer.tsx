/**
* AIResponseSanitizer — ML R178 G25 [P0] AI回复财务脱敏组件
* Wraps AI response display to mask financial sensitive data.
* Balance → "充足/不足" | Position → fuzzy | PnL → hidden
*/

import { useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface AIResponseSanitizerProps {
  content: string;
  /** Tick if balance check should show qualitative labels */
  userBalance?: number;
  /** Min balance threshold for "充足" */
  balanceThreshold?: number;
  /** Maximum visible characters before "展开更多" */
  maxVisibleChars?: number;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function maskExactBalance(content: string): string {
  // Match patterns like "余额 250 USDT" or "balance: 1,234.56 USDT"
  return content.replace(
    /(余额|balance|wallet)[：:\s]*\$?\d[\d,.]*\s*(USDT|USD|HKD|CNY)?/gi,
    '余额: ***已隐藏***'
  );
}

function maskExactPosition(content: string): string {
  // Match "持仓 1000 股" or "position: 500 shares"
  return content.replace(
    /(持仓|position|hold|持有)[：:\s]*\d[\d,.]*\s*(股|shares?|张|contracts?)/gi,
    '持仓: ***已隐藏***'
  );
}

function maskExactPnL(content: string): string {
  // Match "+1,234.56 USDT 盈利" or "-500 HKD 亏损"
  return content.replace(
    /([+-]?\s*\$?\d[\d,.]*\s*(USDT|USD|HKD|CNY)\s*(盈利|亏损|profit|loss|收益))/gi,
    '***已隐藏***'
  );
}

function maskUserIDs(content: string): string {
  return content.replace(
    /(user[_ ]?id|用户[_ ]?ID|account[_ ]?id)[：:\s]*[a-zA-Z0-9_-]+/gi,
    '$1: ***'
  );
}

function maskAPIKeys(content: string): string {
  // Match patterns like "sk-..." or "api_key: ..."
  return content.replace(
    /(sk-[a-zA-Z0-9]{20,}|api[_-]?key[：:\s]*['\"]?[a-zA-Z0-9_-]{8,}['\"]?)/gi,
    '***已隐藏***'
  );
}

/**
 * Full mask pipeline for AI response content.
 */
export function sanitizeAIContent(raw: string): string {
  let cleaned = raw;
  cleaned = maskAPIKeys(cleaned);
  cleaned = maskUserIDs(cleaned);
  cleaned = maskExactBalance(cleaned);
  cleaned = maskExactPnL(cleaned);
  cleaned = maskExactPosition(cleaned);
  return cleaned;
}

/**
 * Convert balance number to qualitative label.
 */
export function balanceLabel(balance: number, threshold = 100): string {
  if (balance <= 0) return '余额不足';
  if (balance < threshold) return '余额偏低';
  return '余额充足';
}

// ── Component ───────────────────────────────────────────────────────────

export default function AIResponseSanitizer({
  content,
  userBalance,
  balanceThreshold = 100,
  maxVisibleChars = 500,
  className = '',
}: AIResponseSanitizerProps) {
  const sanitized = useMemo(() => sanitizeAIContent(content), [content]);

  const balanceTag = useMemo(() => {
    if (userBalance === undefined) return null;
    const label = balanceLabel(userBalance, balanceThreshold);
    const color =
      label === '余额充足'
        ? 'text-green-400 bg-green-500/10 border-green-500/20'
        : label === '余额偏低'
        ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
        : 'text-red-400 bg-red-500/10 border-red-500/20';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${color}`}>
        💰 {label}
      </span>
    );
  }, [userBalance, balanceThreshold]);

  const isLong = sanitized.length > maxVisibleChars;
  const displayText = isLong ? sanitized.slice(0, maxVisibleChars) + '...' : sanitized;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Response text */}
      <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {displayText}
      </div>

      {/* Meta bar */}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          {balanceTag}
          <span className="text-gray-600">AI生成 · 仅供参考</span>
        </div>
        {isLong && (
          <button
            onClick={() => {
              // For full view, you'd use a state toggle — simplified here
            }}
            className="text-[#D4A853] hover:underline"
          >
            展开全部 ↓
          </button>
        )}
      </div>

      {/* Disclaimer footer */}
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded p-2 text-[10px] text-yellow-400/80 leading-relaxed">
        ⚠️ 以上内容由AI生成，仅供参考，不构成投资建议。投资有风险，入市需谨慎。过去表现不代表未来收益。
      </div>
    </div>
  );
}
