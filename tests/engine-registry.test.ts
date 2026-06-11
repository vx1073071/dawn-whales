// Q-36-02: EngineRegistry Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EngineRegistry, IEngine, EngineType } from '../electron/engine/core/engine-registry';

// ── Mock Engines ────────────────────────────────────────────────────────────

function makeEngine(name: string, methods: string[] = ['start', 'stop', 'destroy']): IEngine {
  return {
    start: methods.includes('start') ? vi.fn() : undefined,
    stop: methods.includes('stop') ? vi.fn() : undefined,
    destroy: methods.includes('destroy') ? vi.fn() : undefined,
    getConfig: vi.fn().mockReturnValue({ name }),
  } as any;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('EngineRegistry', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    EngineRegistry.reset();
    registry = EngineRegistry.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    registry.destroyAll();
    EngineRegistry.reset();
  });

  // ── Singleton ─────────────────────────────────────────────────────────────

  describe('Singleton', () => {
    it('getInstance returns same instance', () => {
      const r1 = EngineRegistry.getInstance();
      const r2 = EngineRegistry.getInstance();
      expect(r1).toBe(r2);
    });

    it('reset clears the instance', () => {
      const r1 = EngineRegistry.getInstance();
      EngineRegistry.reset();
      const r2 = EngineRegistry.getInstance();
      expect(r1).not.toBe(r2);
    });
  });

  // ── Registration ─────────────────────────────────────────────────────────

  describe('Registration', () => {
    it('registers an engine', () => {
      const e = makeEngine('trade-executor');
      registry.register('trade-executor', e, 'trade-executor', '1.0.0');
      expect(registry.hasEngine('trade-executor')).toBe(true);
    });

    it('registers multiple engines', () => {
      registry.register('ce', makeEngine('ce'), 'condition');
      registry.register('te', makeEngine('te'), 'trade-executor');
      registry.register('risk', makeEngine('risk'), 'risk');
      expect(registry.listEngines()).toHaveLength(3);
    });

    it('replaces existing engine with same name', () => {
      const e1 = makeEngine('e1');
      const e2 = makeEngine('e2');
      registry.register('shared', e1, 'condition');
      registry.register('shared', e2, 'risk');
      expect(registry.getEngine('shared')).toBe(e2);
      expect(registry.listEngines()).toHaveLength(1);
    });

    it('unregister removes engine', () => {
      registry.register('te', makeEngine('te'), 'trade-executor');
      const result = registry.unregister('te');
      expect(result).toBe(true);
      expect(registry.hasEngine('te')).toBe(false);
    });

    it('unregister unknown name returns false', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ── Retrieval ─────────────────────────────────────────────────────────────

  describe('Retrieval', () => {
    beforeEach(() => {
      registry.register('trade-executor', makeEngine('te'), 'trade-executor', '2.0.0');
      registry.register('condition', makeEngine('ce'), 'condition', '1.5.0');
    });

    it('getEngine returns correct instance', () => {
      const e = makeEngine('te');
      registry.register('trade-executor', e, 'trade-executor');
      const retrieved = registry.getEngine('trade-executor');
      expect(retrieved).toBe(e);
    });

    it('getEngine returns null for unknown', () => {
      const result = registry.getEngine('unknown');
      expect(result).toBeNull();
    });

    it('getEntry returns entry with type/version', () => {
      const entry = registry.getEntry('trade-executor');
      expect(entry).not.toBeNull();
      expect(entry!.type).toBe('trade-executor');
      expect(entry!.version).toBe('2.0.0');
      expect(entry!.status).toBe('created');
    });

    it('getEntry returns null for unknown', () => {
      expect(registry.getEntry('unknown')).toBeNull();
    });

    it('hasEngine true for registered', () => {
      expect(registry.hasEngine('trade-executor')).toBe(true);
    });

    it('hasEngine false for unknown', () => {
      expect(registry.hasEngine('unknown')).toBe(false);
    });
  });

  // ── Listing ───────────────────────────────────────────────────────────────

  describe('Listing', () => {
    beforeEach(() => {
      registry.register('ce', makeEngine('ce'), 'condition');
      registry.register('te', makeEngine('te'), 'trade-executor');
      registry.register('risk', makeEngine('risk'), 'risk');
    });

    it('listEngines returns all entries', () => {
      const list = registry.listEngines();
      expect(list).toHaveLength(3);
    });

    it('listByType filters correctly', () => {
      const condEngines = registry.listByType('condition');
      expect(condEngines).toHaveLength(1);
      expect(condEngines[0].name).toBe('ce');
    });

    it('getStats returns correct counts', () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.created).toBe(3);
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(0);
      expect(stats.error).toBe(0);
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  describe('Lifecycle', () => {
    beforeEach(() => {
      const e1 = makeEngine('e1');
      const e2 = makeEngine('e2');
      registry.register('e1', e1, 'condition');
      registry.register('e2', e2, 'risk');
    });

    it('startAll starts all engines', () => {
      registry.startAll();
      const stats = registry.getStats();
      expect(stats.running).toBe(2);
      expect(stats.created).toBe(0);
    });

    it('stopAll stops all running engines', () => {
      registry.startAll();
      registry.stopAll();
      const stats = registry.getStats();
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(2);
    });

    it('destroyAll calls destroy on all engines', () => {
      const e = makeEngine('e');
      registry.register('e', e, 'condition');
      registry.destroyAll();
      expect(e.destroy).toHaveBeenCalled();
      expect(registry.listEngines()).toHaveLength(0);
    });

    it('startAll skips already running engines', () => {
      registry.startAll();
      const before = registry.listEngines()[0].startTime;
      registry.startAll(); // call again
      const after = registry.listEngines()[0].startTime;
      // Second startAll doesn't restart; startTime unchanged
      expect(after).toBe(before);
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────

  describe('Health', () => {
    it('isHealthy true when no error status', () => {
      registry.register('e', makeEngine('e'), 'condition');
      expect(registry.isHealthy()).toBe(true);
    });

    it('isHealthy false when any engine in error status', () => {
      const e = makeEngine('e');
      registry.register('e', e, 'condition');
      // Manually set error status
      const entry = registry.getEntry('e')!;
      entry.status = 'error';
      expect(registry.isHealthy()).toBe(false);
    });
  });
});
