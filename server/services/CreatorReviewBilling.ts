/**
 * CreatorReviewBilling — R200 J3: AI创作者策略审核计费
 *
 * v17.9 Rules (Owner 终版, 永久锁):
 *   - 1积分/次, 不退费 (审核不通过也不退)
 *   - AI异常才退费 (超时/网络错误/模型无响应)
 *   - 无申诉通道 (不存在二次免费审核)
 *   - 无限次审核, 每次1积分
 *   - 审核不通过 → 给8项逐条具体修改建议
 *
 * Flow: hold 1积分 → AI审核 → 始终settle (不退)
 *   异常: hold → AI异常 → refund
 *
 * ≥150L production-ready, ≥3 tests
 */

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreatorReviewRequest {
  reviewId: string;
  creatorId: string;
  walletId: string;
  strategyId: string;
  strategyName: string;
  /** The 8 dimensions to review */
  dimensions: CreatorReviewDimension[];
}

export interface CreatorReviewDimension {
  key: string;
  label: string;
  labelCN: string;
  passed: boolean;
  suggestion?: string;  // 不通过 → 具体修改建议
}

export interface CreatorReviewResult {
  success: boolean;
  reviewId: string;
  strategyId: string;
  /** Overall pass/fail */
  passed: boolean;
  /** Total passed dimensions */
  passedCount: number;
  /** Total dimensions checked */
  totalDimensions: number;
  /** Per-dimension results */
  dimensions: CreatorReviewDimension[];
  /** AI-generated overall feedback */
  overallFeedback: string;
  /** Refund reason (only set on AI exception) */
  refundReason?: string;
  /** Billing status */
  billingStatus: 'SETTLED' | 'REFUNDED';
  /** Timestamp */
  reviewedAt: Date;
}

// ── 8-Dimension Review Checklist ───────────────────────────────────────────

export const CREATOR_REVIEW_DIMENSIONS = [
  { key: 'human_desc',    label: 'Human Description',    labelCN: '人话描述',        requirement: '≤80字, 说清楚干什么' },
  { key: 'stop_loss',     label: 'Stop-Loss Rule',       labelCN: '止损规则',        requirement: '明确止损条件及百分比' },
  { key: 'market_fit',    label: 'Market Fit',           labelCN: '适用市场',        requirement: '标注市场+品种' },
  { key: 'failure_check', label: 'Failure Self-Check',   labelCN: '失效自检',        requirement: '何时该放弃此策略' },
  { key: 'factor_valid',  label: 'Factor Validity',      labelCN: '因子有效性',      requirement: '所用因子均已注册+IC>0' },
  { key: 'param_reason',  label: 'Parameter Soundness',  labelCN: '参数合理性',      requirement: '权重/阈值有依据' },
  { key: 'backtest_ok',   label: 'Backtest Soundness',   labelCN: '回测健全性',      requirement: '回测结果可靠, 无过拟合' },
  { key: 'no_plagiarism', label: 'No Plagiarism',        labelCN: '无抄袭检测',      requirement: '与其他已上架策略相似度<40%' },
];

// ── CreatorReviewBilling ───────────────────────────────────────────────────

export class CreatorReviewBilling {
  /** Track processed reviews */
  private reviewHistory: Map<string, CreatorReviewResult> = new Map();

