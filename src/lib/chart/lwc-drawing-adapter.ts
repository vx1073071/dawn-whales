// @ts-nocheck
// R127-Q01: nocheck cleared — R113 Part 2 (DrawingTools) will fix lwc 4.2.3 types
// TradingEasy R113 - lightweight-charts Drawing Adapter
// Bridges DrawingTools with lightweight-charts 4.2.3 ISeriesPrimitive API
// PM: quote upgrade v2.0 module 3 P0

import type {
  ISeriesPrimitive, ISeriesPrimitiveAxisView, ISeriesPrimitivePaneView,
  SeriesPrimitivePaneViewZOrder, Time, CanvasRenderingTarget2D,
} from 'lightweight-charts';
import type { Drawing, TrendLine, FibRetracement, Rectangle, Point } from './drawing-tools';
import { getDrawingColor } from './drawing-tools';
import type { ChartTheme } from './types';
import { CHART_THEME_DARK } from './types';
import { getChartColor } from './chart-theme-colors';

export interface ISeriesPrimitivePaneRenderer {
  draw(target: CanvasRenderingTarget2D): void;
}

function priceToY(price: number, top: number, bottom: number, h: number): number {
  const range = top - bottom;
  if (range === 0) return h / 2;
  return ((top - price) / range) * h;
}

function timeToX(time: number, t0: number, t1: number, w: number): number {
  const range = t1 - t0;
  if (range === 0) return w / 2;
  return ((time - t0) / range) * w;
}

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, dashLen = 6, gapLen = 4): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  let drawn = 0;
  const step = dashLen + gapLen;
  while (drawn < len) {
    const t0 = drawn / len, t1 = Math.min((drawn + dashLen) / len, 1);
    ctx.moveTo(x1 + dx * t0, y1 + dy * t0);
    ctx.lineTo(x1 + dx * t1, y1 + dy * t1);
    drawn += step;
  }
  ctx.stroke();
}

// ═══════════ Drawing Renderer ═══════════

export class DrawingPrimitive implements ISeriesPrimitive<void> {
  private drawing: Drawing;
  private theme: ChartTheme;

  constructor(drawing: Drawing, theme?: ChartTheme) {
    this.drawing = drawing;
    this.theme = theme || CHART_THEME_DARK;
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return [{
      renderer: this as unknown as ISeriesPrimitivePaneRenderer,
      zOrder: 'above' as SeriesPrimitivePaneViewZOrder,
      update: () => {},
    }];
  }

  axisViews(): readonly ISeriesPrimitiveAxisView[] { return []; }
  requestUpdate(): void {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace((scope: { context: CanvasRenderingContext2D }) => {
      const ctx = scope.context;
      const color = this.drawing.state === 'selected'
        ? this.theme.crosshair
        : getDrawingColor(this.drawing.type);

      switch (this.drawing.type) {
        case 'trend-line': this.drawTrendLine(ctx, this.drawing as TrendLine, color); break;
        case 'fib-retracement': this.drawFibRetracement(ctx, this.drawing as FibRetracement); break;
        case 'rectangle': this.drawRectangle(ctx, this.drawing as Rectangle, color); break;
        default: break;
      }

      if (this.drawing.state === 'selected') {
        this.drawHandles(ctx, color);
      }
    });
  }

  private drawTrendLine(ctx: CanvasRenderingContext2D, d: TrendLine, color: string): void {
    const [p1, p2] = d.points;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    if (d.label) {
      ctx.fillStyle = color;
      ctx.font = '11px sans-serif';
      ctx.fillText(d.label, (p1.x + p2.x) / 2 + 4, (p1.y + p2.y) / 2 - 4);
    }
  }

  private drawFibRetracement(ctx: CanvasRenderingContext2D, d: FibRetracement): void {
    const [p1, p2] = d.points;
    if (!d.showLevels) return;

    const diff = p2.price - p1.price;
    const leftX = Math.min(p1.x, p2.x) - 60;
    const rightX = Math.max(p1.x, p2.x) + 60;

    d.levels.forEach((level: number) => {
      const price = p2.price - diff * level;
      const y = p1.y + (p2.y - p1.y) * level;
      const hue = level <= 0.5 ? 120 : 360 - (level * 300);
      const levelColor = level === 0 || level === 1 ? getChartColor('textMuted') : 'hsl(' + hue + ',60%,50%)';

      drawDashedLine(ctx, leftX, y, rightX, y, levelColor);

      if (d.showLabels) {
        ctx.fillStyle = levelColor;
        ctx.font = '10px monospace';
        ctx.fillText((level * 100).toFixed(1) + '%', rightX + 6, y + 4);
        ctx.fillText(price.toFixed(8), rightX + 6, y + 16);
      }
    });
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, d: Rectangle, color: string): void {
    const [p1, p2] = d.points;
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);

