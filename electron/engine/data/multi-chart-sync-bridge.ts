/**
 * R265: MultiChartSyncBridge — 多图数据同步IPC桥接
 * 
 * 功能:
 *   1. 图表组管理 (创建/销毁/列出)
 *   2. Symbol同步: 修改主图symbol → 所有副图自动切换
 *   3. Timeframe同步: 修改主图周期 → 副图联动或独立
 *   4. Crosshair同步: 十字光标位置在所有图间实时同步
 *   5. 区间框选联动: 拖选时间区间 → 所有副图同步缩放
 *   6. 同步模式切换: linked(全联动)/semi(符号+周期)/custom(自定义)
 *   7. 多图布局数据: 2×2, 3×1, 1×3 等布局下的同步状态
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChartInstance {
  chartId: string;
  groupId: string;
  symbol: string;
  timeframe: string;
  position: { row: number; col: number };  // grid position
  visible: boolean;
  type: 'main' | 'secondary' | 'indicator' | 'volume';
}

export interface ChartGroup {
  groupId: string;
  name: string;
  nameCn: string;
  layout: { rows: number; cols: number };
  charts: ChartInstance[];
  syncMode: SyncMode;
  syncConfig: SyncConfig;
  createdAt: number;
}

export type SyncMode = 'linked' | 'semi' | 'custom';

export interface SyncConfig {
  syncSymbol: boolean;      // symbol changes propagate
  syncTimeframe: boolean;   // timeframe changes propagate
  syncCrosshair: boolean;   // crosshair position sync
  syncRange: boolean;       // time range / zoom sync
  syncIndicators: boolean;  // indicator set sync
  exceptions: string[];     // chartIds exempted from sync
}

export interface SyncEvent {
  eventId: string;
  groupId: string;
  sourceChartId: string;
  type: 'symbol' | 'timeframe' | 'crosshair' | 'range' | 'indicator';
  payload: Record<string, any>;
  timestamp: number;
}

export interface CrosshairPosition {
  chartId: string;
  time: number;       // Unix ms timestamp at crosshair
  price: number;      // price at crosshair
  x: number;          // pixel x
  y: number;          // pixel y
}

export interface LayoutPreset {
  presetId: string;
  name: string;
  nameCn: string;
  rows: number;
  cols: number;
  description: string;
  descriptionCn: string;
}

// ── Layout presets ─────────────────────────────────────────────────────────

const LAYOUT_PRESETS: LayoutPreset[] = [
  { presetId: 'layout_1x1', name: 'Single Chart', nameCn: '单图', rows: 1, cols: 1, description: 'One chart, full focus', descriptionCn: '单图表,全屏专注' },
  { presetId: 'layout_2x1', name: 'Dual Vertical', nameCn: '上下双图', rows: 2, cols: 1, description: 'Main chart + volume/indicator below', descriptionCn: '主图+成交量/指标' },
  { presetId: 'layout_1x2', name: 'Dual Horizontal', nameCn: '左右双图', rows: 1, cols: 2, description: 'Two charts side by side for comparison', descriptionCn: '左右对比两个品种' },
  { presetId: 'layout_3x1', name: 'Triple Vertical', nameCn: '三周期同列', rows: 3, cols: 1, description: '3 timeframes: Direction/Setup/Execution', descriptionCn: '三周期共振: 方向/结构/时机' },
  { presetId: 'layout_2x2', name: 'Quad Grid', nameCn: '四宫格', rows: 2, cols: 2, description: '4 charts: main + sector + index + compare', descriptionCn: '主图+板块+指数+对比' },
  { presetId: 'layout_1x3', name: 'Triple Horizontal', nameCn: '三列横排', rows: 1, cols: 3, description: 'Main + indicators + comparison', descriptionCn: '主图+指标窗+对比' },
];

// ═══════════════════════════════════════════════════════════════════════════
// MultiChartSyncBridge
// ═══════════════════════════════════════════════════════════════════════════

export class MultiChartSyncBridge {
  private groups: Map<string, ChartGroup> = new Map();
  private charts: Map<string, ChartInstance> = new Map();
  private crosshairPositions: Map<string, CrosshairPosition> = new Map();
  private syncEvents: SyncEvent[] = [];
  private stats_ = { totalGroups: 0, totalCharts: 0, syncEventsSent: 0 };

  constructor() {}

  // ── Public API: Group Management ────────────────────────────────────────

  /**
   * Create a chart group with a layout preset.
   */
  createGroup(params: {
    groupId: string;
    name?: string;
    presetId?: string;
    syncMode?: SyncMode;
  }): ChartGroup {
    const preset = LAYOUT_PRESETS.find(p => p.presetId === (params.presetId ?? 'layout_1x1')) ?? LAYOUT_PRESETS[0];

    const group: ChartGroup = {
      groupId: params.groupId,
      name: params.name ?? `Group ${params.groupId}`,
      nameCn: preset.nameCn,
      layout: { rows: preset.rows, cols: preset.cols },
      charts: [],
      syncMode: params.syncMode ?? 'linked',
      syncConfig: {
        syncSymbol: true,
        syncTimeframe: true,
        syncCrosshair: true,
        syncRange: true,
        syncIndicators: false,
        exceptions: [],
      },
      createdAt: Date.now(),
    };

    this.groups.set(group.groupId, group);
    this.stats_.totalGroups++;
    return group;
  }

  /**
   * Add a chart to a group.
   */
  addChart(params: {
    chartId: string;
    groupId: string;
    symbol: string;
    timeframe: string;
    row: number;
    col: number;
    type?: ChartInstance['type'];
  }): ChartInstance | null {
    const group = this.groups.get(params.groupId);
    if (!group) return null;

    // Check position not taken
    const existing = group.charts.find(c => c.position.row === params.row && c.position.col === params.col);
    if (existing) return null;

    const chart: ChartInstance = {
      chartId: params.chartId,
      groupId: params.groupId,
      symbol: params.symbol,
      timeframe: params.timeframe,
      position: { row: params.row, col: params.col },
      visible: true,
      type: params.type ?? (group.charts.length === 0 ? 'main' : 'secondary'),
    };

    group.charts.push(chart);
    this.charts.set(chart.chartId, chart);
    this.stats_.totalCharts++;
    return chart;
  }

  /**
   * Remove a chart from its group.
   */
  removeChart(chartId: string): boolean {
    const chart = this.charts.get(chartId);
    if (!chart) return false;

    const group = this.groups.get(chart.groupId);
    if (group) {
      group.charts = group.charts.filter(c => c.chartId !== chartId);
    }

    this.charts.delete(chartId);
    this.crosshairPositions.delete(chartId);
    return true;
  }

  /**
   * Remove a group and all its charts.
   */
  removeGroup(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    for (const chart of group.charts) {
      this.charts.delete(chart.chartId);
      this.crosshairPositions.delete(chart.chartId);
    }

    this.groups.delete(groupId);
    return true;
  }

  // ── Public API: Sync ────────────────────────────────────────────────────

  /**
   * Broadcast a sync event from one chart → all others in same group.
   * Returns array of target chartIds that should handle the event.
   */
  sync(params: {
    groupId: string;
    sourceChartId: string;
    type: SyncEvent['type'];
    payload: Record<string, any>;
  }): { event: SyncEvent; targets: string[] } {
    const group = this.groups.get(params.groupId);
    if (!group) return { event: {} as SyncEvent, targets: [] };

    const event: SyncEvent = {
      eventId: `sync:${params.groupId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      groupId: params.groupId,
      sourceChartId: params.sourceChartId,
      type: params.type,
      payload: params.payload,
      timestamp: Date.now(),
    };

    this.syncEvents.push(event);
    if (this.syncEvents.length > 200) this.syncEvents.shift();
    this.stats_.syncEventsSent++;

    // Determine targets based on sync config
    const targets: string[] = [];
    const config = group.syncConfig;

    for (const chart of group.charts) {
      if (chart.chartId === params.sourceChartId) continue;
      if (config.exceptions.includes(chart.chartId)) continue;

      let shouldSync = false;
      switch (params.type) {
        case 'symbol': shouldSync = config.syncSymbol; break;
        case 'timeframe': shouldSync = config.syncTimeframe; break;
        case 'crosshair': shouldSync = config.syncCrosshair; break;
        case 'range': shouldSync = config.syncRange; break;
        case 'indicator': shouldSync = config.syncIndicators; break;
      }

      if (shouldSync) targets.push(chart.chartId);
    }

    // Apply symbol/timeframe updates to chart instances
    if (params.type === 'symbol' && config.syncSymbol) {
      for (const chart of group.charts) {
        if (chart.chartId !== params.sourceChartId && !config.exceptions.includes(chart.chartId)) {
          chart.symbol = params.payload.symbol ?? chart.symbol;
        }
      }
    }
    if (params.type === 'timeframe' && config.syncTimeframe) {
      for (const chart of group.charts) {
        if (chart.chartId !== params.sourceChartId && !config.exceptions.includes(chart.chartId)) {
          chart.timeframe = params.payload.timeframe ?? chart.timeframe;
        }
      }
    }

    return { event, targets };
  }

  // ── Public API: Crosshair Sync ──────────────────────────────────────────

  /**
   * Update crosshair position for a chart → broadcast to synced charts.
   */
  updateCrosshair(params: {
    groupId: string;
    chartId: string;
    time: number;
    price: number;
    x: number;
    y: number;
  }): { time: number; price: number; targets: string[] } {
    const position: CrosshairPosition = {
      chartId: params.chartId,
      time: params.time,
      price: params.price,
      x: params.x,
      y: params.y,
    };

    this.crosshairPositions.set(params.chartId, position);

    // Sync to group
    const { targets } = this.sync({
      groupId: params.groupId,
      sourceChartId: params.chartId,
      type: 'crosshair',
      payload: { time: params.time, price: params.price },
    });

    return { time: params.time, price: params.price, targets };
  }

  /**
   * Get crosshair position for a chart.
   */
  getCrosshair(chartId: string): CrosshairPosition | null {
    return this.crosshairPositions.get(chartId) ?? null;
  }

  // ── Public API: Config ──────────────────────────────────────────────────

  /** Set sync mode for a group */
  setSyncMode(groupId: string, mode: SyncMode): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    group.syncMode = mode;
    switch (mode) {
      case 'linked':
        group.syncConfig = { syncSymbol: true, syncTimeframe: true, syncCrosshair: true, syncRange: true, syncIndicators: true, exceptions: [] };
        break;
      case 'semi':
        group.syncConfig = { syncSymbol: true, syncTimeframe: true, syncCrosshair: true, syncRange: false, syncIndicators: false, exceptions: [] };
        break;
      case 'custom':
        // preserve current config, user modifies via setSyncConfig
        break;
    }
  }

  /** Set custom sync config */
  setSyncConfig(groupId: string, config: Partial<SyncConfig>): void {
    const group = this.groups.get(groupId);
    if (!group) return;
    Object.assign(group.syncConfig, config);
    group.syncMode = 'custom';
  }

  /** Add exception (chart not synced) */
  addSyncException(groupId: string, chartId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;
    if (!group.syncConfig.exceptions.includes(chartId)) {
      group.syncConfig.exceptions.push(chartId);
    }
  }

  /** Remove exception */
  removeSyncException(groupId: string, chartId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;
    group.syncConfig.exceptions = group.syncConfig.exceptions.filter(id => id !== chartId);
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get group */
  getGroup(groupId: string): ChartGroup | null { return this.groups.get(groupId) ?? null; }

  /** Get chart */
  getChart(chartId: string): ChartInstance | null { return this.charts.get(chartId) ?? null; }

  /** List all groups */
  getGroups(): ChartGroup[] { return Array.from(this.groups.values()); }

  /** Get charts in a group */
  getChartsInGroup(groupId: string): ChartInstance[] {
    return this.groups.get(groupId)?.charts ?? [];
  }

  /** Get layout presets */
  getLayoutPresets(): LayoutPreset[] { return LAYOUT_PRESETS; }

  /** Get sync events */
  getSyncEvents(limit = 50): SyncEvent[] { return this.syncEvents.slice(-limit).reverse(); }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.groups.clear();
    this.charts.clear();
    this.crosshairPositions.clear();
    this.syncEvents = [];
    this.stats_ = { totalGroups: 0, totalCharts: 0, syncEventsSent: 0 };
  }
}

export const multiChartSyncBridge = new MultiChartSyncBridge();
