// ── R179 G20: Sensitive Field Masker ───────────────────────────────────────
// Central masking utility for all user-sensitive data before it leaves
// the engine boundary (AI context, logs, IPC output).
//
// Masks:
//   wallet*        → **** (complete hide)
//   email          → xyz@abc.com → xy***@abc.com
//   accountId      → ***-last4
//   balance        → **** (complete hide)
//   phone/address  → ****
//
// Usage:
//   import { maskSensitiveFields, maskWallet, maskEmail } from './sensitive-field-masker';
//   const safe = maskSensitiveFields(userData);

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MaskConfig {
  enabled: boolean;
  /** Audit all masking operations */
  auditMasking: boolean;
}

export interface MaskResult {
  masked: boolean;
  field: string;
  originalLength: number;
  timestamp: string;
}

export interface MaskedUserData {
  [key: string]: unknown;
}

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: MaskConfig = {
  enabled: true,
  auditMasking: true,
};

let config: MaskConfig = { ...DEFAULT_CONFIG };
const maskLog: MaskResult[] = [];
const MAX_LOG = 200;

// ── Field Blacklist ─────────────────────────────────────────────────────────

/** Fields that must NEVER appear in plaintext outside engine boundary */
const SENSITIVE_FIELDS = new Set([
  'wallet',
  'walletBalance',
  'wallet_balance',
  'balance',
  'accountBalance',
  'totalBalance',
  'usdtBalance',
  'availableBalance',
  'lockedBalance',
  'email',
  'phone',
  'phoneNumber',
  'address',
  'privateKey',
  'apiKey',
  'apiSecret',
  'secret',
  'token',
  'password',
  'passphrase',
  'ssn',
  'taxId',
  'idNumber',
  'creditCard',
  'bankAccount',
]);

/** Email-like fields that get partial masking (not full hide) */
const EMAIL_FIELDS = new Set(['email', 'userEmail', 'contactEmail', 'recoveryEmail']);

// ── Core Masks ──────────────────────────────────────────────────────────────

/**
 * Mask wallet/balance fields completely. "1234.56" → "****"
 */
export function maskWallet(value: unknown): string {
  if (value === null || value === undefined) return '****';
  if (typeof value === 'number') return '****';
  const s = String(value);
  if (s.length === 0) return '****';
  return '****';
}

/**
 * Mask email to pattern: "user@example.com" → "us***@example.com"
 * Short emails: "a@b.com" → "***@b.com"
 */
export function maskEmail(value: unknown): string {
  if (!value || typeof value !== 'string') return '***@***';
  const parts = value.split('@');
  if (parts.length !== 2) return '***@***';

  const local = parts[0];
  const domain = parts[1];

  if (local.length <= 2) return `***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Mask account ID: "DW-A1B2C3D4E5F6" → "***-D4E5"
 */
export function maskAccountId(value: unknown): string {
  if (!value || typeof value !== 'string') return '***';
  const s = String(value);
  if (s.length <= 4) return '***';
  return `***-${s.slice(-4)}`;
}

// ── Object Masks ────────────────────────────────────────────────────────────

/**
 * Recursively mask all sensitive fields in an object.
 * Returns a new object — does NOT mutate the input.
 */
export function maskSensitiveFields(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '****'; // recursion guard
  if (!config.enabled) return obj;

  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveFields(item, depth + 1));
  }

  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[\s_-]/g, '');

    // Check if this is a known sensitive field
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
      if (EMAIL_FIELDS.has(key)) {
        result[key] = maskEmail(value);
      } else {
        result[key] = maskWallet(value);
      }

      if (config.auditMasking) {
        maskLog.push({
          masked: true,
          field: key,
          originalLength: typeof value === 'string' ? value.length : 0,
          timestamp: new Date().toISOString(),
        });
        if (maskLog.length > MAX_LOG) maskLog.shift();
      }
    } else if (typeof value === 'object') {
      result[key] = maskSensitiveFields(value, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Mask a single field value based on its semantic type.
 * Use when you have a single scalar, not an object.
 */
export function maskField(fieldName: string, value: unknown): unknown {
  if (!config.enabled) return value;

  const lower = fieldName.toLowerCase().replace(/[\s_-]/g, '');
  if (SENSITIVE_FIELDS.has(fieldName) || SENSITIVE_FIELDS.has(lower)) {
    if (EMAIL_FIELDS.has(fieldName)) return maskEmail(value);
    return maskWallet(value);
  }
  return value;
}

/**
 * Quick check: does this key name look sensitive?
 */
export function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase().replace(/[\s_-]/g, '');
  return SENSITIVE_FIELDS.has(fieldName) || SENSITIVE_FIELDS.has(lower);
}

// ── Configuration ───────────────────────────────────────────────────────────

export function getMaskConfig(): Readonly<MaskConfig> {
  return { ...config };
}

export function updateMaskConfig(partial: Partial<MaskConfig>): void {
  config = { ...config, ...partial };
}

export function resetMaskConfig(): void {
  config = { ...DEFAULT_CONFIG };
  maskLog.length = 0;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export function getMaskAuditLog(): Readonly<MaskResult[]> {
  return [...maskLog];
}

export function getMaskStats(): {
  totalMasks: number;
  fieldsMasked: Record<string, number>;
  enabled: boolean;
} {
  const fieldsMasked: Record<string, number> = {};
  for (const entry of maskLog) {
    if (entry.masked) {
      fieldsMasked[entry.field] = (fieldsMasked[entry.field] || 0) + 1;
    }
  }

  return {
    totalMasks: maskLog.length,
    fieldsMasked,
    enabled: config.enabled,
  };
}

log.info('[SensitiveFieldMasker] Initialized — wallet+email+balance fields auto-masked');
