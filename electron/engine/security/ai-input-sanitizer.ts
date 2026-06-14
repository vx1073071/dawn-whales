// ── R178 G14: AI Input Sanitizer ────────────────────────────────────────────
// Strips sensitive data from user input before it reaches AI models.
// Prevents: API key leakage, wallet balance exposure, PII, IP addresses.
//
// Applied at every AI-facing interface: recommend(), chat, factor advisor.

import log from 'electron-log';
// R179 G20: Sensitive field masker for wallet/email/balance
import { maskEmail, maskWallet, isSensitiveField, maskSensitiveFields } from '../agents/sensitive-field-masker';

// ── Patterns ────────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  { name: 'api_key', regex: /\b(sk-[a-zA-Z0-9]{20,})\b/g, replacement: '[API_KEY]' },
  { name: 'jwt_token', regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g, replacement: '[TOKEN]' },
  { name: 'wallet_balance', regex: /\b(walletBalance|钱包余额|账户余额|wallet_?balance)\s*[:：是为=]\s*[\d,.]+/gi, replacement: '$1: [已隐藏]' },
  { name: 'usdt_amount', regex: /\b(\d+[\d,.]*\s*(USDT|U)(?![\w]))/gi, replacement: '[金额]' },
  { name: 'ip_v4', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL]' },
  { name: 'credit_card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD]' },
  { name: 'phone_cn', regex: /\b1[3-9]\d{9}\b/g, replacement: '[PHONE]' },
  { name: 'id_number', regex: /\b\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g, replacement: '[ID]' },
  { name: 'password', regex: /\b(password|密码|secret|密钥)\s*[:：=]\s*\S+/gi, replacement: '$1: [已隐藏]' },
  { name: 'private_key', regex: /\b(-----BEGIN\s*(RSA|EC|DSA|OPENSSH)?\s*PRIVATE\s*KEY-----[\s\S]*?-----END)/gi, replacement: '[PRIVATE_KEY]' },
];

// ── Main API ────────────────────────────────────────────────────────────────

/**
 * Sanitize user input before it reaches any AI model.
 * Strips: API keys, tokens, wallet balances, PII, IPs, credentials.
 */
export function sanitizeForAI(input: string): string {
  let cleaned = input;
  let changed = false;

  for (const { name, regex, replacement } of SENSITIVE_PATTERNS) {
    const before = cleaned.length;
    cleaned = cleaned.replace(regex, replacement);
    if (cleaned.length !== before) {
      changed = true;
    }
  }

  if (changed) {
    log.info(`[Sanitizer] Input sanitized: ${input.length} → ${cleaned.length} chars`);
  }

  return cleaned;
}

/**
 * Check if input contains sensitive data without modifying it.
 * Returns list of detected sensitive categories.
 */
export function detectSensitiveData(input: string): string[] {
  const detected: string[] = [];
  for (const { name, regex } of SENSITIVE_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(input)) {
      detected.push(name);
    }
  }
  return detected;
}

/**
 * Sanitize a context object by masking sensitive fields.
 * Uses sensitive-field-masker for consistent masking across all modules.
 * Returns a deep copy with sensitive values replaced.
 */
export function sanitizeContextObject<T extends Record<string, unknown>>(obj: T): T {
  // R179 G20: Delegate to unified masker for consistency
  return maskSensitiveFields(obj) as T;
}
