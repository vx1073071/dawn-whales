// T78: Heatmap Data Generator
export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  color: string; // hex
}

export type ColorScale = 'red-green' | 'blue-red' | 'green-red' | 'mono';

export class HeatmapGenerator {
  generate(
    rows: string[],
    cols: string[],
    values: number[][],
    scale: ColorScale = 'red-green'
  ): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    const allValues = values.flat();
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const colors = this._colorFn(scale);

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const value = values[r]?.[c] ?? 0;
        const normalized = (value - min) / range;
        cells.push({
          row: rows[r],
          col: cols[c],
          value,
          color: colors(normalized),
        });
      }
    }
    return cells;
  }

  sectorHeatmap(
    sectors: { name: string; return: number; volume: number }[]
  ): HeatmapCell[] {
    const sorted = [...sectors].sort((a, b) => b.return - a.return);
    return sorted.map((s, i) => ({
      row: s.name,
      col: 'Return',
      value: s.return,
      color: this._colorFn('red-green')(s.return),
    }));
  }

  correlationHeatmap(
    symbols: string[],
    correlationMatrix: number[][]
  ): HeatmapCell[] {
    return this.generate(symbols, symbols, correlationMatrix, 'blue-red');
  }

  private _colorFn(scale: ColorScale): (normalized: number) => string {
    switch (scale) {
      case 'red-green':
        return (n) => {
          if (n < 0.5) {
            const r = Math.round(255 * (1 - n * 2));
            const g = Math.round(255 * (n * 2));
            return `#${this._hex(r)}${this._hex(g)}00`;
          }
          const r = Math.round(255 * ((1 - n) * 2));
          const g = 255;
          return `#${this._hex(r)}${this._hex(g)}00`;
        };
      case 'blue-red':
        return (n) => {
          const r = Math.round(255 * n);
          const b = Math.round(255 * (1 - n));
          return `#${this._hex(r)}00${this._hex(b)}`;
        };
      case 'green-red':
        return (n) => {
          const g = Math.round(255 * (1 - n));
          const r = Math.round(255 * n);
          return `#${this._hex(r)}${this._hex(g)}00`;
        };
      case 'mono':
        return (n) => {
          const v = Math.round(255 * n);
          return `#${this._hex(v)}${this._hex(v)}${this._hex(v)}`;
        };
    }
  }

  private _hex(n: number): string {
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  }
}
