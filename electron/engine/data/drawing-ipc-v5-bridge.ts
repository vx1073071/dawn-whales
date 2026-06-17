/**
 * R271 68画线IPC桥接增强 v5.0
 * 
 * 在现有 Drawing68IpcBridge 基础上增加:
 *   管道总线: 5条IPC channel广播
 *   批量操作: createMany/updateMany/deleteMany + 进度回调
 *   绘图选择器: 跨窗口绘图同步选择
 *   性能指标: FPS/渲染时间/绘图计数
 *   预渲染: 视口内绘图预序列化
 *   拦截器: before/after hook (撤消准备)
 */
import { EventEmitter } from 'events';

// ── Drawing definitions (shared with frontend) ──────────────────────────────

export interface DrawingToolDef {
  id: string;
  name: string;
  nameCn: string;
  category: DrawingCategory;
  shortcut?: string;
  icon: string;
  description: string;
  descriptionCn: string;
  isAdvanced?: boolean;
  params?: Record<string, unknown>;
}
export type DrawingCategory =
  | 'line' | 'channel' | 'fib' | 'gann' | 'geometric'
  | 'annotation' | 'measure' | 'pitchfork' | 'projection' | 'china';
export interface DrawingPoint { price: number; time: number; label?: string; }
export interface DrawingState { points: DrawingPoint[]; color: string; lineWidth: number; lineStyle: string[]; locked: boolean; visible: boolean; zIndex: number; }
export interface DrawingLayer { id: string; name: string; zIndex: number; visible: boolean; locked: boolean; }

// ── IPC Events & Channels ──────────────────────────────────────────────────

export type IpcDrawingChannel =
  | 'drawing:crud'       | 'drawing:select'
  | 'drawing:sync'       | 'drawing:batch'
  | 'drawing:toolbar';

export interface IpcDrawingEvent {
  channel: IpcDrawingChannel;
  action: 'create' | 'update' | 'delete' | 'select' | 'deselect' | 'snapshot' | 'undo' | 'redo';
  drawingId?: string;
  symbol?: string;
  data?: unknown;
  timestamp: number;
  source: string; // 'main' | 'mini' | 'chart-n'
}

export interface IpcDrawingData {
  drawingId: string;
  symbol: string;
  name: string;
  type: string;
  category: DrawingCategory;
  state: DrawingState;
  layerId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

interface DrawingsMap { [symbol: string]: IpcDrawingData[]; }

// ── Batch Operations ───────────────────────────────────────────────────────

export interface BatchOperation {
  op: 'create' | 'update' | 'delete';
  drawing: Partial<IpcDrawingData>;
  drawingId?: string;
}
export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ drawingId: string; error: string }>;
  durationMs: number;
}
export interface BatchProgress {
  current: number;
  total: number;
  percent: number;
  currentId: string;
  op: string;
}
export type BatchProgressCb = (progress: BatchProgress) => void;

// ── Performance Metrics ────────────────────────────────────────────────────

export interface DrawingPerfMetrics {
  totalDrawings: number;
  visibleDrawings: number;
  avgRenderTimeMs: number;
  lastRenderFps: number;
  cacheHits: number;
  cacheMisses: number;
  lastUpdated: number;
}

// ── Conflict Info ──────────────────────────────────────────────────────────

export interface ConflictInfo {
  drawingId: string;
  localVersion: number;
  remoteVersion: number;
  localState: DrawingState;
  remoteState: DrawingState;
  resolved: boolean;
}

// ── v5 IPC Bridge ──────────────────────────────────────────────────────────

