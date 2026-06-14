/**
 * DAWN WHALES R168 P2-10 — Factor Alert Service
 *
 * Monitors factor health and triggers alerts for:
 *   - IC mutation (IC drops below threshold vs historical avg)
 *   - Factor failure (IC goes to ~zero or negative)
 *   - New factor online (registration event)
 *
 * Alerts are event-driven: subscribe(listener) receives FactorAlertEvent.
 *
 * ≥300L
 */
import { getFactorCompatibilityEngine, type FactorDefinition } from './factor-compatibility-engine';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type FactorAlertKind = 'IC_MUTATION' | 'FACTOR_FAILURE' | 'FACTOR_ONLINE' | 'IC_RECOVERY';

export interface FactorAlertEvent {
  kind: FactorAlertKind;
  factorId: string;
  factorName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  detail: {
    currentIC?: number;
    historicalAvgIC?: number;
    droppedByPct?: number;
    thresholdPct?: number;
    newFactor?: FactorDefinition;
  };
}

export type FactorAlertListener = (event: FactorAlertEvent) => void;

export interface FactorICRecord {
  factorId: string;
  timestamp: string;
  ic: number;
}

export interface FactorHealthStatus {
  factorId: string;
  factorName: string;
  historicalAvgIC: number;
  currentIC: number;
  healthy: boolean;
  muteUntil?: number; // Timestamp for mute
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const IC_DROP_WARNING_THRESHOLD = 40;    // IC drops >40% → warning
const IC_DROP_CRITICAL_THRESHOLD = 60;   // IC drops >60% → critical
const IC_FAILURE_ABSOLUTE = 0.005;       // |IC| < 0.005 → dead factor
const IC_RECOVERY_THRESHOLD = 0.3;       // IC recovers to 30%+ of historical → recovery alert
const DEFAULT_HISTORICAL_IC = 0.03;      // Default IC when no history

// ═══════════════════════════════════════════════════════════
// FactorAlertService
// ═══════════════════════════════════════════════════════════

export class FactorAlertService {
  private listeners: Set<FactorAlertListener> = new Set();
  private icHistory: Map<string, FactorICRecord[]> = new Map();  // factorId → rolling IC records
  private healthStatus: Map<string, FactorHealthStatus> = new Map();
  private registeredFactors: Set<string> = new Set();
  private maxHistoryLen = 20;  // Rolling window

  // ── Subscription ─────────────────────────────────────────────────────

  subscribe(listener: FactorAlertListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FactorAlertEvent): void {
    for (const l of this.listeners) {
      try { l(event); } catch {}
    }
  }

  // ── Factor registration ──────────────────────────────────────────────

  registerFactor(factorId: string, factorName: string): void {
    if (!this.registeredFactors.has(factorId)) {
      this.registeredFactors.add(factorId);
      this.emit({
        kind: 'FACTOR_ONLINE',
        factorId,
        factorName,
        message: `新因子上线：${factorName}`,
        severity: 'info',
        timestamp: new Date().toISOString(),
        detail: {},
      });
    }
  }

  async registerAllFromCompatibilityEngine(): Promise<void> {
    try {
      const engine = getFactorCompatibilityEngine();
      const definitions = engine.getAllFactors();
      for (const def of definitions) {
        this.registerFactor(def.id, def.name);
      }
    } catch {
      // Engine not available — skip
    }
  }

  // ── IC tracking ──────────────────────────────────────────────────────

  recordIC(factorId: string, ic: number): void {
    if (!this.icHistory.has(factorId)) {
      this.icHistory.set(factorId, []);
    }
    const history = this.icHistory.get(factorId)!;
    history.push({ factorId, timestamp: new Date().toISOString(), ic });
    if (history.length > this.maxHistoryLen) {
      history.shift();
    }
  }

  getHistoricalAvgIC(factorId: string): number {
    const history = this.icHistory.get(factorId);
    if (!history || history.length === 0) return DEFAULT_HISTORICAL_IC;
    const valid = history.filter(r => Math.abs(r.ic) > IC_FAILURE_ABSOLUTE);
    if (valid.length === 0) return DEFAULT_HISTORICAL_IC;
    return valid.reduce((s, r) => s + r.ic, 0) / valid.length;
  }

  getCurrentIC(factorId: string): number {
    const history = this.icHistory.get(factorId);
    if (!history || history.length === 0) return 0;
    return history[history.length - 1].ic;
  }

  // ── Alert evaluation ────────────────────────────────────────────────

