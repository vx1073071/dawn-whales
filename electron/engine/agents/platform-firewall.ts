// ── R178 G17: Platform Data Firewall ─────────────────────────────────────────
// Guards platform-sensitive data (revenue, wallet, user stats) from
// unauthorized access. Validates caller source (internal/external) and
// applies permission checks.
//
// Usage:
//   import { guardPlatformData } from '../agents/platform-firewall';
//   function getPlatformStats() { guardPlatformData('getPlatformStats'); ... }

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export type CallerSource = 'internal' | 'external' | 'ipc' | 'ai';

export interface FirewallConfig {
  enabled: boolean;
  /** Which callers are allowed for platform data */
  allowedCallers: CallerSource[];
  /** Audit all access attempts */
  auditAccess: boolean;
}

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FirewallConfig = {
  enabled: true,
  allowedCallers: ['internal', 'ipc'], // internal engine + IPC only, NOT 'ai'
  auditAccess: true,
};

let config: FirewallConfig = { ...DEFAULT_CONFIG };

// ── Access History ──────────────────────────────────────────────────────────

interface AccessRecord {
  timestamp: string;
  endpoint: string;
  caller: CallerSource;
  allowed: boolean;
}

const accessHistory: AccessRecord[] = [];
const MAX_HISTORY = 100;

// ── Core Guard ──────────────────────────────────────────────────────────────

/**
 * Throw if caller is not in allowed list.
 * Must be called at entry of any platform-sensitive function.
 */
export function guardPlatformData(endpoint: string, caller: CallerSource = 'external'): void {
  if (!config.enabled) return;

  const allowed = config.allowedCallers.includes(caller);

  if (config.auditAccess) {
    accessHistory.push({
      timestamp: new Date().toISOString(),
      endpoint,
      caller,
      allowed,
    });
    if (accessHistory.length > MAX_HISTORY) accessHistory.shift();
  }

  if (!allowed) {
    log.warn(`[PlatformFirewall] BLOCKED: ${endpoint} from ${caller} (not in allowlist)`);
    throw new Error(`[PLATFORM_FIREWALL] Access denied: ${endpoint} restricted to ${config.allowedCallers.join(', ')} callers only.`);
  }

  if (config.auditAccess) {
    log.info(`[PlatformFirewall] ALLOWED: ${endpoint} from ${caller}`);
  }
}

/**
 * Quick check — returns true if access allowed (no throw).
 */
export function canAccessPlatformData(endpoint: string, caller: CallerSource = 'external'): boolean {
  try {
    guardPlatformData(endpoint, caller);
    return true;
  } catch {
    return false;
  }
}

// ── Configuration ───────────────────────────────────────────────────────────

export function getFirewallConfig(): Readonly<FirewallConfig> {
  return { ...config };
}

export function updateFirewallConfig(partial: Partial<FirewallConfig>): void {
  config = { ...config, ...partial };
  log.info('[PlatformFirewall] Config updated:', JSON.stringify(partial));
}

export function resetFirewallConfig(): void {
  config = { ...DEFAULT_CONFIG };
  accessHistory.length = 0;
}

// ── Audit ───────────────────────────────────────────────────────────────────

/** Get recent access history for admin dashboard */
export function getAccessHistory(): Readonly<AccessRecord[]> {
  return [...accessHistory];
}

/** Get access statistics */
export function getFirewallStats(): {
  totalAccesses: number;
  blockedAccesses: number;
  blockedByEndpoint: Record<string, number>;
  enabled: boolean;
} {
  const blockedByEndpoint: Record<string, number> = {};
  let blockedAccesses = 0;

  for (const record of accessHistory) {
    if (!record.allowed) {
      blockedAccesses++;
      blockedByEndpoint[record.endpoint] = (blockedByEndpoint[record.endpoint] || 0) + 1;
    }
  }

  return {
    totalAccesses: accessHistory.length,
    blockedAccesses,
    blockedByEndpoint,
    enabled: config.enabled,
  };
}

log.info('[PlatformFirewall] Initialized — platform data locked down');