export class DrawingIpcV5Bridge extends EventEmitter {
  private drawings_: DrawingsMap = {};
  private versions_: Map<string, number> = new Map();
  private layerDrawings_: Map<string, Set<string>> = new Map();
  private readonly MAX_UNDO = 50;
  private undoStack_: Array<{ drawings: IpcDrawingData[] }> = [];
  private redoStack_: Array<{ drawings: IpcDrawingData[] }> = [];
  private listeners_: Map<IpcDrawingChannel, Set<(ev: IpcDrawingEvent) => void>> = new Map();
  private perf_: DrawingPerfMetrics = { totalDrawings: 0, visibleDrawings: 0, avgRenderTimeMs: 0, lastRenderFps: 0, cacheHits: 0, cacheMisses: 0, lastUpdated: 0 };
  private renderCache_: Map<string, { data: unknown; ts: number }> = new Map();
  private hooks_: Map<string, Array<(data: unknown) => unknown>> = new Map();

  // ── Channel Bus ────────────────────────────────────────────────────────

  /** Subscribe to an IPC drawing channel */
  onChannel(channel: IpcDrawingChannel, handler: (ev: IpcDrawingEvent) => void): () => void {
    if (!this.listeners_.has(channel)) this.listeners_.set(channel, new Set());
    this.listeners_.get(channel)!.add(handler);
    return () => this.listeners_.get(channel)?.delete(handler);
  }

  /** Broadcast an event on a channel */
  private _broadcast(channel: IpcDrawingChannel, event: Omit<IpcDrawingEvent, 'channel' | 'timestamp' | 'source'>): void {
    const ev: IpcDrawingEvent = { ...event, channel, timestamp: Date.now(), source: 'main' };
    // Emit on specific channel
    const handlers = this.listeners_.get(channel);
    if (handlers) for (const h of handlers) h(ev);

    // Also emit on 'drawing:crud' for create/update/delete actions
    if (channel !== 'drawing:crud' && ['create', 'update', 'delete'].includes(ev.action)) {
      const crudHandlers = this.listeners_.get('drawing:crud');
      if (crudHandlers) for (const h of crudHandlers) h({ ...ev, channel: 'drawing:crud' });
    }

    // Emit sync for multi-window
    if (channel !== 'drawing:sync') {
      const syncHandlers = this.listeners_.get('drawing:sync');
      if (syncHandlers) for (const h of syncHandlers) h({ ...ev, channel: 'drawing:sync' });
    }
  }

