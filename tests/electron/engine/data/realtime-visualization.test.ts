/**
 * Tests for realtime-visualization — J-01 R95.1
 */
import { describe, it, expect, vi } from 'vitest';
import {
  RealtimeVisualizationService,
  getRealtimeVisualizationService,
  type VisualizationDataPoint,
  type VisualizationConfig,
} from '../../../../electron/engine/data/realtime-visualization';

vi.mock('../../../electron/engine/data/sliding-window-aggregator', () => ({
  getSlidingWindowAggregator: vi.fn(() => ({
    getWindow: vi.fn(() => []),
    add: vi.fn(),
  })),
}));
vi.mock('../../../electron/engine/portfolio/performance-monitor', () => ({
  getPerformanceMonitor: vi.fn(() => ({ getMetrics: vi.fn(() => ({})) })),
}));

describe('RealtimeVisualizationService', () => {
  it('creates instance', () => {
    const svc = new RealtimeVisualizationService();
    expect(svc).toBeInstanceOf(RealtimeVisualizationService);
  });
  it('creates with config', () => {
    const cfg: VisualizationConfig = { maxDataPoints: 100, symbols: ['000001'] };
    const svc = new RealtimeVisualizationService(cfg);
    expect(svc).toBeDefined();
  });
  it('has isRunning property', () => { const svc = new RealtimeVisualizationService(); expect(typeof svc.isRunning).toBe('boolean'); });
  it('has isRunning property', () => {
    const svc = new RealtimeVisualizationService();
    expect(typeof svc.isRunning).toBe('boolean');
  });
});

describe('getRealtimeVisualizationService', () => {
  it('returns singleton', () => {
    const a = getRealtimeVisualizationService();
    const b = getRealtimeVisualizationService();
    expect(a).toBe(b);
  });
});

describe('VisualizationDataPoint', () => {
  it('creates valid data point', () => {
    const pt: VisualizationDataPoint = {
      timestamp: Date.now(),
      symbol: '000001',
      price: 10.5,
      volume: 1000,
      change: 0.5,
      changePct: 0.05,
    };
    expect(pt.price).toBe(10.5);
  });
});
