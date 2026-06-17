// ══ R259 LOBEHUB P2: 富媒体AB设计引擎 ══
// Rich Media A/B Design — "文字vs图表？用户的身体很诚实"
//
// 富媒体类型:
//   1. 纯文字 — 控制组
//   2. 文字+迷你图表(折线/柱/) — 数据可视化
//   3. 文字+雷达图 — 多维度对比
//   4. 文字+热力格 — 市场情绪
//   5. 文字+GIF动图 — 趋势动画

export type MediaType = 'TEXT_ONLY' | 'MINI_CHART' | 'RADAR_CHART' | 'HEAT_GRID' | 'ANIMATED_GIF';

export interface RichMediaVariant {
  id: string;
  type: MediaType;
  description: string;
  renderCost: number;       // 生成复杂度 0-1
  clickBoost: number;       // 预估CTR提升 vs 纯文字
  suitableFor: string[];    // 适合什么类型的推送
  template: string;         // 模板说明
}

export interface MediaABResult {
  testId: string;
  pushType: string;         // 异动/简报/策略/社区
  variants: Array<{
    type: MediaType;
    impressions: number;
    clicks: number;
    ctr: number;
    revenue: number;
  }>;
  winner?: MediaType;
  lift: number;
  recommendation: string;
}

// ═══════════════════ 富媒体模板库 ═══════════════════

export const RICH_MEDIA_VARIANTS: RichMediaVariant[] = [
  {
    id: 'text-only',
    type: 'TEXT_ONLY',
    description: '纯文字——控制组基线',
    renderCost: 0.1,
    clickBoost: 1.0,  // 基准
    suitableFor: ['所有类型'],
    template: '标题(≤25字) + 内容摘要(≤80字)',
  },
  {
    id: 'mini-line-chart',
    type: 'MINI_CHART',
    description: '文字+迷你折线图(7日走势)',
    renderCost: 0.4,
    clickBoost: 1.45,  // CTR +45%
    suitableFor: ['异动提醒', '盘前简报', '策略信号'],
    template: '标题 + 7日迷你折线(最后1点高亮) + 一句话总结',
  },
  {
    id: 'mini-bar-volume',
    type: 'MINI_CHART',
    description: '文字+迷你柱状图(5日成交量)',
    renderCost: 0.35,
    clickBoost: 1.25,
    suitableFor: ['成交量异动', '崩盘预警'],
    template: '标题 + 5日成交量柱(最后1柱放大) + "成交爆量3×均值"',
  },
  {
    id: 'radar-compare',
    type: 'RADAR_CHART',
    description: '文字+五维雷达图(P/E/ROE/增速/负债/动量)',
    renderCost: 0.6,
    clickBoost: 1.65,
    suitableFor: ['多股对比', '板块诊断', '策略推荐'],
    template: '标题 + 5维雷达图(两只股票叠层) + 一句话胜者',
  },
  {
    id: 'heat-grid',
    type: 'HEAT_GRID',
    description: '文字+3×3热力格(市场情绪矩阵)',
    renderCost: 0.5,
    clickBoost: 1.55,
    suitableFor: ['市场简报', '崩盘预警', '板块诊断'],
    template: '标题 + 3×3色块矩阵(红/黄/绿) + "恐慌指数87"',
  },
  {
    id: 'animated-spark',
    type: 'ANIMATED_GIF',
    description: '文字+价格走势GIF动图(5帧循环)',
    renderCost: 0.8,
    clickBoost: 1.75,
    suitableFor: ['异动提醒', '策略信号', '社区热门'],
    template: '标题 + 5帧GIF(开盘→收盘过程) + CTA按钮',
  },
];

// ═══════════════════ 媒体类型推荐 ═══════════════════

export function recommendMediaForPush(
  pushType: string,
  urgency: string,
  hasComparison: boolean,
  userPreference: 'TEXT' | 'VISUAL' | 'ANY',
): MediaType[] {
  const candidates: MediaType[] = ['TEXT_ONLY'];

  if (userPreference === 'TEXT') return ['TEXT_ONLY'];

  if (pushType === '异动提醒' && urgency === 'HIGH') {
    candidates.push('MINI_CHART');
  }
  if (pushType === '多股对比' && hasComparison) {
    candidates.push('RADAR_CHART');
  }
  if (pushType === '崩盘预警' || pushType === '市场简报') {
    candidates.push('HEAT_GRID');
  }
  if (pushType === '策略信号') {
    candidates.push('MINI_CHART');
  }
  if (urgency === 'CRITICAL') {
    candidates.push('ANIMATED_GIF');
  }

  return [...new Set(candidates)];
}

// ═══════════════════ A/B测试结果分析 ═══════════════════

export function analyzeMediaAB(
  testId: string,
  pushType: string,
  results: Array<{ type: MediaType; impressions: number; clicks: number; revenue: number }>,
): MediaABResult {
  const variants = results.map(r => ({
    ...r,
    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
  }));

  variants.sort((a, b) => b.ctr - a.ctr);

  const winner = variants.length > 1 && variants[0].ctr > variants[1].ctr * 1.05
    ? variants[0].type
    : undefined;

  const lift = variants.length > 1 && variants[1].ctr > 0
    ? (variants[0].ctr - variants[1].ctr) / variants[1].ctr
    : 0;

  return {
    testId, pushType, variants,
    winner,
    lift,
    recommendation: winner
      ? `📈 ${winner} CTR最高(${(variants[0].ctr * 100).toFixed(1)}%)，比第二名提升${(lift * 100).toFixed(0)}%。建议默认使用${winner}。`
      : '🤷 各方案CTR差异不显著——建议继续收集数据或增加样本。',
  };
}

// ═══════════════════ 预置A/B测试方案 ═══════════════════

export const MEDIA_AB_TESTS = {
  anomaly_push: {
    name: '异动推送——文字vs迷你图表',
    variants: ['TEXT_ONLY', 'MINI_CHART'] as MediaType[],
    hypothesis: '迷你图表比纯文字CTR高30-50%',
    minSample: 500,
  },
  compare_push: {
    name: '多股对比推送——文字vs雷达图',
    variants: ['TEXT_ONLY', 'RADAR_CHART'] as MediaType[],
    hypothesis: '雷达图比纯文字CTR高50-70%',
    minSample: 500,
  },
  crash_alert: {
    name: '崩盘预警——文字vs热力格',
    variants: ['TEXT_ONLY', 'HEAT_GRID'] as MediaType[],
    hypothesis: '热力格在恐慌时CTR更高',
    minSample: 1000,
  },
  signal_alert: {
    name: '策略信号——文字vs迷你图表vs动画',
    variants: ['TEXT_ONLY', 'MINI_CHART', 'ANIMATED_GIF'] as MediaType[],
    hypothesis: '动画CTR最高但成本也最高——需要权衡',
    minSample: 300,
  },
};

export default MediaABResult;
