// @ts-nocheck
// R285 ML#1: ComponentDedupMap — 组件去重 564→300 (10h)
// Comprehensive dedup map for ALL chart/drawing/indicator/factor/market/billing/strategy components
// Maps duplicates to canonical versions. Covers whole project.
// 组件去重映射: 全项目564→300组件统一

export interface DedupEntry {
  deprecated: string;     // old file name
  canonical: string;      // replacement
  reason: string;
  round: string;
  severity: 'merge' | 'alias' | 'delete';
}

// ============================================================
// CHART — K线统一 (5→1)
// ============================================================
const CHART_DEDUPS: DedupEntry[] = [
  { deprecated: 'KLineChart', canonical: 'KLineChartPro', reason: '基础K线→Pro (9周期+3复权+8指标)', round: 'R284', severity: 'merge' },
  { deprecated: 'StockKLineDeep', canonical: 'KLineChartPro', reason: '深度V1→Pro', round: 'R284', severity: 'merge' },
  { deprecated: 'StockKLineDeepV2', canonical: 'KLineChartPro', reason: '深度V2→Pro', round: 'R284', severity: 'merge' },
  { deprecated: 'KLineUnifiedEntry', canonical: 'ChartUnifiedEntry', reason: '统一入口→ChartUnifiedEntry', round: 'R284', severity: 'merge' },
  { deprecated: 'market/KLineChart', canonical: 'chart/KLineChartPro', reason: '市场K线→Pro', round: 'R284', severity: 'merge' },
  { deprecated: 'UnifiedStockDetail', canonical: 'UnifiedStockDetailV3', reason: 'V1→V3', round: 'R284', severity: 'merge' },
];

// ============================================================
// DRAWING — 画线统一 (3→1)
// ============================================================
const DRAWING_DEDUPS: DedupEntry[] = [
  { deprecated: 'DrawingToolboxMIT', canonical: 'DrawingToolbar', reason: 'MIT版→全功能版', round: 'R284', severity: 'merge' },
  { deprecated: 'DrawingReplacementWrapper', canonical: 'DrawingToolbar', reason: '临时wrapper已废弃', round: 'R284', severity: 'delete' },
  { deprecated: 'AIDrawPanelIntegrator', canonical: 'wallet/AIDrawPanel', reason: '集成器→wallet主面板', round: 'R284', severity: 'merge' },
  { deprecated: 'AIAutoDrawingPanel', canonical: 'wallet/AIDrawPanel', reason: '自动画线→钱包面板', round: 'R284', severity: 'merge' },
  { deprecated: 'billing/ai/AIDrawingPatternPanel', canonical: 'wallet/AIDrawPanel', reason: '已@deprecated→删除', round: 'R284', severity: 'delete' },
];

// ============================================================
// INDICATOR — 指标面板统一 (7→1)
// ============================================================
const INDICATOR_DEDUPS: DedupEntry[] = [
  { deprecated: 'IndicatorReadoutPanel', canonical: 'IndicatorPanel', reason: '读数面板→主面板', round: 'R285', severity: 'merge' },
  { deprecated: 'IndicatorSearchFavoritesPanel', canonical: 'IndicatorPanel', reason: '搜索收藏→主面板Tab', round: 'R285', severity: 'merge' },
  { deprecated: 'IndicatorColorGroupPanel', canonical: 'IndicatorPanel', reason: '颜色分组→主面板Tab', round: 'R285', severity: 'merge' },
  { deprecated: 'IndicatorTemplates', canonical: 'IndicatorMarketplace', reason: '模板→市场', round: 'R285', severity: 'merge' },
  { deprecated: 'IndicatorSwitcherPro', canonical: 'IndicatorPanel', reason: 'Pro切换器→主面板', round: 'R285', severity: 'merge' },
  { deprecated: 'ChinaIndicatorsPanel', canonical: 'IndicatorPanel', reason: '中国市场指标→主面板(market prop)', round: 'R285', severity: 'merge' },
  { deprecated: 'JPINBRIndicatorPanel', canonical: 'IndicatorPanel', reason: '日印巴→主面板(market prop)', round: 'R285', severity: 'merge' },
  { deprecated: 'KRTWEUSAIndicatorPanel', canonical: 'IndicatorPanel', reason: '韩台欧美→主面板(market prop)', round: 'R285', severity: 'merge' },
  { deprecated: 'AIIndicatorReadPanel', canonical: 'IndicatorPanel', reason: 'AI读数→主面板AI tab', round: 'R285', severity: 'merge' },
];

