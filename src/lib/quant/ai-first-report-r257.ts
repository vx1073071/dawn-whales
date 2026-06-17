// ══ R257 LOBEHUB QU-09: AI使用数据首期报告 ══
// AI Usage First Report — 7功能CTR/转化/复购/ARPU全量统计
// "第一期数据出来了。用户的钱包在说什么？"

import {
  AIUsageEvent, generateAnalyticsSnapshot, analyzeUserLifecycle,
} from './ai-usage-analytics-r254';

export interface FirstReport {
  reportId: string;
  generatedAt: number;
  period: { start: number; end: number };
  totalUsers: number;
  totalRevenue: number;
  snapshot: ReturnType<typeof generateAnalyticsSnapshot>;
  lifecycle: ReturnType<typeof analyzeUserLifecycle>;
  highlights: string[];
  actionItems: string[];
}

export function generateFirstReport(
  events: AIUsageEvent[],
  start: number,
  end: number,
): FirstReport {
  const snapshot = generateAnalyticsSnapshot(events, start, end);
  const userIds = [...new Set(events.map(e => e.userId))];
  const lifecycle = analyzeUserLifecycle(userIds, events, Date.now());

  const highlights: string[] = [];
  const actionItems: string[] = [];

  // Revenue highlight
  const top = snapshot.features[0];
  highlights.push(`🏆 最高收入功能: ${top.emoji} ${top.label} ($${top.revenue.toFixed(2)})`);

  // Conversion highlight
  const bestCVR = [...snapshot.features].sort((a, b) => b.cvr - a.cvr)[0];
  if (bestCVR.cvr > 0.1) highlights.push(`📈 最高转化率: ${bestCVR.label} (${(bestCVR.cvr * 100).toFixed(1)}%)`);

  // Purchase highlight
  const totalPurchases = snapshot.features.reduce((s, f) => s + f.purchases + f.repeatPurchases, 0);
  highlights.push(`🛒 总购买次数: ${totalPurchases}`);

  // Retention highlight
  const repeatFeatures = snapshot.features.filter(f => f.repeatRate > 0);
  if (repeatFeatures.length > 0) {
    const bestRet = [...repeatFeatures].sort((a, b) => b.repeatRate - a.repeatRate)[0];
    highlights.push(`🔁 最高复购率: ${bestRet.label} (${(bestRet.repeatRate * 100).toFixed(0)}%)`);
  }

  // Revenue insight
  const topFeature = snapshot.features[0];
  if (topFeature.revenue > 0) {
    highlights.push(`💡 7个功能中${snapshot.features.filter(f => f.revenue > 0).length}个已有收入`);
  }

  // Action items
  const zeroRev = snapshot.features.filter(f => f.revenue === 0);
  for (const f of zeroRev) {
    actionItems.push(`⚠️ ${f.label}零收入——需评估：价格问题还是内容问题？`);
  }

  const lowCVR = snapshot.features.filter(f => f.cvr < 0.05 && f.clicks > 0);
  if (lowCVR.length > 0) {
    actionItems.push(`📉 ${lowCVR.map(f => f.label).join('、')} 转化率<5%——考虑降低展示门槛或优化购买流程`);
  }

  const churnedPct = lifecycle.find(s => s.stage === 'CHURNED')?.pct || 0;
  if (churnedPct > 30) {
    actionItems.push(`⚠️ 流失率${churnedPct.toFixed(0)}%——建议启动"7天未活跃"召回推送`);
  }

  // Default action if no issues
  if (actionItems.length === 0) {
    actionItems.push('✅ 所有功能运行良好，继续监控');
  }

  return {
    reportId: `AI-REPORT-${Date.now()}`,
    generatedAt: Date.now(),
    period: { start, end },
    totalUsers: userIds.length,
    totalRevenue: snapshot.totalRevenue,
    snapshot,
    lifecycle,
    highlights,
    actionItems,
  };
}

export function formatFirstReportAsText(report: FirstReport): string {
  const lines: string[] = [
    `# 🐋 QUANT MOO AI使用首期报告`,
    '',
    `📅 ${new Date(report.period.start).toLocaleDateString('zh-CN')} — ${new Date(report.period.end).toLocaleDateString('zh-CN')}`,
    `👥 总用户: ${report.totalUsers}`,
    `💰 总收入: $${report.totalRevenue.toFixed(2)}`,
    '',
    `## 📊 7大AI功能表现`,
    '| 功能 | 展示 | 点击 | CTR | 购买 | 复购 | 收入 | 复购率 |',
    '|------|------|------|-----|------|------|------|--------|',
    ...report.snapshot.features.map(f =>
      `| ${f.emoji} ${f.label} | ${f.impressions} | ${f.clicks} | ${(f.ctr * 100).toFixed(1)}% | ${f.purchases} | ${f.repeatPurchases} | $${f.revenue.toFixed(2)} | ${(f.repeatRate * 100).toFixed(0)}% |`
    ),
    '',
    `## 🎯 亮点`,
    ...report.highlights.map(h => `- ${h}`),
    '',
    `## ⚡ 行动项`,
    ...report.actionItems.map(a => `- ${a}`),
    '',
  ];
  return lines.join('\n');
}

export default FirstReport;
