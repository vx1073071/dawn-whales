// ══ R260 LOBEHUB P3: v2.9.7数据分析终验 ══
// Final Data Audit — QUANT MOO v2.9.7 发布前的终极数据分析验证
//
// 验证维度:
//   1. AI功能收益模型验证 (7功能×定价×CTR×转化)
//   2. 因子系统稳定性 (320因子→30-50有效→衰减率)
//   3. 推送效果全量 (个性化vs通用 CTR/收入/留存)
//   4. 策略评级分布 (A/B/C/D/F 合理性)
//   5. 市场覆盖数据完整性

export interface FinalAuditResult {
  timestamp: number;
  version: string;         // v2.9.7
  overall: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
  sections: Array<{
    name: string;
    status: 'PASS' | 'WARNING' | 'FAIL';
    details: string;
    metrics: Record<string, number | string>;
  }>;
  redFlags: string[];
  greenFlags: string[];
  releaseRecommendation: 'GO' | 'GO_WITH_CAUTION' | 'NO_GO';
  signOffRequired: string[];  // 需要Owner签字的项
}

// ═══════════════════ 收益模型验证 ═══════════════════

export interface RevenueModelInput {
  featureId: string;
  featureName: string;
  price: number;
  impressions: number;
  clicks: number;
  purchases: number;
  repeatPurchases: number;
  revenue: number;
  userRating?: number;    // 1-5 用户满意度
}

export function auditRevenueModel(inputs: RevenueModelInput[]): {
  status: 'PASS' | 'WARNING' | 'FAIL';
  details: string;
  metrics: Record<string, number | string>;
  flags: string[];
} {
  const flags: string[] = [];
  const metrics: Record<string, number | string> = {};

  const totalRevenue = inputs.reduce((s, r) => s + r.revenue, 0);
  const totalPurchases = inputs.reduce((s, r) => s + r.purchases + r.repeatPurchases, 0);
  const totalImpressions = inputs.reduce((s, r) => s + r.impressions, 0);
  const avgCTR = totalImpressions > 0 ? inputs.reduce((s, r) => s + r.clicks / r.impressions, 0) / inputs.length : 0;
  const avgCVR = inputs.reduce((s, r) => s + (r.clicks > 0 ? r.purchases / r.clicks : 0), 0) / inputs.length;

  metrics.totalRevenue = totalRevenue.toFixed(2);
  metrics.totalPurchases = totalPurchases;
  metrics.avgCTR = (avgCTR * 100).toFixed(1) + '%';
  metrics.avgCVR = (avgCVR * 100).toFixed(1) + '%';

  // 检查：是否有零收入功能
  const zeroRevenue = inputs.filter(r => r.revenue === 0 && r.impressions > 0);
  if (zeroRevenue.length > 0) flags.push(`⚠️ ${zeroRevenue.map(r => r.featureName).join('、')}零收入——需要重新评估`);

  // 检查：CTR是否合理（低于1%=异常）
  const lowCTR = inputs.filter(r => r.impressions > 100 && r.clicks / r.impressions < 0.01);
  if (lowCTR.length > 0) flags.push(`⚠️ 低CTR(<1%): ${lowCTR.map(r => r.featureName).join('、')}`);

  // 检查：复购率
  const repeatRate = inputs.filter(r => r.purchases > 0 && r.repeatPurchases / r.purchases > 0.3);
  if (repeatRate.length > 0) flags.push(`✅ 高复购率: ${repeatRate.map(r => r.featureName).join('、')}`);

  let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
  if (totalRevenue === 0) status = 'FAIL';
  else if (zeroRevenue.length > inputs.length * 0.5 || lowCTR.length > 2) status = 'WARNING';

  return {
    status,
    details: `总收入$${totalRevenue.toFixed(2)}, ${totalPurchases}次购买, 平均CTR ${(avgCTR * 100).toFixed(1)}%, 平均CVR ${(avgCVR * 100).toFixed(1)}%`,
    metrics, flags,
  };
}

// ═══════════════════ 因子系统审计 ═══════════════════

export function auditFactorSystem(
  totalFactors: number,
  effectiveFactors: number,
  decayRate: number,  // 每期衰减比例
  avgIC: number,
  icStdDev: number,
): { status: 'PASS' | 'WARNING' | 'FAIL'; details: string; flags: string[] } {
  const flags: string[] = [];
  const effectiveRate = effectiveFactors / totalFactors;

  if (effectiveRate < 0.1) flags.push(`❌ 有效因子率仅${(effectiveRate * 100).toFixed(1)}%——320因子中仅${effectiveFactors}个有效`);
  else if (effectiveRate < 0.2) flags.push(`⚠️ 有效因子率${(effectiveRate * 100).toFixed(1)}%——建议淘汰无效因子`);
  else flags.push(`✅ 有效因子率${(effectiveRate * 100).toFixed(1)}%健康`);

  if (decayRate > 0.15) flags.push(`⚠️ 因子衰减率${(decayRate * 100).toFixed(1)}%/期——信号不稳定`);
  else flags.push(`✅ 因子衰减率${(decayRate * 100).toFixed(1)}%/期健康`);

  if (Math.abs(avgIC) < 0.02) flags.push('⚠️ 平均|IC|过低——多数因子接近随机');
  if (icStdDev > 0.05) flags.push('⚠️ IC波动大——因子时好时坏');

  let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
  if (effectiveRate < 0.05) status = 'FAIL';
  else if (effectiveRate < 0.1 || decayRate > 0.15 || Math.abs(avgIC) < 0.02) status = 'WARNING';

  return {
    status,
    details: `${totalFactors}总→${effectiveFactors}有效(${(effectiveRate*100).toFixed(1)}%), 衰减${(decayRate*100).toFixed(1)}%/期, |IC|=${avgIC.toFixed(3)}±${icStdDev.toFixed(3)}`,
    flags,
  };
}

