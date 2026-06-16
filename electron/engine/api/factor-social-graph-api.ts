/**
 * R251 P2-37: FactorSocialGraphAPI — 因子社交图谱路由绑定
 * LOBEHUB | v2.8.0
 * 依赖 FactorSocialGraph (R248 P2-37)
 * 端点: graph/build recomplement/:ids circle/:id crowd-alerts
 * >=300L
 */

import type { FactorSocialGraph } from '../analysis/factor-social-graph';

export class FactorSocialGraphAPI {
  readonly id = 'factor_social_graph_api'; readonly version = '2.8.0';
  constructor(private graph: FactorSocialGraph) {}

  getGraph() {
    const g = this.graph.buildGraph();
    return { success: true, data: g };
  }

  getComplementaryRecommendations(userFactorIds: string[], limit: number = 5) {
    const recs = this.graph.recommendComplementary(userFactorIds, limit);
    return { success: true, data: recs };
  }

  getFactorCircle(factorId: string, limit: number = 5) {
    const circle = this.graph.getFactorCircle(factorId, limit);
    return { success: true, data: circle };
  }

  getCrowdAlerts() {
    const alerts = this.graph.getCrowdAlerts();
    return { success: true, data: alerts };
  }

  getGraphForUI() {
    const g = this.graph.buildGraph();
    // 前端力导向图格式
    return {
      success: true,
      data: {
        nodes: g.nodes.map(n => ({
          id: n.id, name: n.cnName || n.name, level1: n.level1,
          size: n.size || 10, color: n.color,
        })),
        edges: g.edges.slice(0, 300).map(e => ({
          source: e.source, target: e.target,
          value: e.weight, type: e.type,
        })),
        density: g.density,
        clusters: g.clusters.map(c => ({ name: c.name, count: c.factorIds.length })),
      },
    };
  }
}

export function bindFactorSocialRoutes(app: any, basePath: string, api: FactorSocialGraphAPI): void {
  app.get(`${basePath}/graph`, (_: any, res: any) => res.json(api.getGraph()));
  app.get(`${basePath}/graph-ui`, (_: any, res: any) => res.json(api.getGraphForUI()));
  app.get(`${basePath}/circle/:id`, (req: any, res: any) => res.json(api.getFactorCircle(req.params.id, parseInt(req.query.limit) || 5)));
  app.post(`${basePath}/recommend`, (req: any, res: any) => res.json(api.getComplementaryRecommendations(req.body?.factorIds || [], req.body?.limit || 5)));
  app.get(`${basePath}/crowd-alerts`, (_: any, res: any) => res.json(api.getCrowdAlerts()));
}

export default FactorSocialGraphAPI;
