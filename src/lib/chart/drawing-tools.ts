// DAWN WHALES R113 - Drawing Tools (20 core tools)
// TradingView-grade drawing annotation system
// PM: quote upgrade v2.0 module 3 P0 - TradingView 68 kinds, 20 core first
// Integrates with lightweight-charts 4.2.3 via ISeriesPrimitive
// Pure frontend - no broker/electron dependency

export type DrawingId = string;

export type ToolType =
  // Trend (4)
  | 'trend-line' | 'ray' | 'extended-line' | 'info-line'
  // Fib (4)
  | 'fib-retracement' | 'fib-extension' | 'fib-channel' | 'fib-speed-resistance'
  // Channel (3)
  | 'parallel-channel' | 'pitchfork' | 'regression-trend'
  // Shape (4)
  | 'rectangle' | 'triangle' | 'ellipse' | 'arc'
  // Annotation (3)
  | 'text' | 'label-callout' | 'arrow-marker'
  // Measurement (2)
  | 'price-range' | 'date-range';

export interface Point {
  x: number;  // canvas pixel x
  y: number;  // canvas pixel y
  price: number;
  time: number; // Unix ms
}

export type DrawingState = 'idle' | 'drawing' | 'selected' | 'moving' | 'resizing';

export interface DrawingHandle {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'start' | 'end' | 'center';
  point: Point;
  visible: boolean;
}

export interface DrawingBase {
  id: DrawingId;
  type: ToolType;
  state: DrawingState;
  points: Point[];
  handles: DrawingHandle[];
  locked: boolean;
  visible: boolean;
  zIndex: number;
  createdAt: number;
  label?: string;
  note?: string;
}

export interface TrendLine extends DrawingBase {
  type: 'trend-line';
  points: [Point, Point];
  extendLeft: boolean;
  extendRight: boolean;
  ray: boolean;
}

export interface FibRetracement extends DrawingBase {
  type: 'fib-retracement';
  points: [Point, Point];
  levels: number[];      // [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  showLabels: boolean;
  showLevels: boolean;
  invertFib: boolean;
}

export interface FibExtension extends DrawingBase {
  type: 'fib-extension';
  points: [Point, Point, Point];  // start, end, target
  levels: number[];      // [0, 0.618, 1, 1.618, 2.618, 3.618, 4.236]
  showLabels: boolean;
}

export interface ParallelChannel extends DrawingBase {
  type: 'parallel-channel';
  points: [Point, Point, Point];  // base-p1, base-p2, width-p3
  extendLeft: boolean;
  extendRight: boolean;
}

export interface Pitchfork extends DrawingBase {
  type: 'pitchfork';
  points: [Point, Point, Point];  // anchor, handle1, handle2
  levels: number[];      // [0.25, 0.382, 0.5, 0.618, 0.75, 1, 1.5, 2]
}

export interface Rectangle extends DrawingBase {
  type: 'rectangle';
  points: [Point, Point];  // top-left, bottom-right
  filled: boolean;
  fillOpacity: number;
  borderColor: string;
}

export interface TextAnnotation extends DrawingBase {
  type: 'text';
  points: [Point];
  content: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
}

export interface LabelCallout extends DrawingBase {
  type: 'label-callout';
  points: [Point, Point];  // anchor, label position
  content: string;
  fontSize: number;
}

export interface ArrowMarker extends DrawingBase {
  type: 'arrow-marker';
  points: [Point, Point];  // start, tip
  tipType: 'arrow' | 'circle' | 'diamond';
  color: string;
}

// Union type
export type Drawing = TrendLine | FibRetracement | FibExtension | ParallelChannel | Pitchfork | Rectangle | TextAnnotation | LabelCallout | ArrowMarker;

export interface DrawingCollection {
  drawings: Drawing[];
  selectedId: DrawingId | null;
  undoStack: Drawing[][];
  redoStack: Drawing[][];
  maxUndo: number;
}

export interface DrawingColors {
  trend: string;
  fib: string;
  channel: string;
  shape: string;
  text: string;
  arrow: string;
  selected: string;
  handle: string;
}

export const DEFAULT_DRAWING_COLORS: DrawingColors = {
  trend: '#c9a96e',
  fib: '#6e9ec9',
  channel: '#9ec96e',
  shape: '#c96e9e',
  text: '#e0e0e0',
  arrow: '#ff6b6b',
  selected: '#ffd700',
  handle: '#ffffff',
};

// ═══════════ Drawing Tool Factory ═══════════

let idCounter = 0;
function nextId(): DrawingId { return 'draw-' + (++idCounter) + '-' + Date.now(); }

export function createTrendLine(p1: Point, p2: Point, extendRight = true, extendLeft = false): TrendLine {
  return {
    id: nextId(), type: 'trend-line', state: 'idle',
    points: [p1, p2], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'TL', extendLeft, extendRight, ray: false,
  };
}

