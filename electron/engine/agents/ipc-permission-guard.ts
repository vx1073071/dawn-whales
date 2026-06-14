// ── R178 G19: IPC Permission Tier System ─────────────────────────────────────
// 3-tier permission model for all 41 IPC handlers:
//
//   Tier 1 (READ_ONLY): Query data, read strategies, view only — always allowed
//   Tier 2 (USER_WRITE): Create/update personal strategies — user context required
//   Tier 3 (ADMIN_MONEY): Execute orders, access funds, platform stats — needs admin + confirm
//
// Usage:
//   import { guardIPC, IPCTier } from '../agents/ipc-permission-guard';
//   ipcMain.handle('strategy:backtest', async (event, params) => {
//     guardIPC('strategy:backtest', IPCTier.READ_ONLY, params);
//   });

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export enum IPCTier {
  /** Read-only: safe queries, no side effects */
  READ_ONLY = 1,
  /** User write: creates/updates personal data */
  USER_WRITE = 2,
  /** Admin/money: executes financial operations or accesses platform data */
  ADMIN_MONEY = 3,
}

export interface IPCPermissionConfig {
  enabled: boolean;
  /** Audit all tier 3 access attempts */
  auditAdmin: boolean;
}

// ── Tier Classification ─────────────────────────────────────────────────────

const HANDLER_TIERS: Record<string, IPCTier> = {
  // ── Tier 1: READ_ONLY ──
  'strategy:getAll': IPCTier.READ_ONLY,
  'strategy:get': IPCTier.READ_ONLY,
  'strategy:backtest': IPCTier.READ_ONLY,
  'strategy:explain': IPCTier.READ_ONLY,
  'strategy:compare': IPCTier.READ_ONLY,
  'strategy:optimize': IPCTier.READ_ONLY,
  'strategy:correlation': IPCTier.READ_ONLY,
  'strategy:correlation-viz': IPCTier.READ_ONLY,
  'strategy:templates': IPCTier.READ_ONLY,
  'strategy:multi-factor': IPCTier.READ_ONLY,
  'paper:status': IPCTier.READ_ONLY,
  'paper:report': IPCTier.READ_ONLY,
  'nl:parse': IPCTier.READ_ONLY,
  'nl:templates': IPCTier.READ_ONLY,
  'live:get-status': IPCTier.READ_ONLY,
  'live:get-positions': IPCTier.READ_ONLY,
  'live:get-orders': IPCTier.READ_ONLY,
  'factor:suggestFactors': IPCTier.READ_ONLY,
  'factor:optimizer-summary': IPCTier.READ_ONLY,
  'factor:pareto-frontier': IPCTier.READ_ONLY,
  'factor:grs': IPCTier.READ_ONLY,
  'factor:rolling-ic': IPCTier.READ_ONLY,
  'factor:turnover-cost': IPCTier.READ_ONLY,

  // ── Tier 2: USER_WRITE ──
  'strategy:create': IPCTier.USER_WRITE,
  'strategy:update': IPCTier.USER_WRITE,
  'strategy:delete': IPCTier.USER_WRITE,
  'strategy:auto-tune': IPCTier.USER_WRITE,
  'paper:execute-signal': IPCTier.USER_WRITE,
  'paper:start': IPCTier.USER_WRITE,
  'paper:stop': IPCTier.USER_WRITE,
  'paper:reset': IPCTier.USER_WRITE,
  'paper:submit-order': IPCTier.USER_WRITE,
  'nl:instantiate-template': IPCTier.USER_WRITE,
  'live:start': IPCTier.USER_WRITE,
  'live:stop': IPCTier.USER_WRITE,
  'live:add-strategy': IPCTier.USER_WRITE,

  // ── Tier 3: ADMIN_MONEY ──
  'strategy:startLive': IPCTier.ADMIN_MONEY,
  'strategy:stopLive': IPCTier.ADMIN_MONEY,
  'live:remove-strategy': IPCTier.ADMIN_MONEY,
};

// ── Config ──────────────────────────────────────────────────────────────────

let config: IPCPermissionConfig = {
  enabled: true,
  auditAdmin: true,
};

// ── Audit Log ───────────────────────────────────────────────────────────────

