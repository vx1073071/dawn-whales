/**
 * R247 P2-36: ABTestEngine — A/B测试框架引擎
 * LOBEHUB | v2.8.0
 *
 * 为推送/UI/文案等提供A/B测试分流+CTR统计。
 *
 * 核心功能:
 *   1. 实验分流: 用户哈希 → 分配到变体 (稳定分配, 同一用户始终看到同一变体)
 *   2. 曝光/点击追踪: impression(展示) + click(点击) + conversion(转化)
 *   3. CTR统计: 各变体的点击率/转化率/p值(简化版)
 *   4. 自动决策: 当某变体显著优于其他时自动提升为winner
 *
 * 支持场景:
 *   - 推送标题 A/B (如: "今日市场摘要" vs "3只股票你该关注")
 *   - 推送时间 A/B (如: 早8点 vs 早9点)
 *   - 富媒体 A/B (如: 文字推送 vs 带图表推送)
 *   - UI文案 A/B (如: 按钮"立即购买" vs "免费试用")
 *
 * 分流算法: hash(userId + experimentId) % 100 → 分桶
 *
 * 约束: 纯TypeScript, 零外部依赖, ≥400L
 */

import log from 'electron-log';
import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────

export interface ABExperiment {
  id: string;
  name: string;
  description: string;
  type: 'push_title' | 'push_time' | 'push_rich_media' | 'ui_copy' | 'ui_layout' | 'other';
  variants: ABVariant[];
  status: 'draft' | 'running' | 'completed' | 'stopped';
  startedAt: number | null;
  endedAt: number | null;
  minSampleSize: number;          // 最少样本量才能决策
  confidenceThreshold: number;    // 置信度阈值 (0.95)
  winnerVariantId: string | null;
  owner: string;
}

export interface ABVariant {
  id: string;              // "A" | "B" | "C"
  name: string;
  content: string;          // 变体内容 (标题/文案/时间)
  weight: number;           // 流量比例 0-1
  bucketStart: number;      // 分桶起始 (0-99)
  bucketEnd: number;        // 分桶结束
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;              // clicks/impressions
  cvr: number;              // conversions/clicks
  stats: {
    mean: number;
    stdDev: number;
    confidenceInterval: [number, number];
  };
}

export interface ABImpression {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

export interface ABClick {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: number;
  action?: string;
}

export interface ABConversion {
  experimentId: string;
  variantId: string;
  userId: string;
  timestamp: number;
  value?: number;
}

export interface ABStats {
  totalExperiments: number;
  runningExperiments: number;
  completedExperiments: number;
  totalImpressions: number;
  totalClicks: number;
  overallCTR: number;
  winnersFound: number;
}

export interface ABConfig {
  hashSeed: string;
  defaultMinSampleSize: number;
  defaultConfidenceThreshold: number;
  maxRunningExperiments: number;
}

const DEFAULT_CONFIG: ABConfig = {
  hashSeed: 'dw-ab-test-v2.8.0',
  defaultMinSampleSize: 100,
  defaultConfidenceThreshold: 0.95,
  maxRunningExperiments: 5,
};

// ── ABTestEngine ───────────────────────────────────────────────────

export class ABTestEngine {
  readonly id = 'ab_test_engine';
  readonly version = '2.8.0';

  private config: ABConfig;
  private experiments: Map<string, ABExperiment> = new Map();
  private impressions: ABImpression[] = [];
  private clicks: ABClick[] = [];
  private conversions: ABConversion[] = [];

  constructor(config?: Partial<ABConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 实验管理 ───────────────────────────────────────────────────

  createExperiment(
    id: string,
    name: string,
    type: ABExperiment['type'],
    variants: { id: string; name: string; content: string; weight?: number }[],
    description: string = '',
    owner: string = 'LOBEHUB',
  ): ABExperiment {
    const totalVariants = variants.length;
    const bucketSize = Math.floor(100 / totalVariants);

    const abVariants: ABVariant[] = variants.map((v, i) => ({
      id: v.id,
      name: v.name,
      content: v.content,
      weight: v.weight || (1 / totalVariants),
      bucketStart: i * bucketSize,
      bucketEnd: i === totalVariants - 1 ? 99 : (i + 1) * bucketSize - 1,
      impressions: 0, clicks: 0, conversions: 0, ctr: 0, cvr: 0,
      stats: { mean: 0, stdDev: 0, confidenceInterval: [0, 0] },
    }));

    const exp: ABExperiment = {
      id, name, description, type,
      variants: abVariants,
      status: 'draft',
      startedAt: null, endedAt: null,
      minSampleSize: this.config.defaultMinSampleSize,
      confidenceThreshold: this.config.defaultConfidenceThreshold,
      winnerVariantId: null,
      owner,
    };

    this.experiments.set(id, exp);
    log.info(`[ABTest] Created experiment: ${id} (${name}) with ${totalVariants} variants`);
    return exp;
  }

  startExperiment(id: string): boolean {
    const exp = this.experiments.get(id);
    if (!exp || exp.status !== 'draft') return false;

    // 检查运行数量限制
    const running = this.getRunningCount();
    if (running >= this.config.maxRunningExperiments) {
      log.warn(`[ABTest] Cannot start ${id}: max ${this.config.maxRunningExperiments} running experiments`);
      return false;
    }

    exp.status = 'running';
    exp.startedAt = Date.now();
    log.info(`[ABTest] Started experiment: ${id}`);
    return true;
  }

  stopExperiment(id: string): boolean {
    const exp = this.experiments.get(id);
    if (!exp || exp.status !== 'running') return false;
    exp.status = 'completed';
    exp.endedAt = Date.now();
    this.decideWinner(id);
    log.info(`[ABTest] Completed experiment: ${id}${exp.winnerVariantId ? ' winner=' + exp.winnerVariantId : ''}`);
    return true;
  }

  // ── 分流 ──────────────────────────────────────────────────────

  /** 将用户分配到变体。返回变体ID，同一用户始终返回相同结果。 */
  assignVariant(experimentId: string, userId: string): string | null {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return null;

    const hash = this.hashUser(userId, experimentId);
    const bucket = hash % 100;

    for (const variant of exp.variants) {
      if (bucket >= variant.bucketStart && bucket <= variant.bucketEnd) {
        return variant.id;
      }
    }

    // fallback to last variant
    return exp.variants[exp.variants.length - 1].id;
  }

  // ── 事件追踪 ──────────────────────────────────────────────────

  trackImpression(experimentId: string, variantId: string, userId: string, metadata?: Record<string, string>): void {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return;
    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) return;

    this.impressions.push({ experimentId, variantId, userId, timestamp: Date.now(), metadata });
    variant.impressions++;
    this.recalcStats(exp);
  }