export function createFibRetracement(p1: Point, p2: Point): FibRetracement {
  return {
    id: nextId(), type: 'fib-retracement', state: 'idle',
    points: [p1, p2], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'Fib',
    levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
    showLabels: true, showLevels: true, invertFib: false,
  };
}

export function createFibExtension(p1: Point, p2: Point, p3: Point): FibExtension {
  return {
    id: nextId(), type: 'fib-extension', state: 'idle',
    points: [p1, p2, p3], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'FibExt',
    levels: [0, 0.618, 1, 1.618, 2.618, 3.618, 4.236],
    showLabels: true,
  };
}

export function createParallelChannel(p1: Point, p2: Point, p3: Point): ParallelChannel {
  return {
    id: nextId(), type: 'parallel-channel', state: 'idle',
    points: [p1, p2, p3], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'Ch', extendLeft: false, extendRight: true,
  };
}

export function createPitchfork(p1: Point, p2: Point, p3: Point): Pitchfork {
  return {
    id: nextId(), type: 'pitchfork', state: 'idle',
    points: [p1, p2, p3], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'PF',
    levels: [0.25, 0.382, 0.5, 0.618, 0.75, 1, 1.5, 2],
  };
}

export function createRectangle(p1: Point, p2: Point): Rectangle {
  return {
    id: nextId(), type: 'rectangle', state: 'idle',
    points: [p1, p2], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'Rect',
    filled: false, fillOpacity: 0.15, borderColor: DEFAULT_DRAWING_COLORS.shape,
  };
}

export function createTextAnnotation(p: Point, content: string): TextAnnotation {
  return {
    id: nextId(), type: 'text', state: 'idle',
    points: [p], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'T', content, fontSize: 12,
    color: DEFAULT_DRAWING_COLORS.text, backgroundColor: 'transparent',
  };
}

export function createLabelCallout(pAnchor: Point, pLabel: Point, content: string): LabelCallout {
  return {
    id: nextId(), type: 'label-callout', state: 'idle',
    points: [pAnchor, pLabel], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'Note', content, fontSize: 12,
  };
}

export function createArrowMarker(p1: Point, p2: Point): ArrowMarker {
  return {
    id: nextId(), type: 'arrow-marker', state: 'idle',
    points: [p1, p2], handles: [], locked: false, visible: true, zIndex: 0,
    createdAt: Date.now(), label: 'Arrow',
    tipType: 'arrow', color: DEFAULT_DRAWING_COLORS.arrow,
  };
}

// ═══════════ Drawing Collection Manager ═══════════

export function createDrawingCollection(maxUndo = 50): DrawingCollection {
  return { drawings: [], selectedId: null, undoStack: [], redoStack: [], maxUndo };
}

export function addDrawing(coll: DrawingCollection, drawing: Drawing): DrawingCollection {
  coll.drawings = [...coll.drawings, drawing];
  coll.undoStack = [...coll.undoStack.slice(-coll.maxUndo + 1), coll.drawings.slice(0, -1)];
  coll.redoStack = [];
  return { ...coll, drawings: coll.drawings, undoStack: coll.undoStack, redoStack: coll.redoStack };
}

export function removeDrawing(coll: DrawingCollection, id: DrawingId): DrawingCollection {
  coll.undoStack = [...coll.undoStack.slice(-coll.maxUndo + 1), coll.drawings];
  coll.drawings = coll.drawings.filter(d => d.id !== id);
  coll.redoStack = [];
  if (coll.selectedId === id) coll.selectedId = null;
  return { ...coll, drawings: coll.drawings, undoStack: coll.undoStack, redoStack: coll.redoStack, selectedId: coll.selectedId };
}

export function updateDrawing(coll: DrawingCollection, id: DrawingId, updates: Partial<Drawing>): DrawingCollection {
  coll.drawings = coll.drawings.map(d => d.id === id ? { ...d, ...updates } as Drawing : d);
  return { ...coll, drawings: coll.drawings };
}

export function selectDrawing(coll: DrawingCollection, id: DrawingId | null): DrawingCollection {
  coll.selectedId = id;
  return { ...coll, selectedId: id };
}

export function undoDrawing(coll: DrawingCollection): DrawingCollection {
  if (coll.undoStack.length === 0) return coll;
  coll.redoStack = [...coll.redoStack, coll.drawings];
  coll.drawings = coll.undoStack[coll.undoStack.length - 1];
  coll.undoStack = coll.undoStack.slice(0, -1);
  return { ...coll, drawings: coll.drawings, undoStack: coll.undoStack, redoStack: coll.redoStack };
}

export function redoDrawing(coll: DrawingCollection): DrawingCollection {
  if (coll.redoStack.length === 0) return coll;
  coll.undoStack = [...coll.undoStack, coll.drawings];
  coll.drawings = coll.redoStack[coll.redoStack.length - 1];
  coll.redoStack = coll.redoStack.slice(0, -1);
  return { ...coll, drawings: coll.drawings, undoStack: coll.undoStack, redoStack: coll.redoStack };
}

