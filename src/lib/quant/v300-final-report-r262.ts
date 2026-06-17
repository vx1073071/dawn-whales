// ══ R262 LOBEHUB P3: v3.0.0 数据质量终报 + 收入预测复核 ══
// v3.0.0 Final Data Quality Report & Revenue Projection Review
//
// 全量行情数据质量报告 + 基于真实数据质量的收入预测复核

import { DataQualityReport } from './data-quality-benchmark-r261';
import { PushQualityReport } from './push-precision-recall-r261';
import { WatchlistPerfReport } from './watchlist-perf-benchmark-r261';
import { SourceHealthDashboard } from './source-health-thresholds-r262';
import { MarketDataKPI } from './market-kpi-dashboard-r262';

export interface v300FinalReport {
  version: string;          // v3.0.0
  timestamp: number;
  sections: Array<{
    name: string;
    status: 'PASS' | 'WARNING' | 'FAIL';
    score: number;           // 0-100
    details: string;
  }>;
  overallScore: number;
  overallVerdict: 'SHIP' | 'SHIP_WITH_CAUTION' | 'HOLD';
  revenueProjection: {
    baseCase: number;        // 月收入$
    bestCase: number;
    worstCase: number;
    assumptions: string[];
  };
  riskMatrix: Array<{
    risk: string;
    probability: 'HIGH' | 'MEDIUM' | 'LOW';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    mitigation: string;
  }>;
  signOffRequired: string[];
}

// ═══════════════════ 收入预测 ═══════════════════

export function projectRevenue(
  pushCTR: number,
  pushConversion: number,
  avgOrderValue: number,
  dailyActiveUsers: number,
  pushesPerUserPerDay: number,
): { baseCase: number; bestCase: number; worstCase: number; assumptions: string[] } {
  const dailyPushes = dailyActiveUsers * pushesPerUserPerDay;
  const dailyClicks = dailyPushes * pushCTR;
  const dailyConversions = dailyClicks * pushConversion;
  const dailyRevenue = dailyConversions * avgOrderValue;
  const monthlyBase = dailyRevenue * 30;

  return {
    baseCase: Math.round(monthlyBase),
    bestCase: Math.round(monthlyBase * 1.3),    // +30% if CTR/push get optimized
    worstCase: Math.round(monthlyBase * 0.5),    // -50% if data quality issues
    assumptions: [
      `推送CTR ${(pushCTR*100).toFixed(1)}% (基准)`,
      `推送转化 ${(pushConversion*100).toFixed(1)}%`,
      `客单价 $${avgOrderValue}`,
      `DAU ${dailyActiveUsers}`,
      `人均日推送 ${pushesPerUserPerDay}条`,
      `乐观: CTR+30% via个性化优化`,
      `悲观: 数据质量→CTR减半`,
    ],
  };
}

// ═══════════════════ 全量终报 ═══════════════════

export function generateV300FinalReport(
  dataQuality: DataQualityReport,
  pushQuality: PushQualityReport,
  watchlistPerf: WatchlistPerfReport,
  sourceHealth: SourceHealthDashboard,
  marketKPI: MarketDataKPI,
  dauEstimate: number = 1000,
): v300FinalReport {
  const sections: v300FinalReport['sections'] = [
    {
      name: '行情数据质量', status: dataQuality.overall,
      score: dataQuality.overall === 'PASS' ? 90 : dataQuality.overall === 'WARNING' ? 65 : 30,
      details: `P95延迟${Math.round(dataQuality.latency.avgP95)}ms, 准确率${(dataQuality.accuracy.matchRate*100).toFixed(0)}%, 缺失率${(dataQuality.completeness.overallMissingRate*100).toFixed(2)}%`,
    },
    {
      name: '推送质量', status: pushQuality.overall.f1Score >= 0.85 ? 'PASS' : pushQuality.overall.f1Score >= 0.7 ? 'WARNING' : 'FAIL',
      score: Math.round(pushQuality.overall.f1Score * 100),
      details: `F1=${(pushQuality.overall.f1Score*100).toFixed(0)}%, 准确率${(pushQuality.overall.precision*100).toFixed(0)}%, 召回率${(pushQuality.overall.recall*100).toFixed(0)}%`,
    },
    {
      name: 'Watchlist性能', status: watchlistPerf.overall,
      score: watchlistPerf.overall === 'PASS' ? 90 : watchlistPerf.overall === 'WARNING' ? 65 : 30,
      details: `${watchlistPerf.benchmarks.length}档测试, 缩放${watchlistPerf.scalability.isLinear ? '线性' : '非线性'}`,
    },
    {
      name: '源健康', status: sourceHealth.overallHealth >= 100 ? 'PASS' : sourceHealth.overallHealth >= 75 ? 'WARNING' : 'FAIL',
      score: sourceHealth.overallHealth,
      details: `${sourceHealth.activeSources.length}/${sourceHealth.sources.length}源活跃, ${sourceHealth.switchedSources.length}源切换`,
    },
    {
      name: '行情KPI', status: marketKPI.overallStatus === 'EXCELLENT' || marketKPI.overallStatus === 'GOOD' ? 'PASS' : marketKPI.overallStatus === 'FAIR' ? 'WARNING' : 'FAIL',
      score: marketKPI.overallScore,
      details: `覆盖${marketKPI.globalMetrics.totalExchanges}/${29}交易所, ${marketKPI.globalMetrics.totalSymbols}符号, 综合${marketKPI.overallScore}分`,
    },
  ];

  const avgScore = sections.reduce((s, sec) => s + sec.score, 0) / sections.length;
  const failCount = sections.filter(s => s.status === 'FAIL').length;
  const warnCount = sections.filter(s => s.status === 'WARNING').length;

  let overallVerdict: v300FinalReport['overallVerdict'];
  if (failCount > 0) overallVerdict = 'HOLD';
  else if (warnCount > 1) overallVerdict = 'SHIP_WITH_CAUTION';
  else overallVerdict = 'SHIP';

  const revenue = projectRevenue(
    pushQuality.overall.precision * pushQuality.overall.recall || 0.04,
    0.05, 1.50, dauEstimate, 3,
  );

  const riskMatrix: v300FinalReport['riskMatrix'] = [];
  if (dataQuality.overall !== 'PASS') riskMatrix.push({ risk: '行情数据质量不达标', probability: 'MEDIUM', impact: 'HIGH', mitigation: '继续优化Yahoo WS连接+增加重试' });
  if (pushQuality.overall.f1Score < 0.7) riskMatrix.push({ risk: '推送质量差→用户流失', probability: 'HIGH', impact: 'HIGH', mitigation: 'A/B测试优化阈值+个性化推送' });
  if (!watchlistPerf.scalability.isLinear) riskMatrix.push({ risk: 'Watchlist性能非线性退化', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: 'Web Worker+虚拟滚动' });

  const signOffRequired: string[] = [];
  if (overallVerdict !== 'SHIP') signOffRequired.push('Owner签署发布决定');
  if (riskMatrix.length > 0) signOffRequired.push('Owner确认风险矩阵');

  return {
    version: 'v3.0.0',
    timestamp: Date.now(),
    sections,
    overallScore: Math.round(avgScore),
    overallVerdict,
    revenueProjection: revenue,
    riskMatrix,
    signOffRequired,
  };
}

export default v300FinalReport;
