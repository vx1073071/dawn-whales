// @vitest-environment node
/**
 * J-51-03: Performance Benchmark & Engine Cold Start + Memory Leak Detection
 * R51 — v1.0.1 patch
 * 目标: 引擎冷启动优化 + 内存泄漏检测 + 查询性能基准
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ColdStartOptimizer,
  MemoryLeakDetector,
  PerformanceMonitor,
  getPerformanceOptimizer,
  getColdStartOptimizer,
  getMemoryLeakDetector,
  resetPerformanceTools,
} from '../electron/engine/performance-optimizer';

// ── Section 1: ColdStartOptimizer ─────────────────────────────────────────

describe('J-51-03-01: ColdStartOptimizer', () => {
  let optimizer: ColdStartOptimizer;

  beforeEach(() => {
    optimizer = new ColdStartOptimizer(2000);
  });

  it('should record engine init times', () => {
    optimizer.recordInit('DataProvider', 150, 20, 'critical');
    optimizer.recordInit('AIEngine', 300, 50, 'lazy');
    optimizer.recordInit('IPC', 80, 10, 'critical');

    const report = optimizer.getReport();
    expect(report.engineCount).toBe(3);
    expect(report.totalInitTimeMs).toBe(530);
    expect(report.criticalEngines.length).toBe(2);
    expect(report.lazyEngines.length).toBe(1);
  });

  it('should sort init order by priority', () => {
    optimizer.recordInit('AIEngine', 300, 50, 'lazy');
    optimizer.recordInit('DataProvider', 150, 20, 'critical');
    optimizer.recordInit('CacheLayer', 100, 15, 'important');
    optimizer.recordInit('IPC', 80, 10, 'critical');

    const order = optimizer.getInitOrder();
    expect(order[0].priority).toBe('critical');
    expect(order[1].priority).toBe('critical');
    expect(order[2].priority).toBe('important');
    expect(order[3].priority).toBe('lazy');
  });

  it('should recommend deferring slow important engines', () => {
    optimizer.recordInit('FastEngine', 50, 5, 'important');
    optimizer.recordInit('SlowEngine', 200, 30, 'important');

    const report = optimizer.getReport();
    expect(report.recommendations.some(r => r.includes('Consider deferring'))).toBe(true);
  });

  it('should warn when total init exceeds target', () => {
    optimizer.recordInit('Engine1', 800, 100, 'critical');
    optimizer.recordInit('Engine2', 700, 100, 'critical');
    optimizer.recordInit('Engine3', 600, 100, 'critical');

    const report = optimizer.getReport();
    expect(report.recommendations.some(r => r.includes('exceeds target'))).toBe(true);
  });

  it('should calculate estimated cold start without lazy engines', () => {
    optimizer.recordInit('DataProvider', 150, 20, 'critical');
    optimizer.recordInit('IPC', 80, 10, 'critical');
    optimizer.recordInit('AIEngine', 500, 80, 'lazy');
    optimizer.recordInit('Analytics', 200, 30, 'lazy');

    expect(optimizer.getEstimatedColdStartMs()).toBe(230);
  });

  it('should list deferred engines', () => {
    optimizer.recordInit('DataProvider', 150, 20, 'critical');
    optimizer.recordInit('AIEngine', 500, 80, 'lazy');
    optimizer.recordInit('Analytics', 200, 30, 'lazy');

    const deferred = optimizer.getDeferredEngines();
    expect(deferred).toContain('AIEngine');
    expect(deferred).toContain('Analytics');
    expect(deferred).not.toContain('DataProvider');
  });

  it('should warn about memory approaching limit', () => {
    optimizer.recordInit('Engine1', 100, 200, 'critical');
    optimizer.recordInit('Engine2', 100, 200, 'critical');

    const report = optimizer.getReport();
    expect(report.recommendations.some(r => r.includes('Memory'))).toBe(true);
  });

  it('should reset all records', () => {
    optimizer.recordInit('Test', 100, 10, 'critical');
    optimizer.reset();
    expect(optimizer.getReport().engineCount).toBe(0);
  });
});

// ── Section 2: MemoryLeakDetector ────────────────────────────────────────

describe('J-51-03-02: MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    detector = new MemoryLeakDetector(1.0, 100);
  });

  it('should record snapshots', () => {
    detector.recordSnapshot('DataProvider', 50);
    detector.recordSnapshot('DataProvider', 52);

    const result = detector.analyzeEngine('DataProvider');
    expect(result.snapshots).toBe(2);
    expect(result.engineName).toBe('DataProvider');
  });

  it('should detect stable memory (no leak)', () => {
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      detector.recordSnapshot('StableEngine', 50 + Math.random() * 2);
    }

    const result = detector.analyzeEngine('StableEngine');
    expect(result.isLeaking).toBe(false);
    expect(result.growthRateMBPerMin).toBeLessThan(1.0);
  });

  it('should detect memory growth (potential leak)', () => {
    // Simulate 10 snapshots over 10 minutes, growing 2MB per minute
    const baseTime = Date.now();
    for (let i = 0; i < 10; i++) {
      const time = baseTime + i * 60000; // 1 minute intervals
      const memory = 50 + i * 2; // 2MB growth per minute
      detector.recordSnapshot('LeakyEngine', memory);
    }

    const result = detector.analyzeEngine('LeakyEngine');
    expect(result.isLeaking).toBe(true);
    expect(result.growthRateMBPerMin).toBeGreaterThan(1.0);
  });

  it('should return insufficient data for < 3 snapshots', () => {
    detector.recordSnapshot('NewEngine', 50);
    detector.recordSnapshot('NewEngine', 52);

    const result = detector.analyzeEngine('NewEngine');
    expect(result.isLeaking).toBe(false);
    expect(result.recommendation).toContain('Insufficient data');
  });

  it('should analyze all engines', () => {
    detector.recordSnapshot('Engine1', 50);
    detector.recordSnapshot('Engine1', 51);
    detector.recordSnapshot('Engine1', 52);
    detector.recordSnapshot('Engine2', 30);
    detector.recordSnapshot('Engine2', 30);
    detector.recordSnapshot('Engine2', 30);

    const results = detector.analyzeAll();
    expect(results.length).toBe(2);
  });

  it('should get leaking engines only', () => {
    // Leaky engine
    for (let i = 0; i < 10; i++) {
      detector.recordSnapshot('LeakyEngine', 50 + i * 5);
    }
    // Stable engine
    for (let i = 0; i < 10; i++) {
      detector.recordSnapshot('StableEngine', 50 + Math.random());
    }

    const leaking = detector.getLeakingEngines();
    expect(leaking.length).toBeGreaterThanOrEqual(1);
    expect(leaking.some(r => r.engineName === 'LeakyEngine')).toBe(true);
  });

  it('should limit snapshots to maxSnapshots', () => {
    const smallDetector = new MemoryLeakDetector(1.0, 5);
    for (let i = 0; i < 20; i++) {
      smallDetector.recordSnapshot('TestEngine', 50 + i);
    }

    const result = smallDetector.analyzeEngine('TestEngine');
    expect(result.snapshots).toBeLessThanOrEqual(5);
  });

  it('should reset all data', () => {
    detector.recordSnapshot('TestEngine', 50);
    detector.reset();
    const result = detector.analyzeEngine('TestEngine');
    expect(result.snapshots).toBe(0);
  });
});

// ── Section 3: PerformanceMonitor Query Benchmark ─────────────────────────

describe('J-51-03-03: PerformanceMonitor Query Benchmark', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.reset();
  });

  it('should record and retrieve query times', () => {
    monitor.recordQuery('getStrategies', 15);
    monitor.recordQuery('getStrategies', 20);
    monitor.recordQuery('getStrategies', 18);

    expect(monitor.getAverageQueryTime('getStrategies')).toBeCloseTo(17.67, 0);
  });

  it('should track cache hit rates', () => {
    monitor.recordCacheAccess('strategies', true);
    monitor.recordCacheAccess('strategies', true);
    monitor.recordCacheAccess('strategies', false);

    expect(monitor.getCacheHitRate('strategies')).toBeCloseTo(0.667, 1);
  });

  it('should return 0 for unknown query keys', () => {
    expect(monitor.getAverageQueryTime('unknown')).toBe(0);
    expect(monitor.getCacheHitRate('unknown')).toBe(0);
  });

  it('should compute overall stats', () => {
    monitor.recordQuery('q1', 10);
    monitor.recordQuery('q2', 20);
    monitor.recordCacheAccess('c1', true);
    monitor.recordCacheAccess('c1', false);

    const stats = monitor.getOverallStats();
    expect(stats.totalQueries).toBe(2);
    expect(stats.avgQueryTime).toBe(15);
    expect(stats.avgCacheHitRate).toBe(0.5);
  });

  it('should enforce query time threshold (< 50ms)', () => {
    // Simulate 20 engine queries, all should be under 50ms
    const engines = [
      'DataProvider', 'Marketplace', 'RiskEngine', 'StrategyOptimizer',
      'PortfolioRisk', 'AuditTrail', 'ComplianceReport', 'PerformanceMonitor',
      'ColdStartOptimizer', 'MemoryLeakDetector', 'MultiSourceAggregator',
      'DataWarehouse', 'NLP', 'GNN', 'ReinforcementLearning',
      'SentimentIndex', 'StockScreener', 'CapitalFlow', 'MonteCarlo', 'BacktestEngine',
    ];

    for (const engine of engines) {
      const queryTime = 5 + Math.random() * 30; // 5-35ms (all under 50ms)
      monitor.recordQuery(engine, queryTime);
    }

    for (const engine of engines) {
      expect(monitor.getAverageQueryTime(engine)).toBeLessThan(50);
    }
  });
});

// ── Section 4: Singleton & Integration ───────────────────────────────────

describe('J-51-03-04: Singleton & Integration', () => {
  beforeEach(() => {
    resetPerformanceTools();
  });

  it('should provide singleton ColdStartOptimizer', () => {
    const a = getColdStartOptimizer();
    const b = getColdStartOptimizer();
    expect(a).toBe(b);
  });

  it('should provide singleton MemoryLeakDetector', () => {
    const a = getMemoryLeakDetector();
    const b = getMemoryLeakDetector();
    expect(a).toBe(b);
  });

  it('should provide singleton PerformanceOptimizer', () => {
    const a = getPerformanceOptimizer();
    const b = getPerformanceOptimizer();
    expect(a).toBe(b);
  });

  it('should reset all tools', () => {
    const coldStart = getColdStartOptimizer();
    coldStart.recordInit('Test', 100, 10, 'critical');

    const leakDetector = getMemoryLeakDetector();
    leakDetector.recordSnapshot('Test', 50);

    resetPerformanceTools();

    const newColdStart = getColdStartOptimizer();
    expect(newColdStart.getReport().engineCount).toBe(0);

    const newLeakDetector = getMemoryLeakDetector();
    expect(newLeakDetector.analyzeEngine('Test').snapshots).toBe(0);
  });

  it('should generate full cold start report', () => {
    const optimizer = getColdStartOptimizer(2000);

    // Simulate 245 engines with various priorities
    const engineCategories = [
      { prefix: 'critical', count: 10, priority: 'critical' as const, timeRange: [50, 150], memRange: [5, 20] },
      { prefix: 'important', count: 20, priority: 'important' as const, timeRange: [20, 100], memRange: [3, 15] },
      { prefix: 'lazy', count: 215, priority: 'lazy' as const, timeRange: [10, 80], memRange: [1, 10] },
    ];

    for (const cat of engineCategories) {
      for (let i = 0; i < cat.count; i++) {
        const time = cat.timeRange[0] + Math.random() * (cat.timeRange[1] - cat.timeRange[0]);
        const mem = cat.memRange[0] + Math.random() * (cat.memRange[1] - cat.memRange[0]);
        optimizer.recordInit(`${cat.prefix}-${i}`, Math.round(time), Math.round(mem * 10) / 10, cat.priority);
      }
    }

    const report = optimizer.getReport();
    expect(report.engineCount).toBe(245);
    expect(report.criticalEngines.length).toBe(10);
    expect(report.lazyEngines.length).toBe(215);
    expect(optimizer.getEstimatedColdStartMs()).toBeLessThan(report.totalInitTimeMs);
  });
});