export function clearDrawings(coll: DrawingCollection): DrawingCollection {
  coll.undoStack = [...coll.undoStack.slice(-coll.maxUndo + 1), coll.drawings];
  coll.drawings = [];
  coll.redoStack = [];
  coll.selectedId = null;
  return { ...coll, drawings: coll.drawings, undoStack: coll.undoStack, redoStack: coll.redoStack, selectedId: null };
}

export function clearAllDrawings(coll: DrawingCollection): DrawingCollection {
  return { drawings: [], selectedId: null, undoStack: [], redoStack: [], maxUndo: coll.maxUndo };
}

// ═══════════ Geometry Helpers ═══════════

/** Compute fib retracement price levels between two points */
export function computeFibLevels(p1: Point, p2: Point, levels: number[]): { level: number; price: number; color: string }[] {
  const diff = p2.price - p1.price;
  const colors = ['#22c55e', '#22c55e', '#fbbf24', '#fbbf24', '#f97316', '#ef4444', '#ef4444'];
  return levels.map((l, i) => ({
    level: l,
    price: +(p2.price - diff * l).toFixed(8),
    color: colors[i] || '#8b949e',
  }));
}

/** Compute fib extension price levels */
export function computeFibExtensionLevels(p1: Point, p2: Point, p3: Point, levels: number[]): { level: number; price: number }[] {
  const diff = p2.price - p1.price;
  return levels.map(l => ({
    level: l,
    price: +(p3.price + diff * l).toFixed(8),
  }));
}

/** Compute parallel channel offset */
export function computeChannelOffset(p1: Point, p2: Point, p3: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const slope = dx === 0 ? 0 : dy / dx;
  const intercept = p2.y - slope * p2.x;
  return p3.y - (slope * p3.x + intercept);
}

/** Check if a point is near a line segment (used for hit-testing) */
export function pointNearLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number, threshold = 8): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1) < threshold;
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) < threshold;
}

/** Get colors for drawing type */
export function getDrawingColor(type: ToolType): string {
  const map: Record<string, string> = {
    'trend-line': DEFAULT_DRAWING_COLORS.trend,
    'ray': DEFAULT_DRAWING_COLORS.trend,
    'extended-line': DEFAULT_DRAWING_COLORS.trend,
    'info-line': DEFAULT_DRAWING_COLORS.trend,
    'fib-retracement': DEFAULT_DRAWING_COLORS.fib,
    'fib-extension': DEFAULT_DRAWING_COLORS.fib,
    'fib-channel': DEFAULT_DRAWING_COLORS.fib,
    'fib-speed-resistance': DEFAULT_DRAWING_COLORS.fib,
    'parallel-channel': DEFAULT_DRAWING_COLORS.channel,
    'pitchfork': DEFAULT_DRAWING_COLORS.channel,
    'regression-trend': DEFAULT_DRAWING_COLORS.channel,
    'rectangle': DEFAULT_DRAWING_COLORS.shape,
    'triangle': DEFAULT_DRAWING_COLORS.shape,
    'ellipse': DEFAULT_DRAWING_COLORS.shape,
    'arc': DEFAULT_DRAWING_COLORS.shape,
    'text': DEFAULT_DRAWING_COLORS.text,
    'label-callout': DEFAULT_DRAWING_COLORS.text,
    'arrow-marker': DEFAULT_DRAWING_COLORS.arrow,
    'price-range': DEFAULT_DRAWING_COLORS.shape,
    'date-range': DEFAULT_DRAWING_COLORS.shape,
  };
  return map[type] || DEFAULT_DRAWING_COLORS.trend;
}

// ═══════════ Serialization ═══════════

export function serializeDrawing(drawing: Drawing): string {
  return JSON.stringify(drawing);
}

export function deserializeDrawing(json: string): Drawing {
  return JSON.parse(json) as Drawing;
}

export function serializeCollection(coll: DrawingCollection): string {
  return JSON.stringify({ drawings: coll.drawings, selectedId: coll.selectedId });
}

export function deserializeCollection(json: string, maxUndo = 50): DrawingCollection {
  const data = JSON.parse(json);
  return { drawings: data.drawings || [], selectedId: data.selectedId || null, undoStack: [], redoStack: [], maxUndo };
}

// ═══════════ Persistence (localStorage) ═══════════

export function saveDrawings(chartId: string, coll: DrawingCollection): void {
  try { localStorage.setItem(`dw_drawings_${chartId}`, serializeCollection(coll)); } catch {}
}

export function loadDrawings(chartId: string): DrawingCollection | null {
  try {
    const raw = localStorage.getItem(`dw_drawings_${chartId}`);
    return raw ? deserializeCollection(raw) : null;
  } catch { return null; }
}

export function deleteDrawings(chartId: string): void {
  try { localStorage.removeItem(`dw_drawings_${chartId}`); } catch {}
}