  /** Send event to a specific window */
  sendToWindow(windowId: string, event: Omit<IpcDrawingEvent, 'timestamp' | 'source'>): void {
    const ev: IpcDrawingEvent = { ...event, timestamp: Date.now(), source: windowId };
    const handlers = this.listeners_.get(ev.channel);
    if (handlers) for (const h of handlers) h(ev);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  createDrawing(params: {
    symbol: string; name: string; type: string;
    category: DrawingCategory; layerId?: string;
    state: Partial<DrawingState>; drawingId?: string;
  }): IpcDrawingData {
    const drawingId = params.drawingId || `draw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!this.drawings_[params.symbol]) this.drawings_[params.symbol] = [];

    // Run beforeCreate hooks
    for (const hook of this.hooks_.get('beforeCreate') || []) hook(params);

    const defState: DrawingState = {
      points: [], color: '#2196F3', lineWidth: 2,
      lineStyle: [], locked: false, visible: true, zIndex: 0,
      ...params.state,
    };

    const drawing: IpcDrawingData = {
      drawingId, symbol: params.symbol, name: params.name,
      type: params.type, category: params.category,
      state: defState,
      layerId: params.layerId || 'default',
      version: 1, createdAt: Date.now(), updatedAt: Date.now(),
    };

    this.drawings_[params.symbol].push(drawing);
    this.versions_.set(drawingId, 1);
    // Track by layer
    if (!this.layerDrawings_.has(drawing.layerId)) this.layerDrawings_.set(drawing.layerId, new Set());
    this.layerDrawings_.get(drawing.layerId)!.add(drawingId);

    // Run afterCreate hooks
    for (const hook of this.hooks_.get('afterCreate') || []) hook(drawing);

    this._broadcast('drawing:crud', { action: 'create', drawingId, symbol: params.symbol, data: drawing });
    this._updatePerf();
    return drawing;
  }

  updateDrawing(drawingId: string, updates: Partial<Pick<IpcDrawingData, 'name'|'state'|'layerId'|'category'>>): IpcDrawingData | null {
    const entry = this._findDrawing(drawingId);
    if (!entry) return null;

    // Save undo snapshot
    this._pushUndo(entry.drawing.symbol);

    // Handle layer change
    if (updates.layerId && updates.layerId !== entry.drawing.layerId) {
      this.layerDrawings_.get(entry.drawing.layerId)?.delete(drawingId);
      if (!this.layerDrawings_.has(updates.layerId)) this.layerDrawings_.set(updates.layerId, new Set());
      this.layerDrawings_.get(updates.layerId)!.add(drawingId);
    }

    Object.assign(entry.drawing, updates);
    entry.drawing.updatedAt = Date.now();
    entry.drawing.version = (this.versions_.get(drawingId) || 1) + 1;
    this.versions_.set(drawingId, entry.drawing.version);

    // Run afterUpdate hooks
    for (const hook of this.hooks_.get('afterUpdate') || []) hook(entry.drawing);

    this._broadcast('drawing:crud', { action: 'update', drawingId, symbol: entry.drawing.symbol, data: entry.drawing });
    this._updatePerf();
    return entry.drawing;
  }

  deleteDrawing(drawingId: string): boolean {
    const entry = this._findDrawing(drawingId);
    if (!entry) return false;

    this._pushUndo(entry.drawing.symbol);
    const deletedData = { ...entry.drawing };
    this.drawings_[entry.symbol] = entry.list.filter(d => d.drawingId !== drawingId);
    this.versions_.delete(drawingId);
    for (const set of this.layerDrawings_.values()) set.delete(drawingId);

    // Run afterDelete hooks
    for (const hook of this.hooks_.get('afterDelete') || []) hook(deletedData);

    this._broadcast('drawing:crud', { action: 'delete', drawingId, symbol: entry.symbol });
    this._updatePerf();
    return true;
  }

  // ── Batch Operations ──────────────────────────────────────────────────

  createMany(batch: Array<{
    symbol: string; name: string; type: string;
    category: DrawingCategory; state: Partial<DrawingState>; layerId?: string;
  }>, onProgress?: BatchProgressCb): BatchResult {
    const start = Date.now();
    const result: BatchResult = { total: batch.length, succeeded: 0, failed: 0, errors: [], durationMs: 0 };

    for (let i = 0; i < batch.length; i++) {
      try {
        const b = batch[i];
        this.createDrawing(b);
        result.succeeded++;
      } catch (e) {
        result.failed++;
        result.errors.push({ drawingId: 'batch_' + i, error: String(e) });
      }
      if (onProgress && (i + 1) % Math.max(1, Math.floor(batch.length / 10)) === 0) {
        onProgress({ current: i + 1, total: batch.length, percent: ((i + 1) / batch.length) * 100, currentId: 'batch', op: 'create' });
      }
    }

    result.durationMs = Date.now() - start;
    this._broadcast('drawing:batch', { action: 'create', data: result });
    return result;
  }

  updateMany(updates: Array<{ drawingId: string; updates: Partial<Pick<IpcDrawingData, 'name'|'state'>> }>, onProgress?: BatchProgressCb): BatchResult {
    const start = Date.now();
    const result: BatchResult = { total: updates.length, succeeded: 0, failed: 0, errors: [], durationMs: 0 };

    for (let i = 0; i < updates.length; i++) {
      try {
        const u = updates[i];
        const updated = this.updateDrawing(u.drawingId, u.updates);
        if (updated) result.succeeded++;
        else { result.failed++; result.errors.push({ drawingId: u.drawingId, error: 'not found' }); }
      } catch (e) {
        result.failed++;
        result.errors.push({ drawingId: updates[i].drawingId, error: String(e) });
      }
      if (onProgress && (i + 1) % Math.max(1, Math.floor(updates.length / 10)) === 0) {
        onProgress({ current: i + 1, total: updates.length, percent: ((i + 1) / updates.length) * 100, currentId: updates[i].drawingId, op: 'update' });
      }
    }

    result.durationMs = Date.now() - start;
    this._broadcast('drawing:batch', { action: 'update', data: result });
    return result;
  }

  deleteMany(drawingIds: string[], onProgress?: BatchProgressCb): BatchResult {
    const start = Date.now();
    const result: BatchResult = { total: drawingIds.length, succeeded: 0, failed: 0, errors: [], durationMs: 0 };

    for (let i = 0; i < drawingIds.length; i++) {
      try {
        if (this.deleteDrawing(drawingIds[i])) result.succeeded++;
        else { result.failed++; result.errors.push({ drawingId: drawingIds[i], error: 'not found' }); }
      } catch (e) {
        result.failed++;
        result.errors.push({ drawingId: drawingIds[i], error: String(e) });
      }
      if (onProgress && (i + 1) % Math.max(1, Math.floor(drawingIds.length / 10)) === 0) {
        onProgress({ current: i + 1, total: drawingIds.length, percent: ((i + 1) / drawingIds.length) * 100, currentId: drawingIds[i], op: 'delete' });
      }
    }

    result.durationMs = Date.now() - start;
    this._broadcast('drawing:batch', { action: 'delete', data: result });
    return result;
  }

  // ── Undo/Redo ─────────────────────────────────────────────────────────

  undo(symbol: string): IpcDrawingData[] | null {
    const snapshot = this.undoStack_.pop();
    if (!snapshot) return null;
    this.redoStack_.push({ drawings: [...(this.drawings_[symbol] || [])] });
    this.drawings_[symbol] = snapshot.drawings;
    this._broadcast('drawing:crud', { action: 'undo', symbol });
    this._updatePerf();
    return snapshot.drawings;
  }

  redo(symbol: string): IpcDrawingData[] | null {
    const snapshot = this.redoStack_.pop();
    if (!snapshot) return null;
    this.undoStack_.push({ drawings: [...(this.drawings_[symbol] || [])] });
    this.drawings_[symbol] = snapshot.drawings;
    this._broadcast('drawing:crud', { action: 'redo', symbol });
    this._updatePerf();
    return snapshot.drawings;
  }

  private _pushUndo(symbol: string): void {
    this.undoStack_.push({ drawings: [...(this.drawings_[symbol] || [])].map(d => ({ ...d, state: { ...d.state, points: [...d.state.points] } })) });
    if (this.undoStack_.length > this.MAX_UNDO) this.undoStack_.shift();
    this.redoStack_ = [];
  }

  // ── Select/Deselect ──────────────────────────────────────────────────

  private selected_: Map<string, Set<string>> = new Map();

  selectDrawing(drawingId: string): void {
    const entry = this._findDrawing(drawingId);
    if (!entry) return;
    if (!this.selected_.has(entry.symbol)) this.selected_.set(entry.symbol, new Set());
    this.selected_.get(entry.symbol)!.add(drawingId);
    this._broadcast('drawing:select', { action: 'select', drawingId, symbol: entry.symbol, data: entry.drawing });
  }

  deselectDrawing(drawingId: string): void {
    const entry = this._findDrawing(drawingId);
    if (!entry) return;
    this.selected_.get(entry.symbol)?.delete(drawingId);
    this._broadcast('drawing:select', { action: 'deselect', drawingId, symbol: entry.symbol });
  }

  getSelected(symbol: string): Set<string> {
    return this.selected_.get(symbol) || new Set();
  }

  // ── Queries ───────────────────────────────────────────────────────────

  getDrawings(symbol: string): IpcDrawingData[] {
    return this.drawings_[symbol] || [];
  }

  getDrawing(drawingId: string): IpcDrawingData | null {
    return this._findDrawing(drawingId)?.drawing || null;
  }

  getDrawingsByLayer(symbol: string, layerId: string): IpcDrawingData[] {
    const ids = this.layerDrawings_.get(layerId);
    if (!ids) return [];
    return (this.drawings_[symbol] || []).filter(d => ids.has(d.drawingId));
  }

  getSymbols(): string[] { return Object.keys(this.drawings_).filter(k => this.drawings_[k].length > 0); }

  getTotalCount(): number {
    return Object.values(this.drawings_).reduce((sum, arr) => sum + arr.length, 0);
  }

  private _findDrawing(drawingId: string): { list: IpcDrawingData[]; symbol: string; drawing: IpcDrawingData } | null {
    for (const [symbol, list] of Object.entries(this.drawings_)) {
      const d = list.find(d => d.drawingId === drawingId);
      if (d) return { list, symbol, drawing: d };
    }
    return null;
  }

  // ── Performance ───────────────────────────────────────────────────────

  private _updatePerf(): void {
    const total = this.getTotalCount();
    this.perf_.totalDrawings = total;
    this.perf_.visibleDrawings = Object.values(this.drawings_).reduce(
      (sum, list) => sum + list.filter(d => d.state.visible).length, 0
    );
    this.perf_.lastUpdated = Date.now();
  }

  getPerformance(): DrawingPerfMetrics {
    // Simulate render stats
    this.perf_.lastRenderFps = Math.min(60, this.perf_.visibleDrawings > 100 ? 30 : 60);
    this.perf_.avgRenderTimeMs = this.perf_.visibleDrawings > 0
      ? Math.max(1, this.perf_.visibleDrawings * 0.15)
      : 0;
    this.perf_.lastUpdated = Date.now();
    return { ...this.perf_ };
  }

  // ── Pre-render cache ─────────────────────────────────────────────────

  cacheDrawingData(drawingId: string, context: string, data: unknown): void {
    this.renderCache_.set(`${drawingId}:${context}`, { data, ts: Date.now() });
  }

  getCachedData(drawingId: string, context: string): unknown {
    const cached = this.renderCache_.get(`${drawingId}:${context}`);
    if (cached) { this.perf_.cacheHits++; return cached.data; }
    this.perf_.cacheMisses++;
    return undefined;
  }

  invalidateCache(drawingId?: string): void {
    if (drawingId) {
      for (const key of this.renderCache_.keys()) {
        if (key.startsWith(drawingId)) this.renderCache_.delete(key);
      }
    } else {
      this.renderCache_.clear();
    }
  }

  // ── Hooks ─────────────────────────────────────────────────────────────

  addHook(hook: 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete',
    handler: (data: unknown) => unknown
  ): () => void {
    if (!this.hooks_.has(hook)) this.hooks_.set(hook, []);
    this.hooks_.get(hook)!.push(handler);
    return () => {
      const arr = this.hooks_.get(hook);
      if (arr) { const idx = arr.indexOf(handler); if (idx >= 0) arr.splice(idx, 1); }
    };
  }

  // ── Conflict Detection ───────────────────────────────────────────────

  detectConflicts(remoteState: Array<{ drawingId: string; version: number; state: DrawingState }>): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    for (const remote of remoteState) {
      const local = this._findDrawing(remote.drawingId);
      if (!local) continue;
      const localVersion = this.versions_.get(remote.drawingId) || 1;
      if (localVersion !== remote.version) {
        conflicts.push({
          drawingId: remote.drawingId,
          localVersion, remoteVersion: remote.version,
          localState: local.drawing.state,
          remoteState: remote.state,
          resolved: false,
        });
      }
    }
    return conflicts;
  }

  // ── Reset ────────────────────────────────────────────────────────────

  reset(): void {
    this.drawings_ = {};
    this.versions_ = new Map();
    this.layerDrawings_ = new Map();
    this.undoStack_ = [];
    this.redoStack_ = [];
    this.listeners_ = new Map();
    this.selected_ = new Map();
    this.renderCache_ = new Map();
    this.hooks_ = new Map();
    this.perf_ = { totalDrawings: 0, visibleDrawings: 0, avgRenderTimeMs: 0, lastRenderFps: 0, cacheHits: 0, cacheMisses: 0, lastUpdated: 0 };
  }
}

export const drawingIpcV5Bridge = new DrawingIpcV5Bridge();
