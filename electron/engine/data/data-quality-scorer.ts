/**
 * R255 DQ-03: DataQualityScorer — 数据质量评分引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 * 3级评分(healthy/degraded/critical) + 4源监控 + 降分规则
 * >=350L
 */

export interface SourceQualityInput {
  sourceId: string; name: string;
  latencyMs: number; completeness: number; accuracy: number;
  stalenessMs: number; gapCount: number;
}

export interface SourceQualityScore {
  sourceId: string; name: string;
  score: number; // 0-100
  level: 'healthy' | 'degraded' | 'critical';
  metrics: { label: string; value: string; penalty: number; reason: string }[];
  recommendation: string;
  checkedAt: number;
}

export class DataQualityScorer {
  readonly id = 'data_quality_scorer'; readonly version = '3.0.0';

  /** 单源评分 */
  score(input: SourceQualityInput): SourceQualityScore {
    let score = 100;
    const metrics: SourceQualityScore['metrics'] = [];

    // 延迟惩罚
    if (input.latencyMs > 1000) { score -= 15; metrics.push({ label:'延迟', value:`${input.latencyMs}ms`, penalty:15, reason:'延迟>1s' }); }
    else if (input.latencyMs > 500) { score -= 5; metrics.push({ label:'延迟', value:`${input.latencyMs}ms`, penalty:5, reason:'延迟>500ms' }); }

    // 完整性惩罚
    if (input.completeness < 0.8) { score -= 25; metrics.push({ label:'完整性', value:`${(input.completeness*100).toFixed(0)}%`, penalty:25, reason:'完整性<80%' }); }
    else if (input.completeness < 0.95) { score -= 10; metrics.push({ label:'完整性', value:`${(input.completeness*100).toFixed(0)}%`, penalty:10, reason:'完整性<95%' }); }

    // 准确性惩罚
    if (input.accuracy < 0.95) { score -= 20; metrics.push({ label:'准确性', value:`${(input.accuracy*100).toFixed(1)}%`, penalty:20, reason:'准确性<95%' }); }

    // 陈旧度惩罚
    if (input.stalenessMs > 60000) { score -= 20; metrics.push({ label:'陈度', value:`${Math.round(input.stalenessMs/1000)}s`, penalty:20, reason:'数据>60s' }); }
    else if (input.stalenessMs > 10000) { score -= 8; metrics.push({ label:'陈度', value:`${Math.round(input.stalenessMs/1000)}s`, penalty:8, reason:'数据>10s' }); }

    // 断层惩罚
    if (input.gapCount > 5) { score -= 20; metrics.push({ label:'断层', value:`${input.gapCount}个`, penalty:20, reason:'断层>5' }); }
    else if (input.gapCount > 0) { score -= input.gapCount * 3; metrics.push({ label:'断层', value:`${input.gapCount}个`, penalty:input.gapCount*3, reason:'存在断层' }); }

    score = Math.max(0, Math.min(100, score));

    const level = score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical';
    const recommendation = level === 'healthy' ? '数据质量良好' : level === 'degraded' ? '建议检查数据源配置' : '数据源不可用，立即切换备选';

    return { sourceId: input.sourceId, name: input.name, score, level, metrics, recommendation, checkedAt: Date.now() };
  }

  /** 多源总览: 评级最低/最高/平均 + 整体状态 */
  overview(inputs: SourceQualityInput[]): { scores: SourceQualityScore[]; overallScore: number; overallLevel: string; worstSource: string; } {
    const scores = inputs.map(i => this.score(i));
    const avg = scores.reduce((s, x) => s + x.score, 0) / (scores.length || 1);
    const worst = scores.sort((a, b) => a.score - b.score)[0];
    const criticalCount = scores.filter(s => s.level === 'critical').length;
    const overallLevel = criticalCount > 0 ? 'critical' : avg < 60 ? 'degraded' : 'healthy';
    return { scores, overallScore: Math.round(avg), overallLevel, worstSource: worst?.sourceId || '' };
  }
}
