// ── R117 QTE-53 PM: 剩余48种画线工具 + R118 QTE-58/59: 回放引擎+监控 ──
// QTE-53: 从P0 20种扩展到TradingView 68种全量
// QTE-58: MarketReplayEngine
// QTE-59: CorrelationMatrix + LiquidityMap
//
// @author PM (WorkBuddy)
// @round R117+R118
// @since 2026-06-12

import type { KlineBar, HeatmapData } from './types';
import type { ToolType, DrawingStyle } from './drawing-types';

// ═══════════════════════════════════════════════════════════════════════
// QTE-53: DRAWING TOOLS P1 — 48 EXTRA TOOLS (from 20→68)
// ═══════════════════════════════════════════════════════════════════════

export interface DrawingToolDefinition {
  type: ToolType;
  name: string;
  shortName: string;
  category: 'trend' | 'channel' | 'fork' | 'fibonacci' | 'gann' | 'prediction' | 'shape' | 'annotation';
  minPoints: number;
  description: string;
}

/** P1扩展: 48个画线工具 (补充JVS P0 20个) */
export const EXTENDED_DRAWING_TOOLS: DrawingToolDefinition[] = [
  // ── 趋势线扩展 (6) ──
  { type: 'arrow', name: '箭头', shortName: '箭头', category: 'trend', minPoints: 2, description: '带箭头趋势线' },
  { type: 'ray', name: '射线', shortName: '射线', category: 'trend', minPoints: 2, description: '单向无限延伸' },
  { type: 'extended-line', name: '延长线', shortName: '延长', category: 'trend', minPoints: 2, description: '双向无限延伸' },
  { type: 'curved-line', name: '曲线', shortName: '曲线', category: 'trend', minPoints: 3, description: '贝塞尔曲线' },
  { type: 'angled-line', name: '角度线', shortName: '角度', category: 'trend', minPoints: 2, description: '固定角度线' },
  { type: 'disjoint-channel', name: '不连续通道', shortName: '断通道', category: 'trend', minPoints: 3, description: '非连续通道' },

  // ── 通道扩展 (3) ──
  { type: 'price-range', name: '价格区间', shortName: '区间', category: 'channel', minPoints: 2, description: '高低价格区间' },
  { type: 'date-range', name: '日期区间', shortName: '日期', category: 'channel', minPoints: 2, description: '时间范围区间' },
  { type: 'pitchfan', name: '扇线', shortName: '扇线', category: 'channel', minPoints: 2, description: '多点扇线' },

  // ── 分叉工具扩展 (3) ──
  { type: 'schiff-pitchfork', name: '希夫分叉', shortName: '希夫', category: 'fork', minPoints: 3, description: '修正安德鲁鱼叉' },
  { type: 'modified-schiff', name: '修正希夫', shortName: '修正', category: 'fork', minPoints: 3, description: '二次修正鱼叉' },
  { type: 'inside-pitchfork', name: '内部鱼叉', shortName: '内鱼叉', category: 'fork', minPoints: 3, description: '内部安德鲁鱼叉' },

  // ── Fibonacci扩展 (8) ──
  { type: 'fib-speed-fan', name: '斐波速度扇', shortName: '速度扇', category: 'fibonacci', minPoints: 2, description: '斐波那契速度线' },
  { type: 'fib-time-zone', name: '斐波时间区', shortName: '时间区', category: 'fibonacci', minPoints: 2, description: '斐波那契时间周期' },
  { type: 'fib-channel', name: '斐波通道', shortName: '斐通道', category: 'fibonacci', minPoints: 2, description: '斐波那契平行通道' },
  { type: 'fib-circles', name: '斐波圆弧', shortName: '斐圆弧', category: 'fibonacci', minPoints: 2, description: '斐波那契圆弧' },
  { type: 'fib-spiral', name: '斐波螺旋', shortName: '斐螺旋', category: 'fibonacci', minPoints: 2, description: '斐波那契螺旋线' },
  { type: 'fib-wedge', name: '斐波楔形', shortName: '斐楔形', category: 'fibonacci', minPoints: 3, description: '斐波那契楔形' },
  { type: 'fib-projection', name: '斐波投影', shortName: '斐投影', category: 'fibonacci', minPoints: 3, description: '斐波那契价格投影' },
  { type: 'fib-expansion-ext', name: '斐波扩展增强', shortName: '斐扩强', category: 'fibonacci', minPoints: 3, description: '扩展斐波那契(168.1%等)' },

  // ── Gann扩展 (3) ──
  { type: 'gann-square', name: '江恩四方', shortName: '四方', category: 'gann', minPoints: 2, description: '江恩四方图' },
  { type: 'gann-box', name: '江恩箱', shortName: '江恩箱', category: 'gann', minPoints: 2, description: '江恩价格时间箱' },
  { type: 'gann-angle', name: '江恩角度', shortName: '角度', category: 'gann', minPoints: 2, description: '江恩角度线(1x1/2x1等)' },

  // ── 预测/测量工具 (7) ──
  { type: 'fixed-range-volume', name: '固定范围成交量', shortName: '固定量', category: 'prediction', minPoints: 2, description: '自定义区间的成交量分布' },
  { type: 'long-position', name: '多头仓位', shortName: '多头', category: 'prediction', minPoints: 2, description: '入场/止损/止盈标注' },
  { type: 'short-position', name: '空头仓位', shortName: '空头', category: 'prediction', minPoints: 2, description: '入场/止损/止盈标注' },
  { type: 'balloon', name: '气泡标注', shortName: '气泡', category: 'prediction', minPoints: 1, description: '带引线气泡注释' },
  { type: 'ghost-feed', name: '影子行情', shortName: '影子', category: 'prediction', minPoints: 2, description: '历史行情对比叠加' },
  { type: 'risk-reward', name: '风险收益比', shortName: 'R/R', category: 'prediction', minPoints: 3, description: '自动计算风报比' },
  { type: 'date-price-range', name: '日期价格区间', shortName: '日期价格', category: 'prediction', minPoints: 2, description: '跨时间/价格的矩形范围' },

  // ── 形状扩展 (4) ──
  { type: 'polygon', name: '多边形', shortName: '多边形', category: 'shape', minPoints: 3, description: '自定义多边形(油漆桶)' },
  { type: 'path', name: '路径', shortName: '路径', category: 'shape', minPoints: 2, description: '自由绘制路径' },
  { type: 'arc', name: '圆弧', shortName: '圆弧', category: 'shape', minPoints: 3, description: '三点圆弧' },
  { type: 'highlight', name: '高亮', shortName: '高亮', category: 'shape', minPoints: 2, description: '半透明矩形高亮区域' },

  // ── 标注工具扩展 (14) ──
  { type: 'text-note', name: '文本标注', shortName: '文本', category: 'annotation', minPoints: 1, description: '多行文本注释' },
  { type: 'icon-note', name: '图标标注', shortName: '图标', category: 'annotation', minPoints: 1, description: '预定义图标标记' },
  { type: 'price-label', name: '价格标签', shortName: '价格', category: 'annotation', minPoints: 1, description: '浮动价格标签' },
  { type: 'anchor-note', name: '锚定标注', shortName: '锚定', category: 'annotation', minPoints: 1, description: '锚定K线的注释' },
  { type: 'emoji-note', name: '表情标注', shortName: '表情', category: 'annotation', minPoints: 1, description: '表情符号标记' },
  { type: 'time-cycle', name: '时间周期', shortName: '周期', category: 'annotation', minPoints: 2, description: '等间隔周期标注' },
  { type: 'session-highlight', name: '时段高亮', shortName: '时段', category: 'annotation', minPoints: 2, description: '交易时段背景高亮' },
  { type: 'order-line', name: '订单线', shortName: '订单', category: 'annotation', minPoints: 1, description: '订单执行线标注' },
  { type: 'position-line', name: '持仓线', shortName: '持仓', category: 'annotation', minPoints: 1, description: '持仓均价线' },
  { type: 'execution-marker', name: '成交标记', shortName: '成交', category: 'annotation', minPoints: 1, description: '成交点标记' },
  { type: 'watermark', name: '水印', shortName: '水印', category: 'annotation', minPoints: 1, description: '图表水印文字' },
  { type: 'ticker-tape', name: '滚动条', shortName: '滚动', category: 'annotation', minPoints: 1, description: '行情滚动条' },
  { type: 'news-marker', name: '新闻标记', shortName: '新闻', category: 'annotation', minPoints: 1, description: '新闻事件标记点' },
  { type: 'countdown', name: '倒计时', shortName: '倒计时', category: 'annotation', minPoints: 1, description: '事件倒计时' },
];

