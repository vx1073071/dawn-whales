// ── R178 G11: AI Action Boundary Guard ──────────────────────────────────────
// Prevents AI from ever calling executable financial operations.
// Implementation: runtime caller detection + decorator-based forbidden marking.
//
// Usage:
//   import { aiForbidden, assertNotAICaller } from '../agents/ai-action-guard';
//   @aiForbidden
//   async executeStrategy(...) { ... }
//
//   function placeOrder(...) { assertNotAICaller('placeOrder'); ... }

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AIActionGuardConfig {
  /** Whether AI caller detection is active */
  enabled: boolean;
  /** Custom error message for blocked calls */
  forbiddenMessage: string;
  /** Additional stack patterns to detect as AI caller */
  aiCallerPatterns: string[];
  /** Telemetry: log every blocked call */
  auditLog: boolean;
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AIActionGuardConfig = {
  enabled: true,
  forbiddenMessage: '[AI_FORBIDDEN] AI initiated actions that require human confirmation are blocked.',
  aiCallerPatterns: [
    'ai-factor-advisor',
    'ai-output-guard',
    'ai-orchestrator',
    'agent-fundamentals',
    'agent-macro',
    'agent-sentiment',
    'agent-technical',
    'llm-call',
    'ai-recommend',
    'ai-gateway',
    'nl-parser',
  ],
  auditLog: true,
};

// ── State ───────────────────────────────────────────────────────────────────

let currentConfig: AIActionGuardConfig = { ...DEFAULT_CONFIG };

/** Total blocked calls since startup */
let totalBlocked = 0;

/** Recent blocked call history (last 20) */
const blockedHistory: Array<{
  timestamp: string;
  method: string;
  callerStack: string;
}> = [];

// ── Core Guard ──────────────────────────────────────────────────────────────

/**
 * Check whether the current call stack originates from an AI module.
 * Uses stack trace inspection to detect AI-originated calls.
 */
function isAICaller(): boolean {
  if (!currentConfig.enabled) return false;

  const stack = new Error().stack || '';
  const lowerStack = stack.toLowerCase();

  for (const pattern of currentConfig.aiCallerPatterns) {
    if (lowerStack.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Assert that the current method is NOT being called by AI.
 * Throws an error if AI caller detected.
 * Call this at the entry point of any executable financial operation.
 */
export function assertNotAICaller(methodName: string): void {
  if (!currentConfig.enabled) return;

  if (isAICaller()) {
    const stack = new Error().stack || '';
    const summary = stack.split('\n').slice(1, 6).map(l => l.trim()).join(' → ');

    if (currentConfig.auditLog) {
      log.warn(
        `[AIActionGuard] BLOCKED: ${methodName} called from AI context. ` +
        `Caller: ${summary.slice(0, 200)}`
      );
    }

    totalBlocked++;
    blockedHistory.push({
      timestamp: new Date().toISOString(),
      method: methodName,
      callerStack: summary.slice(0, 500),
    });

    // Keep only last 20
    if (blockedHistory.length > 20) {
      blockedHistory.shift();
    }

    throw new Error(`${currentConfig.forbiddenMessage} [method: ${methodName}]`);
  }
}

/**
 * Decorator for async methods — wraps function to check AI caller before execution.
 * Usage: @aiForbidden on any method that must never be called by AI.
 */
export function aiForbidden(
  _target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    assertNotAICaller(propertyKey);

    try {
      return await originalMethod.apply(this, args);
    } catch (error: unknown) {
      // Don't leak internal guard errors
      if (error instanceof Error && error.message.startsWith('[AI_FORBIDDEN]')) {
        throw error; // Re-throw guard errors as-is
      }
      throw error;
    }
  };

  return descriptor;
}

/**
 * Sync version of aiForbidden for synchronous methods.
 */
export function aiForbiddenSync(
  _target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    assertNotAICaller(propertyKey);
    return originalMethod.apply(this, args);
  };

  return descriptor;
}

// ── Configuration ───────────────────────────────────────────────────────────

/** Get current guard config */
export function getAIGuardConfig(): Readonly<AIActionGuardConfig> {
  return { ...currentConfig };
}

/** Update guard config (for testing or admin override) */
export function updateAIGuardConfig(partial: Partial<AIActionGuardConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
  log.info('[AIActionGuard] Config updated:', JSON.stringify(partial));
}

/** Reset config to defaults */
export function resetAIGuardConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
  log.info('[AIActionGuard] Config reset to defaults');
}

// ── Statistics ──────────────────────────────────────────────────────────────

/** Get total blocked calls since startup */
export function getTotalBlocked(): number {
  return totalBlocked;
}

/** Get recent blocked call history */
export function getBlockedHistory(): Readonly<typeof blockedHistory> {
  return [...blockedHistory];
}

/** Get guard statistics for admin dashboard */
export function getGuardStats(): {
  totalBlocked: number;
  recentBlocks: number;
  blockedMethods: Record<string, number>;
  enabled: boolean;
} {
  const recentBlocks = blockedHistory.filter(
    b => Date.now() - new Date(b.timestamp).getTime() < 3600000, // last hour
  ).length;

  const blockedMethods: Record<string, number> = {};
  for (const b of blockedHistory) {
    blockedMethods[b.method] = (blockedMethods[b.method] || 0) + 1;
  }

  return {
    totalBlocked,
    recentBlocks,
    blockedMethods,
    enabled: currentConfig.enabled,
  };
}

// ── Reset for testing ───────────────────────────────────────────────────────

export function resetGuardStats(): void {
  totalBlocked = 0;
  blockedHistory.length = 0;
  currentConfig = { ...DEFAULT_CONFIG };
}

log.info('[AIActionGuard] Initialized — AI executable operations locked down');
