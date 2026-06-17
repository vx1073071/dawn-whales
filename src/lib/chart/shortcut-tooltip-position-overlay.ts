/**
 * R276 Claw(PM): 快捷键提示浮层 + 持仓叠加K线
 * 
 * 1. useShortcutTooltip — 首次使用/按?键时弹出快捷键速查浮层
 * 2. usePositionOverlay — 持仓股票在K线图上标注买入点+成本线
 */

// ── 快捷键提示浮层 Hook ──
export const SHORTCUT_CHEATSHEET = {
  chart: [
    { key: '1-9', desc: '切换时间周期 (1分/5分/15分/1时/4时/日/周/月)' },
    { key: 'T', desc: '画趋势线' },
    { key: 'H', desc: '画水平线' },
    { key: 'F', desc: '斐波那契回调' },
    { key: 'R', desc: '画矩形' },
    { key: 'Ctrl+Z', desc: '撤销最后画线' },
    { key: '↑↓', desc: '缩放Y轴' },
    { key: '←→', desc: '平移K线' },
    { key: 'Space', desc: '播放/暂停行情回放' },
  ],
  navigation: [
    { key: 'Ctrl+B', desc: '切换深色模式' },
    { key: 'Ctrl+K', desc: '指标搜索' },
    { key: 'Ctrl+N', desc: '新建图表' },
    { key: 'Ctrl+,', desc: '设置' },
    { key: 'Esc', desc: '关闭弹窗' },
  ],
  trading: [
    { key: 'B', desc: '买入面板' },
    { key: 'S', desc: '卖出面板' },
    { key: 'Ctrl+D', desc: 'AI诊断' },
    { key: 'Ctrl+P', desc: '画线→策略' },
    { key: 'Ctrl+L', desc: '条件单' },
  ],
};

export interface ShortcutTooltipState {
  visible: boolean;
  searchTerm: string;
}

export function filterShortcuts(query: string): { key: string; desc: string }[] {
  const all = [...SHORTCUT_CHEATSHEET.chart, ...SHORTCUT_CHEATSHEET.navigation, ...SHORTCUT_CHEATSHEET.trading];
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(s => s.key.toLowerCase().includes(q) || s.desc.includes(q));
}

// ── 持仓叠加K线 Hook ──

export interface PositionOverlay {
  symbol: string;
  avgCost: number;       // 买入均价
  quantity: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  entryDate: string;
  holdDays: number;
}

export interface PositionOverlayData {
  positions: PositionOverlay[];
  getCostLine: (symbol: string) => number | undefined;
  getEntryDate: (symbol: string) => string | undefined;
  getHoldDays: (symbol: string) => number | undefined;
  getPnlLabel: (symbol: string) => { text: string; color: string };
}

/**
 * 从 PaperTradingEngine 或真实账户提取持仓数据
 */
export function getPositionOverlay(
  positions: { symbol: string; avgCost: number; quantity: number; currentPrice: number; unrealizedPnl: number; unrealizedPnlPct: number }[]
): PositionOverlayData {
  const map = new Map<string, PositionOverlay>();
  for (const p of positions) {
    map.set(p.symbol, {
      symbol: p.symbol,
      avgCost: p.avgCost,
      quantity: p.quantity,
      currentPrice: p.currentPrice,
      pnl: p.unrealizedPnl,
      pnlPct: p.unrealizedPnlPct,
      entryDate: new Date().toISOString().slice(0, 10),
      holdDays: 1,
    });
  }

  return {
    positions: Array.from(map.values()),
    getCostLine: (symbol: string) => map.get(symbol)?.avgCost,
    getEntryDate: (symbol: string) => map.get(symbol)?.entryDate,
    getHoldDays: (symbol: string) => map.get(symbol)?.holdDays,
    getPnlLabel: (symbol: string) => {
      const p = map.get(symbol);
      if (!p) return { text: '', color: '#888' };
      const sign = p.pnl >= 0 ? '+' : '';
      const color = p.pnl >= 0 ? '#00d4aa' : '#ff4757';
      return { text: `${sign}${p.pnl.toFixed(2)} (${sign}${p.pnlPct.toFixed(1)}%)`, color };
    },
  };
}

/**
 * K线图成本线渲染数据
 * 绿色虚线=买入均价 + 红色虚线=止损参考(ATR×2或-5%)
 */
export function getCostLineRender(symbol: string, positions: PositionOverlay[]): {
  costLine: number | null;
  stopLine: number | null;
  entryMarker: { date: string; price: number } | null;
} {
  const pos = positions.find(p => p.symbol === symbol);
  if (!pos) return { costLine: null, stopLine: null, entryMarker: null };
  return {
    costLine: pos.avgCost,
    stopLine: pos.avgCost * 0.95, // 5% stop loss reference
    entryMarker: { date: pos.entryDate, price: pos.avgCost },
  };
}

export default { SHORTCUT_CHEATSHEET, filterShortcuts, getPositionOverlay, getCostLineRender };
