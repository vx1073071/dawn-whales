// ══ R264 LOBEHUB P3: v3.0.0 终极发布终报 ══
// v3.0.0 Ultimate Release Report — 所有数据就绪，发布决策
import { DataQualityV2Report } from './data-quality-v2-r263';
import { VoiceBenchmarkReport } from './voice-benchmark-r264';
import { ReplayUXReport } from './replay-ux-r264';
import { projectRevenue } from './v300-final-report-r262';

export interface UltimateReleaseReport {
  version: string;          // v3.0.0
  timestamp: number;
  sections: Array<{
    name: string;
    score: number;
    status: 'PASS' | 'WARNING' | 'FAIL';
    details: string;
  }>;
  overallScore: number;
  releaseDecision: 'GO' | 'GO_WITH_CAUTION' | 'NO_GO';
  revenueForecast: ReturnType<typeof projectRevenue>;
  highlights: string[];
  risks: string[];
  signOffItems: string[];
}

export function generateUltimateReport(
  dataQualityV2: DataQualityV2Report,
  voiceBenchmark: VoiceBenchmarkReport,
  replayUX: ReplayUXReport,
  dauEstimate: number = 1000,
): UltimateReleaseReport {
  const sections: UltimateReleaseReport['sections'] = [
    {
      name: '行情数据质量V2', score: dataQualityV2.score,
      status: dataQualityV2.overall,
      details: `YahooLive+BinanceLive双源复合, 评分${dataQualityV2.score}/100, ${dataQualityV2.greenFlags.length}绿旗/${dataQualityV2.redFlags.length}红旗`,
    },
    {
      name: '语音播报', score: voiceBenchmark.overallScore,
      status: voiceBenchmark.overallScore >= 85 ? 'PASS' : voiceBenchmark.overallScore >= 65 ? 'WARNING' : 'FAIL',
      details: `${voiceBenchmark.totalSamples}样本, 平均${voiceBenchmark.avgDurationMs}ms, ${voiceBenchmark.latencyStatus}`,
    },
    {
      name: '行情回放', score: replayUX.overallEngagementScore,
      status: replayUX.overallEngagementScore >= 80 ? 'PASS' : replayUX.overallEngagementScore >= 60 ? 'WARNING' : 'FAIL',
      details: `${replayUX.totalSessions}次回放, 完成率${replayUX.overallCompletionRate}%, ${replayUX.latencyStatus}`,
    },
  ];

  const avgScore = sections.reduce((s, sec) => s + sec.score, 0) / sections.length;
  const failCount = sections.filter(s => s.status === 'FAIL').length;
  const warnCount = sections.filter(s => s.status === 'WARNING').length;

  let releaseDecision: UltimateReleaseReport['releaseDecision'];
  if (failCount > 0) releaseDecision = 'NO_GO';
  else if (warnCount > 0) releaseDecision = 'GO_WITH_CAUTION';
  else releaseDecision = 'GO';

  const revenue = projectRevenue(0.05, 0.06, 1.80, dauEstimate, 3);

  const highlights: string[] = [];
  if (dataQualityV2.score >= 80) highlights.push('✅ 行情数据质量达标');
  if (voiceBenchmark.overallScore >= 80) highlights.push('✅ 语音播报质量优秀');
  if (replayUX.overallCompletionRate >= 70) highlights.push('✅ 回放完成率高');
  highlights.push(`💰 预估月收入$${revenue.baseCase}(基础)/$${revenue.bestCase}(乐观)`);

  const risks: string[] = [];
  if (dataQualityV2.overall !== 'PASS') risks.push('⚠️ 行情数据质量需持续监控');
  if (voiceBenchmark.latencyStatus !== 'FAST') risks.push('⚠️ 语音延迟可能影响用户体验');
  if (replayUX.overallCompletionRate < 60) risks.push('⚠️ 回放功能完成率偏低');

  const signOffItems: string[] = [];
  if (releaseDecision !== 'GO') signOffItems.push('Owner签署发布决定');
  if (risks.length > 0) signOffItems.push('Owner确认风险项可接受');

  return {
    version: 'v3.0.0',
    timestamp: Date.now(),
    sections,
    overallScore: Math.round(avgScore),
    releaseDecision,
    revenueForecast: revenue,
    highlights,
    risks,
    signOffItems,
  };
}

export default UltimateReleaseReport;
