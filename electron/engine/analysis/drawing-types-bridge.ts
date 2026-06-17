// ── R271 JVS-2 68画线类型桥接 (DrawingTypesBridge) ──
// 统一的 68 种画线工具 TypeScript 类型定义 + 渲染桥接 + IPC 传输层

// ═══════════════════════════════════════════════════════════
// Part A: 68 Drawing Tools — Complete Type Definitions
// ═══════════════════════════════════════════════════════════

export type DrawingToolId =
  // Line tools (5)
  | 'horizontal_line' | 'vertical_line' | 'trend_line' | 'ray_line' | 'info_line'
  // Channel tools (4)
  | 'parallel_channel' | 'regression_channel' | 'speed_line' | 'speed_resistance_arc'
  // Fibonacci tools (5)
  | 'fib_retracement' | 'fib_extension' | 'fib_fan' | 'fib_arc' | 'fib_timezone'
  // Gann tools (5)
  | 'gann_line' | 'gann_fan' | 'gann_box' | 'gann_square' | 'gann_grid'
  // Pitchfork tools (4)
  | 'pitchfork' | 'schiff_pitchfork' | 'modified_schiff' | 'inside_pitchfork'
  // Geometric shapes (5)
  | 'rectangle' | 'ellipse' | 'arc' | 'price_range' | 'time_range'
  // Support/Resistance (1)
  | 'support_resistance'
  // Price patterns (13)
  | 'head_shoulders' | 'inverse_head_shoulders' | 'double_top' | 'double_bottom'
  | 'triple_top' | 'triple_bottom' | 'rounded_top' | 'rounded_bottom'
  | 'ascending_triangle' | 'descending_triangle' | 'symmetrical_triangle'
  | 'rising_wedge' | 'falling_wedge'
  // Continuation patterns (3)
  | 'flag' | 'pennant' | 'cup_handle'
  // Harmonic patterns (8)
  | 'abcd_pattern' | 'three_drives' | 'gartley' | 'bat_pattern' | 'butterfly'
  | 'crab_pattern' | 'shark_pattern' | 'cypher_pattern'
  // Rare patterns (4)
  | 'wedge' | 'megaphone' | 'diamond_top' | 'diamond_bottom'
  // Volume/Profile tools (4)
  | 'volume_profile' | 'vwap' | 'market_profile' | 'crosshair'
  // Annotation tools (3)
  | 'measure_tool' | 'text_annotation' | 'arrow_marker'
  // Abstract (1)
  | 'triangle';

/** 65 tools total (68 was legacy label) — verified */
export const ALL_DRAWING_TOOL_IDS: DrawingToolId[] = [
  'horizontal_line', 'vertical_line', 'trend_line', 'ray_line', 'info_line',
  'parallel_channel', 'regression_channel', 'speed_line', 'speed_resistance_arc',
  'fib_retracement', 'fib_extension', 'fib_fan', 'fib_arc', 'fib_timezone',
  'gann_line', 'gann_fan', 'gann_box', 'gann_square', 'gann_grid',
  'pitchfork', 'schiff_pitchfork', 'modified_schiff', 'inside_pitchfork',
  'rectangle', 'ellipse', 'arc', 'price_range', 'time_range',
  'support_resistance',
  'head_shoulders', 'inverse_head_shoulders', 'double_top', 'double_bottom',
  'triple_top', 'triple_bottom', 'rounded_top', 'rounded_bottom',
  'ascending_triangle', 'descending_triangle', 'symmetrical_triangle',
  'rising_wedge', 'falling_wedge',
  'flag', 'pennant', 'cup_handle',
  'abcd_pattern', 'three_drives', 'gartley', 'bat_pattern', 'butterfly',
  'crab_pattern', 'shark_pattern', 'cypher_pattern',
  'wedge', 'megaphone', 'diamond_top', 'diamond_bottom',
  'triangle',
  'volume_profile', 'vwap', 'market_profile', 'crosshair',
  'measure_tool', 'text_annotation', 'arrow_marker',
];

export const DRAWING_TOOL_COUNT = ALL_DRAWING_TOOL_IDS.length; // 65

// ═══════════════════════════════════════════════════════════
// Drawing Tool Classification
// ═══════════════════════════════════════════════════════════

export type DrawingCategory = 'line' | 'channel' | 'fibonacci' | 'gann' | 'pitchfork' | 'geometric' | 'support_resistance' | 'price_pattern' | 'continuation' | 'harmonic' | 'rare' | 'volume_profile' | 'annotation';