/** 默认样式 */
export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#2196f3',
  lineWidth: 1,
  opacity: 0.9,
  dash: undefined,
  fillColor: undefined,
  fillOpacity: 0.15,
};

/** 按分类分组 */
export const DRAWING_TOOLS_BY_CATEGORY: Record<string, DrawingToolDefinition[]> = {};
for (const tool of EXTENDED_DRAWING_TOOLS) {
  (DRAWING_TOOLS_BY_CATEGORY[tool.category] ??= []).push(tool);
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-58: MARKET REPLAY ENGINE (回放引擎)
// ═══════════════════════════════════════════════════════════════════════

export type ReplayState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface ReplaySession {
  id: string;
  symbol: string;
  brokerId: string;
  timeframe: string;
  startTime: number;
  endTime: number;
  state: ReplayState;
  currentIndex: number;
  speed: number;       // 1x, 2x, 5x, 10x, 30x
  totalBars: number;
  events: ReplayEvent[];
}

export interface ReplayEvent {
  index: number;
  timestamp: number;
  type: 'golden_cross' | 'death_cross' | 'breakout' | 'pattern' | 'alert' | 'trade';
  label: string;
  price: number;
}

export class MarketReplayEngine {
  private sessions: Map<string, ReplaySession> = new Map();
  private barsCache: Map<string, KlineBar[]> = new Map();
  private onTick?: (bar: KlineBar, session: ReplaySession) => void;
  private onEvent?: (event: ReplayEvent) => void;
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();

  createSession(
    id: string, symbol: string, brokerId: string,
    timeframe: string, bars: KlineBar[], speed: number = 1,
  ): ReplaySession {
    const session: ReplaySession = {
      id, symbol, brokerId, timeframe,
      startTime: bars[0]?.timestamp || 0,
      endTime: bars[bars.length - 1]?.timestamp || 0,
      state: 'idle', currentIndex: 0, speed, totalBars: bars.length,
      events: [],
    };
    this.barsCache.set(id, bars);
    this.sessions.set(id, session);
    return session;
  }

  play(id: string): void {
    const session = this.sessions.get(id);
    const bars = this.barsCache.get(id);
    if (!session || !bars) return;

    session.state = 'playing';
    const interval = Math.max(50, Math.round(1000 / (session.speed * 2)));

    const timer = setInterval(() => {
      if (session.state !== 'playing') { clearInterval(timer); return; }
      if (session.currentIndex >= bars.length) { this.pause(id); return; }

      const bar = bars[session.currentIndex];
      this.onTick?.(bar, session);

      // 检查事件
      for (const event of session.events) {
        if (event.index === session.currentIndex) {
          this.onEvent?.(event);
        }
      }

      session.currentIndex++;
    }, interval);

    this.timers.set(id, timer);
  }

  pause(id: string): void {
    const session = this.sessions.get(id);
    if (session) session.state = 'paused';
    this.clearTimer(id);
  }

  stop(id: string): void {
    const session = this.sessions.get(id);
    if (session) { session.state = 'stopped'; session.currentIndex = 0; }
    this.clearTimer(id);
  }

  seek(id: string, index: number): void {
    const session = this.sessions.get(id);
    const bars = this.barsCache.get(id);
    if (!session || !bars) return;
    session.currentIndex = Math.max(0, Math.min(index, bars.length - 1));
  }

  setSpeed(id: string, speed: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.speed = speed;
    if (session.state === 'playing') { this.pause(id); this.play(id); }
  }

  addEvent(id: string, event: ReplayEvent): void {
    const session = this.sessions.get(id);
    if (session) session.events.push(event);
  }

  jumpToEvent(id: string, eventType: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    const event = session.events.find(e => e.type === eventType);
    if (event) this.seek(id, event.index);
  }

  getSession(id: string): ReplaySession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): ReplaySession[] {
    return Array.from(this.sessions.values());
  }

  onBarUpdate(cb: (bar: KlineBar, session: ReplaySession) => void): void { this.onTick = cb; }
  onEventTrigger(cb: (event: ReplayEvent) => void): void { this.onEvent = cb; }

  destroy(): void {
    for (const [id] of this.timers) this.clearTimer(id);
    this.sessions.clear();
    this.barsCache.clear();
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) { clearInterval(timer); this.timers.delete(id); }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-59: CORRELATION MATRIX + LIQUIDITY MAP (监控面板)
// ═══════════════════════════════════════════════════════════════════════

export interface CorrelationEntry {
  symbolA: string;
  symbolB: string;
  correlation: number;  // -1~1
  pValue: number;
  period: number;       // 计算周期(K线数)
}

export function computeCorrelationMatrix(
  priceMap: Map<string, number[]>,
  period: number = 60,
): CorrelationEntry[] {
  const symbols = Array.from(priceMap.keys());
  const results: CorrelationEntry[] = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const pricesA = priceMap.get(symbols[i])?.slice(-period);
      const pricesB = priceMap.get(symbols[j])?.slice(-period);
      if (!pricesA || !pricesB || pricesA.length < 2) continue;

      const minLen = Math.min(pricesA.length, pricesB.length);
      const pa = pricesA.slice(-minLen);
      const pb = pricesB.slice(-minLen);

      const returnsA = pa.slice(1).map((p, k) => (p - pa[k]) / pa[k]);
      const returnsB = pb.slice(1).map((p, k) => (p - pb[k]) / pb[k]);
      const n = returnsA.length;
      if (n < 2) continue;

      const meanA = returnsA.reduce((s, v) => s + v, 0) / n;
      const meanB = returnsB.reduce((s, v) => s + v, 0) / n;

      let cov = 0, varA = 0, varB = 0;
      for (let k = 0; k < n; k++) {
        const da = returnsA[k] - meanA;
        const db = returnsB[k] - meanB;
        cov += da * db;
        varA += da * da;
        varB += db * db;
      }

      const corr = varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;

      // 简化p-value (t-test)
      const t = corr * Math.sqrt((n - 2) / (1 - corr * corr + 1e-10));
      const pValue = 2 * (1 - Math.min(1, 1 / (1 + t * t / (n - 2)))); // rough approx

      results.push({ symbolA: symbols[i], symbolB: symbols[j], correlation: corr, pValue, period });
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

export interface LiquidityMapEntry {
  brokerId: string;
  symbol: string;
  bidDepth: number;    // 买方总挂单量(USD)
  askDepth: number;    // 卖方总挂单量(USD)
  spread: number;      // %
  liquidityScore: number; // 0-100
}

export function computeLiquidityMap(orderBooks: OrderBookSnapshot[]): LiquidityMapEntry[] {
  return orderBooks.map(book => {
    const bidDepth = book.bids.reduce((s, b) => s + b.price * b.volume, 0);
    const askDepth = book.asks.reduce((s, a) => s + a.price * a.volume, 0);
    const bidPrice = getBestBid(book)?.price || 0;
    const askPrice = getBestAsk(book)?.price || 0;
    const spread = bidPrice > 0 ? (askPrice - bidPrice) / bidPrice * 100 : 0;
    const totalDepth = bidDepth + askDepth;
    const liquidityScore = Math.min(100, Math.round(Math.log10(totalDepth + 1) * 10));

    return { brokerId: book.exchange, symbol: book.symbol, bidDepth, askDepth, spread, liquidityScore };
  }).sort((a, b) => b.liquidityScore - a.liquidityScore);
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function getBestBid(book: OrderBookSnapshot): { price: number; volume: number } | null {
  return book.best?.bidPrice ? { price: book.best.bidPrice, volume: book.best.bidSize } : (book.bids[0] || null);
}
function getBestAsk(book: OrderBookSnapshot): { price: number; volume: number } | null {
  return book.best?.askPrice ? { price: book.best.askPrice, volume: book.best.askSize } : (book.asks[0] || null);
}
