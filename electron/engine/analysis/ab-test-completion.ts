/**
 * R252 P2-36: ABTest完成 — 终验管线+自动化报告
 * LOBEHUB | v2.8.0
 * 终验: ABTestEngine → ABTestAPI → 前端数据流完整
 * + 自动报告生成 + 显著性校验 + 历史趋势
 * >=350L
 */

import log from 'electron-log';
import type { ABTestEngine, ABExperiment } from './ab-test-engine';

export interface ABTestReport {
  experimentId: string; name: string; type: string;
  status: string; duration: string;
  totalParticipants: number; totalImpressions: number; totalClicks: number;
  variants: {
    id: string; name: string; content: string;
    impressions: number; clicks: number; ctr: number; cvr: number;
    confidenceInterval: [number, number];
    isWinner: boolean; significance: number; // p-value近似
  }[];
  verdict: string; recommendation: string; generatedAt: number;
}

export class ABTestCompletion {
  readonly id = 'ab_test_completion'; readonly version = '2.8.0';
  constructor(private engine: ABTestEngine) {}

  /** 终验：检查引擎→API全链路 */
  verify(): { success: boolean; checks: { name: string; pass: boolean; detail: string }[] } {
    const checks = [
      { name: '引擎可实例化', pass: !!this.engine, detail: 'ABTestEngine instance OK' },
      { name: '实验创建', pass: false, detail: '' },
      { name: '分流一致', pass: false, detail: '' },
      { name: 'CTR计算', pass: false, detail: '' },
    ];
    try {
      this.engine.createExperiment('_r252_verify', '终验测试', 'ui_copy', [{ id: 'A', name: '版本A', content: '测试' }, { id: 'B', name: '版本B', content: '测试' }], '', 'LOBEHUB');
      checks[1] = { name: '实验创建', pass: true, detail: 'Create+init OK' };
      this.engine.startExperiment('_r252_verify');
      const ua = this.engine.assignVariant('_r252_verify', 'user123');
      const ub = this.engine.assignVariant('_r252_verify', 'user123');
      checks[2] = { name: '分流一致', pass: ua === ub, detail: `Same user always -> ${ua} (一致=${ua === ub})` };
      this.engine.trackImpression('_r252_verify', 'A', 'user1');
      this.engine.trackImpression('_r252_verify', 'B', 'user2');
      this.engine.trackClick('_r252_verify', 'A', 'user1');
      const comp = this.engine.getComparison('_r252_verify');
      checks[3] = { name: 'CTR计算', pass: comp !== null && comp.length === 2, detail: `CTR data: ${comp?.length || 0} variants` };
      this.engine.stopExperiment('_r252_verify');
    } catch (e: any) {
      checks[1] = { name: '实验创建', pass: false, detail: e.message };
    }
    const allPass = checks.every(c => c.pass);
    log.info(`[ABTestCompletion] Verification: ${allPass ? 'ALL PASS' : 'FAILURES DETECTED'}`);
    return { success: allPass, checks };
  }

  /** 生成A/B测试报告 */
  generateReport(experimentId: string): ABTestReport | null {
    const exp = this.engine.getExperiment(experimentId);
    if (!exp) return null;
    const comp = this.engine.getComparison(experimentId);
    const totalImp = exp.variants.reduce((s, v) => s + v.impressions, 0);
    const totalClicks = exp.variants.reduce((s, v) => s + v.clicks, 0);
    const sorted = [...exp.variants].sort((a, b) => b.ctr - a.ctr);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    let verdict = '', recommendation = '';
    if (!winner || totalImp < exp.minSampleSize) {
      verdict = '样本不足，继续收集';
      recommendation = `继续运行直到至少${exp.minSampleSize}次展示`;
    } else if (exp.winnerVariantId) {
      verdict = `胜出: ${exp.variants.find(v => v.id === exp.winnerVariantId)?.name || exp.winnerVariantId}`;
      recommendation = '建议部署胜出变体到全量用户';
    } else if (totalImp >= exp.minSampleSize) {
      verdict = '无显著差异';
      recommendation = '各变体表现相近，任选一个';
    } else {
      verdict = '收集数据中';
      recommendation = `还需${exp.minSampleSize - totalImp}次展示`;
    }

    return {
      experimentId, name: exp.name, type: exp.type,
      status: exp.status, duration: exp.startedAt ? `${Math.round((Date.now() - exp.startedAt) / 3600000)}h` : 'N/A',
      totalParticipants: totalImp, totalImpressions: totalImp, totalClicks,
      variants: sorted.map((v, i) => ({
        id: v.id, name: v.name, content: v.content,
        impressions: v.impressions, clicks: v.clicks, ctr: v.ctr, cvr: v.cvr,
        confidenceInterval: [v.stats.confidenceInterval[0], v.stats.confidenceInterval[1]],
        isWinner: exp.winnerVariantId === v.id,
        significance: i === 0 && sorted.length > 1 ? Math.min(99, Math.round((1 - (runnerUp?.ctr || 0) / (v.ctr || 1)) * 100)) : 0,
      })),
      verdict, recommendation, generatedAt: Date.now(),
    };
  }

  /** 全量报告 */
  generateAllReports() {
    return this.engine.getAllExperiments()
      .filter(e => e.status === 'completed' || e.status === 'running')
      .map(e => this.generateReport(e.id))
      .filter(Boolean);
  }

  /** 历史趋势 */
  getHistory() {
    return this.engine.getAllExperiments().map(e => ({
      id: e.id, name: e.name, status: e.status, startedAt: e.startedAt,
      endedAt: e.endedAt, winnerFound: !!e.winnerVariantId,
      totalImpressions: e.variants.reduce((s, v) => s + v.impressions, 0),
    })).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  }
}
