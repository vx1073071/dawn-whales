/**
 * AIDegradationChain — R201 J3: 4级AI降级链 (重构自 ai-fallback.ts)
 *
 * v17.9 4-Level Chain:
 *   Level 0: DeepSeek V4 Pro (discounted) — 平台优惠价
 *   Level 1: DeepSeek V4 Pro (full price) — 标准价
 *   Level 2: DeepSeek V4 Flash        — 轻量快速
 *   Level 3: MiniMax M3                — 第三方兜底
 *
 * Key Rules:
 *   - 用户始终付 1U (不管降级到哪级, 平台承担差价)
 *   - 每级超时 30s
 *   - 非超时错误不重试同级
 *   - 5次失败后 cooldown 60s * failCount
 *   - 4级全失败 -> refund 1U
 *
 * Failure modes: timeout(30s) / rate-limit(429) / server-error(5xx) / token-limit / malformed
 *
 * >=250L production-ready
 */

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type AIModelLevel = 0 | 1 | 2 | 3;

export interface DegradationModel {
  level: AIModelLevel;
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  maxTokens: number;
  timeoutMs: number;
  /** Cost per 1K tokens in USDT (platform cost, not user price) */
  platformCostPer1K: number;
  /** User always pays 1U flat regardless of model */
  enabled: boolean;
}

export interface DegradationResult<T> {
  success: boolean;
  data?: T;
  levelUsed: AIModelLevel;
  modelUsed: string;
  attempts: number;
  totalTimeMs: number;
  platformCost: number;
  userPaid: number;       // always 1U on success, 0 on full failure + refund
  errors: DegradationError[];
}

export interface DegradationError {
  level: AIModelLevel;
  model: string;
  reason: string;
  retryable: boolean;
  timestamp: Date;
}

export interface DegradationHealth {
  models: Record<string, { level: AIModelLevel; enabled: boolean; failures: number; inCooldown: boolean }>;
  activeLevels: number;
  totalFailures: number;
}

// ── 4-Level Model Registry ─────────────────────────────────────────────────

const DEGRADATION_MODELS: DegradationModel[] = [
  {
    level: 0, id: 'deepseek-v4-pro-discount', name: 'DeepSeek V4 Pro (discounted)',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    maxTokens: 4096, timeoutMs: 30_000,
    platformCostPer1K: 0.0005, enabled: true,
  },
  {
    level: 1, id: 'deepseek-v4-pro-full', name: 'DeepSeek V4 Pro (full price)',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    maxTokens: 4096, timeoutMs: 30_000,
    platformCostPer1K: 0.001, enabled: true,
  },
  {
    level: 2, id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    maxTokens: 2048, timeoutMs: 15_000,
    platformCostPer1K: 0.0003, enabled: true,
  },
  {
    level: 3, id: 'minimax-m3', name: 'MiniMax M3',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    apiKey: process.env.MINIMAX_API_KEY || '',
    maxTokens: 4096, timeoutMs: 30_000,
    platformCostPer1K: 0.002, enabled: true,
  },
];

// ── AIDegradationChain ────────────────────────────────────────────────────

export class AIDegradationChain {
  private failCounts: Map<string, number> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private readonly COOLDOWN_BASE_MS = 60_000;
  private readonly MAX_FAILURES = 5;
  private readonly USER_CHARGE_USDT = 1;