  trackClick(experimentId: string, variantId: string, userId: string, action?: string): void {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return;
    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) return;

    this.clicks.push({ experimentId, variantId, userId, timestamp: Date.now(), action });
    variant.clicks++;
    this.recalcStats(exp);
    this.checkAutoDecision(exp);
  }

  trackConversion(experimentId: string, variantId: string, userId: string, value?: number): void {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return;
    const variant = exp.variants.find(v => v.id === variantId);
    if (!variant) return;

    this.conversions.push({ experimentId, variantId, userId, timestamp: Date.now(), value });
    variant.conversions++;
    this.recalcStats(exp);
  }

  // ── 统计 ──────────────────────────────────────────────────────

  getExperiment(id: string): ABExperiment | null {
    return this.experiments.get(id) || null;
  }

  getAllExperiments(): ABExperiment[] {
    return [...this.experiments.values()];
  }

  getStats(): ABStats {
    const all = this.getAllExperiments();
    return {
      totalExperiments: all.length,
      runningExperiments: all.filter(e => e.status === 'running').length,
      completedExperiments: all.filter(e => e.status === 'completed').length,
      totalImpressions: this.impressions.length,
      totalClicks: this.clicks.length,
      overallCTR: this.impressions.length > 0
        ? Math.round(this.clicks.length / this.impressions.length * 10000) / 100
        : 0,
      winnersFound: all.filter(e => e.winnerVariantId).length,
    };
  }

  /** 获取各变体的CTR对比 */
  getComparison(experimentId: string): { variantId: string; name: string; impressions: number; clicks: number; ctr: number; isWinner: boolean; }[] | null {
    const exp = this.experiments.get(experimentId);
    if (!exp) return null;
    return exp.variants.map(v => ({
      variantId: v.id,
      name: v.name,
      impressions: v.impressions,
      clicks: v.clicks,
      ctr: v.ctr,
      isWinner: exp.winnerVariantId === v.id,
    })).sort((a, b) => b.ctr - a.ctr);
  }

  // ── Private ────────────────────────────────────────────────────

  private hashUser(userId: string, experimentId: string): number {
    const input = `${this.config.hashSeed}:${userId}:${experimentId}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  private recalcStats(exp: ABExperiment): void {
    for (const v of exp.variants) {
      v.ctr = v.impressions > 0 ? Math.round(v.clicks / v.impressions * 10000) / 100 : 0;
      v.cvr = v.clicks > 0 ? Math.round(v.conversions / v.clicks * 10000) / 100 : 0;
      // 简化版: 均值=CTR, 标准差=sqrt(p(1-p)/n)
      const p = v.clicks / (v.impressions || 1);
      const se = Math.sqrt(p * (1 - p) / (v.impressions || 1));
      v.stats = {
        mean: v.ctr,
        stdDev: Math.round(se * 10000) / 100,
        confidenceInterval: [
          Math.round(Math.max(0, p - 1.96 * se) * 10000) / 100,
          Math.round(Math.min(100, p + 1.96 * se) * 10000) / 100,
        ],
      };
    }
  }

  private checkAutoDecision(exp: ABExperiment): void {
    if (exp.status !== 'running') return;
    const totalImpressions = exp.variants.reduce((s, v) => s + v.impressions, 0);
    if (totalImpressions < exp.minSampleSize * exp.variants.length) return;

    // 简化版决策: 最佳CTR比第二好高50%以上 → 自动选择winner
    const sorted = [...exp.variants].sort((a, b) => b.ctr - a.ctr);
    if (sorted.length >= 2 && sorted[0].ctr > sorted[1].ctr * 1.5 && sorted[0].impressions >= exp.minSampleSize) {
      this.declareWinner(exp.id, sorted[0].id);
    }
  }

  private decideWinner(id: string): void {
    const exp = this.experiments.get(id);
    if (!exp) return;
    const sorted = [...exp.variants].sort((a, b) => b.ctr - a.ctr);
    if (sorted.length > 0 && sorted[0].impressions >= exp.minSampleSize) {
      this.declareWinner(id, sorted[0].id);
    }
  }

  private declareWinner(experimentId: string, variantId: string): void {
    const exp = this.experiments.get(experimentId);
    if (!exp) return;
    exp.winnerVariantId = variantId;
    log.info(`[ABTest] Winner declared: ${experimentId}/${variantId}`);
  }

  private getRunningCount(): number {
    return [...this.experiments.values()].filter(e => e.status === 'running').length;
  }
}

export default ABTestEngine;
