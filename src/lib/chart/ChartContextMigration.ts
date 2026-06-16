// @ts-nocheck
// ── R221-auto#2: ChartContext 批量迁移辅助工具 ─────────────────────────────
// 26个chart/broker组件逐步接入ChartContext
//
// 迁移策略: 渐进式 — 组件可同时使用props和context
//   1. import { useChartContextSafe } from './ChartContext'
//   2. 组件顶部: const ctx = useChartContextSafe()
//   3. 使用: ctx?.symbol ?? props.symbol  (props优先, context默认)
//   4. 设置: ctx?.setSymbol(newSymbol)      (通知全局同步)

import { useChartContextSafe } from '../hooks/ChartContext';

export { useChartContextSafe };
export { useChartContext } from '../hooks/ChartContext';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT MIGRATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 组件渐进接入ChartContext的标准模式
 *
 * @example
 * ```tsx
 * import { useChartSync } from '../../lib/chart/ChartContextMigration';
 *
 * function KLineChart({ symbol: propSymbol, timeframe: propTf }: Props) {
 *   const { symbol, timeframe, setSymbol, setTimeframe } = useChartSync({
 *     symbol: propSymbol,
 *     timeframe: propTf,
 *   });
 *   // symbol = propSymbol ?? ctx.symbol ?? 'BTC-USDT'
 * }
 * ```
 */
export interface ChartSyncFromProps {
  symbol?: string;
  timeframe?: string;
  market?: 'crypto' | 'us' | 'hk' | 'forex';
}

export function useChartSync(props?: ChartSyncFromProps) {
  const ctx = useChartContextSafe();

  return {
    symbol:      props?.symbol      ?? ctx?.symbol      ?? 'BTC-USDT',
    timeframe:   props?.timeframe   ?? ctx?.timeframe   ?? 'D',
    market:      props?.market      ?? ctx?.market      ?? 'crypto',
    connectedBrokers: ctx?.connectedBrokers ?? [],
    activeIndicators: ctx?.activeIndicators ?? [],
    setSymbol:      (s: string) => ctx?.setSymbol(s),
    setTimeframe:   (tf: string) => ctx?.setTimeframe(tf as any),
    setMarket:      (m: 'crypto'|'us'|'hk'|'forex') => ctx?.setMarket(m),
    toggleIndicator:(id: string) => ctx?.toggleIndicator(id),
    hasContext: !!ctx,
  };
}

/**
 * Symbol可点击切换 helper — 跨所有chart组件统一
 *
 * @example
 * ```tsx
 * <span className="cursor-pointer hover:text-blue-400"
 *       onClick={() => makeSymbolClickable(newSymbol, setSymbol)}>
 *   {newSymbol}
 * </span>
 * ```
 */
