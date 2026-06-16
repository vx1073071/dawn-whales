/**
 * PipelinePerformanceAuditor — R260 QUANT MOO 全管线性能优化
 *
 * 对 JVS 构建的所有引擎管线进行性能审计，输出瓶颈分析与优化建议。
 *
 * 审计维度：
 *   - 引擎实例化开销 (singleton vs new)
 *   - 批量操作效率 (batch vs single)
 *   - 内存使用 (Map/Set size, ring buffer limits)
 *   - 事件发射频率 (EventEmitter listener count)
 *   - 排序/搜索复杂度
 *
 * Module: engine/perf/PipelinePerformanceAuditor.ts
 *
 * @author JVS
 * @round R260
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type AuditSeverity = 'pass' | 'info' | 'warn' | 'error';

export interface AuditItem {
  id: string;
  module: string;
  check: string;
  severity: AuditSeverity;
  currentValue: number | string;
  threshold?: number | string;
  recommendation: string;
  estimatedSavingsMs?: number;
}

export interface PerformanceProfile {
  module: string;
  initTimeUs: number;
  avgOpTimeUs: number;
  maxOpTimeUs: number;
  memoryBytes: number;
  operationCount: number;
  listenerCount: number;
  collectionSizes: Record<string, number>;
}

export interface PipelineAuditReport {
  timestamp: number;
  totalModules: number;
  overallScore: number;        // 0-100
  critical: AuditItem[];
  warnings: AuditItem[];
  passed: number;
  failed: number;
  items: AuditItem[];
  profiles: PerformanceProfile[];
  recommendations: string[];
}

// ─── Engine ──────────────────────────────────────────────

export class PipelinePerformanceAuditor extends EventEmitter {
  private static instance: PipelinePerformanceAuditor;

  private profiles: Map<string, PerformanceProfile> = new Map();
  private auditItems: AuditItem[] = [];
  private idCounter = 0;

  // Batch size constants
  static readonly BATCH_MIN = 10;
  static readonly BATCH_OPTIMAL = 50;
  static readonly MAX_LISTENERS = 20;
  static readonly MAX_MAP_SIZE = 100000;
  static readonly MAX_TICKS = 50000;

  constructor() { super(); }

  static getInstance(): PipelinePerformanceAuditor {
    if (!PipelinePerformanceAuditor.instance) {
      PipelinePerformanceAuditor.instance = new PipelinePerformanceAuditor();
    }
    return PipelinePerformanceAuditor.instance;
  }

  reset(): void {
    this.profiles.clear();
    this.auditItems = [];
    this.idCounter = 0;
    this.removeAllListeners();
  }

  // ─── Profile Registration ───────────────────────────────

  registerProfile(profile: PerformanceProfile): void {
    this.profiles.set(profile.module, profile);
    this.emit('profile_registered', profile);
  }

  // ─── Audit Checks ───────────────────────────────────────

  auditSingleton(module: string, isSingleton: boolean): AuditItem {
    return this.addItem(module, 'Singleton Pattern', isSingleton ? 'pass' : 'warn',
      isSingleton ? 'true' : 'false', 'true',
      isSingleton ? '' : 'Consider singleton pattern to reduce memory and improve consistency');
  }

  auditBatchEfficiency(module: string, hasBatch: boolean, batchSize?: number): AuditItem {
    let sev: AuditSeverity = 'pass';
    let rec = '';
    if (!hasBatch) { sev = 'warn'; rec = 'Add batch ingestion method for bulk operations'; }
    else if (batchSize && batchSize < PipelinePerformanceAuditor.BATCH_MIN) {
      sev = 'info'; rec = `Batch size ${batchSize} is suboptimal, increase to ≥${PipelinePerformanceAuditor.BATCH_MIN}`;
    }
    return this.addItem(module, 'Batch Efficiency', sev,
      hasBatch ? `yes (${batchSize || 'N/A'})` : 'no', `≥${PipelinePerformanceAuditor.BATCH_MIN}`,
      rec);
  }

  auditListenerCount(module: string, listenerCount: number): AuditItem {
    const sev = listenerCount > PipelinePerformanceAuditor.MAX_LISTENERS ? 'error' :
      listenerCount > 15 ? 'warn' : 'pass';
    return this.addItem(module, 'Event Listener Count', sev, `${listenerCount}`,
      `≤${PipelinePerformanceAuditor.MAX_LISTENERS}`,
      sev === 'pass' ? '' : `Too many listeners (${listenerCount}), may leak. Use removeAllListeners() cleanup.`);
  }

  auditCollectionSize(module: string, collectionName: string, size: number, maxSize?: number): AuditItem {
    const threshold = maxSize || PipelinePerformanceAuditor.MAX_MAP_SIZE;
    const sev: AuditSeverity = size > threshold * 0.9 ? 'error' :
      size > threshold * 0.7 ? 'warn' :
      size > threshold * 0.5 ? 'info' : 'pass';
    return this.addItem(module, `Collection: ${collectionName}`, sev, `${size}`,
      `≤${threshold}`,
      sev === 'pass' ? '' : `${collectionName} growing (${size}/${threshold}), implement ring buffer or LRU eviction.`);
  }

  auditSortComplexity(module: string, usesSort: boolean, expectedComplexity?: string): AuditItem {
    const sev: AuditSeverity = !usesSort ? 'pass' :
      (expectedComplexity && expectedComplexity.includes('n2')) ? 'warn' : 'info';
    return this.addItem(module, 'Sort Complexity', sev,
      usesSort ? (expectedComplexity || 'O(n log n)') : 'none', '≤O(n log n)',
      sev === 'warn' ? 'O(n^2) sort detected. Use native sort or implement heap for top-K.' : '');
  }

  auditMockDataSize(module: string, mockCount: number, hasCreateMock: boolean): AuditItem {
    if (!hasCreateMock) return this.addItem(module, 'Mock Data', 'info', 'none', 'N/A', '');
    const sev = mockCount > 200 ? 'info' : 'pass';
    return this.addItem(module, 'Mock Data Size', sev, `${mockCount}`,
      '≤500', '');
  }

  // ─── Full Module Audit ──────────────────────────────────

  auditModule(module: string, options: {
    isSingleton?: boolean;
    hasBatch?: boolean;
    batchSize?: number;
    listenerCount?: number;
    collections?: Record<string, number>;
    usesSort?: boolean;
    sortComplexity?: string;
    mockCount?: number;
    hasCreateMock?: boolean;
  }): AuditItem[] {
    const items: AuditItem[] = [];

    items.push(this.auditSingleton(module, options.isSingleton ?? true));
    items.push(this.auditBatchEfficiency(module, options.hasBatch ?? false, options.batchSize));
    items.push(this.auditListenerCount(module, options.listenerCount ?? 0));

    if (options.collections) {
      for (const [name, size] of Object.entries(options.collections)) {
        items.push(this.auditCollectionSize(module, name, size));
      }
    }

    items.push(this.auditSortComplexity(module, options.usesSort ?? false, options.sortComplexity));
    items.push(this.auditMockDataSize(module, options.mockCount ?? 0, options.hasCreateMock ?? false));

    return items;
  }

  // ─── Report Generation ──────────────────────────────────

  generateReport(): PipelineAuditReport {
    const items = this.auditItems;
    const critical = items.filter(i => i.severity === 'error');
    const warnings = items.filter(i => i.severity === 'warn');
    const passed = items.filter(i => i.severity === 'pass').length;
    const failed = critical.length + warnings.length;

    // Score: each pass=5, info=3, warn=-3, error=-8, base 100
    let score = 100;
    for (const item of items) {
      switch (item.severity) {
        case 'pass': break;
        case 'info': score -= 1; break;
        case 'warn': score -= 4; break;
        case 'error': score -= 10; break;
      }
    }
    score = Math.max(0, Math.min(100, score));

    const allModules = [...new Set(items.map(i => i.module))];

    return {
      timestamp: Date.now(),
      totalModules: allModules.length,
      overallScore: score,
      critical,
      warnings,
      passed,
      failed,
      items,
      profiles: [...this.profiles.values()],
      recommendations: this.generateRecommendations(items),
    };
  }

  // ─── Recommendations ────────────────────────────────────

  private generateRecommendations(items: AuditItem[]): string[] {
    const recs: string[] = [];

    const batchIssues = items.filter(i => i.check === 'Batch Efficiency' && i.severity !== 'pass');
    if (batchIssues.length > 0) {
      recs.push(`[Batch] ${batchIssues.length} engine(s) missing batch support — add batch ingestion for 10-100x throughput gain`);
    }

    const listenerIssues = items.filter(i => i.check === 'Event Listener Count' && i.severity !== 'pass');
    if (listenerIssues.length > 0) {
      recs.push(`[Memory] ${listenerIssues.length} engine(s) with high listener count — add cleanup or emitter.setMaxListeners()`);
    }

    const collectionIssues = items.filter(i => i.check.startsWith('Collection:') && i.severity !== 'pass');
    if (collectionIssues.length > 0) {
      recs.push(`[Memory] ${collectionIssues.length} collection(s) growing large — implement ring buffer or LRU eviction`);
    }

    const sortIssues = items.filter(i => i.check === 'Sort Complexity' && i.severity === 'warn');
    if (sortIssues.length > 0) {
      recs.push(`[Performance] ${sortIssues.length} engine(s) with O(n^2) sort — use native .sort() or heap-based top-K`);
    }

    if (recs.length === 0) {
      recs.push('[OK] All audited modules pass performance checks.');
    }

    return recs;
  }

  // ─── Internal ───────────────────────────────────────────

  private addItem(module: string, check: string, severity: AuditSeverity,
    currentValue: number | string, threshold: number | string,
    recommendation: string): AuditItem {
    const item: AuditItem = {
      id: `audit_${++this.idCounter}`,
      module, check, severity, currentValue, threshold, recommendation,
    };
    if (recommendation) item.estimatedSavingsMs = severity === 'error' ? 50 : severity === 'warn' ? 15 : 0;
    this.auditItems.push(item);
    return item;
  }
}
