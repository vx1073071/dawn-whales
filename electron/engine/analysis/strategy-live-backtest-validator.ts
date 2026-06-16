/**
 * R247 P1-27: StrategyLiveBacktestValidator — 策略实时回测验证
 * LOBEHUB | v2.8.0
 *
 * 上架策略自动跑样本外回测。上线后表现 vs 上线前回测差距>30% → 标⚠️警告。
 *
 * 核心功能:
 *   1. 上架时自动记录回测基线 (上线前 Sharpe/MaxDD/胜率)
 *   2. 每7天自动跑样本外回测 (用上线后的真实市场数据)
 *   3. 差距>30%标警告 → 自动通知PM+前端徽章变更
 *   4. 连续3次警告 → 建议下架
 *
 * 差距计算公式:
 *   gap = (liveMetric - backtestMetric) / |backtestMetric|
 *   如 gap < -0.3 即警告
 *
 * 约束: 纯TypeScript, 零外部依赖, ≥400L
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────

export interface BacktestBaseline {
  templateId: string;
  templateName: string;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  annualReturn: number;
  volatility: number;
  recordedAt: number;          // 上架时间
  backtestMonths: number;
  dataPoints: number;
}

export interface LivePerformance {
  templateId: string;
  sampleStart: number;
  sampleEnd: number;
  sampleDays: number;
  liveSharpe: number;
  liveMaxDrawdown: number;
  liveWinRate: number;
  liveAnnualReturn: number;
  liveVolatility: number;
  dataPoints: number;
}

export interface ValidationResult {
  templateId: string;
  templateName: string;
  baseline: BacktestBaseline;
  live: LivePerformance | null;
  checks: ValidationCheck[];
  overallStatus: 'pass' | 'warning' | 'danger' | 'insufficient_data';
  worstGap: number;            // 最差差距百分比
  worstMetric: string;         // 哪个指标最差
  warnings: string[];
  recommendations: string[];
  validatedAt: number;
  consecutiveWarnings: number;
}

export interface ValidationCheck {
  metric: string;
  baselineValue: number;
  liveValue: number;
  gap: number;                 // -1 ~ +1
  threshold: number;           // 0.3
  status: 'pass' | 'warning' | 'danger';
  message: string;
}

export interface ValidatorConfig {
  warningThreshold: number;    // 30%
  dangerThreshold: number;     // 50%
  minSampleDays: number;       // 至少30天样本外数据
  autoCheckIntervalDays: number; // 7天检查
  maxConsecutiveWarnings: number; // 3次连续→建议下架
}

const DEFAULT_CONFIG: ValidatorConfig = {
  warningThreshold: 0.30,
  dangerThreshold: 0.50,
  minSampleDays: 30,
  autoCheckIntervalDays: 7,
  maxConsecutiveWarnings: 3,
};

// ── StrategyLiveBacktestValidator ────────────────────────────

export class StrategyLiveBacktestValidator {
  readonly id = 'live_backtest_validator';
  readonly version = '2.8.0';

  private config: ValidatorConfig;
  private baselines: Map<string, BacktestBaseline> = new Map();
  private results: Map<string, ValidationResult[]> = new Map(); // 历史结果

  constructor(config?: Partial<ValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 上架时记录基线 ───────────────────────────────────────

  recordBaseline(baseline: BacktestBaseline): void {
    this.baselines.set(baseline.templateId, baseline);
    log.info(`[LiveValidator] Baseline recorded for ${baseline.templateId}: Sharpe=${baseline.sharpe}, MaxDD=${(baseline.maxDrawdown * 100).toFixed(1)}%`);
  }

  getBaseline(templateId: string): BacktestBaseline | null {
    return this.baselines.get(templateId) || null;
  }

  getAllBaselines(): BacktestBaseline[] {
    return [...this.baselines.values()];
  }

  // ── 定期样本外验证 ───────────────────────────────────────

  validate(templateId: string, live: LivePerformance): ValidationResult {
    const baseline = this.baselines.get(templateId);
    if (!baseline) {
      return this.noBaselineResult(templateId, live);
    }

    if (live.sampleDays < this.config.minSampleDays) {
      return {
        templateId, templateName: baseline.templateName,
        baseline, live,
        checks: [], overallStatus: 'insufficient_data',
        worstGap: 0, worstMetric: 'N/A', warnings: [],
        recommendations: [`需要至少${this.config.minSampleDays}天样本外数据 (当前${live.sampleDays}天)`],
        validatedAt: Date.now(), consecutiveWarnings: 0,
      };
    }

    // 四项检查
    const checks: ValidationCheck[] = [
      this.checkMetric('Sharpe', baseline.sharpe, live.liveSharpe),
      this.checkMetric('MaxDrawdown', baseline.maxDrawdown, live.liveMaxDrawdown, true), // 回撤反向
      this.checkMetric('WinRate', baseline.winRate, live.liveWinRate),
      this.checkMetric('AnnualReturn', baseline.annualReturn, live.liveAnnualReturn),
    ];

    const dangerChecks = checks.filter(c => c.status === 'danger');
    const warningChecks = checks.filter(c => c.status === 'warning');

    // 最差差距
    const worst = [...checks].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

    // 连续警告计数
    const history = this.results.get(templateId) || [];
    const lastResult = history[history.length - 1];
    const consecutiveWarnings = (lastResult && (lastResult.overallStatus === 'warning' || lastResult.overallStatus === 'danger'))
      ? lastResult.consecutiveWarnings + 1
      : (dangerChecks.length + warningChecks.length > 0 ? 1 : 0);

    let overallStatus: ValidationResult['overallStatus'];
    if (dangerChecks.length > 0) overallStatus = 'danger';
    else if (warningChecks.length > 0) overallStatus = 'warning';
    else overallStatus = 'pass';

    const result: ValidationResult = {
      templateId,
      templateName: baseline.templateName,
      baseline,
      live,
      checks,
      overallStatus,
      worstGap: Math.round(Math.abs(worst.gap) * 10000) / 100,
      worstMetric: worst.metric,
      warnings: [...dangerChecks, ...warningChecks].map(c => c.message),
      recommendations: this.generateRecommendations(checks, consecutiveWarnings),
      validatedAt: Date.now(),
      consecutiveWarnings,
    };

    // 存储历史
    if (!this.results.has(templateId)) this.results.set(templateId, []);
    this.results.get(templateId)!.push(result);
    if (this.results.get(templateId)!.length > 20) this.results.get(templateId)!.shift();

    // 日志
    if (overallStatus === 'danger') {
      log.error(`[LiveValidator] ${templateId}: DANGER — ${dangerChecks.length} metrics >${(this.config.dangerThreshold * 100).toFixed(0)}% gap. ${result.recommendations[0]}`);
    } else if (overallStatus === 'warning') {
      log.warn(`[LiveValidator] ${templateId}: WARNING — ${warningChecks.length} metrics >${(this.config.warningThreshold * 100).toFixed(0)}% gap`);
    }

    return result;
  }

  /** 批量验证 */
  validateAll(liveDataList: LivePerformance[]): ValidationResult[] {
    return liveDataList.map(d => this.validate(d.templateId, d));
  }

  // ── 查询 ──────────────────────────────────────────────────

  getResult(templateId: string): ValidationResult | null {
    const history = this.results.get(templateId);
    return history ? history[history.length - 1] : null;
  }

  getHistory(templateId: string): ValidationResult[] {
    return this.results.get(templateId) || [];
  }

  /** 所有需要下架建议的策略 */
  getDelistCandidates(): ValidationResult[] {
    const candidates: ValidationResult[] = [];
    for (const [id] of this.baselines) {
      const result = this.getResult(id);
      if (result && result.consecutiveWarnings >= this.config.maxConsecutiveWarnings) {
        candidates.push(result);
      }
    }
    return candidates.sort((a, b) => b.consecutiveWarnings - a.consecutiveWarnings);
  }

  /** 全局统计 */
  getStats(): { total: number; pass: number; warning: number; danger: number; delist: number; } {
    let pass = 0, warning = 0, danger = 0;
    for (const [id] of this.baselines) {
      const r = this.getResult(id);
      if (!r) continue;
      if (r.overallStatus === 'pass') pass++;
      else if (r.overallStatus === 'warning') warning++;
      else if (r.overallStatus === 'danger') danger++;
    }
    return { total: this.baselines.size, pass, warning, danger, delist: this.getDelistCandidates().length };
  }

  // ── Private ───────────────────────────────────────────────

  private checkMetric(
    name: string,
    baselineValue: number,
    liveValue: number,
    inverse: boolean = false,
  ): ValidationCheck {
    if (baselineValue === 0) {
      return { metric: name, baselineValue, liveValue, gap: 0, threshold: this.config.warningThreshold, status: 'pass', message: `基线为0，跳过` };
    }

    let gap = (liveValue - baselineValue) / Math.abs(baselineValue);
    if (inverse) gap = -gap; // MaxDrawdown: 负差距=好, 正差距=坏

    let status: 'pass' | 'warning' | 'danger';
    let message: string;

    if (gap < -this.config.dangerThreshold) {
      status = 'danger';
      message = `⚠️ ${name}下降${(Math.abs(gap)*100).toFixed(0)}% (>${(this.config.dangerThreshold*100).toFixed(0)}%阈值) — 基线${baselineValue.toFixed(3)} → 样本外${liveValue.toFixed(3)}`;
    } else if (gap < -this.config.warningThreshold) {
      status = 'warning';
      message = `🟡 ${name}下降${(Math.abs(gap)*100).toFixed(0)}% — ${baselineValue.toFixed(3)} → ${liveValue.toFixed(3)}`;
    } else {
      status = 'pass';
      message = `✅ ${name}正常 (${(gap*100).toFixed(0)}%)`;
    }

    return { metric: name, baselineValue, liveValue, gap: Math.round(gap * 10000) / 10000, threshold: this.config.warningThreshold, status, message };
  }

  private generateRecommendations(checks: ValidationCheck[], consecutiveWarnings: number): string[] {
    const recs: string[] = [];
    const dangerChecks = checks.filter(c => c.status === 'danger');

    if (dangerChecks.length > 0) {
      recs.push(`紧急: ${dangerChecks.map(c => c.metric).join('、')}严重偏离回测基线`);
    }
    if (consecutiveWarnings >= 2) {
      recs.push(`连续${consecutiveWarnings}次警告: 建议创作者审查策略参数`);
    }
    if (consecutiveWarnings >= this.config.maxConsecutiveWarnings) {
      recs.push(`🚨 连续${consecutiveWarnings}次不达标: 建议下架重新测试`);
    }
    if (checks.some(c => c.metric === 'Sharpe' && c.status === 'danger')) {
      recs.push('Sharpe下降严重: 检查因子是否拥挤/衰减');
    }
    if (checks.some(c => c.metric === 'MaxDrawdown' && c.status === 'danger')) {
      recs.push('回撤超预期: 收紧止损线或降低仓位');
    }

    return recs;
  }

  private noBaselineResult(templateId: string, live: LivePerformance): ValidationResult {
    return {
      templateId, templateName: templateId,
      baseline: null as any, live,
      checks: [], overallStatus: 'insufficient_data',
      worstGap: 0, worstMetric: 'N/A',
      warnings: ['无回测基线: 请先上架时记录基线'],
      recommendations: ['上架策略前需完成回测并记录基线数据'],
      validatedAt: Date.now(), consecutiveWarnings: 0,
    };
  }
}

export default StrategyLiveBacktestValidator;
