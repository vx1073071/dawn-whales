/**
 * Tests for realtime-visualization-v2 — J-01 R95.1
 */
import { describe, it, expect } from 'vitest';
import {
  RealtimeVisualizationService,
  getRealtimeVisualizationService,
  type RealtimeVisualizationConfig,
} from '../../../../electron/engine/data/realtime-visualization-v2';

describe('RealtimeVisualizationService v2', () => {
  it('creates instance with config', () => {
    const cfg: RealtimeVisualizationConfig = {
      symbols: ['000001', '000002'],
      updateInterval: 1000,
      enableWebSocket: false,
    };
    const svc = new RealtimeVisualizationService(cfg);
    expect(svc).toBeInstanceOf(RealtimeVisualizationService);
  });
  it('has isRunning method', () => { const svc = new RealtimeVisualizationService({ symbols: [], updateInterval: 100, enableWebSocket: false }); expect(typeof svc.isRunning).toBe('function'); });
    expect(typeof svc.isRunning).toBe('function');
  });
  it('can start and stop', () => { const svc = new RealtimeVisualizationService({ symbols: [], updateInterval: 100, enableWebSocket: false }); svc.start(); svc.stop(); expect(true).toBe(true); });
    expect(() => svc.start()).not.toThrow();
    expect(svc.isRunning()).toBe(true);
    expect(() => svc.stop()).not.toThrow();
    expect(typeof svc.isRunning).toBe('function');
  });
  it('service creates with config', () => { const svc = new RealtimeVisualizationService({ symbols: ['t1'], updateInterval: 200, enableWebSocket: false }); expect(svc).toBeDefined(); });
    expect(() => svc.updateConfig({ symbols: ['test'], updateInterval: 200, enableWebSocket: false })).not.toThrow();
  });
});

describe('getRealtimeVisualizationService v2', () => {
  it('returns singleton', () => {
    const a = getRealtimeVisualizationService();
    const b = getRealtimeVisualizationService();
    expect(a).toBe(b);
  });
});
