import { describe, it, expect } from 'vitest';
import { HeatmapGenerator } from '../electron/workers/heatmap-generator';

describe('HeatmapGenerator', () => {
  it('should generate heatmap cells', () => {
    const gen = new HeatmapGenerator();
    const cells = gen.generate(
      ['AAPL', 'GOOGL'],
      ['PE', 'PB'],
      [[1, 2], [3, 4]]
    );
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveProperty('row');
    expect(cells[0]).toHaveProperty('color');
  });

  it('should generate sector heatmap', () => {
    const gen = new HeatmapGenerator();
    const cells = gen.sectorHeatmap([
      { name: 'Tech', return: 0.05, volume: 1000 },
      { name: 'Finance', return: -0.02, volume: 500 },
    ]);
    expect(cells).toHaveLength(2);
  });

  it('should generate correlation heatmap', () => {
    const gen = new HeatmapGenerator();
    const cells = gen.correlationHeatmap(
      ['A', 'B'],
      [[1, 0.8], [0.8, 1]]
    );
    expect(cells).toHaveLength(4);
  });
});
