/**
 * R248 P2-37: FactorSocialGraph — 因子社交图谱
 * LOBEHUB | v2.8.0
 *
 * 核心洞察: 大多数平台推"热门策略" → 导致拥挤和衰减。
 * 我们推"与你已有策略低相关"的互补策略 — 反拥挤差异化。
 *
 * 功能:
 *   1. 相关性矩阵: 240因子间的Pearson相关性
 *   2. 互补推荐: 给定用户已选因子 → 推荐低相关的因子
 *   3. 拥挤检测: 标记高风险拥挤区域
 *   4. 可视化数据: 节点-边图数据 for 前端力导向图
 *
 * 约束: 纯TypeScript, >=450L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export interface FactorNode {
  id: string; name: string; cnName: string;
  level1: string; level2: string;
  size: number;          // 因子重要性 (IC均值)
  color: string;         // L1颜色
  x?: number; y?: number; // 布局坐标
}

export interface FactorEdge {
  source: string; target: string;
  weight: number;        // 相关性强度 0-1
  type: 'positive' | 'negative';
}

export interface FactorGraph {
  nodes: FactorNode[];
  edges: FactorEdge[];
  density: number;       // 边密度
  clusters: { name: string; factorIds: string[]; }[];
}

export interface ComplementaryRecommendation {
  factorId: string; name: string; cnName: string;
  correlationScore: number;  // 与用户因子的平均相关性(越低越好)
  diversificationGain: number; // 分散化增益
  cluster: string;
  reason: string;
}

export interface GraphConfig {
  minCorrelationForEdge: number;  // 低于此值不画边
  complementaryThreshold: number; // 低于此值推荐为互补
  crowdAlertCorrelation: number;  // 平均相关性>此值 → 拥挤告警
}

const DEFAULT_CONFIG: GraphConfig = {
  minCorrelationForEdge: 0.15,
  complementaryThreshold: 0.3,
  crowdAlertCorrelation: 0.7,
};

const L1_COLORS: Record<string, string> = {
  L1_CLASSIC: '#3b82f6', L1_FUNDAMENTAL: '#22c55e', L1_ANALYST: '#a855f7',
  L1_SENTIMENT: '#f59e0b', L1_TECHNICAL: '#06b6d4', L1_RISK: '#ef4444',
  L1_MACRO: '#8b5cf6', L1_REVERSAL: '#ec4899', L1_US: '#6366f1',
  L1_HK: '#f43f5e', L1_CRYPTO: '#f97316', L1_CROSS_ASSET: '#14b8a6',
  L1_EVENT: '#84cc16', L1_ESG: '#10b981', L1_LEGACY: '#6b7280',
  L1_COMMODITY: '#d4a574',
};

// ── FactorSocialGraph ──────────────────────────────────────

export class FactorSocialGraph {
  readonly id = 'factor_social_graph';
  readonly version = '2.8.0';

  private config: GraphConfig;
  private nodes: FactorNode[] = [];
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private crowdAlerts: { factorId: string; crowdLevel: number; message: string; }[] = [];

  constructor(config?: Partial<GraphConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 数据注入 ──────────────────────────────────────────

  /** 注入因子节点定义 */
  setNodes(nodes: FactorNode[]): void {
    this.nodes = nodes;
  }

  /** 注入相关性数据 (稀疏矩阵，只有显著相关的边) */
  setCorrelation(sourceId: string, targetId: string, correlation: number): void {
    if (!this.correlationMatrix.has(sourceId)) this.correlationMatrix.set(sourceId, new Map());
    if (!this.correlationMatrix.has(targetId)) this.correlationMatrix.set(targetId, new Map());
    this.correlationMatrix.get(sourceId)!.set(targetId, correlation);
    this.correlationMatrix.get(targetId)!.set(sourceId, correlation);
  }

  /** 从FactorDecayIndex批量导入相关性 */
  importFromDecayIndex(
    factorIds: string[],
    crowdingData: Map<string, { correlatedFactors: string[]; crowdingScore: number }>,
  ): void {
    for (const [id, data] of crowdingData) {
      for (const cf of data.correlatedFactors) {
        this.setCorrelation(id, cf, data.crowdingScore);
      }
    }
    this.detectCrowdAlerts();
  }

  // ── 图计算 ────────────────────────────────────────────

  /** 构建完整图 (节点+边) */
  buildGraph(): FactorGraph {
    const edges: FactorEdge[] = [];
    const processedPairs = new Set<string>();

    for (const [src, targets] of this.correlationMatrix) {
      for (const [tgt, corr] of targets) {
        const pairKey = [src, tgt].sort().join('::');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        if (Math.abs(corr) >= this.config.minCorrelationForEdge) {
          edges.push({
            source: src, target: tgt,
            weight: Math.abs(corr),
            type: corr >= 0 ? 'positive' : 'negative',
          });
        }
      }
    }

    const density = this.nodes.length > 1
      ? (2 * edges.length) / (this.nodes.length * (this.nodes.length - 1))
      : 0;

    const clusters = this.detectClusters();

    return { nodes: this.nodes, edges, density: Math.round(density * 10000) / 10000, clusters };
  }

  /** 为给定因子集推荐互补因子 */
  recommendComplementary(
    userFactorIds: string[],
    limit: number = 5,
  ): ComplementaryRecommendation[] {
    if (userFactorIds.length === 0 || this.nodes.length === 0) return [];

    const results: ComplementaryRecommendation[] = [];

    for (const node of this.nodes) {
      if (userFactorIds.includes(node.id)) continue;

      // 计算该节点与用户所有因子的平均相关性
      let totalCorr = 0;
      let count = 0;
      for (const uf of userFactorIds) {
        const corr = this.getCorrelation(node.id, uf);
        if (corr !== null) { totalCorr += Math.abs(corr); count++; }
      }

      const avgCorr = count > 0 ? totalCorr / count : 0.5; // 未知默认0.5
      const diversGain = 1 - avgCorr; // 分散化增益

      if (avgCorr < this.config.complementaryThreshold) {
        const cluster = this.findCluster(node.id);
        results.push({
          factorId: node.id, name: node.name, cnName: node.cnName,
          correlationScore: Math.round(avgCorr * 1000) / 1000,
          diversificationGain: Math.round(diversGain * 100),
          cluster: cluster || 'unknown',
          reason: this.generateReason(node, avgCorr, diversGain),
        });
      }
    }

    return results
      .sort((a, b) => b.diversificationGain - a.diversificationGain)
      .slice(0, limit);
  }

  /** 拥挤告警 */
  getCrowdAlerts(): { factorId: string; crowdLevel: number; message: string; }[] {
    return this.crowdAlerts;
  }

  /** 某个因子的"朋友圈" (高度相关的因子) */
  getFactorCircle(factorId: string, limit: number = 5): { factorId: string; correlation: number; }[] {
    const targets = this.correlationMatrix.get(factorId);
    if (!targets) return [];
    return [...targets.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, limit)
      .map(([id, corr]) => ({ factorId: id, correlation: Math.round(corr * 1000) / 1000 }));
  }

  // ── Private ────────────────────────────────────────────

  private getCorrelation(a: string, b: string): number | null {
    return this.correlationMatrix.get(a)?.get(b) ?? this.correlationMatrix.get(b)?.get(a) ?? null;
  }

  private detectClusters(): { name: string; factorIds: string[] }[] {
    // 简化的聚类: 按L1大类分组
    const clusters: { name: string; factorIds: string[] }[] = [];
    const l1Map = new Map<string, string[]>();
    for (const node of this.nodes) {
      if (!l1Map.has(node.level1)) l1Map.set(node.level1, []);
      l1Map.get(node.level1)!.push(node.id);
    }
    for (const [l1, ids] of l1Map) {
      clusters.push({ name: l1, factorIds: ids });
    }
    return clusters;
  }

  private findCluster(factorId: string): string {
    const node = this.nodes.find(n => n.id === factorId);
    return node?.level1 || 'unknown';
  }

  private detectCrowdAlerts(): void {
    this.crowdAlerts = [];
    for (const [src, targets] of this.correlationMatrix) {
      if (targets.size < 3) continue;
      const avgCorr = [...targets.values()].reduce((a, b) => a + Math.abs(b), 0) / targets.size;
      if (avgCorr > this.config.crowdAlertCorrelation) {
        this.crowdAlerts.push({
          factorId: src,
          crowdLevel: Math.round(avgCorr * 100),
          message: `拥挤度${Math.round(avgCorr * 100)}%: 与${targets.size}个因子高度相关，建议分散化`,
        });
      }
    }
    this.crowdAlerts.sort((a, b) => b.crowdLevel - a.crowdLevel);
  }

  private generateReason(node: FactorNode, avgCorr: number, gain: number): string {
    if (gain > 90) return `${node.cnName}与你的因子几乎不相关(${Math.round(avgCorr * 100)}%)，极大分散风险`;
    if (gain > 70) return `${node.cnName}与你的因子低相关，良好的互补`;
    if (gain > 50) return `${node.cnName}相关性中等，有一定互补`;
    return `${node.cnName}有一定相关性(${Math.round(avgCorr * 100)}%)`;
  }
}

export default FactorSocialGraph;