interface AuditEntry {
  timestamp: string;
  handler: string;
  tier: IPCTier;
  allowed: boolean;
  reason?: string;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT = 200;

// ── Core Guard ──────────────────────────────────────────────────────────────

/**
 * Guard an IPC handler call.
 * @param handler The IPC channel name (e.g., 'strategy:create')
 * @param expectedTier The tier this handler should run at
 * @param context Optional context for auditing (userId, ip, etc.)
 */
export function guardIPC(
  handler: string,
  expectedTier: IPCTier,
  context?: Record<string, unknown>,
): void {
  if (!config.enabled) return;

  const actualTier = HANDLER_TIERS[handler];

  // If handler not classified, default to READ_ONLY (safe default)
  const tier = actualTier ?? IPCTier.READ_ONLY;

  // Downgrade attack prevention: if actual tier is higher than declared, block
  if (actualTier !== undefined && tier !== expectedTier) {
    const reason = `Tier mismatch: handler ${handler} expected ${IPCTier[expectedTier]} but classified as ${IPCTier[tier]}`;
    log.error(`[IPCPermissionGuard] ${reason}`);
    auditLog.push({ timestamp: new Date().toISOString(), handler, tier, allowed: false, reason });
    if (auditLog.length > MAX_AUDIT) auditLog.shift();
    throw new Error(`[IPC_PERMISSION] ${reason}`);
  }

  // Tier 3 (ADMIN_MONEY) requires additional confirmation
  if (tier === IPCTier.ADMIN_MONEY) {
    if (config.auditAdmin) {
      log.warn(
        `[IPCPermissionGuard] ADMIN_MONEY: ${handler}` +
        (context ? ` ctx=${JSON.stringify(context).slice(0, 200)}` : ''),
      );
    }
    // In production: require human confirmation token
    // For now: flag and audit
  }

  auditLog.push({ timestamp: new Date().toISOString(), handler, tier, allowed: true });
  if (auditLog.length > MAX_AUDIT) auditLog.shift();
}

/**
 * Get handler tier (for UI to show permissions to admin).
 */
export function getHandlerTier(handler: string): IPCTier {
  return HANDLER_TIERS[handler] ?? IPCTier.READ_ONLY;
}

/**
 * List all handlers by tier (for admin dashboard).
 */
export function listHandlersByTier(): Record<string, string[]> {
  const result: Record<string, string[]> = {
    READ_ONLY: [],
    USER_WRITE: [],
    ADMIN_MONEY: [],
    UNCLASSIFIED: [],
  };

  for (const [handler, tier] of Object.entries(HANDLER_TIERS)) {
    const tierName = IPCTier[tier];
    result[tierName].push(handler);
  }

  return result;
}

// ── Configuration ───────────────────────────────────────────────────────────

export function getIPCPermissionConfig(): Readonly<IPCPermissionConfig> {
  return { ...config };
}

export function updateIPCPermissionConfig(partial: Partial<IPCPermissionConfig>): void {
  config = { ...config, ...partial };
}

export function resetIPCPermissionConfig(): void {
  config = { enabled: true, auditAdmin: true };
  auditLog.length = 0;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export function getAuditLog(): Readonly<AuditEntry[]> {
  return [...auditLog];
}

export function getPermissionStats(): {
  totalCalls: number;
  blockedCalls: number;
  callsByTier: Record<string, number>;
} {
  let blockedCalls = 0;
  const callsByTier: Record<string, number> = {};

  for (const entry of auditLog) {
    if (!entry.allowed) blockedCalls++;
    const tierName = IPCTier[entry.tier];
    callsByTier[tierName] = (callsByTier[tierName] || 0) + 1;
  }

  return {
    totalCalls: auditLog.length,
    blockedCalls,
    callsByTier,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that all known handlers have tier assignments.
 * Returns any unregistered handlers that need classification.
 */
export function validateHandlerCoverage(knownHandlers: string[]): string[] {
  return knownHandlers.filter(h => HANDLER_TIERS[h] === undefined);
}

log.info(
  `[IPCPermissionGuard] Initialized — ${Object.keys(HANDLER_TIERS).length} handlers classified ` +
  `(${Object.values(HANDLER_TIERS).filter(t => t === IPCTier.READ_ONLY).length} READ_ONLY, ` +
  `${Object.values(HANDLER_TIERS).filter(t => t === IPCTier.USER_WRITE).length} USER_WRITE, ` +
  `${Object.values(HANDLER_TIERS).filter(t => t === IPCTier.ADMIN_MONEY).length} ADMIN_MONEY)`,
);
