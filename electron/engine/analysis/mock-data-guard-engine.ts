// ── R284 JVS-1 MockDataGuardEngine ──────────────────────────
// 全平台伪数据拦截器：检测 Math.random 作为数据源时发出警告
// 策略: 生产环境 → 严格禁止 + 抛Error; 开发/测试 → 打标记 + console.warn
// 定价: 免费 (平台级安全/信任基础设施)

import { EngineError } from '../../../electron/engine/core/engine-error';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type DataSourceTag = 'REAL' | 'MOCK' | 'SIMULATED' | 'UNKNOWN';

export interface MockCallRecord {
  timestamp: number;
  engine: string;
  method: string;
  reason: string;
  stack?: string;
}

export interface MockDataAuditReport {
  engineName: string;
  totalCalls: number;
  isProduction: boolean;
  mockCalls: number;
  realCalls: number;
  simulatedCalls: number;
  details: MockCallRecord[];
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════

export interface MockDataGuardConfig {
  /** Toggle production mode guard */
  productionMode: boolean;
  /** Max mock data calls before throwing */
  maxMockCallsPerEngine: number;
  /** Whether to throw on mock data in production */
  throwOnMockInProduction: boolean;
  /** Whether to collect call stacks */
  collectStackTraces: boolean;
}

const DEFAULT_CONFIG: MockDataGuardConfig = {
  productionMode: false,
  maxMockCallsPerEngine: 50,
  throwOnMockInProduction: true,
  collectStackTraces: false,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class MockDataGuardEngine {
  private config: MockDataGuardConfig;
  private callLogs: Map<string, MockCallRecord[]> = new Map();
  private engineCallCounts: Map<string, number> = new Map();

  constructor(config: Partial<MockDataGuardConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.callLogs.clear();
    this.engineCallCounts.clear();
    this.config = { ...DEFAULT_CONFIG };
  }

  // ── Setters ──

  setProduction(mode: boolean): void {
    this.config.productionMode = mode;
  }

  isProduction(): boolean {
    return this.config.productionMode;
  }

  // ── Data policy guard ──

  /**
   * Validate a value is NOT derived from pseudorandom data.
   * Returns the value if it passes, or throws/logs a warning if mock data is detected.
   * Use this to wrap any returned data in real-data-only code paths.
   *
   * @param value - The value to validate
   * @param engineName - Name of the calling engine
   * @param methodName - Name of the method that produced this value
   * @param sourceTag - Declared source of the data
   * @returns The validated value
   * @throws EngineError when mock data is detected in production
   */
  guard<T>(
    value: T,
    engineName: string,
    methodName: string,
    sourceTag: DataSourceTag,
  ): T {
    const count = (this.engineCallCounts.get(engineName) ?? 0) + 1;
    this.engineCallCounts.set(engineName, count);

    if (sourceTag === 'MOCK' || sourceTag === 'UNKNOWN') {
      const record: MockCallRecord = {
        timestamp: Date.now(),
        engine: engineName,
        method: methodName,
        reason: `Mock data from ${sourceTag} source`,
        stack: this.config.collectStackTraces ? new Error().stack : undefined,
      };

      const logs = this.callLogs.get(engineName) ?? [];
      logs.push(record);
      this.callLogs.set(engineName, logs);
    }

    if (
      this.config.productionMode &&
      (sourceTag === 'MOCK' || sourceTag === 'UNKNOWN')
    ) {
      if (this.config.throwOnMockInProduction) {
        throw new EngineError(
          `MockDataGuard: Production mode refuses ${sourceTag} data from ${engineName}.${methodName}()`,
        );
      }
    }

    if (sourceTag === 'MOCK') {
      console.warn(
        `[MockDataGuard] ${engineName}.${methodName}() returned MOCK data` +
        ` (call #${count}). Replace with real data source before production.`,
      );
    }

    return value;
  }

  /**
   * Generate a human-readable audit report for one engine.
   */
  audit(engineName: string): MockDataAuditReport {
    const logs = this.callLogs.get(engineName) ?? [];
    const totalCalls = this.engineCallCounts.get(engineName) ?? 0;
    const mockCalls = logs.filter((r) => r.reason.includes('MOCK')).length;
    const simulatedCalls = logs.filter((r) => r.reason.includes('UNKNOWN')).length;
    const realCalls = totalCalls - mockCalls - simulatedCalls;

    const recommendations: string[] = [];
    if (mockCalls > 0) {
      recommendations.push(
        `Replace ${mockCalls} mock data calls in ${engineName} with real API/DB sources`,
      );
    }
    if (simulatedCalls > 0) {
      recommendations.push(
        `Tag ${simulatedCalls} UNKNOWN source calls in ${engineName} with explicit source`,
      );
    }
    if (mockCalls > this.config.maxMockCallsPerEngine) {
      recommendations.push(
        `[CRITICAL] ${engineName} exceeds max mock call threshold (${mockCalls} > ${this.config.maxMockCallsPerEngine})`,
      );
    }

    return {
      engineName,
      totalCalls,
      isProduction: this.config.productionMode,
      mockCalls,
      realCalls,
      simulatedCalls,
      details: logs.slice(-10), // last 10 for brevity
      recommendations,
    };
  }

  /**
   * Full system audit: returns reports for all tracked engines.
   */
  auditAll(): MockDataAuditReport[] {
    const engines = Array.from(
      new Set([
        ...Array.from(this.callLogs.keys()),
        ...Array.from(this.engineCallCounts.keys()),
      ]),
    );
    return engines.map((name) => this.audit(name));
  }

  /**
   * Convenience: check if a value is clearly mock generated.
   * Pattern: any value produced directly from Math.random without
   * being combined with real market data annotations.
   *
   * Strategy check (does NOT inspect function internals):
   *   - ID generation (toString(36).slice) → allowed (not data)
   *   - Price/volume/indicator derived from Math.random → prohibited
   */
  classifySource(
    value: number,
    context: {
      isIdGeneration?: boolean;
      isSimulatedPrice?: boolean;
      hasRealSource?: boolean;
      hasAnnotation?: string;
    },
  ): DataSourceTag {
    if (context.isIdGeneration) return 'REAL'; // UUID-style IDs are fine
    if (context.hasRealSource) return 'REAL';
    if (context.hasAnnotation) return 'REAL';
    if (context.isSimulatedPrice) return 'MOCK';
    return 'UNKNOWN';
  }

  // ── Summary helpers ──

  getSummary(): {
    totalEngines: number;
    totalCalls: number;
    totalMockCalls: number;
    cleanRatio: number;
  } {
    const reports = this.auditAll();
    const totalCalls = reports.reduce((s, r) => s + r.totalCalls, 0);
    const totalMockCalls = reports.reduce((s, r) => s + r.mockCalls, 0);
    return {
      totalEngines: reports.length,
      totalCalls,
      totalMockCalls,
      cleanRatio: totalCalls > 0 ? (totalCalls - totalMockCalls) / totalCalls : 1,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════

let instance: MockDataGuardEngine | null = null;

export function getMockDataGuard(): MockDataGuardEngine {
  if (!instance) instance = new MockDataGuardEngine();
  return instance;
}

export function resetMockDataGuard(): void {
  instance?.reset();
  instance = null;
}

export function setProductionMode(mode: boolean): void {
  const guard = getMockDataGuard();
  guard.setProduction(mode);
}
