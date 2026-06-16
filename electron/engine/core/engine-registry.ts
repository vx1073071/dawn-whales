// ── QUANT MOO — Engine Registry ─────────────────────────────────────────────
// Q-36-02: Global singleton registry for all engine instances
// Solves: ConditionEngine ↔ TradeExecutor ↔ RiskEngine circular dependency
// Pattern: lazy initialization + dependency injection via registry

import log from 'electron-log';
import { EngineError } from './engine-error';


// ── Engine Interface ────────────────────────────────────────────────────────

export interface IEngine {
  start?(): void;
  stop?(): void;
  destroy?(): void;
  getConfig?(): unknown;
}

export type EngineType =
  | 'condition'
  | 'trade-executor'
  | 'risk'
  | 'risk-v3'
  | 'strategy'
  | 'rebalance'
  | 'closed-loop'
  | 'performance-tracker'
  | 'position-monitor'
  | 'nl-parser'
  | 'backtest'
  | 'sentiment'
  | 'market-data'
  | 'broker';

export interface EngineEntry {
  name: string;
  type: EngineType;
  instance: IEngine;
  version: string;
  startTime?: number;
  status: 'created' | 'running' | 'stopped' | 'error';
}

// ── EngineRegistry Class ────────────────────────────────────────────────────

export class EngineRegistry {
  private static _instance: EngineRegistry | null = null;
  private engines: Map<string, EngineEntry> = new Map();
  private initTime: number = Date.now();

  private constructor() {
    log.info('[EngineRegistry] Initialized');
  }

  // ── Singleton ─────────────────────────────────────────────────────────────

  static getInstance(): EngineRegistry {
    if (!EngineRegistry._instance) {
      EngineRegistry._instance = new EngineRegistry();
    }
    return EngineRegistry._instance;
  }

  /**
   * Reset singleton — for testing only
   */
  static reset(): void {
    EngineRegistry._instance = null;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  register(name: string, engine: IEngine, type: EngineType, version: string = '1.0.0'): void {
    if (this.engines.has(name)) {
      log.warn(`[EngineRegistry] Engine "${name}" already registered, replacing`);
    }

    const entry: EngineEntry = {
      name,
      type,
      instance: engine,
      version,
      status: 'created',
    };

    this.engines.set(name, entry);
    log.info(`[EngineRegistry] Registered engine: ${name} (${type}) v${version}`);
  }

  /**
   * Unregister an engine by name
   */
  unregister(name: string): boolean {
    const deleted = this.engines.delete(name);
    if (deleted) {
      log.info(`[EngineRegistry] Unregistered engine: ${name}`);
    }
    return deleted;
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  getEngine<T extends IEngine = IEngine>(name: string): T | null {
    const entry = this.engines.get(name);
    if (!entry) {
      log.warn(`[EngineRegistry] Engine "${name}" not found`);
      return null;
    }
    return entry.instance as T;
  }

  getEntry(name: string): EngineEntry | null {
    return this.engines.get(name) || null;
  }

  hasEngine(name: string): boolean {
    return this.engines.has(name);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  listEngines(): EngineEntry[] {
    return Array.from(this.engines.values());
  }

  listByType(type: EngineType): EngineEntry[] {
    return this.listEngines().filter(e => e.type === type);
  }

  getStats(): {
    total: number;
    running: number;
    stopped: number;
    created: number;
    error: number;
    uptimeMs: number;
  } {
    const entries = this.listEngines();
    return {
      total: entries.length,
      running: entries.filter(e => e.status === 'running').length,
      stopped: entries.filter(e => e.status === 'stopped').length,
      created: entries.filter(e => e.status === 'created').length,
      error: entries.filter(e => e.status === 'error').length,
      uptimeMs: Date.now() - this.initTime,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start all registered engines that have a start() method
   */
  startAll(): void {
    for (const entry of this.engines.values()) {
      if (entry.status === 'running') continue;
      try {
        entry.instance.start?.();
        entry.status = 'running';
        entry.startTime = Date.now();
        log.info(`[EngineRegistry] Started: ${entry.name}`);
      } catch (err: unknown) {
        entry.status = 'error';
        log.error(`[EngineRegistry] Failed to start ${entry.name}: ${err.message}`);
      }
    }
  }

  /**
   * Stop all registered engines that have a stop() method
   */
  stopAll(): void {
    for (const entry of this.engines.values()) {
      if (entry.status !== 'running') continue;
      try {
        entry.instance.stop?.();
        entry.status = 'stopped';
        log.info(`[EngineRegistry] Stopped: ${entry.name}`);
      } catch (err: unknown) {
        log.error(`[EngineRegistry] Error stopping ${entry.name}: ${err.message}`);
      }
    }
  }

  /**
   * Destroy all engines and clear the registry
   */
  destroyAll(): void {
    for (const entry of this.engines.values()) {
      try {
        entry.instance.destroy?.();
        log.info(`[EngineRegistry] Destroyed: ${entry.name}`);
      } catch (err: unknown) {
        log.error(`[EngineRegistry] Error destroying ${entry.name}: ${err.message}`);
      }
    }
    this.engines.clear();
    log.info('[EngineRegistry] All engines destroyed');
  }

  /**
   * Verify all engines in the registry are healthy (no error status)
   */
  isHealthy(): boolean {
    return this.listEngines().every(e => e.status !== 'error');
  }
}