export function onSymbolClick(symbol: string, setter?: (s: string) => void) {
  if (setter) setter(symbol);
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION TARGET: 26 COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * # 迁移优先级 — 26个chart/broker组件
 *
 * ## 🔴 第一批: 核心K线 + 下单 (9个)
 * 1.  src/components/chart/FootprintChart.tsx       — 足迹图
 * 2.  src/components/chart/DOMLadder.tsx            — DOM阶梯
 * 3.  src/components/chart/DepthAnalyzerPanel.tsx   — 深度分析
 * 4.  src/components/chart/AggregatedOrderBook.tsx  — 聚合订单簿
 * 5.  src/components/chart/VolumeProfileSpread.tsx  — 成交量分布
 * 6.  src/components/chart/OrderBookWaterfall.tsx   — 订单簿瀑布
 * 7.  src/components/chart/TickTimeline.tsx         — Tick时间线
 * 8.  src/components/chart/ReplayAndMicrostructure.tsx — 回放+微结构
 * 9.  src/components/chart/MarketScanner.tsx        — 市场扫描
 *
 * ## 🟡 第二批: 图表增强 (8个)
 * 10. src/components/chart/ChartContextMenu.tsx     — 图表右键菜单
 * 11. src/components/chart/ChartEnhancements.tsx    — 图表增强
 * 12. src/components/chart/SymbolLink.tsx           — 品种联动
 * 13. src/components/chart/TradingSessionBar.tsx    — 交易时段条
 * 14. src/components/chart/MicrostructureTooltip.tsx — 微结构提示
 * 15. src/components/chart/CBBOPanel.tsx            — CBBO面板
 * 16. src/components/chart/ArbitrageMonitor.tsx     — 套利监控
 * 17. src/components/chart/AlertAndFundFlow.tsx     — 告警+资金流
 *
 * ## 🟢 第三批: Broker组件 (9个)
 * 18. src/components/broker/WatchlistV2.tsx         — 自选列表
 * 19. src/components/broker/OpenDSignalPanel.tsx    — OpenD信号
 * 20. src/components/broker/OpenDOfflineAlert.tsx   — OpenD离线告警
 * 21. src/components/broker/SignalDedupAndPriority.tsx — 信号去重
 * 22. src/components/broker/ArbitragePanel.tsx      — 套利面板
 * 23. src/components/broker/AggregatedPortfolio.tsx — 聚合持仓
 * 24. src/components/broker/BrokerHealthScore.tsx   — 券商健康度
 * 25. src/components/broker/BrokerPanoramicPanel.tsx — 券商全景
 * 26. src/components/broker/FinalUIWalkthrough.tsx  — 最终UI走查
 *
 * ## 迁移模式 (每个组件)
 * ```tsx
 * // ① 顶部添加
 * import { useChartSync } from '../../lib/chart/ChartContextMigration';
 *
 * // ② 组件内部
 * const { symbol, timeframe, setSymbol, setTimeframe } = useChartSync();
 *
 * // ③ 替换硬编码 symbol/timeframe
 * // before: const sym = 'BTC-USDT';
 * // after:  const sym = symbol;
 *
 * // ④ symbol变更后通知全局
 * // before: onSymbolChange(newSym);
 * // after:  setSymbol(newSym); onSymbolChange(newSym);
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION BATCH TRANSFORM UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply migration template to a component source string.
 * Returns transformed source with ChartContext integration.
 *
 * Usage (in migration script):
 * const transformed = applyChartContextMigration(source, componentName);
 */
export function applyChartContextMigration(
  source: string,
  componentName: string,
): { source: string; changes: string[] } {
  const changes: string[] = [];

  // ① Add import if not already present
  if (!source.includes('useChartSync') && !source.includes('useChartContext')) {
    const importLine = `import { useChartSync } from '../../lib/chart/ChartContextMigration';`;
    const lastImport = source.lastIndexOf('import ');
    if (lastImport >= 0) {
      const endOfLastImport = source.indexOf('\n', lastImport);
      source = source.substring(0, endOfLastImport + 1) + importLine + '\n' + source.substring(endOfLastImport + 1);
    } else {
      source = importLine + '\n' + source;
    }
    changes.push('Added useChartSync import');
  }

  // ② Add hook call in function body
  if (!source.includes('useChartSync()')) {
    const fnMatch = source.match(/(?:export |default )?function\s+(\w+)\s*\([^)]*\)\s*\{/);
    if (fnMatch) {
      const hookLine = `\n  const { symbol, timeframe, setSymbol, setTimeframe } = useChartSync();`;
      source = source.replace(fnMatch[0], fnMatch[0] + hookLine);
      changes.push(`Added useChartSync to ${fnMatch[1]}`);
    }
  }

  return { source, changes };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT MIGRATION SUMMARY (for PM reporting)
// ═══════════════════════════════════════════════════════════════════════════

export interface MigrationManifest {
  component: string;
  path: string;
  priority: 1 | 2 | 3;
  status: 'pending' | 'migrated' | 'skipped';
  notes: string;
}

/**
 * Migration manifest — tracks all 26 components
 */
export const MIGRATION_MANIFEST: MigrationManifest[] = [
  // 🔴 Priority 1: Core kline + order (9)
  { component:'FootprintChart',         path:'src/components/chart/FootprintChart.tsx',         priority:1, status:'pending', notes:'足迹图 — 需要symbol+timeframe' },
  { component:'DOMLadder',              path:'src/components/chart/DOMLadder.tsx',              priority:1, status:'pending', notes:'DOM阶梯 — 需要symbol' },
  { component:'DepthAnalyzerPanel',     path:'src/components/chart/DepthAnalyzerPanel.tsx',     priority:1, status:'pending', notes:'深度分析 — 需要symbol' },
  { component:'AggregatedOrderBook',    path:'src/components/chart/AggregatedOrderBook.tsx',    priority:1, status:'pending', notes:'聚合OB — 需要symbol+broker' },
  { component:'VolumeProfileSpread',    path:'src/components/chart/VolumeProfileSpread.tsx',    priority:1, status:'pending', notes:'VP分布 — 需要symbol' },
  { component:'OrderBookWaterfall',     path:'src/components/chart/OrderBookWaterfall.tsx',     priority:1, status:'pending', notes:'OB瀑布 — 需要symbol' },
  { component:'TickTimeline',           path:'src/components/chart/TickTimeline.tsx',           priority:1, status:'pending', notes:'Tick时间线 — 需要symbol' },
  { component:'ReplayAndMicrostructure',path:'src/components/chart/ReplayAndMicrostructure.tsx',priority:1, status:'pending', notes:'回放+微结构 — 需要symbol+timeframe' },
  { component:'MarketScanner',          path:'src/components/chart/MarketScanner.tsx',          priority:1, status:'pending', notes:'市场扫描 — 需要market' },

  // 🟡 Priority 2: Chart enhancements (8)
  { component:'ChartContextMenu',       path:'src/components/chart/ChartContextMenu.tsx',       priority:2, status:'pending', notes:'右键菜单' },
  { component:'ChartEnhancements',      path:'src/components/chart/ChartEnhancements.tsx',      priority:2, status:'pending', notes:'图表增强' },
  { component:'SymbolLink',             path:'src/components/chart/SymbolLink.tsx',             priority:2, status:'pending', notes:'品种联动 — 核心交互' },
  { component:'TradingSessionBar',      path:'src/components/chart/TradingSessionBar.tsx',      priority:2, status:'pending', notes:'交易时段' },
  { component:'MicrostructureTooltip',  path:'src/components/chart/MicrostructureTooltip.tsx',  priority:2, status:'pending', notes:'微结构提示' },
  { component:'CBBOPanel',              path:'src/components/chart/CBBOPanel.tsx',              priority:2, status:'pending', notes:'CBBO面板' },
  { component:'ArbitrageMonitor',       path:'src/components/chart/ArbitrageMonitor.tsx',       priority:2, status:'pending', notes:'套利监控' },
  { component:'AlertAndFundFlow',       path:'src/components/chart/AlertAndFundFlow.tsx',       priority:2, status:'pending', notes:'告警+资金流' },

  // 🟢 Priority 3: Broker components (9)
  { component:'WatchlistV2',            path:'src/components/broker/WatchlistV2.tsx',           priority:3, status:'pending', notes:'自选列表 — 核心交互' },
  { component:'OpenDSignalPanel',       path:'src/components/broker/OpenDSignalPanel.tsx',      priority:3, status:'pending', notes:'OpenD信号' },
  { component:'OpenDOfflineAlert',      path:'src/components/broker/OpenDOfflineAlert.tsx',     priority:3, status:'pending', notes:'OpenD离线' },
  { component:'SignalDedupAndPriority', path:'src/components/broker/SignalDedupAndPriority.tsx',priority:3, status:'pending', notes:'信号去重' },
  { component:'ArbitragePanel',         path:'src/components/broker/ArbitragePanel.tsx',        priority:3, status:'pending', notes:'套利面板' },
  { component:'AggregatedPortfolio',    path:'src/components/broker/AggregatedPortfolio.tsx',   priority:3, status:'pending', notes:'聚合持仓' },
  { component:'BrokerHealthScore',      path:'src/components/broker/BrokerHealthScore.tsx',     priority:3, status:'pending', notes:'券商健康' },
  { component:'BrokerPanoramicPanel',   path:'src/components/broker/BrokerPanoramicPanel.tsx',  priority:3, status:'pending', notes:'券商全景' },
  { component:'FinalUIWalkthrough',     path:'src/components/broker/FinalUIWalkthrough.tsx',    priority:3, status:'pending', notes:'UI走查' },
];

/** Print migration progress summary */
export function getMigrationProgress(): string {
  const done = MIGRATION_MANIFEST.filter(m => m.status === 'migrated').length;
  return `ChartContext迁移进度: ${done}/${MIGRATION_MANIFEST.length} (${Math.round(done/MIGRATION_MANIFEST.length*100)}%)`;
}

export default {
  useChartSync, onSymbolClick,
  applyChartContextMigration, MIGRATION_MANIFEST, getMigrationProgress,
};
