/**
 * R284 auto#2: Skeleton Preload Bridge — 骨架屏预加载桥接
 * 
 * 管理图表UI加载状态, 实现分层预加载优先级与骨架屏渲染协议。
 * 用户在数据加载期间看到骨架屏而非空白/闪烁。
 * 
 * 功能:
 *   1. 分层预加载: critical → primary → secondary → tertiary
 *   2. 加载进度追踪 (per-symbol)
 *   3. 骨架屏配置生成 (根据图表组件类型)
 *   4. 预加载状态机: idle → loading → ready | error
 *   5. 超时与降级处理
 *   6. 批量预加载管理
 * 
 * 下游: ML UI (骨架屏渲染), 图表入口组件
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type PreloadPhase =
  | 'critical'    // 必须: symbol/title/容器框架
  | 'primary'     // 主要: K线数据/成交量
  | 'secondary'   // 次要: 指标计算/画线数据
  | 'tertiary';   // 补充: AI分析/新闻标注/社区数据

export type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'timeout' | 'stale';

export interface PreloadSlot {
  slotId: string;
  phase: PreloadPhase;
  label: string;
  labelCn: string;
  weight: number;            // 0-100 (contribution to overall progress)
  state: LoadState;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  retryCount: number;
}

export interface PreloadSession {
  sessionId: string;
  symbol: string;
  market: string;
  chartType: 'kline' | 'footprint' | 'comparison' | 'multi_chart' | 'indicator' | 'drawing';
  
  // Preload plan
  slots: PreloadSlot[];
  totalWeight: number;
  
  // Progress
  progress: number;          // 0-100
  currentPhase: PreloadPhase | 'complete';
  phaseProgress: Record<PreloadPhase, number>;
  
  // Timing
  createdAt: number;
  estimatedTotalMs: number;
  elapsedMs: number;
  remainingMs: number;
  
  // State
  state: LoadState;
  errorMessage?: string;
  
  // Metadata
  dataSource?: string;
  timeframe?: string;
  priority: number;           // 0=lowest, 100=highest
}

export interface SkeletonConfig {
  type: 'kline' | 'footprint' | 'comparison' | 'multi_chart' | 'indicator' | 'drawing';
  
  // Layout dimensions
  width?: number;
  height?: number;
  
  // Skeleton elements to render
  elements: SkeletonElement[];
  
  // Animation config
  animation: 'pulse' | 'wave' | 'none';
  animationSpeed: 'slow' | 'normal' | 'fast';
  
  // Colors (dark/light)
  baseColor: string;
  highlightColor: string;
}

export interface SkeletonElement {
  elementId: string;
  type: 'rect' | 'circle' | 'line' | 'text' | 'candle_area' | 'volume_area';
  
  // Position (% of container)
  x: number;      // 0-100
  y: number;
  width: number;  // 0-100
  height: number; // 0-100
  
  // Visual
  borderRadius?: number;
  opacity?: number;
  
  // Phase binding (hide when slot loads)
  bindSlot?: string;
}

export interface PreloadStats {
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  totalSlots: number;
  completedSlots: number;
  averageLoadMs: number;
  slowestSlot: { slotId: string; durationMs: number; label: string } | null;
  fastestSlot: { slotId: string; durationMs: number; label: string } | null;
}

// ── Default skeleton configs ───────────────────────────────────────────────

const DARK_BASE = '#1c2333';
const DARK_HIGHLIGHT = '#30363d';

function makeKlineSkeleton(width = 800, height = 500): SkeletonConfig {
  return {
    type: 'kline',
    width, height,
    elements: [
      // Title bar
      { elementId: 'title', type: 'rect', x: 0, y: 0, width: 25, height: 4, borderRadius: 4 },
      { elementId: 'price', type: 'rect', x: 27, y: 0, width: 10, height: 4, borderRadius: 4 },
      { elementId: 'change', type: 'rect', x: 39, y: 0, width: 8, height: 4, borderRadius: 4 },
      // Timeframe buttons
      { elementId: 'tf_bar', type: 'rect', x: 60, y: 0.5, width: 30, height: 3, borderRadius: 3 },
      // Main candle area
      { elementId: 'candles', type: 'candle_area', x: 0, y: 8, width: 100, height: 55, bindSlot: 'klines' },
      // Volume area
      { elementId: 'volume', type: 'volume_area', x: 0, y: 66, width: 100, height: 16, bindSlot: 'volume' },
      // MACD sub-pane (if applicable)
      { elementId: 'macd_pane', type: 'rect', x: 0, y: 84, width: 100, height: 12, borderRadius: 2, opacity: 0.3, bindSlot: 'indicators' },
      // Legend
      { elementId: 'legend', type: 'rect', x: 0, y: 97, width: 50, height: 2, borderRadius: 2, opacity: 0.2 },
    ],
    animation: 'pulse',
    animationSpeed: 'normal',
    baseColor: DARK_BASE,
    highlightColor: DARK_HIGHLIGHT,
  };
}

function makeFootprintSkeleton(width = 400, height = 500): SkeletonConfig {
  return {
    type: 'footprint',
    width, height,
    elements: [
      { elementId: 'header', type: 'rect', x: 0, y: 0, width: 100, height: 5, borderRadius: 3 },
      { elementId: 'bid_bar', type: 'rect', x: 0, y: 6, width: 35, height: 80, borderRadius: 2, opacity: 0.3 },
      { elementId: 'price_col', type: 'rect', x: 36, y: 6, width: 10, height: 80, borderRadius: 2, opacity: 0.2 },
      { elementId: 'ask_bar', type: 'rect', x: 47, y: 6, width: 35, height: 80, borderRadius: 2, opacity: 0.3 },
      { elementId: 'delta_bar', type: 'rect', x: 83, y: 6, width: 17, height: 80, borderRadius: 2, opacity: 0.2 },
    ],
    animation: 'pulse',
    animationSpeed: 'normal',
    baseColor: DARK_BASE,
    highlightColor: DARK_HIGHLIGHT,
  };
}

function makeMultiChartSkeleton(width = 1200, height = 600): SkeletonConfig {
  return {
    type: 'multi_chart',
    width, height,
    elements: [
      // 2x2 grid of chart placeholders
      { elementId: 'chart_1', type: 'candle_area', x: 0, y: 0, width: 49, height: 48, bindSlot: 'chart_1' },
      { elementId: 'chart_2', type: 'candle_area', x: 51, y: 0, width: 49, height: 48, bindSlot: 'chart_2' },
      { elementId: 'chart_3', type: 'candle_area', x: 0, y: 50, width: 49, height: 48, bindSlot: 'chart_3' },
      { elementId: 'chart_4', type: 'candle_area', x: 51, y: 50, width: 49, height: 48, bindSlot: 'chart_4' },
    ],
    animation: 'wave',
    animationSpeed: 'slow',
    baseColor: DARK_BASE,
    highlightColor: DARK_HIGHLIGHT,
  };
}

// ── Preload slot factory ───────────────────────────────────────────────────

function createKlineSlots(): PreloadSlot[] {
  const now = Date.now();
  return [
    { slotId: 'symbol_meta', phase: 'critical', label: 'Symbol Metadata', labelCn: '标的信息', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'chart_container', phase: 'critical', label: 'Chart Container', labelCn: '图表容器', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'klines', phase: 'primary', label: 'K-line Data', labelCn: 'K线数据', weight: 30, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'volume', phase: 'primary', label: 'Volume Data', labelCn: '成交量', weight: 10, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'indicators', phase: 'secondary', label: 'Indicator Calculation', labelCn: '指标计算', weight: 20, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'drawings', phase: 'secondary', label: 'Drawing Overlay', labelCn: '画线叠加', weight: 10, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'crosshair', phase: 'secondary', label: 'Crosshair Setup', labelCn: '十字光标', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'ai_analysis', phase: 'tertiary', label: 'AI Analysis', labelCn: 'AI分析', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'news_overlay', phase: 'tertiary', label: 'News Annotations', labelCn: '新闻标注', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'community_data', phase: 'tertiary', label: 'Community Data', labelCn: '社区数据', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
  ];
}

function createFootprintSlots(): PreloadSlot[] {
  const now = Date.now();
  return [
    { slotId: 'symbol_meta', phase: 'critical', label: 'Symbol Metadata', labelCn: '标的信息', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'container', phase: 'critical', label: 'Container', labelCn: '容器', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'tick_data', phase: 'primary', label: 'Tick Data', labelCn: '逐笔数据', weight: 40, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'footprint_calc', phase: 'primary', label: 'Footprint Calculation', labelCn: '足迹图计算', weight: 30, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'poc_va', phase: 'secondary', label: 'POC / Value Area', labelCn: 'POC/价值区', weight: 15, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'delta_hist', phase: 'secondary', label: 'Delta History', labelCn: 'Delta历史', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
  ];
}

function createComparisonSlots(): PreloadSlot[] {
  return [
    { slotId: 'meta', phase: 'critical', label: 'Meta', labelCn: '元信息', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'containers', phase: 'critical', label: 'Containers', labelCn: '容器', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'data_a', phase: 'primary', label: 'Data A', labelCn: '数据A', weight: 20, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'data_b', phase: 'primary', label: 'Data B', labelCn: '数据B', weight: 20, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'overlay', phase: 'secondary', label: 'Overlay Compute', labelCn: '叠加计算', weight: 30, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'indicators', phase: 'secondary', label: 'Indicators', labelCn: '指标', weight: 15, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'correlation', phase: 'tertiary', label: 'Correlation', labelCn: '相关性', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 },
  ];
}

function createMultiChartSlots(): PreloadSlot[] {
  const slots: PreloadSlot[] = [
    { slotId: 'meta', phase: 'critical', label: 'Meta', labelCn: '元信息', weight: 3, state: 'idle', startedAt: 0, retryCount: 0 },
    { slotId: 'layout', phase: 'critical', label: 'Layout', labelCn: '布局', weight: 2, state: 'idle', startedAt: 0, retryCount: 0 },
  ];
  for (let i = 1; i <= 4; i++) {
    slots.push({ slotId: `chart_${i}_data`, phase: 'primary', label: `Chart ${i} Data`, labelCn: `图表${i}数据`, weight: 15, state: 'idle', startedAt: 0, retryCount: 0 });
    slots.push({ slotId: `chart_${i}_indicators`, phase: 'secondary', label: `Chart ${i} Indicators`, labelCn: `图表${i}指标`, weight: 5, state: 'idle', startedAt: 0, retryCount: 0 });
  }
  slots.push({ slotId: 'cross_sync', phase: 'tertiary', label: 'Cross-chart Sync', labelCn: '跨图同步', weight: 5, state: 'idle', startedAt: 0, retryCount: 0 });
  return slots;
}

// ═══════════════════════════════════════════════════════════════════════════
// SkeletonPreloadBridge
// ═══════════════════════════════════════════════════════════════════════════

export class SkeletonPreloadBridge {
  private sessions: Map<string, PreloadSession> = new Map();
  private skeletonCache: Map<string, SkeletonConfig> = new Map();
  private stats_ = {
    totalSessions: 0,
    activeSessions: 0,
    completedSessions: 0,
    failedSessions: 0,
    averageLoadMs: 0,
  };
  
  // Config
  private defaultTimeoutMs = 30000;       // 30s max for a session
  private slotTimeoutMs = 15000;          // 15s per slot
  private maxRetries = 3;
  private staleTimeoutMs = 60000;         // 60s before session marked stale

  /** Create a new preload session for a chart */
  createSession(
    symbol: string,
    market: string,
    chartType: PreloadSession['chartType'],
    options?: { priority?: number; estimatedTotalMs?: number; timeframe?: string; dataSource?: string }
  ): PreloadSession {
    const sessionId = `preload_${createHash('md5').update(`${symbol}_${chartType}_${Date.now()}`).digest('hex').slice(0, 10)}`;

    let slots: PreloadSlot[];
    switch (chartType) {
      case 'kline': slots = createKlineSlots(); break;
      case 'footprint': slots = createFootprintSlots(); break;
      case 'comparison': slots = createComparisonSlots(); break;
      case 'multi_chart': slots = createMultiChartSlots(); break;
      default: slots = createKlineSlots(); break;
    }

    const totalWeight = slots.reduce((s, sl) => s + sl.weight, 0);

    const session: PreloadSession = {
      sessionId,
      symbol,
      market,
      chartType,
      slots,
      totalWeight,
      progress: 0,
      currentPhase: 'critical',
      phaseProgress: { critical: 0, primary: 0, secondary: 0, tertiary: 0 },
      createdAt: Date.now(),
      estimatedTotalMs: options?.estimatedTotalMs || 5000,
      elapsedMs: 0,
      remainingMs: options?.estimatedTotalMs || 5000,
      state: 'idle',
      priority: options?.priority || 50,
      dataSource: options?.dataSource,
      timeframe: options?.timeframe,
    };

    this.sessions.set(sessionId, session);
    this.stats_.totalSessions++;
    this.stats_.activeSessions++;

    return session;
  }

  /** Start loading a session */
  startSession(sessionId: string): PreloadSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.state = 'loading';
    session.currentPhase = 'critical';

    // Mark critical slots as started
    for (const slot of session.slots) {
      if (slot.phase === 'critical') {
        slot.state = 'loading';
        slot.startedAt = Date.now();
      }
    }

    return session;
  }

  /** Report a slot as loaded */
  slotLoaded(sessionId: string, slotId: string, durationMs?: number): PreloadSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const slot = session.slots.find(s => s.slotId === slotId);
    if (!slot) return null;

    const now = Date.now();
    slot.state = 'ready';
    slot.completedAt = now;
    slot.durationMs = durationMs || (now - slot.startedAt);

    // Advance phase if all slots in current phase are done
    this._advancePhase(session);
    this._recalculateProgress(session);

    return session;
  }

  /** Report a slot as failed (with retry) */
  slotFailed(sessionId: string, slotId: string, error: string): PreloadSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const slot = session.slots.find(s => s.slotId === slotId);
    if (!slot) return null;

    slot.retryCount++;
    if (slot.retryCount < this.maxRetries) {
      slot.state = 'loading';
      slot.startedAt = Date.now();
      slot.error = error;
    } else {
      slot.state = 'error';
      slot.error = error;
      
      // If a primary slot fails, mark session as error
      if (slot.phase === 'primary' || slot.phase === 'critical') {
        session.state = 'error';
        session.errorMessage = `Failed to load ${slot.labelCn}: ${error}`;
        this.stats_.activeSessions--;
        this.stats_.failedSessions++;
      }
    }

    return session;
  }

  /** Mark session as fully ready */
  sessionReady(sessionId: string): PreloadSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.state = 'ready';
    session.progress = 100;
    session.currentPhase = 'complete';
    session.elapsedMs = Date.now() - session.createdAt;
    session.remainingMs = 0;

    this.stats_.activeSessions--;
    this.stats_.completedSessions++;

    // Update average
    const totalMs = this.stats_.averageLoadMs * (this.stats_.completedSessions - 1) + session.elapsedMs;
    this.stats_.averageLoadMs = Math.round(totalMs / this.stats_.completedSessions);

    return session;
  }

  /** Check for timeout */
  checkTimeout(sessionId: string): PreloadSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const elapsed = Date.now() - session.createdAt;
    session.elapsedMs = elapsed;
    session.remainingMs = Math.max(0, session.estimatedTotalMs - elapsed);

    if (elapsed > this.defaultTimeoutMs && session.state === 'loading') {
      session.state = 'timeout';
      session.errorMessage = `Preload timed out after ${elapsed}ms`;
      this.stats_.activeSessions--;
      this.stats_.failedSessions++;
    }

    return session;
  }

  /** Get a session by ID */
  getSession(sessionId: string): PreloadSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /** Get session for a symbol (returns most recent) */
  getSessionForSymbol(symbol: string): PreloadSession | null {
    const matches = [...this.sessions.values()]
      .filter(s => s.symbol === symbol)
      .sort((a, b) => b.createdAt - a.createdAt);
    return matches[0] || null;
  }

  /** Get skeleton config for a chart type */
  getSkeletonConfig(
    chartType: SkeletonConfig['type'],
    options?: { width?: number; height?: number }
  ): SkeletonConfig {
    const cacheKey = `${chartType}_${options?.width || ''}_${options?.height || ''}`;
    if (this.skeletonCache.has(cacheKey)) {
      return this.skeletonCache.get(cacheKey)!;
    }

    let config: SkeletonConfig;
    switch (chartType) {
      case 'kline': config = makeKlineSkeleton(options?.width, options?.height); break;
      case 'footprint': config = makeFootprintSkeleton(options?.width, options?.height); break;
      case 'multi_chart': config = makeMultiChartSkeleton(options?.width, options?.height); break;
      default: config = makeKlineSkeleton(options?.width, options?.height); break;
    }

    this.skeletonCache.set(cacheKey, config);
    return config;
  }

  /** Get which skeleton elements should still show (not yet loaded) */
  getVisibleSkeletonElements(sessionId: string): { elements: SkeletonElement[]; type: string } | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'ready') return null;

    const config = this.getSkeletonConfig(session.chartType);
    const loadedSlotIds = new Set(
      session.slots.filter(s => s.state === 'ready').map(s => s.slotId)
    );

    // Filter out elements bound to loaded slots
    const visibleElements = config.elements.filter(el => {
      if (!el.bindSlot) return true; // unbounded elements always show
      return !loadedSlotIds.has(el.bindSlot);
    });

    return {
      elements: visibleElements,
      type: config.type,
    };
  }

  /** Get preload progress as percentage string for UI */
  getProgressText(sessionId: string): { progress: number; phase: string; phaseCn: string; state: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { progress: 0, phase: 'idle', phaseCn: '空闲', state: 'idle' };

    const phaseLabels: Record<string, string> = {
      critical: '加载框架', primary: '加载数据', secondary: '计算指标', tertiary: '加载增强', complete: '完成',
    };

    return {
      progress: session.progress,
      phase: session.currentPhase,
      phaseCn: phaseLabels[session.currentPhase] || session.currentPhase,
      state: session.state,
    };
  }

  /** Generate preload priority recommendations */
  recommendPriorities(chartType: PreloadSession['chartType']): { slotId: string; phase: PreloadPhase; estimatedMs: number }[] {
    switch (chartType) {
      case 'kline':
        return [
          { slotId: 'symbol_meta', phase: 'critical', estimatedMs: 50 },
          { slotId: 'chart_container', phase: 'critical', estimatedMs: 30 },
          { slotId: 'klines', phase: 'primary', estimatedMs: 800 },
          { slotId: 'volume', phase: 'primary', estimatedMs: 200 },
          { slotId: 'indicators', phase: 'secondary', estimatedMs: 300 },
          { slotId: 'drawings', phase: 'secondary', estimatedMs: 100 },
          { slotId: 'crosshair', phase: 'secondary', estimatedMs: 30 },
          { slotId: 'ai_analysis', phase: 'tertiary', estimatedMs: 2000 },
          { slotId: 'news_overlay', phase: 'tertiary', estimatedMs: 500 },
          { slotId: 'community_data', phase: 'tertiary', estimatedMs: 300 },
        ];
      case 'footprint':
        return [
          { slotId: 'symbol_meta', phase: 'critical', estimatedMs: 50 },
          { slotId: 'container', phase: 'critical', estimatedMs: 30 },
          { slotId: 'tick_data', phase: 'primary', estimatedMs: 1200 },
          { slotId: 'footprint_calc', phase: 'primary', estimatedMs: 500 },
          { slotId: 'poc_va', phase: 'secondary', estimatedMs: 100 },
          { slotId: 'delta_hist', phase: 'secondary', estimatedMs: 80 },
        ];
      default:
        return [];
    }
  }

  /** Get statistics */
  getStats(): PreloadStats {
    const allSlots = [...this.sessions.values()].flatMap(s => s.slots);
    const completedSlots = allSlots.filter(s => s.state === 'ready');
    
    let slowest: PreloadStats['slowestSlot'] = null;
    let fastest: PreloadStats['fastestSlot'] = null;
    for (const s of completedSlots) {
      if (!s.durationMs) continue;
      if (!slowest || s.durationMs > slowest.durationMs) {
        slowest = { slotId: s.slotId, durationMs: s.durationMs, label: s.labelCn };
      }
      if (!fastest || s.durationMs < fastest.durationMs) {
        fastest = { slotId: s.slotId, durationMs: s.durationMs, label: s.labelCn };
      }
    }

    return {
      activeSessions: this.stats_.activeSessions,
      completedSessions: this.stats_.completedSessions,
      failedSessions: this.stats_.failedSessions,
      totalSlots: allSlots.length,
      completedSlots: completedSlots.length,
      averageLoadMs: this.stats_.averageLoadMs,
      slowestSlot: slowest,
      fastestSlot: fastest,
    };
  }

  /** Clean up old/stale sessions */
  cleanup(maxAgeMs = 300000): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.state === 'ready' && now - session.createdAt > maxAgeMs) {
        this.sessions.delete(id);
        removed++;
      }
      if (session.state === 'error' || session.state === 'timeout') {
        if (now - session.createdAt > maxAgeMs * 2) {
          this.sessions.delete(id);
          removed++;
        }
      }
    }
    return removed;
  }

  /** Reset bridge */
  reset(): void {
    this.sessions.clear();
    this.skeletonCache.clear();
    this.stats_ = { totalSessions: 0, activeSessions: 0, completedSessions: 0, failedSessions: 0, averageLoadMs: 0 };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _advancePhase(session: PreloadSession): void {
    const phases: PreloadPhase[] = ['critical', 'primary', 'secondary', 'tertiary'];
    for (const phase of phases) {
      const phaseSlots = session.slots.filter(s => s.phase === phase);
      const allReady = phaseSlots.every(s => s.state === 'ready');

      if (allReady) {
        session.phaseProgress[phase] = 100;
        // Start next phase
        const currentIdx = phases.indexOf(phase);
        const nextPhase = phases[currentIdx + 1];
        if (nextPhase) {
          session.currentPhase = nextPhase;
          for (const slot of session.slots.filter(s => s.phase === nextPhase && s.state === 'idle')) {
            slot.state = 'loading';
            slot.startedAt = Date.now();
          }
        } else {
          // All phases complete
          session.currentPhase = 'complete';
        }
      } else {
        // Partial phase progress
        const readyCount = phaseSlots.filter(s => s.state === 'ready').length;
        const loadingCount = phaseSlots.filter(s => s.state === 'loading').length;
        session.phaseProgress[phase] = Math.round((readyCount / Math.max(1, phaseSlots.length)) * 100);
        // Don't start next phase until current one is fully done
        if (session.currentPhase !== phase && session.phaseProgress[phase] < 100) {
          session.currentPhase = phase;
        }
        break;
      }
    }
  }

  private _recalculateProgress(session: PreloadSession): void {
    let weightedProgress = 0;

    for (const slot of session.slots) {
      const slotWeight = slot.weight / session.totalWeight;
      switch (slot.state) {
        case 'ready': weightedProgress += slotWeight * 100; break;
        case 'loading': weightedProgress += slotWeight * 50; break; // 50% credit for loading
        case 'error': weightedProgress += slotWeight * 0; break;
        default: weightedProgress += 0; break;
      }
    }

    session.progress = Math.round(weightedProgress);
    session.elapsedMs = Date.now() - session.createdAt;

    if (session.progress > 0) {
      const projectedTotal = (session.elapsedMs / session.progress) * 100;
      session.remainingMs = Math.max(0, projectedTotal - session.elapsedMs);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════

let _skeletonBridge: SkeletonPreloadBridge | null = null;

export function getSkeletonPreloadBridge(): SkeletonPreloadBridge {
  if (!_skeletonBridge) _skeletonBridge = new SkeletonPreloadBridge();
  return _skeletonBridge;
}

export function resetSkeletonPreloadBridge(): void {
  _skeletonBridge?.reset();
  _skeletonBridge = null;
}