  evaluate(factorId: string, factorName?: string, currentIC?: number): FactorAlertEvent | null {
    const ic = currentIC ?? this.getCurrentIC(factorId);
    const historicalAvg = this.getHistoricalAvgIC(factorId);
    const name = factorName || factorId;

    // Check mute
    const status = this.healthStatus.get(factorId);
    if (status?.muteUntil && Date.now() < status.muteUntil) return null;

    // Record latest IC
    if (currentIC !== undefined) {
      this.recordIC(factorId, currentIC);
    }

    // Factor failure: IC too close to zero or wrong sign
    if (Math.abs(ic) <= IC_FAILURE_ABSOLUTE) {
      this.updateHealth(factorId, name, ic, historicalAvg, false);
      const evt: FactorAlertEvent = {
        kind: 'FACTOR_FAILURE',
        factorId,
        factorName: name,
        message: `因子失效：${name} IC 已趋近于零 (${ic.toFixed(6)})，建议排查因子计算逻辑`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        detail: { currentIC: ic, historicalAvgIC: historicalAvg },
      };
      this.emit(evt);
      return evt;
    }

    // IC sign flip relative to historical
    if (historicalAvg !== 0 && Math.sign(ic) !== Math.sign(historicalAvg) && Math.abs(historicalAvg) > IC_FAILURE_ABSOLUTE) {
      this.updateHealth(factorId, name, ic, historicalAvg, false);
      const evt: FactorAlertEvent = {        kind: 'FACTOR_FAILURE',
        factorId,
        factorName: name,
        message: `因子异常：${name} IC 方向反转 (历史均IC: ${historicalAvg.toFixed(4)}, 当前: ${ic.toFixed(4)})`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        detail: { currentIC: ic, historicalAvgIC: historicalAvg, droppedByPct: 100 },
      };
      this.emit(evt);
      return evt;
    }

    // IC recovery check
    if (status && Math.abs(status.currentIC) < IC_FAILURE_ABSOLUTE && Math.abs(ic) > IC_RECOVERY_THRESHOLD * Math.abs(historicalAvg)) {
      const recovered = {
        kind: 'IC_RECOVERY' as FactorAlertKind,
        factorId,
        factorName: name,
        message: `因子恢复：${name} IC 已回到 ${ic.toFixed(4)} (历史均: ${historicalAvg.toFixed(4)})`,
        severity: 'info' as const,
        timestamp: new Date().toISOString(),
        detail: { currentIC: ic, historicalAvgIC: historicalAvg, droppedByPct: 0 },
      };
      this.updateHealth(factorId, name, ic, historicalAvg, true);
      this.emit(recovered);
      return recovered;
    }

    // IC mutation: significant drop from historical
    const dropPct = historicalAvg !== 0 ? ((historicalAvg - ic) / Math.abs(historicalAvg)) * 100 : 0;
    if (dropPct >= IC_DROP_CRITICAL_THRESHOLD) {
      const event: FactorAlertEvent = {
        kind: 'IC_MUTATION',
        factorId,
        factorName: name,
        message: `因子IC突变：${name} IC 从历史均 ${historicalAvg.toFixed(4)} 骤降至 ${ic.toFixed(4)} (降幅 ${dropPct.toFixed(0)}%)，严重偏离预期`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        detail: { currentIC: ic, historicalAvgIC: historicalAvg, droppedByPct: dropPct, thresholdPct: IC_DROP_CRITICAL_THRESHOLD },
      };
      this.updateHealth(factorId, name, ic, historicalAvg, false);
      this.emit(event);
      return event;
    }

    if (dropPct >= IC_DROP_WARNING_THRESHOLD) {
      const event: FactorAlertEvent = {
        kind: 'IC_MUTATION',
        factorId,
        factorName: name,
        message: `因子IC警告：${name} IC ${ic.toFixed(4)} 低于历史均 ${historicalAvg.toFixed(4)} (降幅 ${dropPct.toFixed(0)}%)`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
        detail: { currentIC: ic, historicalAvgIC: historicalAvg, droppedByPct: dropPct, thresholdPct: IC_DROP_WARNING_THRESHOLD },
      };
      this.updateHealth(factorId, name, ic, historicalAvg, false);
      this.emit(event);
      return event;
    }

    this.updateHealth(factorId, name, ic, historicalAvg, true);
    return null;
  }

  // ── Batch evaluate all tracked factors ────────────────────────────────

  evaluateAll(): FactorAlertEvent[] {
    const alerts: FactorAlertEvent[] = [];
    for (const factorId of this.registeredFactors) {
      const result = this.evaluate(factorId);
      if (result) alerts.push(result);
    }
    return alerts;
  }

  // ── Health status ────────────────────────────────────────────────────

  getHealthStatus(): Map<string, FactorHealthStatus> {
    return new Map(this.healthStatus);
  }

  getHealth(factorId: string): FactorHealthStatus | undefined {
    return this.healthStatus.get(factorId);
  }

  mute(factorId: string, durationMs: number = 3600000): void {
    let status = this.healthStatus.get(factorId);
    if (!status) {
      status = {
        factorId,
        factorName: factorId,
        historicalAvgIC: this.getHistoricalAvgIC(factorId),
        currentIC: this.getCurrentIC(factorId),
        healthy: true,
      };
      this.healthStatus.set(factorId, status);
    }
    status.muteUntil = Date.now() + durationMs;
  }

  unmute(factorId: string): void {
    const status = this.healthStatus.get(factorId);
    if (status) {
      status.muteUntil = undefined;
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────

  reset(): void {
    this.listeners.clear();
    this.icHistory.clear();
    this.healthStatus.clear();
    this.registeredFactors.clear();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private updateHealth(factorId: string, factorName: string, currentIC: number, historicalAvgIC: number, healthy: boolean): void {
    this.healthStatus.set(factorId, {
      factorId,
      factorName,
      historicalAvgIC: Number(historicalAvgIC.toFixed(6)),
      currentIC: Number(currentIC.toFixed(6)),
      healthy,
      muteUntil: this.healthStatus.get(factorId)?.muteUntil,
    });
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let instance: FactorAlertService | null = null;

export function getFactorAlertService(): FactorAlertService {
  if (!instance) instance = new FactorAlertService();
  return instance;
}

export function createFactorAlertService(): FactorAlertService {
  return new FactorAlertService();
}