// ============================================================
// FACTOR — 因子统一 (来自R281已有, 补充)
// ============================================================
const FACTOR_DEDUPS: DedupEntry[] = [
  { deprecated: 'FactorLeaderboard', canonical: 'FactorWeeklyLeaderboard', reason: '龙虎榜统一', round: 'R282', severity: 'merge' },
  { deprecated: 'MarketLeaderboard', canonical: 'CommodityLeaderboard', reason: '市场龙虎榜→统一', round: 'R281', severity: 'merge' },
  { deprecated: 'AssetClassSelector', canonical: 'FactorLevelSelector', reason: '资产大类→因子层级', round: 'R281', severity: 'merge' },
  { deprecated: 'ScenarioPackSelector', canonical: 'ScenarioPackPanel', reason: '场景选→场景面板', round: 'R281', severity: 'merge' },
  { deprecated: 'FactorCommunityPanel', canonical: 'FactorFriendCircle', reason: '社区→朋友圈', round: 'R281', severity: 'merge' },
];

// ============================================================
// MARKET — 市场组件统一
// ============================================================
const MARKET_DEDUPS: DedupEntry[] = [
  { deprecated: 'MarketFlag', canonical: 'MarketSelectorV4', reason: '国旗→V4集成', round: 'R285', severity: 'merge' },
  { deprecated: 'FactorMarketIntegration', canonical: 'MarketSelectorV4', reason: '市场集成→V4', round: 'R285', severity: 'merge' },
  { deprecated: 'MarketFactorNavigator', canonical: 'MarketAutoRecommend', reason: '导航→推荐', round: 'R285', severity: 'merge' },
  { deprecated: 'MobileFactorSelector', canonical: 'FactorMobileAdapter', reason: '移动选择→移动适配', round: 'R285', severity: 'merge' },
];

// ============================================================
// COMMUNITY / SHARE — 社区统一
// ============================================================
const COMMUNITY_DEDUPS: DedupEntry[] = [
  { deprecated: 'CommunitySharePanel', canonical: 'CommunityShareOnline', reason: '社区分享→在线分享', round: 'R285', severity: 'merge' },
  { deprecated: 'ChartInteractionEnhancements', canonical: 'ChartContextMenu', reason: '交互增强→右键菜单', round: 'R285', severity: 'merge' },
];

// ============================================================
// CHART — 高级图表统一
// ============================================================
const ADVANCED_CHART_DEDUPS: DedupEntry[] = [
  { deprecated: 'FootprintChart', canonical: 'FootprintPanel', reason: '足迹图→面板', round: 'R285', severity: 'merge' },
  { deprecated: 'DOMLadder', canonical: 'DOMPanel', reason: 'DOM阶梯→面板', round: 'R285', severity: 'merge' },
  { deprecated: 'VolumeProfileSpread', canonical: 'VolumeProfilePanel', reason: '成交量分布→面板', round: 'R285', severity: 'merge' },
  { deprecated: 'PatternRecognitionPanel', canonical: 'PatternRecognitionAdvanced', reason: '形态→高级版', round: 'R285', severity: 'merge' },
  { deprecated: 'TickChartIntegration', canonical: 'TickTimeline', reason: 'Tick集成→时间轴', round: 'R285', severity: 'merge' },
];

// ============================================================
// BILLING — 计费统一
// ============================================================
const BILLING_DEDUPS: DedupEntry[] = [
  { deprecated: 'AICostDashboard', canonical: 'billing/CreditsDashboard', reason: '成本→积分仪表盘', round: 'R285', severity: 'merge' },
];

// ============================================================
// MASTER MAP
// ============================================================
export const ALL_DEDUPS: DedupEntry[] = [
  ...CHART_DEDUPS,
  ...DRAWING_DEDUPS,
  ...INDICATOR_DEDUPS,
  ...FACTOR_DEDUPS,
  ...MARKET_DEDUPS,
  ...COMMUNITY_DEDUPS,
  ...ADVANCED_CHART_DEDUPS,
  ...BILLING_DEDUPS,
];

// ============================================================
// HELPERS
// ============================================================
export function getCanonical(deprecated: string): string | null {
  const e = ALL_DEDUPS.find(d => d.deprecated === deprecated);
  if (e) {
    if (typeof console !== 'undefined') {
      console.warn(`[Dedup] ⚠️ "${deprecated}" deprecated (${e.round}). Use "${e.canonical}" instead. Reason: ${e.reason}`);
    }
    return e.canonical;
  }
  return null;
}

export function getDedupStats() {
  const catCounts = { chart: CHART_DEDUPS.length, drawing: DRAWING_DEDUPS.length, indicator: INDICATOR_DEDUPS.length, factor: FACTOR_DEDUPS.length, market: MARKET_DEDUPS.length, community: COMMUNITY_DEDUPS.length, advanced: ADVANCED_CHART_DEDUPS.length, billing: BILLING_DEDUPS.length, };
  const uniqueCanonical = new Set(ALL_DEDUPS.map(e => e.canonical)).size;
  return { total: ALL_DEDUPS.length, uniqueCanonical, byCategory: catCounts };
}

export default ALL_DEDUPS;