// ═══════════════════ 全量终验 ═══════════════════

export function generateFinalAudit(
  revenueInputs: RevenueModelInput[],
  factorAudit: { totalFactors: number; effectiveFactors: number; decayRate: number; avgIC: number; icStdDev: number },
  pushCTR: number,
  personalizedLift: number,
  marketCoverage: number,   // 覆盖市场数/29
  tscErrors: number,
  testPassRate: number,     // 0-1
): FinalAuditResult {
  const sections: FinalAuditResult['sections'] = [];
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  // Revenue
  const revAudit = auditRevenueModel(revenueInputs);
  sections.push({ name: 'AI收益模型', status: revAudit.status, details: revAudit.details, metrics: revAudit.metrics });
  redFlags.push(...revAudit.flags.filter(f => f.startsWith('⚠️') || f.startsWith('❌')));
  greenFlags.push(...revAudit.flags.filter(f => f.startsWith('✅')));

  // Factor
  const facAudit = auditFactorSystem(factorAudit.totalFactors, factorAudit.effectiveFactors, factorAudit.decayRate, factorAudit.avgIC, factorAudit.icStdDev);
  sections.push({ name: '因子系统', status: facAudit.status, details: facAudit.details, metrics: { totalFactors: factorAudit.totalFactors, effectiveFactors: factorAudit.effectiveFactors, avgIC: factorAudit.avgIC } });
  redFlags.push(...facAudit.flags.filter(f => f.startsWith('⚠️') || f.startsWith('❌')));
  greenFlags.push(...facAudit.flags.filter(f => f.startsWith('✅')));

  // Push
  const pushStatus: 'PASS' | 'WARNING' | 'FAIL' = pushCTR > 0.03 ? 'PASS' : pushCTR > 0.01 ? 'WARNING' : 'FAIL';
  sections.push({ name: '推送系统', status: pushStatus, details: `CTR ${(pushCTR*100).toFixed(1)}%, 个性化相对通用提升${(personalizedLift*100).toFixed(1)}%`, metrics: { pushCTR: pushCTR, lift: personalizedLift } });
  if (personalizedLift > 0.2) greenFlags.push(`✅ 个性化推送效果显著(+${(personalizedLift * 100).toFixed(0)}%)`);
  else if (personalizedLift < 0) redFlags.push('⚠️ 个性化推送效果不如通用——算法可能需要调整');

  // Market
  const marketStatus = marketCoverage >= 29 / 29 ? 'PASS' : marketCoverage >= 20 / 29 ? 'WARNING' : 'FAIL';
  sections.push({ name: '市场覆盖', status: marketStatus, details: `${marketCoverage}/29市场覆盖`, metrics: { coverage: marketCoverage } });
  if (marketCoverage >= 29) greenFlags.push('✅ 29个市场全覆盖');
  else redFlags.push(`⚠️ 仅覆盖${marketCoverage}/29市场`);

  // Code quality
  const codeStatus = tscErrors === 0 && testPassRate >= 0.95 ? 'PASS' : 'WARNING';
  sections.push({ name: '代码质量', status: codeStatus, details: `TSC=${tscErrors}errors, 测试通过率=${(testPassRate*100).toFixed(1)}%`, metrics: { tscErrors, testPassRate } });

  // Overall
  const failCount = sections.filter(s => s.status === 'FAIL').length;
  const warnCount = sections.filter(s => s.status === 'WARNING').length;
  const overall = failCount > 0 ? 'FAIL' : warnCount > 1 ? 'PASS_WITH_WARNINGS' : 'PASS';

  const releaseRecommendation: FinalAuditResult['releaseRecommendation'] =
    overall === 'FAIL' ? 'NO_GO' :
    overall === 'PASS_WITH_WARNINGS' ? 'GO_WITH_CAUTION' :
    'GO';

  const signOffRequired: string[] = [];
  if (releaseRecommendation === 'GO_WITH_CAUTION') signOffRequired.push('Owner确认警告项可接受');

  return {
    timestamp: Date.now(),
    version: 'v2.9.7',
    overall,
    sections,
    redFlags,
    greenFlags,
    releaseRecommendation,
    signOffRequired,
  };
}

export default FinalAuditResult;