  /**
   * Execute a request through the 4-level degradation chain.
   *
   * @param executeFn - Function that takes a model and returns a result. Throw on failure.
   * @returns DegradationResult with data from the first successful level.
   */
  async execute<T>(executeFn: (model: DegradationModel) => Promise<T>): Promise<DegradationResult<T>> {
    const t0 = Date.now();
    const errors: DegradationError[] = [];
    const activeModels = this.getActiveModels();

    if (activeModels.length === 0) {
      return { success: false, levelUsed: 3, modelUsed: 'none', attempts: 0, totalTimeMs: 0,
        platformCost: 0, userPaid: 0, errors: [{ level: 3, model: 'none',
        reason: 'All models in cooldown or disabled', retryable: true, timestamp: new Date() }] };
    }

    for (const model of activeModels) {
      const levelStart = Date.now();
      log.info(`[Degradation] Trying Level ${model.level}: ${model.name}`);

      try {
        const result = await Promise.race([
          executeFn(model),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${model.name} exceeded ${model.timeoutMs}ms`)),
              model.timeoutMs)
          ),
        ]);

        // Success!
        this.recordSuccess(model.id);
        const totalMs = Date.now() - t0;
        const tokenEstimate = 2000; // assume ~2K tokens per request
        log.info(`[Degradation] Level ${model.level} ${model.name} succeeded in ${Date.now() - levelStart}ms. User charged ${this.USER_CHARGE_USDT}U.`);

        return {
          success: true, data: result, levelUsed: model.level,
          modelUsed: model.name, attempts: errors.length + 1,
          totalTimeMs: totalMs,
          platformCost: model.platformCostPer1K * tokenEstimate / 1000,
          userPaid: this.USER_CHARGE_USDT,
          errors,
        };
      } catch (err: any) {
        const msg = err?.message || String(err);
        const classified = classifyError(err);
        log.warn(`[Degradation] Level ${model.level} ${model.name} failed: ${classified.reason} -> ${msg}`);

        errors.push({
          level: model.level, model: model.name,
          reason: `${classified.reason}: ${msg}`,
          retryable: classified.retryable,
          timestamp: new Date(),
        });

        if (!classified.retryable) {
          this.recordFailure(model.id);
        } else {
          // Timeout/rate-limit/server-error -> cooldown
          this.recordFailure(model.id);
        }

        // Continue to next level
      }
    }

    // All 4 levels failed
    const totalMs = Date.now() - t0;
    log.error(`[Degradation] All ${activeModels.length} models failed. ${errors.length} errors. Refunding ${this.USER_CHARGE_USDT}U.`);

    return {
      success: false, levelUsed: 3, modelUsed: 'none',
      attempts: errors.length, totalTimeMs: totalMs,
      platformCost: 0, userPaid: 0, errors,
    };
  }

  /** Get models that are enabled and not in cooldown */
  private getActiveModels(): DegradationModel[] {
    const now = Date.now();
    return DEGRADATION_MODELS
      .filter(m => {
        if (!m.enabled) return false;
        const cd = this.cooldowns.get(m.id);
        if (cd && now < cd) return false;
        return true;
      })
      .sort((a, b) => a.level - b.level);
  }

  /** Get all models regardless of state (for health check) */
  getAllModels(): DegradationModel[] { return [...DEGRADATION_MODELS]; }

  recordFailure(modelId: string): void {
    const count = (this.failCounts.get(modelId) || 0) + 1;
    this.failCounts.set(modelId, count);
    if (count >= this.MAX_FAILURES) {
      const cdMs = this.COOLDOWN_BASE_MS * count;
      this.cooldowns.set(modelId, Date.now() + cdMs);
      log.warn(`[Degradation] ${modelId} cooldown for ${cdMs / 1000}s (${count} failures)`);
    }
  }

  recordSuccess(modelId: string): void {
    this.failCounts.set(modelId, 0);
    this.cooldowns.delete(modelId);
  }

  getHealth(): DegradationHealth {
    const now = Date.now();
    const models: Record<string, any> = {};
    let activeLevels = 0;
    let totalFailures = 0;

    for (const m of DEGRADATION_MODELS) {
      const cd = this.cooldowns.get(m.id);
      const inCd = cd ? now < cd : false;
      if (m.enabled && !inCd) activeLevels++;
      totalFailures += this.failCounts.get(m.id) || 0;
      models[m.id] = { level: m.level, enabled: m.enabled, failures: this.failCounts.get(m.id) || 0, inCooldown: inCd };
    }

    return { models, activeLevels, totalFailures };
  }

  enableModel(modelId: string): void {
    const m = DEGRADATION_MODELS.find(x => x.id === modelId);
    if (m) m.enabled = true;
  }

  disableModel(modelId: string): void {
    const m = DEGRADATION_MODELS.find(x => x.id === modelId);
    if (m) m.enabled = false;
  }

  reset(): void { this.failCounts.clear(); this.cooldowns.clear(); }

  /** Get the nearest healthy model (fastest path to success) */
  getBestAvailableModel(): DegradationModel | undefined {
    return this.getActiveModels()[0];
  }

  /** Get platform cost estimate for best available model */
  getEstimatedPlatformCost(): number {
    const model = this.getBestAvailableModel();
    return model ? model.platformCostPer1K * 2 : 0; // assume 2K tokens
  }
}

// ── Error Classification ─────────────────────────────────────────────────

function classifyError(error: any): { retryable: boolean; reason: string } {
  const msg = (error?.message || String(error)).toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return { retryable: true, reason: 'timeout' };
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return { retryable: true, reason: 'rate_limited' };
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
    return { retryable: true, reason: 'server_error' };
  }
  if (msg.includes('token') && (msg.includes('limit') || msg.includes('exceed'))) {
    return { retryable: false, reason: 'token_limit' };
  }
  if (msg.includes('invalid') || msg.includes('malformed')) {
    return { retryable: false, reason: 'malformed_response' };
  }
  return { retryable: true, reason: 'unknown' };
}

// ── R220 JVS#4: 降级链透明化 (UI-facing) ────────────────────────────────

export interface DegradationInfoUI {
  actualModel: string;
  actualLevel: number;
  levelName: string;
  levelNames: Record<number, string>;
  modelDisplayName: string;
  originalModel: string;         // Level 0 name (best)
  costNote: string;
  isDegraded: boolean;
  degradationPath: string;       // human-readable: "Level 2: DeepSeek V4 Flash"
}

/** 4-level display names for UI */
const LEVEL_NAMES: Record<number, string> = {
  0: '旗舰(DeepSeek V4 Pro折扣)',
  1: '标准(DeepSeek V4 Pro)',
  2: '快速(DeepSeek V4 Flash)',
  3: '兜底(MiniMax M3)',
};

/**
 * Build transparent degradation info for display in UI.
 * Shows exactly which model handled the AI request and at which level.
 */
export function buildDegradationUIInfo(
  result: DegradationResult<any>,
  originalModelName?: string,
): DegradationInfoUI {
  const isDegraded = result.levelUsed > 0;
  const actualLevel = result.levelUsed;
  const modelDisplayName = result.modelUsed || 'unknown';
  const levelName = LEVEL_NAMES[actualLevel] || `Level ${actualLevel}`;
  const original = originalModelName || DEGRADATION_MODELS[0]?.name || 'DeepSeek V4 Pro';
  const degradationPath = isDegraded
    ? `降级到 L${actualLevel}: ${modelDisplayName}`
    : `L0: ${modelDisplayName}`;

  let costNote: string;
  if (!result.success) {
    costNote = '4级全失败 · 已退1U';
  } else if (isDegraded) {
    costNote = `已降级到L${actualLevel} · 平台承担差价 · 你只付1U`;
  } else {
    costNote = 'L0旗舰 · 1U';
  }

  return {
    actualModel: modelDisplayName,
    actualLevel,
    levelName,
    levelNames: LEVEL_NAMES,
    modelDisplayName,
    originalModel: original,
    costNote,
    isDegraded,
    degradationPath,
  };
}

/**
 * Get all model health for UI health panel display.
 * Returns per-model status with human-readable labels.
 */
export function getDegradationHealthUI(): Array<{
  level: number;
  label: string;
  modelName: string;
  enabled: boolean;
  inCooldown: boolean;
  failures: number;
  status: 'healthy' | 'cooldown' | 'disabled';
  statusText: string;
}> {
  const health = aiDegradationChain.getHealth();
  return DEGRADATION_MODELS.map(m => {
    const modelHealth = health.models[m.id];
    const enabled = modelHealth?.enabled ?? m.enabled;
    const inCooldown = modelHealth?.inCooldown ?? false;
    const failures = modelHealth?.failures ?? 0;

    let status: 'healthy' | 'cooldown' | 'disabled';
    let statusText: string;

    if (!enabled) {
      status = 'disabled';
      statusText = '已禁用';
    } else if (inCooldown) {
      status = 'cooldown';
      statusText = `冷却中(${failures}次失败)`;
    } else {
      status = 'healthy';
      statusText = '正常';
    }

    return {
      level: m.level,
      label: LEVEL_NAMES[m.level] || `Level ${m.level}`,
      modelName: m.name,
      enabled,
      inCooldown,
      failures,
      status,
      statusText,
    };
  });
}

/**
 * Get a single-line human-readable summary of current degradation state.
 * For inline UI display (e.g., "当前: DeepSeek V4 Flash (已降级2级)")
 */
export function getDegradationSummary(): {
  bestModel: string;
  bestLevel: number;
  activeModelCount: number;
  degradedModelCount: number;
  text: string;
} {
  const best = aiDegradationChain.getBestAvailableModel();
  const health = aiDegradationChain.getHealth();
  const active = Object.values(health.models).filter(m => m.enabled && !m.inCooldown).length;
  const degraded = Object.values(health.models).filter(m => m.inCooldown).length;

  let text: string;
  if (!best) {
    text = '⚠️ 无可用AI模型 (全部冷却或禁用)';
  } else if (best.level === 0) {
    text = `🟢 L0 旗舰 (${best.name})`;
  } else {
    text = `🟡 已降级到L${best.level} (${best.name}) - ${degraded}个模型在冷却`;
  }

  return {
    bestModel: best?.name || 'none',
    bestLevel: best?.level ?? -1,
    activeModelCount: active,
    degradedModelCount: degraded,
    text,
  };
}

// ── Export transparent execute (wraps existing chain) ─────────────────────

/**
 * Execute AI request with transparent degradation tracking.
 * Same as aiDegradationChain.execute() but returns UI-ready degradation info.
 */
export async function executeWithDegradationUI<T>(
  executeFn: (model: DegradationModel) => Promise<T>,
): Promise<{ result: DegradationResult<T>; uiInfo: DegradationInfoUI }> {
  const result = await aiDegradationChain.execute(executeFn);
  const uiInfo = buildDegradationUIInfo(result);
  return { result, uiInfo };
}

/** Singleton */
export const aiDegradationChain = new AIDegradationChain();