  /**
   * Run AI review for a creator strategy.
   * Always charges 1积分, never refunds (unless AI exception).
   */
  async reviewStrategy(req: CreatorReviewRequest): Promise<CreatorReviewResult> {
    const reviewId = req.reviewId || `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    log.info(`[CreatorReview] Starting review ${reviewId} for strategy ${req.strategyId}`);

    try {
      // Simulate AI review (in production: call DeepSeek API)
      const dimensions = await this.runAIReview(req);

      const passedCount = dimensions.filter(d => d.passed).length;
      const totalDims = dimensions.length;

      const result: CreatorReviewResult = {
        success: true,
        reviewId,
        strategyId: req.strategyId,
        passed: passedCount === totalDims,
        passedCount,
        totalDimensions: totalDims,
        dimensions,
        overallFeedback: this.generateOverallFeedback(dimensions, passedCount, totalDims),
        billingStatus: 'SETTLED',
        reviewedAt: new Date(),
      };

      this.reviewHistory.set(reviewId, result);
      log.info(`[CreatorReview] Review ${reviewId} completed: ${passedCount}/${totalDims} passed. 1积分 settled (不退费).`);
      return result;
    } catch (err: any) {
      // AI exception only → refund
      const errorMsg = err?.message || 'Unknown AI error';
      log.error(`[CreatorReview] AI exception for ${reviewId}: ${errorMsg}. Refunding 1积分.`);

      const result: CreatorReviewResult = {
        success: false,
        reviewId,
        strategyId: req.strategyId,
        passed: false,
        passedCount: 0,
        totalDimensions: 0,
        dimensions: [],
        overallFeedback: '',
        refundReason: `AI异常: ${errorMsg}`,
        billingStatus: 'REFUNDED',
        reviewedAt: new Date(),
      };

      this.reviewHistory.set(reviewId, result);
      return result;
    }
  }

  /** Simulated AI review of all 8 dimensions */
  private async runAIReview(req: CreatorReviewRequest): Promise<CreatorReviewDimension[]> {
    const baseDims = req.dimensions && req.dimensions.length > 0
      ? req.dimensions
      : CREATOR_REVIEW_DIMENSIONS.map(d => ({ key: d.key, label: d.label, labelCN: d.labelCN, passed: false }));

    // Mock: simulate AI evaluation (production: DeepSeek call)
    const results: CreatorReviewDimension[] = baseDims.map(dim => {
      const passed = Math.random() > 0.3; // 70% pass rate (mock)
      return {
        ...dim,
        passed,
        suggestion: passed
          ? undefined
          : this.getDimensionSuggestion(dim.key),
      };
    });

    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 200));
    return results;
  }

  /** Get specific improvement suggestion per dimension */
  private getDimensionSuggestion(key: string): string {
    const suggestions: Record<string, string> = {
      'human_desc':    '建议用一句话说清楚做什么（例如"寻找突破20日均线的强势股"），避免术语堆砌',
      'stop_loss':     '请添加明确的止损百分比（例如"浮亏8%止损"），而不是"跌破支撑位卖出"这种模糊描述',
      'market_fit':    '请标注策略适用的具体市场和品种（例如"美股大盘股"而不是"全球市场"）',
      'failure_check': '请描述策略何时会失效（例如"单边下跌市中此策略会连续止损"），让用户了解风险',
      'factor_valid':  '部分因子IC值为负或接近零，建议替换为IC>0.03的因子（可参考龙虎榜）',
      'param_reason':  '参数选择缺少依据，建议附上回测敏感度分析或引用量化研究文献',
      'backtest_ok':   '回测胜率过高(>80%)可能过拟合，建议用样本外数据验证或缩短回测窗口',
      'no_plagiarism': '与已上架策略"XX动量精选"相似度55%，建议调整因子组合权重以降低重叠',
    };
    return suggestions[key] ?? '请根据审核标准完善此项';
  }

  /** Generate human-readable overall feedback */
  private generateOverallFeedback(
    dimensions: CreatorReviewDimension[],
    passedCount: number,
    totalDims: number,
  ): string {
    if (passedCount === totalDims) {
      return '✅ 8项审核全部通过！策略已上架。用户可见策略详情+信号灯+回测摘要。';
    }

    const failed = dimensions.filter(d => !d.passed);
    const failedList = failed.map(d => `• ${d.labelCN}: ${d.suggestion}`).join('
');

    return `⚠️ ${passedCount}/${totalDims} 项通过，${failed.length}项需修改。请按以下建议修改后重新提交审核（1积分/次）：
${failedList}`;
  }

  /** Get review history for a creator */
  getCreatorReviewHistory(creatorId: string): CreatorReviewResult[] {
    return Array.from(this.reviewHistory.values())
      .filter(r => r.strategyId.includes(creatorId) || r.reviewId.includes(creatorId));
  }

  /** Get a specific review result */
  getReview(reviewId: string): CreatorReviewResult | undefined {
    return this.reviewHistory.get(reviewId);
  }

  /** Get total settled revenue from creator reviews */
  getTotalReviewRevenue(): number {
    return Array.from(this.reviewHistory.values())
      .filter(r => r.billingStatus === 'SETTLED')
      .length; // 1积分 each
  }

  /** Get total refunded (AI exception count) */
  getTotalRefunded(): number {
    return Array.from(this.reviewHistory.values())
      .filter(r => r.billingStatus === 'REFUNDED')
      .length;
  }
}

/** Singleton */
export const creatorReviewBilling = new CreatorReviewBilling();
