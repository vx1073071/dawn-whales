import { describe, it, expect } from 'vitest';
import { TemplateRegistry } from '../electron/workers/strategy-templates';

describe('TemplateRegistry', () => {
  it('should return all templates', () => {
    const registry = new TemplateRegistry();
    expect(registry.getAll().length).toBeGreaterThanOrEqual(8);
  });

  it('should filter by category', () => {
    const registry = new TemplateRegistry();
    const trend = registry.byCategory('trend');
    expect(trend.length).toBeGreaterThan(0);
    expect(trend[0].category).toBe('trend');
  });

  it('should filter by difficulty', () => {
    const registry = new TemplateRegistry();
    const beginner = registry.byDifficulty('beginner');
    expect(beginner.length).toBeGreaterThan(0);
  });

  it('should search', () => {
    const registry = new TemplateRegistry();
    const results = registry.search('bollinger');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('bollinger-bands');
  });

  it('should get by id', () => {
    const registry = new TemplateRegistry();
    const template = registry.get('ma-cross');
    expect(template).toBeDefined();
    expect(template!.parameters.length).toBeGreaterThan(0);
  });
});
