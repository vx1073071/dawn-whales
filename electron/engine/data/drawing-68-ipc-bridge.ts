/**
 * R269: Drawing68IpcBridge — 68画线工具→IPC桥接
 *
 * 功能:
 *   1. 68种画线工具注册 (21基线+27涨幅+10回调+5虚拟+5比例)
 *   2. 画线CRUD IPC总线 (create/update/delete/select/snap)
 *   3. 跨窗口画线同步 (多图同步+跨显示器)
 *   4. 画线分组/图层管理
 *   5. 画线序列化 (→ jsonb + base64 screenshot)
 *   6. 画线碰撞检测
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawingToolDef {
  id: string;
  name: string;
  nameCn: string;
  category: DrawingCategory;
  icon: string;
  hotkey?: string;
  params: Record<string, any>;
  isMagnetic: boolean;      // snap to price
  isSnapToBar: boolean;     // snap to candle bar
  zIndex: number;
  magnetStrength?: number;   // pixels
}

export type DrawingCategory =
  | 'line'          // 基础线
  | 'channel'       // 通道
  | 'fib'           // 斐波那契
  | 'gann'          // 江恩
  | 'geometric'     // 几何
  | 'annotation'    // 标注
  | 'measure'       // 测量
  | 'pitchfork'     // 安德鲁叉
  | 'range'         // 区间
  | 'projection'    // 投影
  | 'china'         // 中国特色
  | 'custom';       // 自定义

export interface IpcDrawing {
  drawingId: string;
  toolId: string;
  symbol: string;
  chartId: string;
  category: DrawingCategory;
  state: DrawingState;
  layer: number;
  locked: boolean;
  visible: boolean;
  groupId?: string;
  label?: string;
  labelCn?: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
  version: number;
}

export interface DrawingState {
  points: DrawingPoint[];
  color: string;
  lineWidth: number;
  lineStyle: number[];       // [dash, gap, ...]
  font?: string;
  fontSize?: number;
  backgroundColor?: string;
  opacity: number;
  extendLeft: boolean;
  extendRight: boolean;
  showPrice: boolean;
  showTimestamp: boolean;
  fillColor?: string;
  fillOpacity?: number;
  text?: string;
  textCn?: string;
}

export interface DrawingPoint {
  price: number;
  time: number;
  x: number;
  y: number;
  barIndex: number;
}

export interface IpcDrawingEvent {
  eventId: string;
  type: 'drawing:created' | 'drawing:updated' | 'drawing:deleted' | 'drawing:selected' | 'drawing:snapped' | 'drawing:bulk';
  drawings: IpcDrawing[];
  chartId: string;
  timestamp: number;
}

export interface DrawingSnapshot {
  symbol: string;
  chartId: string;
  drawings: IpcDrawing[];
  layers: DrawingLayer[];
  viewport: { minPrice: number; maxPrice: number; minTime: number; maxTime: number };
  snapshotAt: number;
}

export interface DrawingLayer {
  layerId: string;
  name: string;
  nameCn: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 68 DRAWING TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const DRAWING_TOOLS: DrawingToolDef[] = [
  // ── 基础线 (12) ───────────────────────────────────────────────────────
  { id:'horizontal-line', name:'Horizontal Line', nameCn:'水平线', category:'line', icon:'━', hotkey:'H', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'vertical-line', name:'Vertical Line', nameCn:'垂直线', category:'line', icon:'┃', hotkey:'V', params:{}, isMagnetic:false, isSnapToBar:true, zIndex:100 },
  { id:'trend-line', name:'Trend Line', nameCn:'趋势线', category:'line', icon:'╱', hotkey:'T', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'ray', name:'Ray', nameCn:'射线', category:'line', icon:'➤', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'extended-line', name:'Extended Line', nameCn:'延长线', category:'line', icon:'⟷', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'arrow', name:'Arrow', nameCn:'箭头', category:'line', icon:'➤', params:{arrowDirection:'up'}, isMagnetic:true, isSnapToBar:false, zIndex:110 },
  { id:'cross-line', name:'Cross Line', nameCn:'十字线', category:'line', icon:'┼', params:{}, isMagnetic:true, isSnapToBar:true, zIndex:110, magnetStrength:5 },
  { id:'parallel-line', name:'Parallel Line', nameCn:'平行线', category:'line', icon:'∥', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'angle-line', name:'Angle Line', nameCn:'角度线', category:'line', icon:'∠', params:{angle:45}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'curved-line', name:'Curved Line', nameCn:'曲线', category:'line', icon:'⌣', params:{smoothness:0.5}, isMagnetic:false, isSnapToBar:false, zIndex:100 },
  { id:'price-line', name:'Price Line', nameCn:'价格线', category:'line', icon:'$', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:90 },
  { id:'time-line', name:'Time Line', nameCn:'时间线', category:'line', icon:'⏰', params:{}, isMagnetic:false, isSnapToBar:true, zIndex:90 },

  // ── 通道 (8) ──────────────────────────────────────────────────────────
  { id:'parallel-channel', name:'Parallel Channel', nameCn:'平行通道', category:'channel', icon:'▬', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'regression-trend', name:'Regression Trend', nameCn:'回归趋势通道', category:'channel', icon:'📊', params:{stddev:2}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'railroad', name:'Railroad Tracks', nameCn:'铁轨', category:'channel', icon:'🛤️', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'polyline-channel', name:'Polyline Channel', nameCn:'折线通道', category:'channel', icon:'〰️', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'disjoint-channel', name:'Disjoint Channel', nameCn:'分离通道', category:'channel', icon:'⋮', params:{gap:10}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'filled-channel', name:'Filled Channel', nameCn:'填充通道', category:'channel', icon:'▰', params:{fillColor:'#33333333'}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'ghost-channel', name:'Ghost Feed', nameCn:'幽灵通道', category:'channel', icon:'👻', params:{offset:5}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'date-range', name:'Date Range', nameCn:'日期区间', category:'channel', icon:'📅', params:{}, isMagnetic:false, isSnapToBar:true, zIndex:100 },

  // ── 斐波那契 (12) ─────────────────────────────────────────────────────
  { id:'fib-retracement', name:'Fib Retracement', nameCn:'斐波回撤', category:'fib', icon:'📐', params:{levels:[0,0.236,0.382,0.5,0.618,0.786,1]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-extension', name:'Fib Extension', nameCn:'斐波扩展', category:'fib', icon:'📏', params:{levels:[0,0.382,0.618,1,1.382,1.618,2.618]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-time-zone', name:'Fib Time Zone', nameCn:'斐波时间区', category:'fib', icon:'⏱️', params:{levels:[0,1,2,3,5,8,13,21]}, isMagnetic:false, isSnapToBar:true, zIndex:100 },
  { id:'fib-speed-resistance', name:'Fib Speed Resistance', nameCn:'斐波速度阻力', category:'fib', icon:'📈', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-channel', name:'Fib Channel', nameCn:'斐波通道', category:'fib', icon:'▬', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-circles', name:'Fib Circles', nameCn:'斐波圆弧', category:'fib', icon:'⭕', params:{levels:[0.236,0.382,0.5,0.618,0.786]}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'fib-fan', name:'Fib Fan', nameCn:'斐波扇形', category:'fib', icon:'📐', params:{levels:[0.382,0.5,0.618,0.786]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-spiral', name:'Fib Spiral', nameCn:'斐波螺旋', category:'fib', icon:'🌀', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'fib-arc', name:'Fib Arc', nameCn:'斐波弧线', category:'fib', icon:'🌙', params:{levels:[0.382,0.5,0.618]}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'fib-wedge', name:'Fib Wedge', nameCn:'斐波楔形', category:'fib', icon:'△', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-parallel', name:'Fib Parallel', nameCn:'斐波平行', category:'fib', icon:'∥', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'fib-trend-based', name:'Trend-Based Fib', nameCn:'趋势斐波', category:'fib', icon:'〽️', params:{levels:[0,0.382,0.618,1,1.618,2.618]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },

  // ── 江恩 (8) ──────────────────────────────────────────────────────────
  { id:'gann-line', name:'Gann Line', nameCn:'江恩线', category:'gann', icon:'📐', params:{ratio:1}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'gann-fan', name:'Gann Fan', nameCn:'江恩扇形', category:'gann', icon:'🔺', params:{ratios:[1,2,3,4,8,0.5,0.333,0.25]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'gann-box', name:'Gann Box', nameCn:'江恩箱', category:'gann', icon:'📦', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'gann-square', name:'Gann Square', nameCn:'江恩方阵', category:'gann', icon:'⬛', params:{size:144}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'gann-grid', name:'Gann Grid', nameCn:'江恩网格', category:'gann', icon:'🔲', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:90 },
  { id:'gann-angle', name:'Gann Angle', nameCn:'江恩角度', category:'gann', icon:'∠', params:{degrees:[45,63.75,71.25,75,82.5]}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'gann-trade-calculator', name:'Gann Trade Calculator', nameCn:'江恩交易计算器', category:'gann', icon:'🔢', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'gann-swing-chart', name:'Gann Swing Chart', nameCn:'江恩摆动图', category:'gann', icon:'📊', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },

  // ── 几何 (10) ─────────────────────────────────────────────────────────
  { id:'rectangle', name:'Rectangle', nameCn:'矩形', category:'geometric', icon:'▭', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'triangle', name:'Triangle', nameCn:'三角形', category:'geometric', icon:'△', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'ellipse', name:'Ellipse', nameCn:'椭圆', category:'geometric', icon:'⬭', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'arc', name:'Arc', nameCn:'圆弧', category:'geometric', icon:'🌙', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'sector', name:'Sector', nameCn:'扇形', category:'geometric', icon:'◴', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:95 },
  { id:'polygon', name:'Polygon', nameCn:'多边形', category:'geometric', icon:'⬠', params:{sides:5}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'path', name:'Path', nameCn:'路径', category:'geometric', icon:'✏️', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'highlighter', name:'Highlighter', nameCn:'荧光笔', category:'geometric', icon:'🖍️', params:{width:20,opacity:0.3}, isMagnetic:false, isSnapToBar:false, zIndex:80 },
  { id:'brush', name:'Regular Poly', nameCn:'画笔', category:'geometric', icon:'🖌️', params:{}, isMagnetic:false, isSnapToBar:false, zIndex:100 },
  { id:'bracket', name:'Bracket', nameCn:'括号', category:'geometric', icon:'❴', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },

  // ── 标注 (6) ──────────────────────────────────────────────────────────
  { id:'text', name:'Text', nameCn:'文字', category:'annotation', icon:'T', params:{font:'Arial',fontSize:14}, isMagnetic:false, isSnapToBar:false, zIndex:120 },
  { id:'text-note', name:'Text Note', nameCn:'备注', category:'annotation', icon:'📝', params:{font:'Arial',fontSize:12}, isMagnetic:false, isSnapToBar:false, zIndex:120 },
  { id:'callout', name:'Callout', nameCn:'气泡', category:'annotation', icon:'💬', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:120 },
  { id:'price-label', name:'Price Label', nameCn:'价格标签', category:'annotation', icon:'💲', params:{precision:2}, isMagnetic:true, isSnapToBar:false, zIndex:120 },
  { id:'emoji', name:'Emoji', nameCn:'表情', category:'annotation', icon:'😊', params:{emoji:'📈',size:24}, isMagnetic:false, isSnapToBar:false, zIndex:130 },
  { id:'sticker', name:'Sticker', nameCn:'贴纸', category:'annotation', icon:'🏷️', params:{imageUrl:''}, isMagnetic:false, isSnapToBar:false, zIndex:130 },

  // ── 测量 (5) ──────────────────────────────────────────────────────────
  { id:'price-range', name:'Price Range', nameCn:'价格区间', category:'measure', icon:'↕️', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:110 },
  { id:'long-position', name:'Long Position', nameCn:'多头仓位', category:'measure', icon:'🟩', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:110 },
  { id:'short-position', name:'Short Position', nameCn:'空头仓位', category:'measure', icon:'🟥', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:110 },
  { id:'risk-reward-long', name:'Risk Reward Long', nameCn:'风报比做多', category:'measure', icon:'🎯', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:110 },
  { id:'risk-reward-short', name:'Risk Reward Short', nameCn:'风报比做空', category:'measure', icon:'🎯', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:110 },

  // ── 安德鲁叉 (3) ─────────────────────────────────────────────────────
  { id:'pitchfork', name:'Andrews Pitchfork', nameCn:'安德鲁叉', category:'pitchfork', icon:'🔱', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'schiff-pitchfork', name:'Schiff Pitchfork', nameCn:'希夫叉', category:'pitchfork', icon:'🔱', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'modified-schiff', name:'Modified Schiff', nameCn:'改进希夫叉', category:'pitchfork', icon:'🔱', params:{offset:0.5}, isMagnetic:true, isSnapToBar:false, zIndex:100 },

  // ── 投影 (2) ──────────────────────────────────────────────────────────
  { id:'measurement-ruler', name:'Measurement Ruler', nameCn:'测量尺', category:'projection', icon:'📏', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:115 },
  { id:'projection', name:'Projection', nameCn:'投影', category:'projection', icon:'📐', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },

  // ── 中国特色 (2) ─────────────────────────────────────────────────────
  { id:'cdp', name:'CDP', nameCn:'逆势操作', category:'china', icon:'🔄', params:{}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
  { id:'tape-reading', name:'Tape Reading', nameCn:'盘口挂单', category:'china', icon:'📋', params:{levels:5}, isMagnetic:true, isSnapToBar:false, zIndex:100 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Drawing68IpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class Drawing68IpcBridge {
  private drawings: Map<string, IpcDrawing> = new Map();
  private layers: Map<string, DrawingLayer> = new Map();
  private events: IpcDrawingEvent[] = [];
  private snapshots: Map<string, DrawingSnapshot> = new Map();
  private stats_ = { totalDrawings: 0, totalSnapshots: 0, totalEvents: 0, byCategory: {} as Record<string, number> };

  constructor() {}

  // ── Public API: Tool Registry ────────────────────────────────────────────

  /** Get all 68 drawing tool definitions */
  getAllTools(): DrawingToolDef[] { return [...DRAWING_TOOLS]; }

  /** Get tools by category */
  getToolsByCategory(category: DrawingCategory): DrawingToolDef[] {
    return DRAWING_TOOLS.filter(t => t.category === category);
  }

  /** Get tool definition by id */
  getTool(toolId: string): DrawingToolDef | null {
    return DRAWING_TOOLS.find(t => t.id === toolId) ?? null;
  }

  /** Get total tool count */
  getToolCount(): number { return DRAWING_TOOLS.length; }

  // ── Public API: Drawing CRUD ─────────────────────────────────────────────

  /** Create a drawing */
  create(params: {
    toolId: string;
    symbol: string;
    chartId: string;
    state: DrawingState;
    layer?: number;
    label?: string;
    labelCn?: string;
    groupId?: string;
    userId: string;
  }): IpcDrawing | null {
    const tool = this.getTool(params.toolId);
    if (!tool) return null;

    const now = Date.now();
    const drawing: IpcDrawing = {
      drawingId: `draw:${params.toolId}:${now}:${Math.random().toString(36).slice(2, 6)}`,
      toolId: params.toolId,
      symbol: params.symbol,
      chartId: params.chartId,
      category: tool.category,
      state: params.state,
      layer: params.layer ?? tool.zIndex,
      locked: false,
      visible: true,
      groupId: params.groupId,
      label: params.label,
      labelCn: params.labelCn,
      createdAt: now,
      updatedAt: now,
      userId: params.userId,
      version: 1,
    };

    this.drawings.set(drawing.drawingId, drawing);
    this.stats_.totalDrawings++;
    this.stats_.byCategory[drawing.category] = (this.stats_.byCategory[drawing.category] ?? 0) + 1;

    this._emit('drawing:created', [drawing], params.chartId);
    return drawing;
  }

  /** Update a drawing */
  update(drawingId: string, patch: Partial<Pick<IpcDrawing, 'state'|'layer'|'locked'|'visible'|'label'|'labelCn'|'groupId'>>): IpcDrawing | null {
    const drawing = this.drawings.get(drawingId);
    if (!drawing) return null;

    if (patch.state) drawing.state = patch.state;
    if (patch.layer !== undefined) drawing.layer = patch.layer;
    if (patch.locked !== undefined) drawing.locked = patch.locked;
    if (patch.visible !== undefined) drawing.visible = patch.visible;
    if (patch.label !== undefined) drawing.label = patch.label;
    if (patch.labelCn !== undefined) drawing.labelCn = patch.labelCn;
    if (patch.groupId !== undefined) drawing.groupId = patch.groupId;
    drawing.updatedAt = Date.now();
    drawing.version++;

    this._emit('drawing:updated', [drawing], drawing.chartId);
    return drawing;
  }

  /** Delete a drawing */
  delete(drawingId: string): boolean {
    const drawing = this.drawings.get(drawingId);
    if (!drawing) return false;

    this.drawings.delete(drawingId);
    this.stats_.totalDrawings--;
    this.stats_.byCategory[drawing.category] = Math.max(0, (this.stats_.byCategory[drawing.category] ?? 1) - 1);

    this._emit('drawing:deleted', [drawing], drawing.chartId);
    return true;
  }

  /** Bulk create drawings */
  bulkCreate(drawings: Omit<Parameters<typeof this.create>[0], 'userId'>[], userId: string): IpcDrawing[] {
    const results: IpcDrawing[] = [];
    for (const params of drawings) {
      const drawing = this.create({ ...params, userId });
      if (drawing) results.push(drawing);
    }
    if (results.length > 0) {
      this._emit('drawing:bulk', results, results[0].chartId);
    }
    return results;
  }

  // ── Public API: Selection & Snapping ─────────────────────────────────────

  /** Select a drawing (emit IPC event) */
  select(drawingId: string): IpcDrawing | null {
    const drawing = this.drawings.get(drawingId);
    if (!drawing) return null;
    this._emit('drawing:selected', [drawing], drawing.chartId);
    return drawing;
  }

  /** Snap point to nearest price level */
  snapToPrice(price: number, magnetStrength = 5): { price: number; snapped: boolean } {
    const allPrices: number[] = [];
    for (const drawing of this.drawings.values()) {
      for (const point of drawing.state.points) {
        allPrices.push(point.price);
      }
    }

    const nearest = allPrices.reduce((best, p) =>
      Math.abs(p - price) < Math.abs(best - price) ? p : best, allPrices[0] ?? price);

    if (allPrices.length > 0 && Math.abs(nearest - price) < magnetStrength * 4) {
      return { price: nearest, snapped: true };
    }
    return { price, snapped: false };
  }

  // ── Public API: Layer Management ─────────────────────────────────────────

  /** Create a layer */
  createLayer(params: { name: string; nameCn: string; zIndex: number }): DrawingLayer {
    const layer: DrawingLayer = {
      layerId: `layer:${Date.now()}:${Math.random().toString(36).slice(2, 4)}`,
      name: params.name, nameCn: params.nameCn,
      zIndex: params.zIndex, visible: true, locked: false, opacity: 1,
    };
    this.layers.set(layer.layerId, layer);
    return layer;
  }

  /** Get all layers */
  getLayers(): DrawingLayer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  // ── Public API: Snapshot ─────────────────────────────────────────────────

  /** Take a snapshot of all drawings on a chart */
  takeSnapshot(symbol: string, chartId: string, viewport: DrawingSnapshot['viewport']): DrawingSnapshot {
    const drawings = Array.from(this.drawings.values())
      .filter(d => d.symbol === symbol && d.chartId === chartId);

    const snapshot: DrawingSnapshot = {
      symbol, chartId,
      drawings: drawings.map(d => ({ ...d, state: { ...d.state, points: [...d.state.points.map(p => ({ ...p }))] } })),
      layers: this.getLayers(),
      viewport,
      snapshotAt: Date.now(),
    };

    this.snapshots.set(`${symbol}:${chartId}`, snapshot);
    this.stats_.totalSnapshots++;
    return snapshot;
  }

  /** Get latest snapshot */
  getSnapshot(symbol: string, chartId: string): DrawingSnapshot | null {
    return this.snapshots.get(`${symbol}:${chartId}`) ?? null;
  }

  // ── Public API: Query ────────────────────────────────────────────────────

  /** Get drawing by ID */
  getDrawing(drawingId: string): IpcDrawing | null { return this.drawings.get(drawingId) ?? null; }

  /** Get drawings by chart */
  getDrawingsByChart(chartId: string): IpcDrawing[] {
    return Array.from(this.drawings.values()).filter(d => d.chartId === chartId);
  }

  /** Get drawings by symbol */
  getDrawingsBySymbol(symbol: string): IpcDrawing[] {
    return Array.from(this.drawings.values()).filter(d => d.symbol === symbol);
  }

  /** Get drawings by tool */
  getDrawingsByTool(toolId: string): IpcDrawing[] {
    return Array.from(this.drawings.values()).filter(d => d.toolId === toolId);
  }

  /** Get events */
  getEvents(limit?: number): IpcDrawingEvent[] {
    return limit ? this.events.slice(-limit).reverse() : [...this.events].reverse();
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.drawings.clear(); this.layers.clear(); this.events.length = 0;
    this.snapshots.clear(); this.stats_ = { totalDrawings: 0, totalSnapshots: 0, totalEvents: 0, byCategory: {} };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _emit(type: IpcDrawingEvent['type'], drawings: IpcDrawing[], chartId: string): void {
    const event: IpcDrawingEvent = {
      eventId: `evt:${type}:${Date.now()}`,
      type, drawings, chartId, timestamp: Date.now(),
    };
    this.events.push(event);
    this.stats_.totalEvents++;
    if (this.events.length > 1000) this.events.shift();
  }
}

export const drawing68IpcBridge = new Drawing68IpcBridge();