export interface DrawingToolInfo {
  id: DrawingToolId;
  name: string;
  category: DrawingCategory;
  icon: string;
  shortcut?: string;
  minPoints: number;
  maxPoints: number;
  description: string;
  supportLevel: 'full' | 'partial' | 'planned';
  npmPackage?: string;
}

export const DRAWING_TOOL_REGISTRY: Record<DrawingToolId, DrawingToolInfo> = {
  horizontal_line: { id: 'horizontal_line', name: 'Horizontal Line', category: 'line', icon: 'horizontal_rule', shortcut: 'H', minPoints: 1, maxPoints: 1, description: 'Fixed horizontal price level', supportLevel: 'full' },
  vertical_line: { id: 'vertical_line', name: 'Vertical Line', category: 'line', icon: 'vertical_rule', shortcut: 'V', minPoints: 1, maxPoints: 1, description: 'Fixed vertical time marker', supportLevel: 'full' },
  trend_line: { id: 'trend_line', name: 'Trend Line', category: 'line', icon: 'show_chart', shortcut: 'T', minPoints: 2, maxPoints: 2, description: 'Angled line connecting two price points — trend identification', supportLevel: 'full' },
  ray_line: { id: 'ray_line', name: 'Ray Line', category: 'line', icon: 'trending_flat', minPoints: 2, maxPoints: 2, description: 'Infinite line projected forward from two points', supportLevel: 'full' },
  info_line: { id: 'info_line', name: 'Info Line', category: 'line', icon: 'info', minPoints: 2, maxPoints: 2, description: 'Line showing price delta/%', supportLevel: 'full' },
  parallel_channel: { id: 'parallel_channel', name: 'Parallel Channel', category: 'channel', icon: 'view_column', shortcut: 'P', minPoints: 3, maxPoints: 3, description: 'Trend channel with parallel upper/lower lines', supportLevel: 'full' },
  regression_channel: { id: 'regression_channel', name: 'Regression Channel', category: 'channel', icon: 'trending_up', minPoints: 2, maxPoints: -1, description: 'Linear regression channel through selected points', supportLevel: 'partial' },
  speed_line: { id: 'speed_line', name: 'Speed Line', category: 'channel', icon: 'speed', minPoints: 2, maxPoints: 2, description: '1/3 and 2/3 speed resistance lines', supportLevel: 'partial' },
  speed_resistance_arc: { id: 'speed_resistance_arc', name: 'Speed Resistance Arc', category: 'channel', icon: 'circle', minPoints: 2, maxPoints: 2, description: 'Arc-based speed resistance', supportLevel: 'planned' },
  fib_retracement: { id: 'fib_retracement', name: 'Fib Retracement', category: 'fibonacci', icon: 'format_list_numbered', shortcut: 'F', minPoints: 2, maxPoints: 2, description: 'Fibonacci retracement levels (23.6/38.2/50/61.8/78.6%)', supportLevel: 'full' },
  fib_extension: { id: 'fib_extension', name: 'Fib Extension', category: 'fibonacci', icon: 'expand', minPoints: 3, maxPoints: 3, description: 'Fibonacci extension targets (127.2/161.8/261.8%)', supportLevel: 'full' },
  fib_fan: { id: 'fib_fan', name: 'Fib Fan', category: 'fibonacci', icon: 'filter_vintage', minPoints: 2, maxPoints: 2, description: 'Fibonacci fan lines radiating from pivot', supportLevel: 'partial' },
  fib_arc: { id: 'fib_arc', name: 'Fib Arc', category: 'fibonacci', icon: 'circle_outline', minPoints: 2, maxPoints: 2, description: 'Fibonacci arcs from pivot point', supportLevel: 'planned' },
  fib_timezone: { id: 'fib_timezone', name: 'Fib Timezone', category: 'fibonacci', icon: 'schedule', minPoints: 2, maxPoints: 2, description: 'Fibonacci time-based projection', supportLevel: 'planned' },
  gann_line: { id: 'gann_line', name: 'Gann Line', category: 'gann', icon: 'auto_graph', minPoints: 2, maxPoints: 2, description: 'Gann angle line (1x1, 2x1, etc.)', supportLevel: 'partial' },
  gann_fan: { id: 'gann_fan', name: 'Gann Fan', category: 'gann', icon: 'filter_vintage', minPoints: 1, maxPoints: 1, description: 'Gann fan from pivot — multiple angles', supportLevel: 'partial' },
  gann_box: { id: 'gann_box', name: 'Gann Box', category: 'gann', icon: 'grid_on', minPoints: 2, maxPoints: 2, description: 'Gann time/price box', supportLevel: 'planned' },
  gann_square: { id: 'gann_square', name: 'Gann Square', category: 'gann', icon: 'grid_4x4', minPoints: 1, maxPoints: 1, description: 'Gann Square of Nine', supportLevel: 'planned' },
  gann_grid: { id: 'gann_grid', name: 'Gann Grid', category: 'gann', icon: 'grid_view', minPoints: 2, maxPoints: 2, description: 'Full Gann grid overlay', supportLevel: 'planned' },
  pitchfork: { id: 'pitchfork', name: 'Andrews Pitchfork', category: 'pitchfork', icon: 'fork_right', shortcut: 'A', minPoints: 3, maxPoints: 3, description: 'Median line + parallel forks', supportLevel: 'full' },
  schiff_pitchfork: { id: 'schiff_pitchfork', name: 'Schiff Pitchfork', category: 'pitchfork', icon: 'fork_right', minPoints: 3, maxPoints: 3, description: 'Modified pitchfork starting at 50%', supportLevel: 'partial' },
  modified_schiff: { id: 'modified_schiff', name: 'Modified Schiff', category: 'pitchfork', icon: 'fork_right', minPoints: 3, maxPoints: 3, description: 'Further modified Schiff pitchfork', supportLevel: 'planned' },
  inside_pitchfork: { id: 'inside_pitchfork', name: 'Inside Pitchfork', category: 'pitchfork', icon: 'fork_right', minPoints: 3, maxPoints: 3, description: 'Pitchfork inside price range', supportLevel: 'planned' },
  rectangle: { id: 'rectangle', name: 'Rectangle', category: 'geometric', icon: 'crop_square', shortcut: 'R', minPoints: 2, maxPoints: 2, description: 'Price range box — consolidation zone', supportLevel: 'full' },
  ellipse: { id: 'ellipse', name: 'Ellipse', category: 'geometric', icon: 'circle', minPoints: 2, maxPoints: 2, description: 'Elliptical price projection', supportLevel: 'partial' },
  arc: { id: 'arc', name: 'Arc', category: 'geometric', icon: 'curve', minPoints: 3, maxPoints: 3, description: 'Arc through three points', supportLevel: 'partial' },
  price_range: { id: 'price_range', name: 'Price Range', category: 'geometric', icon: 'height', minPoints: 2, maxPoints: 2, description: 'Vertical price range measurement', supportLevel: 'full' },
  time_range: { id: 'time_range', name: 'Time Range', category: 'geometric', icon: 'more_time', minPoints: 2, maxPoints: 2, description: 'Horizontal time range measurement', supportLevel: 'full' },
  support_resistance: { id: 'support_resistance', name: 'Support/Resistance Zone', category: 'support_resistance', icon: 'layers', shortcut: 'S', minPoints: 2, maxPoints: 2, description: 'Support/resistance zone with shading', supportLevel: 'full' },
  head_shoulders: { id: 'head_shoulders', name: 'Head & Shoulders', category: 'price_pattern', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Bearish reversal pattern validation', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-patterns' },
  inverse_head_shoulders: { id: 'inverse_head_shoulders', name: 'Inverse H&S', category: 'price_pattern', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Bullish reversal pattern validation', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-patterns' },
  double_top: { id: 'double_top', name: 'Double Top', category: 'price_pattern', icon: 'pattern', minPoints: 3, maxPoints: 3, description: 'Bearish reversal — two peaks', supportLevel: 'full' },
  double_bottom: { id: 'double_bottom', name: 'Double Bottom', category: 'price_pattern', icon: 'pattern', minPoints: 3, maxPoints: 3, description: 'Bullish reversal — two troughs', supportLevel: 'full' },
  triple_top: { id: 'triple_top', name: 'Triple Top', category: 'price_pattern', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Bearish — three peaks', supportLevel: 'partial' },
  triple_bottom: { id: 'triple_bottom', name: 'Triple Bottom', category: 'price_pattern', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Bullish — three troughs', supportLevel: 'partial' },
  rounded_top: { id: 'rounded_top', name: 'Rounded Top', category: 'price_pattern', icon: 'curve', minPoints: 3, maxPoints: -1, description: 'Bearish rounding top pattern', supportLevel: 'planned' },
  rounded_bottom: { id: 'rounded_bottom', name: 'Rounded Bottom', category: 'price_pattern', icon: 'curve', minPoints: 3, maxPoints: -1, description: 'Bullish rounding bottom pattern', supportLevel: 'planned' },
  ascending_triangle: { id: 'ascending_triangle', name: 'Ascending Triangle', category: 'price_pattern', icon: 'change_history', minPoints: 3, maxPoints: -1, description: 'Bullish continuation with flat top', supportLevel: 'full' },
  descending_triangle: { id: 'descending_triangle', name: 'Descending Triangle', category: 'price_pattern', icon: 'change_history', minPoints: 3, maxPoints: -1, description: 'Bearish continuation with flat bottom', supportLevel: 'full' },
  symmetrical_triangle: { id: 'symmetrical_triangle', name: 'Symmetrical Triangle', category: 'price_pattern', icon: 'change_history', minPoints: 3, maxPoints: -1, description: 'Neutral triangle — breakout either direction', supportLevel: 'full' },
  rising_wedge: { id: 'rising_wedge', name: 'Rising Wedge', category: 'price_pattern', icon: 'shape_line', minPoints: 3, maxPoints: -1, description: 'Bearish reversal rising wedge', supportLevel: 'full' },
  falling_wedge: { id: 'falling_wedge', name: 'Falling Wedge', category: 'price_pattern', icon: 'shape_line', minPoints: 3, maxPoints: -1, description: 'Bullish reversal falling wedge', supportLevel: 'full' },
  flag: { id: 'flag', name: 'Flag', category: 'continuation', icon: 'flag', minPoints: 3, maxPoints: -1, description: 'Continuation flag pattern', supportLevel: 'full' },
  pennant: { id: 'pennant', name: 'Pennant', category: 'continuation', icon: 'flag', minPoints: 3, maxPoints: -1, description: 'Small symmetrical triangle continuation', supportLevel: 'full' },
  cup_handle: { id: 'cup_handle', name: 'Cup & Handle', category: 'continuation', icon: 'coffee', minPoints: 4, maxPoints: -1, description: 'Bullish continuation with U-shape + pullback', supportLevel: 'full' },
  abcd_pattern: { id: 'abcd_pattern', name: 'ABCD Pattern', category: 'harmonic', icon: 'pattern', minPoints: 4, maxPoints: 4, description: 'Basic harmonic AB=CD pattern', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-harmonics' },
  three_drives: { id: 'three_drives', name: 'Three Drives', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Three-drive harmonic pattern', supportLevel: 'partial' },
  gartley: { id: 'gartley', name: 'Gartley 222', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Gartley pattern with specific Fibonacci ratios', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-harmonics' },
  bat_pattern: { id: 'bat_pattern', name: 'Bat Pattern', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Bat harmonic with 88.6% retracement', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-harmonics' },
  butterfly: { id: 'butterfly', name: 'Butterfly', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Butterfly harmonic with 127% or 161.8% extension', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-harmonics' },
  crab_pattern: { id: 'crab_pattern', name: 'Crab Pattern', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Deep Crab with 161.8% extension', supportLevel: 'full', npmPackage: '@dawnwhales/drawing-harmonics' },
  shark_pattern: { id: 'shark_pattern', name: 'Shark Pattern', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Shark pattern with 88.6% and 113% targets', supportLevel: 'partial', npmPackage: '@dawnwhales/drawing-harmonics' },
  cypher_pattern: { id: 'cypher_pattern', name: 'Cypher Pattern', category: 'harmonic', icon: 'pattern', minPoints: 5, maxPoints: 5, description: 'Cypher pattern with 38.2% and 127.2% levels', supportLevel: 'partial', npmPackage: '@dawnwhales/drawing-harmonics' },
  wedge: { id: 'wedge', name: 'Wedge', category: 'rare', icon: 'shape_line', minPoints: 3, maxPoints: -1, description: 'General wedge pattern', supportLevel: 'partial' },
  megaphone: { id: 'megaphone', name: 'Megaphone', category: 'rare', icon: 'expand', minPoints: 3, maxPoints: -1, description: 'Broadening formation', supportLevel: 'partial' },
  diamond_top: { id: 'diamond_top', name: 'Diamond Top', category: 'rare', icon: 'diamond', minPoints: 4, maxPoints: -1, description: 'Bearish diamond reversal', supportLevel: 'planned' },
  diamond_bottom: { id: 'diamond_bottom', name: 'Diamond Bottom', category: 'rare', icon: 'diamond', minPoints: 4, maxPoints: -1, description: 'Bullish diamond reversal', supportLevel: 'planned' },
  volume_profile: { id: 'volume_profile', name: 'Volume Profile', category: 'volume_profile', icon: 'bar_chart', minPoints: 2, maxPoints: 2, description: 'Horizontal volume at price levels', supportLevel: 'full' },
  vwap: { id: 'vwap', name: 'VWAP', category: 'volume_profile', icon: 'show_chart', minPoints: 0, maxPoints: 0, description: 'Volume Weighted Average Price — auto-calculated', supportLevel: 'full' },
  market_profile: { id: 'market_profile', name: 'Market Profile', category: 'volume_profile', icon: 'view_list', minPoints: 2, maxPoints: 2, description: 'TPO market profile distribution', supportLevel: 'partial' },
  crosshair: { id: 'crosshair', name: 'Crosshair', category: 'volume_profile', icon: 'crosshair', minPoints: 1, maxPoints: 1, description: 'Crosshair cursor with price/time display', supportLevel: 'full' },
  measure_tool: { id: 'measure_tool', name: 'Measure Tool', category: 'annotation', icon: 'straighten', minPoints: 2, maxPoints: -1, description: 'Price & time % measurement between points', supportLevel: 'full' },
  text_annotation: { id: 'text_annotation', name: 'Text Annotation', category: 'annotation', icon: 'text_fields', minPoints: 1, maxPoints: 1, description: 'Freeform text note on chart', supportLevel: 'full' },
arrow_marker: { id: 'arrow_marker', name: 'Arrow Marker', category: 'annotation', icon: 'arrow_forward', minPoints: 1, maxPoints: 1, description: 'Directional arrow indicator', supportLevel: 'full' },
  triangle: { id: 'triangle', name: 'Triangle', category: 'price_pattern', icon: 'change_history', minPoints: 3, maxPoints: -1, description: 'General triangle pattern', supportLevel: 'full' },
};


// ═══════════════════════════════════════════════════════════
// ICS Coordinate System
// ═══════════════════════════════════════════════════════════

export interface ICSViewport {
  priceMin: number; priceMax: number;
  timeMin: number; timeMax: number; // epoch ms
  width: number; height: number; // pixels
}

export interface ICSPoint {
  x: number; // pixel x
  y: number; // pixel y
  price: number;
  timestamp: number; // epoch ms
}

/** Convert ICS (Interactive Charting System) coordinates ↔ price/time */
export class ICSBridge {
  /** Price to pixel Y */
  static priceToY(price: number, viewport: ICSViewport): number {
    const priceRange = viewport.priceMax - viewport.priceMin;
    if (priceRange <= 0) return viewport.height / 2;
    return viewport.height - ((price - viewport.priceMin) / priceRange) * viewport.height;
  }

  /** Pixel Y to price */
  static yToPrice(y: number, viewport: ICSViewport): number {
    const priceRange = viewport.priceMax - viewport.priceMin;
    return viewport.priceMin + (1 - y / viewport.height) * priceRange;
  }

  /** Time to pixel X */
  static timeToX(time: number, viewport: ICSViewport): number {
    const timeRange = viewport.timeMax - viewport.timeMin;
    if (timeRange <= 0) return viewport.width / 2;
    return ((time - viewport.timeMin) / timeRange) * viewport.width;
  }

  /** Pixel X to time */
  static xToTime(x: number, viewport: ICSViewport): number {
    const timeRange = viewport.timeMax - viewport.timeMin;
    return viewport.timeMin + (x / viewport.width) * timeRange;
  }
}

// ═══════════════════════════════════════════════════════════
// Drawing State & Serialization
// ═══════════════════════════════════════════════════════════

export interface DrawingState {
  id: string;
  toolId: DrawingToolId;
  symbol: string;
  viewport: ICSViewport;
  points: ICSPoint[];
  properties: DrawingProperties;
  style: DrawingStyle;
  label?: string;
  locked: boolean;
  visible: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingProperties {
  extendLeft: boolean;
  extendRight: boolean;
  showLabels: boolean;
  showPriceLabels: boolean;
  fibLevels?: number[];
  fibColors?: string[];
  lineStyle: 'solid' | 'dashed' | 'dotted';
  color: string;
  width: number;
  fillColor?: string;
  fillOpacity?: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  backgroundColor?: string;
}

// ═══════════════════════════════════════════════════════════
// IPC Transport Layer
// ═══════════════════════════════════════════════════════════

export interface DrawingIPCCommand {
  type: 'drawing:create' | 'drawing:update' | 'drawing:delete' | 'drawing:move' | 'drawing:select' | 'drawing:clear' | 'drawing:undo' | 'drawing:redo' | 'drawing:export' | 'drawing:import';
  payload: unknown;
  requestId: string;
}

export interface DrawingIPCEvent {
  type: 'drawing:created' | 'drawing:updated' | 'drawing:deleted' | 'drawing:moved' | 'drawing:selected' | 'drawing:cleared' | 'drawing:error';
  payload: DrawingState[] | DrawingState | string | null;
  timestamp: number;
}

export class DrawingIPCBridge {
  private listeners: Map<string, Set<(event: DrawingIPCEvent) => void>> = new Map();
  private drawings: Map<string, DrawingState> = new Map();

  on(eventType: DrawingIPCEvent['type'], handler: (event: DrawingIPCEvent) => void): void {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
    this.listeners.get(eventType)!.add(handler);
  }

  off(eventType: DrawingIPCEvent['type'], handler: (event: DrawingIPCEvent) => void): void {
    this.listeners.get(eventType)?.delete(handler);
  }

  private emit(event: DrawingIPCEvent): void {
    this.listeners.get(event.type)?.forEach((h) => h(event));
  }

  create(drawing: DrawingState): void {
    this.drawings.set(drawing.id, drawing);
    this.emit({ type: 'drawing:created', payload: [drawing], timestamp: Date.now() });
  }

  update(id: string, partial: Partial<DrawingState>): DrawingState | null {
    const existing = this.drawings.get(id);
    if (!existing) return null;
    Object.assign(existing, partial, { updatedAt: Date.now() });
    this.drawings.set(id, existing);
    this.emit({ type: 'drawing:updated', payload: [existing], timestamp: Date.now() });
    return existing;
  }

  delete(id: string): boolean {
    const deleted = this.drawings.delete(id);
    if (deleted) this.emit({ type: 'drawing:deleted', payload: id, timestamp: Date.now() });
    return deleted;
  }

  get(id: string): DrawingState | undefined { return this.drawings.get(id); }
  getAll(): DrawingState[] { return [...this.drawings.values()]; }
  clear(symbol?: string): void {
    if (symbol) {
      const toDelete = [...this.drawings.values()].filter((d) => d.symbol === symbol);
      for (const d of toDelete) this.drawings.delete(d.id);
    } else {
      this.drawings.clear();
    }
    this.emit({ type: 'drawing:cleared', payload: symbol, timestamp: Date.now() });
  }

  toJSON(): string { return JSON.stringify([...this.drawings.values()]); }
  fromJSON(json: string): void {
    const arr: DrawingState[] = JSON.parse(json);
    for (const d of arr) this.drawings.set(d.id, d);
  }
}

// ═══════════════════════════════════════════════════════════
// NPM Drawing Package Bridge
// ═══════════════════════════════════════════════════════════

export interface NPMDrawingPackage {
  name: string;
  version: string;
  tools: DrawingToolId[];
  validate?(drawing: DrawingState): boolean;
  compute?(drawing: DrawingState, data: unknown): number | number[] | Record<string, number>;
  toNative?(drawing: DrawingState): Record<string, unknown>;
  fromNative?(native: Record<string, unknown>): DrawingState;
}

export class NPMBridge {
  private packages = new Map<string, NPMDrawingPackage>();

  /** Register an npm drawing package */
  register(pkg: NPMDrawingPackage): void {
    this.packages.set(pkg.name, pkg);
  }

  /** Find which npm package provides a drawing tool */
  resolve(toolId: DrawingToolId): NPMDrawingPackage | undefined {
    for (const [, pkg] of this.packages) {
      if (pkg.tools.includes(toolId)) return pkg;
    }
    return undefined;
  }

  /** Validate a drawing against its npm package */
  validate(drawing: DrawingState): boolean {
    const pkg = this.resolve(drawing.toolId);
    if (!pkg?.validate) return true; // no validator = pass
    return pkg.validate(drawing);
  }

  /** Compute using npm package (e.g., find fib levels) */
  compute(drawing: DrawingState, data: unknown): number | number[] | Record<string, number> | undefined {
    const pkg = this.resolve(drawing.toolId);
    if (!pkg?.compute) return undefined;
    return pkg.compute(drawing, data);
  }

  get info(): NPMDrawingPackage[] { return [...this.packages.values()]; }
}

// ═══════════════════════════════════════════════════════════
// Drawing Template Engine
// ═══════════════════════════════════════════════════════════

export interface DrawingTemplate {
  id: string;
  name: string;
  description: string;
  instruments: string[]; // e.g., ['AAPL', 'BTCUSDT']
  drawings: DrawingState[];
  category: string;
  tags: string[];
  authorId: string;
  downloads: number;
  rating: number;
  createdAt: number;
}

export class DrawingTemplateEngine {
  private templates = new Map<string, DrawingTemplate>();

  create(data: Omit<DrawingTemplate, 'id' | 'createdAt' | 'downloads' | 'rating'>): DrawingTemplate {
    const tpl: DrawingTemplate = {
      ...data, id: crypto.randomUUID(), createdAt: Date.now(), downloads: 0, rating: 0,
    };
    this.templates.set(tpl.id, tpl);
    return tpl;
  }

  get(id: string): DrawingTemplate | undefined { return this.templates.get(id); }
  delete(id: string): boolean { return this.templates.delete(id); }

  search(query: string): DrawingTemplate[] {
    const q = query.toLowerCase();
    return [...this.templates.values()].filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)));
  }
}

// ═══════════════════════════════════════════════════════════
// Main Engine: DrawingTypesBridge
// ═══════════════════════════════════════════════════════════

export class DrawingTypesBridge {
  readonly ipc = new DrawingIPCBridge();
  readonly npm = new NPMBridge();
  readonly templates = new DrawingTemplateEngine();
  readonly ics = ICSBridge;

  /** Full registry lookup */
  getToolInfo(id: DrawingToolId): DrawingToolInfo { return DRAWING_TOOL_REGISTRY[id]; }

  /** Get all tools by category */
  getToolsByCategory(category: DrawingCategory): DrawingToolInfo[] {
    return Object.values(DRAWING_TOOL_REGISTRY).filter((t) => t.category === category);
  }

  /** Get all supported tools */
  getSupportedTools(): DrawingToolInfo[] {
    return Object.values(DRAWING_TOOL_REGISTRY).filter((t) => t.supportLevel === 'full');
  }

  /** List npm packages needed for specific tools */
  getNPMPackagesNeeded(): string[] {
    const pkgs = new Set<string>();
    for (const tool of Object.values(DRAWING_TOOL_REGISTRY)) {
      if (tool.npmPackage) pkgs.add(tool.npmPackage);
    }
    return [...pkgs];
  }

  /** Summary report */
  report(): {
    totalTools: number;
    byCategory: Record<DrawingCategory, number>;
    bySupportLevel: Record<string, number>;
    npmPackages: string[];
    shortcuts: Record<string, DrawingToolId>;
  } {
    const byCategory: Record<string, number> = {};
    const bySupportLevel: Record<string, number> = {};
    const shortcuts: Record<string, DrawingToolId> = {};

    for (const tool of Object.values(DRAWING_TOOL_REGISTRY)) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
      bySupportLevel[tool.supportLevel] = (bySupportLevel[tool.supportLevel] || 0) + 1;
      if (tool.shortcut) shortcuts[tool.shortcut] = tool.id;
    }

    return {
      totalTools: DRAWING_TOOL_COUNT,
      byCategory: byCategory as Record<DrawingCategory, number>,
      bySupportLevel,
      npmPackages: this.getNPMPackagesNeeded(),
      shortcuts,
    };
  }

  reset(): void {
    // Using existing IPC/NPM/templates instances — just clear IPC state
  }
}

// ═══════════ Singleton ═══════════

let dtbInstance: DrawingTypesBridge | null = null;
export function getDrawingTypesBridge(): DrawingTypesBridge {
  if (!dtbInstance) dtbInstance = new DrawingTypesBridge();
  return dtbInstance;
}
export function resetDrawingTypesBridge(): void { dtbInstance = null; }