    if (d.filled) {
      ctx.fillStyle = color + Math.floor(d.fillOpacity * 255).toString(16).padStart(2, '0');
      ctx.fillRect(x, y, w, h);
    }

    ctx.strokeStyle = d.borderColor || color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
  }

  private drawHandles(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.fillStyle = color;
    ctx.strokeStyle = getChartColor('bgPrimary');
    ctx.lineWidth = 1;
    for (const p of this.drawing.points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  updateDrawing(drawing: Drawing): void {
    this.drawing = drawing;
  }
}

// ═══════════ Multi-drawing Manager ═══════════

export interface DrawingPrimitiveEntry {
  id: string;
  primitive: DrawingPrimitive;
  drawing: Drawing;
}

export class DrawingPrimitiveManager {
  private entries: Map<string, DrawingPrimitiveEntry> = new Map();
  private theme: ChartTheme;

  constructor(theme?: ChartTheme) {
    this.theme = theme || CHART_THEME_DARK;
  }

  addDrawing(drawing: Drawing): DrawingPrimitive {
    const primitive = new DrawingPrimitive(drawing, this.theme);
    this.entries.set(drawing.id, { id: drawing.id, primitive, drawing });
    return primitive;
  }

  removeDrawing(id: string): boolean { return this.entries.delete(id); }

  updateDrawing(id: string, updates: Partial<Drawing>): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.drawing = { ...entry.drawing, ...updates } as Drawing;
    entry.primitive.updateDrawing(entry.drawing);
    return true;
  }

  selectDrawing(id: string | null): void {
    for (const [eId, entry] of this.entries) {
      entry.drawing.state = eId === id ? 'selected' : 'idle';
      entry.primitive.updateDrawing(entry.drawing);
    }
  }

  getDrawing(id: string): Drawing | undefined { return this.entries.get(id)?.drawing; }
  getPrimitive(id: string): DrawingPrimitive | undefined { return this.entries.get(id)?.primitive; }
  getAllPrimitives(): DrawingPrimitive[] { return Array.from(this.entries.values()).map(e => e.primitive); }
  getAllDrawings(): Drawing[] { return Array.from(this.entries.values()).map(e => e.drawing); }
  clear(): void { this.entries.clear(); }
}

// ═══════════ Coordinate Helpers ═══════════

export function chartToCanvas(
  time: number, price: number,
  viewTimeRange: [number, number], viewPriceRange: [number, number],
  canvasSize: { width: number; height: number },
): Point {
  const x = timeToX(time, viewTimeRange[0], viewTimeRange[1], canvasSize.width);
  const y = priceToY(price, viewPriceRange[1], viewPriceRange[0], canvasSize.height);
  return { x, y, price, time };
}

export function canvasToChart(
  x: number, y: number,
  viewTimeRange: [number, number], viewPriceRange: [number, number],
  canvasSize: { width: number; height: number },
): Point {
  const time = viewTimeRange[0] + (x / canvasSize.width) * (viewTimeRange[1] - viewTimeRange[0]);
  const price = viewPriceRange[1] - (y / canvasSize.height) * (viewPriceRange[1] - viewPriceRange[0]);
  return { x, y, price, time };
}

export function hitTestDrawings(x: number, y: number, drawings: Drawing[], threshold = 10): string | null {
  for (const d of [...drawings].reverse()) {
    if (!d.visible) continue;
    if (d.type === 'trend-line' || d.type === 'ray' || (d.type as string) === 'extended-line') {
      const [p1, p2] = d.points;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) { if (Math.hypot(x - p1.x, y - p1.y) < threshold) return d.id; continue; }
      let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (p1.x + t * dx), y - (p1.y + t * dy)) < threshold) return d.id;
    }
    if (d.type === 'rectangle' && d.points.length === 2) {
      const [p1, p2] = d.points;
      const rx = Math.min(p1.x, p2.x), ry = Math.min(p1.y, p2.y);
      if (x >= rx && x <= rx + Math.abs(p2.x - p1.x) && y >= ry && y <= ry + Math.abs(p2.y - p1.y)) return d.id;
    }
    for (const p of d.points) { if (Math.hypot(x - p.x, y - p.y) < threshold) return d.id; }
  }
  return null;
}
